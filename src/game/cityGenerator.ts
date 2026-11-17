import {
  Building,
  BuildingKind,
  CharacterArchetype,
  Door,
  NpcCharacter,
  PotionDrop,
  PublicSpace,
  Room,
  SENSE_ORDER,
  SenseType,
  Vehicle,
  VehicleType,
  WindowAperture,
} from '../types/game';
import { LevelSpec } from './levels';

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;

export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface RoadBand {
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: 'horizontal' | 'vertical';
}

export interface CityMap {
  buildings: Building[];
  rooms: Room[];
  walls: WallRect[];
  doors: Door[];
  windows: WindowAperture[];
  publicSpaces: PublicSpace[];
  roads: RoadBand[];
  trainTrackY: number;
  runwayRect: { x: number; y: number; w: number; h: number };
}

export const SKIN_TONES = [
  '#4A2816', // Deep espresso
  '#6B3A24', // Rich mahogany
  '#8D5524', // Warm chestnut
  '#A66E44', // Golden bronze
  '#C68642', // Honey caramel
  '#D9A066', // Amber tan
  '#E0AC69', // Warm peach-gold
];

export const HAIR_COLORS = ['#111318', '#1F1612', '#2E1B14', '#4B281B', '#3D1E26'];

export const OUTFIT_COLORS = [
  '#E11D48',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
];

const FIRST_NAMES = [
  'Amara', 'Zuri', 'Nia', 'Kendra', 'Talia', 'Sanaa', 'Maya', 'Imani',
  'Laila', 'Camila', 'Priya', 'Ananya', 'Yara', 'Naomi', 'Nadia', 'Elena',
  'Keisha', 'Simone', 'Jasmine', 'Aaliyah', 'Sofia', 'Matea', 'Kiana', 'Rhea',
  'Zara', 'Malia', 'Fatima', 'Dalia', 'Serena', 'Tessa', 'Chidi', 'Farah',
];

const LAST_NAMES = [
  'Okafor', 'Mensah', 'Bautista', 'Santos', 'Diallo', 'Patel', 'Reyes', 'Jordan',
  'Brooks', 'Morales', 'Toussaint', 'Alvarez', 'Bello', 'Suleiman', 'Cruz', 'Hayes',
];

