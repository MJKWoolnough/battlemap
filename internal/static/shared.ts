import type {Int, Uint, KeystoreData, MapData, Wall} from './types.js';
import type {Children, Props} from './lib/dom.js';
import type {Defs, SVGFolder, SVGLayer, SVGShape, SVGToken} from './map.js';
import {Pipe, Requester} from './lib/inter.js';
import {label} from './lib/html.js';
import {g} from './lib/svg.js';

const pipeBind = <T>() => {
	const p = new Pipe<T>();
	return {"send": (data: T) => p.send(data), "receive": (fn: (data: T) => void) => p.receive(fn)};
      },
      requesterBind = <T, U extends any[] = any[]>() => {
	const r = new Requester<T, U>();
	return {"request": (...data: U) => r.request(...data), "responder": (fn: ((...data: U) => T) | T) => r.responder(fn)};
      };

export const enterKey = function(this: Node, e: KeyboardEvent): void {
	if (e.keyCode === 13) {
		for (let e = this.nextSibling; e != null; e = e.nextSibling) {
			if (e instanceof HTMLButtonElement) {
				e.click();
				break;
			}
		}
	}
},
{send: mapLoadSend, receive: mapLoadReceive} = pipeBind<Uint>(),
{send: mapLoadedSend, receive: mapLoadedReceive} = pipeBind<boolean>(),
{send: tokenSelected, receive: tokenSelectedReceive} = pipeBind<void>(),
{responder: setUser, request: isUser} = requesterBind<boolean>(),
{responder: setAdmin, request: isAdmin} = requesterBind<boolean>(),
isInt = (v: any, min = -Infinity, max = Infinity): v is Int => typeof v === "number" && (v|0) === v && v >= min && v <= max,
isUint = (v: any, max = Infinity): v is Uint => isInt(v, 0, max),
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
characterData = new Map<Uint, Record<string, KeystoreData>>(),
globals = {
	"definitions": null,
	"root": null,
	"layerList": null,
	"mapData": null,
	"tokens": null,
	"walls": null,
	"selected": {},
	"outline": g(),
} as unknown as {
	definitions: Defs;
	root: SVGSVGElement;
	layerList: SVGFolder;
	mapData: MapData;
	tokens: {layer: SVGLayer, token: SVGToken | SVGShape}[];
	walls: {layer: SVGLayer, wall: Wall}[];
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
