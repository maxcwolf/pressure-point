// Assigning staff to rooms: they take posts and do their chores only in the rooms they are given.
import { describe, expect, it } from 'vitest';

import { assignHint, assignProblem } from '../../src/app/tools/hints';
import { assignTiles } from '../../src/app/tools/overlay';
import { Tools } from '../../src/app/tools/tools';
import { assignableRole, canWorkIn, roomLabels, toggled, worksIn } from '../../src/core/sim/assignments';
import { createContext } from '../../src/core/sim/context';
import { roomToSmudge } from '../../src/core/sim/vibes';
import type { GameState, Room } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { OV_BAD, OV_BLUE, OV_GOOD } from '../../src/render/overlay-codes';
import type { View } from '../../src/render/view';
import {
  addPostureLab,
  addReiki,
  addRestroom,
  buildRoom,
  hire,
  inconsistencies,
  LAYOUT,
  openCenter,
  run,
  runUntil,
} from './helpers';

/** A room of a kind, at a spot, for the functions that only look at its fields. */
function room(id: number, type: Room['type'], x = 0, y = 0): Room {
  return {
    id,
    type,
    x,
    y,
    w: 2,
    h: 2,
    door: { x, y, dx: 0, dy: -1 },
    windows: [],
    done: true,
    priority: false,
    vibes: 0,
    claimedBy: 0,
  };
}

/** A second Massage Suite, across the building from the first. */
function addSecondSuite(sim: ReturnType<typeof openCenter>['sim']) {
  return buildRoom(sim, 'massage', LAYOUT.assess.rect, LAYOUT.assess.door, [
    ['massage_table', 20, 11],
    ['oil_trolley', 22, 11],
  ]);
}

/** The room a member of staff's post is in, or 0 for none. */
function postRoom(sim: ReturnType<typeof openCenter>['sim'], post: number): number {
  const it = sim.world.item(post);
  return it ? sim.world.zoneAt(it.x, it.y) : 0;
}

describe('where someone may work', () => {
  it('is anywhere with no rooms, and only in their rooms with some', () => {
    expect(worksIn([], 0)).toBe(true);
    expect(worksIn([], 5)).toBe(true);
    expect(worksIn([5, 8], 8)).toBe(true);
    expect(worksIn([5, 8], 6)).toBe(false);
    expect(worksIn([5], 0), 'a corridor').toBe(false);
  });

  it('is a room with a station of theirs, or any room for a Caretaker', () => {
    expect(canWorkIn('therapist', 'massage')).toBe(true);
    expect(canWorkIn('therapist', 'reiki')).toBe(false);
    expect(canWorkIn('consultant', 'consult')).toBe(true);
    expect(canWorkIn('consultant', 'assess'), 'the Posture Scanner runs itself').toBe(false);
    expect(canWorkIn('consultant', 'massage')).toBe(false);
    expect(canWorkIn('practitioner', 'reiki')).toBe(true);
    expect(canWorkIn('caretaker', 'restroom')).toBe(true);
    expect(canWorkIn('caretaker', 'staffroom')).toBe(true);
    expect(canWorkIn('receptionist', 'consult')).toBe(false);
  });

  it('leaves a Receptionist out, whose desk and counter are in the corridors', () => {
    expect(assignableRole('receptionist')).toBe(false);
    for (const role of ['consultant', 'therapist', 'acupuncturist', 'practitioner', 'caretaker'] as const)
      expect(assignableRole(role), role).toBe(true);
  });

  it('adds a room, or takes it away when it is already there', () => {
    expect(toggled([], 4)).toEqual([4]);
    expect(toggled([4, 6], 4)).toEqual([6]);
    expect(toggled([6], 4)).toEqual([6, 4]);
  });
});

describe('room names', () => {
  it('number rooms of a kind in the order they were built, and leave a room of its own kind plain', () => {
    const labels = roomLabels([room(9, 'massage'), room(3, 'massage'), room(5, 'consult')]);
    expect(labels.get(3)).toBe('Massage Suite 1');
    expect(labels.get(9)).toBe('Massage Suite 2');
    expect(labels.get(5)).toBe('Consultation Room');
  });
});

