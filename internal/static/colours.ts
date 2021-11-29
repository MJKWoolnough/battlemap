import type {Byte} from './types.js';
import type {ShellElement, WindowElement} from './windows.js';
import {createHTML, br, button, div, h1, input} from './lib/html.js';
import lang from './language.js';
import {checkInt, labels} from './shared.js';
import {shell, windows} from './windows.js';

export class Colour {
	readonly r: Byte = 0;
	readonly g: Byte = 0;
	readonly b: Byte = 0;
	readonly a: Byte = 255;
	static from(c: {r: Byte; g: Byte; b: Byte; a: Byte;}) {
		return Object.freeze(Object.setPrototypeOf(c, Colour.prototype));
	}
	toString() {
		return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a / 255})`;
	}
	toHexString() {
		return `#${this.r.toString(16).padStart(2, "0")}${this.g.toString(16).padStart(2, "0")}${this.b.toString(16).padStart(2, "0")}`;
	}
}

export const hex2Colour = (hex: string, a = 255) => Colour.from({"r": checkInt(parseInt(hex.slice(1, 3), 16), 0, 255), "g": checkInt(parseInt(hex.slice(3, 5), 16), 0, 255), "b": checkInt(parseInt(hex.slice(5, 7), 16), 0, 255), a}),
noColour = Colour.from({"r": 0, "g": 0, "b": 0, "a": 0}),
colourPicker = (parent: WindowElement | ShellElement, title: string, colour: Colour = noColour, icon?: string) => new Promise<Colour>((resolve, reject) => {
	const checkboard = div({"class": "checkboard"}),
	      preview = checkboard.appendChild(div({"style": `background-color: ${colour}`})),
	      updatePreview = () => createHTML(preview, {"style": {"background-color": hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255)) + ""}}),
	      colourInput = input({"type": "color", "value": colour.toHexString(), "onchange": updatePreview}),
	      alphaInput = input({"type": "range", "min": 0, "max": 255, "step": 1,"value": colour.a, "oninput": updatePreview}),
	      window = windows({"window-icon": icon, "window-title": title, "class": "lightChange", "onremove": reject}, [
		h1(title),
		checkboard,
		labels(`${lang["COLOUR"]}: `, colourInput),
		br(),
		labels(`${lang["COLOUR_ALPHA"]}: `, alphaInput),
		br(),
		button(lang["COLOUR_UPDATE"], {"onclick": function(this: HTMLButtonElement) {
			this.toggleAttribute("disabled", true);
			resolve(hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255)));
			window.remove();
		}})
	      ]);
	(parent.parentNode ? parent : shell).addWindow(window);
}),
makeColourPicker = (() => {
	const sc = (b: HTMLButtonElement, c: Colour) => {
		createHTML(b, {"style": {"background-color": c.a ? c + "" : "#fff"}}, c.a ? "" : "None");
		return c;
	};
	return (w: WindowElement | null, title: string, getColour: () => Colour, setColour: (c: Colour) => void, icon?: string) => {
		const b = button({"style": "width: 50px; height: 50px", "onclick": () => colourPicker(w ?? shell, title, getColour(), icon).then(c => setColour(sc(b, c)))});
		sc(b, getColour());
		return b;
	};
})();
