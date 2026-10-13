// DOM heads-up display: build menus, inspector, objectives, advisor, toasts.
import {
  CONDITION_BY_ID,
  DIAGNOSIS_TARGET,
  GAME_TITLE,
  ITEMS,
  ITEM_MENU,
  ROLES,
  ROLE_ORDER,
  ROOMS,
  ROOM_ORDER,
  STAR_GOALS,
  TRAIT_BY_ID,
  type Role,
} from '../data';
import type { Audio } from '../audio';
import type { View } from '../render/view';
import { dateOf, money, netOf, type Sim, type SimEvent } from '../sim';
import type { Guest, Item, Ledger, Room, Staff } from '../state';
import type { Tools } from '../tools';

export interface UIHost {
  sim: Sim;
  tools: Tools;
  view: View;
  audio: Audio;
  save(): void;
  newGame(): void;
}

type Menu = 'rooms' | 'items' | 'hire' | 'staff' | 'finance' | null;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const bar = (v: number, cls = '') =>
  `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(0)}%"></i></div>`;
const stars = (n: number, of = 5) => `<span class="skill">${'★'.repeat(n)}<s>${'★'.repeat(of - n)}</s></span>`;

function guestStatus(g: Guest, sim: Sim): string {
  const st = sim.world.item(g.station);
  const where = st ? ITEMS[st.type].name : '';
  switch (g.state) {
    case 'enter':
      return 'Arriving';
    case 'toWait':
    case 'waiting':
      if (!st) return g.goal === 'treat' ? 'Waiting for a Massage Suite to exist' : g.goal === 'consult' ? 'Waiting for a Consultation Room to exist' : 'Looking for Reception';
      return g.goal === 'reception' ? 'Queueing at Reception' : g.goal === 'consult' ? 'Waiting for a consultation' : 'Waiting for treatment';
    case 'called':
      return `Heading to the ${where}`;
    case 'served':
      return g.goal === 'reception' ? 'Checking in' : g.goal === 'consult' ? 'Being diagnosed' : 'Being treated';
    case 'toNeed':
    case 'need':
      return g.needKind === 'toilet' ? 'Answering a call of nature' : g.needKind === 'drink' ? 'Getting a herbal tea' : 'Getting a snack';
    case 'leaving':
      return g.outcome === 'healed' ? 'Going home healed' : g.outcome === 'failed' ? 'Going home, still knotted' : g.outcome === 'stormed' ? 'Storming out' : 'Leaving';
  }
}

function staffStatus(st: Staff, sim: Sim): string {
  const post = sim.world.item(st.post);
  switch (st.state) {
    case 'arriving':
      return 'Arriving for their first day';
    case 'idle':
    case 'wander':
      return st.role === 'caretaker' ? 'Looking for something to tidy' : 'Idle: no free post to staff';
    case 'toPost':
      return `Heading to the ${post ? ITEMS[post.type].name : 'post'}`;
    case 'atPost':
      return st.busy ? 'Working' : 'Waiting for a guest';
    case 'toBreak':
      return 'Off for a break';
    case 'onBreak':
      return 'Resting in the Staff Room';
    case 'toJob':
    case 'doingJob':
      return st.job?.kind === 'water' ? 'Watering a plant' : 'Clearing litter';
    case 'leaving':
      return 'Leaving for good';
  }
}

export class UI {
  private root: HTMLElement;
  private floaters: HTMLElement;
  private menu: Menu = null;
  private hireRole: Role = 'receptionist';
  private cache = new Map<string, string>();
  private tannoyT = 0;
  private modalOpen = false;

