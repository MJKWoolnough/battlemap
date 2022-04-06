import type {Byte} from './types.js';
import type {ShellElement, WindowElement} from './windows.js';
import {amendNode} from './lib/dom.js';
import {DragTransfer, setDragEffect} from './lib/drag.js';
import {br, button, div, h1, img, input} from './lib/html.js';
import lang from './language.js';
import {checkInt, labels} from './shared.js';
import {shell, windows} from './windows.js';

export class Colour {
	readonly r: Byte = 0;
	readonly g: Byte = 0;
	readonly b: Byte = 0;
	readonly a: Byte = 255;
	static from(c: {r: Byte; g: Byte; b: Byte; a: Byte;}) {
		return c instanceof Colour ? c : Object.freeze(Object.setPrototypeOf(c, Colour.prototype));
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
	const dragKey = dragColour.register({"transfer": () => hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255))}),
	      preview = div({"style": `background-color: ${colour}`, "draggable": "true", "ondragstart": (e: DragEvent) => dragColour.set(e, dragKey, iconImg), "ondragover": dragCheck, "ondrop": (e: DragEvent) => {
		if (dragColour.is(e)) {
			const c = dragColour.get(e);
			colourInput.value = c.toHexString();
			alphaInput.value = c.a + "";
			amendNode(preview, {"style": {"background-color": c}});
		}
	      }}),
	      updatePreview = () => amendNode(preview, {"style": {"background-color": hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255)) + ""}}),
	      colourInput = input({"type": "color", "value": colour.toHexString(), "onchange": updatePreview}),
	      alphaInput = input({"type": "range", "min": 0, "max": 255, "step": 1,"value": colour.a, "oninput": updatePreview}),
	      w = windows({"window-icon": icon, "window-title": title, "class": "lightChange", "onremove": () => {
		      dragColour.deregister(dragKey);
		      reject();
	      }}, [
		h1(title),
		div({"class": "checkboard"}, preview),
		labels(`${lang["COLOUR"]}: `, colourInput),
		br(),
		labels(`${lang["COLOUR_ALPHA"]}: `, alphaInput),
		br(),
		button({"onclick": function(this: HTMLButtonElement) {
			amendNode(this, {"disabled": true});
			resolve(hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255)));
			w.remove();
		}}, lang["COLOUR_UPDATE"])
	      ]);
	(parent.parentNode ? parent : shell).addWindow(w);
}),
makeColourPicker = (() => {
	const sc = (s: HTMLDivElement, c: Colour) => {
		amendNode(s, {"style": {"background-color": c}});
		return c;
	};
	return (w: WindowElement | null, title: string, getColour: () => Colour, setColour: (c: Colour) => void, icon?: string) => {
		let active = false;
		const dragKey = dragColour.register({"transfer": getColour}),
		      d = div ({"draggable": "true", "ondragstart": (e: DragEvent) => dragColour.set(e, dragKey, iconImg)}),
		      b = button({"class": "checkboard colourButton", "onclick": () => {
			if (!active) {
				active = true;
				colourPicker(w ?? shell, title, getColour(), icon).then(c => setColour(sc(d, c))).finally(() => active = false);
			}
		      }, "ondragover": dragCheck, "ondrop": (e: DragEvent) => {
			if (dragColour.is(e)) {
				setColour(sc(d, dragColour.get(e)));
			}
		      }}, d);
		sc(d, getColour());
		return b;
	};
})(),
dragColour = new DragTransfer<Colour>("colour");

const iconImg = img({"src": 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"%3E%3Cstyle type="text/css"%3Esvg%7Bbackground-color:%23000%7Dcircle%7Bmix-blend-mode:screen%7D%3C/style%3E%3Ccircle r="10" cx="10" cy="10" fill="%23f00" /%3E%3Ccircle r="10" cx="20" cy="10" fill="%230f0" /%3E%3Ccircle r="10" cx="15" cy="20" fill="%2300f" /%3E%3C/svg%3E%0A'}),
      dragCheck = setDragEffect({"copy": [dragColour]});
