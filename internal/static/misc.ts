import {Int, Uint} from './types.js';
import {Pipe} from './lib/inter.js';
import {Children, Props} from './lib/dom.js';
import {label} from './lib/html.js';

const pipeBind = <T>() => {
	const p = new Pipe<T>();
	return {"send": (data: T) => p.send(data), "receive": (fn: (data: T) => void) => p.receive(fn)};
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
})();
