import {createHTML} from './lib/dom.js';
import {Colour} from './types.js';
import {ShellElement} from './windows.js';

export const enterKey = function(this: Node, e: KeyboardEvent): void {
	if (e.keyCode === 13) {
		for (let e = this.nextSibling; e != null; e = e.nextSibling) {
			if (e instanceof HTMLButtonElement) {
				e.click();
				break;
			}
		}
	}
}, hex2Colour = (hex: string): Colour => ({"r": parseInt(hex.slice(1, 3), 16), "g": parseInt(hex.slice(3, 5), 16), "b": parseInt(hex.slice(5, 7), 16), "a": 255}),
colour2Hex = (c: Colour) => `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`,
rgba2Colour = (rgba: string): Colour => {
	if (rgba === "transparent" || rgba === "") {
		return {"r": 0, "g": 0, "b": 0, "a": 0};
	}
	const colours = rgba.slice(5, -1).replace(/ /g, "").split(",");
	return {"r": parseInt(colours[0]), "g": parseInt(colours[1]), "b": parseInt(colours[2]), "a": (parseFloat(colours[3]) * 255)|0};
},
colour2RGBA = (c: Colour) => `rgba(${c.r.toString()}, ${c.g.toString()}, ${c.b.toString()}, ${(c.a / 255).toString()})`,
noColour = {"r": 0, "g": 0, "b": 0, "a": 0},
handleError = (e: Error | string) => {
	console.log(e);
	(document.body.getElementsByTagName("windows-shell")[0] as ShellElement).alert("Error", e instanceof Error ? e.message : e);
};
