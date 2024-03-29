import type {Uint} from './types.js';
import {amendNode, clearNode, event, eventOnce} from './lib/dom.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {br, div, input} from './lib/html.js';
import {checkInt, isInt} from './lib/misc.js';
import {circle, g, path, polyline, svg, title} from './lib/svg.js';
import {settingsTicker} from './ids.js';
import lang from './language.js';
import {mapData, panZoom, root, screen2Grid} from './map.js';
import {inited, isAdmin, rpc} from './rpc.js';
import {autosnap} from './settings.js';
import {labels, mapLoadedReceive} from './shared.js';
import {addTool, ignore, marker} from './tools.js';

const grid2Screen = (x: Uint, y: Uint): [number, number] => {
	const {width, height} = mapData;
	return [panZoom.zoom * x - (panZoom.zoom - 1) * width / 2 + panZoom.x, panZoom.zoom * y - (panZoom.zoom - 1) * height / 2 + panZoom.y];
      },
      info = div({"style": "border: 1px solid #000; padding: 5px; background-color: #fff; color: #000; position: absolute; pointer-events: none"}),
      spot = circle({"r": 8, "fill": "#000", "stroke": "#fff", "stroke-width": 2}),
      lone = polyline({"stroke": "#fff", "stroke-width": 8, "stroke-linecap": "square", "stroke-linejoin": "round", "fill": "none"}),
      ltwo = polyline({"stroke": "#000", "stroke-width": 6, "stroke-linejoin": "round", "fill": "none"}),
      drawnLine = g([lone, ltwo, spot]),
      cellValue = input({"type": "number", "value": 1, "min": 0, "onchange": () => {
	const v = parseInt(cellValue.value);
	if (isInt(v, 0)) {
		rpc.setGridDistance(v);
	}
      }}),
      diagonals = input({"type": "checkbox", "checked": true, "class": settingsTicker, "onchange": () => rpc.setGridDiagonal(diagonals.checked)}),
      coords: [number, number, ...number[]] = [NaN, NaN];

export const startMeasurement = (x1: Uint, y1: Uint) => {
	coords.splice(0, coords.length, x1, y1);
	const l = {"points": `${x1},${y1} ${x1},${y1}`},
	      [sx, sy] = grid2Screen(x1, y1);
	amendNode(lone, l);
	amendNode(ltwo, l);
	amendNode(spot, {"cx": coords[0], "cy": coords[1]});
	if (!drawnLine.parentNode) {
		if (marker.parentNode) {
			root.insertBefore(drawnLine, marker);
		} else {
			amendNode(root, drawnLine);
		}
	}
	amendNode(info, {"style": {"left": `${sx + 5}px`, "top": `${sy + 5}px`}});
	if (!info.parentNode) {
		amendNode(document.body, info);
	}
},
measureDistance = (x: Uint, y: Uint) => {
	if (isNaN(coords[0]) || isNaN(coords[1])) {
		return;
	}
	let distance = 0;
	const {gridSize} = mapData,
	      last = [0, 0],
	      cv = checkInt(parseInt(cellValue.value), 1, Infinity, gridSize),
	      l = {"points": coords.reduce((res, _, i) => {
		if (i % 2 === 0) {
			const x = coords[i],
			      y = coords[i+1];
			res += ` ${x},${y}`;
			if (i >= 2) {
				const dx = x - last[0],
				      dy = y - last[1];
				distance += cv * (diagonals.checked ? Math.hypot(dx, dy) : Math.max(Math.abs(dx), Math.abs(dy)));
			}
			last[0] = x;
			last[1] = y;
		}
		return res;
	      }, "") + ` ${x},${y}`},
	      [sx, sy] = grid2Screen(x, y),
	      dx = x - last[0],
	      dy = y - last[1];
	distance += cv * (diagonals.checked ? Math.hypot(dx, dy) : Math.max(Math.abs(dx), Math.abs(dy)));
	clearNode(info, {"style": {"left": `${sx + 5}px`, "top": `${sy + 5}px`}}, Math.round(distance / gridSize) + "");
	amendNode(lone, l);
	amendNode(ltwo, l);
},
stopMeasurement = () => {
	drawnLine.remove();
	info.remove();
	coords.splice(0, coords.length, NaN, NaN);
};

