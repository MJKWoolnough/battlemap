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
colour2RGBA = (c: Colour) => `rgba(${c.r.toString()}, ${c.g.toString()}, ${c.b.toString()}, ${(c.a / 255).toString()})`,
noColour = {"r": 0, "g": 0, "b": 0, "a": 0},
handleError = (e: Error | string) => {
	console.log(e);
	const shell = document.body.getElementsByTagName("windows-shell")[0] as ShellElement,
	      message = e instanceof Error ? e.message : typeof e  === "object" ? JSON.stringify(e) : e;
	if (shell) {
		shell.alert("Error", message);
	} else {
		alert(message);
	}
};
