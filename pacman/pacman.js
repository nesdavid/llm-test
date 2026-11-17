/**
 * HTML5 PAC-MAN ARCADE ENGINE
 * Authentic retro mechanics, Web Audio synthesizer, ghost AI personalities,
 * cornering buffering, and responsive touch controls.
 */

(function () {
  'use strict';

  // =========================================================================
  // CONSTANTS & CONFIGURATION
  // =========================================================================

  const GRID_COLS = 28;
  const GRID_ROWS = 31;
  const TILE_SIZE = 20; // 560 x 620 px canvas

  // Tile Types
  const TILE_EMPTY = 0;
  const TILE_WALL = 1;
  const TILE_DOT = 2;
  const TILE_ENERGIZER = 3;
  const TILE_GATE = 4;

  // Directions
  const DIR_NONE  = { x:  0, y:  0, name: 'NONE',  angle: 0 };
  const DIR_UP    = { x:  0, y: -1, name: 'UP',    angle: 1.5 * Math.PI };
  const DIR_DOWN  = { x:  0, y:  1, name: 'DOWN',  angle: 0.5 * Math.PI };
  const DIR_LEFT  = { x: -1, y:  0, name: 'LEFT',  angle: 1.0 * Math.PI };
  const DIR_RIGHT = { x:  1, y:  0, name: 'RIGHT', angle: 0.0 };

  const ALL_DIRS = [DIR_UP, DIR_LEFT, DIR_DOWN, DIR_RIGHT];

  function getOppositeDir(dir) {
    if (dir === DIR_UP) return DIR_DOWN;
    if (dir === DIR_DOWN) return DIR_UP;
    if (dir === DIR_LEFT) return DIR_RIGHT;
    if (dir === DIR_RIGHT) return DIR_LEFT;
    return DIR_NONE;
  }

  // Game States
  const STATE_START = 'START';
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_PACMAN_DYING = 'PACMAN_DYING';
  const STATE_GHOST_EATEN_FREEZE = 'GHOST_EATEN_FREEZE';
  const STATE_LEVEL_CLEAR = 'LEVEL_CLEAR';
  const STATE_GAME_OVER = 'GAME_OVER';

  // Authentic 28x31 Maze Template
  // # = wall, . = dot, o = energizer, - = ghost gate, space = empty
  const MAZE_TEMPLATE = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "     #.##### ## #####.#     ",
    "     #.##          ##.#     ",
    "     #.## ###--### ##.#     ",
    "######.## #      # ##.######",
    "       ## #      # ##       ",
    "######.## #      # ##.######",
    "     #.## ######## ##.#     ",
    "     #.##          ##.#     ",
    "     #.## ######## ##.#     ",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#.####.#####.##.#####.####.#",
    "#o..##................##..o#",
    "###.##.##.########.##.##.###",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################"
  ];

  // Fruits table by level
  const FRUITS = [
    { name: 'Cherry', symbol: '🍒', points: 100, color: '#ff1a1a' },
    { name: 'Strawberry', symbol: '🍓', points: 300, color: '#ff3366' },
    { name: 'Peach', symbol: '🍑', points: 500, color: '#ff9933' },
    { name: 'Apple', symbol: '🍎', points: 700, color: '#cc0000' },
    { name: 'Melon', symbol: '🍈', points: 1000, color: '#66cc33' },
    { name: 'Galaxian', symbol: '🛸', points: 2000, color: '#ffff00' },
    { name: 'Bell', symbol: '🔔', points: 3000, color: '#ffcc00' },
    { name: 'Key', symbol: '🔑', points: 5000, color: '#00ffff' }
  ];

  // =========================================================================
  // RETRO WEB AUDIO SYNTHESIZER
  // =========================================================================

  class SoundController {
    constructor() {
      this.ctx = null;
      let mutedPref = false;
      try {
        if (typeof localStorage !== 'undefined') {
          mutedPref = localStorage.getItem('pacman_muted') === 'true';
        }
      } catch (e) {}
      this.muted = mutedPref;
      this.initialized = false;
      this.chompPhase = 0;
    }

    init() {
      if (this.initialized) return;
      try {
        if (typeof window !== 'undefined') {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            this.ctx = new AudioCtx();
            this.initialized = true;
          }
        }
      } catch (e) {
        console.warn('AudioContext not supported on this browser.', e);
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('pacman_muted', this.muted);
        }
      } catch (e) {}
      return !this.muted;
    }

    // Play a single oscillator tone with envelope
    playTone(freq, type = 'square', duration = 0.1, gainVal = 0.1, slideToFreq = null) {
      if (this.muted || !this.ctx) return;
      this.resume();
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideToFreq !== null) {
          osc.frequency.exponentialRampToValueAtTime(slideToFreq, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // Audio error catch
      }
    }

    // Classic Waka Waka dot eating sound
    playChomp() {
      if (this.muted || !this.ctx) return;
      const freq = this.chompPhase % 2 === 0 ? 320 : 490;
      const slide = this.chompPhase % 2 === 0 ? 440 : 260;
      this.chompPhase++;
      this.playTone(freq, 'triangle', 0.08, 0.12, slide);
    }

    // Power pellet hum
    playPowerPellet() {
      if (this.muted || !this.ctx) return;
      this.playTone(140, 'sawtooth', 0.14, 0.08, 80);
    }

    // Ghost eaten arpeggio
    playEatGhost() {
      if (this.muted || !this.ctx) return;
      const notes = [400, 600, 800, 1200, 1600];
      notes.forEach((freq, i) => {
        setTimeout(() => {
          this.playTone(freq, 'square', 0.06, 0.15);
        }, i * 45);
      });
    }

    // Fruit eaten chime
    playEatFruit() {
      if (this.muted || !this.ctx) return;
      const notes = [659.25, 783.99, 987.77, 1318.51];
      notes.forEach((freq, i) => {
        setTimeout(() => {
          this.playTone(freq, 'triangle', 0.09, 0.15);
        }, i * 60);
      });
    }

    // Pac-man dying sound (classic descending chromatic wobble)
    playDeath() {
      if (this.muted || !this.ctx) return;
      const pitches = [
        600, 580, 550, 520, 490, 460, 430, 400,
        370, 340, 310, 280, 250, 220, 190, 160, 130, 100
      ];
      pitches.forEach((freq, i) => {
        setTimeout(() => {
          this.playTone(freq, 'sawtooth', 0.07, 0.12, freq * 0.85);
        }, i * 65);
      });
      setTimeout(() => {
        this.playTone(80, 'sine', 0.15, 0.25, 40);
      }, pitches.length * 65);
    }

    // Level Clear fanfare
    playLevelClear() {
      if (this.muted || !this.ctx) return;
      const fanfare = [
        { f: 523.25, d: 0.12 }, // C5
        { f: 659.25, d: 0.12 }, // E5
        { f: 783.99, d: 0.12 }, // G5
        { f: 1046.50, d: 0.24 }, // C6
        { f: 783.99, d: 0.12 }, // G5
        { f: 1046.50, d: 0.40 }  // C6
      ];
      let delay = 0;
      fanfare.forEach((n) => {
        setTimeout(() => {
          this.playTone(n.f, 'triangle', n.d, 0.18);
        }, delay);
        delay += n.d * 1000 + 40;
      });
    }

    // Authentic Opening Theme Jingle
    playStartJingle() {
      if (this.muted || !this.ctx) return;
      const notes = [
        { f: 493.88, d: 0.13 }, // B4
        { f: 987.77, d: 0.13 }, // B5
        { f: 739.99, d: 0.13 }, // F#5
        { f: 622.25, d: 0.13 }, // D#5
        { f: 987.77, d: 0.13 }, // B5
        { f: 739.99, d: 0.13 }, // F#5
        { f: 622.25, d: 0.26 }, // D#5

        { f: 523.25, d: 0.13 }, // C5
        { f: 1046.50, d: 0.13 }, // C6
        { f: 783.99, d: 0.13 }, // G5
        { f: 659.25, d: 0.13 }, // E5
        { f: 1046.50, d: 0.13 }, // C6
        { f: 783.99, d: 0.13 }, // G5
        { f: 659.25, d: 0.26 }, // E5

        { f: 493.88, d: 0.13 }, // B4
        { f: 987.77, d: 0.13 }, // B5
        { f: 739.99, d: 0.13 }, // F#5
        { f: 622.25, d: 0.13 }, // D#5
        { f: 987.77, d: 0.13 }, // B5
        { f: 739.99, d: 0.13 }, // F#5
        { f: 622.25, d: 0.26 }, // D#5

        { f: 622.25, d: 0.08 }, // D#5
        { f: 659.25, d: 0.08 }, // E5
        { f: 698.46, d: 0.08 }, // F5
        { f: 739.99, d: 0.08 }, // F#5
        { f: 783.99, d: 0.08 }, // G5
        { f: 830.61, d: 0.08 }, // G#5
        { f: 880.00, d: 0.08 }, // A5
        { f: 987.77, d: 0.35 }  // B5
      ];
      let delay = 0;
      notes.forEach((n) => {
        setTimeout(() => {
          this.playTone(n.f, 'square', n.d, 0.14);
        }, delay);
        delay += n.d * 1000 + 20;
      });
    }
  }

  // =========================================================================
  // MAZE ENGINE
  // =========================================================================

  class Maze {
    constructor() {
      this.grid = [];
      this.totalDots = 0;
      this.dotsRemaining = 0;
      this.reset();
    }

    reset() {
      this.grid = [];
      this.totalDots = 0;
      for (let r = 0; r < GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c < GRID_COLS; c++) {
          const char = MAZE_TEMPLATE[r][c];
          let cell = TILE_EMPTY;
          if (char === '#') cell = TILE_WALL;
          else if (char === '.') { cell = TILE_DOT; this.totalDots++; }
          else if (char === 'o') { cell = TILE_ENERGIZER; this.totalDots++; }
          else if (char === '-') cell = TILE_GATE;
          row.push(cell);
        }
        this.grid.push(row);
      }
      this.dotsRemaining = this.totalDots;
    }

    getTile(c, r) {
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return TILE_EMPTY;
      return this.grid[r][c];
    }

    isWall(c, r) {
      if (r < 0 || r >= GRID_ROWS) return false;
      if (c < 0 || c >= GRID_COLS) return false; // Tunnel is open
      return this.grid[r][c] === TILE_WALL;
    }

    isPassableForPacman(c, r) {
      // In row 14, wrap-around tunnel is passable outside bounds
      if (r === 14 && (c < 0 || c >= GRID_COLS)) return true;
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return false;
      const tile = this.grid[r][c];
      return tile !== TILE_WALL && tile !== TILE_GATE;
    }

    isPassableForGhost(c, r, canUseGate = false) {
      if (r === 14 && (c < 0 || c >= GRID_COLS)) return true;
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return false;
      const tile = this.grid[r][c];
      if (tile === TILE_WALL) return false;
      if (tile === TILE_GATE && !canUseGate) return false;
      return true;
    }

    eat(c, r) {
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return TILE_EMPTY;
      const tile = this.grid[r][c];
      if (tile === TILE_DOT || tile === TILE_ENERGIZER) {
        this.grid[r][c] = TILE_EMPTY;
        this.dotsRemaining--;
        return tile;
      }
      return TILE_EMPTY;
    }

    draw(ctx, flashWhite = false) {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const tile = this.grid[r][c];
          const px = c * TILE_SIZE;
          const py = r * TILE_SIZE;

          if (tile === TILE_WALL) {
            // Dark wall fill
            ctx.fillStyle = flashWhite ? '#ffffff' : '#0c0e29';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            // Wall neon boundary lines
            ctx.strokeStyle = flashWhite ? '#ffffff' : '#2121ff';
            ctx.lineWidth = 2;

            const topOpen = !this.isWall(c, r - 1);
            const btmOpen = !this.isWall(c, r + 1);
            const lftOpen = !this.isWall(c - 1, r);
            const rgtOpen = !this.isWall(c + 1, r);

            ctx.beginPath();
            if (topOpen) { ctx.moveTo(px, py + 1); ctx.lineTo(px + TILE_SIZE, py + 1); }
            if (btmOpen) { ctx.moveTo(px, py + TILE_SIZE - 1); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE - 1); }
            if (lftOpen) { ctx.moveTo(px + 1, py); ctx.lineTo(px + 1, py + TILE_SIZE); }
            if (rgtOpen) { ctx.moveTo(px + TILE_SIZE - 1, py); ctx.lineTo(px + TILE_SIZE - 1, py + TILE_SIZE); }
            ctx.stroke();

          } else if (tile === TILE_GATE) {
            // Ghost house gate
            ctx.strokeStyle = '#ffb8de';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(px, py + TILE_SIZE / 2);
            ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE / 2);
            ctx.stroke();

          } else if (tile === TILE_DOT) {
            // Normal dot
            ctx.fillStyle = '#ffb8ae';
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 2.5, 0, 2 * Math.PI);
            ctx.fill();

          } else if (tile === TILE_ENERGIZER) {
            // Pulsating energizer pellet
            const pulse = 1.0 + 0.3 * Math.sin(Date.now() / 120);
            ctx.fillStyle = '#ffb8ae';
            ctx.shadowColor = '#ffb8ae';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 6 * pulse, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }
    }
  }

  // =========================================================================
  // PAC-MAN ENTITY
  // =========================================================================

  class Pacman {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = 13.5;
      this.y = 23.0;
      this.dir = DIR_LEFT;
      this.nextDir = null;
      this.speed = 10.5; // tiles per second
      this.mouthPhase = 0;
      this.isDying = false;
      this.deathProgress = 0; // 0 to 1
    }

    setNextDirection(dir) {
      this.nextDir = dir;
    }

    update(dt, maze) {
      if (this.isDying) {
        this.deathProgress += dt * 0.9;
        return;
      }

      // 1. Process instant 180 reverse or start moving from stop
      if (this.nextDir) {
        if (this.dir === DIR_NONE) {
          const centerC = Math.round(this.x);
          const centerR = Math.round(this.y);
          if (maze.isPassableForPacman(centerC + this.nextDir.x, centerR + this.nextDir.y)) {
            this.x = centerC;
            this.y = centerR;
            this.dir = this.nextDir;
            this.nextDir = null;
          }
        } else if (this.nextDir === getOppositeDir(this.dir)) {
          this.dir = this.nextDir;
          this.nextDir = null;
        }
      }

      // 2. Cornering / Pre-turn Buffer
      if (this.nextDir && this.nextDir !== this.dir) {
        const centerCol = Math.round(this.x);
        const centerRow = Math.round(this.y);
        const dx = Math.abs(this.x - centerCol);
        const dy = Math.abs(this.y - centerRow);

        // Within 0.38 tiles of intersection center
        if (dx < 0.38 && dy < 0.38) {
          const targetCol = centerCol + this.nextDir.x;
          const targetRow = centerRow + this.nextDir.y;
          if (maze.isPassableForPacman(targetCol, targetRow)) {
            this.x = centerCol;
            this.y = centerRow;
            this.dir = this.nextDir;
            this.nextDir = null;
          }
        }
      }

      // 3. Move in current direction
      if (this.dir !== DIR_NONE) {
        const moveDist = this.speed * dt;
        const nextX = this.x + this.dir.x * moveDist;
        const nextY = this.y + this.dir.y * moveDist;

        // Check if moving into wall
        let hitWall = false;
        if (this.dir === DIR_RIGHT) {
          const checkCol = Math.floor(nextX + 0.5);
          const checkRow = Math.round(this.y);
          if (!maze.isPassableForPacman(checkCol, checkRow)) hitWall = true;
        } else if (this.dir === DIR_LEFT) {
          const checkCol = Math.ceil(nextX - 0.5);
          const checkRow = Math.round(this.y);
          if (!maze.isPassableForPacman(checkCol, checkRow)) hitWall = true;
        } else if (this.dir === DIR_DOWN) {
          const checkRow = Math.floor(nextY + 0.5);
          const checkCol = Math.round(this.x);
          if (!maze.isPassableForPacman(checkCol, checkRow)) hitWall = true;
        } else if (this.dir === DIR_UP) {
          const checkRow = Math.ceil(nextY - 0.5);
          const checkCol = Math.round(this.x);
          if (!maze.isPassableForPacman(checkCol, checkRow)) hitWall = true;
        }

        if (hitWall) {
          this.x = Math.round(this.x);
          this.y = Math.round(this.y);
          this.dir = DIR_NONE;
        } else {
          this.x = nextX;
          this.y = nextY;
          this.mouthPhase += dt * 18;
        }
      }

      // 4. Warp Tunnel Wrap-around (Row 14)
      if (Math.round(this.y) === 14) {
        if (this.x < -0.5) this.x = GRID_COLS - 0.5;
        else if (this.x > GRID_COLS - 0.5) this.x = -0.5;
      }
    }

    draw(ctx) {
      const cx = (this.x + 0.5) * TILE_SIZE;
      const cy = (this.y + 0.5) * TILE_SIZE;
      const radius = TILE_SIZE * 0.44;

      if (this.isDying) {
        if (this.deathProgress >= 1.0) return;
        const openAngle = Math.min(Math.PI, this.deathProgress * Math.PI);
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2 + openAngle, 1.5 * Math.PI - openAngle, false);
        ctx.lineTo(cx, cy);
        ctx.fill();
        return;
      }

      let mouthAngle = 0.05 * Math.PI;
      if (this.dir !== DIR_NONE) {
        mouthAngle = (Math.sin(this.mouthPhase) * 0.5 + 0.5) * 0.32 * Math.PI + 0.04;
      }

      const rot = this.dir.angle;

      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, rot + mouthAngle, rot + 2 * Math.PI - mouthAngle, false);
      ctx.lineTo(cx, cy);
      ctx.fill();

      // Screen boundary clones for smooth wrap rendering in tunnel
      if (this.x < 1.0) {
        const wrapX = (this.x + GRID_COLS + 0.5) * TILE_SIZE;
        ctx.beginPath();
        ctx.arc(wrapX, cy, radius, rot + mouthAngle, rot + 2 * Math.PI - mouthAngle, false);
        ctx.lineTo(wrapX, cy);
        ctx.fill();
      } else if (this.x > GRID_COLS - 2.0) {
        const wrapX = (this.x - GRID_COLS + 0.5) * TILE_SIZE;
        ctx.beginPath();
        ctx.arc(wrapX, cy, radius, rot + mouthAngle, rot + 2 * Math.PI - mouthAngle, false);
        ctx.lineTo(wrapX, cy);
        ctx.fill();
      }
    }
  }

  // =========================================================================
  // GHOST ENTITIES & AI CONTROLLER
  // =========================================================================

  const GHOST_STATE_IN_HOUSE = 'IN_HOUSE';
  const GHOST_STATE_LEAVING_HOUSE = 'LEAVING_HOUSE';
  const GHOST_STATE_SCATTER = 'SCATTER';
  const GHOST_STATE_CHASE = 'CHASE';
  const GHOST_STATE_FRIGHTENED = 'FRIGHTENED';
  const GHOST_STATE_EATEN = 'EATEN';
  const GHOST_STATE_ENTERING_HOUSE = 'ENTERING_HOUSE';

  class Ghost {
    constructor(name, color, scatterTarget, housePos, initialDir, dotReleaseThreshold) {
      this.name = name;
      this.color = color;
      this.scatterTarget = scatterTarget;
      this.housePos = housePos;
      this.initialDir = initialDir;
      this.dotReleaseThreshold = dotReleaseThreshold;
      this.reset();
    }

    reset() {
      this.x = this.housePos.x;
      this.y = this.housePos.y;
      this.dir = this.initialDir;
      this.state = this.name === 'Blinky' ? GHOST_STATE_SCATTER : GHOST_STATE_IN_HOUSE;
      this.frightenedTimer = 0;
      this.bobTimer = 0;
      this.baseSpeed = 9.8;
      this.lastTile = { c: Math.round(this.x), r: Math.round(this.y) };
    }

    getTarget(globalMode, pacman, blinky) {
      if (this.state === GHOST_STATE_EATEN) {
        // Return to ghost house door
        return { x: 13.5, y: 11.0 };
      }

      if (this.state === GHOST_STATE_SCATTER) {
        return this.scatterTarget;
      }

      // CHASE MODE PERSONALITIES
      if (this.name === 'Blinky') {
        // Direct Chaser
        return { x: pacman.x, y: pacman.y };
      }

      if (this.name === 'Pinky') {
        // Ambusher: 4 tiles ahead of Pac-Man
        return {
          x: pacman.x + 4 * pacman.dir.x,
          y: pacman.y + 4 * pacman.dir.y
        };
      }

      if (this.name === 'Inky') {
        // Flanker: Vector doubling from Blinky to 2 tiles ahead of Pac-Man
        const pivotX = pacman.x + 2 * pacman.dir.x;
        const pivotY = pacman.y + 2 * pacman.dir.y;
        return {
          x: 2 * pivotX - blinky.x,
          y: 2 * pivotY - blinky.y
        };
      }

      if (this.name === 'Clyde') {
        // Coward: Target Pac-Man if > 8 tiles away, otherwise retreat to scatter corner
        const dist = Math.hypot(this.x - pacman.x, this.y - pacman.y);
        if (dist > 8.0) {
          return { x: pacman.x, y: pacman.y };
        } else {
          return this.scatterTarget;
        }
      }

      return { x: pacman.x, y: pacman.y };
    }

    makeFrightened(duration) {
      if (this.state !== GHOST_STATE_IN_HOUSE && this.state !== GHOST_STATE_LEAVING_HOUSE && this.state !== GHOST_STATE_EATEN) {
        this.state = GHOST_STATE_FRIGHTENED;
        this.frightenedTimer = duration;
        this.dir = getOppositeDir(this.dir);
      }
    }

    update(dt, maze, globalMode, pacman, blinky, dotsEaten, dotsRemaining) {
      // 1. Handle in-house state & release
      if (this.state === GHOST_STATE_IN_HOUSE) {
        this.bobTimer += dt * 4;
        this.y = this.housePos.y + Math.sin(this.bobTimer) * 0.35;

        if (dotsEaten >= this.dotReleaseThreshold) {
          this.state = GHOST_STATE_LEAVING_HOUSE;
        }
        return;
      }

      if (this.state === GHOST_STATE_LEAVING_HOUSE) {
        if (Math.abs(this.x - 13.5) > 0.1) {
          this.x += (this.x < 13.5 ? 1 : -1) * 6 * dt;
          this.dir = this.x < 13.5 ? DIR_RIGHT : DIR_LEFT;
        } else {
          this.x = 13.5;
          this.y -= 6 * dt;
          this.dir = DIR_UP;
          if (this.y <= 11.0) {
            this.y = 11.0;
            this.dir = DIR_LEFT;
            this.state = globalMode;
            this.lastTile = { c: 13, r: 11 };
          }
        }
        return;
      }

      if (this.state === GHOST_STATE_ENTERING_HOUSE) {
        this.x = 13.5;
        this.y += 8 * dt;
        this.dir = DIR_DOWN;
        if (this.y >= 14.0) {
          this.y = 14.0;
          this.state = GHOST_STATE_LEAVING_HOUSE;
        }
        return;
      }

      // 2. Frightened timer countdown
      if (this.state === GHOST_STATE_FRIGHTENED) {
        this.frightenedTimer -= dt;
        if (this.frightenedTimer <= 0) {
          this.state = globalMode;
        }
      }

      // 3. Calculate Speed
      let speed = this.baseSpeed;
      if (this.name === 'Blinky') {
        // Cruise Elroy speed boost
        if (dotsRemaining < 10) speed *= 1.10;
        else if (dotsRemaining < 20) speed *= 1.05;
      }

      if (this.state === GHOST_STATE_FRIGHTENED) {
        speed = this.baseSpeed * 0.55;
      } else if (this.state === GHOST_STATE_EATEN) {
        speed = this.baseSpeed * 1.8;
      } else if (Math.round(this.y) === 14 && (this.x < 5 || this.x > 22)) {
        // Tunnel slowdown
        speed = this.baseSpeed * 0.5;
      }

      // 4. Move forward
      this.x += this.dir.x * speed * dt;
      this.y += this.dir.y * speed * dt;

      // Warp Tunnel Wrap
      if (Math.round(this.y) === 14) {
        if (this.x < -0.5) this.x = GRID_COLS - 0.5;
        else if (this.x > GRID_COLS - 0.5) this.x = -0.5;
      }

      // 5. Intersection Decision
      const currentC = Math.round(this.x);
      const currentR = Math.round(this.y);

      const crossedCenter = Math.abs(this.x - currentC) < 0.25 && Math.abs(this.y - currentR) < 0.25;

      if (crossedCenter && (currentC !== this.lastTile.c || currentR !== this.lastTile.r)) {
        this.lastTile = { c: currentC, r: currentR };

        if (this.state === GHOST_STATE_EATEN && (currentC === 13 || currentC === 14) && currentR === 11) {
          this.x = 13.5;
          this.y = 11.0;
          this.state = GHOST_STATE_ENTERING_HOUSE;
          return;
        }

        const oppDir = getOppositeDir(this.dir);
        const candidates = [];

        for (const testDir of ALL_DIRS) {
          if (testDir === oppDir) continue;

          const nextC = currentC + testDir.x;
          const nextR = currentR + testDir.y;

          const canPassGate = this.state === GHOST_STATE_EATEN;
          if (maze.isPassableForGhost(nextC, nextR, canPassGate)) {
            candidates.push(testDir);
          }
        }

        // Fallback to opposite direction if at a dead end
        if (candidates.length === 0) {
          candidates.push(oppDir);
        }

        let chosenDir = candidates[0];

        if (this.state === GHOST_STATE_FRIGHTENED) {
          chosenDir = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          const target = this.getTarget(globalMode, pacman, blinky);
          let minDistSq = Infinity;

          for (const cDir of candidates) {
            const testX = currentC + cDir.x;
            const testY = currentR + cDir.y;
            const distSq = (testX - target.x) ** 2 + (testY - target.y) ** 2;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              chosenDir = cDir;
            }
          }
        }

        this.x = currentC;
        this.y = currentR;
        this.dir = chosenDir;
      }
    }

    draw(ctx) {
      const cx = (this.x + 0.5) * TILE_SIZE;
      const cy = (this.y + 0.5) * TILE_SIZE;
      const r = TILE_SIZE * 0.44;

      // 1. Draw Ghost Body
      if (this.state !== GHOST_STATE_EATEN) {
        let bodyColor = this.color;
        if (this.state === GHOST_STATE_FRIGHTENED) {
          if (this.frightenedTimer < 2.0 && Math.floor(Date.now() / 180) % 2 === 0) {
            bodyColor = '#ffffff';
          } else {
            bodyColor = '#2121ff';
          }
        }

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, r, Math.PI, 0, false);
        ctx.lineTo(cx + r, cy + r - 2);

        const wave = Math.floor(Date.now() / 150) % 2 === 0 ? 3 : 0;
        const w = (2 * r) / 3;

        ctx.lineTo(cx + r - w * 0.5, cy + r - 5 + wave);
        ctx.lineTo(cx + r - w, cy + r - 2);
        ctx.lineTo(cx + r - w * 1.5, cy + r - 5 + (3 - wave));
        ctx.lineTo(cx - r + w, cy + r - 2);
        ctx.lineTo(cx - r + w * 0.5, cy + r - 5 + wave);
        ctx.lineTo(cx - r, cy + r - 2);

        ctx.closePath();
        ctx.fill();
      }

      // 2. Eyes Rendering
      if (this.state === GHOST_STATE_FRIGHTENED) {
        ctx.fillStyle = '#ffb8de';
        ctx.fillRect(cx - 5, cy - 3, 2.5, 3);
        ctx.fillRect(cx + 2.5, cy - 3, 2.5, 3);

        ctx.strokeStyle = '#ffb8de';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 3);
        ctx.lineTo(cx - 2.5, cy + 1.5);
        ctx.lineTo(cx, cy + 3);
        ctx.lineTo(cx + 2.5, cy + 1.5);
        ctx.lineTo(cx + 5, cy + 3);
        ctx.stroke();

      } else {
        ctx.fillStyle = '#ffffff';
        const eyeOffsetX = 4.2;
        const eyeOffsetY = -2.5;
        const eyeRadiusX = 3.5;
        const eyeRadiusY = 4.5;

        ctx.beginPath();
        ctx.ellipse(cx - eyeOffsetX, cy + eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, 2 * Math.PI);
        ctx.ellipse(cx + eyeOffsetX, cy + eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, 2 * Math.PI);
        ctx.fill();

        const pupilShiftX = this.dir.x * 2.0;
        const pupilShiftY = this.dir.y * 2.0;

        ctx.fillStyle = '#0022cc';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX + pupilShiftX, cy + eyeOffsetY + pupilShiftY, 2.0, 0, 2 * Math.PI);
        ctx.arc(cx + eyeOffsetX + pupilShiftX, cy + eyeOffsetY + pupilShiftY, 2.0, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Tunnel wrapping screen clone
      if (this.x < 1.0) {
        const wrapCX = (this.x + GRID_COLS + 0.5) * TILE_SIZE;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(wrapCX, cy - 2, r, Math.PI, 0, false);
        ctx.fill();
      }
    }
  }

  // =========================================================================
  // BONUS FRUIT ENTITY
  // =========================================================================

  class Fruit {
    constructor() {
      this.active = false;
      this.timer = 0;
      this.x = 13.5;
      this.y = 17.0;
      this.currentFruit = FRUITS[0];
    }

    spawn(level) {
      const idx = Math.min(level - 1, FRUITS.length - 1);
      this.currentFruit = FRUITS[idx];
      this.active = true;
      this.timer = 10.0;
    }

    update(dt) {
      if (!this.active) return;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.active = false;
      }
    }

    draw(ctx) {
      if (!this.active) return;
      const cx = (this.x + 0.5) * TILE_SIZE;
      const cy = (this.y + 0.5) * TILE_SIZE;

      ctx.save();
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.currentFruit.symbol, cx, cy);
      ctx.restore();
    }
  }

  // =========================================================================
  // FLOATING SCORE TEXT
  // =========================================================================

  class FloatingScore {
    constructor(x, y, text, color = '#ffff00') {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.life = 1.0;
    }

    update(dt) {
      this.y -= dt * 1.2;
      this.life -= dt;
      return this.life > 0;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.fillStyle = this.color;
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.text, (this.x + 0.5) * TILE_SIZE, (this.y + 0.5) * TILE_SIZE);
      ctx.restore();
    }
  }

  // =========================================================================
  // MAIN GAME ENGINE CONTROLLER
  // =========================================================================

  class Game {
    constructor(options = {}) {
      this.canvas = options.canvas || (typeof document !== 'undefined' ? document.getElementById('gameCanvas') : null);
      this.ctx = options.ctx || (this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null);
      this.sound = options.sound || new SoundController();

      // Core Game Objects
      this.maze = new Maze();
      this.pacman = new Pacman();
      this.fruit = new Fruit();
      this.floatingScores = [];

      // The 4 classic ghosts
      this.ghosts = [
        new Ghost('Blinky', '#ff0000', { x: 25, y: -2 }, { x: 13.5, y: 11.0 }, DIR_LEFT, 0),
        new Ghost('Pinky',  '#ffb8de', { x:  2, y: -2 }, { x: 13.5, y: 14.0 }, DIR_UP,   0),
        new Ghost('Inky',   '#00ffff', { x: 27, y: 31 }, { x: 11.5, y: 14.0 }, DIR_UP,  30),
        new Ghost('Clyde',  '#ffb847', { x:  0, y: 31 }, { x: 15.5, y: 14.0 }, DIR_UP,  60)
      ];

      // Game States & Variables
      this.state = STATE_START;
      this.score = 0;
      let savedHighScore = '0';
      try {
        if (typeof localStorage !== 'undefined') {
          savedHighScore = localStorage.getItem('pacman_highscore') || '0';
        }
      } catch (e) {}
      this.highScore = parseInt(savedHighScore, 10);
      this.level = 1;
      this.lives = 3;
      this.extraLifeAwarded = false;

      // Timers & Waves
      this.readyTimer = 0;
      this.freezeTimer = 0;
      this.clearFlashTimer = 0;
      this.clearFlashes = 0;
      this.ghostComboMultiplier = 200;
      this.globalWaveTimer = 0;
      this.globalWaveIndex = 0;
      this.globalMode = GHOST_STATE_SCATTER;

      this.waveSchedule = [
        { mode: GHOST_STATE_SCATTER, duration: 7 },
        { mode: GHOST_STATE_CHASE,   duration: 20 },
        { mode: GHOST_STATE_SCATTER, duration: 7 },
        { mode: GHOST_STATE_CHASE,   duration: 20 },
        { mode: GHOST_STATE_SCATTER, duration: 5 },
        { mode: GHOST_STATE_CHASE,   duration: 20 },
        { mode: GHOST_STATE_SCATTER, duration: 5 },
        { mode: GHOST_STATE_CHASE,   duration: Infinity }
      ];

      // Screen & UI Manager (from screens.js)
      if (options.screenManager !== undefined) {
        this.screenManager = options.screenManager;
      } else {
        this.screenManager = (typeof ScreenManager !== 'undefined') ? new ScreenManager() : null;
      }

      this.lastTime = 0;

      if (!options.headless) {
        this.initEvents();
        this.updateHUD();
        this.showModal('start');
      }
    }

    initEvents() {
      // 1. Wire ScreenManager Callbacks
      if (this.screenManager) {
        this.screenManager.onStart = () => {
          this.sound.init();
          this.startNewGame();
        };

        this.screenManager.onResume = () => {
          this.sound.init();
          this.togglePause();
        };

        this.screenManager.onRestart = () => {
          this.sound.init();
          this.startNewGame();
        };

        this.screenManager.onNextLevel = () => {
          this.sound.init();
          this.advanceLevel();
        };

        this.screenManager.onToggleSound = () => {
          this.sound.init();
          this.toggleSound();
        };

        this.screenManager.onTogglePause = () => {
          this.sound.init();
          this.togglePause();
        };

        this.screenManager.onDirectionInput = (dirName) => {
          this.sound.init();
          if (dirName === 'UP') this.handleDirectionInput(DIR_UP);
          else if (dirName === 'DOWN') this.handleDirectionInput(DIR_DOWN);
          else if (dirName === 'LEFT') this.handleDirectionInput(DIR_LEFT);
          else if (dirName === 'RIGHT') this.handleDirectionInput(DIR_RIGHT);
        };
      }

      // 2. Keyboard Controls
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
          this.sound.init();

          switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
              e.preventDefault();
              this.handleDirectionInput(DIR_UP);
              break;
            case 'ArrowDown':
            case 's':
            case 'S':
              e.preventDefault();
              this.handleDirectionInput(DIR_DOWN);
              break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
              e.preventDefault();
              this.handleDirectionInput(DIR_LEFT);
              break;
            case 'ArrowRight':
            case 'd':
            case 'D':
              e.preventDefault();
              this.handleDirectionInput(DIR_RIGHT);
              break;
            case 'p':
            case 'P':
            case ' ':
              e.preventDefault();
              this.togglePause();
              break;
            case 'm':
            case 'M':
              e.preventDefault();
              this.toggleSound();
              break;
            case 'r':
            case 'R':
              e.preventDefault();
              this.restartGame();
              break;
          }
        });
      }

      // 3. Touch Swipes on Canvas
      if (this.canvas) {
        let touchStartX = 0;
        let touchStartY = 0;

        this.canvas.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.sound.init();
          if (e.touches.length > 0) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
          }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
          e.preventDefault();
          if (e.changedTouches.length > 0) {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (Math.hypot(dx, dy) > 20) {
              if (Math.abs(dx) > Math.abs(dy)) {
                this.handleDirectionInput(dx > 0 ? DIR_RIGHT : DIR_LEFT);
              } else {
                this.handleDirectionInput(dy > 0 ? DIR_DOWN : DIR_UP);
              }
            }
          }
        }, { passive: false });
      }
    }

    handleDirectionInput(dir) {
      if (this.state === STATE_PLAYING || this.state === STATE_READY) {
        this.pacman.setNextDirection(dir);
      }
    }

    toggleSound() {
      const isUnmuted = this.sound.toggleMute();
      if (this.screenManager) {
        this.screenManager.updateSoundButton(isUnmuted);
      }
    }

    togglePause() {
      if (this.state === STATE_PLAYING) {
        this.state = STATE_PAUSED;
        this.showModal('pause');
      } else if (this.state === STATE_PAUSED) {
        this.hideModals();
        this.state = STATE_PLAYING;
      }
    }

    showModal(modalName) {
      if (this.screenManager) {
        this.screenManager.showScreen(modalName, {
          score: this.score,
          highScore: this.highScore,
          level: this.level
        });
      }
    }

    hideModals() {
      if (this.screenManager) {
        this.screenManager.hideAllScreens();
      }
    }

    startNewGame() {
      this.score = 0;
      this.level = 1;
      this.lives = 3;
      this.extraLifeAwarded = false;
      this.maze.reset();
      this.resetRound(true);
      this.hideModals();
      this.updateHUD();
      this.state = STATE_READY;
      this.readyTimer = 3.5;
      this.sound.playStartJingle();
    }

    restartGame() {
      this.startNewGame();
    }

    resetRound(isNewLevel = false) {
      this.pacman.reset();
      this.ghosts.forEach(g => g.reset());
      this.floatingScores = [];
      this.globalWaveIndex = 0;
      this.globalWaveTimer = 0;
      this.globalMode = this.waveSchedule[0].mode;

      if (isNewLevel) {
        this.fruit = new Fruit();
      }
    }

    advanceLevel() {
      this.level++;
      this.maze.reset();
      this.resetRound(true);
      this.hideModals();
      this.updateHUD();
      this.state = STATE_READY;
      this.readyTimer = 2.0;
    }

    updateHUD() {
      if (!this.screenManager) return;
      const currentFruit = FRUITS[Math.min(this.level - 1, FRUITS.length - 1)];
      this.screenManager.updateHUD(this.score, this.highScore, this.level, this.lives, currentFruit);
    }

    addScore(points) {
      this.score += points;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('pacman_highscore', this.highScore.toString());
          }
        } catch (e) {}
      }

      if (!this.extraLifeAwarded && this.score >= 10000) {
        this.extraLifeAwarded = true;
        this.lives++;
        this.sound.playEatFruit();
      }

      this.updateHUD();
    }

    // =======================================================================
    // GAME LOOP: UPDATE & RENDER
    // =======================================================================

    update(dt) {
      if (this.state === STATE_READY) {
        this.readyTimer -= dt;
        if (this.readyTimer <= 0) {
          this.state = STATE_PLAYING;
        }
        return;
      }

      if (this.state === STATE_LEVEL_CLEAR) {
        this.clearFlashTimer -= dt;
        if (this.clearFlashTimer <= 0) {
          this.clearFlashes++;
          this.clearFlashTimer = 0.25;
          if (this.clearFlashes >= 8) {
            this.showModal('clear');
          }
        }
        return;
      }

      if (this.state === STATE_GHOST_EATEN_FREEZE) {
        this.freezeTimer -= dt;
        if (this.freezeTimer <= 0) {
          this.state = STATE_PLAYING;
        }
        this.floatingScores = this.floatingScores.filter(s => s.update(dt));
        return;
      }

      if (this.state === STATE_PACMAN_DYING) {
        this.pacman.update(dt, this.maze);
        if (this.pacman.deathProgress >= 1.2) {
          this.lives--;
          this.updateHUD();
          if (this.lives <= 0) {
            this.state = STATE_GAME_OVER;
            this.showModal('gameover');
          } else {
            this.resetRound(false);
            this.state = STATE_READY;
            this.readyTimer = 2.0;
          }
        }
        return;
      }

      if (this.state !== STATE_PLAYING) return;

      // Update Wave Schedule (Scatter vs Chase)
      if (this.globalWaveIndex < this.waveSchedule.length) {
        const curWave = this.waveSchedule[this.globalWaveIndex];
        this.globalWaveTimer += dt;
        if (this.globalWaveTimer >= curWave.duration) {
          this.globalWaveIndex++;
          this.globalWaveTimer = 0;
          if (this.globalWaveIndex < this.waveSchedule.length) {
            this.globalMode = this.waveSchedule[this.globalWaveIndex].mode;
            this.ghosts.forEach(g => {
              if (g.state === GHOST_STATE_SCATTER || g.state === GHOST_STATE_CHASE) {
                g.state = this.globalMode;
                g.dir = getOppositeDir(g.dir);
              }
            });
          }
        }
      }

      // Update Pac-Man
      this.pacman.update(dt, this.maze);

      // Check Eating Dots & Energizers
      const pacTileCol = Math.round(this.pacman.x);
      const pacTileRow = Math.round(this.pacman.y);
      const eatenTile = this.maze.eat(pacTileCol, pacTileRow);

      if (eatenTile === TILE_DOT) {
        this.addScore(10);
        this.sound.playChomp();

        const dotsEaten = this.maze.totalDots - this.maze.dotsRemaining;
        if (dotsEaten === 70 || dotsEaten === 170) {
          this.fruit.spawn(this.level);
        }

      } else if (eatenTile === TILE_ENERGIZER) {
        this.addScore(50);
        this.sound.playPowerPellet();

        const frightDuration = Math.max(2.0, 7.5 - (this.level - 1) * 0.7);
        this.ghostComboMultiplier = 200;
        this.ghosts.forEach(g => g.makeFrightened(frightDuration));
      }

      // Level Clear check
      if (this.maze.dotsRemaining <= 0) {
        this.state = STATE_LEVEL_CLEAR;
        this.clearFlashTimer = 0.25;
        this.clearFlashes = 0;
        this.sound.playLevelClear();
        return;
      }

      // Update Fruit & Fruit Collision
      this.fruit.update(dt);
      if (this.fruit.active) {
        const distFruit = Math.hypot(this.pacman.x - this.fruit.x, this.pacman.y - this.fruit.y);
        if (distFruit < 0.8) {
          this.addScore(this.fruit.currentFruit.points);
          this.sound.playEatFruit();
          this.floatingScores.push(
            new FloatingScore(this.fruit.x, this.fruit.y, `+${this.fruit.currentFruit.points}`, '#ffb847')
          );
          this.fruit.active = false;
        }
      }

      // Update Ghosts
      const dotsEaten = this.maze.totalDots - this.maze.dotsRemaining;
      const dotsRemaining = this.maze.dotsRemaining;
      const blinky = this.ghosts[0];
      this.ghosts.forEach(ghost => {
        ghost.update(dt, this.maze, this.globalMode, this.pacman, blinky, dotsEaten, dotsRemaining);
      });

      // Ghost Collisions with Pac-Man
      for (const ghost of this.ghosts) {
        const dist = Math.hypot(this.pacman.x - ghost.x, this.pacman.y - ghost.y);
        if (dist < 0.75) {
          if (ghost.state === GHOST_STATE_FRIGHTENED) {
            ghost.state = GHOST_STATE_EATEN;
            const pts = this.ghostComboMultiplier;
            this.addScore(pts);
            this.ghostComboMultiplier *= 2;
            this.sound.playEatGhost();
            this.floatingScores.push(new FloatingScore(ghost.x, ghost.y, `+${pts}`, '#00ffff'));

            this.state = STATE_GHOST_EATEN_FREEZE;
            this.freezeTimer = 0.45;
            break;

          } else if (ghost.state === GHOST_STATE_CHASE || ghost.state === GHOST_STATE_SCATTER) {
            this.state = STATE_PACMAN_DYING;
            this.pacman.isDying = true;
            this.pacman.deathProgress = 0;
            this.sound.playDeath();
            break;
          }
        }
      }

      // Update Floating Scores
      this.floatingScores = this.floatingScores.filter(s => s.update(dt));
    }

    render() {
      if (!this.ctx || !this.canvas) return;
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const isFlashingWhite = this.state === STATE_LEVEL_CLEAR && (this.clearFlashes % 2 === 1);

      this.maze.draw(this.ctx, isFlashingWhite);
      this.fruit.draw(this.ctx);
      this.pacman.draw(this.ctx);

      if (this.state !== STATE_PACMAN_DYING) {
        this.ghosts.forEach(ghost => ghost.draw(this.ctx));
      }

      this.floatingScores.forEach(s => s.draw(this.ctx));

      if (this.state === STATE_READY) {
        this.ctx.save();
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('READY!', 14 * TILE_SIZE, 17.5 * TILE_SIZE);
        this.ctx.restore();
      }
    }

    loop(timestamp) {
      if (!this.lastTime) this.lastTime = timestamp;
      let dt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;

      if (dt > 0.05) dt = 0.05;

      this.update(dt);
      this.render();

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame((t) => this.loop(t));
      }
    }

    start() {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame((t) => this.loop(t));
      }
    }
  }

  // =========================================================================
  // EXPORT ENGINE MODULE
  // =========================================================================

  const PacmanEngine = {
    // Constants
    GRID_COLS,
    GRID_ROWS,
    TILE_SIZE,
    TILE_EMPTY,
    TILE_WALL,
    TILE_DOT,
    TILE_ENERGIZER,
    TILE_GATE,
    DIR_NONE,
    DIR_UP,
    DIR_DOWN,
    DIR_LEFT,
    DIR_RIGHT,
    ALL_DIRS,
    getOppositeDir,
    STATE_START,
    STATE_READY,
    STATE_PLAYING,
    STATE_PAUSED,
    STATE_PACMAN_DYING,
    STATE_GHOST_EATEN_FREEZE,
    STATE_LEVEL_CLEAR,
    STATE_GAME_OVER,
    MAZE_TEMPLATE,
    FRUITS,
    GHOST_STATE_IN_HOUSE,
    GHOST_STATE_LEAVING_HOUSE,
    GHOST_STATE_SCATTER,
    GHOST_STATE_CHASE,
    GHOST_STATE_FRIGHTENED,
    GHOST_STATE_EATEN,
    GHOST_STATE_ENTERING_HOUSE,

    // Classes
    SoundController,
    Maze,
    Pacman,
    Ghost,
    Fruit,
    FloatingScore,
    Game
  };

  if (typeof window !== 'undefined') {
    window.PacmanEngine = PacmanEngine;
    window.PacmanMaze = Maze;
    window.PacmanEntity = Pacman;
    window.PacmanGhost = Ghost;
    window.PacmanGame = Game;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PacmanEngine;
  }

  // =========================================================================
  // INITIALIZE ON DOM LOAD
  // =========================================================================

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      if (window.__PACMAN_TEST_MODE__ || !document.getElementById('gameCanvas')) return;
      const game = new Game();
      game.start();
    });
  }

})();
