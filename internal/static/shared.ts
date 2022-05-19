import type {CharacterToken, Int, KeystoreData, Uint, Wall} from './types.js';
import type {Children, Props} from './lib/dom.js';
import type {SVGLayer} from './map.js';
import {amendNode, createDocumentFragment} from './lib/dom.js';
import {h2, label, style} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import lang from './language.js';
import {spinner} from './symbols.js';

export const enterKey = function(this: Node, e: KeyboardEvent) {
	if (e.key === "Enter") {
		for (let e = this.nextSibling; e; e = e.nextSibling) {
			if (e instanceof HTMLButtonElement) {
				e.click();
				break;
			}
		}
	}
},
[mapLoadedSend, mapLoadedReceive] = new Pipe<boolean>().bind(3),
isInt = (v: any, min = -Infinity, max = Infinity): v is Int => typeof v === "number" && (v|0) === v && v >= min && v <= max,
isUint = (v: any, max = Infinity): v is Uint => isInt(v, 0, max),
checkInt = (n: number, min = -Infinity, max = Infinity, def = 0) => isInt(n, min, max) ? n : def,
mod = (n: Uint, m: Uint) => ((n % m) + m) % m,
queue = (() => {
	let p = Promise.resolve();
	return (fn: () => Promise<any>) => p = p.finally(fn);
})(),
labels = (() => {
	type Input = HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement;

	type LProps = Exclude<Props, NamedNodeMap>;

	interface Labeller {
		<T extends Input>(name: Children, input: T, props?: LProps): [HTMLLabelElement, T];
		<T extends Input>(input: T, name: Children, props?: LProps): [T, HTMLLabelElement];
	}

	let next = 0;
	return ((name: Children | Input, input: Input | Children, props: LProps = {}) => {
		const iProps = {"id": props["for"] = `ID_${next++}`};
		return name instanceof HTMLInputElement || name instanceof HTMLButtonElement || name instanceof HTMLTextAreaElement || name instanceof HTMLSelectElement ? [amendNode(name, iProps), label(props, input)] : [label(props, name), amendNode(input as Input, iProps)];
	}) as Labeller;
})(),
addCSS = (css: string) => amendNode(document.head, style({"type": "text/css"}, css)),
cloneObject = (() => {
	const refs = new Map(),
	      clone = <T extends any>(o: T): T => {
		if (o instanceof Object && !Object.isFrozen(o)) {
			const r = refs.get(o);
			if (r) {
				return r;
			}
			if (Array.isArray(o)) {
				const a: T[keyof T][] = [];
				refs.set(o, a);
				for (const v of o) {
					a.push(clone(v));
				}
				return a as T;
			}
			const c = {} as T;
			refs.set(o, c);
			for (const k in o) {
				if (o.hasOwnProperty(k)) {
					c[k as keyof T] = clone(o[k as keyof T]);
				}
			}
			return c;
		}
		return o;
	      };
	return <T>(o: T): T => {
		const c = clone(o);
		refs.clear();
		return c;
	};
})(),
characterData = new Map<Uint, Record<string, KeystoreData>>(),
[getCharacterToken, resetCharacterTokens] = (() => {
	const tokensSymbol = Symbol("tokens");

	type CharacterRecord = Record<string, KeystoreData> & {
		[tokensSymbol]?: CharacterToken[];
	}

	return [
		(data: CharacterRecord) => {
			let list = data[tokensSymbol];
			if (list === undefined || list.length === 0) {
				const tokens = data["store-image-data"];
				if (tokens) {
					if (tokens.data instanceof Array) {
						data[tokensSymbol] = list = Array.from(tokens.data);
						if (data?.["tokens_order"]?.data) {
							for (let p = list.length - 1; p >= 0; p--) {
								const r = Math.floor(Math.random() * list.length);
								[list[p], list[r]] = [list[r], list[p]];
							}
						} else {
							list.reverse();
						}
					} else {
						return cloneObject(tokens.data);
					}
				}
			}
			const tk = list?.pop();
			return tk ? cloneObject(tk) : null;
		},
		(data: CharacterRecord) => delete data[tokensSymbol]
	] as const;
})(),
walls = new Map<Uint, {layer: SVGLayer, wall: Wall}>(),
setAndReturn = <K, V>(m: {set: (k: K, v: V) => any}, k: K, v: V) => {
	m.set(k, v);
	return v;
},
loading = (id?: string) => createDocumentFragment([h2({"id": id}, lang["LOADING"]), spinner({"style": "width: 64px"})]),
menuItems: [Uint, () => ([string, HTMLDivElement, boolean, string] | null)][] = [];
