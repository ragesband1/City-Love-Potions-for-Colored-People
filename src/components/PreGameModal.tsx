import { useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { PersistentData } from '../types/game';
import { HistoryDropdown } from './HistoryDropdown';

interface PreGameModalProps {
  persistent: PersistentData;
  onStartNew: (playerName: string) => void;
  onResumeSaved: (playerName: string) => void;
}

export function PreGameModal({ persistent, onStartNew, onResumeSaved }: PreGameModalProps) {
  const [nameInput, setNameInput] = useState(persistent.playerName || 'Alex');

  const handleNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartNew(nameInput.trim() || 'Alex');
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0F1A]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#141A29] border border-white/15 rounded-2xl shadow-2xl p-6 md:p-8 my-auto">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-medium text-rose-400">
              100 Levels · 5 Sense Potions · Real-Time Local Save
            </p>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white mt-1 text-balance">
              City Love Potions for Colored People
            </h1>
          </div>
          <HistoryDropdown
            history={persistent.history}
            highScore={persistent.highScore}
            highestLevel={persistent.highestLevel}
          />
        </div>

        {/* High Score & Player Name Form */}
        <form onSubmit={handleNewSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label htmlFor="player-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Player Name
              </label>
              <input
                id="player-name"
                type="text"
                maxLength={24}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3.5 py-2.5 text-sm text-white bg-slate-900 border border-white/15 rounded-lg focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="bg-slate-900/80 border border-white/10 rounded-lg px-3.5 py-2.5">
              <div className="text-[11px] text-slate-400">Permanent High Score</div>
              <div className="font-mono-tabular text-lg font-bold text-amber-300">
                {persistent.highScore.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Concise Rules & Controls Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 bg-slate-900/50 border border-white/10 rounded-xl p-4">
            <div className="space-y-1.5">
              <div className="font-semibold text-white">Controls & Potions</div>
              <p>Arrow keys to move · Hold Shift to sprint away from traps.</p>
              <p>Mouse to aim & click glowing Touch, Smell, Taste, Sight, or Hearing potions.</p>
              <p>Click a potion (or 1–5), then click an eligible polyamorous single.</p>
              <p>Press E or click doors/windows (or Space inside) to close them for privacy.</p>
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-white">Signals & Survival</div>
              <p>Only befriend Polyamorous Singles — glowing dating-app phones earn bonus points.</p>
              <p>Leave Monogamous (ring) & Marriage-seeking characters alone or lose life.</p>
              <p>Keep interactions one-on-one indoors with doors, windows & ceilings closed — witnesses call 911!</p>
              <p>Watch for Disguised Detectives: they spark for 2s before an invisible bomb!</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {persistent.activeRun && (
              <button
                type="button"
                onClick={() => onResumeSaved(nameInput.trim() || persistent.playerName)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  Resume Lv {persistent.activeRun.level} ({persistent.activeRun.score.toLocaleString()} pts)
                </span>
              </button>
            )}

            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {persistent.activeRun ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{persistent.activeRun ? 'Start New Game' : 'Start Game'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
