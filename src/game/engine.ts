import {
  ActiveInteraction,
  Door,
  GameState,
  HudSnapshot,
  Inventory,
  NpcCharacter,
  Particle,
  Player,
  POTION_META,
  PotionDrop,
  Room,
  SavedActiveRun,
  SENSE_ORDER,
  SenseType,
  Shockwave,
  Vehicle,
  WindowAperture,
} from '../types/game';
import { soundEngine } from '../utils/audio';
import {
  buildCityMap,
  CityMap,
  createInitialNpcs,
  createInitialVehicles,
  createNpc,
  createPotionDrop,
  isPointInRect,
  SKIN_TONES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './cityGenerator';
import { getLevelSpec } from './levels';

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onGameOver: (reason: string, snapshot: HudSnapshot) => void;
  onVictory: (snapshot: HudSnapshot) => void;
  onAutoSave: (run: SavedActiveRun) => void;
}

export class GameEngine {
  private map: CityMap;
  private player: Player;
  private npcs: NpcCharacter[] = [];
  private potions: PotionDrop[] = [];
  private vehicles: Vehicle[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];

  private gameState: GameState = 'PRE_GAME';
  private playerName = 'Alex';
  private level = 1;
  private score = 0;
  private highScore = 0;
  private consentCurrent = 0;
  private totalFriends = 0;
  private totalPotions = 0;
  private timerSeconds = 15 * 60;
  private inventory: Inventory = { touch: 1, smell: 1, taste: 0, sight: 0, hearing: 0 };
  private selectedPotion: SenseType | null = 'touch';

  private activeInteraction: ActiveInteraction | null = null;
  private alertBanner: HudSnapshot['alertBanner'] = null;
  private alertTimer = 0;

  private keys = new Set<string>();
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private cameraX = 0;
  private cameraY = 0;
  private viewportW = 1280;
  private viewportH = 720;

  private lastTimestamp = 0;
  private rafId: number | null = null;
  private hudSyncAccumulator = 0;
  private autoSaveAccumulator = 0;
  private sparkTickAccumulator = 0;
  private canvas: HTMLCanvasElement | null = null;

