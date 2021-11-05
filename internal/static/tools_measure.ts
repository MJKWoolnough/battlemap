import type {Uint} from './types.js';
import {createHTML, br, div, input} from './lib/html.js';
import {createSVG, svg, circle, g, line, path, title} from './lib/svg.js';
import {addTool, ignore, marker} from './tools.js';
import {panZoom, screen2Grid} from './map.js';
import {autosnap} from './settings.js';
import {checkInt, globals, labels, mapLoadedReceive, isUint, isAdmin} from './shared.js';
import {keyEvent, mouseDragEvent} from './events.js';
import lang from './language.js';
import {rpc, inited} from './rpc.js';

const grid2Screen = (x: Uint, y: Uint): [number, number] => {
	const {width, height} = globals.mapData;
	return [panZoom.zoom * x - (panZoom.zoom - 1) * width / 2 + panZoom.x, panZoom.zoom * y - (panZoom.zoom - 1) * height / 2 + panZoom.y];
      },
      snap = input({"type": "checkbox", "checked": autosnap.value, "class": "settings_ticker"}),
      cellValue = input({"type": "number", "value": 1, "min": 0, "onchange": () => {
	const v = parseInt(cellValue.value);
	if (isUint(v)) {
		rpc.setGridDistance(v);
	}
      }}),
      diagonals = input({"type": "checkbox", "checked": true, "class": "settings_ticker", "onchange": () => rpc.setGridDiagonal(diagonals.checked)}),
      shiftSnap = () => snap.click(),
      info = div({"style": "border: 1px solid #000; padding: 5px; background-color: #fff; color: #000; position: absolute"}),
      spot = circle({"r": 8, "fill": "#000", "stroke": "#fff", "stroke-width": 2}),
      lone = line({"stroke": "#fff", "stroke-width": 8, "stroke-linecap": "square"}),
      ltwo = line({"stroke": "#000", "stroke-width": 6}),
      drawnLine = g([lone, ltwo, spot]),
      coords: [number, number] = [NaN, NaN],
      [setupMouse0, cancelMouse0] = mouseDragEvent(0, undefined, () => stopMeasurement()),
      [setupMouse2, cancelMouse2] = mouseDragEvent(2, undefined, () => {
	if (send) {
		rpc.signalMeasure(null);
		send = false;
	}
      }),
      onmousemove = (e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10 / panZoom.zoom}, ${y - 10 / panZoom.zoom}) scale(${1/panZoom.zoom})`});
	if (!isNaN(coords[0])) {
		measureDistance(x, y);
		if (send) {
			rpc.signalMeasure([coords[0], coords[1], x, y]);
		}
	}
      },
      fullCleanup = () => {
	cancelMouse0();
	cancelMouse2();
	document.body.removeEventListener("mousemove", onmousemove);
	document.body.removeEventListener("mouseleave", cleanup);
	globals.root.style.removeProperty("cursor");
	stopMeasurement();
	marker.remove();
	over = false;
	if (send) {
		rpc.signalMeasure(null);
		send = false;
	}
	cleanup = noopCleanup;
      },
      noopCleanup = () => {},
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap);

export const startMeasurement = (x1: Uint, y1: Uint) => {
	coords[0] = x1;
	coords[1] = y1;
	const l = {x1, y1, "x2": x1, "y2": y1},
	      [sx, sy] = grid2Screen(x1, y1),
	      {root} = globals;
	createSVG(lone, l);
	createSVG(ltwo, l);
	createSVG(spot, {"cx": coords[0], "cy": coords[1]});
	if (!drawnLine.parentNode) {
		if (marker.parentNode) {
			root.insertBefore(drawnLine, marker);
		} else {
			root.appendChild(drawnLine);
		}
	}
	createHTML(info, {"style": {"left": (sx + 5) + "px", "top": (sy + 5) + "px"}});
	if (!info.parentNode) {
		document.body.appendChild(info);
	}
},
measureDistance = (x2: Uint, y2: Uint) => {
	if (isNaN(coords[0]) || isNaN(coords[1])) {
		return;
	}
	const {gridSize: size} = globals.mapData,
	      [x1, y1] = coords,
	      l = {x1, y1, x2, y2},
	      [sx, sy] = grid2Screen(x2, y2);
	createHTML(info, {"style": {"left": `${sx + 5}px`, "top": `${sy + 5}px`}}, "" + Math.round(checkInt(parseInt(cellValue.value), 1, Infinity, size) * (diagonals.checked ? Math.hypot(x2 -x1, y2 - y1) : Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))) / size));
	createSVG(lone, l);
	createSVG(ltwo, l);
},
stopMeasurement = () => {
	drawnLine.remove();
	info.remove();
	coords[0] = NaN;
	coords[1] = NaN;
};

let over = false,
    send = false,
    cleanup = noopCleanup;

addTool({
	"name": lang["TOOL_MEASURE"],
	"icon": svg({"viewBox": "0 0 50 50"}, [title(lang["TOOL_MEASURE"]), path({"d": "M0,40 l10,10 l40,-40 l-10,-10 z m5,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5", "style": "stroke: currentColor", "stroke-linejoin": "round", "fill": "none"})]),
	"options": div([
		labels(`${lang["TOOL_MEASURE_SNAP"]}: `, snap, false),
		br(),
		labels(`${lang["TOOL_MEASURE_DIAGONALS"]}: `, diagonals, false),
		br(),
		labels(`${lang["TOOL_MEASURE_CELL"]}: `, cellValue)
	]),
	"mapMouseOver": function(this: SVGElement) {
		if (!over) {
			over = true;
			createSVG(this, {"style": {"cursor": "none"}}, marker);
			cleanup = fullCleanup;
			createHTML(document.body, {onmousemove, "onmouseleave": cleanup});
		}
		return false;
	},
	"tokenMouseOver": function(this: SVGElement) {
		const {root} = globals;
		root.style.setProperty("--outline-cursor", "none");
		this.addEventListener("mouseout", () => root.style.removeProperty("--outline-cursor"), {"once": true});
		return false;
	},
	"tokenMouse0": ignore,
	"tokenMouse2": ignore,
	"mapMouse0": (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		startMeasurement(x, y);
		setupMouse0();
		return false;
	},
	"mapMouse2": (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		rpc.signalMeasure([coords[0], coords[1], x, y]);
		send = true;
		setupMouse2();
		return false;
	},
	"set": setupShiftSnap,
	"unset": () => {
		cleanup();
		cancelShiftSnap();
	}
});

mapLoadedReceive(() => {
	const {gridDistance, gridDiagonal} = globals.mapData;
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
			const [x1, y1, x2, y2] = data;
			if (isUint(x1) && isUint(y1) && isUint(x2) && isUint(y2)) {
				startMeasurement(x1, y1);
				measureDistance(x2, y2);
				return;
			}
		});
	}
});
