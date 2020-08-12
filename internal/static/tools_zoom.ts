import {br, div, input, label} from './lib/html.js';
import {createSVG, rect} from './lib/svg.js';
import defaultTool, {panZoom, zoom} from './tools_default.js';
import {requestMapData, requestSVGRoot} from './comms.js';

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
drawZoom = input({"id": "drawZoom", "type": "checkbox"}),
zoomShiftCtrl = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		if (zoomMode === 1) {
			zoomIn.click();
		} else {
			zoomOut.click();
		}
	} else if (e.key === "Control") {
		drawZoom.click();
	}
}

document.body.addEventListener("keydown", zoomShiftCtrl);
document.body.addEventListener("keyup", zoomShiftCtrl);

let zoomMode: 1 | -1 = -1;

export default Object.freeze({
	"name": "Zoom",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAEoAAABLAQMAAADtQoOXAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAAMBJREFUeAHN0YFGBEEcBvDfbIs9LlYC4FZCgOsJmnToMXqUkRCgR1p6kXuSFXZ9OAJQf4wfw5j/9yHD0xLOZd7UMW7cH5b9xuO5fG984dhWfjBUUAb6CXRHrkbQv1E+V1asHBpOYAf34CaHDka5213yJHyFvv0p87PfmIWy5sXyiSRBJb4vEqpE/SAFnFLL47uUVVLhtZZiWwXOZa7TysNiGm1jHMKhD/su7EpYtLjVsE7h/3t4jlsLnyN3kdvI4Af7VSj1YtdmoAAAAABJRU5ErkJggg==",
	"reset": () => {},
	"options": div([
		label({"for": "zoomIn"}, "Zoom In: "),
		zoomIn,
		br(),
		label({"for": "zoomOut"}, "Zoom Out: "),
		zoomOut,
		br(),
		label({"for": "drawZoom"}, "Draw Zoom: "),
		drawZoom
	]),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		if (e.button !== 0) {
			return;
		}
		if (drawZoom.checked) {
			const {width, height} = requestMapData(),
			      x = Math.round((e.clientX + ((panZoom.zoom - 1) * width / 2) - panZoom.x) / panZoom.zoom),
			      y = Math.round((e.clientY + ((panZoom.zoom - 1) * height / 2) - panZoom.y) / panZoom.zoom),
			      root = requestSVGRoot(),
			      square = root.appendChild(rect({x, y, "width": 1, "height": 1, "stroke-width": 2, "stroke": "#f00", "fill": "transparent"})),
			      onmousemove = (e: MouseEvent) => {
				const nx = Math.round((e.clientX + ((panZoom.zoom - 1) * width / 2) - panZoom.x) / panZoom.zoom),
				      ny = Math.round((e.clientY + ((panZoom.zoom - 1) * height / 2) - panZoom.y) / panZoom.zoom);
				createSVG(square, {"x": Math.min(x, nx).toString(), "width": Math.abs(x - nx).toString(), "y": Math.min(y, ny).toString(), "height": Math.abs(y - ny).toString()});
			      },
			      onmouseup = (e: MouseEvent) => {
				if (e.button !== 0) {
					return;
				}
				root.removeEventListener("mousemove", onmousemove);
				root.removeEventListener("mouseup", onmouseup);
				square.remove();
			      };
			createSVG(root, {onmousemove, onmouseup});
		} else {
			zoom(this, zoomMode * 0.5, e.clientX, e.clientY);
		}
		e.stopPropagation();
	},
	"mapMouseOver": zoomOver,
	"mapMouseWheel": defaultTool.mapMouseWheel
});
