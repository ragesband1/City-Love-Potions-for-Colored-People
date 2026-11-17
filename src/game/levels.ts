export interface LevelSpec {
  level: number;
  tierIndex: 1 | 2 | 3 | 4;
  tierLabel: string;
  tierGoalSummary: string;
  extraChallenge: string;
  timerMinutes: number;
  levelTargetFriends: number;
  npcDensity: number;
  detectiveRatio: number;
  patrolSpeedMultiplier: number;
  datingAppRatio: number;
}

export function getLevelSpec(level: number): LevelSpec {
  const clamped = Math.max(1, Math.min(100, level));

  if (clamped <= 25) {
    return {
      level: clamped,
      tierIndex: 1,
      tierLabel: 'Levels 1–25 · Foundation',
      tierGoalSummary: 'Befriend 250 eligible polyamorous singles (10 per level)',
      extraChallenge: 'Basic stealth and collection',
      timerMinutes: 15,
      levelTargetFriends: 10,
      npcDensity: 32 + Math.floor(clamped * 0.4),
      detectiveRatio: clamped >= 10 ? 0.07 : 0.04,
      patrolSpeedMultiplier: 0.92 + clamped * 0.005,
      datingAppRatio: 0.42,
    };
  }

  if (clamped <= 50) {
    return {
      level: clamped,
      tierIndex: 2,
      tierLabel: 'Levels 26–50 · Vigilance',
      tierGoalSummary: 'Befriend 500 eligible polyamorous singles (20 per level)',
      extraChallenge: 'Detective traps and invisible bombs',
      timerMinutes: 30,
      levelTargetFriends: 20,
      npcDensity: 44 + Math.floor((clamped - 25) * 0.4),
      detectiveRatio: 0.16,
      patrolSpeedMultiplier: 1.05 + (clamped - 25) * 0.006,
      datingAppRatio: 0.36,
    };
  }

  if (clamped <= 75) {
    return {
      level: clamped,
      tierIndex: 3,
      tierLabel: 'Levels 51–75 · Mastery',
      tierGoalSummary: 'Complete friendship objectives (30 per level)',
      extraChallenge: 'More patrols and tighter timing',
      timerMinutes: 45,
      levelTargetFriends: 30,
      npcDensity: 54 + Math.floor((clamped - 50) * 0.4),
      detectiveRatio: 0.2,
      patrolSpeedMultiplier: 1.2 + (clamped - 50) * 0.007,
      datingAppRatio: 0.32,
    };
  }

  return {
    level: clamped,
    tierIndex: 4,
    tierLabel: 'Levels 76–100 · King Solomon Scale',
    tierGoalSummary: 'Complete the final 1,000-character friendship challenge (40 per level)',
    extraChallenge: 'Maximum difficulty, inspired by a “King Solomon” scale of social connections',
    timerMinutes: 60,
    levelTargetFriends: 40,
    npcDensity: 64 + Math.floor((clamped - 75) * 0.5),
    detectiveRatio: 0.24,
    patrolSpeedMultiplier: 1.38 + (clamped - 75) * 0.008,
    datingAppRatio: 0.28,
  };
}
