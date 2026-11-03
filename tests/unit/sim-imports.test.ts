// How the modules of src/core/sim import each other, kept from tangling again: no two import each other but the pair
// known to, and the one group of modules that reach each other in a loop grows no bigger. Imports of types alone are
// left out, as they are gone at run time. See docs/dev/architecture.md, on the simulation's layers.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SIM = join(import.meta.dirname, '../../src/core/sim');

/** The two-way imports there are, and why each is left. */
const KNOWN_PAIRS = [
  // a stress outbreak has its runners calmed, and a runner spreads the outbreak's stress to those they freak out
  'outbreaks.ts <-> runaways.ts',
];

/**
 * The most modules that may reach each other in a loop: the staff and guests at work, and the features that both
 * call them and are called from their day (house calls, courses, classes, bad trips, the rival).
 */
const KNOT_MOST = 14;

/** Each sim module and the sim modules it imports at run time. */
function imports(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const file of readdirSync(SIM).filter((f) => f.endsWith('.ts'))) {
    const deps = new Set<string>();
    const src = readFileSync(join(SIM, file), 'utf8');
    for (const m of src.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s+from\s+'\.\/([\w-]+)'/gm)) {
      const names = (m[2] ?? '').split(',').map((s) => s.trim());
      if (m[1] || names.every((n) => !n || n.startsWith('type '))) continue;
      deps.add(`${m[3] ?? ''}.ts`);
    }
    graph.set(file, deps);
  }
  return graph;
}

/** The groups of modules that reach each other in a loop, the biggest first (Tarjan's algorithm). */
function loops(graph: Map<string, Set<string>>): string[][] {
  let next = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const groups: string[][] = [];
  /** Visit a module and everything it imports that is not visited yet. */
  const visit = (v: string) => {
    index.set(v, next);
    low.set(v, next++);
    stack.push(v);
    for (const w of graph.get(v) ?? []) {
      if (!graph.has(w)) continue;
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
      } else if (stack.includes(w)) low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0));
    }
    if (low.get(v) !== index.get(v)) return;
    const group: string[] = [];
    let w: string | undefined;
    do {
      w = stack.pop();
      if (w) group.push(w);
    } while (w && w !== v);
    groups.push(group.sort());
  };
  for (const v of graph.keys()) if (!index.has(v)) visit(v);
  return groups.sort((a, b) => b.length - a.length);
}

describe('the sim modules', () => {
  const graph = imports();

  it('import each other two ways only where it is known', () => {
    const pairs: string[] = [];
    for (const [a, deps] of graph) for (const b of deps) if (a < b && graph.get(b)?.has(a)) pairs.push(`${a} <-> ${b}`);
    expect(pairs.sort()).toEqual(KNOWN_PAIRS);
  });

  it('keep the one loop among them from growing', () => {
    const [biggest = []] = loops(graph);
    expect(biggest.length, biggest.join(' ')).toBeLessThanOrEqual(KNOT_MOST);
  });
});