const HAIR_STYLES: NpcCharacter['hairStyle'][] = ['afro', 'braids', 'bun', 'waves', 'locs'];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildCityMap(): CityMap {
  const buildings: Building[] = [];
  const rooms: Room[] = [];
  const walls: WallRect[] = [];
  const doors: Door[] = [];
  const windows: WindowAperture[] = [];

  const WALL_T = 14;
  const DOOR_LEN = 54;
  const WIN_LEN = 50;

  interface RoomBlueprint {
    name: string;
    rx: number;
    ry: number;
    rw: number;
    rh: number;
    floorColor: string;
    accentColor: string;
    doorSide: 'top' | 'bottom' | 'left' | 'right';
    windowSide: 'top' | 'bottom' | 'left' | 'right';
  }

  function addBuilding(
    id: string,
    name: string,
    kind: BuildingKind,
    x: number,
    y: number,
    w: number,
    h: number,
    roofColor: string,
    wallColor: string,
    roomSpecs: RoomBlueprint[]
  ) {
    const bRooms: Room[] = [];
    for (let i = 0; i < roomSpecs.length; i++) {
      const spec = roomSpecs[i];
      const roomId = `${id}-room-${i}`;
      const room: Room = {
        id: roomId,
        buildingId: id,
        name: spec.name,
        x: spec.rx,
        y: spec.ry,
        width: spec.rw,
        height: spec.rh,
        floorColor: spec.floorColor,
        accentColor: spec.accentColor,
      };
      rooms.push(room);
      bRooms.push(room);

      const addSideWithOpening = (
        side: 'top' | 'bottom' | 'left' | 'right',
        openingType: 'door' | 'window' | 'solid'
      ) => {
        const isHoriz = side === 'top' || side === 'bottom';
        const sx = side === 'right' ? spec.rx + spec.rw - WALL_T : spec.rx;
        const sy = side === 'bottom' ? spec.ry + spec.rh - WALL_T : spec.ry;

        if (openingType === 'solid') {
          walls.push({
            x: sx,
            y: sy,
            w: isHoriz ? spec.rw : WALL_T,
            h: isHoriz ? WALL_T : spec.rh,
            color: wallColor,
          });
          return;
        }

        const openLen = openingType === 'door' ? DOOR_LEN : WIN_LEN;
        if (isHoriz) {
          const mid = spec.rx + spec.rw / 2;
          const openStart = mid - openLen / 2;
          const openEnd = mid + openLen / 2;
          walls.push({ x: spec.rx, y: sy, w: openStart - spec.rx, h: WALL_T, color: wallColor });
          walls.push({
            x: openEnd,
            y: sy,
            w: spec.rx + spec.rw - openEnd,
            h: WALL_T,
            color: wallColor,
          });
          if (openingType === 'door') {
            doors.push({
              id: `${roomId}-door`,
              roomId,
              x: openStart,
              y: sy,
              width: openLen,
              height: WALL_T,
              orientation: 'horizontal',
              isOpen: true, // Start open so players can enter easily, then close for privacy!
            });
          } else {
            windows.push({
              id: `${roomId}-win-${side}`,
              roomId,
              x: openStart,
              y: sy,
              width: openLen,
              height: WALL_T,
              orientation: 'horizontal',
              isOpen: true, // Blinds start open; close them for full privacy
            });
          }
        } else {
          const mid = spec.ry + spec.rh / 2;
          const openStart = mid - openLen / 2;
          const openEnd = mid + openLen / 2;
          walls.push({ x: sx, y: spec.ry, w: WALL_T, h: openStart - spec.ry, color: wallColor });
          walls.push({
            x: sx,
            y: openEnd,
            w: WALL_T,
            h: spec.ry + spec.rh - openEnd,
            color: wallColor,
          });
          if (openingType === 'door') {
            doors.push({
              id: `${roomId}-door`,
              roomId,
              x: sx,
              y: openStart,
              width: WALL_T,
              height: openLen,
              orientation: 'vertical',
              isOpen: true,
            });
          } else {
            windows.push({
              id: `${roomId}-win-${side}`,
              roomId,
              x: sx,
              y: openStart,
              width: WALL_T,
              height: openLen,
              orientation: 'vertical',
              isOpen: true,
            });
          }
        }
      };

      const sides: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];
      for (const s of sides) {
        if (s === spec.doorSide) addSideWithOpening(s, 'door');
        else if (s === spec.windowSide) addSideWithOpening(s, 'window');
        else addSideWithOpening(s, 'solid');
      }
    }

    buildings.push({
      id,
      name,
      kind,
      x,
      y,
      width: w,
      height: h,
      roofColor,
      wallColor,
      rooms: bRooms,
    });
  }

  // 1. Sunlit Bungalow (House) - Top Left
  addBuilding('house-1', 'Sunlit Bungalow', 'house', 110, 470, 380, 260, '#9A3412', '#FDE68A', [
    {
      name: 'Sunroom Suite',
      rx: 110,
      ry: 470,
      rw: 186,
      rh: 260,
      floorColor: '#45271D',
      accentColor: '#F59E0B',
      doorSide: 'top',
      windowSide: 'right',
    },
    {
      name: 'Garden Parlor',
      rx: 304,
      ry: 470,
      rw: 186,
      rh: 260,
      floorColor: '#3E2723',
      accentColor: '#F43F5E',
      doorSide: 'bottom',
      windowSide: 'top',
    },
  ]);

  // 2. Brownstone Manor (House) - Bottom Left
  addBuilding('house-2', 'Brownstone Manor', 'house', 110, 820, 380, 240, '#7C2D12', '#E2B887', [
    {
      name: 'Velvet Lounge',
      rx: 110,
      ry: 820,
      rw: 186,
      rh: 240,
      floorColor: '#3B1F2B',
      accentColor: '#EC4899',
      doorSide: 'top',
      windowSide: 'left',
    },
    {
      name: 'Terrace Room',
      rx: 304,
      ry: 820,
      rw: 186,
      rh: 240,
      floorColor: '#2D2A3E',
      accentColor: '#A855F7',
      doorSide: 'bottom',
      windowSide: 'right',
    },
  ]);

  // 3. Grand Plaza Hotel (Hotel) - Center North
  addBuilding('hotel-1', 'Grand Plaza Hotel', 'hotel', 720, 470, 510, 260, '#1E3A8A', '#CBD5E1', [
    {
      name: 'Hotel Suite 201',
      rx: 720,
      ry: 470,
      rw: 164,
      rh: 260,
      floorColor: '#1E293B',
      accentColor: '#38BDF8',
      doorSide: 'top',
      windowSide: 'bottom',
    },
    {
      name: 'Hotel Suite 202',
      rx: 893,
      ry: 470,
      rw: 164,
      rh: 260,
      floorColor: '#242038',
      accentColor: '#F43F5E',
      doorSide: 'bottom',
      windowSide: 'top',
    },
    {
      name: 'Penthouse Alcove',
      rx: 1066,
      ry: 470,
      rw: 164,
      rh: 260,
      floorColor: '#1F2E2B',
      accentColor: '#10B981',
      doorSide: 'top',
      windowSide: 'right',
    },
  ]);

  // 4. Rosecourt Apartments (Apartment) - Center East North
  addBuilding('apt-1', 'Rosecourt Apartments', 'apartment', 1290, 470, 380, 260, '#831843', '#FBCFE8', [
    {
      name: 'Apartment 4A',
      rx: 1290,
      ry: 470,
      rw: 186,
      rh: 260,
      floorColor: '#2E1E2B',
      accentColor: '#F43F5E',
      doorSide: 'top',
      windowSide: 'bottom',
    },
    {
      name: 'Apartment 4B',
      rx: 1484,
      ry: 470,
      rw: 186,
      rh: 260,
      floorColor: '#25263B',
      accentColor: '#A855F7',
      doorSide: 'bottom',
      windowSide: 'top',
    },
  ]);

  // 5. Starlight Motel (Motel) - Center East South
  addBuilding('motel-1', 'Starlight Motel', 'motel', 1220, 820, 450, 240, '#312E81', '#A5B4FC', [
    {
      name: 'Motel Unit 1',
      rx: 1220,
      ry: 820,
      rw: 144,
      rh: 240,
      floorColor: '#1E2436',
      accentColor: '#F59E0B',
      doorSide: 'bottom',
      windowSide: 'top',
    },
    {
      name: 'Motel Unit 2',
      rx: 1373,
      ry: 820,
      rw: 144,
      rh: 240,
      floorColor: '#24293D',
      accentColor: '#38BDF8',
      doorSide: 'bottom',
      windowSide: 'top',
    },
    {
      name: 'Motel Unit 3',
      rx: 1526,
      ry: 820,
      rw: 144,
      rh: 240,
      floorColor: '#272038',
      accentColor: '#EC4899',
      doorSide: 'bottom',
      windowSide: 'top',
    },
  ]);

  // 6. Harlem Heights Apartments - Far Right North
  addBuilding('apt-2', 'Harlem Heights', 'apartment', 1880, 470, 400, 260, '#065F46', '#A7F3D0', [
    {
      name: 'Skyline Loft W',
      rx: 1880,
      ry: 470,
      rw: 196,
      rh: 260,
      floorColor: '#1B2E2A',
      accentColor: '#10B981',
      doorSide: 'left',
      windowSide: 'bottom',
    },
    {
      name: 'Skyline Loft E',
      rx: 2084,
      ry: 470,
      rw: 196,
      rh: 260,
      floorColor: '#232B3A',
      accentColor: '#F59E0B',
      doorSide: 'bottom',
      windowSide: 'top',
    },
  ]);

  // 7. Oasis Villa (House) - Far Right South
  addBuilding('house-3', 'Oasis Villa', 'house', 1880, 820, 400, 240, '#92400E', '#FCD34D', [
    {
      name: 'Amber Suite',
      rx: 1880,
      ry: 820,
      rw: 196,
      rh: 240,
      floorColor: '#3D2817',
      accentColor: '#F59E0B',
      doorSide: 'top',
      windowSide: 'left',
    },
    {
      name: 'Indigo Suite',
      rx: 2084,
      ry: 820,
      rw: 196,
      rh: 240,
      floorColor: '#22223B',
      accentColor: '#38BDF8',
      doorSide: 'bottom',
      windowSide: 'right',
    },
  ]);

  // Public Spaces
  const publicSpaces: PublicSpace[] = [
    {
      id: 'pub-park',
      name: 'Jazz Fountain Park',
      x: 720,
      y: 800,
      width: 440,
      height: 270,
      kind: 'park',
    },
    {
      id: 'pub-plaza',
      name: 'Southside Market Plaza',
      x: 720,
      y: 1270,
      width: 950,
      height: 250,
      kind: 'plaza',
    },
    {
      id: 'pub-station',
      name: 'Central Rail Platform',
      x: 840,
      y: 210,
      width: 520,
      height: 80,
      kind: 'station',
    },
    {
      id: 'pub-runway',
      name: 'City Skyport Runway',
      x: 1520,
      y: 28,
      width: 780,
      height: 92,
      kind: 'runway',
    },
  ];

  const roads: RoadBand[] = [
    { x: 0, y: 315, w: WORLD_WIDTH, h: 105, orientation: 'horizontal' },
    { x: 0, y: 1120, w: WORLD_WIDTH, h: 105, orientation: 'horizontal' },
    { x: 550, y: 200, w: 105, h: WORLD_HEIGHT - 200, orientation: 'vertical' },
    { x: 1720, y: 200, w: 105, h: WORLD_HEIGHT - 200, orientation: 'vertical' },
  ];

  return {
    buildings,
    rooms,
    walls,
    doors,
    windows,
    publicSpaces,
    roads,
    trainTrackY: 168,
    runwayRect: { x: 1520, y: 28, w: 780, h: 92 },
  };
}