inited.then(() => {
	mapLoadedReceive(() => {
		cellValue.value = mapData.gridDistance + "";
		diagonals.checked = mapData.gridDiagonal;
	});

	if (!isAdmin) {
		rpc.waitSignalMeasure().when(data => {
			if (!data) {
				stopMeasurement();
				return;
			}
			const [x1, y1, ...additional] = data,
			      yn = additional.pop()!,
			      xn = additional.pop()!;
			startMeasurement(x1, y1);
			coords.push(...additional);
			measureDistance(xn, yn);
		});
		return;
	}
	let send = false;
	const snap = input({"type": "checkbox", "class": settingsTicker}),
	      multiPoint = input({"type": "checkbox", "checked": false, "class": settingsTicker}),
	      shiftSnap = () => snap.click(),
	      [setupMouse0, cancelMouse0] = mouseDragEvent(0, undefined, (e: MouseEvent) => {
		if (!e.ctrlKey) {
			stopMeasurement();
			cancelMouse2();
		}
	      }),
	      [setupMouse2, cancelMouse2] = mouseDragEvent(2, undefined, () => {
		if (send) {
			rpc.signalMeasure(null);
			send = false;
		}
	      }),
	      [startMouseMove, cancelMouseMove] = mouseMoveEvent((e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		amendNode(marker, {"transform": `translate(${x - 10 / panZoom.zoom}, ${y - 10 / panZoom.zoom}) scale(${1/panZoom.zoom})`});
		if (!isNaN(coords[0])) {
			measureDistance(x, y);
			if (send) {
				rpc.signalMeasure([...(coords as [Uint, Uint]), x, y]);
			}
		}
	      }),
	      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
	      [setupEscape, cancelEscape] = keyEvent("Escape", () => {
		if (coords.length === 2) {
			stopMeasurement();
			cancelMouse2();
		} else {
			const y = coords.pop()!,
			      x = coords.pop()!;
			measureDistance(x, y);
			if (send) {
				rpc.signalMeasure([...(coords as [Uint, Uint]), x, y]);
			}
		}
	      });

	addTool({
		"name": lang["TOOL_MEASURE"],
		"id": "tool_measure",
		"icon": svg({"viewBox": "0 0 50 50"}, [title(lang["TOOL_MEASURE"]), path({"d": "M0,40 l10,10 l40,-40 l-10,-10 z m5,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5", "style": "stroke: currentColor", "stroke-linejoin": "round", "fill": "none"})]),
		"options": div([
			labels(snap, [lang["TOOL_MEASURE_SNAP"], ": "]),
			br(),
			labels(diagonals, [lang["TOOL_MEASURE_DIAGONALS"], ": "]),
			br(),
			labels(multiPoint, [lang["TOOL_MEASURE_MULTI"], ": "]),
			br(),
			labels([lang["TOOL_MEASURE_CELL"], ": "], cellValue)
		]),
		"mapMouseOver": () => {
			startMouseMove();
			return false;
		},
		"tokenMouseOver": function(this: SVGElement) {
			amendNode(root, {"style": {"--outline-cursor": "none"}});
			amendNode(this, {"onmouseout": event(() => amendNode(root, {"style": {"--outline-cursor": undefined}}), eventOnce)});
			return false;
		},
		"tokenMouse0": ignore,
		"tokenMouse2": ignore,
		"mapMouse0": (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			if (isNaN(coords[0])) {
				startMeasurement(x, y);
			} else {
				coords.push(x, y);
			}
			if (!e.ctrlKey && !multiPoint.checked) {
				setupMouse0();
			}
			return false;
		},
		"mapMouse2": (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			rpc.signalMeasure([...(coords as [Uint, Uint]), x, y]);
			send = true;
			setupMouse2();
			return false;
		},
		"set": () => {
			amendNode(root, {"style": {"cursor": "none"}}, marker);
			amendNode(snap, {"checked": autosnap.value});
			setupShiftSnap();
			setupEscape();
		},
		"unset": () => {
			amendNode(root, {"style": {"cursor": undefined}});
			marker.remove();
			cancelMouse0();
			cancelMouse2();
			cancelMouseMove();
			cancelShiftSnap();
			cancelEscape();
			stopMeasurement();
		}
	});

	rpc.waitGridDistanceChange().when(distance => cellValue.value = distance + "");
	rpc.waitGridDiagonalChange().when(diagonal => diagonals.checked = diagonal);
});
