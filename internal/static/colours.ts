import type {Byte} from './types.js';
import type {Binding} from './lib/bind.js';
import type {ShellElement, WindowElement} from './windows.js';
import {add, ids} from './lib/css.js';
import {amendNode} from './lib/dom.js';
import {DragTransfer, setDragEffect} from './lib/drag.js';
import {br, button, div, h1, img, input} from './lib/html.js';
import {checkInt, isInt} from './lib/misc.js';
import {JSONSetting} from './lib/settings.js';
import lang from './language.js';
import {labels} from './shared.js';
import {shell, windows} from './windows.js';

export class Colour {
	readonly r: Byte = 0;
	readonly g: Byte = 0;
	readonly b: Byte = 0;
	readonly a: Byte = 255;
	constructor(r: Byte, g: Byte, b: Byte, a: Byte = 255) {
		this.r = checkInt(r, 0, 255);
		this.g = checkInt(g, 0, 255);
		this.b = checkInt(b, 0, 255);
		this.a = checkInt(a, 0, 255);
		return Object.freeze(this);
	}
	static from(c: {r: Byte; g: Byte; b: Byte; a: Byte;}) {
		return c instanceof Colour ? c : Object.freeze(Object.setPrototypeOf(c, Colour.prototype));
	}
	toString() {
		return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a / 255})`;
	}
	toHexString() {
		return `#${Math.round(this.r).toString(16).padStart(2, "0")}${Math.round(this.g).toString(16).padStart(2, "0")}${Math.round(this.b).toString(16).padStart(2, "0")}`;
	}
}

export class ColourSetting extends JSONSetting<Colour> {
	constructor(name: string, starting: Colour) {
		super(name, starting, (v: any): v is Colour => {
			if (v instanceof Object && isInt(v.r, 0, 255) && isInt(v.g, 0, 255) && isInt(v.b, 0, 255) && isInt(v.a, 0, 255)) {
				Colour.from(v);
				return true;
			}
			return false;
		});
	}
}

export const hex2Colour = (hex: string, a = 255) => new Colour(checkInt(parseInt(hex.slice(1, 3), 16), 0, 255), checkInt(parseInt(hex.slice(3, 5), 16), 0, 255), checkInt(parseInt(hex.slice(5, 7), 16), 0, 255), a),
noColour = new Colour(0, 0, 0, 0),
colourPicker = (parent: WindowElement | ShellElement, title: string | Binding, colour: Colour = noColour, icon?: string | Binding) => new Promise<Colour>((resolve, reject) => {
	const dragKey = dragColour.register(() => hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255))),
	      preview = div({"style": `background-color: ${colour}`, "draggable": "true", "ondragstart": (e: DragEvent) => dragColour.set(e, dragKey, iconImg), "ondragover": dragCheck, "ondrop": (e: DragEvent) => {
		if (dragColour.is(e)) {
			const c = dragColour.get(e);
			colourInput.value = c.toHexString();
			alphaInput.value = c.a + "";
			amendNode(preview, {"style": {"background-color": c}});
		}
	      }}),
	      updatePreview = () => amendNode(preview, {"style": {"background-color": hex2Colour(colourInput.value, checkInt(parseInt(alphaInput.value), 0, 255, 255))}}),
	      colourInput = input({"type": "color", "value": colour.toHexString(), "onchange": updatePreview}),
	      alphaInput = input({"type": "range", "min": 0, "max": 255, "step": 1,"value": colour.a, "oninput": updatePreview}),
	      w = windows({"window-icon": icon, "window-title": title, "onremove": () => {
		dragColour.deregister(dragKey);
		reject();
	      }}, [
		h1(title),
		div({"class": checkboard}, preview),
		labels([lang["COLOUR"], ": "], colourInput),
		br(),
		labels([lang["COLOUR_ALPHA"], ": "], alphaInput),
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
	return (w: WindowElement | null, title: string | Binding, getColour: () => Colour, setColour: (c: Colour) => void, icon?: string | Binding) => {
		let active = false;
		const dragKey = dragColour.register(getColour),
		      d = div({"draggable": "true", "ondragstart": (e: DragEvent) => dragColour.set(e, dragKey, iconImg)}),
		      b = button({"class": [checkboard, colourButton], "onclick": () => {
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
      dragCheck = setDragEffect({"copy": [dragColour]}),
      [checkboard, colourButton] = ids(2);

add({
	[`.${checkboard}`]: {
		"background-color": "#ccc",
		"background-image": `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20"%3E%3Cpath d="M0,0H10V20H20V10H0Z" fill="gray" /%3E%3C/svg%3E')`,
		"width": "200px",
		"height": "200px",
		" div": {
			"width": "200px",
			"height": "200px"
		}
	},
	[`.${colourButton}`]: {
		"display": "inline-block",
		"width": "50px",
		"height": "50px",
		"padding": 0,
		" div": {
			"width": "100%",
			"height": "100%"
		}
	}
});
