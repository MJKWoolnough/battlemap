import type {WaitGroup} from './lib/inter.js';
import type {SVGLayer} from './map.js';
import type {Byte, Coords, GridDetails, Int, KeystoreData, Mask, Token, TokenDrawing, TokenImage, TokenShape, Uint} from './types.js';
import {amendNode, clearNode} from './lib/dom.js';
import {Pipe} from './lib/inter.js';
import {setAndReturn} from './lib/misc.js';
import {NodeArray, node} from './lib/nodes.js';
import {animate, defs, ellipse, g, image, mask, path, pattern, polygon, radialGradient, rect, stop} from './lib/svg.js';
import {imageIDtoURL} from './asset_urls.js';
import {Colour, noColour} from './colours.js';
import {cursors, gridPattern, lighting, mapMask} from './ids.js';
import {timeShift} from './rpc.js';
import {characterData, cloneObject} from './shared.js';

type MaskNode = Mask & {
	[node]: SVGRectElement | SVGEllipseElement | SVGPolygonElement;
}

export class Lighting {
	x: Int;
	y: Int;
	#lightX: Int;
	#lightY: Int;
	lightColours: Colour[][];
	lightStages: Uint[];
	lightTimings: Uint[];
	constructor(x: Int, y: Int, lightX: Int, lightY: Int, lightColours: Colour[][], lightStages: Uint[], lightTimings: Uint[]) {
		this.x = x;
		this.y = y;
		this.#lightX = lightX;
		this.#lightY = lightY;
		this.lightColours = lightColours;
		this.lightStages = lightStages;
		this.lightTimings = lightTimings;
	}
	getCentre(): [Int, Int] { return [this.x, this.y]; }
	getLightPos(): [Int, Int] { return [this.#lightX, this.#lightY]; }
	wallInteraction(x: Int, y: Int, lightX: Int, lightY: Int, wallColour: Colour, cp: number, refraction = false): Lighting | null {
		const newColours: Colour[][] = [],
		      newStages: Uint[] = [],
		      {r, g, b, a} = wallColour,
		      ma = refraction ? 1 - (a / 255) : a / 255;
		let hasColour = false,
		    total = 0;
		for (let n = 0; n < this.lightStages.length; n++) {
			const s = this.lightStages[n],
			      cs = this.lightColours[n] ?? [];
			if (total + s <= cp) {
				newStages.push(s);
				newColours.push(cs);
			} else {
				if (total > cp) {
					newStages.push(Math.round(s * ma));
				} else {
					newStages.push(Math.round(cp - total + (total + s - cp) * ma));
				}
				const nc = [];
				for (const {r: lr, g: lg, b: lb, a: la} of cs) {
					const c = new Colour(Math.round(Math.sqrt(r * lr) * ma), Math.round(Math.sqrt(g * lg) * ma), Math.round(Math.sqrt(b * lb) * ma), Math.round(255 * (1 - ((1 - la / 255) * ma))));
					if (c.a && (c.r || c.g || c.b)) {
						hasColour = true;
					}
					nc.push(c);
				}
				newColours.push(nc);
			}
			total += s;
		}
		return hasColour ? new Lighting(x, y, lightX, lightY, newColours, newStages, this.lightTimings) : null;
	}
	createLightPolygon(points: string, scale: number) {
		const p = polygon({points});
		definitions.addLighting(p, this, scale);
		return p;
	}
}

abstract class SVGTransform extends Lighting {
	abstract [node]: SVGGraphicsElement;
	id: Uint;
	rotation: Byte = 0;
	flip: boolean = false;
	flop: boolean = false;
	width: Uint;
	height: Uint;
	snap: boolean;
	tokenData: Record<string, KeystoreData>;
	tokenType: Uint;
	constructor(token: Token) {
		super(token.x, token.y, 0, 0, token.lightColours, token.lightStages, token.lightTimings);
		this.id = token.id;
		this.width = token.width;
		this.height = token.height;
		this.rotation = token.rotation;
		this.snap = token.snap;
		this.tokenData = token.tokenData;
		this.tokenType = token.tokenType ?? 0;
	}
	at(x: Int, y: Int) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this[node].getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.width && ry >= 0 && ry < this.height;
	}
	transformString(scale = true) {
		let ret = "";
		const s = scale && (this.flip || this.flop);
		if (this.x !== 0 || this.y !== 0 || s) {
			ret += `translate(${this.x + (scale && this.flop ? this.width : 0)}, ${this.y + (scale && this.flip ? this.height : 0)}) `;
		}
		if (s) {
			ret += `scale(${this.flop ? -1 : 1}, ${this.flip ? -1 : 1}) `;
		}
		if (this.rotation !== 0) {
			ret += `rotate(${(scale && this.flop ? -1 : 1) * (scale && this.flip ? -1 : 1) * 360 * this.rotation / 256}, ${this.width / 2}, ${this.height / 2})`;
		}
		return ret;
	}
	getData(key: string) {
		if (this.tokenData[key]) {
			return this.tokenData[key]["data"];
		} else if (this.tokenData["store-character-id"]) {
			const char = characterData.get(this.tokenData["store-character-id"]["data"]);
			if (char && char[key]) {
				return char[key]["data"];
			}
		}
		return null;
	}
	hasLight() { return !!(this.lightStages.length && this.lightTimings.length); }
	getCentre(): [Int, Int] { return [this.x + (this.width >> 1), this.y + (this.height >> 1)]; }
	getLightPos() { return this.getCentre(); }
	cleanup() {}
	uncleanup() {}
}

export class SVGToken extends SVGTransform {
	[node]: SVGGraphicsElement;
	src: Uint;
	patternWidth: Uint;
	patternHeight: Uint;
	constructor(token: TokenImage, wg?: WaitGroup) {
		super(token);
		wg?.add();
		this.src = token.src;
		this.flip = token.flip;
		this.flop = token.flop;
		this.patternWidth = token.patternWidth;
		this.patternHeight = token.patternWidth;
		this[node] = image(Object.assign({"class": "mapToken", "href": imageIDtoURL(token.src), "preserveAspectRatio": "none", "width": token.patternWidth > 0 ? token.patternWidth : token.width, "height": token.patternHeight > 0 ? token.patternHeight : token.height, "transform": this.transformString()}, wg ? {"onload": () => wg.done(), "onerror": () => wg.error()} : {}));
		if (token.patternWidth > 0) {
			setTimeout(() => this.updateNode());
		}
	}
	get isPattern() { return this.patternWidth > 0; }
	cleanup() {
		if (this.isPattern) {
			definitions.remove(this[node].getAttribute("fill")!.slice(5, -1));
		}
	}
	uncleanup() {
		if (this.isPattern) {
			amendNode(this[node], {"fill": `url(#${definitions.add(this)})`});
		}
	}
	updateSource(source: Uint) {
		amendNode(this[node] instanceof SVGRectElement ? definitions.list.get(this[node].getAttribute("fill")!.slice(5, -1))!.firstChild! : this[node], {"href": `images/${this.src = source}`});
	}
	updateNode() {
		if (this[node] instanceof SVGRectElement && !this.isPattern) {
			definitions.remove(this[node].getAttribute("fill")!.slice(5, -1));
			this[node].replaceWith(this[node] = image({"href": imageIDtoURL(this.src), "preserveAspectRatio": "none"}));
		} else if (this[node] instanceof SVGImageElement && this.isPattern) {
			this[node].replaceWith(this[node] = rect({"class": "mapPattern", "fill": `url(#${definitions.add(this)})`}));
		}
		amendNode(this[node], {"width": this.width, "height": this.height, "transform": this.transformString()});
	}
}

export class SVGShape extends SVGTransform {
	[node]: SVGGraphicsElement;
	fill: Colour;
	stroke: Colour;
	strokeWidth: Uint;
	isEllipse: boolean;
	constructor(token: TokenShape) {
		super(token);
		this.fill = token.fill;
		this.stroke = token.stroke;
		this.strokeWidth = token.strokeWidth;
		this.isEllipse = token.isEllipse ?? false;
		const rx = token.width / 2,
		      ry = token.height / 2;
		this[node] = amendNode(token.isEllipse ? ellipse({"cx": rx, "cy": ry, rx, ry}) : rect({"width": token.width, "height": token.height}), {"class": "mapShape", "fill": token.fill, "stroke": token.stroke, "stroke-width": token.strokeWidth, "transform": this.transformString()});
	}
	get isPattern() { return false; }
	updateNode() {
		if (this.isEllipse) {
			const rx = this.width / 2,
			      ry = this.height / 2;
			amendNode(this[node], {"cx": rx, "cy": ry, rx, ry, "transform": this.transformString()});
		} else {
			amendNode(this[node], {"width": this.width, "height": this.height, "transform": this.transformString()});
		}
	}
}

export class SVGDrawing extends SVGTransform {
	[node]: SVGGraphicsElement;
	fill: Colour;
	stroke: Colour;
	strokeWidth: Uint;
	points: Coords[];
	#oWidth: Uint;
	#oHeight: Uint;
	isEllipse = false;
	constructor(token: TokenDrawing) {
		super(token);
		this.fill = token.fill;
		this.stroke = token.stroke;
		this.strokeWidth = token.strokeWidth;
		this.points = token.points;
		let oWidth: Uint = 0,
		    oHeight: Uint = 0;
		for (const c of token.points) {
			if (c.x > oWidth) {
				oWidth = c.x;
			}
			if (c.y > oHeight) {
				oHeight = c.y;
			}
		}
		this.#oWidth = oWidth;
		this.#oHeight = oHeight;
		const xr = token.width / oWidth,
		      yr = token.height / oHeight;
		this[node] = path({"class": "mapDrawing", "d": `M${token.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${token.fill.a === 0 ? "" : " Z"}`, "fill": token.fill, "stroke": token.stroke, "stroke-width": token.strokeWidth, "transform": this.transformString()});
	}
	get isPattern() { return false; }
	updateNode() {
		const xr = this.width / this.#oWidth,
		      yr = this.height / this.#oHeight;
		amendNode(this[node], {"d": `M${this.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${this.fill.a === 0 ? "" : " Z"}`, "transform": this.transformString()});
	}
}

const loadTime = Date.now() / 1000;

export const [tokenSelected, tokenSelectedReceive] = new Pipe<void>().bind(3),
tokens = new Map<Uint, {layer: SVGLayer, token: SVGToken | SVGShape | SVGDrawing}>(),
selected = {
	"layer": null as SVGLayer | null,
	"token": null as SVGToken | SVGShape | SVGDrawing | null
},
outline = g(),
outlineRotationClass = (rotation: Uint) => cursors[((rotation + 143) >> 5) % 4],
deselectToken = () => {
	selected.token = null;
	amendNode(outline, {"style": {"display": "none"}});
	tokenSelected();
},
masks = (() => {
	const base = rect({"width": "100%", "height": "100%", "fill": "#000"}),
	      masks = new NodeArray<MaskNode>(g()),
	      baseNode = mask({"id": mapMask}, [base, masks]);
	let baseOpaque = false;
	return {
		get [node]() {return baseNode;},
		get baseOpaque() {return baseOpaque;},
		get masks() {return cloneObject(masks);},
		index(i: Uint) {
			return masks[i];
		},
		at(x: Uint, y: Uint) {
			let selected: Int = -1,
			    selectedMask: Mask | null = null;
			for (const [n, m] of masks.entries()) {
				switch (m[0]) {
				case 0:
				case 1: {
					const [, i, j, w, h] = m;
					if (i <= x && x <= i + w && j <= y && y <= j + h) {
						selected = n;
						selectedMask = m;
					}
				}; break;
				case 2:
				case 3: {
					const [, cx, cy, rx, ry] = m,
					      rx2 = rx * rx,
					      ry2 = ry * ry;
					if (ry2 * Math.pow(x - cx, 2) + rx2 * Math.pow(y - cy, 2) <= rx2 * ry2) {
						selected = n;
						selectedMask = m;
					}
				}; break;
				case 4:
				case 5: {
					const points = m.reduce((res, _, i) => {
						if (i % 2 === 1) {
							res.push([m[i], m[i+1]]);
						}
						return res;
					}, [] as [Uint, Uint][]);
					let last = points[points.length-1],
					    inside = false;
					for (const point of points) {
						if (y > Math.min(point[1], last[1]) && y <= Math.max(point[1], last[1]) && x <= (y - point[1]) * (last[0] - point[0]) / (last[1] - point[1]) + point[0]) {
							inside = !inside;
						}
						last = point;
					}
					if (inside) {
						selected = n;
						selectedMask = m;
					}
				}
				}
			}
			return [selectedMask, selected] as const;
		},
		add(m: Mask) {
			const fill = m[0] & 1 ? "#000" : "#fff";
			let shape: SVGRectElement | SVGEllipseElement | SVGPolygonElement;
			switch (m[0]) {
			case 0:
			case 1:
				shape = rect({"x": m[1], "y": m[2], "width": m[3], "height": m[4], fill});
				break;
			case 2:
			case 3:
				shape = ellipse({"cx": m[1], "cy": m[2], "rx": m[3], "ry": m[4], fill});
				break;
			case 4:
			case 5:
				shape = polygon({"points": m.reduce((res, _, i) => i % 2 === 1 ? `${res} ${m[i]},${m[i+1]}` : res, ""), fill});
				break;
			default:
				return -1;
			}
			return masks.push(Object.assign(m, {[node]: shape})) - 1;
		},
		remove(index: Uint) {
			masks.splice(index, 1);
		},
		set(bO: boolean, maskList: Mask[]) {
			amendNode(base, {"fill": (baseOpaque = bO) ? "#fff" : "#000"});
			masks.splice(0, masks.length);
			for (const mask of maskList) {
				this.add(mask);
			}
		}
	}
})(),
SQRT3 = Math.sqrt(3),
definitions = (() => {
	let nextLightID = 0,
	    lightPolyGroup = g(),
	    lightGradGroup = g();
	const list = new Map<string, SVGPatternElement>(),
	      lightRect = rect({"width": "100%", "height": "100%"}),
	      lightingGroup = g({"id": lighting}, [lightRect, lightPolyGroup]),
	      base = defs([masks, lightingGroup, lightGradGroup]),
	      lightGroups = new Map<string, [SVGGElement, SVGGElement]>([["", [lightPolyGroup, lightGradGroup]]]);
	return {
		get [node]() {return base;},
		get list() {return list;},
		add(t: SVGToken) {
			let i = 0;
			while (list.has(`Pattern_${i}`)) {
				i++;
			}
			const id = `Pattern_${i}`;
			amendNode(base, setAndReturn(list, id, pattern({id, "patternUnits": "userSpaceOnUse", "width": t.patternWidth, "height": t.patternHeight}, image({"href": imageIDtoURL(t.src), "width": t.patternWidth, "height": t.patternHeight, "preserveAspectRatio": "none"}))));
			return id;
		},
		remove(id: string) {
			base.removeChild(list.get(id)!).firstChild as SVGImageElement;
			list.delete(id);
		},
		setGrid({gridSize, gridColour, gridStroke, gridType}: GridDetails) {
			list.get("grid")?.remove();
			switch (gridType) {
			case 1: {
				const h = 2 * gridSize / SQRT3,
				      maxH = 3 * gridSize / SQRT3;
				amendNode(base, setAndReturn(list, "grid", pattern({"id": gridPattern, "patternUnits": "userSpaceOnUse", "width": gridSize, "height": maxH}, path({"d": `M${gridSize / 2},${maxH} V${h} l${gridSize / 2},-${h / 4} V${h / 4} L${gridSize / 2},0 L0,${h / 4} v${h / 2} L${gridSize / 2},${h}`, "stroke": gridColour, "stroke-width": gridStroke, "fill": "transparent"}))));
			}; break;
			case 2: {
				const w = 2 * gridSize / SQRT3,
				      maxW = 3 * gridSize / SQRT3;
				amendNode(base, setAndReturn(list, "grid", pattern({"id": gridPattern, "patternUnits": "userSpaceOnUse", "width": maxW, "height": gridSize}, path({"d": `M${maxW},${gridSize / 2} H${w} l-${w / 4},${gridSize / 2} H${w / 4} L0,${gridSize / 2} L${w / 4},0 h${w / 2} L${w},${gridSize/2}`, "stroke": gridColour, "stroke-width": gridStroke, "fill": "transparent"}))));
			}; break;
			default:
				amendNode(base, setAndReturn(list, "grid", pattern({"id": gridPattern, "patternUnits": "userSpaceOnUse", "width": gridSize, "height": gridSize}, path({"d": `M0,${gridSize} V0 H${gridSize}`, "stroke": gridColour, "stroke-width": gridStroke, "fill": "transparent"}))));
			}
		},
		setLight(c: Colour) {
			amendNode(lightRect, {"fill": c});
		},
		addLighting(p: SVGPolygonElement, l: Lighting, scale: number) {
			const {lightTimings, lightStages, lightColours} = l;
			if (lightTimings.length && lightStages.length) {
				let pos = 0,
				    times = 0;
				const id = `LG_${nextLightID++}`,
				      [cx, cy] = l.getLightPos(),
				      dur = lightTimings.reduce((a, b) => a + b, 0),
				      keyTimes = "0;" + lightTimings.map(t => (times += t) / dur).join(";"),
				      r = lightStages.reduce((a, b) => a + b, 0),
				      begin = timeShift - loadTime + "s",
				      rg = radialGradient({id, "r": r * scale, cx, cy, "gradientUnits": "userSpaceOnUse"}, [
					lightStages.map((stage, n) => {
					      const s = stop({"offset": (100 * pos / r) + "%", "stop-color": lightTimings.length !== 1 ? undefined : lightColours[n]?.[0] ?? noColour}, lightTimings.length !== 1 ? animate({"attributeName": "stop-color", begin, keyTimes, "dur": dur + "ms", "repeatCount": "indefinite", "values": lightTimings.map((_, m) => lightColours[n]?.[m] ?? noColour).join(";") + ";" + lightColours[n]?.[0] ?? noColour}) : []);
					      pos += stage;
					      return s;
					})
				      ]);
				amendNode(lightGradGroup, amendNode(rg, amendNode(rg.lastChild?.cloneNode(true), {"offset": "100%", "stop-opacity": 0})));
				amendNode(lightPolyGroup, amendNode(p, {"fill": `url(#${id})`}));
				return rg;
			}
			return null;
		},
		clearLighting() {
			clearNode(lightingGroup, [lightRect, lightPolyGroup = g()]);
			for (const [, [, gg]] of lightGroups) {
				gg.remove();
			}
			lightGroups.clear();
			lightGroups.set("", [lightPolyGroup, lightGradGroup = base.appendChild(g())]);
			nextLightID = 0;
		},
		setLightGroup(name: string) {
			[lightPolyGroup, lightGradGroup] = lightGroups.get(name) ?? setAndReturn(lightGroups, name, [lightingGroup.appendChild(g()), base.appendChild(g())]);
		},
		clearLightGroup(name: string) {
			const lgs = lightGroups.get(name);
			if (lgs) {
				clearNode(lgs[0]);
				clearNode(lgs[1]);
			}
		},
		clear() {
			this.clearLighting();
			for (const d of list.values()) {
				d.remove();
			}
			list.clear();
		}
	}
})();
