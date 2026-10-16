// The button used throughout the in-game interface.

import type { ComponentChildren } from 'preact';

import { useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';

export interface ButtonProps {
  class?: string;
  title?: string | undefined;
  /** Shown but refused: pressing it only plays the error sound. */
  locked?: boolean;
  /** Skip the click sound, for actions that make a sound of their own. */
  quiet?: boolean;
  /** A tooltip richer than its title's words, as `kind:value` for a drawer added with `addRichTip`. */
  richTip?: string | undefined;
  onPress: () => void;
  children?: ComponentChildren;
}

/** A button that acts the moment it is pressed, clicks, and redraws the interface. */
export function Button({
  class: className,
  title,
  locked = false,
  quiet = false,
  richTip,
  onPress,
  children,
}: ButtonProps) {
  const hud = useHud();
  /** Act on the left mouse button going down. */
  const press = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const { audio } = hud.host;
    if (locked) {
      audio.play('error');
      return;
    }
    audio.unlock();
    onPress();
    if (!quiet) audio.play('blip');
    hud.update();
  };
  return (
    <button class={cx(className, locked && 'locked')} title={title} data-tip-rich={richTip} onPointerDown={press}>
      {children}
    </button>
  );
}
