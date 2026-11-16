const $ = s => document.querySelector(s);
const MODES = { focus: 25, short: 5, long: 15 };   // minutes
const CIRC = 2 * Math.PI * 90;

// ---------- saved data ----------
const KEY = 'focus-desk-v1';
const dayKey = () => new Date().toISOString().slice(0, 10);
let state = { tasks: [], focusId: null, sessions: {} };
try { state = Object.assign(state, JSON.parse(localStorage.getItem(KEY))); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
let filter = 'all';

$('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- tasks ----------
function renderTasks() {
  const list = $('#list');
  list.innerHTML = '';
  const shown = state.tasks
    .filter(t => filter === 'all' || (filter === 'done') === t.done)
    .sort((a, b) => a.done - b.done || a.pri - b.pri);

  for (const t of shown) {
    const li = document.createElement('li');
    li.className = 'item' + (t.done ? ' done' : '') + (t.id === state.focusId ? ' focus' : '');

    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = t.done;
    box.setAttribute('aria-label', 'Mark done: ' + t.text);
    box.onchange = () => { t.done = box.checked; if (t.done && state.focusId === t.id) state.focusId = null; update(); };

    const dot = document.createElement('span');
    dot.className = 'dot'; dot.style.background = `var(--p${t.pri})`;
    dot.title = ['', 'High', 'Medium', 'Low'][t.pri] + ' priority';

    const txt = document.createElement('span');
    txt.className = 'txt'; txt.textContent = t.text;

    const focus = document.createElement('button');
    focus.textContent = t.id === state.focusId ? 'Focusing' : 'Focus';
    focus.disabled = t.done;
    focus.onclick = () => { state.focusId = state.focusId === t.id ? null : t.id; update(); };

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.setAttribute('aria-label', 'Delete: ' + t.text);
    del.onclick = () => { state.tasks = state.tasks.filter(x => x !== t); if (state.focusId === t.id) state.focusId = null; update(); };

    li.append(box, dot, txt, focus, del);
    list.appendChild(li);
  }

  $('#empty').hidden = shown.length > 0;
  const done = state.tasks.filter(t => t.done).length, total = state.tasks.length;
  $('#fill').style.width = total ? (done / total * 100) + '%' : '0';
  $('#count').textContent = total ? `${done} of ${total} done` : 'No tasks yet';
  const f = state.tasks.find(t => t.id === state.focusId);
  $('#working').textContent = f ? f.text : 'Pick a task to focus on';
}
function update() { save(); renderTasks(); }

$('#add').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text) return;
  state.tasks.push({ id: Date.now(), text, pri: +$('#pri').value, done: false });
  $('#text').value = '';
  update();
});
$('.filters').addEventListener('click', e => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll('.filters [data-f]').forEach(x => x.setAttribute('aria-pressed', x === b));
  renderTasks();
});
$('#clear').onclick = () => { state.tasks = state.tasks.filter(t => !t.done); update(); };

// ---------- timer ----------
let mode = 'focus', total = MODES.focus * 60, left = total, endAt = null, tick = null;

function drawTimer() {
  const m = String(Math.floor(left / 60)).padStart(2, '0'), s = String(left % 60).padStart(2, '0');
  $('#clock').textContent = `${m}:${s}`;
  $('#ring').style.strokeDashoffset = CIRC * (1 - left / total);
  document.title = endAt ? `${m}:${s} · Focus Desk` : 'Focus Desk';
  $('#start').textContent = endAt ? 'Pause' : (left < total ? 'Resume' : 'Start');
  $('#sessions').textContent = state.sessions[dayKey()] || 0;
}
function setMode(m) {
  stop();
  mode = m; total = left = MODES[m] * 60;
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
  drawTimer();
}
function stop() { clearInterval(tick); tick = endAt = null; }
function beep() {
  try {
    const ctx = new AudioContext();
    [0, .25, .5].forEach(d => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = .15;
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + .15);
    });
  } catch (e) {}
}
function finish() {
  stop(); left = 0; drawTimer(); beep();
  if (mode === 'focus') {
    const k = dayKey();
    state.sessions[k] = (state.sessions[k] || 0) + 1;
    save();
    setMode(state.sessions[k] % 4 === 0 ? 'long' : 'short');
  } else {
    setMode('focus');
  }
}
$('#start').onclick = () => {
  if (endAt) { stop(); drawTimer(); return; }
  endAt = Date.now() + left * 1000;
  tick = setInterval(() => {
    left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    left === 0 ? finish() : drawTimer();
  }, 250);
  drawTimer();
};
$('#reset').onclick = () => setMode(mode);
document.querySelector('.modes').addEventListener('click', e => {
  const b = e.target.closest('button[data-m]');
  if (b) setMode(b.dataset.m);
});

renderTasks();
drawTimer();