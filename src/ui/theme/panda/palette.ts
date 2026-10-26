// The palette: every color the interface is drawn in, as hues with steps from pale (50) to deep (900). Nothing in the
// interface names these; it names what a color is for (semantic.ts), and those roles pick from here, so retuning a
// role, or the whole theme, happens in one place.
import { defineTokens } from '@pandacss/dev';

export const palette = defineTokens.colors({
  white: { value: '#fff' },
  black: { value: '#000' },
  navy: {
    100: { value: '#b9c0c9' },
    300: { value: '#8a929c' },
    500: { value: '#5c708a' },
    700: { value: '#3d5168' },
    800: { value: '#2c3a4e' },
    900: { value: '#24384a' },
  },
  cream: {
    50: { value: '#fff8ea' },
    100: { value: '#f6f0e3' },
    200: { value: '#f3e7cf' },
    300: { value: '#d7d2c5' },
    500: { value: '#b7a98c' },
  },
  grass: {
    300: { value: '#8cc98a' },
  },
  teal: {
    50: { value: '#f0fbf9' },
    100: { value: '#e6f6f3' },
    400: { value: '#38bdb4' },
    500: { value: '#2fa8a0' },
    700: { value: '#23827c' },
  },
  cyan: {
    200: { value: '#7fe6f2' },
    400: { value: '#33cbe3' },
    500: { value: '#19bcd6' },
  },
  green: {
    50: { value: '#e3f5e9' },
    100: { value: '#d8f1e2' },
    300: { value: '#7dffb0' },
    500: { value: '#3bb273' },
    700: { value: '#23805a' },
    800: { value: '#1c6b49' },
  },
  gold: {
    50: { value: '#fff6dc' },
    100: { value: '#fbedc6' },
    400: { value: '#f2c14e' },
    600: { value: '#d08a2c' },
    900: { value: '#7a4e0c' },
  },
  orange: {
    50: { value: '#fde8da' },
    400: { value: '#ff8a3c' },
    500: { value: '#f08a4b' },
  },
  red: {
    50: { value: '#fbe3e1' },
    100: { value: '#f6d6cf' },
    200: { value: '#f3b1ac' },
    300: { value: '#f08a84' },
    400: { value: '#d97a6c' },
    500: { value: '#e5564d' },
    700: { value: '#a8322b' },
    800: { value: '#8f2a24' },
  },
  pink: {
    500: { value: '#c2457a' },
  },
  violet: {
    100: { value: '#e4d9f7' },
    400: { value: '#9b6bff' },
    500: { value: '#8a6fd1' },
    700: { value: '#6f55b8' },
  },
  plum: {
    700: { value: '#5b4a6b' },
  },
  blue: {
    50: { value: '#e3f0fb' },
    300: { value: '#7fc2f2' },
    500: { value: '#4a9fe0' },
    700: { value: '#2f6fae' },
  },
});
