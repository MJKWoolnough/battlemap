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

type Collision = {
	x: Uint;
	y: Uint;
	w: Wall[];
}

type XWall = Wall & {
	a1: number;
	a2: number;
	cx: Int;
	cy: Int;
	cl: Uint;
}

export type LightSource = [Colour, Uint, Int, Int] | [Colour, Uint, Int, Int, Int, Int];

const roundingOffset = 10e-9,
      hasDirection = (x: Uint, y: Uint, point: XWall[], anti: boolean = false) => {
	for (const {x1, y1, a1, a2} of point) {
		const [a, b] = (x1 === x && y1 === y) === anti ? [a2, a1] : [a1, a2];
		if (a > b && a < b + Math.PI || a < b - Math.PI) {
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
	const [c, i, lightX, lightY, lightPX, lightPY] = l,
	      lx = lightPX ?? lightX,
	      ly = lightPY ?? lightY,
	      vertices: Vertex[] = [],
	      points = new Map<string, XWall[]>(),
	      collisions: Collision[] = [],
	      gWalls: XWall[] = [],
	      ret: Children = [];
	if (lens) {
		const {x1, y1, x2, y2} = lens;
		walls.push({
			"id": 0,
			x1,
			y1,
			"x2": x1 + x1 - x2,
			"y2": y1 + y1 - y2,
			"colour": noColour,
			"scattering": 0
		}, {
			"id": 0,
			"x1": x2 + x2 - x1,
			"y1": y2 + y2 - y1,
			x2,
			y2,
			"colour": noColour,
			"scattering": 0
		});
	}
	for (const wall of walls) {
		if (wall.id === lens?.id) {
			continue;
		}
		const {id, x1, y1, x2, y2} = wall,
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
			if (id) {
				gWalls.push(wx);
			}
		}
	}
	if (lens) {
		walls.splice(walls.length - 2, 2);
	}
	gWalls.sort(({cl: acl}, {cl: bcl}) => acl - bcl);
	let lastAngle = NaN,
	    p = "";
	for (const v of Array.from(vertices.values()).sort(({a: aa, d: da}, {a: ab, d: db}) => ab - aa || da - db)) {
		if (lastAngle === v.a) {
			continue;
		}
		lastAngle = v.a;
		const {x, y, w} = v,
		      dlx = x - lightX,
		      dly = y - lightY,
		      cw = hasDirection(x, y, w, true);
		let ex = x,
		    ey = y,
		    ew = w,
		    ed = Infinity,
		    min = 0;
		if (lens) {
			const {x1, y1, x2, y2} = lens,
			      [px, py] = intersection(x1, y1, x2, y2, lightX, lightY, x, y),
			      lpx = lightX - px,
			      lpy = lightY - py,
			      d = Math.hypot(lpx, lpy) - roundingOffset;
			if (px + roundingOffset < Math.min(x1, x2) || px > Math.max(x1, x2) + roundingOffset || py + roundingOffset < Math.min(y1, y2) || py > Math.max(y1, y2) + roundingOffset || Math.sign(-dlx) !== Math.sign(lpx) || Math.sign(-dly) !== Math.sign(lpy) || d > v.d) {
				continue;
			}
			min = d;
		}
		for (const w of gWalls) {
			if (w.cl > ed) {
				break;
			}
			const {id, x1, y1, x2, y2} = w,
			      [px, py] = intersection(x1, y1, x2, y2, lightX, lightY, x, y);
			if (!isNaN(px)) {
				const lpx = lightX - px,
				      lpy = lightY - py,
				      distance = Math.hypot(lpx, lpy),
				      point = points.get(`${px},${py}`),
				      hasPoint = point?.some(({id: wid}) => id === wid);
				if ((hasPoint ? cw && hasDirection(px, py, point!) : px + roundingOffset >= Math.min(x1, x2) && px <= Math.max(x1, x2) + roundingOffset && py + roundingOffset >= Math.min(y1, y2) && py <= Math.max(y1, y2) + roundingOffset) && distance < ed && distance > min && Math.sign(-dlx) === Math.sign(lpx) && Math.sign(-dly) === Math.sign(lpy)) {
					ex = px;
					ey = py;
					ed = distance;
					ew = hasPoint ? point! : [w, ...(point ?? [])];
				}
			}
		}
		if (cw && ed > v.d) {
			collisions.push({x, y, w});
		}
		collisions.push({
			"x": ex,
			"y": ey,
			"w": ew
		});
		if (!cw && ed > v.d) {
			collisions.push({x, y, w});
		}
	}
	while(isSameWall(collisions[collisions.length - 2].w, collisions[collisions.length - 1].w, collisions[0].w)) {
		collisions.splice(collisions.length - 1, 1);
	}
	for (let j = 0; j < collisions.length; j++) {
		const {w, x, y} = collisions[j],
		       prev = collisions[j === 0 ? collisions.length - 1 : j - 1];
		if (!isSameWall(prev.w, w, collisions[j === collisions.length - 1 ? 0 : j + 1].w)) {
			p += `${x},${y} `;
			const sw = isSameWall(prev.w, w);
			if (sw) {
				const {id, colour: {r, g, b, a}, x1, y1, x2, y2, scattering} = sw;
				if (r || g || b) {
					const {r: lr, g: lg, b: lb, a: la} = c,
					      [cx, cy, cd] = closestPoint(x1, y1, x2, y2, lightX, lightY);
					if (cd < i) {
						const fw = {
							id,
							"x1": x,
							"y1": y,
							"x2": prev.x,
							"y2": prev.y,
							"colour": noColour,
							"scattering": 0
						      },
						      sx = lx + scattering * (cx - lx) / 256,
						      sy = ly + scattering * (cy - ly) / 256;
						if (a < 255) {
							const inva = 1 - (a / 255),
							      nr = Math.round(Math.sqrt(r * lr) * inva),
							      ng = Math.round(Math.sqrt(g * lg) * inva),
							      nb = Math.round(Math.sqrt(b * lb) * inva),
							      na = Math.round(255 * (1 - ((1 - la / 255) * inva)));
							if (na && (nr || ng || nb)) {
								ret.push(makeLight([
									new Colour(nr, ng, nb, na),
									cd + (i - cd) * inva,
									sx,
									sy,
								        lightX,
									lightY
								], walls, fw));
							}
						}
						if (a > 0) {
							const ia = la / 255,
							      nr = Math.round(Math.sqrt(r * lr) * ia),
							      ng = Math.round(Math.sqrt(g * lg) * ia),
							      nb = Math.round(Math.sqrt(b * lb) * ia),
							      na = Math.round(255 * a * ia);
							if (na && (nr || ng || nb)) {
								const [cx, cy] = iPoint(x, y, prev.x, prev.y, sx, sy);
								ret.push(makeLight([
									new Colour(nr, ng, nb, na),
									cd + (i - cd) * ia,
									cx + cx - sx,
									cy + cy - sy,
									cx + cx - lx,
									cy + cy - ly
								], walls, fw));
							}
						}
					}
				}
			}
		} else {
			collisions.splice(j--, 1);
		}
	}
	ret.push(polygon({"points": p, "fill": `url(#${definitions.addLighting(lx, ly, i, c)})`}));
	return ret;
};
