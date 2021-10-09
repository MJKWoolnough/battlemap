import {svg, g, line, path, title} from './lib/svg.js';
import {node} from './lib/nodes.js';
import {deselectToken, globals} from './shared.js';
import {doLayerShift} from './map_fns.js';
import {panZoom, screen2Grid} from './map.js';
import {addTool, disable, ignore} from './tools.js';
import {startMeasurement, measureDistance, stopMeasurement} from './tools_measure.js';
import {autosnap, measureTokenMove} from './settings.js';
import lang from './language.js';

const startDrag = function(this: SVGElement, e: MouseEvent) {
	const {selected: {layer: selectedLayer}} = globals;
	if (selectedLayer) {
		let dx = 0, dy = 0;
		const snap = selectedLayer.tokens.some(t => t.snap),
		      [ox, oy] = screen2Grid(e.clientX, e.clientY, autosnap.value),
		      measure = measureTokenMove.value,
		      mover = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap);
			dx = (x - ox) / panZoom.zoom;
			dy = (y - oy) / panZoom.zoom;
			selectedLayer[node].setAttribute("transform", `translate(${dx}, ${dy})`);
			if (measure) {
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
			selectedLayer[node].removeAttribute("transform");
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
			selectedLayer[node].removeAttribute("transform");
		      };
		if (measure) {
			startMeasurement(ox, oy);
		}
		deselectToken();
		this.addEventListener("mousemove", mover);
		this.addEventListener("mouseup", mouseUp);
		document.body.addEventListener("keydown", cancel);
	}
	return false;
      },
      mouseCursor = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	this.style.setProperty("cursor", "move");
	this.addEventListener("mouseout", () => this.style.removeProperty("cursor"), {"once": true});
	return false;
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
	"tokenMouseOver": mouseCursor,
	"tokenMouse0": startDrag,
	"tokenMouse2": disable,
	"mapMouse0": startDrag,
	"mapMouse2": ignore,
	"mapMouseOver": mouseCursor
});
