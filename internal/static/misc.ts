import {createHTML} from './lib/html.js';
import {Colour} from './types.js';

export const enterKey = function(this: Node, e: KeyboardEvent): void {
	if (e.keyCode === 13) {
		for (let e = this.nextSibling; e != null; e = e.nextSibling) {
			if (e instanceof HTMLButtonElement) {
				e.click();
				break;
			}
		}
	}
}, showError = (elm: Node, e: Error | string): void => {
	const msg =  e instanceof Error ? e.message : e;
	if (elm.nextSibling !== null) {
		if ((elm.nextSibling as HTMLElement).classList.contains("error")) {
			elm.nextSibling.textContent = msg;
		} else if (elm.parentNode !== null) {
			elm.parentNode.insertBefore(createHTML("span", {"class": "error"}, msg), elm.nextSibling);
		}
	} else if (elm.parentNode !== null) {
		elm.parentNode.appendChild(createHTML("span", {"class": "error"}, msg));
	}
}, clearError = (elm: Node): void => {
	if (elm.parentNode !== null && elm.nextSibling !== null && (elm.nextSibling as HTMLElement).classList.contains("error")) {
		elm.parentNode.removeChild(elm.nextSibling);
	}
}, hex2Colour = (hex: string): Colour => ({"r": parseInt(hex.slice(1, 3), 16), "g": parseInt(hex.slice(3, 5), 16), "b": parseInt(hex.slice(5, 7), 16), "a": 1}),
colour2Hex = (c: Colour) => `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`,
autoFocus = <T extends HTMLElement>(node: T) => {
	window.setTimeout(() => node.focus(), 0);
	return node;
};
