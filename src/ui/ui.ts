// DOM heads-up display: build menus, inspector, objectives, advisor, toasts.
import {
  CONDITIONS,
  CONDITION_BY_ID,
  DIAGNOSIS_TARGET,
  DISCIPLINES,
  DISCIPLINE_ORDER,
  GAME_TITLE,
  TITLE_LINES,
  ITEMS,
  ITEM_MENU,
  LOAN_MAX,
  LOAN_RATE,
  LOAN_STEP,
  MODALITIES,
  MODALITY_ORDER,
  PRICE_MAX,
  PRICE_MIN,
  ROLES,
  ROLE_ORDER,
  ROOMS,
  ROOM_ORDER,
  STAR_GOALS,
  STONE_USE,
  TRAIT_BY_ID,
  WEAR_REPAIR,
  WINDOW_COST,
  modalityLabel,
  type ItemType,
  type Discipline,
  type Modality,
  type Role,
} from '../data';
import type { Audio } from '../audio';
import type { View } from '../render/view';
import { dateOf, money, netOf, type Sim, type SimEvent } from '../sim';
import type { Guest, Item, Ledger, Room, Staff } from '../state';
import { gameDate, latestSave } from '../saves';
import type { Tools } from '../tools';
import { mountSaves } from './saves';
import { mountSettings } from './settings';

export interface UIHost {
  sim: Sim;
  tools: Tools;
  view: View;
  audio: Audio;
  /** Write the autosave now. */
  save(): void;
  newGame(): void;
  loadGame(id: string): void;
  /** Leave for the title screen, keeping the game in the autosave. */
  mainMenu(): void;
  /** Quit the desktop app. Absent in a browser, where there is nothing to quit. */
  exit?: () => void;
}

type Menu = 'rooms' | 'items' | 'hire' | 'staff' | 'treatments' | 'finance' | null;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const bar = (v: number, cls = '') =>
  `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(0)}%"></i></div>`;
const qualChips = (quals: Modality[]) =>
  quals.length
    ? `<div class="quals">${quals.map((m) => `<span title="${MODALITIES[m].name}">${MODALITIES[m].icon} ${MODALITIES[m].name}</span>`).join('')}</div>`
    : '';
const stars = (n: number, of = 5) => `<span class="skill">${'★'.repeat(n)}<s>${'★'.repeat(of - n)}</s></span>`;

function guestStatus(g: Guest, sim: Sim): string {
  const st = sim.world.item(g.station);
  const where = st ? ITEMS[st.type].name : '';
  switch (g.state) {
    case 'enter':
      return 'Arriving';
    case 'toWait':
    case 'waiting':
      if (!st) return g.goal === 'treat' ? `Waiting for a working ${ROOMS[DISCIPLINES[sim.modalityOf(g).discipline].room].name}` : g.goal === 'consult' ? 'Waiting for a Consultation Room to exist' : g.goal === 'assess' ? 'Waiting for a working Posture Lab' : 'Looking for Reception';
      return g.goal === 'reception' ? 'In line at Reception' : g.goal === 'consult' ? 'Waiting for a consultation' : g.goal === 'assess' ? 'Waiting for a posture scan' : 'Waiting for treatment';
    case 'called':
      return `Heading to the ${where}`;
    case 'served':
      return g.goal === 'reception' ? 'Checking in' : g.goal === 'consult' ? 'Being diagnosed' : g.goal === 'assess' ? 'Being scanned' : 'Being treated';
    case 'toNeed':
    case 'need':
      return g.needKind === 'toilet' ? 'Answering a call of nature' : g.needKind === 'drink' ? 'Getting a herbal tea' : 'Getting a snack';
    case 'leaving':
      return g.outcome === 'healed' ? 'Going home healed' : g.outcome === 'failed' ? 'Going home, still knotted' : g.outcome === 'stormed' ? 'Leaving in a huff' : 'Leaving';
  }
}

function staffStatus(st: Staff, sim: Sim): string {
  const post = sim.world.item(st.post);
  switch (st.state) {
    case 'arriving':
      return 'Arriving for their first day';
    case 'idle':
    case 'wander':
      return st.role === 'caretaker' ? 'Looking for something to clean' : 'Idle: no open station to staff';
    case 'toPost':
      return `Heading to the ${post ? ITEMS[post.type].name : 'station'}`;
    case 'atPost':
      return st.busy ? 'Working' : 'Waiting for a guest';
    case 'toBreak':
      return 'Off for a break';
    case 'onBreak':
      return 'Resting in the Staff Room';
    case 'toJob':
    case 'doingJob':
      if (st.job?.kind === 'repair') return `Repairing the ${ITEMS[sim.world.item(st.job.id)?.type ?? 'bin'].name}`;
      if (st.job?.kind !== 'water') return 'Clearing litter';
      return sim.world.item(st.job.id)?.type === 'stone_warmer' ? 'Reheating the massage stones' : 'Watering a plant';
    case 'toTrain':
      return 'Heading to the Training Room';
    case 'training':
      return `Studying: ${courseName(st.training?.course ?? '')}`;
    case 'leaving':
      return 'Leaving for good';
  }
}

