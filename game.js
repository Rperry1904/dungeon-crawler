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

  const ICONS = {
    player:  '\u{1F9D9}',  // 🧙 mage
    gem:     '\u{1F48E}',  // 💎
    exit:    '\u{1F6AA}',  // 🚪
    monster: '\u{1F47B}',  // 👻 ghost
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
    monsters: [],          // [{ r, c }] — start showing at level 4
    monsterTickCounter: 0, // counts player moves; ghosts step when it hits the interval
  };

  function sightRadiusForLevel(levelIndex) {
    if (levelIndex <= 2) return 3;
    if (levelIndex <= 6) return 2;
    return 1;
  }

  // Monsters appear at level 4 and scale up.
  function monsterCountForLevel(levelIndex) {
    if (levelIndex <= 2) return 0;   // Levels 1-3: peaceful
    if (levelIndex <= 5) return 1;   // Levels 4-6: one ghost
    if (levelIndex <= 7) return 2;   // Levels 7-8: two ghosts
    return 3;                        // Levels 9-10: three ghosts
  }

  // How many player moves between each ghost step. Higher = slower ghosts,
  // giving you breathing room to pause and collect gems.
  function monsterStepIntervalForLevel(levelIndex) {
    return 2;  // tune per level later if endgame needs more bite
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

  // BFS from (sr,sc).
  //   blockExit=false (default): walls block; everything else is passable
  //     (used during initial dungeon layout, when there's no exit yet).
  //   blockExit=true: the exit tile is a destination you can step onto but
  //     cannot transit through -- matches in-game movement, since stepping on
  //     the exit ends the level. Use this when verifying gem reachability so
  //     we never ship a level with a gem hidden behind the exit door.
  function reachable(grid, sr, sc, blockExit) {
    const size = grid.length;
    const seen = new Set();
    const key = (r, c) => r + ',' + c;
    const queue = [[sr, sc]];
    seen.add(key(sr, sc));
    while (queue.length) {
      const [r, c] = queue.shift();
      // If standing on the exit (and we're not allowed to transit through it),
      // don't expand neighbors. The exit itself stays in `seen` as a reachable
      // destination.
      if (blockExit && grid[r][c] === 3 && !(r === sr && c === sc)) continue;
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

      // Defensive: re-verify reachability on the FINAL grid, treating the exit
      // as terminal (you can step onto it, but stepping on it ends the level,
      // so you cannot transit through it). This catches the case where a gem
      // ends up tucked behind the exit door with no other path in.
      const finalReach = reachable(grid, startR, startC, true);
      let allReachable = finalReach.has(exitR + ',' + exitC);
      if (allReachable) {
        for (let r = 0; r < size && allReachable; r++) {
          for (let c = 0; c < size && allReachable; c++) {
            if (grid[r][c] === 2 && !finalReach.has(r + ',' + c)) {
              allReachable = false;
            }
          }
        }
      }
      if (!allReachable) continue;

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

  // ---------- Monsters ----------
  // BFS from a source cell -> 2D array of distances (Infinity for unreachable).
  function bfsDistances(grid, sr, sc) {
    const size = grid.length;
    const dist = Array.from({ length: size }, () => Array(size).fill(Infinity));
    dist[sr][sc] = 0;
    const queue = [[sr, sc]];
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of neighbors(r, c, size)) {
        if (grid[nr][nc] === 1) continue;
        if (dist[nr][nc] === Infinity) {
          dist[nr][nc] = dist[r][c] + 1;
          queue.push([nr, nc]);
        }
      }
    }
    return dist;
  }

  // Place `count` monsters on reachable floor cells (not gems/exit), keeping
  // them at least `minDistance` Manhattan steps from the player so the level
  // doesn't open with an instant death.
  function spawnMonsters(grid, size, playerR, playerC, count) {
    if (count <= 0) return [];
    const minDistance = Math.max(4, Math.floor(size / 2));
    const candidates = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== 0) continue; // floor only -- not walls, gems, or exit
        const d = Math.abs(r - playerR) + Math.abs(c - playerC);
        if (d < minDistance) continue;
        candidates.push({ r, c });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, Math.min(count, candidates.length));
  }

  // Each monster steps onto the neighbor that brings it closest to the player.
  // Monsters won't pile up on the same tile (except the player's tile, which is
  // game over). If a monster has no improving move, it stays put.
  function moveMonsters() {
    if (state.monsters.length === 0) return;
    const dist = bfsDistances(state.grid, state.player.r, state.player.c);
    const occupied = new Set(state.monsters.map((m) => m.r + ',' + m.c));

    for (const m of state.monsters) {
      const current = dist[m.r][m.c];
      let bestCell = null;
      let bestDist = current;

      for (const [nr, nc] of neighbors(m.r, m.c, state.size)) {
        if (state.grid[nr][nc] === 1) continue;
        if (dist[nr][nc] === Infinity) continue;
        const isPlayer = nr === state.player.r && nc === state.player.c;
        const blockedByOther = occupied.has(nr + ',' + nc) && !isPlayer;
        if (blockedByOther) continue;
        if (dist[nr][nc] < bestDist) {
          bestDist = dist[nr][nc];
          bestCell = { r: nr, c: nc };
        }
      }

      if (bestCell) {
        occupied.delete(m.r + ',' + m.c);
        m.r = bestCell.r;
        m.c = bestCell.c;
        occupied.add(m.r + ',' + m.c);
      }
    }
  }

  // Returns true if any monster shares the player's tile.
  function monsterOnPlayer() {
    return state.monsters.some((m) => m.r === state.player.r && m.c === state.player.c);
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

    // Monsters are only drawn when currently in sight (not in memory) -- you
    // can't track a ghost through the fog.
    if (isVisible) {
      for (const m of state.monsters) {
        if (m.r === r && m.c === c) {
          el.classList.add('monster');
          el.setAttribute('data-icon', ICONS.monster);
          return;
        }
      }
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

    // Spawn monsters (zero on early levels). They live in their own array,
    // not in the dungeon grid, so they can stand on floor / gems / exit.
    state.monsters = spawnMonsters(
      state.grid,
      state.size,
      state.player.r,
      state.player.c,
      monsterCountForLevel(idx)
    );
    state.monsterTickCounter = 0;

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
    if (state.timeLeft <= 0) { gameOver('time'); return; }
    state.timerId = requestAnimationFrame(tick);
  }

  function completeLevel() {
    state.running = false;
    stopTimer();
    const timeBonus  = Math.round(state.timeLeft * 2);
    const levelBonus = 50;
    if (state.levelIndex >= LEVELS.length - 1) showVictory(timeBonus, levelBonus);
    else showLevelComplete(timeBonus, levelBonus);
  }

  function gameOver(reason) {
    state.running = false;
    stopTimer();
    showGameOver(reason || 'time');
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

  function showGameOver(reason) {
    const title    = reason === 'caught' ? 'CAUGHT!'        : "TIME'S UP";
    const subtitle = reason === 'caught'
      ? 'A creature found you in the dark.'
      : 'The dungeon claims another soul.';
    showOverlay(`
      <h1 class="title">${title}</h1>
      <p class="subtitle">${subtitle}</p>
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

    // Phase 1: did the player walk INTO a monster?
    if (monsterOnPlayer()) {
      computeVisibility();
      paintAllCells();
      updateHud();
      gameOver('caught');
      return;
    }

    // Phase 2: monsters take their turn -- but only every Nth player move,
    // so you have a fighting chance to dart in for a gem and back out.
    state.monsterTickCounter++;
    if (state.monsterTickCounter >= monsterStepIntervalForLevel(state.levelIndex)) {
      state.monsterTickCounter = 0;
      moveMonsters();

      // Phase 3: did a monster step onto the player?
      if (monsterOnPlayer()) {
        computeVisibility();
        paintAllCells();
        updateHud();
        gameOver('caught');
        return;
      }
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
    module.exports = {
      generateDungeon,
      reachable,
      LEVELS,
      sightRadiusForLevel,
      monsterCountForLevel,
      monsterStepIntervalForLevel,
      bfsDistances,
      spawnMonsters,
    };
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
