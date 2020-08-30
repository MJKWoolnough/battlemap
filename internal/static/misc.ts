import {Colour, Int, MapData, Uint, LayerRPC} from './types.js';
import {br, button, div, h1, input, label} from './lib/html.js';
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
hex2Colour = (hex: string): Colour => ({"r": parseInt(hex.slice(1, 3), 16), "g": parseInt(hex.slice(3, 5), 16), "b": parseInt(hex.slice(5, 7), 16), "a": 255}),
colour2Hex = (c: Colour) => `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`,
colour2RGBA = (c: Colour) => `rgba(${c.r.toString()}, ${c.g.toString()}, ${c.b.toString()}, ${(c.a / 255).toString()})`,
noColour = Object.freeze({"r": 0, "g": 0, "b": 0, "a": 0}),
colourPicker = (parent: WindowElement | ShellElement, title: string, colour: Colour = noColour) => new Promise<Colour>((resolve, reject) => {
	const checkboard = div({"class": "checkboard"}),
	      preview = checkboard.appendChild(div({"style": `background-color: ${colour2RGBA(colour)}`})),
	      updatePreview = () => {
		const colour = hex2Colour(colourInput.value);
		colour.a = parseInt(alphaInput.value);
		preview.style.setProperty("background-color", colour2RGBA(colour));
	      },
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
			const colour = hex2Colour(colourInput.value);
			colour.a = parseInt(alphaInput.value);
			window.remove();
			resolve(colour);
		}})
	      ]);
	parent.addWindow(window);
}),
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
{request: requestShell, responder: respondWithShell} = new Requester<ShellElement>();
