(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const statusLine = document.getElementById("status-line");
  const startBtn = document.getElementById("start-btn");
  const autoBtn = document.getElementById("auto-btn");
  const resetBtn = document.getElementById("reset-btn");

  const GRID = 10;
  const CELL = 22;
  const SHIPS = [5, 4, 3, 3, 2];
  const PLAYER_ORIGIN = { x: 120, y: 480, z: 0 };
  const ENEMY_ORIGIN = { x: 620, y: 260, z: 0 };
  const CAMERA = { pitch: 0.88, yaw: 0.84, scale: 4.25 };

  let mouse = { x: -1, y: -1 };
  let playerHover = null;
  let enemyHover = null;
  let lastTs = 0;

  const state = {
    mode: "placing",
    rotatePlacement: false,
    playerBoard: createBoard(),
    enemyBoard: createBoard(),
    placementIndex: 0,
    playerShots: 0,
    aiShots: 0,
    winner: null,
    message: "",
  };

  randomPlaceShips(state.enemyBoard, SHIPS);
  updateStatus("Place ship length 5 on your board (left). Press R to rotate or A to auto-place.");

  function createBoard() {
    const grid = [];
    for (let y = 0; y < GRID; y += 1) {
      const row = [];
      for (let x = 0; x < GRID; x += 1) {
        row.push({ hasShip: false, hit: false, miss: false, shipId: -1 });
      }
      grid.push(row);
    }
    return {
      grid,
      ships: [],
      remaining: 0,
    };
  }

  function cloneVec(v) {
    return { x: v.x, y: v.y, z: v.z };
  }

  function project(world) {
    const px = world.x - world.y;
    const py = (world.x + world.y) * 0.5;
    return {
      x: px * CAMERA.yaw + canvas.width / 2,
      y: py * CAMERA.pitch - world.z * CAMERA.scale,
    };
  }

  function boardToWorld(origin, x, y, z = 0) {
    return {
      x: origin.x + x * CELL,
      y: origin.y - y * CELL,
      z: origin.z + z,
    };
  }

  function drawPrism(origin, gx, gy, h, fillTop, fillSide, stroke) {
    const a = project(boardToWorld(origin, gx, gy, h));
    const b = project(boardToWorld(origin, gx + 1, gy, h));
    const c = project(boardToWorld(origin, gx + 1, gy + 1, h));
    const d = project(boardToWorld(origin, gx, gy + 1, h));

    const a0 = project(boardToWorld(origin, gx, gy, 0));
    const b0 = project(boardToWorld(origin, gx + 1, gy, 0));
    const c0 = project(boardToWorld(origin, gx + 1, gy + 1, 0));
    const d0 = project(boardToWorld(origin, gx, gy + 1, 0));

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1;

    ctx.fillStyle = fillSide;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c0.x, c0.y);
    ctx.lineTo(d0.x, d0.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b0.x, b0.y);
    ctx.lineTo(c0.x, c0.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = fillTop;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    return [a, b, c, d];
  }

  function drawGrid(origin, board, revealShips, hoverCell, title) {
    const base = drawPrism(origin, 0, 0, 4, "rgba(21,81,165,0.8)", "rgba(20,58,130,0.95)", "rgba(196,228,255,0.55)");

    ctx.fillStyle = "rgba(230,244,255,0.95)";
    ctx.font = "700 18px Trebuchet MS";
    const labelPos = base[0];
    ctx.fillText(title, labelPos.x - 22, labelPos.y - 18);

    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const cell = board.grid[y][x];
        let topColor = "rgba(91,168,237,0.92)";
        let sideColor = "rgba(47,111,188,0.95)";

        if (hoverCell && hoverCell.x === x && hoverCell.y === y) {
          topColor = "rgba(251,227,103,0.95)";
          sideColor = "rgba(193,159,25,0.95)";
        }
        if (revealShips && cell.hasShip && !cell.hit) {
          topColor = "rgba(91,214,170,0.95)";
          sideColor = "rgba(43,157,118,0.95)";
        }
        if (cell.miss) {
          topColor = "rgba(232,239,248,0.97)";
          sideColor = "rgba(167,181,201,0.95)";
        }
        if (cell.hit) {
          topColor = "rgba(250,117,94,0.97)";
          sideColor = "rgba(185,55,33,0.95)";
        }

        drawPrism(origin, x, y, 8, topColor, sideColor, "rgba(18,36,70,0.35)");
      }
    }
  }

  function drawPlacementGhost() {
    if (state.mode !== "placing" || !playerHover) return;
    const len = SHIPS[state.placementIndex];
    if (!len) return;
    const cells = [];
    for (let i = 0; i < len; i += 1) {
      const x = playerHover.x + (state.rotatePlacement ? i : 0);
      const y = playerHover.y + (state.rotatePlacement ? 0 : i);
      if (x >= GRID || y >= GRID) return;
      cells.push({ x, y });
    }
    const valid = cells.every((pt) => !state.playerBoard.grid[pt.y][pt.x].hasShip);
    const topColor = valid ? "rgba(109,238,198,0.86)" : "rgba(251,96,96,0.86)";
    const sideColor = valid ? "rgba(46,157,124,0.88)" : "rgba(173,45,45,0.88)";
    cells.forEach((pt) => {
      drawPrism(PLAYER_ORIGIN, pt.x, pt.y, 13, topColor, sideColor, "rgba(20,20,20,0.28)");
    });
  }

  function placeShip(board, x, y, len, horizontal) {
    const coords = [];
    for (let i = 0; i < len; i += 1) {
      const cx = x + (horizontal ? i : 0);
      const cy = y + (horizontal ? 0 : i);
      if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return false;
      if (board.grid[cy][cx].hasShip) return false;
      coords.push({ x: cx, y: cy });
    }
    const shipId = board.ships.length;
    board.ships.push({ len, hits: 0, coords });
    coords.forEach((pt) => {
      const cell = board.grid[pt.y][pt.x];
      cell.hasShip = true;
      cell.shipId = shipId;
    });
    board.remaining += len;
    return true;
  }

  function randomPlaceShips(board, ships) {
    ships.forEach((len) => {
      let placed = false;
      while (!placed) {
        const horizontal = Math.random() > 0.5;
        const x = Math.floor(Math.random() * GRID);
        const y = Math.floor(Math.random() * GRID);
        placed = placeShip(board, x, y, len, horizontal);
      }
    });
  }

  function fireAt(board, x, y) {
    const cell = board.grid[y][x];
    if (cell.hit || cell.miss) return { ok: false, msg: "Already targeted." };

    if (cell.hasShip) {
      cell.hit = true;
      const ship = board.ships[cell.shipId];
      ship.hits += 1;
      board.remaining -= 1;
      const sunk = ship.hits === ship.len;
      return { ok: true, hit: true, sunk };
    }

    cell.miss = true;
    return { ok: true, hit: false, sunk: false };
  }

  function updateStatus(msg) {
    state.message = msg;
    statusLine.textContent = msg;
  }

  function syncCanvasSize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const targetWidth = Math.max(960, Math.round(rect.width * ratio));
    const targetHeight = Math.max(620, Math.round(rect.height * ratio));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }

  function maybeStartBattle() {
    if (state.placementIndex < SHIPS.length) {
      updateStatus(`Place all ships first. Next length: ${SHIPS[state.placementIndex]}.`);
      return;
    }
    state.mode = "battle";
    startBtn.disabled = true;
    updateStatus("Battle started. Fire on the right board.");
  }

  function resetGame() {
    state.mode = "placing";
    state.rotatePlacement = false;
    state.playerBoard = createBoard();
    state.enemyBoard = createBoard();
    state.placementIndex = 0;
    state.playerShots = 0;
    state.aiShots = 0;
    state.winner = null;
    randomPlaceShips(state.enemyBoard, SHIPS);
    startBtn.disabled = false;
    updateStatus("Place ship length 5 on your board (left). Press R to rotate or A to auto-place.");
  }

  function autoPlacePlayerFleet() {
    if (state.mode !== "placing") return;
    state.playerBoard = createBoard();
    state.placementIndex = 0;
    randomPlaceShips(state.playerBoard, SHIPS);
    state.placementIndex = SHIPS.length;
    updateStatus("Fleet auto-placed. Click Start Battle or press Enter.");
  }

  function aiTurn() {
    if (state.mode !== "battle") return;
    let resolved = false;
    while (!resolved) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      const result = fireAt(state.playerBoard, x, y);
      if (!result.ok) continue;
      state.aiShots += 1;
      if (result.hit) {
        const suffix = result.sunk ? " AI sunk one of your ships." : " AI hit your ship.";
        updateStatus(`Enemy fired at (${x},${y}).${suffix}`);
      } else {
        updateStatus(`Enemy fired at (${x},${y}) and missed.`);
      }
      resolved = true;
    }

    if (state.playerBoard.remaining <= 0) {
      state.mode = "gameover";
      state.winner = "enemy";
      updateStatus("Defeat. All your ships were sunk. Press Reset to retry.");
    }
  }

  function randomUntargetedCell(board) {
    const candidates = [];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const cell = board.grid[y][x];
        if (!cell.hit && !cell.miss) candidates.push({ x, y });
      }
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function playerFireAt(x, y) {
    const result = fireAt(state.enemyBoard, x, y);
    if (!result.ok) {
      updateStatus("You already fired there.");
      return;
    }

    state.playerShots += 1;
    if (result.hit) {
      updateStatus(result.sunk ? "Direct hit. Enemy ship sunk." : "Direct hit.");
    } else {
      updateStatus("Miss.");
    }

    if (state.enemyBoard.remaining <= 0) {
      state.mode = "gameover";
      state.winner = "player";
      updateStatus("Victory. Enemy fleet destroyed.");
      return;
    }

    aiTurn();
  }

  function boardPick(origin, px, py) {
    for (let y = GRID - 1; y >= 0; y -= 1) {
      for (let x = GRID - 1; x >= 0; x -= 1) {
        const top = [
          project(boardToWorld(origin, x, y, 8)),
          project(boardToWorld(origin, x + 1, y, 8)),
          project(boardToWorld(origin, x + 1, y + 1, 8)),
          project(boardToWorld(origin, x, y + 1, 8)),
        ];
        if (pointInQuad(px, py, top)) {
          return { x, y };
        }
      }
    }
    return null;
  }

  function sign(px, py, ax, ay, bx, by) {
    return (px - bx) * (ay - by) - (ax - bx) * (py - by);
  }

  function pointInTri(px, py, a, b, c) {
    const d1 = sign(px, py, a.x, a.y, b.x, b.y);
    const d2 = sign(px, py, b.x, b.y, c.x, c.y);
    const d3 = sign(px, py, c.x, c.y, a.x, a.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function pointInQuad(px, py, q) {
    return pointInTri(px, py, q[0], q[1], q[2]) || pointInTri(px, py, q[0], q[2], q[3]);
  }

  function onCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((event.clientY - rect.top) / rect.height) * canvas.height;

    if (state.mode === "placing") {
      const pick = boardPick(PLAYER_ORIGIN, px, py);
      if (!pick) return;
      const len = SHIPS[state.placementIndex];
      const ok = placeShip(state.playerBoard, pick.x, pick.y, len, state.rotatePlacement);
      if (!ok) {
        updateStatus(`Cannot place ship length ${len} there.`);
        return;
      }
      state.placementIndex += 1;
      if (state.placementIndex < SHIPS.length) {
        updateStatus(
          `Placed. Next ship length ${SHIPS[state.placementIndex]} (${state.rotatePlacement ? "horizontal" : "vertical"}).`
        );
      } else {
        updateStatus("Fleet ready. Click Start Battle.");
      }
      return;
    }

    if (state.mode !== "battle") return;

    const pick = boardPick(ENEMY_ORIGIN, px, py);
    if (!pick) return;

    playerFireAt(pick.x, pick.y);
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#8fd5ff");
    gradient.addColorStop(0.42, "#3a8bd4");
    gradient.addColorStop(1, "#12356c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 15; i += 1) {
      const x = (i * 137) % canvas.width;
      const y = 40 + ((i * 91) % 120);
      const radius = 34 + (i % 5) * 8;
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud() {
    ctx.fillStyle = "rgba(10,20,46,0.6)";
    ctx.fillRect(16, 14, 390, 72);
    ctx.strokeStyle = "rgba(221,238,255,0.42)";
    ctx.strokeRect(16, 14, 390, 72);

    ctx.fillStyle = "#ebf6ff";
    ctx.font = "600 15px Trebuchet MS";
    ctx.fillText(`Mode: ${state.mode}`, 28, 38);
    ctx.fillText(`Shots | You: ${state.playerShots}  AI: ${state.aiShots}`, 28, 58);
    const next = state.placementIndex < SHIPS.length ? SHIPS[state.placementIndex] : "none";
    ctx.fillText(`Next ship: ${next}`, 28, 78);

    ctx.fillStyle = "rgba(10,20,46,0.58)";
    ctx.fillRect(canvas.width - 306, 14, 290, 72);
    ctx.strokeStyle = "rgba(221,238,255,0.4)";
    ctx.strokeRect(canvas.width - 306, 14, 290, 72);

    ctx.fillStyle = "#f2f8ff";
    ctx.fillText("Controls: Click cells | R rotate", canvas.width - 292, 38);
    ctx.fillText("A auto-place | Space fire", canvas.width - 292, 58);
    ctx.fillText(`Orientation: ${state.rotatePlacement ? "Horizontal" : "Vertical"}`, canvas.width - 292, 78);
  }

  function render() {
    drawBackground();

    playerHover = boardPick(PLAYER_ORIGIN, mouse.x, mouse.y);
    enemyHover = boardPick(ENEMY_ORIGIN, mouse.x, mouse.y);

    drawGrid(PLAYER_ORIGIN, state.playerBoard, true, state.mode === "placing" ? playerHover : null, "Your Fleet");
    drawGrid(ENEMY_ORIGIN, state.enemyBoard, state.mode === "gameover" && state.winner === "enemy", state.mode === "battle" ? enemyHover : null, "Enemy Waters");

    drawPlacementGhost();
    drawHud();
  }

  function update() {}

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;
    update(dt / 1000);
    render();
    requestAnimationFrame(frame);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r" && state.mode === "placing") {
      state.rotatePlacement = !state.rotatePlacement;
      updateStatus(`Rotation: ${state.rotatePlacement ? "horizontal" : "vertical"}.`);
    }
    if (event.key === "Enter" && state.mode === "placing" && state.placementIndex >= SHIPS.length) {
      maybeStartBattle();
    }
    if (event.key === " " && state.mode === "battle") {
      event.preventDefault();
      const target = randomUntargetedCell(state.enemyBoard);
      if (target) playerFireAt(target.x, target.y);
    }
    if (event.key.toLowerCase() === "a" && state.mode === "placing") {
      autoPlacePlayerFleet();
    }
    if (event.key.toLowerCase() === "f") {
      toggleFullscreen();
    }
  });

  startBtn.addEventListener("click", maybeStartBattle);
  autoBtn.addEventListener("click", autoPlacePlayerFleet);
  resetBtn.addEventListener("click", resetGame);
  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("mousemove", onPointerMove);

  window.addEventListener("resize", () => {
    syncCanvasSize();
    render();
  });

  window.render_game_to_text = () => {
    const payload = {
      coordinate_system: "Grid coordinates: origin=(0,0) at each board near viewer-left edge, x right, y away/up board.",
      mode: state.mode,
      message: state.message,
      placement: {
        next_ship_length: state.placementIndex < SHIPS.length ? SHIPS[state.placementIndex] : null,
        orientation: state.rotatePlacement ? "horizontal" : "vertical",
      },
      player: summarizeBoard(state.playerBoard),
      enemy: summarizeBoard(state.enemyBoard, false),
      shots: { player: state.playerShots, ai: state.aiShots },
      winner: state.winner,
    };
    return JSON.stringify(payload);
  };

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      update(1 / 60);
    }
    render();
  };

  function summarizeBoard(board, reveal = true) {
    const ships = board.ships.map((ship) => ({
      len: ship.len,
      hits: ship.hits,
      cells: reveal ? ship.coords : undefined,
    }));
    const hits = [];
    const misses = [];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const cell = board.grid[y][x];
        if (cell.hit) hits.push({ x, y });
        if (cell.miss) misses.push({ x, y });
      }
    }
    return {
      remaining_health: board.remaining,
      ships,
      hit_cells: hits,
      miss_cells: misses,
    };
  }

  syncCanvasSize();
  requestAnimationFrame(frame);
})();
