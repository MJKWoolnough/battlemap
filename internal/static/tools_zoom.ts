import {br, div, input, label} from './lib/html.js';
import defaultTool, {zoom} from './tools_default.js';

const doZoom = function(this: SVGElement, e: MouseEvent) {
	zoom(this, zoomMode, e.clientX, e.clientY);
},
zoomOver = function(this: SVGElement, e: MouseEvent) {
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
	console.log(e.key);
	if (e.key === "Shift") {
		console.log(1);
		if (zoomMode === 1) {
			zoomIn.click();
		} else {
			zoomOut.click();
		}
	}
}

document.body.addEventListener("keydown", zoomShift);
document.body.addEventListener("keyup", zoomShift);

let zoomMode = -1;

export default Object.freeze({
	"name": "Zoom",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAEoAAABLAQMAAADtQoOXAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAAMBJREFUeAHN0YFGBEEcBvDfbIs9LlYC4FZCgOsJmnToMXqUkRCgR1p6kXuSFXZ9OAJQf4wfw5j/9yHD0xLOZd7UMW7cH5b9xuO5fG984dhWfjBUUAb6CXRHrkbQv1E+V1asHBpOYAf34CaHDka5213yJHyFvv0p87PfmIWy5sXyiSRBJb4vEqpE/SAFnFLL47uUVVLhtZZiWwXOZa7TysNiGm1jHMKhD/su7EpYtLjVsE7h/3t4jlsLnyN3kdvI4Af7VSj1YtdmoAAAAABJRU5ErkJggg==",
	"reset": () => {},
	"options": div([
		label({"for": "zoomIn"}, "Zoom In: "),
		zoomIn,
		br(),
		label({"for": "zoomOut"}, "Zoom Out: "),
		zoomOut
	]),
	"mapMouseDown": doZoom,
	"mapMouseOver": zoomOver,
	"mapMouseWheel": defaultTool.mapMouseWheel
});
