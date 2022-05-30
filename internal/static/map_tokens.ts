import type {Byte, Coords, GridDetails, Int, KeystoreData, Mask, Token, TokenDrawing, TokenImage, TokenShape, Uint} from './types.js';
import type {WaitGroup} from './lib/inter.js';
import type {Colour} from './colours.js';
import type {SVGLayer} from './map.js';
import type {LightSource} from './map_lighting.js';
import {amendNode} from './lib/dom.js';
import {Pipe} from './lib/inter.js';
import {NodeArray, node} from './lib/nodes.js';
import {animate, defs, ellipse, g, image, mask, path, pattern, polygon, radialGradient, rect, stop} from './lib/svg.js';
import {noColour} from './colours.js';
import {timeShift} from './rpc.js';
import {enableLightingAnimation} from './settings.js';
import {characterData, cloneObject, setAndReturn} from './shared.js';

type MaskNode = Mask & {
	[node]: SVGRectElement | SVGEllipseElement | SVGPolygonElement;
}

abstract class SVGTransform {
	[node]: SVGGraphicsElement;
	id: Uint;
	x: Int = 0;
	y: Int = 0;
	rotation: Byte = 0;
	flip: boolean = false;
	flop: boolean = false;
	width: Uint;
	height: Uint;
	lightColours: Colour[][];
	lightStages: Uint[];
	lightTimings: Uint[];
	snap: boolean;
	tokenData: Record<string, KeystoreData>;
	tokenType: Uint;
	constructor(token: Token) {
		this.id = token.id;
		this.width = token.width;
		this.height = token.height;
		this.x = token.x;
		this.y = token.y;
		this.rotation = token.rotation;
		this.lightColours = token.lightColours;
		this.lightStages = token.lightStages;
		this.lightTimings = token.lightTimings;
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
	getCentre(): [Int, Int] { return [this.x + this.width / 2, this.y + this.height / 2]; }
	getLightPos() { return this.getCentre(); }
	cleanup() {}
	uncleanup() {}
}

export class SVGToken extends SVGTransform {
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
		this[node] = image(Object.assign({"class": "mapToken", "href": `/images/${token.src}`, "preserveAspectRatio": "none", "width": token.patternWidth > 0 ? token.patternWidth : token.width, "height": token.patternHeight > 0 ? token.patternHeight : token.height, "transform": this.transformString()}, wg ? {"onload": () => wg.done(), "onerror": () => wg.error()} : {}));
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
			this[node].replaceWith(this[node] = image({"href": `/images/${this.src}`, "preserveAspectRatio": "none"}));
		} else if (this[node] instanceof SVGImageElement && this.isPattern) {
			this[node].replaceWith(this[node] = rect({"class": "mapPattern", "fill": `url(#${definitions.add(this)})`}));
		}
		amendNode(this[node], {"width": this.width, "height": this.height, "transform": this.transformString()});
	}
}

