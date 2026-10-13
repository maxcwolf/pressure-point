// Sizing the bars of the monthly net chart.

/** The tallest a bar can be, in pixels. */
export const CHART_HEIGHT = 56;
/** The shortest, so that a month near zero still shows. */
const MIN_BAR = 4;

/** The height in pixels of each month's bar, scaled so the biggest month fills the chart. */
export function barHeights(history: readonly number[]): number[] {
  const max = Math.max(1, ...history.map((v) => Math.abs(v)));
  return history.map((v) => Math.max(MIN_BAR, (Math.abs(v) / max) * CHART_HEIGHT));
}
