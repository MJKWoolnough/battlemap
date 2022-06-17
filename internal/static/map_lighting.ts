import type {Byte, Uint} from './types.js';
import type {Lighting} from './map_tokens.js';
import {Colour, noColour} from './colours.js';
import Fraction from './fraction.js';
import {setAndReturn} from './shared.js';

type Vertex = {
	w: XWall[];
	x: Fraction;
	y: Fraction;
	a: Fraction;
	d: number;
}

type Collision = {
	x: Fraction;
	y: Fraction;
	w: LightWall[];
}

export type LightWall = {
	id: Uint;
	x1: Fraction;
	y1: Fraction;
	x2: Fraction;
	y2: Fraction;
	colour: Colour;
	scattering: Byte;
}

type XWall = LightWall & {
	a1: Fraction;
	a2: Fraction;
	cx: Fraction;
	cy: Fraction;
	cl: Uint;
}

const mone = new Fraction(-1n),
      two = new Fraction(2n),
      three = new Fraction(3n),
      four = new Fraction(4n),
      five = new Fraction(5n),
      six = new Fraction(6n),
      seven = new Fraction(7n),
      angle = (x: Fraction, y: Fraction) => {
	const m = y.div(x),
	      ycmp = y.cmp(Fraction.zero);
	switch (m.cmp(Fraction.one)) {
	case -1:
		switch (m.cmp(mone)) {
		case -1:
			switch (ycmp) {
			case -1:
				return three.add(mone.div(m));
			case 1:
				return seven.add(mone.div(m));
			}
		case 0:
			switch (ycmp) {
			case -1:
				return four;
			case 1:
				return Fraction.zero;
			}
		case 1:
			switch (x.cmp(Fraction.zero)) {
			case -1:
				return Fraction.one.add(m);
			case 1:
				return five.add(m);
			}
		}
	case 0:
		switch (ycmp) {
		case -1:
			return two;
		case 1:
			return six;
		}
	case 1:
		switch (ycmp) {
		case -1:
			return three.sub(Fraction.one.div(m));
		case 1:
			return seven.sub(Fraction.one.div(m));
		}
	default:
		switch (ycmp) {
		case -1:
			return three;
		case 1:
			return seven;
		}
	}
	return Fraction.NaN;
      },
      hasDirection = (x: Fraction, y: Fraction, point: XWall[], anti: boolean = false) => {
	for (const {x1, y1, a1, a2} of point) {
		const [a, b] = (!x1.cmp(x) && !y1.cmp(y)) === anti ? [a2, a1] : [a1, a2];
		if (a.cmp(b) === 1 && a.cmp(b.add(four)) === -1 || a.cmp(b.sub(four)) === -1) {
			return true;
		}
	}
	return false;
      },
      isSameWall = (prev: LightWall[], curr: LightWall[], next?: LightWall[]) => {
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
      iPoint = (x1: Fraction, y1: Fraction, x2: Fraction, y2: Fraction, lightX: Uint, lightY: Uint) => {
	if (!x1.cmp(x2)) {
		return [x1, new Fraction(BigInt(lightY))];
	}
	const m = y2.sub(y1).div(x2.sub(x1)),
	      flx = new Fraction(BigInt(lightX)),
	      x3 = flx.sub(y1.sub(new Fraction(BigInt(lightY))).sub(x1.sub(flx).mul(m)).div(m.add(Fraction.one.div(m))));
	return [x3, m.mul(x3).add(y1.sub(x1.mul(m)))];
      },
      closestPoint = (x1: Fraction, y1: Fraction, x2: Fraction, y2: Fraction, lightX: Uint, lightY: Uint): [Fraction, Fraction, number] => {
	const [x, y] = iPoint(x1, y1, x2, y2, lightX, lightY);
	if (x.cmp(Fraction.min(x1, x2)) === -1 || x.cmp(Fraction.max(x1, x2)) === 1 || y.cmp(Fraction.min(y1, y2)) === -1 || y.cmp(Fraction.max(y1, y2)) === 1) {
		const a = Math.hypot(x1.toFloat() - lightX, y1.toFloat() - lightY),
		      b = Math.hypot(x2.toFloat() - lightX, y2.toFloat() - lightY);
		return a < b ? [x1, y1, a] : [x2, y2, b];
	}
	return [x, y, Math.hypot(x.toFloat() - lightX, y.toFloat() - lightY)];
      };

export const intersection = (x1: Fraction, y1: Fraction, x2: Fraction, y2: Fraction, x3: Fraction, y3: Fraction, x4: Fraction, y4: Fraction) => {
	const dx1 = x1.sub(x2),
	      dy1 = y1.sub(y2),
	      dx2 = x3.sub(x4),
	      dy2 = y3.sub(y4),
	      d = dx2.mul(dy1).sub(dy2.mul(dx1));
	if (d.cmp(Fraction.zero)) {
		const a = x3.mul(y4).sub(y3.mul(x4)),
		      b = x1.mul(y2).sub(y1.mul(x2));
		return [dx1.mul(a).sub(dx2.mul(b)).div(d), dy1.mul(a).sub(dy2.mul(b)).div(d)];
	}
	return [Fraction.NaN, Fraction.NaN];
},
makeLight = (l: Lighting, walls: LightWall[], scale: number, lens?: LightWall) => {
	const [lightX, lightY] = l.getLightPos(),
	      [lx, ly] = l.getCentre(),
	      i = l.lightStages.reduce((p, c) => p + c, 0) * scale,
	      flx = new Fraction(BigInt(lightX)),
	      fly = new Fraction(BigInt(lightY)),
	      vertices: Vertex[] = [],
	      points = new Map<string, XWall[]>(),
	      collisions: Collision[] = [],
	      gWalls: XWall[] = [],
	      ret: SVGPolygonElement[] = [];
	if (lens) {
		const {x1, y1, x2, y2} = lens;
		walls.push({
			"id": 0,
			x1,
			y1,
			"x2": x1.add(x1).sub(x2),
			"y2": y1.add(y1).sub(y2),
			"colour": noColour,
			"scattering": 0
		}, {
			"id": 0,
			"x1": x2.add(x2).sub(x1),
			"y1": y2.add(y2).sub(y1),
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
		      dx1 = x1.sub(flx),
		      dx2 = x2.sub(flx),
		      dy1 = y1.sub(fly),
		      dy2 = y2.sub(fly);
		if (dy1.mul(dx2.sub(dx1)).cmp(dx1.mul(dy2.sub(dy1)))) {
			const rdx1 = dx1.toFloat(),
			      rdy1 = dy1.toFloat(),
			      rdx2 = dx2.toFloat(),
			      rdy2 = dy2.toFloat(),
			      a1 = angle(dx1, dy1),
			      a2 = angle(dx2, dy2),
			      p1 = `${x1.toFloat()},${y1.toFloat()}`,
			      p2 = `${x2.toFloat()},${y2.toFloat()}`,
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
					"d": Math.hypot(rdx1, rdy1)
				});
			}
			if (!points2.length) {
				vertices.push({
					"w": points2,
					"x": x2,
					"y": y2,
					"a": a2,
					"d": Math.hypot(rdx2, rdy2)
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
	let lastAngle = Fraction.NaN;
	for (const v of Array.from(vertices.values()).sort(({a: aa, d: da}, {a: ab, d: db}) => ab.cmp(aa) || da - db)) {
		if (!lastAngle.isNaN() && !lastAngle.cmp(v.a)) {
			continue;
		}
		lastAngle = v.a;
		const {x, y, w} = v,
		      dlx = x.sub(flx),
		      dly = y.sub(fly),
		      cw = hasDirection(x, y, w, true);
		let ex = x,
		    ey = y,
		    ew = w,
		    ed = Infinity,
		    min = 0;
		if (lens) {
			const {x1, y1, x2, y2} = lens,
			      [px, py] = intersection(x1, y1, x2, y2, flx, fly, x, y),
			      lpx = flx.sub(px),
			      lpy = fly.sub(py),
			      d = Math.hypot(lpx.toFloat(), lpy.toFloat()) - 10e-9;
			if (px.cmp(Fraction.min(x1, x2)) === -1 || px.cmp(Fraction.max(x1, x2)) === 1 || py.cmp(Fraction.min(y1, y2)) === -1 || py.cmp(Fraction.max(y1, y2)) === 1 || -dlx.sign() !== lpx.sign() || -dly.sign() !== lpy.sign() || d > v.d) {
				continue;
			}
			min = d;
		}
		for (const w of gWalls) {
			if (w.cl > ed) {
				break;
			}
			const {id, x1, y1, x2, y2} = w,
			      [px, py] = intersection(x1, y1, x2, y2, flx, fly, x, y);
			if (!px.isNaN()) {
				const lpx = flx.sub(px),
				      lpy = fly.sub(py),
				      distance = Math.hypot(lpx.toFloat(), lpy.toFloat()),
				      point = points.get(`${px.toFloat()},${py.toFloat()}`),
				      hasPoint = point?.some(({id: wid}) => id === wid);
				if ((hasPoint ? cw && hasDirection(px, py, point!) : px.cmp(Fraction.min(x1, x2)) > -1 && px.cmp(Fraction.max(x1, x2)) < 1 && py.cmp(Fraction.min(y1, y2)) > -1 && py.cmp(Fraction.max(y1, y2)) < 1) && distance < ed && distance > min && -dlx.sign() === lpx.sign() && -dly.sign() === lpy.sign()) {
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
	let p = "";
	for (let j = 0; j < collisions.length; j++) {
		const {w, x, y} = collisions[j],
		      prev = collisions[j === 0 ? collisions.length - 1 : j - 1],
		      next = collisions[j === collisions.length - 1 ? 0 : j + 1];
		if (!isSameWall(prev.w, w, next.w)) {
			if (prev.y.sub(y).mul(x.sub(next.x)).cmp(y.sub(next.y).mul(prev.x.sub(x)))) {
				p += `${x.toFloat()},${y.toFloat()} `;
			}
			const sw = isSameWall(prev.w, w);
			if (sw) {
				const {id, colour: {r, g, b, a}, x1, y1, x2, y2, scattering} = sw;
				if (r || g || b) {
					const [cx, cy, cd] = closestPoint(x1, y1, x2, y2, lightX, lightY);
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
						      sx = lx + scattering * (cx.toFloat() - lx) / 256,
						      sy = ly + scattering * (cy.toFloat() - ly) / 256;
						if (a < 255) {
							const lw = l.wallInteraction(Math.round(sx), Math.round(sy), lightX, lightY, sw.colour, cd / scale, true);
							if (lw) {
								ret.push(...makeLight(lw, walls, scale, fw));
							}
						}
						if (a > 0) {
							const [cx, cy] = iPoint(x, y, prev.x, prev.y, sx, sy),
							      dcx = cx.add(cx).toFloat(),
							      dcy = cy.add(cy).toFloat(),
							      lw = l.wallInteraction(Math.round(dcx - sx), Math.round(dcy - sy), Math.round(dcx - lx), Math.round(dcy - ly), sw.colour, cd / scale);
							if (lw) {
								ret.push(...makeLight(lw, walls, scale, fw));
							}
						}
					}
				}
			}
		} else {
			collisions.splice(j--, 1);
		}
	}
	ret.push(l.createLightPolygon(p, scale));
	return ret;
};
