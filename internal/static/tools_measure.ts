import {br, div, input, label} from './lib/html.js';
import {createSVG, svg, circle, g, line, path, polygon} from './lib/svg.js';
import {addTool} from './tools.js';
import {globals} from './map.js';
import {deselectToken, doMapDataSet} from './adminMap.js';
import {defaultMouseWheel} from './tools_default.js';
import {autosnap} from './settings.js';
import {screen2Grid, mapLoadedReceive, isUint} from './misc.js';
import lang from './language.js';
import {addMapDataChecker} from './rpc.js';

let over = false;

const mapKey = "TOOL_MEASURE_CELL_VALUE",
      snap = input({"id": "measureSnap", "type": "checkbox", "checked": autosnap.value}),
      cellValue = input({"id": "measureCell", "type": "number", "value": 1, "min": 0, "onchange": () => {
	const v = parseInt(cellValue.value);
	if (!isUint(v)) {
		doMapDataSet(mapKey, v);
	}
      }}),
      shiftSnap = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		snap.click();
	}
      },
      info = div({"style": "background-color: #fff; color: #000; position: absolute; top: 0;"}),
      marker = g([
              polygon({"points": "5,0 16,0 10.5,5", "fill": "#000"}),
              polygon({"points": "0,5 0,16 5,10.5", "fill": "#000"}),
              polygon({"points": "5,21 16,21 10.5,16", "fill": "#000"}),
              polygon({"points": "21,16 21,5 16,10.5", "fill": "#000"})
      ]),
      spot = circle({"r": 3, "fill": "#000", "stroke": "#fff"}),
      lone = line({"stroke": "#fff", "stroke-width": 4, "stroke-linecap": "square"}),
      ltwo = line({"stroke": "#000", "stroke-width": 2}),
      drawnLine = g([lone, ltwo, spot]),
      showMarker = (root: SVGElement) => {
	if (over) {
		return;
	}
	over = true;
	createSVG(root, {"style": {"cursor": "none"}}, marker);
	const coords = [NaN, NaN],
	      onmousedown = (e: MouseEvent) => {
		if (e.button === 0) {
			[coords[0], coords[1]] = screen2Grid(e.clientX, e.clientY, snap.checked);
			const l = {"x1": coords[0], "y1": coords[1], "x2": coords[0], "y2": coords[1]};
			createSVG(lone, l);
			createSVG(ltwo, l);
			createSVG(spot, {"cx": coords[0], "cy": coords[1]});
			root.insertBefore(drawnLine, marker);
			document.body.appendChild(info);
		}
	      },
	      onmouseup = (e: MouseEvent) => {
		if (e.button === 0) {
			coords[0] = NaN;
			coords[1] = NaN;
			drawnLine.remove();
			info.remove();
		}
	      },
	      onmousemove = (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
		if (!isNaN(coords[0])) {
			const size = globals.mapData.gridSize,
			      l = {"x2": x, "y2": y};
			info.innerText = "" + parseInt(cellValue.value) * Math.round(Math.hypot(x - coords[0], y - coords[1]) / size);
			createSVG(lone, l);
			createSVG(ltwo, l);
		}
	      };
	deselectToken();
	createSVG(root, {onmousedown, onmouseup, onmousemove, "1onmouseleave": (e: MouseEvent) => {
		root.removeEventListener("mousedown", onmousedown);
		root.removeEventListener("mouseup", onmouseup);
		root.removeEventListener("mousemove", onmousemove);
		root.style.removeProperty("cursor");
		marker.remove();
		drawnLine.remove();
		info.remove();
		over = false;
	}});
      },
      disable = (e: MouseEvent) => {
	if (e.button !== 0) {
		return;
	}
	e.preventDefault();
      }

window.addEventListener("keydown", shiftSnap);
window.addEventListener("keyup", shiftSnap);

addTool({
	"name": lang["TOOL_MEASURE"],
	"icon": svg({"viewBox": "0 0 50 50"}, path({"d": "M0,40 l10,10 l40,-40 l-10,-10 z m5,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5 m-3,-7 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l3,3 m-1,-5 l5,5", "style": "stroke: currentColor", "stroke-linejoin": "round", "fill": "none"})),
	"options": div([
		label({"for": "measureSnap"}, `${lang["TOOL_MEASURE_SNAP"]}: `),
		snap,
		br(),
		label({"for": "measureCell"}, `${lang["TOOL_MEASURE_CELL"]}: `),
		cellValue,
		br()
	]),
	"mapMouseOver": function(this: SVGElement) {
		showMarker(this);
	},
	"mapMouseDown": disable,
	"tokenMouseOver": () => showMarker(globals.root),
	"tokenMouseDown": disable,
	"mapMouseWheel": defaultMouseWheel
});

addMapDataChecker((data: Record<string, any>) => {
	for (const key in data) {
		if (key === mapKey) {
			const v = data[key];
			if (isUint(v)) {
				cellValue.value = "" + v;
			} else {
				delete data[key];
				console.log(new TypeError(`Map Data value of '${mapKey}' must be a Uint`));
			}
		}
	}
});