  constructor(private host: UIHost) {
    this.root = document.getElementById('ui')!;
    this.floaters = document.getElementById('floaters')!;
    this.root.innerHTML = `
      <div id="objectives" class="panel"></div>
      <div id="tannoy"></div>
      <div id="sys"></div>
      <div id="toasts"></div>
      <div id="inspector"></div>
      <div id="hint"></div>
      <div id="menu"></div>
      <div id="bottom">
        <div id="buildbtns"></div>
        <div id="advisor"></div>
        <div id="stats"></div>
      </div>
      <div id="modal"></div>`;
    // panels re-render while the game runs, so act on press rather than waiting for a click
    this.root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!el || e.button !== 0) return;
      e.preventDefault();
      this.act(el.dataset.act!, el.dataset.arg ?? '');
    });
    this.update();
  }

  get blocking() {
    return this.modalOpen;
  }
  closeMenu() {
    if (this.menu) {
      this.menu = null;
      this.update();
      return true;
    }
    return false;
  }

  private set(id: string, html: string) {
    const before = this.cache.get(id);
    if (before === html) return;
    this.cache.set(id, html);
    const el = document.getElementById(id)!;
    el.innerHTML = html;
    // animate panels in when they open, not on every refresh
    if (!before && html && (id === 'menu' || id === 'inspector')) {
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 220);
    }
  }

  private act(act: string, arg: string) {
    const { sim, tools, audio, view } = this.host;
    audio.unlock();
    let click = true;
    switch (act) {
      case 'menu':
        tools.cancel();
        this.menu = this.menu === arg ? null : (arg as Menu);
        break;
      case 'room':
        this.menu = null;
        tools.startRoom(arg as keyof typeof ROOMS);
        break;
      case 'item':
        this.menu = null;
        tools.startItem(arg as keyof typeof ITEMS);
        break;
      case 'hirerole':
        this.hireRole = arg as Role;
        break;
      case 'hire':
        sim.hire(Number(arg));
        click = false;
        break;
      case 'fire':
        sim.fire(Number(arg));
        tools.select(null);
        break;
      case 'select': {
        const [kind, id] = arg.split(':');
        tools.select({ kind: kind as 'staff', id: Number(id) });
        const c = sim.char(Number(id));
        if (c) view.target.set(c.x, 0, c.y);
        break;
      }
      case 'sell':
        sim.sellItem(Number(arg));
        tools.select(null);
        click = false;
        break;
      case 'demolish':
        sim.removeRoom(Number(arg), 0.5);
        tools.select(null);
        click = false;
        break;
      case 'speed':
        sim.s.speed = Number(arg);
        break;
      case 'sound':
        audio.toggleSound();
        break;
      case 'music':
        audio.toggleMusic();
        break;
      case 'deselect':
        tools.select(null);
        break;
      case 'sysmenu':
        this.showSystemMenu();
        break;
      case 'save':
        this.host.save();
        this.toast('Game saved.', 'good');
        break;
      case 'newgame':
        this.confirmNewGame();
        break;
      case 'newgame-yes':
        this.host.newGame();
        break;
      case 'close':
        this.closeModal();
        break;
    }
    if (click) audio.play('blip');
    this.update();
  }

  // ---- Regular refresh -----------------------------------------------------
  update() {
    const { sim, tools, audio } = this.host;
    const s = sim.s;

    // objectives
    const goal = STAR_GOALS[s.stars];
    const starRow = `<div class="stars">${'★'.repeat(s.stars)}<s>${'★'.repeat(STAR_GOALS.length - s.stars)}</s></div>`;
    const objs = sim
      .objectives()
      .map((o) => `<li class="${o.done ? 'done' : ''}"><b>${o.done ? '✔' : '○'}</b><span>${o.label}${bar(o.progress * 100, 'thin')}</span></li>`)
      .join('');
    this.set(
      'objectives',
      `<h3>${goal ? `Star ${s.stars + 1} objectives` : 'All stars earned!'}</h3>${starRow}<ul>${objs || '<li class="done"><b>✔</b><span>Nothing left to prove. For now.</span></li>'}</ul>`,
    );

    // system buttons
    this.set(
      'sys',
      `<button class="round small" data-act="sound" title="Sound effects">${audio.sound ? '🔊' : '🔇'}</button>
       <button class="round small ${audio.music ? '' : 'off'}" data-act="music" title="Music">🎵</button>
       <button class="round small" data-act="sysmenu" title="Menu">☰</button>`,
    );

    // build buttons
    const btn = (id: string, icon: string, label: string) =>
      `<button class="round ${this.menu === id ? 'on' : ''}" data-act="menu" data-arg="${id}"><i>${icon}</i><span>${label}</span></button>`;
    this.set(
      'buildbtns',
      btn('rooms', '🏗️', 'Rooms') + btn('items', '🪴', 'Items') + btn('hire', '🤝', 'Hire') + btn('staff', '👥', 'Staff') + btn('finance', '📈', 'Money'),
    );

    // stats
    const d = dateOf(s.day);
    const net = netOf(s.ledger);
    const speedBtn = (n: number, label: string, title: string) =>
      `<button class="speed ${s.speed === n ? 'on' : ''}" data-act="speed" data-arg="${n}" title="${title}">${label}</button>`;
    this.set(
      'stats',
      `<div class="stat money ${s.money < 0 ? 'neg' : ''}" title="Bank balance"><i>💰</i><b>${money(s.money)}</b><small class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${money(net)} this month</small></div>
       <div class="stat" title="Reputation"><i>⭐</i><b>${s.reputation.toFixed(0)}%</b>${bar(s.reputation, 'thin gold')}</div>
       <div class="stat" title="Guests on site"><i>🧍</i><b>${s.guests.length}</b><small>${s.stats.healed} healed</small></div>
       <div class="stat date" title="Date"><i>📅</i><b>Day ${d.day}</b><small>Month ${d.month}, Year ${d.year}</small></div>
       <div class="speeds">${speedBtn(0, '⏸', 'Pause (Space)')}${speedBtn(1, '▶', 'Normal (1)')}${speedBtn(2, '▶▶', 'Fast (2)')}${speedBtn(3, '▶▶▶', 'Fastest (3)')}</div>`,
    );

    this.set('advisor', `<div class="face">🧘</div><p>${esc(sim.advice())}</p>`);
    this.set(
      'hint',
      tools.hint ? `<div class="hintpill ${tools.problem ? 'bad' : ''}">${esc(tools.hint)}${tools.problem ? `<b>${esc(tools.problem)}</b>` : ''}</div>` : '',
    );
    this.set('menu', this.menuHtml());
    this.set('inspector', this.inspectorHtml());
  }

  private menuHtml(): string {
    const { sim } = this.host;
    const s = sim.s;
    if (!this.menu) return '';
    if (this.menu === 'rooms') {
      const cards = ROOM_ORDER.map((t) => {
        const r = ROOMS[t];
        const staff = r.staff ? `<em>Needs: ${ROLES[r.staff].name}</em>` : '';
        return `<button class="card ${s.money < r.cost ? 'poor' : ''}" data-act="room" data-arg="${t}">
          <i>${r.icon}</i><b>${r.name}</b><span class="cost">${money(r.cost)}</span><p>${r.desc}</p>${staff}</button>`;
      }).join('');
      return `<div class="panel menu"><h3>Build a room</h3><div class="cards">${cards}</div></div>`;
    }
    if (this.menu === 'items') {
      const cards = ITEM_MENU.map((t) => {
        const it = ITEMS[t];
        const where = it.where === 'corridor' ? 'Corridor' : it.where === 'any' ? 'Anywhere' : ROOMS[it.where].name;
        return `<button class="card ${s.money < it.cost ? 'poor' : ''}" data-act="item" data-arg="${t}">
          <i>${it.icon}</i><b>${it.name}</b><span class="cost">${money(it.cost)}</span><p>${it.desc}</p><em>${where}</em></button>`;
      }).join('');
      return `<div class="panel menu"><h3>Place an item</h3><div class="cards small">${cards}</div></div>`;
    }
    if (this.menu === 'hire') {
      const tabs = ROLE_ORDER.map(
        (r) => `<button class="tab ${this.hireRole === r ? 'on' : ''}" data-act="hirerole" data-arg="${r}">${ROLES[r].icon} ${ROLES[r].name}</button>`,
      ).join('');
      const cards = s.candidates
        .filter((c) => c.role === this.hireRole)
        .map((c) => {
          const traits = c.traits.map((t) => `<em title="${esc(TRAIT_BY_ID[t].desc)}">${TRAIT_BY_ID[t].name}: ${TRAIT_BY_ID[t].desc}</em>`).join('') || '<em class="none">No notable quirks</em>';
          return `<div class="card cv"><b>${esc(c.name)}</b>${stars(c.skill)}${traits}
            <span class="cost">${money(c.salary)}<small>/month</small></span>
            <button class="go" data-act="hire" data-arg="${c.id}">Hire</button></div>`;
        })
        .join('');
      return `<div class="panel menu"><h3>Hire staff</h3><div class="tabs">${tabs}</div><p class="sub">${ROLES[this.hireRole].desc} New applicants arrive each month.</p><div class="cards">${cards}</div></div>`;
    }
    if (this.menu === 'staff') {
      const rows = s.staff
        .map(
          (st) => `<button class="row" data-act="select" data-arg="staff:${st.id}">
            <i>${ROLES[st.role].icon}</i><b>${esc(st.name)}</b><span>${staffStatus(st, sim)}</span>${bar(st.energy, 'thin energy')}<small>${money(st.salary)}</small></button>`,
        )
        .join('');
      const total = s.staff.reduce((a, x) => a + x.salary, 0);
      return `<div class="panel menu"><h3>Your staff</h3>${rows || '<p class="sub">Nobody works here yet. Try the Hire menu.</p>'}<p class="sub">Monthly wage bill: <b>${money(total)}</b></p></div>`;
    }
    const table = (title: string, l: Ledger) => `<div class="ledger"><h4>${title}</h4>
      <div><span>Consultations</span><b class="pos">${money(l.consult)}</b></div>
      <div><span>Treatments</span><b class="pos">${money(l.treatment)}</b></div>
      <div><span>Tea &amp; snacks</span><b class="pos">${money(l.vending)}</b></div>
      <div><span>Salaries</span><b class="neg">${money(-l.salaries)}</b></div>
      <div><span>Building</span><b class="neg">${money(-l.building)}</b></div>
      <div class="total"><span>Net</span><b class="${netOf(l) < 0 ? 'neg' : 'pos'}">${money(netOf(l))}</b></div></div>`;
    const max = Math.max(1, ...s.history.map((v) => Math.abs(v)));
    const chart = s.history.length
      ? `<div class="chart">${s.history.map((v) => `<i class="${v < 0 ? 'neg' : ''}" style="height:${Math.max(4, (Math.abs(v) / max) * 56)}px" title="${money(v)}"></i>`).join('')}</div><p class="sub">Monthly net, oldest to newest</p>`
      : '';
    return `<div class="panel menu"><h3>Money</h3><div class="ledgers">${table('This month', s.ledger)}${table('Last month', s.lastLedger)}</div>${chart}
      <p class="sub">Healed ${s.stats.healed} · Failed ${s.stats.failed} · Stormed out ${s.stats.stormed} · Salaries are paid at the end of each month.</p></div>`;
  }

  private inspectorHtml(): string {
    const { sim, tools } = this.host;
    const sel = tools.selected;
    if (!sel || tools.active) return '';
    const close = `<button class="x" data-act="deselect">✕</button>`;
    if (sel.kind === 'guest') {
      const g = sim.guest(sel.id);
      if (!g) return '';
      const c = CONDITION_BY_ID[g.condition];
      const known = g.goal === 'treat' || g.goal === 'leave';
      return `<div class="panel insp">${close}<h3>${esc(g.name)}</h3><p class="tag">Guest</p>
        <p><b>${known ? c.name : 'Undiagnosed'}</b><br>${known ? c.desc : 'Something is clearly wrong. A consultation will reveal what.'}</p>
        ${known ? `<p class="sub">Treatment: ${c.treatment} · ${money(c.fee)}</p>` : ''}
        <p class="status">${guestStatus(g, sim)}</p>
        <label>Patience${bar(g.patience, g.patience < 25 ? 'bad' : '')}</label>
        <label>Diagnosis${bar((g.diagnosis / DIAGNOSIS_TARGET) * 100, 'blue')}</label>
        <label>Thirst${bar(g.thirst, 'need')}</label><label>Hunger${bar(g.hunger, 'need')}</label><label>Bladder${bar(g.bladder, 'need')}</label>
        <p class="sub">Spent so far: ${money(g.spent)}</p></div>`;
    }
    if (sel.kind === 'staff') {
      const st = sim.staff(sel.id);
      if (!st) return '';
      const traits = st.traits.map((t) => `<em>${TRAIT_BY_ID[t].name}: ${TRAIT_BY_ID[t].desc}</em>`).join('');
      return `<div class="panel insp">${close}<h3>${esc(st.name)}</h3><p class="tag">${ROLES[st.role].icon} ${ROLES[st.role].name}</p>
        <p>Skill ${stars(st.skill)}</p>${traits}
        <p class="status">${staffStatus(st, sim)}</p>
        <label>Energy${bar(st.energy, st.energy < 20 ? 'bad' : 'energy')}</label>
        <p class="sub">Salary ${money(st.salary)}/month · Guests served: ${st.served}</p>
        ${st.state === 'leaving' ? '' : `<button class="danger" data-act="fire" data-arg="${st.id}">Let go</button>`}</div>`;
    }
    if (sel.kind === 'item') {
      const it = sim.world.item(sel.id);
      if (!it) return '';
      return `<div class="panel insp">${close}${this.itemInfo(it)}</div>`;
    }
    const room = sim.world.room(sel.id);
    if (!room) return '';
    return `<div class="panel insp">${close}${this.roomInfo(room)}</div>`;
  }

  private stationInfo(it: Item): string {
    const { sim } = this.host;
    const def = ITEMS[it.type].station;
    if (!def) return '';
    const staff = sim.staff(it.staffId);
    const g = sim.guest(it.serving);
    return `<p class="status">${staff ? `Staffed by ${esc(staff.name)}` : `⚠️ Needs a ${ROLES[def.staff].name}`}</p>
      <p class="sub">Queue: ${it.queue.length}${g ? ` · Seeing ${esc(g.name)}` : ''}</p>${g ? bar(it.progress * 100, 'blue') : ''}`;
  }

  private itemInfo(it: Item): string {
    const { sim } = this.host;
    const def = ITEMS[it.type];
    let body = `<h3>${def.icon} ${def.name}</h3><p>${def.desc}</p>${this.stationInfo(it)}`;
    if (it.type === 'plant') body += `<label>Water${bar(it.water, it.water < 25 ? 'bad' : 'blue')}</label>`;
    if (sim.canSell(it)) body += `<button class="danger" data-act="sell" data-arg="${it.id}">Sell for ${money(def.cost * 0.5)}</button>`;
    else body += `<p class="sub">Part of the room. Demolish the room to remove it.</p>`;
    return body;
  }

  private roomInfo(room: Room): string {
    const { sim } = this.host;
    const def = ROOMS[room.type];
    const stations = sim.s.items.filter((i) => ITEMS[i.type].station && sim.world.zoneAt(i.x, i.y) === room.id);
    return `<h3>${def.icon} ${def.name}</h3><p>${def.desc}</p><p class="sub">${room.w}×${room.h} tiles</p>
      ${stations.map((i) => this.stationInfo(i)).join('')}
      <button class="danger" data-act="demolish" data-arg="${room.id}">Demolish (recover ${money(def.cost * 0.5)})</button>`;
  }

  // ---- Events --------------------------------------------------------------
  handle(events: SimEvent[]) {
    const { view, audio } = this.host;
    for (const e of events) {
      if (e.type === 'sfx') audio.play(e.name);
      else if (e.type === 'toast') this.toast(e.text, e.kind);
      else if (e.type === 'tannoy') this.tannoy(e.text);
      else if (e.type === 'star') this.showStar(e.stars);
      else if (e.type === 'float') {
        const p = view.project(e.x, e.y, 1.6);
        const el = document.createElement('div');
        el.className = `floater ${e.kind}`;
        el.textContent = e.text;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        this.floaters.appendChild(el);
        setTimeout(() => el.remove(), 1500);
      }
    }
  }

  toast(text: string, kind: 'good' | 'bad' | 'info' = 'info') {
    const box = document.getElementById('toasts')!;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => el.classList.add('out'), 6500);
    setTimeout(() => el.remove(), 7000);
  }

  private tannoy(text: string) {
    const el = document.getElementById('tannoy')!;
    el.innerHTML = `<div class="tannoy">📢 ${esc(text)}</div>`;
    this.host.audio.play('tannoy');
    clearTimeout(this.tannoyT);
    this.tannoyT = window.setTimeout(() => (el.innerHTML = ''), 8000);
  }

  // ---- Modals --------------------------------------------------------------
  private modal(html: string) {
    this.modalOpen = true;
    document.getElementById('modal')!.innerHTML = `<div class="veil"><div class="panel dialog">${html}</div></div>`;
  }
  private closeModal() {
    this.modalOpen = false;
    document.getElementById('modal')!.innerHTML = '';
    if (this.pausedBy !== null) {
      this.host.sim.s.speed = this.pausedBy;
      this.pausedBy = null;
    }
  }
  private pausedBy: number | null = null;
  private pause() {
    if (this.pausedBy === null) this.pausedBy = this.host.sim.s.speed;
    this.host.sim.s.speed = 0;
  }

  private showStar(n: number) {
    this.pause();
    const next = STAR_GOALS[n];
    this.modal(`<div class="bigstars">${'★'.repeat(n)}<s>${'★'.repeat(STAR_GOALS.length - n)}</s></div>
      <h2>${n >= STAR_GOALS.length ? 'Three stars!' : `Star ${n} earned!`}</h2>
      <p>The wellness inspectors were deeply relaxed by what they saw. Here is a ${money(5000 * n)} grant.</p>
      <p class="sub">${next ? 'New objectives are waiting in the top-left corner.' : 'You have mastered massage. Acupuncture and reiki will follow in a future update.'}</p>
      <button class="go" data-act="close">Keep healing</button>`);
  }

  private controlsHtml() {
    return `<ul class="keys">
      <li><kbd>Left click</kbd> select, place, confirm</li>
      <li><kbd>Drag</kbd> or <kbd>W A S D</kbd> move the camera</li>
      <li><kbd>Scroll</kbd> zoom</li>
      <li><kbd>R</kbd> rotate furniture · <kbd>Esc</kbd> / right click cancel</li>
      <li><kbd>Space</kbd> pause · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> game speed</li></ul>`;
  }

  private showSystemMenu() {
    this.pause();
    this.modal(`<h2>${GAME_TITLE}</h2>${this.controlsHtml()}
      <p class="sub">The game saves itself every few seconds.</p>
      <div class="btnrow"><button class="go" data-act="close">Resume</button>
      <button data-act="save">Save now</button><button class="danger" data-act="newgame">New game</button></div>`);
  }

  private confirmNewGame() {
    this.modal(`<h2>Start over?</h2><p>This demolishes your healing centre and erases the save. The knots will return.</p>
      <div class="btnrow"><button data-act="close">Keep playing</button><button class="danger" data-act="newgame-yes">Erase and restart</button></div>`);
  }
}

/** Title screen, shown before a game exists. */
export function showTitle(canContinue: boolean): Promise<'new' | 'continue'> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'title';
    el.innerHTML = `<div class="panel dialog">
      <div class="logo"><span>Pressure</span><span>Point</span></div>
      <p class="tagline">Build a healing centre. Untie the public.</p>
      <div class="btnrow">
        ${canContinue ? '<button class="go" data-pick="continue">Continue</button>' : ''}
        <button class="${canContinue ? '' : 'go'}" data-pick="new">New game</button>
      </div>
      <p class="sub">Massage therapy is open for business. Acupuncture and reiki are still limbering up.</p>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const pick = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]')?.dataset.pick;
      if (!pick) return;
      el.remove();
      resolve(pick as 'new' | 'continue');
    });
  });
}
