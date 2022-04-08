import type {Int, Uint, Wall} from './types.js';
import type {Colour} from './colours.js';
import {setAndReturn} from './shared.js';

type Vertex = {
	x: Int;
	y: Int;
	angle: number;
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
	      ranges: Range[] = [],
	      points = new Map<string, Wall[]>();
	for (let {id, x1, y1, x2, y2, colour, scattering} of walls) {
		let a1 = Math.atan2(y1 - y, x1 - x),
		      a2 = Math.atan2(y2 - y, x2 - x);
		if (a1 > a2) {
			[a1, a2, x1, y1, x2, y2] = [a2, a1, x2, y2, x1, y1]
		}
		if (a1 !== a2) {
			const wall = {id, x1, y1, x2, y2, colour, scattering},
			      p1 = `${x1},${y1}`,
			      p2 = `${x2},${y2}`,
			      points1 = points.get(p1) ?? setAndReturn(points, p1, []),
			      points2 = points.get(p2) ?? setAndReturn(points, p2, []);
			ranges.push({wall, "min": a1, "max": a2});
			if (!points1.length) {
				vertices.push({
					x: x1,
					y: y1,
					angle: a1
				});
			}
			if (!points2.length) {
				vertices.push({
					x: x2,
					y: y2,
					angle: a2
				});
			};
			points1.push(wall);
			points2.push(wall);
		}
	}
	vertices.sort(vertexSort);
	return [];
};
