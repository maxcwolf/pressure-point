// The contract between the desktop shell and the game.
// The preload script implements it; the game finds it at `window.desktop`.

export interface DesktopApi {
  /** Node's name for the operating system: 'darwin', 'win32' or 'linux'. */
  readonly platform: string;
  /** Close the app. */
  quit: () => void;
}

/** The message the game sends to the main process to quit. */
export const QUIT_CHANNEL = 'app:quit';
