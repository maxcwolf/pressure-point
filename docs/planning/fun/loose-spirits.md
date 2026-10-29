# Loose Spirits, and other things that escape a cure

Drafted 27 October 2026. An idea, not a plan: nothing here is decided. It is parked in [the ranked list](README.md), first of the three ideas Max called a maybe.

Ranked lower after Max's review on 27 October 2026: "Maybe, but needs more thought." Revised later that day against [the review](review.md) into a one-page pitch, to pick up whenever it gets that thought. The revision answers the first draft's two open questions. An escapee is now something to clear, not something to chase. One left alone settles into a member of staff, so ignoring it costs instead of paying.

## The pitch

**The moment.** A Massage Therapist finishes Swedish Unwinding at Willow Lane. The red band around the guest's head snaps off with a twang and pings down the corridor, wall to wall, until it reaches the Massage Suite's door and stretches across it. Nobody can get in. The next guest for the suite stands in the corridor in front of it. A guest coming out climbs through, slowly, and gets twanged.

**The verb.** Clear the doorway. Taking a headband off a door is a Caretaker's job, like a puddle or litter. **Send** on its pill puts the nearest free Caretaker on it first, paused or not. The decision is the one a busy month already asks: the flood, the litter or the door.

**The joke.** The healer needs healing. Left on the door for two days, the band lets go and lands on the next member of staff through it, usually the room's own Massage Therapist. Now they have a Tension Headband and work slower, until a colleague is sent over to unwind them.

**The one rule.** A loose thing holds a doorway until someone with the right job clears it. Nothing else is new: the pill, Send and the warnings are the runner's, and sending a colleague to a colleague is the Shaman's soul retrieval.

**The cost.** M, at the small end. Both models exist: the headband is `visual === 'band'`, and the knot is a cached `TorusKnotGeometry`, both in `src/render/models/character.ts`, drawn three times larger. New: the roll at the heal, the doorway hold, an untie job, the ailment on a member of staff, and one pill.

## Why the headband first

Swedish Unwinding is open from the start, so every player meets the headband at Willow Lane in their first hour. The Knot waits for Deep Tissue at the first star. A band pinging off the walls is also funnier to watch than a knot rolling. The Knot keeps the same rule for later: it ties a door shut instead of stretching across it.

## Rules and numbers

All first guesses, for `src/core/data/rules.ts` beside the runaway constants.

1. **Snapping off.** One Swedish Unwinding heal in six, rolled as the heal lands, never on a failure. The heal is paid in full. It is drawn aside from the game's stream, as `rollRunaway` does, so a game with it switched off plays out as today.
2. **One at a time.** One loose thing in the building, and nothing more for 10 days after it is cleared or settles. None while the tutorial's steps are on.
3. **In flight.** For a few seconds it bounces along the corridor. A guest it hits stumbles and loses 5 patience. Then it takes the nearest treatment room's door with a line.
4. **On the door.** Nobody goes in. Anyone leaving takes a 1-second climb. The room's line grows where everyone can see it.
5. **Clearing.** A Caretaker takes it off in 3 seconds, at `caretakerSpeed`. It joins the Caretakers' jobs on its own; Send puts it first.
6. **Settling.** Not cleared in 2 days (12 seconds), it lands on the next member of staff through the door. They wear it, and their services take 20% longer. A colleague trained in Swedish is sent over on Send, as a Shaman is sent for a soul retrieval, and unwinds them in 3 seconds. With nobody trained, it wears off in 10 days.
7. **No reward.** Nothing pays. Clearing it fast loses the least, which is the whole incentive.

## Fair play

- **Warned of.** The first diagnosis of a Tension Headband brings a tip: "Headbands sometimes snap off in the unwinding. A Caretaker can take one off a door." The first one loose opens a lesson card, paused. Each one gets a PA line, a toast with **Show me** and a pill counting the days. Settling names the member of staff in a toast.
- **Counterplay.** Send a Caretaker. Keep a Caretaker free. Send a colleague to the one wearing it.
- **Not easier.** A closed door then a slow member of staff, each with a fix. The best case is a few seconds of a Caretaker's time.

## The jokes

PA lines, all name-free:

- "A headband is loose in the corridor. Guests are asked to duck."
- "Guests are asked not to pluck the doorway during a session."
- "Staff are reminded that headbands found on colleagues must be handed in at reception."

The loose headband's inspector card: "A band of pure tension, now without a head." A guest it hit, in review: "I was flicked on the ear by a headband that was not mine."

## Where it plugs in

Each checked in the code on 27 October 2026.

- **The heal.** The heal branch in `src/core/sim/stations.ts` (where `g.outcome = 'healed'`). `rollRunaway` in `src/core/sim/runaways.ts` is the model for rolling aside from the stream.
- **The door.** The blocking and door grids, and pathfinding, in `src/core/world.ts`.
- **The untie.** A Caretaker job beside `litter`, `smudge` and `douse` in `src/core/sim/staffing.ts`, timed by `caretakerSpeed`.
- **The pill and Send.** `src/ui/components/RunnerNotice.tsx`, `src/ui/lib/calming.ts` and `sendToCalm` in `runaways.ts`. It shares the runner pills' slot and their limit of three. In the interface it is "loose", never "runaway" or "runner".
- **The member of staff.** `serviceSeconds` in `stations.ts` for the slower work. `canRetrieve` and the soul job in `src/core/sim/souls.ts` are the model for sending a colleague.
- **On screen.** The red runner ring in `src/render/halos.ts` is an `InstancedMesh`, so a ring of another color costs no draw call. `tipOnce`, `toast` and `emit` in `src/core/sim/events.ts`; lessons in `src/core/sim/lessons.ts`.

## Later, if it lands

- **The Knot**, wherever Deep Tissue is taught: ties a door shut, same rule. Review line: "Waited twenty minutes outside a door someone had tied in a bow."
- **The Earworm**, at High Pines and The Orchard Estate: perches in a waiting area, and everyone within two tiles hums. The hum is noise (`src/core/sim/noise.ts`), answered by moving the benches, Soundproof Panels (noise −4) or a Sound Healer. PA: "Guests humming in the waiting area will be charged for a session."
- **The chicken spirit**, at The Orchard Estate: roosts on a table, which is out until a Shaman shoos it. PA: "A chicken has come out of a guest. Please do not encourage it."
- **The Auto-Reply**, at The Exchange only, where office-speak belongs: hovers over Reception. Its card: "Will respond on return. Will not return."
- **The build work, after the pick:** state for the loose thing and the worn ailment, a save bump from 40, a bot that sends, play events, and a sandbox switch beside Fires and Mishaps in `src/ui/components/SandboxPanel.tsx`.
- **Cut:** the goat, the chakra hunt, the Brent spirit, Colonel the Chicken, the Spirit Jar and Shelf, and the achievements.
