import type {Colour} from './types.js';
import type {ShellElement, WindowElement} from './windows.js';
import {br, button, div, h1, input} from './lib/html.js';
import {windows, shell} from './windows.js';
import {checkInt, isUint, labels} from './shared.js';
import lang from './language.js';

export const hex2Colour = (hex: string, a = 255): Colour => Object.freeze({"r": checkInt(parseInt(hex.slice(1, 3), 16), 0, 255), "g": checkInt(parseInt(hex.slice(3, 5), 16), 0, 255), "b": checkInt(parseInt(hex.slice(5, 7), 16), 0, 255), a}),
colour2Hex = (c: Colour) => `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`,
colour2RGBA = (c: Colour) => `rgba(${c.r.toString()}, ${c.g.toString()}, ${c.b.toString()}, ${(c.a / 255).toString()})`,
noColour = Object.freeze({"r": 0, "g": 0, "b": 0, "a": 0}),
colourPicker = (parent: WindowElement | ShellElement, title: string, colour: Colour = noColour, icon?: string) => new Promise<Colour>((resolve, reject) => {
	const checkboard = div({"class": "checkboard"}),
	      preview = checkboard.appendChild(div({"style": `background-color: ${colour2RGBA(colour)}`})),
	      updatePreview = () => preview.style.setProperty("background-color", colour2RGBA(hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255)))),
	      colourInput = input({"id": "colourPick_", "type": "color", "value": colour2Hex(colour), "onchange": updatePreview}),
	      alphaInput = input({"id": "alphaPick_", "type": "range", "min": "0", "max": "255", "step": "1","value": colour.a, "oninput": updatePreview}),
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
	parent.addWindow(window);
}),
makeColourPicker = (() => {
	const sc = (b: HTMLButtonElement, c: Colour) => {
		if (c.a === 0) {
			b.style.setProperty("background-color", "#fff");
			b.innerText = "None";
		} else {
			b.style.setProperty("background-color", colour2RGBA(c));
			b.innerText = "";
		}
		return c;
	};
	return (w: WindowElement | null, title: string, getColour: () => Colour, setColour: (c: Colour) => void, id = "", icon?: string) => {
		const b = button({"style": "width: 50px; height: 50px", id, "onclick": () => colourPicker(w ?? shell, title, getColour(), icon).then(c => setColour(sc(b, c)))});
		sc(b, getColour());
		return b;
	};
})(),
isColour = (v: any): v is Colour => v instanceof Object && isUint(v.r, 255) && isUint(v.g, 255) && isUint(v.b, 255) && isUint(v.a, 255);
