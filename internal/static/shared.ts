import type {Int, Uint, KeystoreData, MapData, Wall} from './types.js';
import type {Children, Props} from './lib/dom.js';
import type {Defs, SVGFolder, SVGLayer, SVGShape, SVGToken} from './map.js';
import {Pipe} from './lib/inter.js';
import {label, style} from './lib/html.js';
import {g} from './lib/svg.js';

const pipeBind = <T>(): [(data: T) => void, (fn: (data: T) => void) => void] => {
	const p = new Pipe<T>();
	return [(data: T) => p.send(data), (fn: (data: T) => void) => p.receive(fn)];
      };

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
	const ids = new Map<string, Uint>();
	return (name: Children, input: HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement, before = true, props: Props = {}) => {
		const id = input.getAttribute("id") || "ID_",
		      num = (ids.get(id) || 0) + 1;
		ids.set(id, num);
		input.setAttribute("id", props["for"] = id + num);
		const l = label(props, name);
		return before ? [l, input] : [input, l];
	};
})(),
addCSS = (css: string) => document.head.append(style({"type": "text/css"}, css)),
characterData = new Map<Uint, Record<string, KeystoreData>>(),
globals = {
	"definitions": null,
	"root": null,
	"layerList": null,
	"mapData": null,
	"tokens": new Map<Uint, {layer: SVGLayer, token: SVGToken | SVGShape}>(),
	"walls": new Map<Uint, {layer: SVGLayer, wall: Wall}>(),
	"selected": {},
	"outline": g(),
} as unknown as {
	definitions: Defs;
	root: SVGSVGElement;
	layerList: SVGFolder;
	mapData: MapData;
	tokens: Map<Uint, {layer: SVGLayer, token: SVGToken | SVGShape}>;
	walls: Map<Uint, {layer: SVGLayer, wall: Wall}>;
	selected: {layer: SVGLayer | null, token: SVGToken | SVGShape | null};
	outline: SVGGElement;
},
deselectToken = () => {
	globals.selected.token = null;
	globals.outline.style.setProperty("display", "none");
	tokenSelected();
	globals.root.focus();
},
SQRT3 = Math.sqrt(3);

export let isUser = false, isAdmin = false;
