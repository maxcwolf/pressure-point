// Loading or restarting from inside a game reloads the page, leaving a note that says what to open next.

const HANDOFF_KEY = 'pressure-point-start';

/** Read and clear the note the last page left saying what to open. */
export function takeHandoff(): string | null {
  try {
    const what = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    return what;
  } catch {
    return null;
  }
}

/** Reload the page, leaving a note saying what to open. */
export function reloadInto(what: string) {
  try {
    sessionStorage.setItem(HANDOFF_KEY, what);
  } catch {
    // without session storage the title screen appears instead, which is fine
  }
  location.reload();
}
