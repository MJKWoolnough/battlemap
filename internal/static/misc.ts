import {Colour, Int, MapData, Uint, LayerRPC} from './types.js';
import {createHTML, br, button, div, h1, input, label} from './lib/html.js';
import {ShellElement, WindowElement, windows} from './windows.js';
import {globals} from './map.js';
import {panZoom} from './tools_default.js';
import {Pipe, Requester} from './lib/inter.js';

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
		label({"for": "colourPick"}, "Colour: "),
		colourInput,
		br(),
		label({"for": "alphaPick"}, "Alpha: "),
		alphaInput,
		br(),
		button("Update", {"onclick": function(this: HTMLButtonElement) {
			this.setAttribute("disabled", "disabled");
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
screen2Grid = (x: Uint, y: Uint, snap: boolean): [Int, Int] => {
	const {mapData} = globals,
	      snapDM = snap ? mapData.gridSize : 1;
	return [snapDM * Math.round((x + ((panZoom.zoom - 1) * mapData.width / 2) - panZoom.x) / panZoom.zoom / snapDM), snapDM * Math.round((y + ((panZoom.zoom - 1) * mapData.height / 2) - panZoom.y) / panZoom.zoom / snapDM)];
},
{send: mapLoadSend, receive: mapLoadReceive} = new Pipe<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = new Pipe<LayerRPC>(),
{request: requestShell, responder: respondWithShell} = new Requester<ShellElement>(),
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
};
