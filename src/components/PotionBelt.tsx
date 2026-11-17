import { Lock, Unlock, Zap } from 'lucide-react';
import { HudSnapshot, POTION_META, SENSE_ORDER, SenseType } from '../types/game';

interface PotionBeltProps {
  hud: HudSnapshot;
  onSelectPotion: (sense: SenseType) => void;
  onLockRoom: () => void;
}

export function PotionBelt({ hud, onSelectPotion, onLockRoom }: PotionBeltProps) {
  const { roomStatus } = hud;

  return (
    <div className="w-full bg-[#111726]/95 border-t border-white/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 z-20 shrink-0">
      {/* Left: Room Privacy Status & Quick Privacy Lock */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          {roomStatus.isPrivate ? (
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Unlock className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <div className="leading-tight">
            <div className="font-semibold text-white whitespace-nowrap">
              {roomStatus.roomName} ·{' '}
              <span className={roomStatus.isPrivate ? 'text-emerald-400' : 'text-amber-300'}>
                {roomStatus.isPrivate
                  ? 'Enclosed & Private'
                  : roomStatus.insideRoom
                  ? `Open (${roomStatus.doorsOpenCount} door, ${roomStatus.windowsOpenCount} blinds)`
                  : 'Public View'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular">
              Friends Made: {hud.totalFriends} · Potions Collected: {hud.totalPotions}
            </div>
          </div>
        </div>

        {roomStatus.insideRoom && !roomStatus.isPrivate && (
          <button
            type="button"
            onClick={onLockRoom}
            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Close Door & Blinds [Space]
          </button>
        )}
      </div>

      {/* Center: 5 Sense-Based Love Potions */}
      <div className="flex items-center gap-2">
        {SENSE_ORDER.map((sense) => {
          const meta = POTION_META[sense];
          const count = hud.inventory[sense];
          const isSelected = hud.selectedPotion === sense;

          return (
            <button
              key={sense}
              type="button"
              onClick={() => onSelectPotion(sense)}
              title={`${meta.label} (${meta.hotkey}): ${meta.description}`}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-slate-800 border-white text-white shadow-md scale-[1.03]'
                  : 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: meta.color,
                  boxShadow: isSelected ? `0 0 10px ${meta.color}` : 'none',
                }}
              />
              <span>{meta.label}</span>
              <span className="font-mono-tabular text-slate-200">×{count}</span>
              <span className="text-[10px] text-slate-500 font-mono-tabular">[{meta.hotkey}]</span>
            </button>
          );
        })}
      </div>

      {/* Right: Sprint Stamina Gauge */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Zap className="w-3.5 h-3.5 text-sky-400" />
        <div className="w-24">
          <div className="flex justify-between text-[11px] leading-none mb-1">
            <span className="text-slate-300">Shift Sprint</span>
            <span className="font-mono-tabular text-slate-200">{Math.round(hud.stamina)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-100"
              style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
