# HTML5 Retro PAC-MAN Arcade

A faithful, high-polish retro PAC-MAN arcade game built in pure HTML5, CSS3, and modern Vanilla JavaScript with Canvas and the Web Audio API. 100% self-contained with no external dependencies or assets required.

---

## 🕹️ Features

* **Authentic 28×31 Arcade Maze**: Exact tile-for-tile recreation of the 1980 arcade maze with the classic 240 regular dots + 4 power energizers (244 total dots), ghost pen, and wrap-around side tunnels.
* **4 Unique Ghost AI Personalities**:
  * 🔴 **Blinky ("Shadow")**: Direct chaser who targets Pac-Man's exact tile and speeds up as dots diminish.
  * 🌸 **Pinky ("Speedy")**: Ambusher who aims 4 tiles ahead of Pac-Man's trajectory to cut off escape routes.
  * 🔷 **Inky ("Bashful")**: Flanker using vector doubling between Blinky and Pac-Man to trap the player.
  * 🟠 **Clyde ("Pokey")**: Coward who chases when far away but retreats to his corner when within 8 tiles.
* **Scatter & Chase Wave Cycles**: Timed cycling between ghost scatter modes (defending home corners) and aggressive chase modes, with authentic 180° reversal on mode shifts.
* **Cornering & Input Buffering**: Pre-turn buffering system allows players to queue directional turns slightly before reaching intersections, ensuring silky smooth and responsive arcade navigation.
* **Frightened & Eaten Eyes Modes**: Eating energizers turns ghosts deep blue and vulnerable. Ghosts flash blue/white before recovering. Pac-Man earns combo points (200, 400, 800, 1600) and captured ghosts return as floating eyes to the central house.
* **Web Audio Synthesizer**: Built-in sound effects (authentic opening melody jingle, alternating dual-tone "waka-waka" chomp, energizer hum, ghost siren, fruit chime, and classic descending chromatic death sound).
* **Bonus Fruits System**: Authentic bonus fruits (Cherries, Strawberries, Peaches, Apples, Melons, Galaxian, Bells, Keys) spawn at 70 and 170 dots eaten.
* **Cabinet UI & Sound Controls**: Retro CRT scanline effect, glowing neon accents, live scoreboard with High Score persistence (`localStorage`), Pause/Resume, Mute toggle, and virtual on-screen touch D-Pad / swipe gestures for mobile and tablet play.

---

## 🎮 Controls

| Action | Keyboard | Touch / Mobile |
| :--- | :--- | :--- |
| **Move Up** | <kbd>↑</kbd> or <kbd>W</kbd> | Tap ▲ or Swipe Up |
| **Move Down** | <kbd>↓</kbd> or <kbd>S</kbd> | Tap ▼ or Swipe Down |
| **Move Left** | <kbd>←</kbd> or <kbd>A</kbd> | Tap ◀ or Swipe Left |
| **Move Right** | <kbd>→</kbd> or <kbd>D</kbd> | Tap ▶ or Swipe Right |
| **Pause / Resume** | <kbd>P</kbd> or <kbd>Space</kbd> | Header "PAUSE" button |
| **Mute / Unmute** | <kbd>M</kbd> | Header "SOUND" button |
| **Restart Game** | <kbd>R</kbd> | Game Over modal button |

---

## 📁 File Structure

```text
pacman/
├── index.html     # Arcade cabinet markup, scoreboard, canvas, overlays, and virtual D-pad
├── style.css      # Retro arcade styling, CRT overlay, glowing neon themes, and responsive design
├── screens.js     # Screen & modal manager (Start, Pause, Game Over, Level Clear, HUD)
├── pacman.js      # Game engine, ghost AI, map rendering, Web Audio synthesis, and state machine
└── README.md      # Game documentation and architecture guide
```

---

## 🚀 How to Run

Simply open `pacman/index.html` in any modern web browser (Google Chrome, Microsoft Edge, Firefox, Safari). No web server or build step is required!