function courseName(id: string) {
  return id === 'skill' ? 'professional development' : id in MODALITIES ? modalityLabel(id as Modality) : id;
}

export class UI {
  private root: HTMLElement;
  private floaters: HTMLElement;
  private menu: Menu = null;
  private hireRole: Role = 'receptionist';
  private cache = new Map<string, string>();
  private announceT = 0;
  private modalOpen = false;

  constructor(private host: UIHost) {
    this.root = document.getElementById('ui')!;
    this.floaters = document.getElementById('floaters')!;
    this.root.innerHTML = `
      <div id="objectives" class="panel"></div>
      <div id="announce"></div>
      <div id="offer"></div>
      <div id="sys"></div>
      <div id="toasts"></div>
      <div id="inspector"></div>
      <div id="hint"></div>
      <div id="plan"></div>
      <div id="menu"></div>
      <div id="advisor"></div>
      <div id="bottom">
        <div id="buildbtns"></div>
        <div id="stats"></div>
      </div>
      <div id="modal"></div>`;
    // panels re-render while the game runs, so act on press rather than waiting for a click
    this.root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!el || e.button !== 0) return;
      e.preventDefault();
      if (el.classList.contains('locked')) {
        this.host.audio.play('error');
        return;
      }
      this.act(el.dataset.act!, el.dataset.arg ?? '');
    });
    this.update();
  }

  get blocking() {
    return this.modalOpen;
  }
  openPauseMenu() {
    this.showSystemMenu();
    this.update();
  }
  /** Close whatever dialog is open and carry on playing. */
  dismiss() {
    if (!this.modalOpen) return;
    this.closeModal();
    this.update();
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
        // an open blueprint stays open while you fetch something from a menu
        tools.setAside();
        this.menu = this.menu === arg ? null : (arg as Menu);
        break;
      case 'plan':
        if (arg === 'build') tools.planBuild();
        else if (arg === 'cancel') tools.cancel();
        else if (arg === 'window' || arg === 'door') tools.planHold(tools.plan?.holding === arg ? '' : arg);
        else tools.startItem(arg as ItemType);
        break;
      case 'roomwindows':
        tools.startWindows(Number(arg));
        break;
      case 'roomdoor':
        tools.startMoveDoor(Number(arg));
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
      case 'train': {
        const [id, course] = arg.split(':');
        sim.train(Number(id), course);
        click = false;
        break;
      }
      case 'raise':
        sim.giveRaise(Number(arg));
        click = false;
        break;
      case 'move':
        tools.startMove(Number(arg));
        break;
      case 'borrow':
        if (!sim.borrow()) audio.play('error');
        click = false;
        break;
      case 'repay':
        if (!sim.repay()) audio.play('error');
        click = false;
        break;
      case 'price':
        sim.setPrice(sim.s.priceLevel + Number(arg));
        break;
      case 'emergency':
        if (arg === 'accept') sim.acceptEmergency();
        else sim.declineEmergency();
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
      case 'saves':
        this.showSaves();
        break;
      case 'settings':
        this.showSettings();
        break;
      case 'newgame':
        this.confirmNewGame();
        break;
      case 'newgame-yes':
        this.host.newGame();
        break;
      case 'mainmenu':
        this.host.mainMenu();
        break;
      case 'exit':
        this.host.exit?.();
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
    const em = s.emergency;
    const emergency = em
      ? `<div class="emergency"><b>🚨 Emergency: ${CONDITION_BY_ID[em.condition].name}</b>
           <span>${em.healed}/${em.target} healed · ${Math.max(0, Math.ceil(em.deadline - s.day))} days left</span>${bar((em.healed / em.target) * 100, 'thin bad')}</div>`
      : '';
    this.set(
      'objectives',
      `<h3>${goal ? `Star ${s.stars + 1} objectives` : 'All stars earned!'}</h3>${starRow}<ul>${objs || '<li class="done"><b>✔</b><span>Nothing left to prove. For now.</span></li>'}</ul>${emergency}`,
    );
    const offer = s.offer;
    this.set(
      'offer',
      offer
        ? `<div class="panel offer"><h3>🚨 Emergency</h3><p>${esc(offer.cause)} <b>${offer.total} guests</b> with <b>${CONDITION_BY_ID[offer.condition].name}</b> need ${MODALITIES[CONDITION_BY_ID[offer.condition].modality].name} massage.</p>
            <p class="sub">Heal ${offer.target} of them within 25 days for a <b>${money(offer.reward)}</b> bonus. Fail and your reputation suffers. Offer lapses in ${Math.max(1, Math.ceil(offer.deadline - s.day))} days.</p>
            <div class="btnrow"><button class="go" data-act="emergency" data-arg="accept">Accept</button><button data-act="emergency" data-arg="decline">Decline</button></div></div>`
        : '',
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
      btn('rooms', '🏗️', 'Rooms') + btn('items', '🪴', 'Items') + btn('hire', '🤝', 'Hire') + btn('staff', '👥', 'Staff') + btn('treatments', '💆', 'Treatments') + btn('finance', '📈', 'Money'),
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

    // the advisor sits where the build menus open, so it steps aside for them
    this.set('advisor', this.menu || tools.plan ? '' : `<div class="face">🧘</div><p>${esc(sim.advice())}</p>`);
    this.set('plan', this.planHtml());
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
      const cards = ROOM_ORDER.filter((t) => this.available(ROOMS[t].discipline)).map((t) => {
        const r = ROOMS[t];
        const locked = (r.unlock ?? 0) > s.stars;
        const staff = locked ? `<em>🔒 Unlocks at star ${r.unlock}</em>` : r.staff ? `<em>Needs: ${ROLES[r.staff].name}</em>` : '';
        return `<button class="card ${locked ? 'locked' : s.money < r.cost ? 'poor' : ''}" data-act="room" data-arg="${t}">
          <i>${r.icon}</i><b>${r.name}</b><span class="cost">${money(r.cost)}</span><p>${r.desc}</p>${staff}</button>`;
      }).join('');
      return `<div class="panel menu"><h3>Build a room</h3><div class="cards">${cards}</div></div>`;
    }
    if (this.menu === 'items') {
      const cards = ITEM_MENU.filter((t) => {
        const where = ITEMS[t].where;
        return where === 'corridor' || where === 'any' || this.available(ROOMS[where].discipline);
      }).map((t) => {
        const it = ITEMS[t];
        const where = it.where === 'corridor' ? 'Corridor' : it.where === 'any' ? 'Anywhere' : ROOMS[it.where].name;
        const locked = (it.unlock ?? 0) > s.stars;
        return `<button class="card ${locked ? 'locked' : s.money < it.cost ? 'poor' : ''}" data-act="item" data-arg="${t}">
          <i>${it.icon}</i><b>${it.name}</b><span class="cost">${money(it.cost)}</span><p>${it.desc}</p><em>${locked ? `🔒 Unlocks at star ${it.unlock}` : where}</em></button>`;
      }).join('');
      return `<div class="panel menu"><h3>Place an item</h3><div class="cards small">${cards}</div></div>`;
    }
    if (this.menu === 'hire') {
      // roles for a discipline appear once its room can be built
      const roles = ROLE_ORDER.filter((r) => {
        const d = ROLES[r].discipline;
        return !d || (this.available(d) && s.stars >= (ROOMS[DISCIPLINES[d].room].unlock ?? 0));
      });
      if (!roles.includes(this.hireRole)) this.hireRole = roles[0];
      const tabs = roles
        .map((r) => `<button class="tab ${this.hireRole === r ? 'on' : ''}" data-act="hirerole" data-arg="${r}">${ROLES[r].icon} ${ROLES[r].name}</button>`)
        .join('');
      const cards = s.candidates
        .filter((c) => c.role === this.hireRole)
        .map((c) => {
          const traits = c.traits.map((t) => `<em title="${esc(TRAIT_BY_ID[t].desc)}">${TRAIT_BY_ID[t].name}: ${TRAIT_BY_ID[t].desc}</em>`).join('') || '<em class="none">No notable quirks</em>';
          return `<div class="card cv"><b>${esc(c.name)}</b>${stars(c.skill)}${qualChips(c.quals ?? [])}${traits}
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
            <i>${ROLES[st.role].icon}</i><b>${st.raiseAsked ? '💰 ' : ''}${esc(st.name)}</b><span>${staffStatus(st, sim)}</span>${bar(st.energy, 'thin energy')}<small>${money(st.salary)}</small></button>`,
        )
        .join('');
      const total = s.staff.reduce((a, x) => a + x.salary, 0);
      return `<div class="panel menu"><h3>Your staff</h3>${rows || '<p class="sub">Nobody works here yet. Try the Hire menu.</p>'}<p class="sub">Monthly payroll: <b>${money(total)}</b></p></div>`;
    }
    if (this.menu === 'treatments') {
      const sections = DISCIPLINE_ORDER.filter((d) => sim.enabled(d))
        .map((d) => {
          const disc = DISCIPLINES[d];
          const role = ROLES[disc.role];
          const room = ROOMS[disc.room];
          const staff = s.staff.filter((x) => x.role === disc.role && x.state !== 'leaving');
          const cards = MODALITY_ORDER.filter((m) => MODALITIES[m].discipline === d)
            .map((m) => {
              const def = MODALITIES[m];
              const locked = !sim.unlocked(m);
              const treats = CONDITIONS.filter((c) => c.modality === m).map((c) => `${c.name} (${money(c.fee)})`).join(', ');
              const qualified = staff.filter((x) => x.quals.includes(m)).length;
              const waiting = s.guests.filter((g) => g.goal === 'treat' && CONDITION_BY_ID[g.condition].modality === m).length;
              const kit = def.equipment ? ITEMS[def.equipment] : null;
              const kitOk = !kit || s.items.some((i) => i.type === def.equipment && sim.world.usable(i));
              const lines = locked
                ? `<em>🔒 Unlocks at star ${def.star}</em>`
                : `<em class="${qualified ? 'ok' : 'warn'}">${qualified ? '✔' : '⚠️'} ${qualified} qualified</em>
                   ${kit ? `<em class="${kitOk ? 'ok' : 'warn'}">${kitOk ? `✔ ${kit.name} installed` : `⚠️ Needs a ${kit.name} in the room`}</em>` : ''}
                   <em>${waiting} waiting · ${def.seconds}s session</em>`;
              return `<div class="card mod ${locked ? 'locked' : ''}"><i>${def.icon}</i><b>${def.name}</b><p>${def.desc}</p><p class="treats">Treats: ${treats}</p>${lines}</div>`;
            })
            .join('');
          const built = sim.hasRoom(disc.room);
          const note = built
            ? `Delivered in the ${room.name} by ${role.name}s.`
            : (room.unlock ?? 0) > s.stars
              ? `The ${room.name} unlocks at star ${room.unlock}.`
              : `Build an ${room.name} and hire an ${role.name} to offer these. Until then, guests who need them will not turn up.`;
          return `<h4 class="section">${disc.icon} ${disc.name}</h4><p class="sub">${note}</p><div class="cards">${cards}</div>`;
        })
        .join('');
      return `<div class="panel menu"><h3>Treatments</h3><p class="sub">A diagnosis prescribes a treatment. It works properly only with someone qualified in it and the right equipment in the room. Staff learn new ones in a Training Room.</p>${sections}</div>`;
    }
    const table = (title: string, l: Ledger) => `<div class="ledger"><h4>${title}</h4>
      <div><span>Consultations</span><b class="pos">${money(l.consult)}</b></div>
      <div><span>Treatments</span><b class="pos">${money(l.treatment)}</b></div>
      <div><span>Tea &amp; snacks</span><b class="pos">${money(l.vending)}</b></div>
      <div><span>Salaries</span><b class="neg">${money(-l.salaries)}</b></div>
      <div><span>Building</span><b class="neg">${money(-l.building)}</b></div>
      <div><span>Emergency bonuses</span><b class="pos">${money(l.bonus)}</b></div>
      <div><span>Training</span><b class="neg">${money(-l.training)}</b></div>
      <div><span>Loan interest</span><b class="neg">${money(-l.interest)}</b></div>
      <div class="total"><span>Net</span><b class="${netOf(l) < 0 ? 'neg' : 'pos'}">${money(netOf(l))}</b></div></div>`;
    const max = Math.max(1, ...s.history.map((v) => Math.abs(v)));
    const chart = s.history.length
      ? `<div class="chart">${s.history.map((v) => `<i class="${v < 0 ? 'neg' : ''}" style="height:${Math.max(4, (Math.abs(v) / max) * 56)}px" title="${money(v)}"></i>`).join('')}</div><p class="sub">Monthly net, oldest to newest</p>`
      : '';
    const pct = Math.round(s.priceLevel * 100);
    const controls = `<div class="ledgers controls">
      <div class="ledger"><h4>Prices: ${pct}% of standard</h4>
        <p class="sub">Higher prices earn more per guest, but build reputation more slowly and some guests walk out.</p>
        <div class="btnrow left"><button class="${s.priceLevel <= PRICE_MIN ? 'locked' : ''}" data-act="price" data-arg="-0.1">−10%</button><button class="${s.priceLevel >= PRICE_MAX ? 'locked' : ''}" data-act="price" data-arg="0.1">+10%</button></div></div>
      <div class="ledger"><h4>Loan: ${money(s.loan)} of ${money(LOAN_MAX)}</h4>
        <p class="sub">Costs ${(LOAN_RATE * 100).toFixed(0)}% interest a month, currently ${money(s.loan * LOAN_RATE)}.</p>
        <div class="btnrow left"><button class="${s.loan + LOAN_STEP > LOAN_MAX ? 'locked' : ''}" data-act="borrow">Borrow ${money(LOAN_STEP)}</button><button class="${s.loan <= 0 || s.money <= 0 ? 'locked' : ''}" data-act="repay">Repay ${money(LOAN_STEP)}</button></div></div>
    </div>`;
    return `<div class="panel menu"><h3>Money</h3><div class="ledgers">${table('This month', s.ledger)}${table('Last month', s.lastLedger)}</div>${controls}${chart}
      <p class="sub">Healed ${s.stats.healed} · Failed ${s.stats.failed} · Stormed out ${s.stats.stormed} · Salaries are paid at the end of each month.</p></div>`;
  }

  /** The blueprint panel: what the room still needs, what can be added, and the Build button. */
  private planHtml(): string {
    const { sim, tools } = this.host;
    const plan = tools.plan;
    if (!plan) return '';
    const { room, missing, holding, ready } = plan;
    const def = ROOMS[room.type];
    const left = [...missing];
    // one chip per piece of required furniture: ticked once placed, clickable while not
    const chips = def.required
      .map((type) => {
        const item = ITEMS[type];
        const at = left.indexOf(type);
        if (at < 0) return `<span class="chip done">✔ ${item.name}</span>`;
        left.splice(at, 1);
        return `<button class="chip ${holding === type ? 'on' : ''}" data-act="plan" data-arg="${type}">○ ${item.name}</button>`;
      })
      .join('');
    const extras = room.windows.length * WINDOW_COST;
    return `<div class="panel plan">
      <h3>${def.icon} ${def.name} blueprint <span class="cost">${money(def.cost)}${extras ? ` + ${money(extras)}` : ''}</span></h3>
      <div class="chips"><span class="chip done">✔ Door</span>${chips}</div>
      <div class="chips">
        <button class="chip ${holding === 'window' ? 'on' : ''}" data-act="plan" data-arg="window">🪟 Windows (${room.windows.length}) · ${money(WINDOW_COST)} each</button>
        <button class="chip ${holding === 'door' ? 'on' : ''}" data-act="plan" data-arg="door">🚪 Move door</button>
      </div>
      <p class="sub">${ready ? 'Ready to build. Add windows, or extras from the Items menu, first if you like.' : `Still needed: ${missing.map((t) => ITEMS[t].name).join(', ')}.`} Prestige ${stars(sim.prestige(room))}</p>
      <div class="btnrow"><button data-act="plan" data-arg="cancel">Cancel</button>
        <button class="go ${ready ? '' : 'locked'}" data-act="plan" data-arg="build">Build room</button></div>
    </div>`;
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
      return `<div class="panel insp">${close}<h3>${esc(g.name)}</h3><p class="tag">${g.emergency ? '🚨 Emergency guest' : 'Guest'}</p>
        <p><b>${known ? c.name : 'Undiagnosed'}</b><br>${known ? c.desc : 'Something is clearly wrong. A consultation will reveal what.'}</p>
        ${known ? `<p class="sub">Treatment: ${c.treatment} · ${money(c.fee)}</p>${qualChips([c.modality])}` : ''}
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
        <p>Skill ${stars(st.skill)}</p>${qualChips(st.quals ?? [])}${traits}
        <p class="status">${staffStatus(st, sim)}</p>
        ${st.training ? `<label>Course progress${bar(st.training.progress * 100, 'blue')}</label>` : ''}
        <label>Energy${bar(st.energy, st.energy < 20 ? 'bad' : 'energy')}</label>
        <label>Morale${bar(st.morale, st.morale < 30 ? 'bad' : 'gold')}</label>
        <p class="sub">Salary ${money(st.salary)}/month (going rate ${money(sim.fairPay(st))}) · Guests served: ${st.served}</p>
        ${st.state === 'leaving' ? '' : `<button class="${st.raiseAsked ? 'go' : ''} raise" data-act="raise" data-arg="${st.id}">${st.raiseAsked ? '💰 Wants a raise: pay' : 'Raise to'} ${money(sim.raiseTo(st))}</button>`}
        ${this.coursesHtml(st)}
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

  private coursesHtml(st: Staff): string {
    const { sim } = this.host;
    if (st.state === 'leaving' || st.training) return '';
    const courses = sim.courses(st);
    if (!courses.length) return '';
    const rows = courses
      .map((c) => {
        const blocker = sim.trainBlocker(st, c);
        return `<button class="course ${blocker ? 'locked' : ''}" data-act="train" data-arg="${st.id}:${c.id}" title="${esc(blocker || c.desc)}">
          <i>${c.icon}</i><span>${c.name}<small>${c.days} days</small></span><b>${money(c.cost)}</b></button>`;
      })
      .join('');
    const blocker = sim.trainBlocker(st, courses[0]);
    const note = blocker && blocker !== 'Not enough money.' ? `<p class="sub">${blocker}</p>` : '';
    return `<h4>Training</h4>${rows}${note}`;
  }

  private stationInfo(it: Item): string {
    const { sim } = this.host;
    const def = ITEMS[it.type].station;
    if (!def) return '';
    const staff = sim.staff(it.staffId);
    const g = sim.guest(it.serving);
    return `<p class="status">${staff ? `Staffed by ${esc(staff.name)}` : `⚠️ Needs a ${ROLES[def.staff].name}`}</p>
      <p class="sub">In line: ${it.queue.length}${g ? ` · Seeing ${esc(g.name)}` : ''}</p>${g ? bar(it.progress * 100, 'blue') : ''}`;
  }

  private itemInfo(it: Item): string {
    const { sim } = this.host;
    const def = ITEMS[it.type];
    let body = `<h3>${def.icon} ${def.name}</h3><p>${def.desc}</p>${this.stationInfo(it)}`;
    if (it.type === 'plant') body += `<label>Water${bar(it.water, it.water < 25 ? 'bad' : 'blue')}</label>`;
    if (it.type === 'stone_warmer') body += `<label>Heat${bar(it.water, it.water < STONE_USE ? 'bad' : 'need')}</label>`;
    if (def.wear) {
      body += `<label>Condition${bar(100 - it.wear, it.wear >= WEAR_REPAIR ? 'bad' : '')}</label>`;
      if (it.wear >= 100) body += `<p class="status">🔧 Broken: needs a Janitor</p>`;
    }
    if (def.decor) body += `<p class="sub">Decor: +${def.decor} to its surroundings</p>`;
    body += `<button data-act="move" data-arg="${it.id}">Move</button> `;
    if (sim.canSell(it)) body += `<button class="danger" data-act="sell" data-arg="${it.id}">Sell for ${money(def.cost * 0.5)}</button>`;
    else body += `<p class="sub">Part of the room. Demolish the room to remove it.</p>`;
    return body;
  }

  /** Which modalities a treatment room can deliver right now, and what is missing for the rest. */
  /** A discipline's rooms, staff and equipment are offered only while it is switched on. */
  private available(d: Discipline | undefined): boolean {
    return !d || this.host.sim.enabled(d);
  }

  private suiteModalities(tables: Item[]): string {
    const { sim } = this.host;
    const table = tables[0];
    if (!table) return '';
    const staff = sim.staff(table.staffId);
    const discipline = ITEMS[table.type].station?.discipline;
    const rows = MODALITY_ORDER.filter((m) => MODALITIES[m].discipline === discipline && sim.unlocked(m))
      .map((m) => {
        const def = MODALITIES[m];
        const problem = sim.deliveryProblem(table, staff, def);
        const why = {
          '': staff ? '' : 'once staffed',
          unqualified: `${staff?.name.split(' ')[0]} is not qualified`,
          'no-equipment': `needs a ${def.equipment ? ITEMS[def.equipment].name : ''}`,
          cold: 'stones are cold',
        }[problem];
        return `<em class="${problem ? 'warn' : 'ok'}">${problem ? '✗' : '✔'} ${def.icon} ${def.name}${why ? ` <small>(${why})</small>` : ''}</em>`;
      })
      .join('');
    return `<h4>Can deliver</h4>${rows}`;
  }

  private roomInfo(room: Room): string {
    const { sim } = this.host;
    const def = ROOMS[room.type];
    const stations = sim.s.items.filter((i) => ITEMS[i.type].station && sim.world.zoneAt(i.x, i.y) === room.id);
    return `<h3>${def.icon} ${def.name}</h3><p>${def.desc}</p>
      <p>Prestige ${stars(sim.prestige(room))}</p>
      <p class="sub">${room.w}×${room.h} tiles · ${room.windows.length} window${room.windows.length === 1 ? '' : 's'} · Bigger rooms with more decor and daylight are more prestigious, which lifts staff morale and results.</p>
      ${stations.map((i) => this.stationInfo(i)).join('')}${ROOMS[room.type].discipline ? this.suiteModalities(stations) : ''}
      <button data-act="roomwindows" data-arg="${room.id}">🪟 Windows</button> <button data-act="roomdoor" data-arg="${room.id}">🚪 Move door</button>
      <button class="danger" data-act="demolish" data-arg="${room.id}">Demolish (recover ${money(def.cost * 0.5)})</button>`;
  }

  // ---- Events --------------------------------------------------------------
  handle(events: SimEvent[]) {
    const { view, audio } = this.host;
    for (const e of events) {
      if (e.type === 'sfx') audio.play(e.name);
      else if (e.type === 'toast') this.toast(e.text, e.kind);
      else if (e.type === 'announce') this.announce(e.text);
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

  private announce(text: string) {
    const el = document.getElementById('announce')!;
    el.innerHTML = `<div class="announce">📢 ${esc(text)}</div>`;
    this.host.audio.play('announce');
    clearTimeout(this.announceT);
    this.announceT = window.setTimeout(() => (el.innerHTML = ''), 8000);
  }

  // ---- Modals --------------------------------------------------------------
  private modal(html: string, wide = false) {
    this.modalOpen = true;
    document.getElementById('modal')!.innerHTML = `<div class="veil"><div class="panel dialog ${wide ? 'wide' : ''}">${html}</div></div>`;
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
    const { sim } = this.host;
    const rooms = ROOM_ORDER.filter((t) => ROOMS[t].unlock === n && this.available(ROOMS[t].discipline)).map((t) => `${ROOMS[t].icon} ${ROOMS[t].name}`);
    const fresh = MODALITY_ORDER.filter((m) => MODALITIES[m].star === n && sim.enabled(MODALITIES[m].discipline)).map(
      (m) => `${MODALITIES[m].icon} ${modalityLabel(m)}`,
    );
    const unlock =
      (rooms.length ? `<p class="unlock"><b>New room:</b> ${rooms.join(', ')}. Build one and hire its staff to bring in a new kind of guest.</p>` : '') +
      (fresh.length
        ? `<p class="unlock"><b>New treatments:</b> ${fresh.join(', ')}.<br>Guests who need them will start arriving. Train your staff in a Training Room and check the Treatments menu for equipment.</p>`
        : '');
    this.modal(`<div class="bigstars">${'★'.repeat(n)}<s>${'★'.repeat(STAR_GOALS.length - n)}</s></div>
      <h2>${n >= STAR_GOALS.length ? 'Three stars!' : `Star ${n} earned!`}</h2>
      <p>The wellness inspectors were deeply relaxed by what they saw. Here is a ${money(5000 * n)} grant.</p>${unlock}
      <p class="sub">${next ? 'New objectives are waiting in the top-left corner.' : 'You have mastered the lot. Reiki will follow in a future update.'}</p>
      <button class="go" data-act="close">Keep healing</button>`);
  }

  private controlsHtml() {
    return `<ul class="keys">
      <li><kbd>Left click</kbd> select, place, confirm</li>
      <li><kbd>Drag</kbd> or <kbd>W A S D</kbd> move the camera</li>
      <li><kbd>Scroll</kbd> zoom</li>
      <li><kbd>R</kbd> rotate furniture · <kbd>Esc</kbd> / right click cancel · <kbd>Esc</kbd> again for this menu</li>
      <li><kbd>Space</kbd> pause · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> game speed</li></ul>`;
  }

  private showSystemMenu() {
    this.pause();
    this.modal(`<h2>${GAME_TITLE}</h2>${this.controlsHtml()}
      <p class="sub">The game autosaves every few seconds. Use Save or load to keep named saves.</p>
      <div class="btnrow"><button class="go" data-act="close">Resume</button>
      <button data-act="saves">Save or load</button><button data-act="settings">Settings</button></div>
      <div class="btnrow"><button data-act="mainmenu">Main menu</button><button class="danger" data-act="newgame">New game</button>
      ${this.host.exit ? '<button class="danger" data-act="exit">Exit game</button>' : ''}</div>
      <p class="sub">Main menu${this.host.exit ? ' and Exit game both save' : ' saves'} your game first.</p>`);
  }

  private showSettings() {
    this.pause();
    this.modal(
      `<h2>Settings</h2><div id="settings-panel"></div>
       <div class="btnrow"><button data-act="sysmenu">Back</button><button class="go" data-act="close">Resume</button></div>`,
      true,
    );
    mountSettings(document.getElementById('settings-panel')!, {
      audio: this.host.audio,
      sim: this.host.sim,
      onChange: () => {
        // a switched-off discipline's menu may be open behind the dialog
        this.menu = null;
        this.update();
      },
    });
  }

  private showSaves() {
    this.pause();
    this.host.save();
    this.modal(
      `<h2>Saved games</h2><div id="saves-panel"></div>
       <div class="btnrow"><button data-act="sysmenu">Back</button><button class="go" data-act="close">Resume</button></div>`,
      true,
    );
    mountSaves(document.getElementById('saves-panel')!, { current: this.host.sim.s, onLoad: (id) => this.host.loadGame(id) });
  }

  private confirmNewGame() {
    this.modal(`<h2>Start a new game?</h2><p>Your current center is not lost: it moves to "Previous game" in the saved games list.</p>
      <div class="btnrow"><button data-act="close">Keep playing</button><button class="danger" data-act="newgame-yes">Start a new game</button></div>`);
  }
}

/** What the player picked on the title screen: 'new', or the id of a save to load. */
export function showTitle(audio: Audio, exit?: () => void): Promise<string> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'title';
    const latest = latestSave();
    // the same sound and music switches as in the game, so they can be set before it starts
    const switches = () =>
      `<button class="round small ${audio.sound ? '' : 'off'}" data-toggle="sound" title="Sound effects" aria-pressed="${audio.sound}">${audio.sound ? '🔊' : '🔇'}</button>
       <button class="round small ${audio.music ? '' : 'off'}" data-toggle="music" title="Music" aria-pressed="${audio.music}">🎵</button>`;
    el.innerHTML = `<div class="title-sys">${switches()}</div><div class="panel dialog wide">
      <div class="logo">${TITLE_LINES.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="btnrow">
        ${latest ? `<button class="go" data-pick="${latest.id}" title="${esc(latest.name)}, ${gameDate(latest.day)}">Continue</button><button data-show="saves">Load game</button>` : ''}
        <button class="${latest ? '' : 'go'}" data-pick="new">New game</button>
        <button data-show="settings">Settings</button>
        ${exit ? '<button class="danger" data-exit>Exit</button>' : ''}
      </div>
      ${latest ? `<p class="sub">Continue picks up "${esc(latest.name)}" at ${gameDate(latest.day)}.</p>` : ''}
      <div id="title-saves" hidden></div>
      <div id="title-settings" hidden></div>
      <p class="sub">Massage and acupuncture are open for business. Reiki is still limbering up.</p>
    </div>`;
    document.body.appendChild(el);
    const finish = (what: string) => {
      el.remove();
      resolve(what);
    };
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const toggle = target.closest<HTMLElement>('[data-toggle]')?.dataset.toggle;
      if (toggle) {
        // a click is what browsers need before any sound, so music can start right here
        audio.unlock();
        if (toggle === 'sound') audio.toggleSound();
        else audio.toggleMusic();
        audio.play('blip');
        el.querySelector('.title-sys')!.innerHTML = switches();
        return;
      }
      if (target.closest('[data-exit]')) return exit?.();
      const show = target.closest<HTMLElement>('[data-show]')?.dataset.show;
      if (show) {
        // the two panels share the space under the buttons, one at a time
        const saves = el.querySelector<HTMLElement>('#title-saves')!;
        const settings = el.querySelector<HTMLElement>('#title-settings')!;
        const [panel, other] = show === 'saves' ? [saves, settings] : [settings, saves];
        other.hidden = true;
        panel.hidden = !panel.hidden;
        if (!panel.hidden && !panel.childElementCount) {
          if (show === 'saves') mountSaves(panel, { onLoad: finish });
          else mountSettings(panel, { audio, onChange: () => (el.querySelector('.title-sys')!.innerHTML = switches()) });
        }
        return;
      }
      const pick = target.closest<HTMLElement>('[data-pick]')?.dataset.pick;
      if (pick) finish(pick);
    });
  });
}
