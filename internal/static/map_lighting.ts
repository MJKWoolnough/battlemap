import type {Int, Uint, Wall} from './types.js';
import type {Children} from './lib/dom.js';
import {polygon} from './lib/svg.js';
import {Colour, noColour} from './colours.js';
import {definitions} from './map_tokens.js';
import {setAndReturn} from './shared.js';

type Vertex = {
	w: Wall[];
	x: Int;
	y: Int;
	a: number;
	d: number;
}

type Collision = PolyPoint & {
	v: Vertex;
}

type PolyPoint = {
	x: Uint;
	y: Uint;
	w: Wall[];
}

type XWall = Wall & {
	cx: Int;
	cy: Int;
	cl: Uint;
}

export type LightSource = [Colour, Uint, Int, Int];

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
			if (p.id === c.id) {
				if (!next) {
					return p;
				}
				for (const n of next) {
					if (p.id === n.id) {
						return p;
					}
				}
			}
		}
	}
	return null;
      },
      closestPoint = (x1: Uint, y1: Uint, x2: Uint, y2: Uint, lightX: Uint, lightY: Uint) => {
	if (x1 === x2) {
		const min = Math.min(y1, y2),
		      max = Math.max(y1, y2),
		      y = min > lightY ? min : max < lightY ? max : lightY;
		return [x1, y, Math.hypot(x1 - lightX, y - lightY)];
	}
	const m = (y2 - y1) / (x2 - x1),
	      x3 = lightX - ((y1 - lightY) - (x1 - lightX) * m) / (m + 1 / m),
	      y3 = m * x3 + (y1 - x1 * m);
	if (x3 < Math.min(x1, x2) || x3 > Math.max(x1, x2)) {
		const a = Math.hypot(x1 - lightX, y1 - lightY),
		      b = Math.hypot(x2 - lightX, y2 - lightY);
		return a < b ? [x1, y1, a] : [x2, y2, b];
	}
	return [x3, y3, Math.hypot(x3 - lightX, y3 - lightY)];
      };

