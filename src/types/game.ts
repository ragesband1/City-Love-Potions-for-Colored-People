export type GameState = 'PRE_GAME' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY';

export type SenseType = 'touch' | 'smell' | 'taste' | 'sight' | 'hearing';

export interface PotionMeta {
  id: SenseType;
  label: string;
  hotkey: string;
  color: string;
  glow: string;
  description: string;
}

export const POTION_META: Record<SenseType, PotionMeta> = {
  touch: {
    id: 'touch',
    label: 'Touch',
    hotkey: '1',
    color: '#F43F5E',
    glow: 'rgba(244, 63, 94, 0.55)',
    description: 'Warm velvet ember — restores +12 HP and sparks gentle connection.',
  },
  smell: {
    id: 'smell',
    label: 'Smell',
    hotkey: '2',
    color: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.55)',
    description: 'Night jasmine mist — restores +12 HP and draws kindred spirits.',
  },
  taste: {
    id: 'taste',
    label: 'Taste',
    hotkey: '3',
    color: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.55)',
    description: 'Spiced honey nectar — restores +12 HP and sweetens rapport.',
  },
  sight: {
    id: 'sight',
    label: 'Sight',
    hotkey: '4',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.55)',
    description: 'Emerald prism — restores +12 HP and illuminates true signals.',
  },
  hearing: {
    id: 'hearing',
    label: 'Hearing',
    hotkey: '5',
    color: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.55)',
    description: 'Midnight chime — restores +12 HP and harmonizes private talks.',
  },
};

export const SENSE_ORDER: SenseType[] = ['touch', 'smell', 'taste', 'sight', 'hearing'];

export type CharacterArchetype =
  | 'poly_single'
  | 'monogamous'
  | 'marriage_seeker'
  | 'detective';

export type VehicleType =
  | 'plane'
  | 'train'
  | 'bus'
  | 'suv'
  | 'jeep'
  | 'tricycle'
  | 'car'
  | 'taxi';

export type BuildingKind = 'house' | 'hotel' | 'motel' | 'apartment';

export interface Door {
  id: string;
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
}

export interface WindowAperture {
  id: string;
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean; // true = curtains open (witnesses can peek!), false = blinds shut (private)
}

export interface Room {
  id: string;
  buildingId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floorColor: string;
  accentColor: string;
}

export interface Building {
  id: string;
  name: string;
  kind: BuildingKind;
  x: number;
  y: number;
  width: number;
  height: number;
  roofColor: string;
  wallColor: string;
  rooms: Room[];
}

export interface PublicSpace {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'park' | 'plaza' | 'runway' | 'station';
}

export interface PotionDrop {
  id: string;
  sense: SenseType;
  x: number;
  y: number;
  bobOffset: number;
  spawnedAt: number;
}

export interface NpcCharacter {
  id: string;
  name: string;
  archetype: CharacterArchetype;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  radius: number;
  skinTone: string;
  hairColor: string;
  hairStyle: 'afro' | 'braids' | 'bun' | 'waves' | 'locs';
  outfitColor: string;
  hasDatingApp: boolean;
  hasRing: boolean;
  seekingMarriage: boolean;
  preferredSense: SenseType;
  arrivedBy: VehicleType | 'walk';
  followingPlayer: boolean;
  befriended: boolean;
  befriendedAt: number;
  // Detective trap state
  sparkActive: boolean;
  sparkTimer: number; // counts down from 2.0 to 0
  bombDetonated: boolean;
  disarmed: boolean;
  // Walk animation
  walkPhase: number;
  waitTimer: number;
  statusBubble?: string;
  statusBubbleTimer: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  angle: number;
  dropCooldown: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  text?: string;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ActiveInteraction {
  npcId: string;
  npcName: string;
  sense: SenseType;
  progress: number; // 0 to 1
  duration: number;
  hasDatingAppBonus: boolean;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  skinTone: string;
  outfitColor: string;
  walkPhase: number;
  facingAngle: number;
}

export interface Inventory {
  touch: number;
  smell: number;
  taste: number;
  sight: number;
  hearing: number;
}

export interface HudSnapshot {
  level: number;
  tierLabel: string;
  tierChallenge: string;
  score: number;
  highScore: number;
  hp: number;
  maxHp: number;
  stamina: number;
  consentCurrent: number;
  consentTarget: number;
  totalFriends: number;
  totalPotions: number;
  timerSeconds: number;
  inventory: Inventory;
  selectedPotion: SenseType | null;
  roomStatus: {
    insideRoom: boolean;
    roomName: string;
    isPrivate: boolean;
    doorsOpenCount: number;
    windowsOpenCount: number;
    bystandersInside: number;
  };
  activeInteraction: ActiveInteraction | null;
  alertBanner: {
    message: string;
    tone: 'info' | 'warning' | 'danger' | 'success';
  } | null;
  detectiveWarningSeconds: number | null;
}

export interface RunHistoryEntry {
  id: string;
  playerName: string;
  score: number;
  potionsCollected: number;
  friendsMade: number;
  levelReached: number;
  outcome: 'GAME_OVER' | 'VICTORY';
  reason: string;
  timestamp: string;
}

export interface SavedActiveRun {
  playerName: string;
  level: number;
  score: number;
  hp: number;
  consentCurrent: number;
  totalFriends: number;
  totalPotions: number;
  timerSeconds: number;
  inventory: Inventory;
  updatedAt: string;
}

export interface PersistentData {
  playerName: string;
  highScore: number;
  totalLifetimePotions: number;
  totalLifetimeFriends: number;
  highestLevel: number;
  activeRun: SavedActiveRun | null;
  history: RunHistoryEntry[];
}
