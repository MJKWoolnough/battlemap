import type {Binding} from './lib/bind.js';
import type {Children, PropsObject} from './lib/dom.js';
import type {SVGLayer} from './map.js';
import type {CharacterToken, KeystoreData, Uint, Wall} from './types.js';
import {id} from './lib/css.js';
import {amendNode} from './lib/dom.js';
import {h2, label} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import lang from './language.js';
import {spinner} from './symbols.js';

type Input = HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement;

interface Labeller {
	<T extends Input>(name: Children, input: T, props?: PropsObject): [HTMLLabelElement, T];
	<T extends Input>(input: T, name: Children, props?: PropsObject): [T, HTMLLabelElement];
}

export const enterKey = function(this: HTMLInputElement, e: KeyboardEvent) {
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
labels = ((name: Children | Input, input: Input | Children, props: PropsObject = {}) => {
	const iProps = {"id": props["for"] = id()};
	return name instanceof HTMLInputElement || name instanceof HTMLButtonElement || name instanceof HTMLTextAreaElement || name instanceof HTMLSelectElement ? [amendNode(name, iProps), label(props, input)] : [label(props, name), amendNode(input as Input, iProps)];
}) as Labeller,
cloneObject = (() => {
	const refs = new Map(),
	      clone = <T extends any>(o: T) => {
		if (o instanceof Object && !Object.isFrozen(o)) {
			const r = refs.get(o);
			if (r) {
				return r as T;
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
	return <T>(o: T) => {
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
loading = () => [h2(lang["LOADING"]), spinner({"style": "width: 64px"})],
menuItems: [Uint, () => ([Binding, HTMLDivElement, boolean, string] | null)][] = [];
