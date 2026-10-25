// Turns the playtest logs of `yarn balance` (balance-results/balance.json) into the markdown the balance log reads: the
// table of entries 27 to 31, the same table before → after when given a second run, and the fairness slices of
// docs/research/fair-challenge.md (per-seed survival, the warning before each loss, reputation cliffs, spirals after
// adverse events, and how much of the income is not treatments). Pure: no files, no game code, so that
// scripts/balance-report.mjs can run it with Node's own type stripping. See docs/balance/harness.md.
import type { IncomeBy, MonthLog, Playtest, RunnerLog } from './bot';

/**
 * A run as the report reads it. Logs written before the bot kept every adverse event, the warnings, the day of
 * bankruptcy and the income by source lack those, and the report makes do without them.
 */
export type Run = Omit<Playtest, 'adverse' | 'warnings' | 'bankruptDay' | 'machines' | 'months'> & {
  machines?: Playtest['machines'];
  adverse?: Playtest['adverse'];
  warnings?: Playtest['warnings'];
  bankruptDay?: number | null;
  months: (Omit<MonthLog, 'incomeBy'> & { incomeBy?: IncomeBy })[];
};

/** Days in a game month, as in src/core/data/rules.ts. */
const DAYS_PER_MONTH = 30;
/** Profit a month is averaged from this month on: the second year. */
export const PROFIT_FROM = 13;
/** A month whose lowest reputation is under this is a month below 15%. */
const LOW_REP = 15;
/** A fall of this many points of reputation within a month is a cliff. */
export const CLIFF = 20;
/** A month after an adverse event that a cliff counts as following it: the month itself and the next two. */
const SPIRAL_MONTHS = 3;
/** A bankruptcy with no warning in this many days before it came without one. */
const WARNED_WITHIN = 10;
/** The months at which the side incomes' share is shown. */
const SIDE_AT = [12, 24, 48];
/** The incomes that are not treatments or consultations. */
const SIDE: readonly (keyof IncomeBy)[] = ['classes', 'calls', 'shop', 'mushrooms', 'vending', 'bonus'];
/** Every income, the side ones and treatments and consultations. */
const INCOMES: readonly (keyof IncomeBy)[] = ['treatment', 'consult', ...SIDE];

/** The centers' names, as the balance log gives them; any other is shown by its id. */
const NAMES: Record<string, string> = {
  willow: 'Willow Lane',
  exchange: 'The Exchange',
  boardwalk: 'The Boardwalk',
  highpines: 'High Pines',
  orchard: 'The Orchard Estate',
};
/** A center's name for the tables. */
const nameOf = (center: string) => NAMES[center] ?? center;

// ---- reading a run -------------------------------------------------------------

/** The day the run went bankrupt, from the log, or from its note in an older log; null if it did not. */
export function bankruptDay(run: Run): number | null {
  if (run.bankruptDay !== undefined) return run.bankruptDay;
  for (const n of run.notes) {
    const m = /^day (\d+): BANKRUPT/.exec(n);
    if (m) return Number(m[1]);
  }
  return null;
}

/** A month's profit or loss. */
const profit = (m: Run['months'][number]) => m.income - m.spending;
/** The mean of some figures, or null for none. */
const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

/** The figures of the balance log's table for one run. */
export interface RunFigures {
  seed: number;
  /** Stars at month, as the table writes them: "1.1/8.9/15.0", with "bankrupt day N" for the star it never saw. */
  stars: string;
  profit: number | null;
  lossMonths: number;
  lowestRep: number;
  lowMonths: number;
  bank: number | null;
  loan: number | null;
  bankruptDay: number | null;
}

/** A day as months into the game, one decimal. */
const months = (day: number) => (day / DAYS_PER_MONTH).toFixed(1);

/** One run's figures for the table. */
export function figures(run: Run): RunFigures {
  const bust = bankruptDay(run);
  const stars: string[] = [];
  for (const d of run.starDays) {
    if (d !== null) stars.push(months(d));
    else if (bust !== null && !stars.some((s) => s.startsWith('bankrupt'))) stars.push(`bankrupt day ${bust}`);
    else stars.push('–');
  }
  const last = run.months.at(-1);
  return {
    seed: run.seed,
    stars: stars.join('/'),
    profit: mean(run.months.filter((m) => m.month >= PROFIT_FROM).map(profit)),
    lossMonths: run.months.filter((m) => profit(m) < 0).length,
    lowestRep: Math.min(...run.months.map((m) => m.repLow)),
    lowMonths: run.months.filter((m) => m.repLow < LOW_REP).length,
    bank: last ? last.money : null,
    loan: last ? last.loan : null,
    bankruptDay: bust,
  };
}

