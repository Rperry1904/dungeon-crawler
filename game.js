/* ============================================================
   Dungeon Crawler — 10 levels, randomized grids, retro emoji
   ============================================================ */

(function () {
  'use strict';

  // ---------- Level configuration ----------
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

  const ICONS = { player: '\u{1F9D9}', gem: '\u{1F48E}', exit: '\u{1F6AA}' };

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
    levelIndex: 0,
    score: 0,
    gemsCollected: 0,
    gemsTotal: 0,
    timeLeft: 0,
    timerId: null,
    lastTick: 0,
    running: false,
    grid: null,
    size: 0,
    player: { r: 0, c: 0 },
    cellEls: [],
    sightRadius: 2,
    visible: new Set(),
    explored: new Set(),
  };

  function sightRadiusForLevel(levelIndex) {
    if (levelIndex <= 2) return 3;
    if (levelIndex <= 6) return 2;
    return 1;
  }

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

  function reachable(grid, sr, sc) {
    const size = grid.length;
    const seen = new Set();
    const key = (r, c) => r + ',' + c;
    const queue = [[sr, sc]];
    seen.add(key(sr, sc));
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of neighbors(r, c, size)) {
        if (grid[nr][nc] === 1) continue;
        const k = key(nr, nc);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nr, nc]);
      }
    }
    return seen;
  }

  // ---------- Dungeon generation ----------
  function generateDungeon(level) {
    const size = rand(level.minGrid, level.maxGrid);
    const totalCells = size * size;
    const targetGems = Math.min(level.gems, Math.floor(totalCells * 0.15));

    for (let attempt = 0; attempt < 80; attempt++) {
      const grid = Array.from({ length: size }, () => Array(size).fill(0));
      const startR = 0, startC = 0;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (r === startR && c === startC) continue;
          if (Math.abs(r - startR) + Math.abs(c - startC) <= 1) continue;
          if (Math.random() < level.wallDensity) grid[r][c] = 1;
        }
      }

      const reachSet = reachable(grid, startR, startC);
      const reachable_cells = [...reachSet].map((k) => k.split(',').map(Number));
      if (reachable_cells.length < targetGems + 2) continue;

      reachable_cells.sort((a, b) => {
        const da = Math.abs(a[0] - startR) + Math.abs(a[1] - startC);
        const db = Math.abs(b[0] - startR) + Math.abs(b[1] - startC);
        return db - da;
      });
      const [exitR, exitC] = reachable_cells[0];
      grid[exitR][exitC] = 3;

      const candidatePool = reachable_cells
        .slice(1)
        .filter(([r, c]) => !(r === startR && c === startC));
      if (candidatePool.length < targetGems) continue;

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

    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    grid[size - 1][size - 1] = 3;
    let placed = 0;
    for (let i = 1; i < size - 1 && placed < targetGems; i++) {
      grid[i][i] = 2;
      placed++;
    }
    return { size, grid, start: { r: 0, c: 0 }, gemCount: placed };
  }

  // ---------- Fog of war ----------
  function computeVisibility() {
    state.visible = new Set();
    const { r: pr, c: pc } = state.player;
    const R = state.sightRadius;
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        const r = pr + dr;
        const c = pc + dc;
        if (r < 0 || c < 0 || r >= state.size || c >= state.size) continue;
        const key = r + ',' + c;
        state.visible.add(key);
        state.explored.add(key);
      }
    }
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
      for (let c = 0; c < state.size; c++) paintCell(r, c);
    }
  }

  function paintCell(r, c) {
    const el = state.cellEls[r][c];
    if (!el) return;
    const key = r + ',' + c;
    const isVisible  = state.visible.has(key);
    const isExplored = state.explored.has(key);

    el.className = 'cell';
    el.removeAttribute('data-icon');

    if (!isVisible && !isExplored) {
      el.classList.add('fog');
      return;
    }

    if (state.player.r === r && state.player.c === c) {
      el.classList.add('player');
      el.setAttribute('data-icon', ICONS.player);
      return;
    }

    const v = state.grid[r][c];
    switch (v) {
      case 0: el.classList.add('floor'); break;
      case 1: el.classList.add('wall');  break;
      case 2: el.classList.add('gem');  el.setAttribute('data-icon', ICONS.gem);  break;
      case 3: el.classList.add('exit'); el.setAttribute('data-icon', ICONS.exit); break;
    }
    if (!isVisible) el.classList.add('seen');
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
    hudTime.textContent  = state.timeLeft.toFixed(0);
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

    state.sightRadius = sightRadiusForLevel(idx);
    state.explored = new Set();
    state.visible = new Set();
    computeVisibility();

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
    if (state.timeLeft <= 0) { gameOver(); return; }
    state.timerId = requestAnimationFrame(tick);
  }

  function completeLevel() {
    state.running = false;
    stopTimer();
    const timeBonus  = Math.round(state.timeLeft * 2);
    const levelBonus = 50;
    state.score += timeBonus + levelBonus;
    if (state.levelIndex >= LEVELS.length - 1) showVictory(timeBonus, levelBonus);
    else showLevelComplete(timeBonus, levelBonus);
  }

  function gameOver() {
    state.running = false;
    stopTimer();
    showGameOver();
  }

  function resetGame() {
    state.score = 0;
    state.levelIndex = 0;
  }

  // ---------- Overlays ----------
  function hideOverlay() { overlay.classList.add('hidden'); }

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
    overlay.querySelector('#btn-next').addEventListener('click', () => startLevel(state.levelIndex + 1));
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
    overlay.querySelector('#btn-restart').addEventListener('click', () => { resetGame(); startLevel(0); });
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
    overlay.querySelector('#btn-restart').addEventListener('click', () => { resetGame(); startLevel(0); });
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
    if (state.grid[nr][nc] === 1) return;

    state.player.r = nr;
    state.player.c = nc;

    const tile = state.grid[nr][nc];
    if (tile === 2) {
      state.grid[nr][nc] = 0;
      state.gemsCollected++;
      state.score += 10;
      flashCell(nr, nc);
    }

    computeVisibility();
    paintAllCells();
    updateHud();

    if (tile === 3) completeLevel();
  }

  // ---------- Input ----------
  function bindInput() {
    document.querySelectorAll('.dpad-btn[data-dir]').forEach((btn) => {
      const dir = btn.dataset.dir;
      let repeatId = null;
      const start = (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        move(dir);
        clearTimeout(repeatId);
        repeatId = setTimeout(function repeat() {
          if (!btn.classList.contains('pressed')) return;
          move(dir);
          repeatId = setTimeout(repeat, 110);
        }, 220);
      };
      const end = () => { btn.classList.remove('pressed'); clearTimeout(repeatId); };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointerleave', end);
      btn.addEventListener('pointercancel', end);
    });

    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      let dir = null;
      if (key === 'arrowup'    || key === 'w') dir = 'up';
      else if (key === 'arrowdown'  || key === 's') dir = 'down';
      else if (key === 'arrowleft'  || key === 'a') dir = 'left';
      else if (key === 'arrowright' || key === 'd') dir = 'right';
      if (dir) { e.preventDefault(); move(dir); }
    });

    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-primary') { resetGame(); startLevel(0); }
    });

    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('.dpad') || e.target.closest('.board')) e.preventDefault();
    }, { passive: false });
  }

  // ---------- Boot ----------
  function init() { bindInput(); }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateDungeon, reachable, LEVELS, sightRadiusForLevel };
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
