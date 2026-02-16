import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileWarning, Search, X } from 'lucide-react';
import { ApiShaclReportResponse, ShaclViolation } from '../../types';

interface ShaclReportPanelProps {
  report: ApiShaclReportResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onFocusViolation: (violation: ShaclViolation) => void;
}

const ShaclReportPanel: React.FC<ShaclReportPanelProps> = ({
  report,
  isOpen,
  onClose,
  onFocusViolation
}) => {
  const [query, setQuery] = useState('');

  const violations = report?.report?.violations || [];
  const conforms = report?.report?.conforms ?? true;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return violations;
    return violations.filter((v) => {
      const text = `${v.message || ''} ${v.focusNode || ''} ${v.resultPath || ''} ${v.sourceConstraintComponent || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [query, violations]);

  if (!isOpen || !report) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[26rem] glass-panel border-l border-white/10 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">SHACL Validation Report</h2>
          <div className="text-xs text-slate-400 mt-1">Interactive violations explorer</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
      </div>

      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          {conforms ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
          <span className={conforms ? 'text-emerald-300' : 'text-amber-300'}>Conforms: {String(conforms)}</span>
          <span className="ml-auto text-slate-400">{violations.length} violations</span>
        </div>

        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search focus node, path, or message..."
            className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-8 pr-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <Search size={13} className="absolute left-2.5 top-2 text-slate-500" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-xs text-slate-500 border border-slate-700 rounded-md p-3">No violations match your filter.</div>
        )}

        {filtered.map((v, index) => (
          <button
            key={`${v.id || 'vio'}-${index}`}
            onClick={() => onFocusViolation(v)}
            className="w-full text-left bg-slate-900/70 border border-slate-700 hover:border-blue-500/60 hover:bg-slate-800 rounded-lg p-3 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="text-xs font-medium text-slate-200 line-clamp-2">{v.message || 'Validation violation'}</div>
              <FileWarning size={14} className="text-amber-400 shrink-0 mt-0.5" />
            </div>
            <div className="text-[11px] text-slate-400 break-all">focus: <span className="text-blue-300">{v.focusNode || 'n/a'}</span></div>
            <div className="text-[11px] text-slate-400 break-all">path: {v.resultPath || 'n/a'}</div>
            <div className="text-[11px] text-slate-500 break-all">component: {v.sourceConstraintComponent || 'n/a'}</div>
            <div className="mt-2 text-[10px] text-slate-500">Click to highlight in graph</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ShaclReportPanel;
