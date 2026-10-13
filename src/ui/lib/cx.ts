// Joining class names.

/** Join the class names that apply, skipping anything false or empty. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