export function isPointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

export function randomOutdoorWalkPoint(map: CityMap): { x: number; y: number } {
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = rand(80, WORLD_WIDTH - 80);
    const y = rand(230, WORLD_HEIGHT - 80);
    const insideBuilding = map.buildings.some((b) => isPointInRect(x, y, b.x - 16, b.y - 16, b.width + 32, b.height + 32));
    if (!insideBuilding) return { x, y };
  }
  return { x: 920, y: 920 };
}

export function createNpc(
  map: CityMap,
  spec: LevelSpec,
  forcedArchetype?: CharacterArchetype,
  spawnPos?: { x: number; y: number },
  arrivedBy: VehicleType | 'walk' = 'walk'
): NpcCharacter {
  const pos = spawnPos ?? randomOutdoorWalkPoint(map);
  const target = randomOutdoorWalkPoint(map);

  let archetype: CharacterArchetype = forcedArchetype ?? 'poly_single';
  if (!forcedArchetype) {
    const roll = Math.random();
    if (roll < spec.detectiveRatio) {
      archetype = 'detective';
    } else if (roll < spec.detectiveRatio + 0.24) {
      archetype = 'monogamous';
    } else if (roll < spec.detectiveRatio + 0.36) {
      archetype = 'marriage_seeker';
    } else {
      archetype = 'poly_single';
    }
  }

  const isPoly = archetype === 'poly_single';
  const hasDatingApp = isPoly && Math.random() < spec.datingAppRatio;
  const hasRing = archetype === 'monogamous' || (archetype === 'detective' && Math.random() < 0.45);
  const seekingMarriage = archetype === 'marriage_seeker';

  return {
    id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    archetype,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    targetX: target.x,
    targetY: target.y,
    radius: 15,
    skinTone: pick(SKIN_TONES),
    hairColor: pick(HAIR_COLORS),
    hairStyle: pick(HAIR_STYLES),
    outfitColor: archetype === 'detective' ? '#334155' : pick(OUTFIT_COLORS),
    hasDatingApp,
    hasRing,
    seekingMarriage,
    preferredSense: pick(SENSE_ORDER),
    arrivedBy,
    followingPlayer: false,
    befriended: false,
    befriendedAt: 0,
    sparkActive: false,
    sparkTimer: 2.0,
    bombDetonated: false,
    disarmed: false,
    walkPhase: Math.random() * Math.PI * 2,
    waitTimer: 0,
    statusBubbleTimer: 0,
  };
}

