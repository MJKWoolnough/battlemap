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

type Collision = PolyPoint & {
	v: Vertex;
}

type PolyPoint = {
	x: Uint;
	y: Uint;
	w: Wall[];
}

export type LightSource = [Colour, Uint, Int, Int];

let rg = 0;

const pi2 = Math.PI/2,
      isConcave = (lightX: Uint, lightY: Uint, x: Uint, y: Uint, angle: number, point: Wall[]) => {
	let edges = 0;
	for (const {x1, y1, x2, y2} of point) {
		const [i, j] = x1 === x && y1 === y ? [x2, y2] : [x1, y1],
		      a = Math.atan2(j - lightY, i - lightX),
		      b = a + (angle > pi2 && a < angle - Math.PI ? 1 : angle < -pi2 && a > angle + Math.PI ? -1 : 0) * 2 * Math.PI;
		if (b < angle) {
			edges |= 1;
		} else if (b > angle) {
			edges |= 2;
		}
	}
	return edges === 3;
      },
      isSameWall = (prev: Wall[], curr: Wall[], next?: Wall[]) => {
	for (const p of prev) {
		for (const c of curr) {
			if (p === c) {
				if (!next) {
					return true;
				}
				for (const n of next) {
					if (p === n) {
						return true;
					}
				}
			}
		}
	}
	return false;
      };

export const makeLight = (l: LightSource, walls: Wall[]) => {
	const [c, i, lightX, lightY] = l,
	      vertices: Vertex[] = [],
	      points = new Map<string, Wall[]>(),
	      collisions: Collision[] = [],
	      polyPoints: PolyPoint[] = [];
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
	for (const v of vertices) {
		const {x, y, angle, point} = v,
		      dlx = lightX - x,
		      dly = lightY - y,
		      concave = isConcave(lightX, lightY, x, y, angle, point);
		let ex = x,
		    ey = y,
		    ws = point,
		    ed = concave ? Math.hypot(y - lightY, x - lightX) : Infinity;
		for (const w of walls) {
			const {x1, y1, x2, y2} = w,
			      dx = x1 - x2,
			      dy = y1 - y2,
			      d = dlx * dy - dly * dx;
			if (d) {
				const a = (lightX * y - lightY * x),
				      b = (x1 * y2 - y1 * x2),
				      px = (dx * a - dlx * b) / d,
				      py = (dy * a - dly * b) / d,
				      lpx = lightX - px,
				      lpy = lightY - py,
				      distance = Math.hypot(lpy, lpx),
				      point = points.get(`${px},${py}`);
				if (((point && isConcave(lightX, lightY, px, py, angle, point)) || (!point && px >= Math.min(x1, x2) && px <= Math.max(x1, x2) && py >= Math.min(y1, y2) && py <= Math.max(y1, y2))) && distance < ed && Math.sign(dlx) === Math.sign(lpx) && Math.sign(dly) === Math.sign(lpy)) {
					ex = px;
					ey = py;
					ed = distance;
					ws = [w];
				}
			}
		}
		if (concave) {
			v.point = ws;
		}
		collisions.push({
			x: ex,
			y: ey,
			v, // original
			w: ws // hit
		});
	}
	collisions.sort(({v: {angle: a}}, {v: {angle: b}}) => b - a);
	for (let i = 0; i < collisions.length; i++) {
		const curr = collisions[i];
		if (curr.w !== curr.v.point) {
			if (isSameWall(collisions[i === 0 ? collisions.length - 1 : i - 1].w, curr.w)) {
				polyPoints.push({"x": curr.v.x, "y": curr.v.y, "w": curr.v.point});
				polyPoints.push(curr);
			} else {
				polyPoints.push(curr);
				polyPoints.push({"x": curr.v.x, "y": curr.v.y, "w": curr.v.point});
			}
		} else {
			polyPoints.push(curr);
		}
	}
	let p = "";
	for (let i = 0; i < polyPoints.length; i++) {
		const curr = polyPoints[i];
		if (!isSameWall(polyPoints[i === 0 ? polyPoints.length - 1 : i - 1].w, curr.w, polyPoints[i === polyPoints.length - 1 ? 0 : i + 1].w)) {
			p += `${curr.x},${curr.y} `;
		}
	}
	rg++;
	return [
		radialGradient({"id": `RG_${rg}`, "r": i, "cx": lightX, "cy": lightY, "gradientUnits": "userSpaceOnUse"}, [
			stop({"offset": "0%", "stop-color": c.toHexString(), "stop-opacity": c.a / 255}),
			stop({"offset": "100%", "stop-color": c.toHexString(), "stop-opacity": 0})
		]),
		polygon({"points": p, "fill": `url(#RG_${rg})`})
	];
};
