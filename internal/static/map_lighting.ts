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

type Range = {
	wall: Wall;
	min: number;
	max: number;
}

const vertexSort = (a: Vertex, b: Vertex) => {
	return b.angle - a.angle;
      };

export const makeLight = (l: LightSource, walls: Wall[]) => {
	const [_c, _i, x, y] = l,
	      vertices: Vertex[] = [],
	      ranges: Range[] = [];
	for (let {id, x1, y1, x2, y2, colour, scattering} of walls) {
		let a1 = Math.atan2(y1 - y, x1 - x),
		      a2 = Math.atan2(y2 - y, x2 - x);
		if (a1 > a2) {
			[a1, a2, x1, y1, x2, y2] = [a2, a1, x2, y2, x1, y1]
		}
		if (a1 !== a2) {
			const wall = {id, x1, y1, x2, y2, colour, scattering};
			ranges.push({wall, "min": a1, "max": a2});
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