  private callbacks: EngineCallbacks;

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
    this.map = buildCityMap();
    this.player = this.createDefaultPlayer();
    this.resetWorldForLevel(1, true);
  }

  public setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
  }

  private createDefaultPlayer(): Player {
    return {
      x: 940,
      y: 930,
      vx: 0,
      vy: 0,
      radius: 15,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      isSprinting: false,
      skinTone: SKIN_TONES[2],
      outfitColor: '#F43F5E',
      walkPhase: 0,
      facingAngle: 0,
    };
  }

  public startLoop() {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTimestamp) / 1000);
      this.lastTimestamp = now;
      this.tick(dt);
      if (this.canvas) {
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          this.render(ctx, this.canvas.width, this.canvas.height);
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public startNewGame(playerName: string, highScore: number) {
    this.playerName = playerName.trim() || 'Alex';
    this.highScore = highScore;
    this.level = 1;
    this.score = 0;
    this.consentCurrent = 0;
    this.totalFriends = 0;
    this.totalPotions = 0;
    this.inventory = { touch: 1, smell: 1, taste: 0, sight: 0, hearing: 0 };
    this.selectedPotion = 'touch';
    this.player = this.createDefaultPlayer();
    this.resetWorldForLevel(1, true);
    this.gameState = 'PLAYING';
    this.showAlert('Collect glowing Love Potions, invite polyamorous singles indoors, close doors & windows!', 'info', 5);
    this.emitHud();
    this.emitAutoSave();
  }

  public resumeSavedRun(saved: SavedActiveRun, highScore: number) {
    this.playerName = saved.playerName;
    this.highScore = Math.max(highScore, saved.score);
    this.level = saved.level;
    this.score = saved.score;
    this.consentCurrent = saved.consentCurrent;
    this.totalFriends = saved.totalFriends;
    this.totalPotions = saved.totalPotions;
    this.inventory = { ...saved.inventory };
    this.selectedPotion =
      SENSE_ORDER.find((s) => this.inventory[s] > 0) ?? 'touch';
    this.player = this.createDefaultPlayer();
    this.player.hp = Math.max(10, Math.min(100, saved.hp));
    this.resetWorldForLevel(saved.level, false);
    this.timerSeconds = saved.timerSeconds;
    this.gameState = 'PLAYING';
    this.showAlert(`Resumed Level ${this.level} — stay sharp and keep interactions private.`, 'info', 4);
    this.emitHud();
  }

  public setPaused(paused: boolean) {
    if (this.gameState === 'GAME_OVER' || this.gameState === 'VICTORY' || this.gameState === 'PRE_GAME') return;
    this.gameState = paused ? 'PAUSED' : 'PLAYING';
    this.keys.clear();
  }

  public setSelectedPotion(sense: SenseType) {
    this.selectedPotion = sense;
    this.emitHud();
  }

  private resetWorldForLevel(level: number, resetTimer: boolean) {
    const spec = getLevelSpec(level);
    this.map = buildCityMap();
    this.npcs = createInitialNpcs(this.map, spec);
    this.vehicles = createInitialVehicles();
    this.potions = [];
    for (let i = 0; i < 18; i++) {
      this.potions.push(createPotionDrop(this.map, SENSE_ORDER[i % SENSE_ORDER.length]));
    }
    this.particles = [];
    this.shockwaves = [];
    this.activeInteraction = null;
    if (resetTimer) {
      this.timerSeconds = spec.timerMinutes * 60;
    }
    this.cameraX = Math.max(0, Math.min(WORLD_WIDTH - this.viewportW, this.player.x - this.viewportW / 2));
    this.cameraY = Math.max(0, Math.min(WORLD_HEIGHT - this.viewportH, this.player.y - this.viewportH / 2));
  }

  public handleKeyDown(e: KeyboardEvent) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      if (this.gameState === 'PLAYING') {
        e.preventDefault();
      }
    }
    this.keys.add(e.key.toLowerCase());
    if (e.key === 'Shift') this.keys.add('shift');

    if (this.gameState !== 'PLAYING') return;

    // Hotkeys 1-5 for 5 sense potions
    const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
    if (idx !== -1) {
      this.setSelectedPotion(SENSE_ORDER[idx]);
      return;
    }

    // E to toggle nearest door or window
    if (e.key.toLowerCase() === 'e') {
      this.toggleNearestDoorOrWindow();
    }

    // Space to close all doors & windows of the room you are currently inside
    if (e.key === ' ') {
      this.lockCurrentRoomPrivacy();
    }
  }

  public handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase());
    if (e.key === 'Shift') this.keys.delete('shift');
  }

  public handleMouseMove(screenX: number, screenY: number) {
    this.mouseScreenX = screenX;
    this.mouseScreenY = screenY;
  }

  public lockCurrentRoomPrivacy() {
    if (this.gameState !== 'PLAYING') return;
    const room = this.getRoomAt(this.player.x, this.player.y);
    if (!room) {
      this.showAlert('Step inside a House, Hotel, Motel, or Apartment room first!', 'warning', 2.4);
      return;
    }
    let changed = false;
    for (const d of this.map.doors) {
      if (d.roomId === room.id && d.isOpen) {
        d.isOpen = false;
        changed = true;
      }
    }
    for (const w of this.map.windows) {
      if (w.roomId === room.id && w.isOpen) {
        w.isOpen = false;
        changed = true;
      }
    }
    if (changed) {
      soundEngine.playDoorToggle(true);
      this.spawnTextBurst(this.player.x, this.player.y - 26, 'Private Mode Engaged', '#10B981');
      this.emitHud();
    }
  }

  private toggleNearestDoorOrWindow() {
    let bestDist = 75;
    let targetDoor: Door | null = null;
    let targetWin: WindowAperture | null = null;

    for (const d of this.map.doors) {
      const cx = d.x + d.width / 2;
      const cy = d.y + d.height / 2;
      const dist = Math.hypot(cx - this.player.x, cy - this.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        targetDoor = d;
        targetWin = null;
      }
    }

    for (const w of this.map.windows) {
      const cx = w.x + w.width / 2;
      const cy = w.y + w.height / 2;
      const dist = Math.hypot(cx - this.player.x, cy - this.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        targetWin = w;
        targetDoor = null;
      }
    }

    if (targetDoor) {
      targetDoor.isOpen = !targetDoor.isOpen;
      soundEngine.playDoorToggle(!targetDoor.isOpen);
      this.spawnTextBurst(
        targetDoor.x + targetDoor.width / 2,
        targetDoor.y,
        targetDoor.isOpen ? 'Door Open' : 'Door Closed',
        targetDoor.isOpen ? '#F59E0B' : '#10B981'
      );
      this.emitHud();
    } else if (targetWin) {
      targetWin.isOpen = !targetWin.isOpen;
      soundEngine.playDoorToggle(!targetWin.isOpen);
      this.spawnTextBurst(
        targetWin.x + targetWin.width / 2,
        targetWin.y,
        targetWin.isOpen ? 'Blinds Open' : 'Blinds Shut',
        targetWin.isOpen ? '#F59E0B' : '#10B981'
      );
      this.emitHud();
    }
  }

  public handleCanvasClick(screenX: number, screenY: number) {
    if (this.gameState !== 'PLAYING') return;
    this.mouseScreenX = screenX;
    this.mouseScreenY = screenY;
    const wx = screenX + this.cameraX;
    const wy = screenY + this.cameraY;

    // 1. Check Potion Drop Click
    for (let i = 0; i < this.potions.length; i++) {
      const p = this.potions[i];
      if (Math.hypot(wx - p.x, wy - p.y) <= 28) {
        const playerDist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
        if (playerDist > 360) {
          this.showAlert('Move closer to collect that glowing Love Potion!', 'info', 2.2);
          return;
        }
        this.collectPotion(i);
        return;
      }
    }

    // 2. Check Door Click
    for (const d of this.map.doors) {
      if (isPointInRect(wx, wy, d.x - 14, d.y - 14, d.width + 28, d.height + 28)) {
        if (Math.hypot(this.player.x - (d.x + d.width / 2), this.player.y - (d.y + d.height / 2)) > 170) {
          this.showAlert('Walk closer to the door to open or close it.', 'info', 2);
          return;
        }
        d.isOpen = !d.isOpen;
        soundEngine.playDoorToggle(!d.isOpen);
        this.spawnTextBurst(
          d.x + d.width / 2,
          d.y,
          d.isOpen ? 'Door Open' : 'Door Closed',
          d.isOpen ? '#F59E0B' : '#10B981'
        );
        this.emitHud();
        return;
      }
    }

    // 3. Check Window Click
    for (const w of this.map.windows) {
      if (isPointInRect(wx, wy, w.x - 14, w.y - 14, w.width + 28, w.height + 28)) {
        if (Math.hypot(this.player.x - (w.x + w.width / 2), this.player.y - (w.y + w.height / 2)) > 190) {
          this.showAlert('Walk closer to the window to close the blinds.', 'info', 2);
          return;
        }
        w.isOpen = !w.isOpen;
        soundEngine.playDoorToggle(!w.isOpen);
        this.spawnTextBurst(
          w.x + w.width / 2,
          w.y,
          w.isOpen ? 'Blinds Open' : 'Blinds Shut',
          w.isOpen ? '#F59E0B' : '#10B981'
        );
        this.emitHud();
        return;
      }
    }

    // 4. Check NPC Click
    for (const npc of this.npcs) {
      if (npc.befriended || npc.bombDetonated || npc.disarmed) continue;
      if (Math.hypot(wx - npc.x, wy - npc.y) <= npc.radius + 14) {
        this.interactWithNpc(npc);
        return;
      }
    }
  }

  private collectPotion(index: number) {
    const p = this.potions[index];
    this.potions.splice(index, 1);
    this.inventory[p.sense] += 1;
    this.selectedPotion = p.sense;
    this.totalPotions += 1;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12);
    this.score += 50;
    this.highScore = Math.max(this.highScore, this.score);
    soundEngine.playPotionPickup(p.sense);

    const meta = POTION_META[p.sense];
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      this.particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * (60 + Math.random() * 80),
        vy: Math.sin(a) * (60 + Math.random() * 80),
        life: 0.65,
        maxLife: 0.65,
        color: meta.color,
        size: 4,
      });
    }
    this.spawnTextBurst(p.x, p.y - 16, `+1 ${meta.label} · +12 HP`, meta.color);

    // Replenish a new potion on map
    this.potions.push(createPotionDrop(this.map));
    this.emitHud();
    this.emitAutoSave();
  }

  private interactWithNpc(npc: NpcCharacter) {
    const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
    if (dist > 220) {
      this.showAlert(`Move closer to ${npc.name} to interact.`, 'info', 2);
      return;
    }

    // Trigger detective trap immediately on potion click!
    if (npc.archetype === 'detective') {
      if (!npc.sparkActive) {
        npc.sparkActive = true;
        npc.sparkTimer = 2.0;
        npc.statusBubble = 'TRAP SPARK! SPRINT!';
        npc.statusBubbleTimer = 2.0;
        this.showAlert('Disguised Detective triggered a 2-second spark! Hold SHIFT and sprint away!', 'danger', 2.4);
        soundEngine.playSparkTick(1);
      }
      return;
    }

    if (this.activeInteraction) {
      this.showAlert('Finish your current private interaction first (one at a time)!', 'warning', 2.2);
      return;
    }

    const armedSense = this.selectedPotion;

    // Monogamous or marriage-seeker check
    if (npc.archetype === 'monogamous' || npc.archetype === 'marriage_seeker') {
      if (!armedSense || this.inventory[armedSense] <= 0) {
        this.showAlert(
          npc.archetype === 'marriage_seeker'
            ? `${npc.name} is seeking marriage — incompatible with the polyamory system.`
            : `${npc.name} is monogamous — leave them alone!`,
          'warning',
          3
        );
        return;
      }

      // Penalty for attempting potion on monogamous / marriage-seeker
      this.player.hp = Math.max(0, this.player.hp - 25);
      this.score = Math.max(0, this.score - 50);
      soundEngine.playConflictPenalty();
      this.shockwaves.push({
        x: npc.x,
        y: npc.y,
        radius: 10,
        maxRadius: 90,
        life: 0.45,
        maxLife: 0.45,
        color: '#EF4444',
      });
      npc.statusBubble = npc.seekingMarriage ? 'I want marriage!' : 'I am monogamous!';
      npc.statusBubbleTimer = 2.6;
      this.spawnTextBurst(this.player.x, this.player.y - 24, '-25 HP · Conflict!', '#EF4444');
      this.showAlert(
        `Relationship conflict with ${npc.name}! Never use potions on ${
          npc.seekingMarriage ? 'marriage-seekers' : 'monogamous characters'
        }.`,
        'danger',
        3.5
      );
      this.emitHud();
      this.emitAutoSave();

      if (this.player.hp <= 0) {
        this.triggerGameOver('Your life bar dropped to zero from invalid romantic attempts.');
      }
      return;
    }

    // Eligible poly_single!
    const roomStatus = this.evaluateRoomPrivacy();

    // If not in a private enclosed room yet:
    if (!roomStatus.insideRoom || !roomStatus.isPrivate) {
      // Check if an uninvited witness can see a potion attempt right now!
      if (armedSense && this.inventory[armedSense] > 0 && this.hasActiveWitness(npc)) {
        soundEngine.playSiren911();
        this.shockwaves.push({
          x: this.player.x,
          y: this.player.y,
          radius: 10,
          maxRadius: 180,
          life: 0.8,
          maxLife: 0.8,
          color: '#3B82F6',
        });
        this.triggerGameOver('A witness saw your public/un-enclosed potion interaction and called 911!');
        return;
      }

      // Otherwise invite them to follow you into a private enclosed room!
      for (const other of this.npcs) {
        if (other.id !== npc.id) other.followingPlayer = false;
      }
      npc.followingPlayer = !npc.followingPlayer;
      if (npc.followingPlayer) {
        soundEngine.playInvite();
        npc.statusBubble = 'Lead me somewhere private';
        npc.statusBubbleTimer = 2.5;
        this.showAlert(
          `${npc.name} is following you! Walk into a House, Hotel, Motel, or Apt and press [SPACE] or click doors/windows to close them.`,
          'info',
          4.2
        );
      } else {
        npc.statusBubble = 'Paused';
        npc.statusBubbleTimer = 1.5;
      }
      this.emitHud();
      return;
    }

    // Inside a fully private enclosed room! Need a potion armed and in stock.
    if (!armedSense || this.inventory[armedSense] <= 0) {
      this.showAlert('Select a Love Potion in your belt (1–5) that has at least 1 charge!', 'warning', 3);
      return;
    }

    // Make sure target NPC is also inside the same enclosed room
    const npcRoom = this.getRoomAt(npc.x, npc.y);
    const playerRoom = this.getRoomAt(this.player.x, this.player.y);
    if (!npcRoom || !playerRoom || npcRoom.id !== playerRoom.id) {
      npc.followingPlayer = true;
      this.showAlert(`Bring ${npc.name} inside ${playerRoom?.name ?? 'the room'} before using a potion!`, 'warning', 2.8);
      return;
    }

    // Consume 1 potion and begin private 1.25s consensual interaction!
    this.inventory[armedSense] -= 1;
    if (this.inventory[armedSense] <= 0) {
      const nextAvailable = SENSE_ORDER.find((s) => this.inventory[s] > 0);
      if (nextAvailable) this.selectedPotion = nextAvailable;
    }
    this.activeInteraction = {
      npcId: npc.id,
      npcName: npc.name,
      sense: armedSense,
      progress: 0,
      duration: 1.25,
      hasDatingAppBonus: npc.hasDatingApp,
    };
    soundEngine.playInvite();
    this.emitHud();
  }

  private hasActiveWitness(targetNpc: NpcCharacter): boolean {
    const playerRoom = this.getRoomAt(this.player.x, this.player.y);
    for (const other of this.npcs) {
      if (other.id === targetNpc.id || other.befriended || other.bombDetonated || other.disarmed) continue;
      const dist = Math.hypot(other.x - this.player.x, other.y - this.player.y);
      if (dist > 280) continue;

      const otherRoom = this.getRoomAt(other.x, other.y);
      if (!playerRoom) {
        // Player is outdoors: any nearby character outdoors sees it
        if (!otherRoom) return true;
      } else {
        // Player is indoors: witness sees if in same room OR if a door/window on that room is open nearby
        if (otherRoom && otherRoom.id === playerRoom.id) return true;
        const openDoors = this.map.doors.filter((d) => d.roomId === playerRoom.id && d.isOpen);
        const openWins = this.map.windows.filter((w) => w.roomId === playerRoom.id && w.isOpen);
        if (openDoors.length > 0 || openWins.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  private getRoomAt(x: number, y: number): Room | null {
    for (const r of this.map.rooms) {
      if (isPointInRect(x, y, r.x + 6, r.y + 6, r.width - 12, r.height - 12)) {
        return r;
      }
    }
    return null;
  }

  private evaluateRoomPrivacy(): HudSnapshot['roomStatus'] {
    const room = this.getRoomAt(this.player.x, this.player.y);
    if (!room) {
      return {
        insideRoom: false,
        roomName: 'Public Street',
        isPrivate: false,
        doorsOpenCount: 0,
        windowsOpenCount: 0,
        bystandersInside: 0,
      };
    }

    const doorsOpenCount = this.map.doors.filter((d) => d.roomId === room.id && d.isOpen).length;
    const windowsOpenCount = this.map.windows.filter((w) => w.roomId === room.id && w.isOpen).length;
    let bystandersInside = 0;
    for (const npc of this.npcs) {
      if (npc.befriended || npc.followingPlayer || npc.bombDetonated || npc.disarmed) continue;
      if (isPointInRect(npc.x, npc.y, room.x + 8, room.y + 8, room.width - 16, room.height - 16)) {
        bystandersInside += 1;
      }
    }

    return {
      insideRoom: true,
      roomName: room.name,
      isPrivate: doorsOpenCount === 0 && windowsOpenCount === 0 && bystandersInside === 0,
      doorsOpenCount,
      windowsOpenCount,
      bystandersInside,
    };
  }

  private tick(dt: number) {
    if (this.gameState !== 'PLAYING') return;

    // 1. Timer countdown
    this.timerSeconds -= dt;
    if (this.timerSeconds <= 0) {
      this.timerSeconds = 0;
      this.triggerGameOver(`Time expired on Level ${this.level}!`);
      return;
    }

    // 2. Alert timer
    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) {
        this.alertBanner = null;
      }
    }

    // 3. Player movement + Sprint
    this.updatePlayer(dt);

    // 4. Active private interaction
    if (this.activeInteraction) {
      const roomStatus = this.evaluateRoomPrivacy();
      if (!roomStatus.isPrivate) {
        this.activeInteraction = null;
        soundEngine.playSiren911();
        this.triggerGameOver('Privacy was broken mid-interaction and someone called 911!');
        return;
      }

      this.activeInteraction.progress += dt / this.activeInteraction.duration;
      if (this.activeInteraction.progress >= 1) {
        this.completeInteraction(this.activeInteraction);
      }
    }

    // 5. Update NPCs & Detectives
    this.updateNpcs(dt);

    // 6. Update Vehicles
    this.updateVehicles(dt);

    // 7. Update Particles & Shockwaves
    this.updateParticles(dt);

    // 8. Camera tracking
    const targetCamX = Math.max(0, Math.min(WORLD_WIDTH - this.viewportW, this.player.x - this.viewportW / 2));
    const targetCamY = Math.max(0, Math.min(WORLD_HEIGHT - this.viewportH, this.player.y - this.viewportH / 2));
    this.cameraX += (targetCamX - this.cameraX) * Math.min(1, dt * 10);
    this.cameraY += (targetCamY - this.cameraY) * Math.min(1, dt * 10);

    // 9. Periodic HUD sync & auto-save
    this.hudSyncAccumulator += dt;
    if (this.hudSyncAccumulator >= 0.1) {
      this.hudSyncAccumulator = 0;
      this.emitHud();
    }

    this.autoSaveAccumulator += dt;
    if (this.autoSaveAccumulator >= 3.0) {
      this.autoSaveAccumulator = 0;
      this.emitAutoSave();
    }
  }

  private updatePlayer(dt: number) {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;

    const moving = dx !== 0 || dy !== 0;
    const wantsSprint = this.keys.has('shift') && moving && this.player.stamina > 4;
    this.player.isSprinting = wantsSprint;

    if (wantsSprint) {
      this.player.stamina = Math.max(0, this.player.stamina - 34 * dt);
    } else {
      this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 24 * dt);
    }

    if (moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      const speed = wantsSprint ? 345 : 210;
      this.player.vx = dx * speed;
      this.player.vy = dy * speed;
      this.player.facingAngle = Math.atan2(dy, dx);
      this.player.walkPhase += dt * (wantsSprint ? 15 : 9);

      const nextX = this.player.x + this.player.vx * dt;
      if (!this.collidesWithMap(nextX, this.player.y, this.player.radius)) {
        this.player.x = Math.max(24, Math.min(WORLD_WIDTH - 24, nextX));
      }
      const nextY = this.player.y + this.player.vy * dt;
      if (!this.collidesWithMap(this.player.x, nextY, this.player.radius)) {
        this.player.y = Math.max(24, Math.min(WORLD_HEIGHT - 24, nextY));
      }
    } else {
      this.player.vx = 0;
      this.player.vy = 0;
    }
  }

  private collidesWithMap(cx: number, cy: number, r: number): boolean {
    for (const w of this.map.walls) {
      if (this.circleRectCollide(cx, cy, r, w.x, w.y, w.w, w.h)) return true;
    }
    for (const d of this.map.doors) {
      if (!d.isOpen && this.circleRectCollide(cx, cy, r, d.x, d.y, d.width, d.height)) return true;
    }
    for (const win of this.map.windows) {
      if (this.circleRectCollide(cx, cy, r, win.x, win.y, win.width, win.height)) return true;
    }
    return false;
  }

  private circleRectCollide(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < r * r;
  }

  private completeInteraction(inter: ActiveInteraction) {
    this.activeInteraction = null;
    const npc = this.npcs.find((n) => n.id === inter.npcId);
    if (npc) {
      npc.befriended = true;
      npc.followingPlayer = false;
      npc.befriendedAt = performance.now();
      npc.statusBubble = 'Friends forever!';
      npc.statusBubbleTimer = 2.5;
    }

    const bonus = inter.hasDatingAppBonus ? 100 : 0;
    const senseMatch = npc && npc.preferredSense === inter.sense ? 50 : 0;
    const earned = 150 + bonus + senseMatch;
    this.score += earned;
    this.highScore = Math.max(this.highScore, this.score);
    this.consentCurrent += 1;
    this.totalFriends += 1;

    soundEngine.playFriendshipSuccess(inter.hasDatingAppBonus);

    const meta = POTION_META[inter.sense];
    for (let i = 0; i < 20; i++) {
      const a = (Math.PI * 2 * i) / 20;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * (70 + Math.random() * 90),
        vy: Math.sin(a) * (70 + Math.random() * 90),
        life: 0.9,
        maxLife: 0.9,
        color: i % 2 === 0 ? meta.color : '#FACC15',
        size: 5,
      });
    }

    this.spawnTextBurst(
      this.player.x,
      this.player.y - 34,
      inter.hasDatingAppBonus ? `+${earned} pts (Dating App Bonus!)` : `+${earned} pts · Consensual Friend!`,
      '#10B981'
    );

    // Spawn a fresh eligible poly single elsewhere so the city always stays lively
    const spec = getLevelSpec(this.level);
    this.npcs.push(createNpc(this.map, spec, 'poly_single'));

    // Check Level Up
    if (this.consentCurrent >= spec.levelTargetFriends) {
      if (this.level >= 100) {
        soundEngine.playVictory();
        this.gameState = 'VICTORY';
        const snap = this.buildHudSnapshot();
        this.callbacks.onHudUpdate(snap);
        this.callbacks.onVictory(snap);
        return;
      }

      const prevTier = spec.tierIndex;
      this.level += 1;
      this.consentCurrent = 0;
      const nextSpec = getLevelSpec(this.level);
      if (nextSpec.tierIndex !== prevTier) {
        // Refresh tier timer upon entering a new 25-level tier!
        this.timerSeconds = nextSpec.timerMinutes * 60;
        this.showAlert(
          `Tier Unlocked: ${nextSpec.tierLabel}! Timer set to ${nextSpec.timerMinutes} min.`,
          'success',
          5
        );
      } else {
        this.showAlert(`Level ${this.level} reached! Consent Meter refreshed.`, 'success', 3.5);
      }
      soundEngine.playLevelUp();
      this.resetWorldForLevel(this.level, false);
    }

    this.emitHud();
    this.emitAutoSave();
  }

  private updateNpcs(dt: number) {
    const spec = getLevelSpec(this.level);
    let anySparkActive = false;

    for (const npc of this.npcs) {
      if (npc.statusBubbleTimer > 0) {
        npc.statusBubbleTimer -= dt;
        if (npc.statusBubbleTimer <= 0) npc.statusBubble = undefined;
      }

      if (npc.befriended || npc.bombDetonated || npc.disarmed) continue;

      // Detective proximity check -> 2-second visible spark!
      if (npc.archetype === 'detective') {
        const distToPlayer = Math.hypot(npc.x - this.player.x, npc.y - this.player.y);
        if (!npc.sparkActive && distToPlayer < 95) {
          npc.sparkActive = true;
          npc.sparkTimer = 2.0;
          npc.statusBubble = 'SPARKING! SPRINT!';
          npc.statusBubbleTimer = 2.0;
          this.showAlert('Disguised Detective sparked! Hold SHIFT and sprint away before the invisible bomb detonates!', 'danger', 2.4);
          soundEngine.playSparkTick(0.2);
        }

        if (npc.sparkActive) {
          anySparkActive = true;
          npc.sparkTimer -= dt;
          if (Math.random() < 0.45) {
            const a = Math.random() * Math.PI * 2;
            this.particles.push({
              x: npc.x,
              y: npc.y,
              vx: Math.cos(a) * 70,
              vy: Math.sin(a) * 70,
              life: 0.3,
              maxLife: 0.3,
              color: Math.random() < 0.5 ? '#F59E0B' : '#EF4444',
              size: 3.5,
            });
          }

          if (npc.sparkTimer <= 0) {
            npc.sparkActive = false;
            npc.bombDetonated = true;
            this.shockwaves.push({
              x: npc.x,
              y: npc.y,
              radius: 12,
              maxRadius: 155,
              life: 0.55,
              maxLife: 0.55,
              color: '#EF4444',
            });
            const blastDist = Math.hypot(npc.x - this.player.x, npc.y - this.player.y);
            if (blastDist <= 155) {
              soundEngine.playSiren911();
              this.triggerGameOver('Caught by a disguised detective’s invisible bomb! Your secret was revealed.');
              return;
            } else {
              soundEngine.playBombEvaded();
              npc.disarmed = true;
              this.score += 75;
              this.highScore = Math.max(this.highScore, this.score);
              this.spawnTextBurst(this.player.x, this.player.y - 24, 'Evaded Bomb! +75 pts', '#10B981');
              this.showAlert('Nice sprint! You escaped the detective’s invisible bomb!', 'success', 2.5);
            }
          }
          continue;
        }
      }

      // Following player movement
      if (npc.followingPlayer) {
        const dx = this.player.x - npc.x;
        const dy = this.player.y - npc.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 38) {
          const speed = 195;
          const vx = (dx / dist) * speed;
          const vy = (dy / dist) * speed;
          const nx = npc.x + vx * dt;
          const ny = npc.y + vy * dt;
          if (!this.collidesWithMap(nx, npc.y, npc.radius)) npc.x = nx;
          if (!this.collidesWithMap(npc.x, ny, npc.radius)) npc.y = ny;
          npc.walkPhase += dt * 9;
        }
        continue;
      }

      // Standard street patrol movement
      if (npc.waitTimer > 0) {
        npc.waitTimer -= dt;
        continue;
      }

      const dx = npc.targetX - npc.x;
      const dy = npc.targetY - npc.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        npc.waitTimer = 0.6 + Math.random() * 1.4;
        npc.targetX = 80 + Math.random() * (WORLD_WIDTH - 160);
        npc.targetY = 230 + Math.random() * (WORLD_HEIGHT - 300);
      } else {
        const speed = (62 + Math.random() * 6) * spec.patrolSpeedMultiplier;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        const nx = npc.x + vx * dt;
        const ny = npc.y + vy * dt;
        let blocked = false;
        if (!this.collidesWithMap(nx, npc.y, npc.radius)) {
          npc.x = nx;
        } else {
          blocked = true;
        }
        if (!this.collidesWithMap(npc.x, ny, npc.radius)) {
          npc.y = ny;
        } else {
          blocked = true;
        }
        if (blocked) {
          npc.targetX = 80 + Math.random() * (WORLD_WIDTH - 160);
          npc.targetY = 230 + Math.random() * (WORLD_HEIGHT - 300);
        }
        npc.walkPhase += dt * 6;
      }
    }

    if (anySparkActive) {
      this.sparkTickAccumulator += dt;
      if (this.sparkTickAccumulator >= 0.35) {
        this.sparkTickAccumulator = 0;
        soundEngine.playSparkTick(0.75);
      }
    }
  }

  private updateVehicles(dt: number) {
    const spec = getLevelSpec(this.level);
    for (const v of this.vehicles) {
      v.x += v.vx * dt;
      v.y += v.vy * dt;

      if (v.vx > 0 && v.x > WORLD_WIDTH + 120) v.x = -120;
      if (v.vx < 0 && v.x < -120) v.x = WORLD_WIDTH + 120;
      if (v.vy > 0 && v.y > WORLD_HEIGHT + 120) v.y = 220;
      if (v.vy < 0 && v.y < 180) v.y = WORLD_HEIGHT + 100;

      // Periodically drop off newly arriving walking characters when city population dips
      v.dropCooldown -= dt;
      if (v.dropCooldown <= 0) {
        v.dropCooldown = 7 + Math.random() * 6;
        const activeNpcs = this.npcs.filter((n) => !n.befriended && !n.bombDetonated && !n.disarmed).length;
        if (activeNpcs < spec.npcDensity + 6 && v.x > 100 && v.x < WORLD_WIDTH - 100 && v.y > 140 && v.y < WORLD_HEIGHT - 100) {
          const dropY = v.type === 'plane' ? 140 : Math.min(WORLD_HEIGHT - 60, v.y + 42);
          const spawned = createNpc(this.map, spec, undefined, { x: v.x, y: dropY }, v.type);
          spawned.statusBubble = `Arrived via ${v.type}`;
          spawned.statusBubbleTimer = 2.0;
          this.npcs.push(spawned);
        }
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      const t = 1 - s.life / s.maxLife;
      s.radius = s.maxRadius * t;
      if (s.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  private spawnTextBurst(x: number, y: number, text: string, color: string) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -32,
      life: 1.35,
      maxLife: 1.35,
      color,
      size: 12,
      text,
    });
  }

  private showAlert(message: string, tone: 'info' | 'warning' | 'danger' | 'success', duration = 3) {
    this.alertBanner = { message, tone };
    this.alertTimer = duration;
  }

  private triggerGameOver(reason: string) {
    this.gameState = 'GAME_OVER';
    this.keys.clear();
    const snap = this.buildHudSnapshot();
    this.callbacks.onHudUpdate(snap);
    this.callbacks.onGameOver(reason, snap);
  }

  private buildHudSnapshot(): HudSnapshot {
    const spec = getLevelSpec(this.level);
    let minSpark: number | null = null;
    for (const npc of this.npcs) {
      if (npc.sparkActive) {
        minSpark = minSpark === null ? npc.sparkTimer : Math.min(minSpark, npc.sparkTimer);
      }
    }

    return {
      level: this.level,
      tierLabel: spec.tierLabel,
      tierChallenge: spec.extraChallenge,
      score: this.score,
      highScore: Math.max(this.highScore, this.score),
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      stamina: this.player.stamina,
      consentCurrent: this.consentCurrent,
      consentTarget: spec.levelTargetFriends,
      totalFriends: this.totalFriends,
      totalPotions: this.totalPotions,
      timerSeconds: this.timerSeconds,
      inventory: { ...this.inventory },
      selectedPotion: this.selectedPotion,
      roomStatus: this.evaluateRoomPrivacy(),
      activeInteraction: this.activeInteraction ? { ...this.activeInteraction } : null,
      alertBanner: this.alertBanner ? { ...this.alertBanner } : null,
      detectiveWarningSeconds: minSpark,
    };
  }

  private emitHud() {
    this.callbacks.onHudUpdate(this.buildHudSnapshot());
  }

  private emitAutoSave() {
    if (this.gameState !== 'PLAYING') return;
    this.callbacks.onAutoSave({
      playerName: this.playerName,
      level: this.level,
      score: this.score,
      hp: this.player.hp,
      consentCurrent: this.consentCurrent,
      totalFriends: this.totalFriends,
      totalPotions: this.totalPotions,
      timerSeconds: this.timerSeconds,
      inventory: { ...this.inventory },
      updatedAt: new Date().toISOString(),
    });
  }

  // =========================================================================
  // CANVAS 2D RENDERER
  // =========================================================================
  public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.viewportW = width;
    this.viewportH = height;

    ctx.save();
    ctx.fillStyle = '#1E2534'; // Warm twilight pavement base
    ctx.fillRect(0, 0, width, height);

    ctx.translate(-this.cameraX, -this.cameraY);

    // 1. Sidewalk tile grid
    this.renderCityGround(ctx);

    // 2. Public Spaces (Parks, Plazas, Station, Runway)
    this.renderPublicSpaces(ctx);

    // 3. Roads & Train Tracks
    this.renderRoadsAndTracks(ctx);

    // 4. Buildings, Rooms, Floors, Doors, Windows, Ceilings
    this.renderBuildings(ctx);

    // 5. Potion Drops
    this.renderPotionDrops(ctx);

    // 6. Shockwaves
    for (const s of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 7. NPCs
    this.renderNpcs(ctx);

    // 8. Player
    this.renderPlayer(ctx);

    // 9. Vehicles (Planes fly slightly above ground with shadow!)
    this.renderVehicles(ctx);

    // 10. Particles & Floating Text
    this.renderParticles(ctx);

    // 11. Hover Inspection Tooltip & Aim Reticle
    this.renderAimAndHover(ctx);

    ctx.restore();
  }

  private renderCityGround(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#252E42';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Subtle city block paving lines
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    const step = 80;
    const startX = Math.floor(this.cameraX / step) * step;
    const endX = Math.min(WORLD_WIDTH, this.cameraX + this.viewportW + step);
    const startY = Math.floor(this.cameraY / step) * step;
    const endY = Math.min(WORLD_HEIGHT, this.cameraY + this.viewportH + step);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  private renderPublicSpaces(ctx: CanvasRenderingContext2D) {
    for (const ps of this.map.publicSpaces) {
      if (ps.kind === 'park') {
        ctx.fillStyle = '#14493A';
        ctx.fillRect(ps.x, ps.y, ps.width, ps.height);
        ctx.strokeStyle = '#1E6B52';
        ctx.lineWidth = 3;
        ctx.strokeRect(ps.x, ps.y, ps.width, ps.height);

        // Center fountain
        const fx = ps.x + ps.width / 2;
        const fy = ps.y + ps.height / 2;
        ctx.fillStyle = '#0EA5E9';
        ctx.beginPath();
        ctx.arc(fx, fy, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#BAE6FD';
        ctx.beginPath();
        ctx.arc(fx, fy, 16 + Math.sin(performance.now() * 0.005) * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (ps.kind === 'plaza') {
        ctx.fillStyle = '#2F364B';
        ctx.fillRect(ps.x, ps.y, ps.width, ps.height);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(ps.x, ps.y, ps.width, ps.height);

        // Colorful market awnings
        const colors = ['#E11D48', '#F59E0B', '#10B981', '#0EA5E9'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = colors[i];
          ctx.fillRect(ps.x + 60 + i * 220, ps.y + 34, 130, 38);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(ps.x + 60 + i * 220, ps.y + 34, 130, 12);
        }
      } else if (ps.kind === 'station') {
        ctx.fillStyle = '#334155';
        ctx.fillRect(ps.x, ps.y, ps.width, ps.height);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(ps.x, ps.y, ps.width, 6);
      } else if (ps.kind === 'runway') {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(ps.x, ps.y, ps.width, ps.height);
        ctx.strokeStyle = '#F8FAFC';
        ctx.setLineDash([24, 20]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ps.x + 20, ps.y + ps.height / 2);
        ctx.lineTo(ps.x + ps.width - 20, ps.y + ps.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(ps.name, ps.x + 12, ps.y + 20);
    }
  }

  private renderRoadsAndTracks(ctx: CanvasRenderingContext2D) {
    // Roads
    for (const r of this.map.roads) {
      ctx.fillStyle = '#181D29';
      ctx.fillRect(r.x, r.y, r.w, r.h);

      // Dashed lane dividers
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([22, 18]);
      ctx.beginPath();
      if (r.orientation === 'horizontal') {
        ctx.moveTo(r.x, r.y + r.h / 2);
        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
      } else {
        ctx.moveTo(r.x + r.w / 2, r.y);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Train Track
    const ty = this.map.trainTrackY;
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, ty - 18, WORLD_WIDTH, 36);
    ctx.fillStyle = '#78716C';
    for (let x = 0; x < WORLD_WIDTH; x += 26) {
      ctx.fillRect(x, ty - 15, 8, 30);
    }
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(0, ty - 11, WORLD_WIDTH, 3);
    ctx.fillRect(0, ty + 8, WORLD_WIDTH, 3);
  }

  private renderBuildings(ctx: CanvasRenderingContext2D) {
    const playerRoom = this.getRoomAt(this.player.x, this.player.y);

    // Building labels & room interiors
    for (const b of this.map.buildings) {
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(b.x + 8, b.y + 8, b.width, b.height);

      // Building outer header label
      ctx.fillStyle = b.roofColor;
      ctx.fillRect(b.x, b.y - 24, 185, 22);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${b.name} (${b.kind.toUpperCase()})`, b.x + 8, b.y - 9);
    }

    for (const r of this.map.rooms) {
      ctx.fillStyle = r.floorColor;
      ctx.fillRect(r.x, r.y, r.width, r.height);

      // Cozy rug in room center
      ctx.fillStyle = `${r.accentColor}26`;
      ctx.fillRect(r.x + 30, r.y + 42, r.width - 60, r.height - 84);
      ctx.strokeStyle = `${r.accentColor}66`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 30, r.y + 42, r.width - 60, r.height - 84);

      const doorsOpen = this.map.doors.filter((d) => d.roomId === r.id && d.isOpen).length;
      const winsOpen = this.map.windows.filter((w) => w.roomId === r.id && w.isOpen).length;
      const isRoomEnclosed = doorsOpen === 0 && winsOpen === 0;

      // Ceiling visual when room is enclosed!
      if (isRoomEnclosed) {
        const isPlayerHere = playerRoom?.id === r.id;
        ctx.fillStyle = isPlayerHere ? 'rgba(16, 185, 129, 0.14)' : 'rgba(15, 23, 42, 0.72)';
        ctx.fillRect(r.x + 8, r.y + 8, r.width - 16, r.height - 16);

        ctx.fillStyle = '#34D399';
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('CEILING CLOSED · PRIVATE', r.x + 18, r.y + 30);
      } else {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
        ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(r.name, r.x + 18, r.y + 30);
      }
    }

    // Walls
    for (const w of this.map.walls) {
      ctx.fillStyle = w.color;
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }

    // Doors (Interactive!)
    for (const d of this.map.doors) {
      if (d.isOpen) {
        // Open doorway threshold + swung leaf hint
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fillRect(d.x, d.y, d.width, d.height);
        ctx.fillStyle = '#F59E0B';
        if (d.orientation === 'horizontal') {
          ctx.fillRect(d.x, d.y - 24, 6, 26);
        } else {
          ctx.fillRect(d.x - 24, d.y, 26, 6);
        }
      } else {
        // Closed solid wooden door
        ctx.fillStyle = '#10B981';
        ctx.fillRect(d.x, d.y, d.width, d.height);
        ctx.strokeStyle = '#064E3B';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.x, d.y, d.width, d.height);
      }
    }

    // Windows (Interactive blinds!)
    for (const win of this.map.windows) {
      if (win.isOpen) {
        // Open glass window (witnesses can peek!)
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(win.x, win.y, win.width, win.height);
      } else {
        // Shut blinds (private!)
        ctx.fillStyle = '#475569';
        ctx.fillRect(win.x, win.y, win.width, win.height);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.strokeRect(win.x, win.y, win.width, win.height);
      }
    }
  }

  private renderPotionDrops(ctx: CanvasRenderingContext2D) {
    const t = performance.now() * 0.004;
    for (const p of this.potions) {
      const meta = POTION_META[p.sense];
      const bob = Math.sin(t + p.bobOffset) * 3.5;

      // Outer glow
      ctx.save();
      ctx.fillStyle = meta.glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 19 + Math.sin(t * 1.4 + p.bobOffset) * 2, 0, Math.PI * 2);
      ctx.fill();

      // Potion bottle silhouette
      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob + 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bottle neck
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(p.x - 3.5, p.y + bob - 11, 7, 5);

      // Tiny label underneath
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(meta.label, p.x, p.y + bob + 24);
      ctx.restore();
    }
  }

  private renderNpcs(ctx: CanvasRenderingContext2D) {
    for (const npc of this.npcs) {
      if (npc.bombDetonated || npc.disarmed) continue;

      ctx.save();
      if (npc.befriended) {
        ctx.globalAlpha = 0.45;
      }

      // Following ring
      if (npc.followingPlayer) {
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(npc.x, npc.y, npc.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Detective 2-second spark countdown ring
      if (npc.sparkActive) {
        const pct = Math.max(0, npc.sparkTimer / 2.0);
        // Subtle danger zone outline
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(npc.x, npc.y, 155, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Countdown arc
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(npc.x, npc.y, npc.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(npc.x, npc.y + 13, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shoulders / Outfit
      const bob = Math.sin(npc.walkPhase) * 1.5;
      ctx.fillStyle = npc.outfitColor;
      ctx.beginPath();
      ctx.ellipse(npc.x, npc.y + 4 + bob, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = npc.skinTone;
      ctx.beginPath();
      ctx.arc(npc.x, npc.y - 5 + bob, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Hair style
      ctx.fillStyle = npc.hairColor;
      if (npc.hairStyle === 'afro') {
        ctx.beginPath();
        ctx.arc(npc.x, npc.y - 9 + bob, 11, Math.PI, Math.PI * 2);
        ctx.fill();
      } else if (npc.hairStyle === 'bun') {
        ctx.beginPath();
        ctx.arc(npc.x, npc.y - 16 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(npc.x, npc.y - 8 + bob, 9, Math.PI, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(npc.x, npc.y - 8 + bob, 9.5, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();
      }

      // Signals: Glowing Dating App Phone vs Ring vs Marriage Icon
      if (npc.hasDatingApp && !npc.befriended) {
        const pulse = 0.75 + Math.sin(performance.now() * 0.008) * 0.25;
        ctx.fillStyle = `rgba(244, 63, 94, ${pulse})`;
        ctx.fillRect(npc.x + 10, npc.y - 2, 7, 11);
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(npc.x + 11.5, npc.y, 4, 6);
      }

      if (npc.hasRing) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(npc.x - 12, npc.y + 4, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Archetype micro-indicator above head
      if (!npc.befriended) {
        ctx.textAlign = 'center';
        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        if (npc.sparkActive) {
          ctx.fillStyle = '#EF4444';
          ctx.fillText(`BOMB ${npc.sparkTimer.toFixed(1)}s`, npc.x, npc.y - 23);
        } else if (npc.archetype === 'poly_single') {
          ctx.fillStyle = npc.hasDatingApp ? '#FDE047' : '#34D399';
          ctx.fillText(npc.hasDatingApp ? '♥ POLY · APP' : '∞ POLY', npc.x, npc.y - 22);
        } else if (npc.archetype === 'marriage_seeker') {
          ctx.fillStyle = '#FB923C';
          ctx.fillText('MARRIAGE', npc.x, npc.y - 22);
        } else {
          // Monogamous or disguised detective!
          ctx.fillStyle = '#94A3B8';
          ctx.fillText('MONO', npc.x, npc.y - 22);
        }
      }

      // Status speech bubble
      if (npc.statusBubble) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        const w = ctx.measureText(npc.statusBubble).width + 16;
        ctx.fillRect(npc.x - w / 2, npc.y - 46, w, 18);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(npc.statusBubble, npc.x, npc.y - 34);
      }

      ctx.restore();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();

    // Sprint aura
    if (p.isSprinting) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Active Interaction Progress Ring
    if (this.activeInteraction) {
      const meta = POTION_META[this.activeInteraction.sense];
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        p.radius + 11,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.activeInteraction.progress)
      );
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 14, 13, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player body
    const bob = Math.sin(p.walkPhase) * 1.5;
    ctx.fillStyle = p.outfitColor;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4 + bob, 14, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Head
    ctx.fillStyle = p.skinTone;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 6 + bob, 10, 0, Math.PI * 2);
    ctx.fill();

    // Crown / hair
    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 9 + bob, 10, Math.PI, Math.PI * 2);
    ctx.fill();

    // Player Nameplate
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.playerName, p.x, p.y - 24);

    ctx.restore();
  }

  private renderVehicles(ctx: CanvasRenderingContext2D) {
    for (const v of this.vehicles) {
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.angle);

      if (v.type === 'plane') {
        // Plane shadow below
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(12, 24, 34, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(-10, -28, 18, 56);
        // Fuselage
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 34, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0EA5E9';
        ctx.fillRect(14, -4, 8, 8);
      } else if (v.type === 'train') {
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(-v.width / 2, -v.height / 2, v.width, v.height);
        ctx.fillStyle = '#E0F2FE';
        for (let wx = -v.width / 2 + 14; wx < v.width / 2 - 20; wx += 26) {
          ctx.fillRect(wx, -8, 16, 16);
        }
      } else if (v.type === 'tricycle') {
        ctx.fillStyle = v.color;
        ctx.fillRect(-16, -10, 26, 20);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(8, -6, 10, 12);
      } else {
        // Bus, SUV, Jeep, Taxi, Car
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.fillRect(-v.width / 2 + 3, -v.height / 2 + 3, v.width, v.height);
        ctx.fillStyle = v.color;
        ctx.fillRect(-v.width / 2, -v.height / 2, v.width, v.height);
        // Windshield
        ctx.fillStyle = '#BAE6FD';
        ctx.fillRect(v.width / 2 - 14, -v.height / 2 + 3, 9, v.height - 6);
        if (v.type === 'taxi') {
          ctx.fillStyle = '#111827';
          ctx.fillRect(-6, -5, 10, 10);
        }
      }

      ctx.restore();

      // Subtle vehicle label
      ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(v.type.toUpperCase(), v.x, v.y - v.height / 2 - 6);
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      if (p.text) {
        ctx.fillStyle = p.color;
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderAimAndHover(ctx: CanvasRenderingContext2D) {
    if (this.gameState !== 'PLAYING') return;
    const wx = this.mouseScreenX + this.cameraX;
    const wy = this.mouseScreenY + this.cameraY;

    // Hover NPC inspection card
    for (const npc of this.npcs) {
      if (npc.befriended || npc.bombDetonated || npc.disarmed) continue;
      if (Math.hypot(wx - npc.x, wy - npc.y) <= npc.radius + 16) {
        const lines: string[] = [npc.name];
        if (npc.archetype === 'poly_single') {
          lines.push(`Polyamorous Single · ${npc.hasDatingApp ? 'Dating App (+Bonus)' : 'No Ring'}`);
          lines.push(`Prefers ${POTION_META[npc.preferredSense].label} · Arrived by ${npc.arrivedBy}`);
        } else if (npc.archetype === 'marriage_seeker') {
          lines.push('Seeking Exclusive Marriage · Avoid');
        } else {
          lines.push(npc.hasRing ? 'Monogamous (Ring) · Leave Alone' : 'Monogamous · Leave Alone');
        }

        ctx.save();
        ctx.fillStyle = 'rgba(14, 19, 31, 0.92)';
        ctx.strokeStyle = npc.archetype === 'poly_single' ? '#10B981' : '#EF4444';
        ctx.lineWidth = 1.5;
        const boxW = 240;
        const boxH = lines.length * 16 + 12;
        const bx = Math.min(WORLD_WIDTH - boxW - 10, Math.max(10, npc.x - boxW / 2));
        const by = Math.max(10, npc.y - boxH - 28);
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeRect(bx, by, boxW, boxH);

        ctx.textAlign = 'left';
        lines.forEach((line, idx) => {
          ctx.fillStyle = idx === 0 ? '#F8FAFC' : idx === 1 ? '#CBD5E1' : '#94A3B8';
          ctx.font = idx === 0 ? '700 11px "Plus Jakarta Sans", sans-serif' : '500 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(line, bx + 10, by + 16 + idx * 16);
        });
        ctx.restore();
        break;
      }
    }

    // Mouse aim reticle
    const armedColor = this.selectedPotion ? POTION_META[this.selectedPotion].color : '#F8FAFC';
    ctx.save();
    ctx.strokeStyle = armedColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(wx, wy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx - 17, wy);
    ctx.lineTo(wx - 8, wy);
    ctx.moveTo(wx + 8, wy);
    ctx.lineTo(wx + 17, wy);
    ctx.moveTo(wx, wy - 17);
    ctx.lineTo(wx, wy - 8);
    ctx.moveTo(wx, wy + 8);
    ctx.lineTo(wx, wy + 17);
    ctx.stroke();
    ctx.restore();
  }
}