// ---- formatting ---------------------------------------------------------------

/** Dollars in thousands, one decimal, with a true minus sign: "$17.2k", "−$0.4k". */
export function money(x: number | null): string {
  if (x === null) return '–';
  const k = Math.round(x / 100) / 10;
  return `${k < 0 ? '−' : ''}$${Math.abs(k).toFixed(1)}k`;
}

/** The range of some figures across seeds, "a to b", or one figure when they agree. */
function range(xs: (number | null)[], show: (x: number) => string = String): string {
  const ns = xs.filter((x): x is number => x !== null);
  if (ns.length === 0) return '–';
  const lo = Math.min(...ns);
  const hi = Math.max(...ns);
  return lo === hi ? show(lo) : `${show(lo)} to ${show(hi)}`;
}

/** A share as a whole percentage. */
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** A figure to the nearest whole number. */
const round = (x: number) => String(Math.round(x));

/** A markdown table. */
function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ]
    .join('\n')
    .concat('\n');
}

/** The runs by center, in the order the centers first appear, each center's seeds in order. */
export function byCenter(runs: Run[]): [string, Run[]][] {
  const out = new Map<string, Run[]>();
  for (const r of runs) out.set(r.center, [...(out.get(r.center) ?? []), r]);
  for (const rs of out.values()) rs.sort((a, b) => a.seed - b.seed);
  return [...out.entries()];
}

// ---- the balance log's table ----------------------------------------------------

const COLUMNS = [
  'Center',
  'Stars at month (seed by seed)',
  'Profit a month',
  'Months at a loss',
  'Lowest reputation',
  'Months below 15%',
  'Bank at the end',
  'Bankruptcies',
];

/** The cells of one center's row, after the name. */
function cells(runs: Run[]): string[] {
  const fs = runs.map(figures);
  const bust = fs.filter((f) => f.bankruptDay !== null);
  return [
    fs.map((f) => f.stars).join(' · '),
    range(
      fs.map((f) => f.profit),
      money,
    ),
    range(fs.map((f) => f.lossMonths)),
    range(
      fs.map((f) => f.lowestRep),
      round,
    ),
    range(fs.map((f) => f.lowMonths)),
    range(
      fs.map((f) => f.bank),
      money,
    ),
    bust.length === 0 ? 'none' : bust.map((f) => `seed ${f.seed} day ${f.bankruptDay}`).join(', '),
  ];
}

/** The balance log's table for one run of `yarn balance`. */
export function summaryTable(runs: Run[]): string {
  return table(
    COLUMNS,
    byCenter(runs).map(([center, rs]) => [nameOf(center), ...cells(rs)]),
  );
}

/** The same table as before → after, a cell that did not change marked "(unchanged)", as entry 31 has it. */
export function compareTable(after: Run[], before: Run[]): string {
  const old = new Map(byCenter(before));
  return table(
    COLUMNS,
    byCenter(after).map(([center, rs]) => {
      const now = cells(rs);
      const was = old.get(center);
      if (!was) return [nameOf(center), ...now.map((c) => `(new) → ${c}`)];
      const then = cells(was);
      return [nameOf(center), ...now.map((c, i) => (then[i] === c ? `${c} (unchanged)` : `${then[i] ?? '–'} → ${c}`))];
    }),
  );
}

// ---- fairness slices -------------------------------------------------------------

/** A month in which reputation fell by a cliff, and what happened to the guests in it. */
export interface Cliff {
  center: string;
  seed: number;
  month: number;
  from: number;
  to: number;
  worse: number;
  stormed: number;
  failed: number;
}

/**
 * The months in which reputation fell `CLIFF` points or more: from the end of the month before to the lowest seen
 * in the month. The first month has no month before and is never one.
 */
export function cliffs(run: Run): Cliff[] {
  const out: Cliff[] = [];
  for (let i = 1; i < run.months.length; i++) {
    const prev = run.months[i - 1];
    const m = run.months[i];
    if (!prev || !m || prev.rep - m.repLow < CLIFF) continue;
    out.push({
      center: run.center,
      seed: run.seed,
      month: m.month,
      from: prev.rep,
      to: m.repLow,
      worse: m.worse,
      stormed: m.stormed,
      failed: m.failed,
    });
  }
  return out;
}

/** The month of the log a day falls in: the month that closes after it. */
const monthOf = (day: number) => Math.floor(day / DAYS_PER_MONTH) + 1;

/** Whether a cliff comes in the month starting at `from` or the `SPIRAL_MONTHS - 1` after it. */
const cliffWithin = (cliffMonths: Set<number>, from: number) =>
  Array.from({ length: SPIRAL_MONTHS }, (_, k) => from + k).some((m) => cliffMonths.has(m));