export function createInitialNpcs(map: CityMap, spec: LevelSpec): NpcCharacter[] {
  const npcs: NpcCharacter[] = [];
  const total = spec.npcDensity;
  // Guarantee a healthy supply of eligible poly singles & dating app singles right away
  const minPoly = Math.max(12, Math.floor(total * 0.56));
  for (let i = 0; i < total; i++) {
    const forced: CharacterArchetype | undefined = i < minPoly ? 'poly_single' : undefined;
    npcs.push(createNpc(map, spec, forced));
  }
  return npcs;
}

export function createPotionDrop(map: CityMap, forcedSense?: SenseType): PotionDrop {
  const sense = forcedSense ?? pick(SENSE_ORDER);
  // 70% outdoor / park / sidewalk, 30% inside rooms
  let x = 900;
  let y = 920;
  if (Math.random() < 0.7 || map.rooms.length === 0) {
    const pt = randomOutdoorWalkPoint(map);
    x = pt.x;
    y = pt.y;
  } else {
    const room = pick(map.rooms);
    x = rand(room.x + 36, room.x + room.width - 36);
    y = rand(room.y + 36, room.y + room.height - 36);
  }
  return {
    id: `pot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sense,
    x,
    y,
    bobOffset: Math.random() * Math.PI * 2,
    spawnedAt: performance.now(),
  };
}

export function createInitialVehicles(): Vehicle[] {
  return [
    {
      id: 'veh-plane-1',
      type: 'plane',
      x: 1620,
      y: 74,
      vx: 145,
      vy: 0,
      width: 68,
      height: 36,
      color: '#F8FAFC',
      angle: 0,
      dropCooldown: 6,
    },
    {
      id: 'veh-train-1',
      type: 'train',
      x: 200,
      y: 168,
      vx: 110,
      vy: 0,
      width: 170,
      height: 30,
      color: '#0EA5E9',
      angle: 0,
      dropCooldown: 7,
    },
    {
      id: 'veh-bus-1',
      type: 'bus',
      x: 340,
      y: 392,
      vx: 85,
      vy: 0,
      width: 72,
      height: 28,
      color: '#F59E0B',
      angle: 0,
      dropCooldown: 8,
    },
    {
      id: 'veh-taxi-1',
      type: 'taxi',
      x: 1500,
      y: 342,
      vx: -115,
      vy: 0,
      width: 44,
      height: 22,
      color: '#FACC15',
      angle: Math.PI,
      dropCooldown: 9,
    },
    {
      id: 'veh-suv-1',
      type: 'suv',
      x: 800,
      y: 1192,
      vx: 100,
      vy: 0,
      width: 52,
      height: 25,
      color: '#3B82F6',
      angle: 0,
      dropCooldown: 10,
    },
    {
      id: 'veh-jeep-1',
      type: 'jeep',
      x: 1950,
      y: 1144,
      vx: -96,
      vy: 0,
      width: 48,
      height: 24,
      color: '#10B981',
      angle: Math.PI,
      dropCooldown: 11,
    },
    {
      id: 'veh-tricycle-1',
      type: 'tricycle',
      x: 626,
      y: 900,
      vx: 0,
      vy: -76,
      width: 34,
      height: 22,
      color: '#EC4899',
      angle: -Math.PI / 2,
      dropCooldown: 7,
    },
    {
      id: 'veh-car-1',
      type: 'car',
      x: 1748,
      y: 440,
      vx: 0,
      vy: 108,
      width: 44,
      height: 22,
      color: '#A855F7',
      angle: Math.PI / 2,
      dropCooldown: 9,
    },
  ];
}
