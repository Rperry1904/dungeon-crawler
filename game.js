/* ============================================================
   Dungeon Crawler — 10 levels, randomized grids, retro emoji
   ============================================================ */

(function () {
  'use strict';

  // ---------- Level configuration ----------
  // Each level: random grid in [minGrid, maxGrid], `time` seconds, `gems` valuables,
  // and `wallDensity` controls how cluttered the dungeon is.
  const LEVELS = [
    { minGrid: 8,  maxGrid: 9,  time: 45, gems: 4,  wallDensity: 0.22 },
    { minGrid: 9,  maxGrid: 10, time: 50, gems: 5,  wallDensity: 0.24 },
    { minGrid: 10, maxGrid: 11, time: 55, gems: 6,  wallDensity: 0.26 },
    { minGrid: 11, maxGrid: 12, time: 60, gems: 7,  wallDensity: 0.28 },
    { minGrid: 12, maxGrid: 13, time: 65, gems: 8,  wallDensity: 0.30 },
    { minGrid: 13, maxGrid: 14, time: 70, gems: 9,  wallDensity: 0.32 },
    { minGrid: 14, maxGrid: 15, time: 75, gems: 10, wallDensity: 0.34 },
    { minGrid: 15, maxGrid: 16, time: 80, gems: 11, wallDensity: 0.36 },
    { minGrid: 16, maxGrid: 17, time: 85, gems: 12, wallDensity: 0.38 },
    { minGrid: 17, maxGrid: 19, time: 90, gems: 15, wallDensity: 0.40 },
  ];

  const ICONS = {
    player: '🧙',
    gem: '💎',
    exit: '🚪',
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const board    = $('board');
  const hudLevel = $('hud-level');
  const hudGems  = $('hud-gems');
  const hudScore = $('hud-score');
  const hudTime  = $('hud-time');
  const overlay  = $('overlay');

  // ---------- Game state ----------
  const state = {
    levelIndex: 0,   // 0..9
    score: 0,
    gemsCollected: 0,
    gemsTotal: 0,
    timeLeft: 0,
    timerId: null,
    lastTick: 0,
    running: false,
    grid: null,      // 2D array: 0 floor, 1 wall, 2 gem, 3 exit
    size: 0,
    player: { r: 0, c: 0 },
    cellEls: [],
  };

  // ---------- Utility ----------
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function neighbors(r, c, size) {
    const out = [];
    if (r > 0)        out.push([r - 1, c]);
    if (r < size - 1) out.push([r + 1, c]);
    if (c > 0)        out.push([r, c - 1]);
    if (c < size - 1) out.push([r, c + 1]);
    return out;
  }

  // BFS reachability check from (sr,sc) — returns set of "r,c" keys reachable.
  function reachable(grid, sr, sc) {
    const size = grid.length;
    const seen = new Set();
    const key = (r, c) => r + ',' + c;
    const queue = [[sr, sc]];
    seen.add(key(sr, sc));
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of neighbors(r, c, size)) {
        if (grid[nr][nc] === 1) continue; // wall
        const k = key(nr, nc);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nr, nc]);
      }
    }
    return seen;
  }

  // ---------- Dungeon generation ----------
  // Strategy: random walls (with border buffer) -> ensure player start, exit, and
  // every gem are all reachable. Regenerate if not. Cap attempts to be safe.
  function generateDungeon(level) {
    const size = rand(level.minGrid, level.maxGrid);
    const totalCells = size * size;
    const targetGems = Math.min(level.gems, Math.floor(totalCells * 0.15));

    for (let attempt = 0; attempt < 80; attempt++) {
      // 1. Initialize all floors
      const grid = Array.from({ length: size }, () => Array(size).fill(0));

      // 2. Sprinkle walls (skip the start corner immediately around player)
      const startR = 0, startC = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (r === startR && c === startC) continue;
          if (Math.abs(r - startR) + Math.abs(c - startC) <= 1) continue; // keep start clear
          if (Math.random() < level.wallDensity) grid[r][c] = 1;
        }
      }

      // 3. Pick an exit far from the start (prefer the opposite corner area)
      const reachSet = reachable(grid, startR, startC);
      const reachable_cells = [...reachSet].map((k) => k.split(',').map(Number));
      if (reachable_cells.length < targetGems + 2) continue;

      // Sort reachable cells by distance from start (Manhattan), put exit far away
      reachable_cells.sort((a, b) => {
        const da = Math.abs(a[0] - startR) + Math.abs(a[1] - startC);
        const db = Math.abs(b[0] - startR) + Math.abs(b[1] - startC);
        return db - da;
      });
      const [exitR, exitC] = reachable_cells[0];
      grid[exitR][exitC] = 3;

      // 4. Place gems on reachable cells (random, but not on start or exit)
      const candidatePool = reachable_cells
        .slice(1) // drop the exit cell
        .filter(([r, c]) => !(r === startR && c === startC));
      if (candidatePool.length < targetGems) continue;

      // Shuffle and pick gems
      for (let i = candidatePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
      }
      for (let i = 0; i < targetGems; i++) {
        const [r, c] = candidatePool[i];
        grid[r][c] = 2;
      }

      return { size, grid, start: { r: startR, c: startC }, gemCount: targetGems };
    }

    // Fallback: open grid with diagonal gems if random gen kept failing.
    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    grid[size - 1][size - 1] = 3;
    let placed = 0;
    for (let i = 1; i < size - 1 && placed < targetGems; i++) {
      grid[i][i] = 2;
      placed++;
    }
    return { size, grid, start: { r: 0, c: 0 }, gemCount: placed };
  }

  // ---------- Rendering ----------
  function renderBoard() {
    const size = state.size;
    board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    board.style.gridTemplateRows    = `repeat(${size}, 1fr)`;
    board.innerHTML = '';
    state.cellEls = [];

    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const div = document.createElement('div');
        div.className = 'cell';
        div.dataset.r = r;
        div.dataset.c = c;
        board.appendChild(div);
        row.push(div);
      }
      state.cellEls.push(row);
    }
    paintAllCells();
  }

  function paintAllCells() {
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        paintCell(r, c);
      }
    }
  }

  function paintCell(r, c) {
    const el = state.cellEls[r][c];
    if (!el) return;
    const v = state.grid[r][c];
    el.className = 'cell';
    el.removeAttribute('data-icon');

    if (state.player.r === r && state.player.c === c) {
      el.classList.add('player');
      el.setAttribute('data-icon', ICONS.player);
      return;
    }
    switch (v) {
      case 0: el.classList.add('floor'); break;
      case 1: el.classList.add('wall');  break;
      case 2:
        el.classList.add('gem');
        el.setAttribute('data-icon', ICONS.gem);
        break;
      case 3:
        el.classList.add('exit');
        el.setAttribute('data-icon', ICONS.exit);
        break;
    }
  }

  function flashCell(r, c) {
    const el = state.cellEls[r] && state.cellEls[r][c];
    if (!el) return;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 350);
  }

  // ---------- HUD ----------
  function updateHud() {
    hudLevel.innerHTML = `${state.levelIndex + 1}<span class="hud-sub">/10</span>`;
    hudGems.innerHTML  = `${state.gemsCollected}<span class="hud-sub">/${state.gemsTotal}</span>`;
    hudScore.textContent = state.score;
    hudTime.textContent = state.timeLeft.toFixed(0);
    if (state.timeLeft <= 10) hudTime.classList.add('danger');
    else hudTime.classList.remove('danger');
  }

  // ---------- Level lifecycle ----------
  function startLevel(idx) {
    state.levelIndex = idx;
    const level = LEVELS[idx];
    const dungeon = generateDungeon(level);

    state.size = dungeon.size;
    state.grid = dungeon.grid;
    state.player = { ...dungeon.start };
    state.gemsCollected = 0;
    state.gemsTotal = dungeon.gemCount;
    state.timeLeft = level.time;
    state.running = true;

    renderBoard();
    updateHud();
    hideOverlay();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    state.lastTick = performance.now();
    state.timerId = requestAnimationFrame(tick);
  }

  function stopTimer() {
    if (state.timerId) cancelAnimationFrame(state.timerId);
    state.timerId = null;
  }

  function tick(now) {
    if (!state.running) return;
    const dt = (now - state.lastTick) / 1000;
    state.lastTick = now;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    updateHud();
    if (state.timeLeft <= 0) {
      gameOver(false);
      return;
    }
    state.timerId = requestAnimationFrame(tick);
  }

  function completeLevel() {
    state.running = false;
    stopTimer();
    const level = LEVELS[state.levelIndex];
    const timeBonus = Math.round(state.timeLeft * 2);
    const levelBonus = 50;
    state.score += timeBonus + levelBonus;

    const isFinal = state.levelIndex >= LEVELS.length - 1;
    if (isFinal) {
      showVictory(timeBonus, levelBonus);
    } else {
      showLevelComplete(timeBonus, levelBonus);
    }
  }

  function gameOver(playerEscaped) {
    state.running = false;
    stopTimer();
    showGameOver(playerEscaped);
  }

  function resetGame() {
    state.score = 0;
    state.levelIndex = 0;
  }

  // ---------- Overlays ----------
  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function showOverlay(html) {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="overlay-card">${html}</div>`;
    const btn = overlay.querySelector('.btn-primary');
    if (btn) btn.focus();
  }

  function showLevelComplete(timeBonus, levelBonus) {
    showOverlay(`
      <h1 class="title">LEVEL ${state.levelIndex + 1}<br/>CLEAR</h1>
      <div class="summary">
        <div class="stat-row"><span class="label">Gems collected</span><span class="value">${state.gemsCollected} / ${state.gemsTotal}</span></div>
        <div class="stat-row"><span class="label">Time bonus</span><span class="value">+${timeBonus}</span></div>
        <div class="stat-row"><span class="label">Level bonus</span><span class="value">+${levelBonus}</span></div>
        <div class="stat-row"><span class="label">Total score</span><span class="value">${state.score}</span></div>
      </div>
      <button class="btn-primary" id="btn-next">NEXT LEVEL</button>
    `);
    overlay.querySelector('#btn-next').addEventListener('click', () => {
      startLevel(state.levelIndex + 1);
    });
  }

  function showVictory(timeBonus, levelBonus) {
    showOverlay(`
      <h1 class="title">VICTORY!</h1>
      <p class="subtitle">You escaped all 10 dungeons.</p>
      <div class="summary">
        <div class="stat-row"><span class="label">Final gems</span><span class="value">${state.gemsCollected} / ${state.gemsTotal}</span></div>
        <div class="stat-row"><span class="label">Time bonus</span><span class="value">+${timeBonus}</span></div>
        <div class="stat-row"><span class="label">Level bonus</span><span class="value">+${levelBonus}</span></div>
        <div class="stat-row"><span class="label">FINAL SCORE</span><span class="value">${state.score}</span></div>
      </div>
      <button class="btn-primary" id="btn-restart">PLAY AGAIN</button>
    `);
    overlay.querySelector('#btn-restart').addEventListener('click', () => {
      resetGame();
      startLevel(0);
    });
  }

  function showGameOver() {
    showOverlay(`
      <h1 class="title">TIME'S UP</h1>
      <p class="subtitle">The dungeon claims another soul.</p>
      <div class="summary">
        <div class="stat-row"><span class="label">Reached</span><span class="value">Level ${state.levelIndex + 1}</span></div>
        <div class="stat-row"><span class="label">Gems</span><span class="value">${state.gemsCollected} / ${state.gemsTotal}</span></div>
        <div class="stat-row"><span class="label">Final score</span><span class="value">${state.score}</span></div>
      </div>
      <button class="btn-primary" id="btn-restart">TRY AGAIN</button>
    `);
    overlay.querySelector('#btn-restart').addEventListener('click', () => {
      resetGame();
      startLevel(0);
    });
  }

  // ---------- Movement ----------
  const DIR = {
    up:    [-1, 0],
    down:  [ 1, 0],
    left:  [ 0,-1],
    right: [ 0, 1],
  };

  function move(dir) {
    if (!state.running) return;
    const [dr, dc] = DIR[dir] || [0, 0];
    const nr = state.player.r + dr;
    const nc = state.player.c + dc;
    if (nr < 0 || nc < 0 || nr >= state.size || nc >= state.size) return;
    if (state.grid[nr][nc] === 1) return; // wall

    const prev = { r: state.player.r, c: state.player.c };
    state.player.r = nr;
    state.player.c = nc;

    // Tile effects
    const tile = state.grid[nr][nc];
    if (tile === 2) {
      state.grid[nr][nc] = 0;
      state.gemsCollected++;
      state.score += 10;
      flashCell(nr, nc);
    }

    paintCell(prev.r, prev.c);
    paintCell(nr, nc);
    updateHud();

    if (tile === 3) {
      completeLevel();
    }
  }

  // ---------- Input ----------
  function bindInput() {
    // D-pad: pointer events cover both mouse and touch.
    document.querySelectorAll('.dpad-btn[data-dir]').forEach((btn) => {
      const dir = btn.dataset.dir;
      let repeatId = null;
      const start = (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        move(dir);
        // Hold-to-repeat after a brief delay
        clearTimeout(repeatId);
        repeatId = setTimeout(function repeat() {
          if (!btn.classList.contains('pressed')) return;
          move(dir);
          repeatId = setTimeout(repeat, 110);
        }, 220);
      };
      const end = () => {
        btn.classList.remove('pressed');
        clearTimeout(repeatId);
      };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointerleave', end);
      btn.addEventListener('pointercancel', end);
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      let dir = null;
      if (key === 'arrowup' || key === 'w') dir = 'up';
      else if (key === 'arrowdown' || key === 's') dir = 'down';
      else if (key === 'arrowleft' || key === 'a') dir = 'left';
      else if (key === 'arrowright' || key === 'd') dir = 'right';
      if (dir) { e.preventDefault(); move(dir); }
    });

    // Start button (initial overlay)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-primary') {
        resetGame();
        startLevel(0);
      }
    });

    // Prevent scroll bounce on iOS when dragging on the game
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('.dpad') || e.target.closest('.board')) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  // ---------- Boot ----------
  function init() {
    bindInput();
    // The initial overlay (defined in index.html) handles the START button.
  }

  // Expose a small testing hook so headless tests can validate dungeon gen.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateDungeon, reachable, LEVELS };
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