describe('a member of staff assigned to a room', () => {
  it('works there and nowhere else, even when the other room is busier', () => {
    const { sim, therapist, massage } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    expect(postRoom(sim, therapist.post)).toBe(massage.id);
    const second = addSecondSuite(sim);
    expect(sim.assignRoom(therapist.id, second.id)).toBe(true);
    runUntil(sim, () => therapist.state === 'atPost' && postRoom(sim, therapist.post) === second.id, 120);
    // guests keep arriving, and line up at the first suite's table, but they stay where they were put
    for (let i = 0; i < 30; i++) {
      run(sim, 4);
      if (therapist.post) expect(postRoom(sim, therapist.post)).toBe(second.id);
    }
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('can be let work anywhere again', () => {
    const { sim, therapist, massage } = openCenter(1);
    const second = addSecondSuite(sim);
    sim.assignRoom(therapist.id, second.id);
    expect(therapist.rooms).toEqual([second.id]);
    expect(sim.clearRooms(therapist.id)).toBe(true);
    expect(therapist.rooms).toEqual([]);
    expect(sim.assignRoom(therapist.id, massage.id)).toBe(true);
    expect(sim.assignRoom(therapist.id, massage.id), 'clicked again').toBe(true);
    expect(therapist.rooms).toEqual([]);
  });

  it('is refused a room with no work for them, or one still a blueprint', () => {
    const { sim, therapist, consult, receptionist } = openCenter(1);
    expect(sim.assignRoom(therapist.id, consult.id)).toBe(false);
    expect(sim.assignRoom(receptionist.id, consult.id)).toBe(false);
    const plan = sim.createRoom('massage', LAYOUT.assess.rect, LAYOUT.assess.door);
    expect(sim.assignRoom(therapist.id, plan.id)).toBe(false);
    expect(sim.assignRoom(999, consult.id), 'nobody').toBe(false);
    expect(therapist.rooms).toEqual([]);
  });

  it('is taken off a room when it is demolished', () => {
    const { sim, therapist, massage } = openCenter(1);
    const second = addSecondSuite(sim);
    sim.assignRoom(therapist.id, second.id);
    sim.assignRoom(therapist.id, massage.id);
    sim.removeRoom(second.id, 0.5);
    expect(therapist.rooms).toEqual([massage.id]);
  });
});

describe('a Caretaker assigned to a room', () => {
  it('leaves the litter outside it for someone else', () => {
    const { sim, s } = openCenter(1);
    const restroom = addRestroom(sim);
    const caretaker = hire(sim, 'caretaker');
    runUntil(sim, () => caretaker.state === 'idle' || caretaker.state === 'wander', 60);
    expect(sim.assignRoom(caretaker.id, restroom.id)).toBe(true);
    // litter right beside them in the corridor, and some in the restroom across the building
    s.litter.push({ id: 90001, x: caretaker.tx, y: caretaker.ty, claimedBy: 0 });
    s.litter.push({ id: 90002, x: 22, y: 6, claimedBy: 0 });
    expect(sim.world.zoneAt(22, 6)).toBe(restroom.id);
    runUntil(sim, () => caretaker.job?.kind === 'litter', 30);
    expect(caretaker.job?.id).toBe(90002);
    runUntil(sim, () => !s.litter.some((l) => l.id === 90002), 60);
    run(sim, 20);
    expect(
      s.litter.some((l) => l.id === 90001),
      'the corridor litter is still there',
    ).toBe(true);
  });
});

describe('a Reiki Practitioner assigned to rooms', () => {
  it('only clears bad vibes in those rooms', () => {
    const { sim, massage } = openCenter(1);
    const reiki = addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    const ctx = createContext(sim.s);
    massage.vibes = 60;
    expect(roomToSmudge(ctx, practitioner)).toBe(massage);
    sim.assignRoom(practitioner.id, reiki.id);
    expect(roomToSmudge(ctx, practitioner)).toBeUndefined();
    reiki.vibes = 30;
    expect(roomToSmudge(ctx, practitioner)).toBe(reiki);
  });
});

describe('a save from when a Consultant worked the Posture Scanner', () => {
  it('frees whoever was posted there, and keeps nobody from scans', () => {
    const { sim, s, consultant } = openCenter(1);
    addPostureLab(sim);
    const scanner = s.items.find((i) => i.type === 'posture_scanner')!;
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    const was = old.staff.find((st: { id: number }) => st.id === consultant.id);
    Object.assign(was, { post: scanner.id, state: 'atPost', busy: true, off: ['assess'] });
    old.items.find((it: { id: number }) => it.id === scanner.id).staffId = consultant.id;
    upgradeSave(old as GameState);
    const st = (old as GameState).staff.find((x) => x.id === consultant.id)!;
    expect(st).toMatchObject({ post: 0, state: 'idle', busy: false, off: [] });
    expect((old as GameState).items.find((it) => it.id === scanner.id)!.staffId).toBe(0);
  });
});

describe('a save from before staff could be assigned to rooms', () => {
  it('lets everyone work anywhere', () => {
    const { s } = openCenter(1);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    for (const st of old.staff) Reflect.deleteProperty(st, 'rooms');
    upgradeSave(old as GameState);
    for (const st of (old as GameState).staff) expect(st.rooms).toEqual([]);
  });
});

describe('the assign tool', () => {
  it('says who is being assigned and how many rooms they have', () => {
    expect(assignHint('Ada', 0)).toContain('Ada works anywhere');
    expect(assignHint('Ada', 1)).toContain('works in 1 room ·');
    expect(assignHint('Ada', 3)).toContain('works in 3 rooms');
    expect(assignProblem('therapist', 'consult')).toBe(
      'There is no work for a Massage Therapist in a Consultation Room',
    );
  });

  it('colors their rooms green, and the room under the cursor blue if they could work there or red', () => {
    const a = room(1, 'massage', 0, 0);
    const b = room(2, 'massage', 5, 0);
    /** The colors among some tiles. */
    const codes = (tiles: [number, number, number][]) => [...new Set(tiles.map((t) => t[2]))];
    expect(codes(assignTiles([a], undefined, false))).toEqual([OV_GOOD]);
    expect(assignTiles([a], b, true).filter((t) => t[2] === OV_BLUE)).toHaveLength(4);
    expect(assignTiles([a], b, false).filter((t) => t[2] === OV_BAD)).toHaveLength(4);
    expect(codes(assignTiles([a], a, true)), 'hovering one of theirs').toEqual([OV_GOOD]);
  });

  it('adds the room clicked, and takes it away on a second click', () => {
    const { sim, therapist, massage, consult } = openCenter(1);
    /** Ignore a call to the scene. */
    const nothing = () => undefined;
    let ground = { x: massage.x + 1.5, y: massage.y + 1.5 };
    const view = {
      selected: null,
      setOverlay: nothing,
      setMarkers: nothing,
      setGhost: nothing,
      setDoor: nothing,
      /** The point under the cursor: wherever the test has put it. */
      groundAt: () => ground,
    };
    const sounds: string[] = [];
    const tools = new Tools(sim, view as unknown as View, nothing, (n) => sounds.push(n));
    tools.startAssign(therapist.id);
    expect(view.selected).toEqual({ kind: 'staff', id: therapist.id });
    expect(tools.hint).toContain(`${therapist.name} works anywhere`);
    tools.pointerUp(0, 0);
    expect(therapist.rooms).toEqual([massage.id]);
    tools.pointerUp(0, 0);
    expect(therapist.rooms).toEqual([]);
    ground = { x: consult.x + 1.5, y: consult.y + 1.5 };
    tools.pointerMove(0, 0);
    expect(tools.problem).toContain('no work for a Massage Therapist');
    tools.pointerUp(0, 0);
    expect(therapist.rooms).toEqual([]);
    expect(sounds).toEqual(['blip', 'blip', 'error']);
    tools.back();
    expect(tools.tool.kind).toBe('none');
  });
});
