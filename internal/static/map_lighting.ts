import type {Int, Uint, Wall} from './types.js';
import type {Children} from './lib/dom.js';
import {polygon} from './lib/svg.js';
import {Colour, noColour} from './colours.js';
import {definitions} from './map_tokens.js';
import {setAndReturn} from './shared.js';

type Vertex = {
	w: XWall[];
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
	w: XWall[];
}

type XWall = Wall & {
	a1: number;
	a2: number;
	cx: Int;
	cy: Int;
	cl: Uint;
}

export type LightSource = [Colour, Uint, Int, Int];

const hasAntiClockwise = (x: Uint, y: Uint, point: XWall[]) => {
	for (const {x1, y1, a1, a2} of point) {
		const [a, b] = x1 === x && y1 === y ? [a2, a1] : [a1, a2];
		if (a > b && a < b + Math.PI || a < b - Math.PI) {
			return true;
		}
	}
	return false;
      },
      hasClockwise = (x: Uint, y: Uint, point: XWall[]) => {
	for (const {x1, y1, a1, a2} of point) {
		const [a, b] = x1 === x && y1 === y ? [a2, a1] : [a1, a2];
		if (a < b && a > b - Math.PI || a > b + Math.PI) {
			return true;
		}
	}
	return false;
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
      iPoint = (x1: Uint, y1: Uint, x2: Uint, y2: Uint, lightX: Uint, lightY: Uint) => {
	if (x1 === x2) {
		return [x1, lightY];
	}
	const m = (y2 - y1) / (x2 - x1),
	      x3 = lightX - ((y1 - lightY) - (x1 - lightX) * m) / (m + 1 / m);
	return [x3, m * x3 + (y1 - x1 * m)];
      },
      closestPoint = (x1: Uint, y1: Uint, x2: Uint, y2: Uint, lightX: Uint, lightY: Uint) => {
	const [x, y] = iPoint(x1, y1, x2, y2, lightX, lightY);
	if (x < Math.min(x1, x2) || x > Math.max(x1, x2) || y < Math.min(y1, y2) || y > Math.max(y1, y2)) {
		const a = Math.hypot(x1 - lightX, y1 - lightY),
		      b = Math.hypot(x2 - lightX, y2 - lightY);
		return a < b ? [x1, y1, a] : [x2, y2, b];
	}
	return [x, y, Math.hypot(x - lightX, y - lightY)];
      };

export const intersection = (x1: Uint, y1: Uint, x2: Uint, y2: Uint, x3: Uint, y3: Uint, x4: Uint, y4: Uint) => {
	const dx1 = x1 - x2,
	      dy1 = y1 - y2,
	      dx2 = x3 - x4,
	      dy2 = y3 - y4,
	      d = dx2 * dy1 - dy2 * dx1;
	if (d) {
		const a = (x3 * y4 - y3 * x4),
		      b = (x1 * y2 - y1 * x2);
		return [(dx1 * a - dx2 * b) / d, (dy1 * a - dy2 * b) / d];
	}
	return [NaN, NaN];
},
makeLight = (l: LightSource, walls: Wall[], lens?: Wall) => {
	const [c, i, lightX, lightY] = l,
	      vertices: Vertex[] = [],
	      points = new Map<string, XWall[]>(),
	      collisions: Collision[] = [],
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
			      wx = Object.assign({cx, cy, cl, a1, a2}, wall);
			if (!points1.length) {
				vertices.push({
					"w": points1,
					"x": x1,
					"y": y1,
					"a": a1,
					"d": Math.hypot(dx1, dy1)
				});
			}
			if (!points2.length) {
				vertices.push({
					"w": points2,
					"x": x2,
					"y": y2,
					"a": a2,
					"d": Math.hypot(dx2, dy2)
				});
			};
			points1.push(wx);
			points2.push(wx);
			if (wall.id !== lens?.id) {
				gWalls.push(wx);
			}
		}
	}
	gWalls.sort(({cl: acl}, {cl: bcl}) => acl - bcl);
	for (const v of Array.from(vertices.values()).sort(({a: aa, d: da}, {a: ab, d: db}) => ab - aa || da - db)) {
		if (collisions.length && collisions[collisions.length - 1].v.a === v.a) {
			continue;
		}
		const {x, y, w: point} = v,
		      dlx = x - lightX,
		      dly = y - lightY,
		      cw = hasAntiClockwise(x, y, point);
		let ex = x,
		    ey = y,
		    ws = point,
		    ed = Infinity,
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
			      [px, py] = intersection(x1, y1, x2, y2, lightX, lightY, x, y);
			if (!isNaN(px)) {
				const lpx = lightX - px,
				      lpy = lightY - py,
				      distance = Math.hypot(lpx, lpy),
				      point = points.get(`${px},${py}`);
				if ((point ? cw && hasClockwise(px, py, point) : px >= Math.min(x1, x2) && px <= Math.max(x1, x2) && py >= Math.min(y1, y2) && py <= Math.max(y1, y2)) && distance < ed && distance > min && Math.sign(-dlx) === Math.sign(lpx) && Math.sign(-dly) === Math.sign(lpy)) {
					ex = px;
					ey = py;
					ed = distance;
					ws = point ?? [w];
				}
			}
		}
		if (cw && ed > v.d) {
			collisions.push({x, y, v, w: point});
		}
		collisions.push({
			"x": ex,
			"y": ey,
			v, // original
			"w": ws // hit
		});
		if (!cw && ed > v.d) {
			collisions.push({x, y, v, w: point});
		}
	}
	let p = "",
	    lastPoint: [number, number, Wall[]] = [NaN, NaN, []];
	for (let i = 0; i < collisions.length; i++) {
		const {w, x, y} = collisions[i];
		if (!isSameWall(collisions[i === 0 ? collisions.length - 1 : i - 1].w, w, collisions[i === collisions.length - 1 ? 0 : i + 1].w)) {
			p += `${x},${y} `;
			if (lastPoint[2]) {
				const sw = isSameWall(lastPoint[2], w);
				if (sw) {
					const {id, colour: {r, g, b, a}, x1, y1, x2, y2} = sw;
					if (r || g || b) {
						const {r: lr, g: lg, b: lb, a: la} = c,
						      [, , cd] = closestPoint(x1, y1, x2, y2, lightX, lightY);
						if (cd < i) {
							const fw = {
								id,
								"x1": x,
								"y1": y,
								"x2": lastPoint[0],
								"y2": lastPoint[1],
								"colour": noColour,
								"scattering": 0
							      };
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
							if (a > 0) {
								const ia = (la / 255),
								      nr = Math.round(Math.pow(r * lr, 0.5) * ia),
								      ng = Math.round(Math.pow(g * lg, 0.5) * ia),
								      nb = Math.round(Math.pow(b * lb, 0.5) * ia),
								      na = Math.round(a * ia);
								if (na && (nr || ng || nb || na)) {
									const [cx, cy] = iPoint(x, y, lastPoint[0], lastPoint[1], lightX, lightY);
									ret.push(makeLight([
										Colour.from({"r": nr, "g": ng, "b": nb, "a": na}),
										cd + (i - cd) * ia,
										cx + cx - lightX,
										cy + cy - lightY
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
