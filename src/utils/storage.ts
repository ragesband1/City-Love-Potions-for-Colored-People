import { PersistentData, RunHistoryEntry, SavedActiveRun } from '../types/game';

const STORAGE_KEY = 'city_love_potions_save_v1';

const DEFAULT_PERSISTENT_DATA: PersistentData = {
  playerName: 'Alex',
  highScore: 0,
  totalLifetimePotions: 0,
  totalLifetimeFriends: 0,
  highestLevel: 1,
  activeRun: null,
  history: [],
};

export function loadPersistentData(): PersistentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PERSISTENT_DATA };
    const parsed = JSON.parse(raw) as Partial<PersistentData>;
    return {
      playerName: typeof parsed.playerName === 'string' && parsed.playerName.trim() ? parsed.playerName : 'Alex',
      highScore: typeof parsed.highScore === 'number' ? parsed.highScore : 0,
      totalLifetimePotions: typeof parsed.totalLifetimePotions === 'number' ? parsed.totalLifetimePotions : 0,
      totalLifetimeFriends: typeof parsed.totalLifetimeFriends === 'number' ? parsed.totalLifetimeFriends : 0,
      highestLevel: typeof parsed.highestLevel === 'number' ? parsed.highestLevel : 1,
      activeRun: parsed.activeRun ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { ...DEFAULT_PERSISTENT_DATA };
  }
}

export function savePersistentData(data: PersistentData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function updatePlayerName(name: string): PersistentData {
  const current = loadPersistentData();
  const next: PersistentData = {
    ...current,
    playerName: name.trim() || 'Alex',
  };
  if (next.activeRun) {
    next.activeRun = { ...next.activeRun, playerName: next.playerName };
  }
  savePersistentData(next);
  return next;
}

export function saveActiveRunRealtime(run: SavedActiveRun): PersistentData {
  const current = loadPersistentData();
  const next: PersistentData = {
    ...current,
    playerName: run.playerName,
    highScore: Math.max(current.highScore, run.score),
    highestLevel: Math.max(current.highestLevel, run.level),
    activeRun: run,
  };
  savePersistentData(next);
  return next;
}

export function recordRunCompletion(entry: Omit<RunHistoryEntry, 'id' | 'timestamp'>): PersistentData {
  const current = loadPersistentData();
  const newEntry: RunHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  const next: PersistentData = {
    ...current,
    playerName: entry.playerName,
    highScore: Math.max(current.highScore, entry.score),
    totalLifetimePotions: current.totalLifetimePotions + entry.potionsCollected,
    totalLifetimeFriends: current.totalLifetimeFriends + entry.friendsMade,
    highestLevel: Math.max(current.highestLevel, entry.levelReached),
    // Clear only the in-progress active run pointer; history is PERMANENT and never deleted!
    activeRun: null,
    history: [newEntry, ...current.history],
  };

  savePersistentData(next);
  return next;
}
