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

let rg = 0;

export const makeLight = (l: LightSource, walls: Wall[]) => {
	const [c, i, lightX, lightY] = l,
	      vertices: Vertex[] = [],
	      points = new Map<string, Wall[]>(),
	      polyPoints: [number, number, number][] = [];
	for (const {id, x1, y1, x2, y2, colour, scattering} of walls) {
		const dx1 = x1 - lightX,
		      dx2 = x2 - lightX,
		      dy1 = y1 - lightY,
		      dy2 = y2 - lightY;
		if (Math.abs(dx1) * Math.abs(dy2) !== Math.abs(dx2) * Math.abs(dy1)) {
			const a1 = Math.atan2(dy1, dx1),
			      a2 = Math.atan2(dy2, dx2),
			      wall = {id, x1, y1, x2, y2, colour, scattering},
			      p1 = `${x1},${y1}`,
			      p2 = `${x2},${y2}`,
			      points1 = points.get(p1) ?? setAndReturn(points, p1, []),
			      points2 = points.get(p2) ?? setAndReturn(points, p2, []);
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
		const dlx = lightX - x,
		      dly = lightY - y;
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
		radialGradient({"id": `RG_${rg}`, "r": i, "cx": lightX, "cy": lightY, "gradientUnits": "userSpaceOnUse"}, [
			stop({"offset": "0%", "stop-color": c.toHexString(), "stop-opacity": c.a / 255}),
			stop({"offset": "100%", "stop-color": c.toHexString(), "stop-opacity": 0})
		]),
		polygon({"points": polyPoints.sort(([, , a], [, , b]) => b - a).map(([x, y]) => `${x},${y}`).join(" "), "fill": `url(#RG_${rg})`})
	];
};
