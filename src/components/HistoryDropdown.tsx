import { useState, useRef, useEffect } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { RunHistoryEntry } from '../types/game';

interface HistoryDropdownProps {
  history: RunHistoryEntry[];
  highScore: number;
  highestLevel: number;
}

export function HistoryDropdown({ history, highScore, highestLevel }: HistoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-500"
        aria-expanded={open}
        aria-label="Open History"
      >
        <History className="w-3.5 h-3.5 text-amber-400" />
        <span>History ({history.length})</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[92vw] bg-[#141A29] border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Saved Run History</h3>
              <p className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                Best Score: {highScore.toLocaleString()} · Peak Lv {highestLevel}
              </p>
            </div>
            <span className="text-[11px] text-slate-400">Permanent Local Save</span>
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-white/8">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                No completed runs recorded yet. Every playthrough and Game Over is permanently saved here.
              </div>
            ) : (
              history.map((entry) => {
                const dateStr = new Date(entry.timestamp).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isVictory = entry.outcome === 'VICTORY';
                return (
                  <div key={entry.id} className="px-4 py-3 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {entry.playerName} · {isVictory ? 'Victory (Lv 100)' : `Game Over (Lv ${entry.levelReached})`}
                      </span>
                      <span
                        className={`text-xs font-mono-tabular font-semibold ${
                          isVictory ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {entry.score.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1 font-mono-tabular">
                      Friends: {entry.friendsMade} · Potions: {entry.potionsCollected} · {dateStr}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{entry.reason}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
