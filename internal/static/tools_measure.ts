import {br, div, input, label} from './lib/html.js';
import {svg, g, path, polygon} from './lib/svg.js';
import {addTool} from './tools.js';
import {globals} from './map.js';
import {defaultMouseWheel} from './tools_default.js';
import {autosnap} from './settings.js';
import lang from './language.js';

const snap = input({"id": "measureSnap", "type": "checkbox", "checked": autosnap.value}),
      shiftSnap = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		snap.click();
	}
      },
      marker = g([
              polygon({"points": "5,0 16,0 10.5,5", "fill": "#000"}),
              polygon({"points": "0,5 0,16 5,10.5", "fill": "#000"}),
              polygon({"points": "5,21 16,21 10.5,16", "fill": "#000"}),
              polygon({"points": "21,16 21,5 16,10.5", "fill": "#000"})
      ]),
      showMarker = (root: SVGElement) => {

      },
      draw = (e: MouseEvent) => {
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
		label({"for": "measureSnap"}, lang["TOOL_MEASURE_SNAP"]),
		snap,
		br()
	]),
	"mapMouseOver": function(this: SVGElement) {
		showMarker(this);
	},
	"mapMouseDown": draw,
	"tokenMouseOver": () => showMarker(globals.root),
	"tokenMouseDown": draw,
	"mapMouseWheel": defaultMouseWheel
});
