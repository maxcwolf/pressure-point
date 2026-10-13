// What the desktop app offers the game. In a browser there is no desktop app, so this is undefined.
import type { DesktopApi } from '../../electron/api';

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export const desktop: DesktopApi | undefined = window.desktop;
