// Reaching the interface's state and the game from inside a component.

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

import type { GameHost } from '../host';
import type { Hud } from '../hud';

export const HudContext = createContext<Hud | null>(null);

/** The interface's state: which menu and dialog are open, and the messages on screen. */
export function useHud(): Hud {
  const hud = useContext(HudContext);
  if (!hud) throw new Error('this component must be drawn inside the HUD');
  return hud;
}

/** The game being shown: the simulation, the tools, the view and the sound. */
export function useGame(): GameHost {
  return useHud().host;
}