export class SVGShape extends SVGTransform {
	fill: Colour;
	stroke: Colour;
	strokeWidth: Uint;
	isEllipse: boolean;
	constructor(token: TokenShape, draw = true) {
		super(token);
		this.fill = token.fill;
		this.stroke = token.stroke;
		this.strokeWidth = token.strokeWidth;
		this.isEllipse = token.isEllipse ?? false;
		if (draw) {
			const rx = token.width / 2,
			      ry = token.height / 2;
			this[node] = amendNode(token.isEllipse ? ellipse({"cx": rx, "cy": ry, rx, ry}) : rect({"width": token.width, "height": token.height}), {"class": "mapShape", "fill": token.fill, "stroke": token.stroke, "stroke-width": token.strokeWidth, "transform": this.transformString()});
		}
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

export class SVGDrawing extends SVGShape {
	points: Coords[];
	#oWidth: Uint;
	#oHeight: Uint;
	constructor(token: TokenDrawing) {
		super(token, false);
		this.points = token.points;
		this.isEllipse = false;
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
		this[node] = amendNode(path({"class": "mapDrawing", "d": `M${token.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${token.fill.a === 0 ? "" : " Z"}`, "fill": token.fill, "stroke": token.stroke, "stroke-width": token.strokeWidth}), {"transform": this.transformString()});
	}
	updateNode() {
		const xr = this.width / this.#oWidth,
		      yr = this.height / this.#oHeight;
		this[node] = path({"d": `M${this.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${this.fill.a === 0 ? "" : " Z"}`, "transform": this.transformString()});
	}
}

const loadTime = Date.now() / 1000;

export const [tokenSelected, tokenSelectedReceive] = new Pipe<void>().bind(3),
tokens = new Map<Uint, {layer: SVGLayer, token: SVGToken | SVGShape}>(),
selected = {
	"layer": null as SVGLayer | null,
	"token": null as SVGToken | SVGShape | null
},
outline = g(),
outlineRotationClass = (rotation: Uint) => `cursor_${((rotation + 143) >> 5) % 4}`,
deselectToken = () => {
	selected.token = null;
	amendNode(outline, {"style": {"display": "none"}});
	tokenSelected();
},
masks = (() => {
	const base = rect({"width": "100%", "height": "100%", "fill": "#000"}),
	      masks = new NodeArray<MaskNode>(g()),
	      baseNode = mask({"id": "mapMask"}, [base, masks[node]]);
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
	const base = defs(masks[node]),
	      list = new Map<string, SVGPatternElement>(),
	      lighting: SVGRadialGradientElement[] = [];
	let nextLightID = 0;
	return {
		get [node]() {return base;},
		get list() {return list;},
		add(t: SVGToken) {
			let i = 0;
			while (list.has(`Pattern_${i}`)) {
				i++;
			}
			const id = `Pattern_${i}`;
			amendNode(base, setAndReturn(list, id, pattern({id, "patternUnits": "userSpaceOnUse", "width": t.patternWidth, "height": t.patternHeight}, image({"href": `/images/${t.src}`, "width": t.patternWidth, "height": t.patternHeight, "preserveAspectRatio": "none"}))));
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
				amendNode(base, setAndReturn(list, "grid", pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": gridSize, "height": maxH}, path({"d": `M${gridSize / 2},${maxH} V${h} l${gridSize / 2},-${h / 4} V${h / 4} L${gridSize / 2},0 L0,${h / 4} v${h / 2} L${gridSize / 2},${h}`, "stroke": gridColour, "stroke-width": gridStroke, "fill": "transparent"}))));
			}; break;
			case 2: {
				const w = 2 * gridSize / SQRT3,
				      maxW = 3 * gridSize / SQRT3;
				amendNode(base, setAndReturn(list, "grid", pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": maxW, "height": gridSize}, path({"d": `M${maxW},${gridSize / 2} H${w} l-${w / 4},${gridSize / 2} H${w / 4} L0,${gridSize / 2} L${w / 4},0 h${w / 2} L${w},${gridSize/2}`, "stroke": gridColour, "stroke-width": gridStroke, "fill": "transparent"}))));
			}; break;
			default:
				amendNode(base, setAndReturn(list, "grid", pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": gridSize, "height": gridSize}, path({"d": `M0,${gridSize} V0 H${gridSize}`, "stroke": gridColour, "stroke-width": gridStroke, "fill": "transparent"}))));
			}
		},
		addLighting(l: LightSource, scale: number) {
			const {lightTimings, lightStages, lightColours} = l;
			if (lightTimings.length && lightStages.length) {
				let pos = 0,
				    times = 0;
				const id = `LG_${nextLightID++}`,
				      [cx, cy] = l.getLightPos(),
				      dur = lightTimings.reduce((a, b) => a + b, 0),
				      keyTimes = "0;" + lightTimings.map(t => (times += t) / dur).join(";"),
				      multiTimes = enableLightingAnimation.value && lightTimings.length !== 1,
				      r = lightStages.reduce((a, b) => a + b, 0),
				      begin = timeShift - loadTime + "s",
				      rg = radialGradient({id, "r": r * scale, cx, cy, "gradientUnits": "userSpaceOnUse"}, [
					lightStages.map((stage, n) => {
					      const s = stop({"offset": (100 * pos / r) + "%", "stop-color": multiTimes ? undefined : lightColours[n]?.[0] ?? noColour}, multiTimes ? animate({"attributeName": "stop-color", begin, keyTimes, "dur": dur + "ms", "repeatCount": "indefinite", "values": lightTimings.map((_, m) => lightColours[n]?.[m] ?? noColour).join(";") + ";" + lightColours[n]?.[0] ?? noColour}) : []);
					      pos += stage;
					      return s;
					})
				      ]);
				amendNode(rg, amendNode(rg.lastChild?.cloneNode(true), {"offset": "100%", "stop-opacity": 0}));
				lighting.push(rg);
				amendNode(base, rg);
				return id;
			}
			return "";
		},
		clearLighting() {
			for (const l of lighting) {
				l.remove();
			}
			lighting.splice(0, lighting.length);
			nextLightID = 0;
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
