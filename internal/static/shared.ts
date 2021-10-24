import type {Int, Uint, CharacterToken, GridDetails, KeystoreData, MapData, Mask, Wall} from './types.js';
import type {Children, Props} from './lib/dom.js';
import type {SVGFolder, SVGLayer, SVGShape, SVGToken} from './map.js';
import {NodeArray, node} from './lib/nodes.js';
import {Pipe} from './lib/inter.js';
import {label, style} from './lib/html.js';
import {defs, ellipse, filter, g, image, mask, path, pattern, polygon, rect} from './lib/svg.js';

type MaskNode = Mask & {
	[node]: SVGRectElement | SVGEllipseElement | SVGPolygonElement;
}

const pipeBind = <T>(): [(data: T) => void, (fn: (data: T) => void) => void] => {
	const p = new Pipe<T>();
	return [(data: T) => p.send(data), (fn: (data: T) => void) => p.receive(fn)];
      },
      masks = (() => {
	const base = rect({"width": "100%", "height": "100%", "fill": "#000"}),
	      masks = new NodeArray<MaskNode>(g()),
	      baseNode = mask({"id": "mapMask"}, [base, masks[node]]);
	let baseOpaque = false;
	return {
		get [node]() {return baseNode;},
		get baseOpaque() {return baseOpaque;},
		get masks() {return masks;},
		index(i: Uint) {
			return masks[i];
		},
		at(x: Uint, y: Uint) {
			let selected: MaskNode | null = null;
			for (const m of masks) {
				switch (m[0]) {
				case 0:
				case 1: {
					const [, i, j, w, h] = m;
					if (i <= x && x <= i + w && j <= y && y <= j + h) {
						selected = m;
					}
				}; break;
				case 2:
				case 3: {
					const [, cx, cy, rx, ry] = m,
					      rx2 = Math.pow(rx, 2),
					      ry2 = Math.pow(ry, 2);
					if (ry2 * Math.pow(x - cx, 2) + rx2 * Math.pow(y - cy, 2) <= rx2 * ry2) {
						selected = m;
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
						selected = m;
					}
				}
				}
			}
			return selected;
		},
		add(m: Mask) {
			const fill = (m[0] & 1) === 1 ? "#fff" : "#000";
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
				shape = polygon({"points": m.reduce((res, _, i) => {
					if (i % 2 === 1) {
						res.push(m[i] + "," + m[i+1]);
					}
					return res;
				}, [] as string[]).join(" "), fill});
				break;
			default:
				return -1;
			}
			return masks.push(Object.assign(m, {[node]: shape})) - 1;
		},
		remove(index: Uint) {
			masks.splice(index, 1);
		},
		set(baseOpaque: boolean, masks: Mask[]) {
			baseOpaque = baseOpaque;
			masks.splice(0, masks.length);
			for (const mask of masks) {
				this.add(mask);
			}
		}
	}
      })(),
      definitions = (() => {
	const base = defs(masks[node]),
	      list = new Map<string, SVGPatternElement>(),
	      lighting = new Map<string, SVGFilterElement>();
	return {
		get [node]() {return base;},
		get list() {return list;},
		add(t: SVGToken) {
			let i = 0;
			while (list.has(`Pattern_${i}`)) {
				i++;
			}
			const id = `Pattern_${i}`;
			list.set(id, base.appendChild(pattern({"id": id, "patternUnits": "userSpaceOnUse", "width": t.patternWidth, "height": t.patternHeight}, image({"href": `/images/${t.src}`, "width": t.patternWidth, "height": t.patternHeight, "preserveAspectRatio": "none"}))));
			return id;
		},
		remove(id: string) {
			base.removeChild(list.get(id)!).firstChild as SVGImageElement;
			list.delete(id);
		},
		setGrid(grid: GridDetails) {
			const old = list.get("grid");
			if (old) {
				base.removeChild(old);
			}
			switch (grid.gridType) {
			case 1: {
				const w = grid.gridSize,
				      h = 2 * w / SQRT3,
				      maxH = 2 * Math.round(1.5 * w / SQRT3);
				list.set("grid", base.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": w, "height": maxH}, path({"d": `M${w / 2},${maxH} V${h} l${w / 2},-${h / 4} V${h / 4} L${w / 2},0 L0,${h / 4} v${h / 2} L${w / 2},${h}`, "stroke": grid.gridColour, "stroke-width": grid.gridStroke, "fill": "transparent"}))));
			}; break;
			case 2: {
				const h = grid.gridSize,
				      w = 2 * h / SQRT3,
				      maxW = 2 * Math.round(1.5 * h / SQRT3);
				list.set("grid", base.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": maxW, "height": h}, path({"d": `M${maxW},${h / 2} H${w} l-${w / 4},${h / 2} H${w / 4} L0,${h / 2} L${w / 4},0 h${w / 2} L${w},${h/2}`, "stroke": grid.gridColour, "stroke-width": grid.gridStroke, "fill": "transparent"}))));
			}; break;
			default:
				list.set("grid", base.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": grid.gridSize, "height": grid.gridSize}, path({"d": `M0,${grid.gridSize} V0 H${grid.gridSize}`, "stroke": grid.gridColour, "stroke-width": grid.gridStroke, "fill": "transparent"}))));
			}
		},
		getLighting(id: string) {
			if (lighting.has(id)) {
				return lighting.get(id)!;
			}
			const f = base.appendChild(filter({id}));
			lighting.set(id, f);
			return f;
		},
		clearLighting() {
			for (const l of lighting.values()) {
				l.remove();
			}
			lighting.clear();
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


export const enterKey = function(this: Node, e: KeyboardEvent): void {
	if (e.key === "Enter") {
		for (let e = this.nextSibling; e != null; e = e.nextSibling) {
			if (e instanceof HTMLButtonElement) {
				e.click();
				break;
			}
		}
	}
},
[mapLoadSend, mapLoadReceive] = pipeBind<Uint>(),
[mapLoadedSend, mapLoadedReceive] = pipeBind<boolean>(),
[tokenSelected, tokenSelectedReceive] = pipeBind<void>(),
setUser = (v: boolean) => isUser = v,
setAdmin = (v: boolean) => isAdmin = v,
isInt = (v: any, min = -Infinity, max = Infinity): v is Int => typeof v === "number" && (v|0) === v && v >= min && v <= max,
isUint = (v: any, max = Infinity): v is Uint => isInt(v, 0, max),
checkInt = (n: number, min = -Infinity, max = Infinity, def = 0) => isInt(n, min, max) ? n : def,
mod = (n: Uint, m: Uint) => {
	while (n >= m) {
		n -= m;
	}
	while (n < 0) {
		n += m;
	}
	return n;
},
queue = (() => {
	let p = Promise.resolve();
	return (fn: () => Promise<any>) => p = p.finally(fn);
})(),
labels = (() => {
	let next = 0;
	return (name: Children, input: HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement, before = true, props: Props = {}) => {
		input.setAttribute("id", props["for"] = `ID_${next++}`);
		const l = label(props, name);
		return before ? [l, input] : [input, l];
	};
})(),
addCSS = (css: string) => document.head.append(style({"type": "text/css"}, css)),
characterData = new Map<Uint, Record<string, KeystoreData>>(),
[getCharacterToken, resetCharacterTokens] = (() => {
	const tokensSymbol = Symbol("tokens");
	return [
		(data: Record<string, KeystoreData>) => {
			let list = (data as any)[tokensSymbol] as CharacterToken[];
			if (list === undefined || list.length === 0) {
				const tokens = data["store-image-data"];
				if (tokens) {
					if (tokens.data instanceof Array) {
						(data as any)[tokensSymbol] = list = Array.from(tokens.data);
						if (data?.["tokens_order"]?.data) {
							for (let p = list.length - 1; p >= 0; p--) {
								const r = Math.floor(Math.random() * list.length);
								[list[p], list[r]] = [list[r], list[p]];
							}
						} else {
							list.reverse();
						}
					} else {
						return JSON.parse(JSON.stringify(tokens.data));
					}
				}
			}
			const tk = list.pop();
			if (tk) {
				return JSON.parse(JSON.stringify(tk));
			}
			return null;
		},
		(data: Record<string, KeystoreData>) => delete (data as any)[tokensSymbol]
	] as const;
})(),
globals = {
	definitions,
	masks,
	"root": null as any as SVGSVGElement,
	"layerList": null as any as SVGFolder,
	"mapData": null as any as MapData,
	"tokens": new Map<Uint, {layer: SVGLayer, token: SVGToken | SVGShape}>(),
	"walls": new Map<Uint, {layer: SVGLayer, wall: Wall}>(),
	"selected": {
		"layer": null as SVGLayer | null,
		"token": null as SVGToken | SVGShape | null
	},
	"outline": g(),
},
deselectToken = () => {
	globals.selected.token = null;
	globals.outline.style.setProperty("display", "none");
	tokenSelected();
	globals.root.focus();
},
SQRT3 = Math.sqrt(3);

export let isUser = false, isAdmin = false;
