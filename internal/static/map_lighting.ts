import type {Int, Uint, Wall} from './types.js';
import type {Colour} from './colours.js';

type Vertex = {
	wall: Wall;
	x: Int;
	y: Int;
	angle: number;
	other: number;
}

export type LightSource = [Colour, Uint, Int, Int];

const point2Line = (px: Int, py: Int, x1: Int, y1: Int, x2: Int, y2: Int) => {
	if (x1 === x2) {
		return py >= y1 && py <= y2 ? Math.abs(px - x1) : Math.hypot(px - x1, Math.min(Math.abs(py - y1), Math.abs(py - y2)));
	} else if (y1 === y2) {
		return px >= x1 && px <= x2 ? Math.abs(py - y1) : Math.hypot(Math.min(Math.abs(px - x1), Math.abs(px - x2)), py - y1);
	}
	const m = (y2 - y1) / (x2 - x1),
	      n = (x1 - x2) / (y2 - y1),
	      c = y1 - m * x1,
	      d = py - px * n,
	      cx = Math.min(Math.max((d - c) / (m - n), x1), x2);
	return Math.hypot(px - cx, py - m * cx - c);
      },
      vertexSort = (a: Vertex, b: Vertex) => {
	return b.angle - a.angle;
      };

export const makeLight = (l: LightSource, walls: Wall[]) => {
	const [_c, _i, x, y] = l,
	      vertices: Vertex[] = [];
	for (let {id, x1, y1, x2, y2, colour, scattering} of walls) {
		let a1 = Math.atan2(y1 - y, x1 - x),
		      a2 = Math.atan2(y2 - y, x2 - x);
		if (a1 > a2) {
			[a1, a2, x1, y1, x2, y2] = [a2, a1, x2, y2, x1, y1]
		} 
		if (a1 !== a2) {
			const wall = {id, x1, y1, x2, y2, colour, scattering};
			vertices.push({
				wall,
				x: x1,
				y: y1,
				angle: a1,
				other: a2
			}, {
				wall,
				x: x2,
				y: y2,
				angle: a2,
				other: a1
			});
		}
	}
	vertices.sort(vertexSort);
	return [];
};
