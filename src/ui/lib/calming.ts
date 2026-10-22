// The words for a guest on a really bad trip being calmed down.

/** Who is calming a runner down, or on the way to. */
export const calmingNote = (name: string, there: boolean) =>
  there ? `${name} is calming them down` : `${name} is on the way to calm them down`;
