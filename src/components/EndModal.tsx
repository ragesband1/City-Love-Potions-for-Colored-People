import { RotateCcw, Trophy, AlertTriangle } from 'lucide-react';
import { HudSnapshot, PersistentData } from '../types/game';
import { HistoryDropdown } from './HistoryDropdown';

interface EndModalProps {
  outcome: 'GAME_OVER' | 'VICTORY';
  reason: string;
  hud: HudSnapshot;
  persistent: PersistentData;
  onPlayAgain: () => void;
  onOpenMenu: () => void;
}

export function EndModal({
  outcome,
  reason,
  hud,
  persistent,
  onPlayAgain,
  onOpenMenu,
}: EndModalProps) {
  const isVictory = outcome === 'VICTORY';

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0F1A]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141A29] border border-white/15 rounded-2xl shadow-2xl p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isVictory ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {isVictory ? <Trophy className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                {isVictory ? 'All 100 Levels Mastered' : 'Game Over'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">{reason}</p>
            </div>
          </div>
          <HistoryDropdown
            history={persistent.history}
            highScore={persistent.highScore}
            highestLevel={persistent.highestLevel}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 text-xs">
          <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400">Final Score</div>
            <div className="font-mono-tabular text-lg font-bold text-amber-300 mt-0.5">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400">Best High Score</div>
            <div className="font-mono-tabular text-lg font-bold text-white mt-0.5">
              {persistent.highScore.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400">Friends Made</div>
            <div className="font-mono-tabular text-base font-semibold text-emerald-400 mt-0.5">
              {hud.totalFriends} · Lv {hud.level}
            </div>
          </div>
          <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400">Potions Collected</div>
            <div className="font-mono-tabular text-base font-semibold text-sky-300 mt-0.5">
              {hud.totalPotions}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-4">
          This playthrough has been permanently saved to your local History dropdown.
        </p>

        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onOpenMenu}
            className="px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Main Menu
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
