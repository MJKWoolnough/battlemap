import {br, div, input, label} from './lib/html.js';
import {circle, line, svg} from './lib/svg.js';
import {defaultMouseWheel, zoom} from './tools_default.js';
import {addTool} from './tools.js';
import lang from './language.js';

const zoomOver = function(this: SVGElement, e: MouseEvent) {
	document.body.classList.add("zoomOver");
	this.addEventListener("mouseout", () => document.body.classList.remove("zoomOver"), {"once": true});
},
zoomIn = input({"id": "zoomIn", "type": "radio", "name": "zoomInOut", "checked": "checked", "onclick": () => {
	zoomMode = -1;
	document.body.classList.remove("zoomOut");
}}),
zoomOut = input({"id": "zoomOut", "type": "radio", "name": "zoomInOut", "onclick": () => {
	zoomMode = 1;
	document.body.classList.add("zoomOut");
}}),
zoomShift = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		if (zoomMode === 1) {
			zoomIn.click();
		} else {
			zoomOut.click();
		}
	}
}

document.body.addEventListener("keydown", zoomShift);
document.body.addEventListener("keyup", zoomShift);

let zoomMode: 1 | -1 = -1;

addTool({
	"name": lang["TOOL_ZOOM"],
	"icon": svg({"viewBox": "0 0 32 32", "style": "stroke: currentColor"}, [
		circle({"cx": 11.5, "cy": 11.5, "r": 10, "stroke-width": 3, "fill": "none"}),
		line({"x1": 18, "y1": 18, "x2": 30, "y2": 30, "stroke-width": 4})
	]),
	"options": div([
		label({"for": "zoomIn"}, `${lang["TOOL_ZOOM_IN"]}: `),
		zoomIn,
		br(),
		label({"for": "zoomOut"}, `${lang["TOOL_ZOOM_OUT"]}: `),
		zoomOut,
	]),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		if (e.button !== 0) {
			return;
		}
		zoom(this, zoomMode * 0.5, e.clientX, e.clientY);
		e.stopPropagation();
	},
	"mapMouseOver": zoomOver,
	"mapMouseWheel": defaultMouseWheel
});
