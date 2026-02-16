import {
  ApiCapabilitiesResponse,
  ApiGraphCreateResponse,
  ApiGraphStatsResponse,
  ApiHealthResponse,
  ApiJobCreateResponse,
  ApiJobStatus,
  ApiShaclReportResponse,
  GraphByReferenceRequest,
  ReasoningJobCreateRequest,
  ShaclJobCreateRequest
} from '../types';

export class ApiServiceError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiServiceError';
    this.status = status;
    this.details = details;
  }
}

const DEFAULT_TIMEOUT_MS = 20000;

async function parseErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) return await response.json();
    return await response.text();
  } catch {
    return null;
  }
}

function toUserFriendlyError(status: number, payload: unknown): string {
  if (status === 422) {
    if (payload && typeof payload === 'object' && 'detail' in (payload as any)) {
      return `Validation error: ${JSON.stringify((payload as any).detail)}`;
    }
    return 'Validation error (422). Check input payload and required fields.';
  }
  if (status === 404) return 'Resource not found.';
  if (status === 409) return 'Operation not ready yet. Please retry after job completes.';
  if (status === 413) return 'Payload too large for API limits.';
  if (status >= 500) return 'API server error. Check service availability.';
  return `Request failed with status ${status}.`;
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  try {
    const response = await fetch(`${normalizedBase}${path}`, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      const payload = await parseErrorPayload(response);
      throw new ApiServiceError(toUserFriendlyError(response.status, payload), response.status, payload);
    }

    if (response.status === 204) return undefined as T;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as T;
  } catch (err: any) {
    if (err instanceof ApiServiceError) throw err;
    if (err?.name === 'AbortError') {
      throw new ApiServiceError('Request timed out. Please try again.');
    }
    throw new ApiServiceError('Network error. Ensure the API is reachable.');
  } finally {
    clearTimeout(timeout);
  }
}

export const kgApiService = {
  health(baseUrl: string) {
    return request<ApiHealthResponse>(baseUrl, '/health');
  },

  capabilities(baseUrl: string) {
    return request<ApiCapabilitiesResponse>(baseUrl, '/capabilities');
  },

  createGraph(baseUrl: string, body: string, contentType: 'text/turtle' | 'application/ld+json' | 'application/n-triples') {
    return request<ApiGraphCreateResponse>(baseUrl, '/graphs', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    });
  },

  createGraphByReference(baseUrl: string, payload: GraphByReferenceRequest) {
    return request<ApiGraphCreateResponse>(baseUrl, '/graphs:byReference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  graphStats(baseUrl: string, graphId: string) {
    return request<ApiGraphStatsResponse>(baseUrl, `/graphs/${encodeURIComponent(graphId)}/stats`);
  },

  deleteGraph(baseUrl: string, graphId: string) {
    return request<void>(baseUrl, `/graphs/${encodeURIComponent(graphId)}`, { method: 'DELETE' });
  },

  createReasoningJob(baseUrl: string, payload: ReasoningJobCreateRequest) {
    return request<ApiJobCreateResponse>(baseUrl, '/reasoning/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  reasoningJob(baseUrl: string, jobId: string) {
    return request<ApiJobStatus>(baseUrl, `/reasoning/jobs/${encodeURIComponent(jobId)}`);
  },

  reasoningResult(baseUrl: string, jobId: string, accept: string) {
    return request<string>(baseUrl, `/reasoning/jobs/${encodeURIComponent(jobId)}/result`, {
      headers: { Accept: accept }
    });
  },

  reasoningRun(baseUrl: string, payload: ReasoningJobCreateRequest, accept: string) {
    return request<string>(baseUrl, '/reasoning/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: accept },
      body: JSON.stringify(payload)
    });
  },

  uploadShapes(baseUrl: string, body: string, contentType: 'text/turtle' | 'application/ld+json') {
    return request<{ shapesId: string; namedGraphIri: string }>(baseUrl, '/shacl/shapes', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    });
  },

  deleteShapes(baseUrl: string, shapesId: string) {
    return request<void>(baseUrl, `/shacl/shapes/${encodeURIComponent(shapesId)}`, { method: 'DELETE' });
  },

  createShaclJob(baseUrl: string, payload: ShaclJobCreateRequest) {
    return request<ApiJobCreateResponse>(baseUrl, '/shacl/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  shaclJob(baseUrl: string, jobId: string) {
    return request<ApiJobStatus>(baseUrl, `/shacl/jobs/${encodeURIComponent(jobId)}`);
  },

  shaclReport(baseUrl: string, jobId: string) {
    return request<ApiShaclReportResponse>(baseUrl, `/shacl/jobs/${encodeURIComponent(jobId)}/report`);
  }
};
