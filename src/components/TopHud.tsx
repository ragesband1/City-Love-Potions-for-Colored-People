import { Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { GameState, HudSnapshot, RunHistoryEntry } from '../types/game';
import { HistoryDropdown } from './HistoryDropdown';

interface TopHudProps {
  hud: HudSnapshot;
  gameState: GameState;
  history: RunHistoryEntry[];
  highestLevel: number;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function TopHud({
  hud,
  gameState,
  history,
  highestLevel,
  muted,
  onToggleMute,
  onTogglePause,
}: TopHudProps) {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const consentPct = Math.max(0, Math.min(100, (hud.consentCurrent / hud.consentTarget) * 100));
  const lowTime = hud.timerSeconds < 60;

  return (
    <header className="w-full bg-[#111726]/95 border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-4 z-30 shrink-0">
      {/* Zone 1: Single-line Brand Title */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <span className="font-display text-base md:text-lg font-bold tracking-tight text-white whitespace-nowrap">
          City Love Potions
        </span>
        <span className="hidden xl:inline text-xs text-slate-400 whitespace-nowrap">
          {hud.tierLabel}
        </span>
      </div>

      {/* Zone 2: Key Telemetry Bars (HP, Consent Meter, Timer, Score) */}
      <div className="flex items-center gap-4 md:gap-6 flex-wrap md:flex-nowrap justify-center">
        {/* Life Bar */}
        <div className="flex items-center gap-2">
          <div className="w-24 md:w-28">
            <div className="flex items-center justify-between text-[11px] leading-none mb-1">
              <span className="text-slate-300 font-medium">Life</span>
              <span className="font-mono-tabular text-slate-100 font-semibold">
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Consent Meter */}
        <div className="flex items-center gap-2">
          <div className="w-28 md:w-32">
            <div className="flex items-center justify-between text-[11px] leading-none mb-1">
              <span className="text-slate-300 font-medium">Consent · Lv {hud.level}</span>
              <span className="font-mono-tabular text-rose-300 font-semibold">
                {hud.consentCurrent}/{hud.consentTarget}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-150"
                style={{ width: `${consentPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timer & Score */}
        <div className="flex items-center gap-3 text-xs font-mono-tabular whitespace-nowrap">
          <div>
            <span className="text-slate-400 mr-1.5">Time</span>
            <span className={`font-semibold ${lowTime ? 'text-rose-400' : 'text-white'}`}>
              {formatTime(hud.timerSeconds)}
            </span>
          </div>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <div>
            <span className="text-slate-400 mr-1.5">Score</span>
            <span className="text-amber-300 font-semibold">{hud.score.toLocaleString()}</span>
          </div>
          <span className="hidden lg:inline text-slate-600" aria-hidden="true">·</span>
          <div className="hidden lg:block">
            <span className="text-slate-400 mr-1.5">Best</span>
            <span className="text-slate-200 font-semibold">{hud.highScore.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Zone 3: Controls (History Dropdown, Mute, Pause) */}
      <div className="flex items-center gap-2 shrink-0">
        <HistoryDropdown history={history} highScore={hud.highScore} highestLevel={highestLevel} />

        <button
          type="button"
          onClick={onToggleMute}
          className="p-2 text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors cursor-pointer"
          title={muted ? 'Unmute Sound' : 'Mute Sound'}
          aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>

        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <button
            type="button"
            onClick={onTogglePause}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {gameState === 'PAUSED' ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
