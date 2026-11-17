import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { getLevelSpec } from './game/levels';
import { GameState, HudSnapshot, PersistentData, SenseType } from './types/game';
import { soundEngine } from './utils/audio';
import {
  loadPersistentData,
  recordRunCompletion,
  saveActiveRunRealtime,
  updatePlayerName,
} from './utils/storage';
import { TopHud } from './components/TopHud';
import { PotionBelt } from './components/PotionBelt';
import { PreGameModal } from './components/PreGameModal';
import { EndModal } from './components/EndModal';

function createInitialHud(persistent: PersistentData): HudSnapshot {
  const spec = getLevelSpec(1);
  return {
    level: 1,
    tierLabel: spec.tierLabel,
    tierChallenge: spec.extraChallenge,
    score: 0,
    highScore: persistent.highScore,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    consentCurrent: 0,
    consentTarget: spec.levelTargetFriends,
    totalFriends: 0,
    totalPotions: 0,
    timerSeconds: spec.timerMinutes * 60,
    inventory: { touch: 1, smell: 1, taste: 0, sight: 0, hearing: 0 },
    selectedPotion: 'touch',
    roomStatus: {
      insideRoom: false,
      roomName: 'Public Street',
      isPrivate: false,
      doorsOpenCount: 0,
      windowsOpenCount: 0,
      bystandersInside: 0,
    },
    activeInteraction: null,
    alertBanner: null,
    detectiveWarningSeconds: null,
  };
}