/** The spiral check for some runs: how often an adverse event is followed by a cliff, against how often any month is. */
export interface Spiral {
  what: string;
  events: number;
  followed: number;
}

/**
 * For each kind of adverse event, and for all of them together, the events followed by a cliff within
 * `SPIRAL_MONTHS` months; and the share of all months that are, which is the chance of one anyway. Only events in
 * months the log covers, with the months after them, are counted.
 */
export function spirals(runs: Run[]): { kinds: Spiral[]; all: Spiral; base: { months: number; followed: number } } {
  const kinds = new Map<string, Spiral>();
  const all: Spiral = { what: 'every adverse event', events: 0, followed: 0 };
  const base = { months: 0, followed: 0 };
  for (const run of runs) {
    const last = run.months.at(-1)?.month ?? 0;
    const cliffMonths = new Set(cliffs(run).map((c) => c.month));
    for (let m = 2; m + SPIRAL_MONTHS - 1 <= last; m++) {
      base.months++;
      if (cliffWithin(cliffMonths, m)) base.followed++;
    }
    for (const a of run.adverse ?? []) {
      const m = Math.max(2, monthOf(a.day));
      if (m + SPIRAL_MONTHS - 1 > last) continue;
      const followed = cliffWithin(cliffMonths, m) ? 1 : 0;
      const kind = a.what.startsWith('mishap') ? 'mishap' : a.what;
      const k = kinds.get(kind) ?? { what: kind, events: 0, followed: 0 };
      k.events++;
      k.followed += followed;
      kinds.set(kind, k);
      all.events++;
      all.followed += followed;
    }
  }
  return { kinds: [...kinds.values()].sort((a, b) => b.events - a.events), all, base };
}

/**
 * The side incomes' share of a month's income, or null if the month is not logged or has no breakdown or income. A
 * game played to the end of a month can stop a few ticks short of closing it, so the month before stands in for the
 * month just past the log's end.
 */
export function sideShare(run: Run, month: number): number | null {
  const last = run.months.at(-1);
  const m = run.months.find((x) => x.month === month) ?? (last?.month === month - 1 ? last : undefined);
  if (!m?.incomeBy) return null;
  const by = m.incomeBy;
  const total = INCOMES.reduce((a, k) => a + by[k], 0);
  if (total <= 0) return null;
  return SIDE.reduce((a, k) => a + by[k], 0) / total;
}

/** The fairness slices for one run of `yarn balance`. */
export function fairness(runs: Run[]): string {
  const out: string[] = [];
  const centers = byCenter(runs);

  out.push('### Survival, seed by seed\n');
  out.push(
    table(
      ['Center', 'Seed', 'Outcome', 'First adverse event', 'Days from it to the end', 'Last warning before the end'],
      runs.map((r) => {
        const bust = bankruptDay(r);
        const first = r.firstAdverse;
        if (bust === null)
          return [
            nameOf(r.center),
            String(r.seed),
            'survived',
            first ? `${first.what}, day ${first.day}` : '–',
            '–',
            '–',
          ];
        // the day's own news of the bankruptcy is no warning of it
        const earlier = (r.warnings ?? []).filter((w) => w.day < bust);
        const before = earlier.at(-1);
        const month = earlier.filter((w) => w.day >= bust - DAYS_PER_MONTH).length;
        const gap = before ? bust - before.day : null;
        const warned =
          r.warnings === undefined
            ? 'not logged'
            : gap === null
              ? '**none** ⚠'
              : `${gap} days before: “${before?.text ?? ''}”${gap > WARNED_WITHIN ? ' ⚠ none in the last 10 days' : ''}` +
                ` (${month} in the last ${DAYS_PER_MONTH} days)`;
        return [
          nameOf(r.center),
          String(r.seed),
          `**bankrupt day ${bust}**`,
          first ? `${first.what}, day ${first.day}` : '–',
          first ? String(bust - first.day) : '–',
          warned,
        ];
      }),
    ),
  );

  const all = runs.flatMap(cliffs);
  out.push(`\n### Reputation cliffs: a fall of ${CLIFF} points or more within a month\n`);
  out.push(
    table(
      ['Center', 'Cliffs (all seeds)', 'Seeds with one', 'Months (seed: month from → low; worse, stormed, failed)'],
      centers.map(([center, rs]) => {
        const cs = all.filter((c) => c.center === center);
        return [
          nameOf(center),
          String(cs.length),
          `${new Set(cs.map((c) => c.seed)).size} of ${rs.length}`,
          cs.length === 0
            ? '–'
            : cs
                .map(
                  (c) =>
                    `${c.seed}: ${c.month} ${round(c.from)} → ${round(c.to)}; ${c.worse}, ${c.stormed}, ${c.failed}`,
                )
                .join(' · '),
        ];
      }),
    ),
  );

  const sp = spirals(runs);
  const baseShare = sp.base.months ? sp.base.followed / sp.base.months : 0;
  out.push(`\n### Spirals: a cliff within ${SPIRAL_MONTHS} months of an adverse event, against any month\n`);
  if (sp.all.events === 0 && runs.every((r) => r.adverse === undefined)) out.push('Adverse events not logged.\n');
  else
    out.push(
      table(
        ['Event', 'Events', 'Followed by a cliff', 'Share', 'Against any month'],
        [sp.all, ...sp.kinds].map((k) => [
          k === sp.all ? `**${k.what}**` : k.what,
          String(k.events),
          String(k.followed),
          k.events ? pct(k.followed / k.events) : '–',
          `${pct(baseShare)} (${sp.base.followed} of ${sp.base.months})`,
        ]),
      ),
    );

  out.push(`\n### Side incomes: classes, calls, shop, vending and bonuses, as a share of income (seed by seed)\n`);
  out.push(
    table(
      ['Center', ...SIDE_AT.map((m) => `Month ${m}`)],
      centers.map(([center, rs]) => [
        nameOf(center),
        ...SIDE_AT.map((m) =>
          rs
            .map((r) => sideShare(r, m))
            .map((x) => (x === null ? '–' : pct(x)))
            .join(' · '),
        ),
      ]),
    ),
  );
  return out.join('\n');
}

