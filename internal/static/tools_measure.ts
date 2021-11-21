import type {Uint} from './types.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {createHTML, br, div, input} from './lib/html.js';
import {createSVG, circle, g, path, polyline, svg, title} from './lib/svg.js';
import lang from './language.js';
import {mapData, panZoom, root, screen2Grid} from './map.js';
import {inited, isAdmin, rpc} from './rpc.js';
import {autosnap} from './settings.js';
import {checkInt, isUint, labels, mapLoadedReceive} from './shared.js';
import {addTool, ignore, marker} from './tools.js';

let send = false;

const grid2Screen = (x: Uint, y: Uint): [number, number] => {
	const {width, height} = mapData;
	return [panZoom.zoom * x - (panZoom.zoom - 1) * width / 2 + panZoom.x, panZoom.zoom * y - (panZoom.zoom - 1) * height / 2 + panZoom.y];
      },
      snap = input({"type": "checkbox", "class": "settings_ticker"}),
      cellValue = input({"type": "number", "value": 1, "min": 0, "onchange": () => {
	const v = parseInt(cellValue.value);
	if (isUint(v)) {
		rpc.setGridDistance(v);
	}
      }}),
      diagonals = input({"type": "checkbox", "checked": true, "class": "settings_ticker", "onchange": () => rpc.setGridDiagonal(diagonals.checked)}),
      multiPoint = input({"type": "checkbox", "checked": false, "class": "settings_ticker"}),
      shiftSnap = () => snap.click(),
      info = div({"style": "border: 1px solid #000; padding: 5px; background-color: #fff; color: #000; position: absolute"}),
      spot = circle({"r": 8, "fill": "#000", "stroke": "#fff", "stroke-width": 2}),
      lone = polyline({"stroke": "#fff", "stroke-width": 8, "stroke-linecap": "square", "stroke-linejoin": "round", "fill": "none"}),
      ltwo = polyline({"stroke": "#000", "stroke-width": 6, "stroke-linejoin": "round", "fill": "none"}),
      drawnLine = g([lone, ltwo, spot]),
      coords: [number, number, ...number[]] = [NaN, NaN],
      [setupMouse0, cancelMouse0] = mouseDragEvent(0, undefined, (e: MouseEvent) => {
	      if (!e.ctrlKey) {
		      stopMeasurement()
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
	createSVG(marker, {"transform": `translate(${x - 10 / panZoom.zoom}, ${y - 10 / panZoom.zoom}) scale(${1/panZoom.zoom})`});
	if (!isNaN(coords[0])) {
		measureDistance(x, y);
		if (send) {
			rpc.signalMeasure(coords.concat(x, y) as [Uint, Uint, Uint, Uint]);
		}
	}
      }),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      [setupEscape, cancelEscape] = keyEvent("Escape", () => {
	if (coords.length === 2) {
		stopMeasurement();
	} else {
		const y = coords.pop()!,
		      x = coords.pop()!;
		measureDistance(x, y);
	}
      });

export const startMeasurement = (x1: Uint, y1: Uint) => {
	coords.splice(0, coords.length, x1, y1);
	const l = {"points": `${x1},${y1} ${x1},${y1}`},
	      [sx, sy] = grid2Screen(x1, y1);
	createSVG(lone, l);
	createSVG(ltwo, l);
	createSVG(spot, {"cx": coords[0], "cy": coords[1]});
	if (!drawnLine.parentNode) {
		if (marker.parentNode) {
			root.insertBefore(drawnLine, marker);
		} else {
			createHTML(root, drawnLine);
		}
	}
	createHTML(info, {"style": {"left": (sx + 5) + "px", "top": (sy + 5) + "px"}});
	if (!info.parentNode) {
		createHTML(document.body, info);
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
			last[0] = coords[i];
			last[1] = coords[i+1];
		}
		return res
	      }, "") + ` ${x},${y}`},
	      [sx, sy] = grid2Screen(x, y),
	      dx = x - last[0],
	      dy = y - last[1];
	distance += cv * (diagonals.checked ? Math.hypot(dx, dy) : Math.max(Math.abs(dx), Math.abs(dy)));
	createHTML(info, {"style": {"left": `${sx + 5}px`, "top": `${sy + 5}px`}}, Math.round(distance / gridSize) + "");
	createSVG(lone, l);
	createSVG(ltwo, l);
},
stopMeasurement = () => {
	drawnLine.remove();
	info.remove();
	coords.splice(0, coords.length, NaN, NaN);
};

addTool({
	"name": lang["TOOL_MEASURE"],
	"icon": svg({"viewBox": "0 0 50 50"}, [title(lang["TOOL_MEASURE"]), path({"d": "M0,40 l10,10 l40,-40 l-10,-10 z m5,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5", "style": "stroke: currentColor", "stroke-linejoin": "round", "fill": "none"})]),
	"options": div([
		labels(`${lang["TOOL_MEASURE_SNAP"]}: `, snap, false),
		br(),
		labels(`${lang["TOOL_MEASURE_DIAGONALS"]}: `, diagonals, false),
		br(),
		labels(`${lang["TOOL_MEASURE_MULTI"]}: `, multiPoint, false),
		br(),
		labels(`${lang["TOOL_MEASURE_CELL"]}: `, cellValue)
	]),
	"mapMouseOver": () => {
		startMouseMove();
		return false;
	},
	"tokenMouseOver": function(this: SVGElement) {
		createSVG(root, {"style": {"--outline-cursor": "none"}});
		this.addEventListener("mouseout", () => createSVG(root, {"style": {"--outline-cursor": undefined}}), {"once": true});
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
		rpc.signalMeasure([coords[0], coords[1], x, y]);
		send = true;
		setupMouse2();
		return false;
	},
	"set": () => {
		createSVG(root, {"style": {"cursor": "none"}}, marker);
		createHTML(snap, {"checked": autosnap.value});
		setupShiftSnap();
		setupEscape();
	},
	"unset": () => {
		createSVG(root, {"style": {"cursor": undefined}});
		marker.remove();
		cancelMouse0();
		cancelMouse2();
		cancelMouseMove();
		cancelShiftSnap();
		cancelEscape();
	}
});

mapLoadedReceive(() => {
	const {gridDistance, gridDiagonal} = mapData;
	cellValue.value = gridDistance + "";
	diagonals.checked = gridDiagonal;
});

inited.then(() => {
	rpc.waitGridDistanceChange().then(distance => cellValue.value = distance + "");
	rpc.waitGridDiagonalChange().then(diagonal => diagonals.checked = diagonal);
	if (!isAdmin) {
		rpc.waitSignalMeasure().then(data => {
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
	}
});
