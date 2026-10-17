// The contract between the desktop shell and the game.
// The preload script implements it; the game finds it at `window.desktop`.

/** The copies of the saved games kept in files: the list as last written, and each game's text by save id. */
export interface SaveCopy {
  index: string | null;
  saves: Record<string, string>;
}

export interface DesktopApi {
  /** Node's name for the operating system: 'darwin', 'win32' or 'linux'. */
  readonly platform: string;
  /** Close the app. */
  quit: () => void;
  /** Call back with the version of an update once it has downloaded, straight away if one already has. */
  onUpdateReady: (listener: (version: string) => void) => void;
  /** Close the app, install the downloaded update and open the new version. */
  installUpdate: () => void;
  /** Call back with whether the window fills the screen: straight away, then whenever that changes. */
  onFullScreen: (listener: (on: boolean) => void) => void;
  /** Fill the screen with the window, or give it back its own window. Remembered for the next launch. */
  setFullScreen: (on: boolean) => void;
  /** Keep a copy of a saved game in a file, with the list of saves as it now stands. */
  backupSave: (id: string, text: string, index: string) => void;
  /** Delete the file copy of a deleted save, and keep the list of saves as it now stands. */
  dropBackup: (id: string, index: string) => void;
  /** Every copy kept in files, for putting back saves the page's storage has lost. */
  readBackup: () => Promise<SaveCopy>;
}

/** The message the game sends to the main process to quit. */
export const QUIT_CHANNEL = 'app:quit';
/** The game asks the main process which update has downloaded, if any. */
export const UPDATE_VERSION_CHANNEL = 'update:version';
/** The main process tells the game an update has downloaded. */
export const UPDATE_READY_CHANNEL = 'update:ready';
/** The game asks the main process to install the downloaded update. */
export const UPDATE_INSTALL_CHANNEL = 'update:install';
/** The game asks the main process whether the window fills the screen. */
export const FULL_SCREEN_STATE_CHANNEL = 'window:full-screen';
/** The main process tells the game the window has filled the screen or left it, however that came about. */
export const FULL_SCREEN_CHANGED_CHANNEL = 'window:full-screen-changed';
/** The game asks the main process to fill the screen with the window, or to leave it. */
export const FULL_SCREEN_SET_CHANNEL = 'window:set-full-screen';
/** The game hands the main process a saved game to keep a copy of. */
export const BACKUP_SAVE_CHANNEL = 'saves:backup';
/** The game tells the main process a save was deleted. */
export const BACKUP_DROP_CHANNEL = 'saves:drop-backup';
/** The game asks the main process for every copy it keeps. */
export const BACKUP_READ_CHANNEL = 'saves:read-backup';
