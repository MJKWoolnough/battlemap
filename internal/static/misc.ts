import {Colour, Int, Uint, LayerRPC} from './types.js';
import {br, button, div, h1, input, label} from './lib/html.js';
import {ShellElement, WindowElement, windows} from './windows.js';
import {globals} from './map.js';
import {panZoom} from './tools_default.js';
import {Pipe, Requester} from './lib/inter.js';
import lang from './language.js';

const pipeBind = <T>() => {
	const p = new Pipe<T>();
	return {"send": p.send.bind(p), "receive": p.receive.bind(p)};
      },
      requesterBind = <T>() => {
	const r = new Requester<T>();
	return {"request": r.request.bind(r), "responder": r.responder.bind(r)};
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
hex2Colour = (hex: string, a = 255): Colour => Object.freeze({"r": parseInt(hex.slice(1, 3), 16), "g": parseInt(hex.slice(3, 5), 16), "b": parseInt(hex.slice(5, 7), 16), a}),
colour2Hex = (c: Colour) => `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`,
rgba2Colour = (rgba: string): Colour => {
	if (rgba === "transparent" || rgba === "") {
		return {"r": 0, "g": 0, "b": 0, "a": 0};
	}
	const colours = rgba.slice(5, -1).replace(/ /g, "").split(",");
	return {"r": parseInt(colours[0]), "g": parseInt(colours[1]), "b": parseInt(colours[2]), "a": (parseFloat(colours[3]) * 255)|0};
},
colour2RGBA = (c: Colour) => `rgba(${c.r.toString()}, ${c.g.toString()}, ${c.b.toString()}, ${(c.a / 255).toString()})`,
noColour = Object.freeze({"r": 0, "g": 0, "b": 0, "a": 0}),
colourPicker = (parent: WindowElement | ShellElement, title: string, colour: Colour = noColour) => new Promise<Colour>((resolve, reject) => {
	const checkboard = div({"class": "checkboard"}),
	      preview = checkboard.appendChild(div({"style": `background-color: ${colour2RGBA(colour)}`})),
	      updatePreview = () => preview.style.setProperty("background-color", colour2RGBA(hex2Colour(colourInput.value, parseInt(alphaInput.value)))),
	      colourInput = input({"id": "colourPick", "type": "color", "value": colour2Hex(colour), "onchange": updatePreview}),
	      alphaInput = input({"id": "alphaPick", "type": "range", "min": "0", "max": "255", "step": "1","value": colour.a, "oninput": updatePreview}),
	      window = windows({"window-title": title, "class": "lightChange", "onexit": reject}, [
		h1(title),
		checkboard,
		label({"for": "colourPick"}, `${lang["COLOUR"]}: `),
		colourInput,
		br(),
		label({"for": "alphaPick"}, `${lang["COLOUR_ALPHA"]}: `),
		alphaInput,
		br(),
		button(lang["COLOUR_UPDATE"], {"onclick": function(this: HTMLButtonElement) {
			this.toggleAttribute("disabled", true);
			const colour = hex2Colour(colourInput.value, parseInt(alphaInput.value));
			window.remove();
			resolve(colour);
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
	return (w: WindowElement | null, title: string, getColour: () => Colour, setColour: (c: Colour) => void, id = "") => {
		const b = button({"style": "width: 50px; height: 50px", id, "onclick": () => colourPicker(w ?? requestShell(), title, getColour()).then(c => setColour(sc(b, c)))});
		sc(b, getColour());
		return b;
	};
})(),
handleError = (e: Error | string) => {
	console.log(e);
	requestShell().alert("Error", e instanceof Error ? e.message : typeof e  === "object" ? JSON.stringify(e) : e);
},
screen2Grid = (x: Uint, y: Uint, snap = false): [Int, Int] => {
	const {mapData} = globals,
	      sx = (x + ((panZoom.zoom - 1) * mapData.width / 2) - panZoom.x) / panZoom.zoom,
	      sy = (y + ((panZoom.zoom - 1) * mapData.height / 2) - panZoom.y) / panZoom.zoom;
	if (snap) {
		const size = mapData.gridSize >> 1;
		return [size * Math.round(sx / size), size * Math.round(sy / size)];
	}
	return [Math.round(sx), Math.round(sy)];
},
{send: mapLoadSend, receive: mapLoadReceive} = pipeBind<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = pipeBind<LayerRPC>(),
{send: mapLoadedSend, receive: mapLoadedReceive} = pipeBind<boolean>(),
{send: tokenSelected, receive: tokenSelectedReceive} = pipeBind<void>(),
{request: requestShell, responder: respondWithShell} = requesterBind<ShellElement>(),
point2Line = (px: Int, py: Int, x1: Int, y1: Int, x2: Int, y2: Int) => {
	if (x1 === x2) {
		if (py >= y1 && py <= y2) {
			return Math.abs(px - x1);
		}
		return Math.hypot(px - x1, Math.min(Math.abs(py - y1), Math.abs(py - y2)));
	} else if (y1 === y2) {
		if (px >= x1 && px <= x2) {
			return Math.abs(py - y1);
		}
		return Math.hypot(Math.min(Math.abs(px - x1), Math.abs(px - x2)), py - y1);
	}
	const m = (y2 - y1) / (x2 - x1),
	      n = (x1 - x2) / (y2 - y1),
	      c = y1 - m * x1,
	      d = py - px * n;
	let cx = (d - c) / (m - n);
	if (cx < x1) {
		cx = x1;
	} else if (cx > x2) {
		cx = x2;
	}
	return Math.hypot(px - cx, py - m * cx - c);
},
isInt = (v: any, min = -Infinity, max = Infinity): v is Int => typeof v === "number" && (v|0) === v && v >= min && v <= max,
isUint = (v: any, max = Infinity): v is Uint => isInt(v, 0, max),
isColour = (v: any): v is Colour => v instanceof Object && isUint(v.r, 255) && isUint(v.g, 255) && isUint(v.b, 255) && isUint(v.a, 255),
queue = (() => {
	let p = Promise.resolve();
	return (fn: () => Promise<any>) => p = p.finally(fn);
})(),
SQRT3 = Math.sqrt(3);
