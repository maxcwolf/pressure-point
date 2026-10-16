// A For Sale board on a plot of land: an amber board on two tall legs, so it shows over the building's back walls,
// painted with what it says.

import * as THREE from 'three';

import { must } from '../../core/util';
import { mergeStill } from './merge';
import { cached, cyl, mat, put, WOOD_DARK } from './parts';

/** The board's width and height, and how high its middle stands. */
const BOARD_W = 1.6;
const BOARD_H = 0.7;
const BOARD_Y = 1.95;

/** What each wording of a board looks like, painted once and shared. */
const faces = new Map<string, THREE.Material>();

/** A board's face: its words in dark letters on amber. */
function face(text: string): THREE.Material {
  const known = faces.get(text);
  if (known) return known;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 112;
  const ctx = must(c.getContext('2d'), '2D canvas');
  ctx.fillStyle = '#2f4858';
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 112, 16);
  ctx.fill();
  ctx.fillStyle = '#f5b83d';
  ctx.beginPath();
  ctx.roundRect(7, 7, 242, 98, 12);
  ctx.fill();
  ctx.fillStyle = '#2f4858';
  ctx.font = '700 46px Fredoka, "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 59);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const words = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  faces.set(text, words);
  return words;
}

/** The board: a thin box whose four edges all take their color from one spot on the painted rim. */
function boardShape(): THREE.BoxGeometry {
  const box = new THREE.BoxGeometry(BOARD_W, BOARD_H, 0.08);
  const uv = box.getAttribute('uv');
  // a box's faces go +x, -x, +y, -y, +z, -z, four corners each: the words go on +z and -z, the rim on the rest
  for (let i = 0; i < 16; i++) uv.setXY(i, 0.01, 0.5);
  return box;
}

/** A For Sale board saying this, its words facing +z, toward the street. */
export function buildForSaleBoard(text: string): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(WOOD_DARK);
  for (const x of [-BOARD_W * 0.36, BOARD_W * 0.36]) put(g, cyl(0.05, 0.05, BOARD_Y), wood, x, BOARD_Y / 2, 0);
  // one material for every face, so a board is one draw: its thin edges show the painted rim, as dark as the letters
  const shape = cached('for-sale-board', boardShape);
  const board = new THREE.Mesh(shape, face(text));
  board.position.set(0, BOARD_Y, 0.06);
  board.castShadow = true;
  g.add(board);
  mergeStill(g);
  return g;
}
