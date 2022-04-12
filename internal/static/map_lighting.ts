import type {Int, Uint, Wall} from './types.js';
import type {Colour} from './colours.js';
import {polygon, radialGradient, stop} from './lib/svg.js';
import {setAndReturn} from './shared.js';

type Vertex = {
	point: Wall[];
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

let rg = 0;

export const makeLight = (l: LightSource, walls: Wall[]) => {
	const [c, i, lightX, lightY] = l,
	      vertices: Vertex[] = [],
	      ranges: Range[] = [],
	      points = new Map<string, Wall[]>(),
	      polyPoints: [number, number, number][] = [];
	for (const {id, x1, y1, x2, y2, colour, scattering} of walls) {
		const a1 = Math.atan2(y1 - lightY, x1 - lightX),
		    a2 = Math.atan2(y2 - lightY, x2 - lightX);
		if (a1 !== a2) {
			const wall = {id, x1, y1, x2, y2, colour, scattering},
			      p1 = `${x1},${y1}`,
			      p2 = `${x2},${y2}`,
			      points1 = points.get(p1) ?? setAndReturn(points, p1, []),
			      points2 = points.get(p2) ?? setAndReturn(points, p2, []);
			ranges.push({wall, "min": a1, "max": a2});
			if (!points1.length) {
				vertices.push({
					point: points1,
					x: x1,
					y: y1,
					angle: a1
				});
			}
			if (!points2.length) {
				vertices.push({
					point: points2,
					x: x2,
					y: y2,
					angle: a2
				});
			};
			points1.push(wall);
			points2.push(wall);
		}
	}
	for (const {x, y, angle} of vertices) {
		const dlx = (lightX - x),
		      dly = (lightY - y);
		let ex = x,
		    ey = y,
		    ed = Math.hypot(y - lightY, x - lightX);
		for (const {x1, y1, x2, y2} of walls) {
			const dx = x1 - x2,
			      dy = y1 - y2,
			      d = dlx * dy - dly * dx;
			if (d) {
				const a = (lightX * y - lightY * x),
				      b = (x1 * y2 - y1 * x2),
				      px = (dx * a - dlx * b) / d,
				      py = (dy * a - dly * b) / d,
				      distance = Math.hypot(py - lightY, px - lightX);
				if (distance < ed) {
					ex = px;
					ey = py;
					ed = distance;
				}
			}
		}
		polyPoints.push([ex, ey, angle]);
	}
	rg++;
	return [
		radialGradient({"id": `RG_${rg}`, "r": i}, [
			stop({"offset": "0%", "stop-color": c.toHexString(), "stop-opacity": c.a / 255}),
			stop({"offset": "100%", "stop-color": c.toHexString(), "stop-opacity": 0})
		]),
		polygon({"points": "M" + polyPoints.sort(([, , a], [, , b]) => b - a).map(([x, y]) => `${x},${y}`).join(" L"), "fill": `url(#RG_${rg})`})
	];
};
