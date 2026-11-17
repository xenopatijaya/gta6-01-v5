// Keyboard and mouse state for SOLMARA. Keys are tracked by their `code` so the
// layout does not matter; the mouse is a drag-to-look orbit (no pointer lock, so
// the game also works in a headless screenshot run) and a click fires the weapon.
export const ACTION = {
  FORWARD: 'KeyW',
  BACK: 'KeyS',
  LEFT: 'KeyA',
  RIGHT: 'KeyD',
  RUN: 'ShiftLeft',
  INTERACT: 'KeyE',
  EXIT: 'KeyF',
  PAUSE: 'KeyP',
  MUTE: 'KeyM',
  RESTART: 'KeyR',
  NEWGAME: 'KeyN',
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last consume
  let lookDX = 0;
  let lookDY = 0;
  let mouseDown = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let clickQueued = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    mouseDown = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    clickQueued = true;
  }
  function onMouseMove(event) {
    if (!dragging) return;
    lookDX += event.clientX - lastX;
    lookDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onMouseUp() {
    mouseDown = false;
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    down(code) { return keys.has(code); },
    // True if the key was pressed since the last consume, without consuming it.
    peekPressed(code) { return pressed.has(code); },
    // True once per physical press; the main loop drains it every frame.
    wasPressed(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    // Arrow keys mirror WASD so both work.
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      return { x, y };
    },
    // Accumulated mouse-drag delta since the last read, in pixels.
    lookDelta() {
      const out = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return out;
    },
    // True once per click; the main loop drains it every frame.
    consumeClick() {
      const out = clickQueued;
      clickQueued = false;
      return out;
    },
    get mouseDown() { return mouseDown; },
    // Test hooks: pretend a key is held, or queue a press, without a real keyboard.
    testHold(code) { keys.add(code); },
    testRelease(code) { keys.delete(code); },
    testPress(code) { keys.add(code); pressed.add(code); },
    testClick() { clickQueued = true; },
    clearPressed() { pressed.clear(); },
  };
}
