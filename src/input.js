/* input.js — clavier, souris (verrouillage du pointeur), tactile */
import { G, canvas, $, clamp } from './core.js';

export const I = { keys: {}, btn: {}, joy: { x: 0, y: 0 }, want: { enter: false, reload: false, cycle: 0, sel: -1, skip: false, pause: false, map: false, radio: false, horn: false }, look: { dx: 0, dy: 0 }, locked: false, touch: false };
const k = I.keys, b = I.btn;
addEventListener('keydown', e => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  k[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  const w = I.want;
  if (e.code === 'KeyE') w.enter = true; if (e.code === 'KeyR') w.reload = true; if (e.code === 'Tab') w.cycle = 1; if (e.code === 'KeyM') w.map = true;
  if (e.code === 'KeyQ') w.radio = true; if (e.code === 'Enter' || e.code === 'KeyX') w.skip = true; if (e.code === 'Escape' || e.code === 'KeyP') w.pause = true; if (e.code === 'KeyH') w.horn = true;
  if (/^Digit[1-6]$/.test(e.code)) w.sel = +e.code.slice(5) - 1;
});
addEventListener('keyup', e => { k[e.code] = false; });
addEventListener('blur', () => { for (const c in k) k[c] = false; for (const c in b) b[c] = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (G.running && !G.paused) I.want.cycle = e.deltaY > 0 ? 1 : -1; }, { passive: true });

const stick = $('stick'), knob = $('knob'); let sid = null, fl = false;
let dragId = null, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') {
    if (e.button === 0) { if (!I.locked && G.running && !G.paused && !G.cine) { try { canvas.requestPointerLock(); } catch (er) { /* ok */ } } k.Mouse = true; }
    else if (e.button === 2) { k.Aim = true; if (!I.locked && G.running && !G.paused && !G.cine) { try { canvas.requestPointerLock(); } catch (er) { /* ok */ } } }
    else { dragId = e.pointerId; lx = e.clientX; ly = e.clientY; }
  } else if (e.clientX < innerWidth * .5 && e.clientY > innerHeight * .2 && G.running && !G.paused && sid === null) {
    /* joystick flottant : il apparaît là où le pouce se pose */
    I.touch = true; sid = e.pointerId; fl = true; const r = stick.getBoundingClientRect(); stick.style.left = (e.clientX - r.width / 2) + 'px'; stick.style.top = (e.clientY - r.height / 2) + 'px'; stick.style.bottom = 'auto'; stick.classList.add('on'); sv(e);
  } else { I.touch = true; dragId = e.pointerId; lx = e.clientX; ly = e.clientY; }
});
addEventListener('pointermove', e => { if (fl && e.pointerId === sid) sv(e); });
const flEnd = e => { if (fl && e.pointerId === sid) { sid = null; fl = false; I.joy.x = I.joy.y = 0; knob.style.transform = ''; stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; stick.classList.remove('on'); } };
addEventListener('pointerup', flEnd); addEventListener('pointercancel', flEnd);
addEventListener('pointermove', e => {
  if (I.locked && e.pointerType === 'mouse') return;
  if (e.pointerId === dragId) { I.look.dx += e.clientX - lx; I.look.dy += e.clientY - ly; lx = e.clientX; ly = e.clientY; }
});
addEventListener('mousemove', e => { if (I.locked) { I.look.dx += e.movementX; I.look.dy += e.movementY; } });
addEventListener('pointerup', e => { if (e.pointerId === dragId) dragId = null; if (e.pointerType === 'mouse' && e.button === 0) k.Mouse = false; if (e.pointerType === 'mouse' && e.button === 2) k.Aim = false; });
addEventListener('pointercancel', e => { if (e.pointerId === dragId) dragId = null; });
document.addEventListener('pointerlockchange', () => { I.locked = document.pointerLockElement === canvas; if (!I.locked && G.running && !G.paused && !G.cine) I.want.pause = true; });

/* joystick et boutons tactiles */
function sv(e) { const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const m = r.width / 2 * .8, d = Math.hypot(dx, dy); if (d > m) { dx = dx / d * m; dy = dy / d * m; } I.joy.x = dx / m; I.joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; }
stick.addEventListener('pointerdown', e => { I.touch = true; sid = e.pointerId; stick.setPointerCapture(e.pointerId); sv(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === sid) sv(e); });
const sEnd = e => { if (e.pointerId === sid) { sid = null; I.joy.x = I.joy.y = 0; knob.style.transform = ''; } };
stick.addEventListener('pointerup', sEnd); stick.addEventListener('pointercancel', sEnd);
document.querySelectorAll('.btn').forEach(el => {
  const kk = el.dataset.k;
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); I.touch = true; b[kk] = true; const w = I.want; if (kk === 'enter') w.enter = true; if (kk === 'reload') w.reload = true; if (kk === 'weapon') w.cycle = 1; if (kk === 'skip') w.skip = true; if (kk === 'pause') w.pause = true; if (kk === 'map') w.map = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, () => { b[kk] = false; }));
});
export const firing = () => !!(k.Mouse || k.KeyF || b.fire);
export const eatLook = () => { const d = { dx: I.look.dx, dy: I.look.dy }; I.look.dx = I.look.dy = 0; return d; };