// ---- really bad trips -------------------------------------------------------------

/** One center's really bad trips over every seed and month: the bad trips, and how each run ended. */
export function runnerTotals(runs: Run[]): RunnerLog | null {
  const months = runs.flatMap((r) => r.months.map((m) => m.runners).filter((x) => x !== undefined));
  if (!months.length) return null;
  /** One count, summed over the months. */
  const sum = (k: keyof RunnerLog) => months.reduce((a, m) => a + m[k], 0);
  return {
    badTrips: sum('badTrips'),
    started: sum('started'),
    calmed: sum('calmed'),
    inTime: sum('inTime'),
    calmDays: sum('calmDays'),
    door: sum('door'),
  };
}

/** The cells of one center's row of really bad trips, after the name. */
function runnerCells(n: RunnerLog | null): string[] {
  if (!n) return ['–', '–', '–', '–', '–', '–'];
  return [
    String(n.badTrips),
    n.badTrips ? `${n.started} (${pct(n.started / n.badTrips)})` : String(n.started),
    String(n.calmed),
    n.calmed ? `${n.inTime} (${pct(n.inTime / n.calmed)})` : '0',
    n.calmed ? (n.calmDays / n.calmed).toFixed(1) : '–',
    String(n.door),
  ];
}

/** Every center's really bad trips, before → after with a second run; empty if no run logged them. */
export function runnerTable(after: Run[], before?: Run[]): string {
  const old = new Map(byCenter(before ?? []));
  const rows = byCenter(after)
    .map(([center, rs]) => {
      const now = runnerTotals(rs);
      if (!now?.badTrips) return null;
      const was = before ? runnerCells(runnerTotals(old.get(center) ?? [])) : null;
      return [nameOf(center), ...runnerCells(now).map((c, i) => (was ? `${was[i] ?? '–'} → ${c}` : c))];
    })
    .filter((r) => r !== null);
  if (!rows.length) return '';
  return table(
    ['Center', 'Bad trips', 'Ran (share of bad trips)', 'Calmed', 'Within 3 days', 'Days to calm', 'Found the door'],
    rows,
  );
}

/** The whole report: the table (before → after with a second run), then the fairness slices of the first. */
export function report(after: Run[], before?: Run[]): string {
  const days = Math.max(...after.map((r) => r.months.length)) * DAYS_PER_MONTH;
  const out = [`## Balance report: ${after.length} runs, up to ${days} days\n`];
  out.push(
    `Stars at month seed by seed; profit a month averaged from month ${PROFIT_FROM} on; months at a loss, the lowest ` +
      `reputation (sampled daily) and months below ${LOW_REP}% of every month played; the bank at the last month.\n`,
  );
  out.push(summaryTable(after));
  if (before) {
    out.push('\n### Before → after\n');
    out.push(compareTable(after, before));
  }
  const runners = runnerTable(after, before);
  if (runners) out.push(`\n### Really bad trips${before ? ', before → after' : ''}\n`, runners);
  out.push(`\n${fairness(after)}`);
  return out.join('\n');
}
