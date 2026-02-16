import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Core } from 'cytoscape';
import { X, Maximize2, Minimize2, Settings2 } from 'lucide-react';

interface MinimapProps {
  cy: Core | null;
  isOpen: boolean;
  onClose: () => void;
}

type MinimapSize = 'sm' | 'md' | 'lg';

const SIZES = {
  sm: { w: 200, h: 150 },
  md: { w: 300, h: 225 },
  lg: { w: 450, h: 340 } // 4:3 aspect ratio roughly
};

const Minimap: React.FC<MinimapProps> = ({ cy, isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<MinimapSize>('sm');
  const [isDragging, setIsDragging] = useState(false);

  // Coordinate Mapping Helper
  const getTransform = useCallback((canvasWidth: number, canvasHeight: number, bounds: any) => {
    const w = bounds.w || 1;
    const h = bounds.h || 1;
    const scale = Math.min(canvasWidth / w, canvasHeight / h) * 0.9; // 0.9 for padding
    
    // Center the graph in the canvas
    const offsetX = (canvasWidth - w * scale) / 2;
    const offsetY = (canvasHeight - h * scale) / 2;

    return {
      modelToMini: (x: number, y: number) => ({
        x: (x - bounds.x1) * scale + offsetX,
        y: (y - bounds.y1) * scale + offsetY
      }),
      miniToModel: (x: number, y: number) => ({
        x: (x - offsetX) / scale + bounds.x1,
        y: (y - offsetY) / scale + bounds.y1
      }),
      scale
    };
  }, []);

  const draw = useCallback(() => {
    if (!cy || !canvasRef.current || !isOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Setup dimensions
    const { w: cw, h: ch } = SIZES[size];
    // Handle Retina displays
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
    }

    // 2. Clear
    ctx.clearRect(0, 0, cw, ch);

    // 3. Get Bounds
    const elements = cy.elements();
    if (elements.length === 0) return;
    
    const bounds = elements.boundingBox();
    if (bounds.w === 0 && bounds.h === 0) return;

    const { modelToMini, scale } = getTransform(cw, ch, bounds);

    // 4. Draw Nodes
    // Optimization: Cache styles or simple generic color
    const nodes = cy.nodes();
    
    nodes.forEach(node => {
      const pos = node.position();
      const pt = modelToMini(pos.x, pos.y);
      
      ctx.beginPath();
      // Draw simplified dots
      const color = node.style('background-color') || '#94a3b8';
      ctx.fillStyle = color;
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. Draw Viewport Rect
    const extent = cy.extent(); // { x1, y1, x2, y2, w, h } in model coordinates
    const tl = modelToMini(extent.x1, extent.y1);
    const br = modelToMini(extent.x2, extent.y2);

    const vw = br.x - tl.x;
    const vh = br.y - tl.y;

    ctx.strokeStyle = '#f87171'; // Red-400
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, vw, vh);
    
    ctx.fillStyle = 'rgba(248, 113, 113, 0.1)';
    ctx.fillRect(tl.x, tl.y, vw, vh);

  }, [cy, isOpen, size, getTransform]);

  // Hook into Cytoscape events
  useEffect(() => {
    if (!cy) return;
    const update = () => requestAnimationFrame(draw);
    
    cy.on('render pan zoom resize layoutstop', update);
    // Initial draw
    update();

    return () => {
      cy.off('render pan zoom resize layoutstop', update);
    };
  }, [cy, draw]);

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cy || !canvasRef.current) return;
    setIsDragging(true);
    handleMouseMove(e, true);
  };

  const handleMouseMove = (e: React.MouseEvent, force = false) => {
    if ((!isDragging && !force) || !cy || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const { w: cw, h: ch } = SIZES[size];
    const bounds = cy.elements().boundingBox();
    const { miniToModel } = getTransform(cw, ch, bounds);
    
    // Map click point to model coordinate
    const modelPt = miniToModel(mx, my);

    // Center the main view on this point
    // We need to calculate pan such that modelPt is at center of viewport
    // cy.center() animates, we want instant pan for drag
    // pan = centerOfViewport - modelPt * zoom
    // But cy.pan() is the translation. 
    // Easiest API: cy.pan( newPan ) or cy.viewport(zoom, pan)
    
    // Actually simpler: cy.center() but disable animation if dragging? 
    // cy.center() doesn't support 'no animation' flag in all versions conveniently?
    // Let's manually calc pan.
    const w = cy.width();
    const h = cy.height();
    const z = cy.zoom();
    
    const newPan = {
      x: w / 2 - modelPt.x * z,
      y: h / 2 - modelPt.y * z
    };

    cy.pan(newPan);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cy) return;
    e.preventDefault();
    e.stopPropagation();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    // Zoom centered on the graph center currently
    // Optional: Zoom centered on cursor in minimap? 
    // That's complex math. Let's just zoom center of view.
    cy.zoom({
        level: cy.zoom() * zoomFactor,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-4 right-4 z-40 flex flex-col glass-panel rounded-xl overflow-hidden shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ width: SIZES[size].w, height: SIZES[size].h + 40 }}
    >
      {/* Header */}
      <div className="h-10 bg-white/5 border-b border-white/10 flex items-center justify-between px-3 shrink-0">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Overview</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setSize(s => s === 'sm' ? 'md' : s === 'md' ? 'lg' : 'sm')}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            title="Toggle Size"
          >
            {size === 'sm' ? <Maximize2 size={12} /> : <Settings2 size={12} />}
          </button>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative bg-slate-900/40 cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="block w-full h-full"
        />
      </div>
    </div>
  );
};

export default Minimap;
