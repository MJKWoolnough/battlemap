import {svg, g, line, path, title} from './lib/svg.js';
import {node} from './lib/nodes.js';
import {deselectToken, globals} from './shared.js';
import {doLayerShift} from './map_fns.js';
import {panZoom, screen2Grid} from './map.js';
import {addTool, disable, ignore} from './tools.js';
import {startMeasurement, measureDistance, stopMeasurement} from './tools_measure.js';
import {autosnap, measureTokenMove} from './settings.js';
import {keyEvent, mouseDragEvent} from './events.js';
import lang from './language.js';


let dx = 0, dy = 0,
    snap = false,
    ox = 0,
    oy = 0,
    measure = false;

const [setupMover, cancelMover] = mouseDragEvent(0, (e: MouseEvent) => {
	const {selected: {layer: selectedLayer}} = globals;
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap);
	dx = (x - ox) / panZoom.zoom;
	dy = (y - oy) / panZoom.zoom;
	selectedLayer![node].setAttribute("transform", `translate(${dx}, ${dy})`);
	if (measure) {
		measureDistance(x, y);
	}
      }, () => {
	const {selected: {layer: selectedLayer}} = globals;
	stop();
	doLayerShift(selectedLayer!.path, dx, dy);
      }),
      stop = () => {
	const {selected: {layer: selectedLayer}} = globals;
	cancelMover();
	cancelEscape();
	selectedLayer![node].removeAttribute("transform");
	if (measure) {
		stopMeasurement();
	}
      },
      [setupEscape, cancelEscape] = keyEvent("Escape", stop);

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
	"mapMouse0": function(this: SVGElement, e: MouseEvent) {
		const {selected: {layer: selectedLayer}} = globals;
		if (selectedLayer) {
			dx = 0;
			dy = 0;
			snap = selectedLayer.tokens.some(t => t.snap);
			[ox, oy] = screen2Grid(e.clientX, e.clientY, autosnap.value);
			measure = measureTokenMove.value;
			setupEscape();
			if (measure) {
				startMeasurement(ox, oy);
			}
			deselectToken();
			setupMover();
		}
		return false;
	},
	"mapMouse2": ignore,
	"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
		e.preventDefault();
		this.style.setProperty("cursor", "move");
		this.addEventListener("mouseout", () => this.style.removeProperty("cursor"), {"once": true});
		return false;
	},
	"tokenMouseOver": ignore,
	"tokenMouse0": ignore,
	"tokenMouse2": disable,
	"unset": stop
});
