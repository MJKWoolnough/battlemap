import {br, div, input, label} from './lib/html.js';
import {createSVG, rect, circle, line, svg} from './lib/svg.js';
import defaultTool, {panZoom, zoom} from './tools_default.js';
import {requestMapData, requestSVGRoot} from './comms.js';
import {screen2Grid} from './misc.js';

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
	"icon": svg({"viewBox": "0 0 32 32", "style": "stroke: currentColor"}, [
		circle({"cx": 11.5, "cy": 11.5, "r": 10, "stroke-width": 3, "fill": "none"}),
		line({"x1": 18, "y1": 18, "x2": 30, "y2": 30, "stroke-width": 4})
	]),
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
			const [x, y] = screen2Grid(e.clientX, e.clientY, false, requestMapData()),
			      root = requestSVGRoot(),
			      square = root.appendChild(rect({x, y, "width": 1, "height": 1, "stroke-width": 2, "stroke": "#f00", "fill": "transparent"})),
			      onmousemove = (e: MouseEvent) => {
				const [nx, ny] = screen2Grid(e.clientX, e.clientY, false, requestMapData());
				createSVG(square, {"x": Math.min(x, nx).toString(), "width": Math.abs(x - nx).toString(), "y": Math.min(y, ny).toString(), "height": Math.abs(y - ny).toString()});
			      },
			      onmouseup = (e: MouseEvent) => {
				if (e.button !== 0) {
					return;
				}
				root.removeEventListener("mousemove", onmousemove);
				root.removeEventListener("mouseup", onmouseup);
				square.remove();
				// TODO: Needs rewriting, need in + out
				const [nx, ny] = screen2Grid(e.clientX, e.clientY, false, requestMapData());
				zoom(this, 2-Math.max(Math.abs(nx - x) / window.innerWidth, Math.abs(ny - y) / window.innerHeight), (x + nx) / 2, (y + ny) / 2);
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
