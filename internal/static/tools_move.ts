import {amendNode} from './lib/dom.js';
import {keyEvent, mouseDragEvent} from './lib/events.js';
import {node} from './lib/nodes.js';
import {g, line, path, svg, title} from './lib/svg.js';
import lang from './language.js';
import {root, screen2Grid} from './map.js';
import {doLayerShift} from './map_fns.js';
import {deselectToken, selected} from './map_tokens.js';
import {inited, isAdmin} from './rpc.js';
import {autosnap, measureTokenMove} from './settings.js';
import {addTool, disable, ignore} from './tools.js';
import {measureDistance, startMeasurement, stopMeasurement} from './tools_measure.js';

inited.then(() => {
	if (!isAdmin) {
		return;
	}
	let dx = 0,
	    dy = 0,
	    snap = false,
	    ox = 0,
	    oy = 0,
	    measure = false;

	const [setupMover, cancelMover] = mouseDragEvent(0, (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap !== e.shiftKey);
		dx = x - ox;
		dy = y - oy;
		amendNode(selected.layer![node], {"transform": `translate(${dx}, ${dy})`});
		if (measure) {
			measureDistance(x, y);
		}
	      }, () => {
		stop();
		doLayerShift(selected.layer!.path, dx, dy);
	      }),
	      stop = () => {
		cancelMover(false);
		cancelEscape();
		amendNode(selected.layer?.[node], {"transform": undefined});
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
				line({"x1": 6, "y1": 11, "x2": 16, "y2": 11})
			]),
			path({"d": "M11,0 L6,5 L16,5 Z M0,11 L5,6 L 5,16 Z M11,22 L6,17 L16,17 Z M22,11 L17,16 L17,6 Z"})
		]),
		"mapMouse0": function(this: SVGElement, e: MouseEvent) {
			const {layer} = selected;
			if (layer) {
				dx = 0;
				dy = 0;
				snap = layer.tokens.some(t => t.snap);
				[ox, oy] = screen2Grid(e.clientX, e.clientY, autosnap.value);
				setupEscape();
				if (measure = measureTokenMove.value) {
					startMeasurement(ox, oy);
				}
				deselectToken();
				setupMover();
			}
			return false;
		},
		"mapMouse2": ignore,
		"mapMouseOver": ignore,
		"tokenMouseOver": ignore,
		"tokenMouse0": ignore,
		"tokenMouse2": disable,
		"set": () => amendNode(root, {"style": {"cursor": "move"}}),
		"unset": () => {
			amendNode(root, {"style": {"cursor": undefined}});
			stop();
		}
	});
});
