# Pressure Point Institute

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
5. Staff tire. A **Staff Room** lets them recover; a **Caretaker** clears litter, waters plants and keeps the massage stones hot.
6. Salaries come out at the end of each month. Hit the objectives to earn stars.
7. Stars unlock new **massage modalities**. Build a **Training Room** and send therapists on courses to deliver them.

### Massage modalities

A diagnosis prescribes a modality. It only works properly with a therapist qualified in it and, for some, equipment in the same Massage Suite. An unqualified therapist will still have a go, at about a third of the usual success rate.

| Modality | Unlocks | Needs | Character |
| --- | --- | --- | --- |
| Swedish | Start | Nothing | Quick, cheap, reliable |
| Deep Tissue | Star 1 | Course | Tires the therapist fast |
| Sports | Star 1 | Course, Stretch Rack | Long and hard to get right |
| Hot Stone | Star 2 | Course, Stone Warmer | High fee; the warmer cools with use |
| Cranio-sacral | Star 2 | Course | Slow, expensive, needs high skill |

The **Massage** menu shows what each modality treats and whether you can deliver it. Any member of staff can also take a skill course.

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

Modalities, conditions, courses and equipment are all defined in `data.ts`. Every condition currently routes to the Massage Suite; adding acupuncture or reiki means a new room, its items and a staff role, a model per item in `render/models.ts`, and a treatment room on each modality so the sim knows where to send guests.
