// Questions about an open blueprint and what is in hand.

import type { ItemType } from '../../core/data';
import type { Room } from '../../core/state/types';
import type { HeldItem, PlanStatus, PlanSub, Tool } from './types';

/** The next piece of required furniture to hand over, or nothing once it is all in. */
export function nextRequired(missing: readonly ItemType[]): PlanSub {
  const next = missing[0];
  return next ? { kind: 'item', type: next, rot: 0, required: true } : null;
}

/** A blueprint's state, for the panel that shows it. */
export function planStatus(room: Room, missing: ItemType[], sub: PlanSub): PlanStatus {
  return {
    room,
    missing,
    holding: !sub ? '' : sub.kind === 'item' ? sub.type : sub.kind,
    ready: missing.length === 0,
  };
}

/** The item in hand that R would turn, if there is one. */
export function heldItem(tool: Tool): HeldItem | null {
  if (tool.kind === 'item' || tool.kind === 'move') return tool;
  if (tool.kind === 'room' && tool.phase === 'plan' && tool.sub?.kind === 'item') return tool.sub;
  return null;
}

/**
 * Whether the tool in hand is placing a room or an item, which the clock stops for: a room from its floor to its
 * Build, one pencilled in, from a template or picked up, and an item bought or moved.
 */
export function placing(tool: Tool): boolean {
  switch (tool.kind) {
    case 'item':
    case 'move':
    case 'room':
    case 'sketch':
    case 'template':
    case 'moveRoom':
      return true;
    case 'none':
    case 'window':
    case 'door':
    case 'resize':
    case 'assign':
    case 'expand':
      return false;
  }
}

/** A quarter turn on from a rotation, wrapping after four. */
export function quarterTurn(rot: number): number {
  return (rot + 1) & 3;
}
