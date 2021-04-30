import {svg, g, line, path, title} from './lib/svg.js';
import {deselectToken, globals} from './shared.js';
import {doLayerShift} from './map_fns.js';
import {defaultMouseWheel, panZoom, screen2Grid} from './tools_default.js';
import {addTool} from './tools.js';
import {startMeasurement, measureDistance, stopMeasurement} from './tools_measure.js';
import {measureTokenMove} from './settings.js';
import lang from './language.js';

const startDrag = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	e.stopPropagation();
	const ox = e.clientX, oy = e.clientY;
	let dx = 0, dy = 0;
	const {selected: {layer: selectedLayer}} = globals;
	if (!selectedLayer) {
		return;
	}
	const snap = selectedLayer.tokens.some(t => t.snap),
	      measure = measureTokenMove.value,
	      sq = snap ? globals.mapData.gridSize : 1,
	      mover = (e: MouseEvent) => {
		dx = (e.clientX - ox) / panZoom.zoom;
		dy = (e.clientY - oy) / panZoom.zoom;
		if (snap) {
			dx = Math.round(dx / sq) * sq;
			dy = Math.round(dy / sq) * sq;
		}
		selectedLayer.node.setAttribute("transform", `translate(${dx}, ${dy})`);
		if (measure) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap);
			measureDistance(x, y);
		}
	      },
	      mouseUp = (e: MouseEvent) => {
		if (e.button !== 0) {
			return;
		}
		this.removeEventListener("mousemove", mover);
		this.removeEventListener("mouseup", mouseUp);
		document.body.removeEventListener("keydown", cancel)
		selectedLayer.node.removeAttribute("transform");
		doLayerShift(selectedLayer.path, dx, dy);
		if (measure) {
			stopMeasurement();
		}
	      },
	      cancel = (e: KeyboardEvent) => {
		if (e.key !== "Escape") {
			return;
		}
		if (measure) {
			stopMeasurement();
		}
		this.removeEventListener("mousemove", mover);
		this.removeEventListener("mouseup", mouseUp);
		document.body.removeEventListener("keydown", cancel)
		selectedLayer.node.removeAttribute("transform");
	      };
	if (measure) {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap);
		startMeasurement(x, y);
	}
	deselectToken();
	this.addEventListener("mousemove", mover);
	this.addEventListener("mouseup", mouseUp);
	document.body.addEventListener("keydown", cancel);
      },
      mouseCursor = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	this.style.setProperty("cursor", "move");
	this.addEventListener("mouseout", () => this.style.removeProperty("cursor"), {"once": true});
      };

addTool({
	"name": lang["TOOL_MOVE"],
	"icon": svg({"viewBox": "0 0 22 22", "style": "fill: currentColor"}, [
		title(lang["TOOL_MOVE"]),
		g({"stroke-width": 1, "style": "stroke: currentColor", "stroke-linecap": "round"}, [
			line({"x1": 11, "y1": 6, "x2": 11, "y2": 16}),
			line({"x1": 6, "y1": 11, "x2": 16, "y2": 11}),
		]),
		path({"d": "M11,0 L6,5 L16,5 Z M0,11 L5,6 L 5,16 Z M11,22 L6,17 L16,17 Z M22,11 L17,16 L17,6 Z"})
	]),
	"mapMouseOver": mouseCursor,
	"tokenMouseOver": mouseCursor,
	"mapMouseDown": startDrag,
	"tokenMouseDown": startDrag,
	"mapMouseWheel": defaultMouseWheel
});
