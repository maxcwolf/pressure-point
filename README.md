# Pressure Point

A healing-centre management sim for macOS and Windows, in the spirit of the classic hospital tycoon games. Build rooms, hire staff, and untie the public.

The MVP covers **massage therapy**. Acupuncture and reiki are planned.

![A busy healing centre](docs/screenshot.png)

## Play

```bash
yarn install
yarn dev        # in the browser at http://localhost:5183
yarn app        # as a desktop app (builds, then opens Electron)
```

Package installers into `release/`:

```bash
yarn dist:mac   # .dmg
yarn dist:win   # .exe installer (x64)
```

## How it plays

1. Place a **Reception Desk** and hire a **Receptionist**.
2. Build a **Consultation Room** (drag the floor, click a wall for the door, place the furniture) and hire a **Wellness Consultant**.
3. Build a **Massage Suite** and hire a **Massage Therapist**. The centre opens once all three exist.
4. Guests check in, get diagnosed, get treated, and pay. Keep them patient with benches, tea, snacks, plants and a restroom.
5. Staff tire. A **Staff Room** lets them recover; a **Caretaker** clears litter and waters plants.
6. Salaries come out at the end of each month. Hit the objectives to earn stars.

| Input | Action |
| --- | --- |
| Left click | Select, place, confirm |
| Drag, or W A S D | Move the camera |
| Scroll | Zoom |
| R | Rotate furniture |
| Esc / right click | Cancel |
| Space, 1 2 3 | Pause, game speed |

The game autosaves to local storage every few seconds.

## Code map

| Path | What lives there |
| --- | --- |
| `src/data.ts` | All tunable content: rooms, items, staff roles, traits, conditions, objectives, flavour text |
| `src/state.ts` | The game state (plain JSON) plus save and load |
| `src/world.ts` | Tile grid, placement rules, pathfinding |
| `src/sim.ts` | Guests, staff, queues, money, reputation |
| `src/tools.ts` | Build tools: room drag, doors, furniture placement |
| `src/render/` | Three.js scene and the procedural models |
| `src/ui/` | The HTML heads-up display |
| `src/audio.ts` | Synthesised sound effects and music |
| `electron/main.cjs` | Desktop shell |

Every condition currently routes to the Massage Suite. Adding acupuncture or reiki means a new room, its items and a staff role in `data.ts`, a model per item in `render/models.ts`, and a treatment room on each condition so the sim knows where to send guests.
