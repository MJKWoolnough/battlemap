import type {Uint} from './types.js';
import {createHTML, br, div, input, label} from './lib/html.js';
import {createSVG, svg, circle, g, line, path, polygon, title} from './lib/svg.js';
import {addTool} from './tools.js';
import {defaultMouseWheel, panZoom, screen2Grid} from './tools_default.js';
import {autosnap} from './settings.js';
import {checkInt, globals, mapLoadedReceive, isUint, isAdmin} from './shared.js';
import lang from './language.js';
import {rpc, inited} from './rpc.js';

let over = false;

const grid2Screen = (x: Uint, y: Uint): [number, number] => {
	const {mapData: {width, height}} = globals;
	return [panZoom.zoom * x - (panZoom.zoom - 1) * width / 2 + panZoom.x, panZoom.zoom * y - (panZoom.zoom - 1) * height / 2 + panZoom.y];
      },
      snap = input({"id": "measureSnap", "type": "checkbox", "checked": autosnap.value}),
      cellValue = input({"id": "measureCell", "type": "number", "value": 1, "min": 0, "onchange": () => {
	const v = parseInt(cellValue.value);
	if (isUint(v)) {
		rpc.setGridDistance(v);
	}
      }}),
      diagonals = input({"id": "measureDiagonals", "type": "checkbox", "checked": true, "onchange": () => rpc.setGridDiagonal(diagonals.checked)}),
      shiftSnap = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		snap.click();
	}
      },
      info = div({"style": "border: 1px solid #000; padding: 5px; background-color: #fff; color: #000; position: absolute"}),
      marker = g({"fill": "#000", "stroke": "#fff", "stroke-width": 0.5}, [
              polygon({"points": "5,0 16,0 10.5,5"}),
              polygon({"points": "0,5 0,16 5,10.5"}),
              polygon({"points": "5,21 16,21 10.5,16"}),
              polygon({"points": "21,16 21,5 16,10.5"})
      ]),
      spot = circle({"r": 8, "fill": "#000", "stroke": "#fff", "stroke-width": 2}),
      lone = line({"stroke": "#fff", "stroke-width": 8, "stroke-linecap": "square"}),
      ltwo = line({"stroke": "#000", "stroke-width": 6}),
      drawnLine = g([lone, ltwo, spot]),
      coords: [number, number] = [NaN, NaN],
      showMarker = (root: SVGElement) => {
	if (over) {
		return;
	}
	over = true;
	createSVG(root, {"style": {"cursor": "none"}}, marker);
	let send = false;
	const onmousedown = (e: MouseEvent) => {
		if (e.button === 0) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			startMeasurement(x, y);
		} else if (e.button === 2 && !isNaN(coords[0]) && !send) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			rpc.signalMeasure([coords[0], coords[1], x, y]);
			send = true;
		}
	      },
	      onmouseup = (e: MouseEvent) => {
		switch (e.button) {
		case 0:
			stopMeasurement();
		case 2:
			if (send) {
				rpc.signalMeasure(null);
				send = false;
			}
		}
	      },
	      onmousemove = (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		createSVG(marker, {"transform": `translate(${x - 10 / panZoom.zoom}, ${y - 10 / panZoom.zoom}) scale(${1/panZoom.zoom})`});
		if (!isNaN(coords[0])) {
			measureDistance(x, y);
			if (send) {
				rpc.signalMeasure([coords[0], coords[1], x, y]);
			}
		}
	      };
	cleanup = () => {
		document.body.removeEventListener("mousedown", onmousedown);
		document.body.removeEventListener("mouseup", onmouseup);
		document.body.removeEventListener("mousemove", onmousemove);
		document.body.removeEventListener("mouseleave", cleanup);
		globals.root.style.removeProperty("cursor");
		stopMeasurement();
		marker.remove();
		over = false;
		if (send) {
			rpc.signalMeasure(null);
		}
		cleanup = noopCleanup;
	};
	createSVG(document.body, {onmousedown, onmouseup, onmousemove, "onmouseleave": cleanup});
      },
      disable = (e: MouseEvent) => {
	if (e.button !== 0 && e.button !== 2) {
		return;
	}
	e.preventDefault();
      },
      noopCleanup = () => {};

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
	const size = globals.mapData.gridSize,
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

let cleanup = noopCleanup;

window.addEventListener("keydown", shiftSnap);
window.addEventListener("keyup", shiftSnap);

addTool({
	"name": lang["TOOL_MEASURE"],
	"icon": svg({"viewBox": "0 0 50 50"}, [title(lang["TOOL_MEASURE"]), path({"d": "M0,40 l10,10 l40,-40 l-10,-10 z m5,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5", "style": "stroke: currentColor", "stroke-linejoin": "round", "fill": "none"})]),
	"options": div([
		label({"for": "measureSnap"}, `${lang["TOOL_MEASURE_SNAP"]}: `),
		snap,
		br(),
		label({"for": "measureDiagonals"}, `${lang["TOOL_MEASURE_DIAGONALS"]}: `),
		diagonals,
		br(),
		label({"for": "measureCell"}, `${lang["TOOL_MEASURE_CELL"]}: `),
		cellValue
	]),
	"mapMouseOver": function(this: SVGElement) {
		showMarker(this);
	},
	"mapMouseDown": disable,
	"tokenMouseOver": function(this: SVGElement) {
		const {root} = globals;
		showMarker(root)
		root.style.setProperty("--outline-cursor", "none");
		this.addEventListener("mouseout", () => root.style.removeProperty("--outline-cursor"), {"once": true});
	},
	"tokenMouseDown": disable,
	"mapMouseWheel": defaultMouseWheel,
	"tokenMouseContext": disable,
	"mapMouseContext": disable,
	"unset": () => cleanup()
});

mapLoadedReceive(() => {
	cellValue.value = globals.mapData.gridDistance + "";
	diagonals.checked = globals.mapData.gridDiagonal;
});

inited.then(() => {
	rpc.waitGridDistanceChange().then(distance => cellValue.value = distance + "");
	rpc.waitGridDiagonalChange().then(diagonal => diagonals.checked = diagonal);
	if (!isAdmin()) {
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
