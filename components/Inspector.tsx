import React from 'react';
import { RdfNode, RdfEdge } from '../types';
import { X, ExternalLink, Target, Minimize2 } from 'lucide-react';

interface InspectorProps {
  node: RdfNode | null;
  edges: RdfEdge[];
  onClose: () => void;
  onFocusModeToggle: (enabled: boolean) => void;
  focusMode: boolean;
  onCenterNode: (id: string) => void;
  rightOffsetPx?: number;
}

const Inspector: React.FC<InspectorProps> = ({ 
  node, 
  edges, 
  onClose, 
  onFocusModeToggle, 
  focusMode,
  onCenterNode,
  rightOffsetPx = 0
}) => {
  if (!node) return null;

  // Find connections
  const outgoing = edges.filter(e => e.source === node.id);
  const incoming = edges.filter(e => e.target === node.id);

  return (
    <div
      className="absolute top-0 bottom-0 w-80 glass-panel border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 z-20"
      style={{ right: rightOffsetPx }}
    >
      
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-white break-all leading-tight">{node.label}</h2>
          <div className="text-xs text-blue-400 mt-1 font-mono break-all opacity-80">{node.curie || node.id}</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Actions */}
        <div className="flex gap-2">
          <button 
            onClick={() => onFocusModeToggle(!focusMode)}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-medium border transition-colors flex items-center justify-center gap-2 ${
              focusMode 
              ? 'bg-blue-500/20 border-blue-500 text-blue-300' 
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Minimize2 size={12} /> {focusMode ? 'Exit Focus' : 'Focus Mode'}
          </button>
          <button 
            onClick={() => onCenterNode(node.id)}
            className="flex-1 py-1.5 px-3 rounded text-xs font-medium border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 flex items-center justify-center gap-2"
          >
            <Target size={12} /> Center
          </button>
        </div>

        {/* Classes */}
        {node.classes.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-bold mb-2">Types</h3>
            <div className="flex flex-wrap gap-1">
              {node.classes.map((cls, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs border border-violet-500/30">
                  {cls}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing */}
        {outgoing.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-bold mb-2 flex items-center gap-2">
              Outgoing <span className="bg-slate-800 text-slate-400 px-1.5 rounded-full text-[10px]">{outgoing.length}</span>
            </h3>
            <div className="space-y-2">
              {outgoing.map(e => (
                <div key={e.id} className="bg-white/5 p-2 rounded border border-white/5 hover:border-white/20 transition-colors group">
                  <div className="text-[10px] text-slate-400 font-mono mb-0.5">{e.label}</div>
                  <div className="text-xs text-blue-300 truncate cursor-pointer hover:underline" onClick={() => onCenterNode(e.target)}>
                     {/* We assume we can't easily look up target label here without full graph access, showing ID is fallback */}
                     {e.target}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incoming */}
        {incoming.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-bold mb-2 flex items-center gap-2">
              Incoming <span className="bg-slate-800 text-slate-400 px-1.5 rounded-full text-[10px]">{incoming.length}</span>
            </h3>
            <div className="space-y-2">
              {incoming.map(e => (
                <div key={e.id} className="bg-white/5 p-2 rounded border border-white/5 hover:border-white/20 transition-colors">
                  <div className="text-[10px] text-slate-400 font-mono mb-0.5">{e.label}</div>
                  <div className="text-xs text-emerald-300 truncate cursor-pointer hover:underline" onClick={() => onCenterNode(e.source)}>
                     {e.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Inspector;