export default function App() {
  const [persistent, setPersistent] = useState<PersistentData>(() => loadPersistentData());
  const [gameState, setGameState] = useState<GameState>('PRE_GAME');
  const [endReason, setEndReason] = useState<string>('');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(loadPersistentData()));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const playerNameRef = useRef<string>(persistent.playerName);

  useEffect(() => {
    playerNameRef.current = persistent.playerName;
  }, [persistent.playerName]);

  useEffect(() => {
    const engine = new GameEngine({
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onAutoSave: (activeRun) => {
        const updated = saveActiveRunRealtime(activeRun);
        setPersistent(updated);
      },
      onGameOver: (reason, snapshot) => {
        setEndReason(reason);
        setGameState('GAME_OVER');
        const updated = recordRunCompletion({
          playerName: playerNameRef.current,
          score: snapshot.score,
          potionsCollected: snapshot.totalPotions,
          friendsMade: snapshot.totalFriends,
          levelReached: snapshot.level,
          outcome: 'GAME_OVER',
          reason,
        });
        setPersistent(updated);
      },
      onVictory: (snapshot) => {
        const victoryMsg = 'Completed all 100 levels with full consensual friendships!';
        setEndReason(victoryMsg);
        setGameState('VICTORY');
        const updated = recordRunCompletion({
          playerName: playerNameRef.current,
          score: snapshot.score,
          potionsCollected: snapshot.totalPotions,
          friendsMade: snapshot.totalFriends,
          levelReached: 100,
          outcome: 'VICTORY',
          reason: victoryMsg,
        });
        setPersistent(updated);
      },
    });

    engineRef.current = engine;
    if (canvasRef.current) {
      engine.setCanvas(canvasRef.current);
    }
    engine.startLoop();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Keep canvas size synced to container dimensions
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(320, Math.floor(rect.width));
      canvas.height = Math.max(240, Math.floor(rect.height));
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Global keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setGameState((prev) => {
          if (prev === 'PLAYING') {
            engineRef.current?.setPaused(true);
            return 'PAUSED';
          }
          if (prev === 'PAUSED') {
            engineRef.current?.setPaused(false);
            return 'PLAYING';
          }
          return prev;
        });
        return;
      }

      engineRef.current?.handleKeyDown(e);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyUp(e);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleStartNew = useCallback(
    (name: string) => {
      const updated = updatePlayerName(name);
      setPersistent(updated);
      playerNameRef.current = updated.playerName;
      setGameState('PLAYING');
      engineRef.current?.startNewGame(updated.playerName, updated.highScore);
    },
    []
  );

  const handleResumeSaved = useCallback(
    (name: string) => {
      const updated = updatePlayerName(name);
      setPersistent(updated);
      playerNameRef.current = updated.playerName;
      if (updated.activeRun) {
        setGameState('PLAYING');
        engineRef.current?.resumeSavedRun(updated.activeRun, updated.highScore);
      } else {
        setGameState('PLAYING');
        engineRef.current?.startNewGame(updated.playerName, updated.highScore);
      }
    },
    []
  );

  const handleTogglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'PLAYING') {
        engineRef.current?.setPaused(true);
        return 'PAUSED';
      }
      if (prev === 'PAUSED') {
        engineRef.current?.setPaused(false);
        return 'PLAYING';
      }
      return prev;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleSelectPotion = useCallback((sense: SenseType) => {
    engineRef.current?.setSelectedPotion(sense);
  }, []);

  const handleLockRoom = useCallback(() => {
    engineRef.current?.lockCurrentRoomPrivacy();
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameState('PLAYING');
    engineRef.current?.startNewGame(persistent.playerName, persistent.highScore);
  }, [persistent.playerName, persistent.highScore]);

  const handleOpenMenu = useCallback(() => {
    engineRef.current?.setPaused(true);
    setGameState('PRE_GAME');
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0E131F] overflow-hidden select-none">
      <TopHud
        hud={hud}
        gameState={gameState}
        history={persistent.history}
        highestLevel={persistent.highestLevel}
        muted={muted}
        onToggleMute={handleToggleMute}
        onTogglePause={handleTogglePause}
      />

      {/* Playable 2D City Canvas Viewport */}
      <main ref={containerRef} className="relative flex-1 w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            engineRef.current?.handleMouseMove(e.clientX - rect.left, e.clientY - rect.top);
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            engineRef.current?.handleCanvasClick(e.clientX - rect.left, e.clientY - rect.top);
          }}
          className="block w-full h-full cursor-crosshair"
        />

        {/* Non-blocking top-edge Alert / Detective Spark Banner */}
        {(hud.detectiveWarningSeconds !== null || hud.alertBanner) && gameState === 'PLAYING' && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-xl w-[92%]">
            {hud.detectiveWarningSeconds !== null && (
              <div className="px-4 py-2 rounded-xl bg-rose-950/95 border border-rose-500 text-rose-100 text-xs font-semibold shadow-xl">
                Detective Bomb Sparking ({hud.detectiveWarningSeconds.toFixed(1)}s) — Hold SHIFT and Sprint Away!
              </div>
            )}
            {hud.alertBanner && (
              <div
                className={`px-4 py-2 rounded-xl border text-xs font-medium shadow-lg text-center ${
                  hud.alertBanner.tone === 'danger'
                    ? 'bg-rose-950/90 border-rose-500/70 text-rose-100'
                    : hud.alertBanner.tone === 'warning'
                    ? 'bg-amber-950/90 border-amber-500/70 text-amber-100'
                    : hud.alertBanner.tone === 'success'
                    ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-100'
                    : 'bg-slate-900/90 border-white/15 text-slate-100'
                }`}
              >
                {hud.alertBanner.message}
              </div>
            )}
          </div>
        )}

        {/* Active Private Interaction Progress Toast */}
        {hud.activeInteraction && gameState === 'PLAYING' && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 border border-emerald-500/60 rounded-xl px-4 py-2.5 shadow-xl min-w-[260px]">
            <div className="flex items-center justify-between text-xs font-semibold text-white mb-1.5">
              <span>Private Friendship with {hud.activeInteraction.npcName}</span>
              <span className="font-mono-tabular text-emerald-400">
                {Math.min(100, Math.round(hud.activeInteraction.progress * 100))}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-75"
                style={{ width: `${Math.min(100, hud.activeInteraction.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 z-30 bg-[#0A0F1A]/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#141A29] border border-white/15 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
              <h2 className="font-display text-2xl font-bold text-white">Game Paused</h2>
              <p className="text-xs text-slate-300 mt-2">
                Level {hud.level} · {hud.tierLabel}
              </p>
              <p className="text-xs text-slate-400 mt-1">{hud.tierChallenge}</p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleOpenMenu}
                  className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg cursor-pointer"
                >
                  Main Menu
                </button>
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer"
                >
                  Resume
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <PotionBelt
        hud={hud}
        onSelectPotion={handleSelectPotion}
        onLockRoom={handleLockRoom}
      />

      {gameState === 'PRE_GAME' && (
        <PreGameModal
          persistent={persistent}
          onStartNew={handleStartNew}
          onResumeSaved={handleResumeSaved}
        />
      )}

      {(gameState === 'GAME_OVER' || gameState === 'VICTORY') && (
        <EndModal
          outcome={gameState}
          reason={endReason}
          hud={hud}
          persistent={persistent}
          onPlayAgain={handlePlayAgain}
          onOpenMenu={handleOpenMenu}
        />
      )}
    </div>
  );
}