export const makeLight = (l: LightSource, walls: Wall[], lens?: Wall) => {
	const [c, i, lightX, lightY] = l,
	      vertices: Vertex[] = [],
	      points = new Map<string, XWall[]>(),
	      collisions: Collision[] = [],
	      polyPoints: PolyPoint[] = [],
	      gWalls: XWall[] = [],
	      ret: Children = [];
	for (const wall of walls) {
		const {x1, y1, x2, y2} = wall,
		      dx1 = x1 - lightX,
		      dx2 = x2 - lightX,
		      dy1 = y1 - lightY,
		      dy2 = y2 - lightY;
		if (dy1 * (dx2 - dx1) !== dx1 * (dy2 - dy1)) {
			const a1 = Math.atan2(dy1, dx1),
			      a2 = Math.atan2(dy2, dx2),
			      p1 = `${x1},${y1}`,
			      p2 = `${x2},${y2}`,
			      points1 = points.get(p1) ?? setAndReturn(points, p1, []),
			      points2 = points.get(p2) ?? setAndReturn(points, p2, []),
			      [cx, cy, cl] = closestPoint(x1, y1, x2, y2, lightX, lightY),
			      wx = Object.assign({cx, cy, cl}, wall);
			if (!points1.length) {
				vertices.push({
					w: points1,
					x: x1,
					y: y1,
					a: a1,
					d: Math.hypot(dx1, dy1)
				});
			}
			if (!points2.length) {
				vertices.push({
					w: points2,
					x: x2,
					y: y2,
					a: a2,
					d: Math.hypot(dx2, dy2)
				});
			};
			points1.push(wx);
			points2.push(wx);
			if (wall.id === lens?.id) {
				gWalls.push(wx);
			}
		}
	}
	gWalls.sort(({cl: acl}, {cl: bcl}) => acl - bcl);
	for (const v of Array.from(vertices.values()).sort(({a: aa, d: da}, {a: ab, d: db}) => ab - aa || da - db)) {
		if (collisions.length && collisions[collisions.length - 1].v.a === v.a) {
			continue;
		}
		const {x, y, a: angle, w: point} = v,
		      dlx = lightX - x,
		      dly = lightY - y,
		      concave = isConcave(lightX, lightY, x, y, angle, point),
		      oDistance = Math.hypot(x - lightX, y - lightY);
		let ex = x,
		    ey = y,
		    ws = point,
		    ed = concave ? oDistance : Infinity,
		    min = 0;
		if (lens) {
			const {x1, y1, x2, y2} = lens,
			      dx = x1 - x2,
			      dy = y1 - y2,
			      d = dlx * dy - dly * dx,
			      a = (lightX * y - lightY * x),
			      b = (x1 * y2 - y1 * x2),
			      px = (dx * a - dlx * b) / d,
			      py = (dy * a - dly * b) / d;
			if (px < Math.min(x1, x2) || px > Math.max(x1, x2) || py < Math.min(y1, y2) || py > Math.max(y1, y2)) {
				continue;
			}
			min = Math.hypot(lightX - px, lightY - py);
		}
		for (const w of gWalls) {
			if (w.cl > ed) {
				break;
			}
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
				      distance = Math.hypot(lpx, lpy),
				      point = points.get(`${px},${py}`);
				if ((point ? isConcave(lightX, lightY, px, py, angle, point) : !point && px >= Math.min(x1, x2) && px <= Math.max(x1, x2) && py >= Math.min(y1, y2) && py <= Math.max(y1, y2)) && distance < ed && distance > min && Math.sign(dlx) === Math.sign(lpx) && Math.sign(dly) === Math.sign(lpy)) {
					ex = px;
					ey = py;
					ed = distance;
					ws = point ?? [w];
				}
			}
		}
		if (concave || oDistance > ed) {
			v.w = ws;
		}
		collisions.push({
			"x": ex,
			"y": ey,
			v, // original
			"w": ws // hit
		});
	}
	let lastWall: Wall[] | null = null,
	    p = "",
	    lastPoint: [number, number, Wall[]] = [NaN, NaN, []];
	for (let i = 0; i < collisions.length; i++) {
		const curr = collisions[i];
		if (lastWall === null) {
			if (curr.w === curr.v.w) {
				lastWall = curr.w;
			}
			collisions.push(collisions.shift()!);
			i--;
			continue;
		}
		if (curr.w !== curr.v.w) {
			if (isSameWall(lastWall, curr.v.w)) {
				polyPoints.push({"x": curr.v.x, "y": curr.v.y, "w": curr.v.w});
				polyPoints.push(curr);
				lastWall = curr.w;
			} else {
				polyPoints.push(curr);
				polyPoints.push({"x": curr.v.x, "y": curr.v.y, "w": curr.v.w});
				lastWall = curr.v.w;
			}
		} else {
			polyPoints.push(curr);
			lastWall = curr.w;
		}
	}
	for (let i = 0; i < polyPoints.length; i++) {
		const {w, x, y} = polyPoints[i];
		if (!isSameWall(polyPoints[i === 0 ? polyPoints.length - 1 : i - 1].w, w, polyPoints[i === polyPoints.length - 1 ? 0 : i + 1].w)) {
			p += `${x},${y} `;
			if (lastPoint[2]) {
				const sw = isSameWall(lastPoint[2], w);
				if (sw) {
					const {id, colour: {r, g, b, a}, x1, y1, x2, y2} = sw;
					if (r || g || b) {
						const {r: lr, g: lg, b: lb, a: la} = c,
						      [, , cd] = closestPoint(x1, y1, x2, y2, lightX, lightY),
						      fw = {
							id,
							"x1": x,
							"y1": y,
							"x2": lastPoint[0],
							"y2": lastPoint[1],
							"colour": noColour,
							"scattering": 0
						      };
						if (cd < i) {
							if (a < 255) {
								const inva = 1 - (la / 255),
								      nr = Math.round(Math.pow(r * lr, 0.5) * inva),
								      ng = Math.round(Math.pow(g * lg, 0.5) * inva),
								      nb = Math.round(Math.pow(b * lb, 0.5) * inva),
								      na = Math.round(a * inva);
								if (na && (nr || ng || nb || na)) {
									ret.push(makeLight([
										Colour.from({"r": nr, "g": ng, "b": nb, "a": na}),
										cd + (i - cd) * inva,
										lightX,
										lightY
									], walls, fw));
								}
							}
						}
					}
				}
			}
			lastPoint[0] = x;
			lastPoint[1] = y;
			lastPoint[2] = w;
		}
	}
	ret.push(polygon({"points": p, "fill": `url(#${definitions.addLighting(lightX, lightY, i, c)})`}));
	return ret;
};
