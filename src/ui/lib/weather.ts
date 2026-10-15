// The weather outside, as the bottom bar shows it beside the date: how warm it is, and whether that calls for heating
// or cooling indoors.

import { DISCOMFORT_NOTICE, IDEAL_TEMP } from '../../core/data';
import { discomfort, indoorTemp } from '../../core/sim/warmth';

/** The weather outside in a few characters, what it means indoors, and whether it needs heating or cooling. */
export interface WeatherNote {
  text: string;
  title: string;
  need: '' | 'heat' | 'cool';
}

/** What the bottom bar says about the weather outside, or null with the weather switched off. */
export function weatherNote(outdoor: number, on: boolean): WeatherNote | null {
  if (!on) return null;
  const outside = Math.round(outdoor);
  const inside = indoorTemp(outdoor);
  const need = discomfort(inside) < DISCOMFORT_NOTICE ? '' : inside < IDEAL_TEMP ? 'heat' : 'cool';
  const advice = {
    '': 'comfortable without heating or cooling.',
    heat: 'too cold, so Radiators are needed.',
    cool: 'too hot, so Air Conditioners are needed.',
  }[need];
  return {
    text: `${outside}°F`,
    title: `${outside}°F outside. Indoors it is about ${Math.round(inside)}°F before any heating or cooling: ${advice}`,
    need,
  };
}
