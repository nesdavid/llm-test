/**
 * HTML5 PAC-MAN - SCREEN & UI CONTROLLER
 * Dedicated module for managing modal overlays (Start, Pause, GameOver, LevelClear),
 * scoreboard counters, lives icons, fruit display, and button controls.
 */

(function () {
  'use strict';

  class ScreenManager {
    constructor() {
      // Overlay Container
      this.overlay = document.getElementById('game-overlay');

      // Modals
      this.modals = {
        start: document.getElementById('start-modal'),
        pause: document.getElementById('pause-modal'),
        gameover: document.getElementById('gameover-modal'),
        clear: document.getElementById('clear-modal')
      };

      // Game Over Stats Display Elements
      this.gameoverScore = document.getElementById('gameover-score');
      this.gameoverHighScore = document.getElementById('gameover-highscore');
      this.gameoverLevel = document.getElementById('gameover-level');

      // Top HUD Elements
      this.uiScore = document.getElementById('score-display');
      this.uiHighScore = document.getElementById('high-score-display');
      this.uiLevel = document.getElementById('level-display');
      this.soundIcon = document.getElementById('sound-icon');
      this.soundText = document.getElementById('sound-text');

      // Bottom Screen Status Elements
      this.uiLives = document.getElementById('lives-display');
      this.uiFruit = document.getElementById('fruit-display');

      // Action Event Callbacks (wired to Game Engine)
      this.onStart = null;
      this.onResume = null;
      this.onRestart = null;
      this.onNextLevel = null;
      this.onTogglePause = null;
      this.onToggleSound = null;
      this.onDirectionInput = null;

      this.currentScreen = null;

      this.bindEvents();
      this.showScreen('start'); // Default to start modal only
    }

    bindEvents() {
      // 1. Modal Action Buttons
      const btnStart = document.getElementById('btn-start');
      if (btnStart) {
        btnStart.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.onStart) this.onStart();
        });
      }

      const btnResume = document.getElementById('btn-resume');
      if (btnResume) {
        btnResume.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.onResume) this.onResume();
        });
      }

      const btnRestart = document.getElementById('btn-restart');
      if (btnRestart) {
        btnRestart.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.onRestart) this.onRestart();
        });
      }

      const btnNextLevel = document.getElementById('btn-next-level');
      if (btnNextLevel) {
        btnNextLevel.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.onNextLevel) this.onNextLevel();
        });
      }

      // 2. Header Buttons
      const btnSound = document.getElementById('btn-sound');
      if (btnSound) {
        btnSound.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.onToggleSound) this.onToggleSound();
        });
      }

      const btnPause = document.getElementById('btn-pause');
      if (btnPause) {
        btnPause.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.onTogglePause) this.onTogglePause();
        });
      }

      // 3. Touch / On-screen D-Pad
      this.bindDpad();
    }

    bindDpad() {
      const dirMap = {
        'dpad-up': 'UP',
        'dpad-down': 'DOWN',
        'dpad-left': 'LEFT',
        'dpad-right': 'RIGHT'
      };

      Object.keys(dirMap).forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        const dir = dirMap[id];
        const onPress = (e) => {
          e.preventDefault();
          btn.classList.add('pressed');
          if (this.onDirectionInput) this.onDirectionInput(dir);
        };

        const onRelease = (e) => {
          e.preventDefault();
          btn.classList.remove('pressed');
        };

        btn.addEventListener('touchstart', onPress, { passive: false });
        btn.addEventListener('touchend', onRelease, { passive: false });
        btn.addEventListener('mousedown', onPress);
        btn.addEventListener('mouseup', onRelease);
      });
    }

    /**
     * Show a specific screen modal and ensure all other modals are hidden.
     * @param {'start'|'pause'|'gameover'|'clear'} screenName
     * @param {Object} [data] - Additional data (score, highScore, level)
     */
    showScreen(screenName, data = {}) {
      this.currentScreen = screenName;

      // Hide and deactivate all modals first
      Object.keys(this.modals).forEach((key) => {
        const modal = this.modals[key];
        if (modal) {
          modal.classList.add('hidden');
          modal.classList.remove('active');
          modal.style.display = 'none';
        }
      });

      // Find target modal
      const activeModal = this.modals[screenName];
      if (activeModal) {
        // Populate specific screen data
        if (screenName === 'gameover') {
          if (this.gameoverScore) this.gameoverScore.textContent = (data.score ?? 0).toString();
          if (this.gameoverHighScore) this.gameoverHighScore.textContent = (data.highScore ?? 0).toString();
          if (this.gameoverLevel) this.gameoverLevel.textContent = (data.level ?? 1).toString();
        }

        activeModal.classList.remove('hidden');
        activeModal.classList.add('active');
        activeModal.style.display = 'flex';

        if (this.overlay) {
          this.overlay.classList.remove('hidden');
          this.overlay.style.display = 'flex';
        }
      }
    }

    /**
     * Hide all modals and close the overlay.
     */
    hideAllScreens() {
      this.currentScreen = null;
      if (this.overlay) {
        this.overlay.classList.add('hidden');
        this.overlay.style.display = 'none';
      }

      Object.keys(this.modals).forEach((key) => {
        const modal = this.modals[key];
        if (modal) {
          modal.classList.add('hidden');
          modal.classList.remove('active');
          modal.style.display = 'none';
        }
      });
    }

    /**
     * Check if a modal is currently open.
     */
    isScreenOpen() {
      return this.currentScreen !== null;
    }

    /**
     * Update Scoreboard, Lives, and Fruit display.
     */
    updateHUD(score, highScore, level, lives, currentFruit) {
      if (this.uiScore) this.uiScore.textContent = score.toString().padStart(2, '0');
      if (this.uiHighScore) this.uiHighScore.textContent = highScore.toString().padStart(2, '0');
      if (this.uiLevel) this.uiLevel.textContent = level.toString();

      // Render remaining lives as icons
      if (this.uiLives) {
        this.uiLives.innerHTML = '';
        const visibleLives = Math.max(0, lives - 1);
        for (let i = 0; i < visibleLives; i++) {
          const icon = document.createElement('span');
          icon.className = 'life-icon';
          this.uiLives.appendChild(icon);
        }
      }

      // Render Fruit icon
      if (this.uiFruit && currentFruit) {
        this.uiFruit.textContent = currentFruit.symbol;
        this.uiFruit.title = `${currentFruit.name} (${currentFruit.points} pts)`;
      }
    }

    /**
     * Update sound button indicator.
     */
    updateSoundButton(isUnmuted) {
      if (this.soundIcon) this.soundIcon.textContent = isUnmuted ? '🔊' : '🔇';
      if (this.soundText) this.soundText.textContent = isUnmuted ? 'SOUND' : 'MUTED';
    }
  }

  // Export to global scope for use in pacman.js
  window.ScreenManager = ScreenManager;
})();
