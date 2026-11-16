/**
 * Modern HTML5 Tetris with Web Audio, SRS Wall Kicks, Hold, Ghost Piece, & Particle Effects
 * Runs 100% locally from file:// without dependencies.
 */

(function () {
  'use strict';

  // --- Game Constants & Configurations ---
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30; // 10 * 30 = 300px width, 20 * 30 = 600px height

  // Tetromino definitions (matrices in initial spawn orientation)
  const TETROMINOES = {
    I: {
      shape: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      color: '#00f0f0',
      dark: '#009999',
      light: '#80f8f8'
    },
    J: {
      shape: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: '#2862ff',
      dark: '#163ea8',
      light: '#7ea4ff'
    },
    L: {
      shape: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: '#ff8c00',
      dark: '#b35f00',
      light: '#ffb766'
    },
    O: {
      shape: [
        [1, 1],
        [1, 1]
      ],
      color: '#ffdb00',
      dark: '#b39a00',
      light: '#ffee73'
    },
    S: {
      shape: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
      ],
      color: '#00d647',
      dark: '#008a2e',
      light: '#6df09b'
    },
    T: {
      shape: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: '#af32ff',
      dark: '#6e1ea3',
      light: '#d282ff'
    },
    Z: {
      shape: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
      ],
      color: '#ff3144',
      dark: '#a81c2a',
      light: '#ff8591'
    }
  };

  const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  // Super Rotation System (SRS) Kick Tables
  // Rotations: 0 = spawn, 1 = 90 deg CW, 2 = 180 deg, 3 = 270 deg CW
  // Offsets are [dx, dy] (in Tetris grid: dx right +, dy down - wait, in screen coords: down is +y)
  // Standard Tetris Guideline has +y as up, so we invert Y for canvas grid where down is +y.
  const WALL_KICKS_JLSTZ = {
    '0->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1->0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1->2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3->2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3->0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  };

  const WALL_KICKS_I = {
    '0->1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1->0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1->2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2->1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2->3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3->2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3->0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0->3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  };

  // --- Web Audio Synthesizer ---
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    playTone(freq, type, duration, gainVal = 0.1, pitchDecay = false) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (pitchDecay) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(10, freq * 0.2), now + duration);
        }

        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {
        // audio might be blocked before first click
      }
    }

    playMove() {
      this.playTone(320, 'sine', 0.04, 0.05);
    }

    playRotate() {
      this.playTone(480, 'triangle', 0.06, 0.08);
    }

    playHardDrop() {
      this.playTone(150, 'square', 0.12, 0.15, true);
    }

    playHold() {
      this.playTone(380, 'triangle', 0.08, 0.08);
    }

    playLineClear(lines) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const chords = {
        1: [440, 554],            // A4, C#5
        2: [440, 554, 659],       // A4, C#5, E5
        3: [554, 659, 880],       // C#5, E5, A5
        4: [440, 554, 659, 880]   // Tetris: A4, C#5, E5, A5 fanfare
      };
      const notes = chords[lines] || chords[1];
      notes.forEach((freq, i) => {
        setTimeout(() => {
          this.playTone(freq, 'triangle', lines === 4 ? 0.3 : 0.18, 0.12);
        }, i * 60);
      });
    }

    playLevelUp() {
      if (!this.enabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, 'sine', 0.16, 0.1);
        }, idx * 75);
      });
    }

    playGameOver() {
      if (!this.enabled) return;
      const notes = [330, 293, 261, 196]; // E4, D4, C4, G3
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, 'sawtooth', 0.25, 0.12, true);
        }, idx * 120);
      });
    }
  }

  // --- Particles System ---
  class ParticleSystem {
    constructor() {
      this.particles = [];
    }

    spawn(x, y, color, count = 8) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1, // slight upward float
          size: Math.random() * 4 + 2,
          color: color,
          alpha: 1.0,
          decay: Math.random() * 0.03 + 0.02
        });
      }
    }

    spawnLineClear(rowIndex, color) {
      for (let c = 0; c < COLS; c++) {
        const x = c * BLOCK_SIZE + BLOCK_SIZE / 2;
        const y = rowIndex * BLOCK_SIZE + BLOCK_SIZE / 2;
        this.spawn(x, y, color, 4);
      }
    }

    update() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      ctx.save();
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- Main Tetris Game Class ---
  class TetrisGame {
    constructor() {
      // DOM Elements
      this.canvas = document.getElementById('tetris-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.holdCanvas = document.getElementById('hold-canvas');
      this.holdCtx = this.holdCanvas.getContext('2d');
      this.nextCanvas = document.getElementById('next-canvas');
      this.nextCtx = this.nextCanvas.getContext('2d');

      this.scoreDisplay = document.getElementById('score-display');
      this.highScoreDisplay = document.getElementById('high-score-display');
      this.levelDisplay = document.getElementById('level-display');
      this.linesDisplay = document.getElementById('lines-display');

      this.overlay = document.getElementById('overlay');
      this.startScreen = document.getElementById('start-screen');
      this.pauseScreen = document.getElementById('pause-screen');
      this.gameoverScreen = document.getElementById('gameover-screen');
      this.finalScore = document.getElementById('final-score');
      this.finalLines = document.getElementById('final-lines');

      this.soundIndicator = document.getElementById('sound-indicator');
      this.btnSoundToggle = document.getElementById('btn-sound-toggle');
      this.btnGhostToggle = document.getElementById('btn-ghost-toggle');
      this.btnPauseToggle = document.getElementById('btn-pause-toggle');
      this.btnReset = document.getElementById('btn-reset');

      // Audio & Particles
      this.sound = new SoundManager();
      this.particles = new ParticleSystem();

      // Game state variables
      this.state = 'START'; // 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
      this.grid = this.createGrid();
      this.currentPiece = null;
      this.holdPiece = null;
      this.canHold = true;
      this.bag = [];
      this.nextQueue = [];
      this.showGhost = true;

      // Stats
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.highScore = this.loadHighScore();
      this.highScoreDisplay.textContent = this.highScore.toLocaleString();

      // Timing & Input DAS
      this.dropCounter = 0;
      this.dropInterval = 1000;
      this.lastTime = 0;
      this.lockDelay = 500;
      this.lockTimer = 0;
      this.isLocking = false;
      this.lockMoves = 0;
      this.maxLockMoves = 15;

      // Clearing animation
      this.clearingRows = [];
      this.clearAnimTimer = 0;
      this.clearAnimDuration = 180; // ms

      // Input tracking for DAS (Delayed Auto Shift)
      this.keys = {};
      this.dasDelay = 160; // ms before auto-repeat
      this.dasInterval = 40; // ms between repeats
      this.keyTimers = {};

      this.initEvents();
      this.render();
    }

    createGrid() {
      return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    loadHighScore() {
      try {
        const val = localStorage.getItem('tetris_high_score');
        return val ? parseInt(val, 10) : 0;
      } catch (e) {
        return 0;
      }
    }

    saveHighScore() {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.highScoreDisplay.textContent = this.highScore.toLocaleString();
        try {
          localStorage.setItem('tetris_high_score', this.highScore.toString());
        } catch (e) {}
      }
    }

    // 7-Bag Randomizer
    refillBag() {
      const newBag = [...PIECE_TYPES];
      for (let i = newBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
      }
      this.bag.push(...newBag);
    }

    getNextPieceType() {
      if (this.bag.length < 7) {
        this.refillBag();
      }
      return this.bag.shift();
    }

    fillNextQueue() {
      while (this.nextQueue.length < 4) {
        this.nextQueue.push(this.getNextPieceType());
      }
    }

    spawnPiece(type = null) {
      const pieceType = type || this.nextQueue.shift();
      this.fillNextQueue();

      const def = TETROMINOES[pieceType];
      const shape = def.shape.map(row => [...row]);
      
      // Calculate centered starting X
      const x = Math.floor((COLS - shape[0].length) / 2);
      const y = (pieceType === 'I') ? -1 : 0;

      this.currentPiece = {
        type: pieceType,
        shape: shape,
        color: def.color,
        dark: def.dark,
        light: def.light,
        x: x,
        y: y,
        rotation: 0
      };

      this.canHold = (type === null);
      this.isLocking = false;
      this.lockTimer = 0;
      this.lockMoves = 0;

      // Check immediate collision -> Game Over
      if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
        this.gameOver();
      }

      this.drawSidePanels();
    }

    start() {
      this.sound.init();
      this.grid = this.createGrid();
      this.bag = [];
      this.nextQueue = [];
      this.refillBag();
      this.fillNextQueue();
      this.holdPiece = null;
      this.canHold = true;
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.updateDropInterval();
      this.updateStatsUI();

      this.spawnPiece();
      this.state = 'PLAYING';
      this.hideOverlays();

      this.lastTime = performance.now();
      requestAnimationFrame(this.gameLoop.bind(this));
    }

    pause() {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.overlay.classList.remove('hidden');
        this.startScreen.classList.add('hidden');
        this.pauseScreen.classList.remove('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.btnPauseToggle.textContent = '▶ Resume';
      } else if (this.state === 'PAUSED') {
        this.resume();
      }
    }

    resume() {
      if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.hideOverlays();
        this.btnPauseToggle.textContent = '⏸ Pause';
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
      }
    }

    gameOver() {
      this.state = 'GAMEOVER';
      this.sound.playGameOver();
      this.saveHighScore();

      this.finalScore.textContent = this.score.toLocaleString();
      this.finalLines.textContent = this.lines.toString();

      this.overlay.classList.remove('hidden');
      this.startScreen.classList.add('hidden');
      this.pauseScreen.classList.add('hidden');
      this.gameoverScreen.classList.remove('hidden');
    }

    hideOverlays() {
      this.overlay.classList.add('hidden');
      this.startScreen.classList.add('hidden');
      this.pauseScreen.classList.add('hidden');
      this.gameoverScreen.classList.add('hidden');
    }

    updateDropInterval() {
      // Speed increases exponentially with each level
      this.dropInterval = Math.max(80, Math.pow(0.82 - ((this.level - 1) * 0.006), this.level - 1) * 1000);
    }

    updateStatsUI() {
      this.scoreDisplay.textContent = this.score.toLocaleString();
      this.levelDisplay.textContent = this.level.toString();
      this.linesDisplay.textContent = this.lines.toString();
    }

    checkCollision(offsetX, offsetY, shape) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            const x = offsetX + c;
            const y = offsetY + r;

            // Wall or bottom collisions
            if (x < 0 || x >= COLS || y >= ROWS) {
              return true;
            }
            // Existing locked blocks
            if (y >= 0 && this.grid[y][x] !== 0) {
              return true;
            }
          }
        }
      }
      return false;
    }

    // Move current piece
    move(dir) {
      if (this.state !== 'PLAYING' || !this.currentPiece) return false;

      if (!this.checkCollision(this.currentPiece.x + dir, this.currentPiece.y, this.currentPiece.shape)) {
        this.currentPiece.x += dir;
        this.sound.playMove();

        // If locking, allow slide reset
        if (this.isLocking && this.lockMoves < this.maxLockMoves) {
          this.lockTimer = 0;
          this.lockMoves++;
        }
        return true;
      }
      return false;
    }

    // Soft drop
    softDrop() {
      if (this.state !== 'PLAYING' || !this.currentPiece) return;

      if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
        this.currentPiece.y += 1;
        this.score += 1;
        this.updateStatsUI();
        this.dropCounter = 0;
        return true;
      } else {
        this.isLocking = true;
      }
      return false;
    }

    // Hard drop
    hardDrop() {
      if (this.state !== 'PLAYING' || !this.currentPiece) return;

      let droppedRows = 0;
      while (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
        this.currentPiece.y += 1;
        droppedRows++;
      }

      this.score += droppedRows * 2;
      this.updateStatsUI();
      this.sound.playHardDrop();

      // Screen shake trigger
      this.triggerShake();
      this.lockCurrentPiece();
    }

    triggerShake() {
      this.canvas.style.transform = 'translateY(3px)';
      setTimeout(() => {
        this.canvas.style.transform = 'none';
      }, 50);
    }

    // Hold Piece
    hold() {
      if (this.state !== 'PLAYING' || !this.currentPiece || !this.canHold) return;

      this.sound.playHold();
      const currentType = this.currentPiece.type;

      if (this.holdPiece === null) {
        this.holdPiece = currentType;
        this.spawnPiece();
      } else {
        const temp = this.holdPiece;
        this.holdPiece = currentType;
        this.spawnPiece(temp);
      }

      this.canHold = false;
      this.drawSidePanels();
    }

    // Matrix Rotation
    rotateMatrix(matrix, dir = 1) {
      const N = matrix.length;
      const result = Array.from({ length: N }, () => Array(N).fill(0));
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (dir === 1) {
            // Clockwise
            result[c][N - 1 - r] = matrix[r][c];
          } else {
            // Counter-Clockwise
            result[N - 1 - c][r] = matrix[r][c];
          }
        }
      }
      return result;
    }

    // Super Rotation System with Wall Kicks
    rotate(dir = 1) {
      if (this.state !== 'PLAYING' || !this.currentPiece) return;

      // O piece needs no rotation kicks
      if (this.currentPiece.type === 'O') return;

      const oldRot = this.currentPiece.rotation;
      const newRot = (oldRot + (dir === 1 ? 1 : 3)) % 4;
      const rotatedShape = this.rotateMatrix(this.currentPiece.shape, dir);

      const kickKey = `${oldRot}->${newRot}`;
      const kickTable = this.currentPiece.type === 'I' ? WALL_KICKS_I : WALL_KICKS_JLSTZ;
      const kicks = kickTable[kickKey] || [[0, 0]];

      for (const [dx, dy] of kicks) {
        // Guideline dy is inverted compared to canvas grid
        const testX = this.currentPiece.x + dx;
        const testY = this.currentPiece.y - dy;

        if (!this.checkCollision(testX, testY, rotatedShape)) {
          this.currentPiece.x = testX;
          this.currentPiece.y = testY;
          this.currentPiece.shape = rotatedShape;
          this.currentPiece.rotation = newRot;
          this.sound.playRotate();

          if (this.isLocking && this.lockMoves < this.maxLockMoves) {
            this.lockTimer = 0;
            this.lockMoves++;
          }
          return;
        }
      }
    }

    // Ghost piece calculation
    getGhostY() {
      if (!this.currentPiece) return 0;
      let ghostY = this.currentPiece.y;
      while (!this.checkCollision(this.currentPiece.x, ghostY + 1, this.currentPiece.shape)) {
        ghostY++;
      }
      return ghostY;
    }

    // Lock piece into grid
    lockCurrentPiece() {
      const { shape, x, y, color, dark, light } = this.currentPiece;

      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            const gridY = y + r;
            const gridX = x + c;

            // Placed above top edge -> Game Over
            if (gridY < 0) {
              this.gameOver();
              return;
            }

            this.grid[gridY][gridX] = { color, dark, light };
          }
        }
      }

      this.currentPiece = null;
      this.checkLines();
    }

    // Check completed lines
    checkLines() {
      const completedRows = [];
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[r].every(cell => cell !== 0)) {
          completedRows.push(r);
        }
      }

      if (completedRows.length > 0) {
        this.clearingRows = completedRows;
        this.clearAnimTimer = this.clearAnimDuration;

        // Particle sparks
        for (const row of completedRows) {
          const sampleColor = this.grid[row][0]?.color || '#ffffff';
          this.particles.spawnLineClear(row, sampleColor);
        }

        this.sound.playLineClear(completedRows.length);
      } else {
        this.spawnPiece();
      }
    }

    // Finish clearing animation and remove rows
    finishLineClear() {
      const count = this.clearingRows.length;
      if (count === 0) return;

      // Filter out cleared rows
      this.grid = this.grid.filter((_, idx) => !this.clearingRows.includes(idx));

      // Add fresh empty rows at top
      while (this.grid.length < ROWS) {
        this.grid.unshift(Array(COLS).fill(0));
      }

      // Standard Tetris Guideline Scoring
      const basePoints = { 1: 100, 2: 300, 3: 500, 4: 800 };
      this.score += (basePoints[count] || 100) * this.level;
      this.lines += count;

      // Level up every 10 lines
      const prevLevel = this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      if (this.level > prevLevel) {
        this.sound.playLevelUp();
        this.updateDropInterval();
      }

      this.saveHighScore();
      this.updateStatsUI();

      this.clearingRows = [];
      this.spawnPiece();
    }

    // Main Update Loop
    update(deltaTime) {
      this.particles.update();
      this.handleDAS(deltaTime);

      // Handle Line Clearing Flash Animation
      if (this.clearingRows.length > 0) {
        this.clearAnimTimer -= deltaTime;
        if (this.clearAnimTimer <= 0) {
          this.finishLineClear();
        }
        return;
      }

      if (this.state !== 'PLAYING' || !this.currentPiece) return;

      // Gravity tick
      this.dropCounter += deltaTime;
      if (this.dropCounter > this.dropInterval) {
        this.dropCounter = 0;
        if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
          this.currentPiece.y += 1;
          this.isLocking = false;
        } else {
          this.isLocking = true;
        }
      }

      // Lock delay handling
      if (this.isLocking) {
        // Double check if piece is still resting on something
        if (this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
          this.lockTimer += deltaTime;
          if (this.lockTimer >= this.lockDelay) {
            this.lockCurrentPiece();
          }
        } else {
          this.isLocking = false;
          this.lockTimer = 0;
        }
      }
    }

    // Smooth Delayed Auto Shift (DAS)
    handleDAS(deltaTime) {
      if (this.state !== 'PLAYING') return;

      ['ArrowLeft', 'KeyA'].forEach(k => {
        if (this.keys[k]) this.processKeyHold(k, -1, deltaTime);
      });

      ['ArrowRight', 'KeyD'].forEach(k => {
        if (this.keys[k]) this.processKeyHold(k, 1, deltaTime);
      });

      ['ArrowDown', 'KeyS'].forEach(k => {
        if (this.keys[k]) {
          this.keyTimers[k] = (this.keyTimers[k] || 0) + deltaTime;
          if (this.keyTimers[k] >= 50) {
            this.softDrop();
            this.keyTimers[k] = 0;
          }
        }
      });
    }

    processKeyHold(key, dir, deltaTime) {
      if (!this.keyTimers[key]) {
        this.keyTimers[key] = { time: 0, initialFired: false };
      }

      const timer = this.keyTimers[key];
      timer.time += deltaTime;

      if (!timer.initialFired) {
        if (timer.time >= this.dasDelay) {
          this.move(dir);
          timer.initialFired = true;
          timer.time = 0;
        }
      } else {
        if (timer.time >= this.dasInterval) {
          this.move(dir);
          timer.time = 0;
        }
      }
    }

    // --- Rendering Functions ---
    render() {
      // Clear main canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.drawGridBackground();
      this.drawPlacedBlocks();

      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        if (this.showGhost && this.currentPiece && this.clearingRows.length === 0) {
          this.drawGhostPiece();
        }
        if (this.currentPiece && this.clearingRows.length === 0) {
          this.drawPiece(this.ctx, this.currentPiece, this.currentPiece.x, this.currentPiece.y);
        }
      }

      this.drawClearAnimation();
      this.particles.draw(this.ctx);
    }

    drawGridBackground() {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      this.ctx.lineWidth = 1;

      for (let c = 0; c <= COLS; c++) {
        this.ctx.beginPath();
        this.ctx.moveTo(c * BLOCK_SIZE, 0);
        this.ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        this.ctx.stroke();
      }

      for (let r = 0; r <= ROWS; r++) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, r * BLOCK_SIZE);
        this.ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // Draw single block with tactile bevels and highlights
    drawBlock(ctx, x, y, size, color, dark, light, alpha = 1.0) {
      const px = x * size;
      const py = y * size;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Base fill
      ctx.fillStyle = color;
      ctx.fillRect(px, py, size, size);

      // Top & Left highlight
      ctx.fillStyle = light || '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px + size - 3, py + 3);
      ctx.lineTo(px + 3, py + 3);
      ctx.lineTo(px + 3, py + size - 3);
      ctx.lineTo(px, py + size);
      ctx.closePath();
      ctx.fill();

      // Bottom & Right shadow
      ctx.fillStyle = dark || 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.moveTo(px + size, py);
      ctx.lineTo(px + size, py + size);
      ctx.lineTo(px, py + size);
      ctx.lineTo(px + 3, py + size - 3);
      ctx.lineTo(px + size - 3, py + size - 3);
      ctx.lineTo(px + size - 3, py + 3);
      ctx.closePath();
      ctx.fill();

      // Subtle border line
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

      ctx.restore();
    }

    drawGhostBlock(ctx, x, y, size, color) {
      const px = x * size;
      const py = y * size;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
      ctx.restore();
    }

    drawPlacedBlocks() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = this.grid[r][c];
          if (cell !== 0) {
            this.drawBlock(this.ctx, c, r, BLOCK_SIZE, cell.color, cell.dark, cell.light);
          }
        }
      }
    }

    drawPiece(ctx, piece, offsetX, offsetY, customSize = BLOCK_SIZE) {
      const { shape, color, dark, light } = piece;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            const drawX = offsetX + c;
            const drawY = offsetY + r;
            if (drawY >= 0) {
              this.drawBlock(ctx, drawX, drawY, customSize, color, dark, light);
            }
          }
        }
      }
    }

    drawGhostPiece() {
      const ghostY = this.getGhostY();
      const { shape, color } = this.currentPiece;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            const x = this.currentPiece.x + c;
            const y = ghostY + r;
            if (y >= 0) {
              this.drawGhostBlock(this.ctx, x, y, BLOCK_SIZE, color);
            }
          }
        }
      }
    }

    drawClearAnimation() {
      if (this.clearingRows.length === 0) return;

      const progress = 1 - (this.clearAnimTimer / this.clearAnimDuration);
      this.ctx.save();
      for (const row of this.clearingRows) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * (1 - progress)})`;
        this.ctx.fillRect(0, row * BLOCK_SIZE, this.canvas.width, BLOCK_SIZE);
      }
      this.ctx.restore();
    }

    // Draw Next & Hold side preview canvases
    drawSidePanels() {
      // 1. Hold Canvas
      this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
      if (this.holdPiece) {
        const def = TETROMINOES[this.holdPiece];
        const previewSize = 22;
        const matrix = def.shape;
        const width = matrix[0].length * previewSize;
        const height = matrix.length * previewSize;
        const offX = (this.holdCanvas.width - width) / 2 / previewSize;
        const offY = (this.holdCanvas.height - height) / 2 / previewSize;

        const alpha = this.canHold ? 1.0 : 0.4;
        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== 0) {
              this.drawBlock(
                this.holdCtx,
                offX + c,
                offY + r,
                previewSize,
                def.color,
                def.dark,
                def.light,
                alpha
              );
            }
          }
        }
      }

      // 2. Next Canvas (Preview 3 pieces)
      this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
      const previewSize = 20;
      const slotHeight = 85;

      for (let i = 0; i < Math.min(3, this.nextQueue.length); i++) {
        const type = this.nextQueue[i];
        const def = TETROMINOES[type];
        const matrix = def.shape;
        const w = matrix[0].length * previewSize;
        const h = matrix.length * previewSize;
        const centerY = i * slotHeight + slotHeight / 2;
        const offX = (this.nextCanvas.width - w) / 2 / previewSize;
        const offY = (centerY - h / 2) / previewSize;

        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== 0) {
              this.drawBlock(
                this.nextCtx,
                offX + c,
                offY + r,
                previewSize,
                def.color,
                def.dark,
                def.light
              );
            }
          }
        }
      }
    }

    gameLoop(time) {
      if (this.state !== 'PLAYING') {
        this.render();
        return;
      }

      const deltaTime = Math.min(time - this.lastTime, 100); // clamp for tab switching
      this.lastTime = time;

      this.update(deltaTime);
      this.render();

      requestAnimationFrame(this.gameLoop.bind(this));
    }

    // --- Input & Event Listeners ---
    initEvents() {
      // Keyboard input
      window.addEventListener('keydown', (e) => {
        // Prevent default browser scrolling on arrow keys, space
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }

        // Global keys
        if (e.code === 'KeyM') {
          this.toggleSound();
          return;
        }

        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.state === 'PLAYING') this.pause();
          else if (this.state === 'PAUSED') this.resume();
          return;
        }

        if (e.code === 'KeyR') {
          this.start();
          return;
        }

        if (this.state !== 'PLAYING') return;

        // Discrete Actions
        if (!this.keys[e.code]) {
          if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyX') {
            this.rotate(1); // CW
          } else if (e.code === 'KeyZ' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
            this.rotate(-1); // CCW
          } else if (e.code === 'Space') {
            this.hardDrop();
          } else if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            this.hold();
          } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            this.move(-1);
          } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            this.move(1);
          } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            this.softDrop();
          }
        }

        this.keys[e.code] = true;
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
        delete this.keyTimers[e.code];
      });

      // UI Buttons
      document.getElementById('btn-start').addEventListener('click', () => this.start());
      document.getElementById('btn-resume').addEventListener('click', () => this.resume());
      document.getElementById('btn-restart').addEventListener('click', () => this.start());
      this.btnReset.addEventListener('click', () => this.start());

      this.btnPauseToggle.addEventListener('click', () => {
        if (this.state === 'PLAYING') this.pause();
        else if (this.state === 'PAUSED') this.resume();
      });

      this.soundIndicator.addEventListener('click', () => this.toggleSound());
      this.btnSoundToggle.addEventListener('click', () => this.toggleSound());

      this.btnGhostToggle.addEventListener('click', () => {
        this.showGhost = !this.showGhost;
        this.btnGhostToggle.textContent = `👻 Ghost: ${this.showGhost ? 'ON' : 'OFF'}`;
        this.render();
      });

      // Touch / Virtual Buttons
      this.setupTouchControl('t-left', () => this.move(-1), true);
      this.setupTouchControl('t-right', () => this.move(1), true);
      this.setupTouchControl('t-rotate-cw', () => this.rotate(1), false);
      this.setupTouchControl('t-rotate-ccw', () => this.rotate(-1), false);
      this.setupTouchControl('t-down', () => this.softDrop(), true);
      this.setupTouchControl('t-hard-drop', () => this.hardDrop(), false);
      this.setupTouchControl('t-hold', () => this.hold(), false);
    }

    setupTouchControl(elementId, action, repeat = false) {
      const btn = document.getElementById(elementId);
      if (!btn) return;

      let interval = null;
      const startAction = (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state !== 'PLAYING') return;
        action();
        if (repeat) {
          interval = setInterval(action, 110);
        }
      };

      const stopAction = (e) => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      };

      btn.addEventListener('pointerdown', startAction);
      btn.addEventListener('pointerup', stopAction);
      btn.addEventListener('pointercancel', stopAction);
      btn.addEventListener('pointerleave', stopAction);
    }

    toggleSound() {
      const enabled = this.sound.toggle();
      const text = enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      this.soundIndicator.textContent = text;
      this.btnSoundToggle.textContent = text;
    }
  }

  // Auto-launch on page load
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new TetrisGame();
  });
})();
