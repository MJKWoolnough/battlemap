import {br, div, input, label} from './lib/html.js';
import {createSVG, svg, rect, circle, g, line, polyline, polygon} from './lib/svg.js';
import {requestSVGRoot, requestMapData, requestSelected} from './comms.js';
import {autosnap} from './settings.js';
import {panZoom} from './tools_default.js';
import {screen2Grid} from './misc.js';

let over = false;
const draw = (root: SVGElement, e: MouseEvent) => {
	e.stopPropagation();
      },
      marker = g([
	      polygon({"points": "5,0 16,0 11,5", "fill": "#000"}),
	      polygon({"points": "0,5 0,16 5,11", "fill": "#000"}),
	      polygon({"points": "5,21 16,21 11,16", "fill": "#000"}),
	      polygon({"points": "21,16 21,5 16,11", "fill": "#000"})
      ]),
      showMarker = (root: SVGElement) => {
	if (over) {
		return;
	}
	over = true;
	createSVG(root, {"style": {"cursor": "none"}}, marker);
	const {deselectToken} = requestSelected(),
	      onmousemove = (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked, requestMapData());
		createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
	};
	deselectToken();
	createSVG(root, {onmousemove, "1onmouseleave": (e: MouseEvent) => {
		over = false;
		root.removeEventListener("mousemove", onmousemove);
		root.style.removeProperty("cursor");
		marker.remove();
	}});
      },
      rectangle = input({"id": "drawRectangle", "name": "drawShape", "type": "radio", "checked": true}),
      ellipse = input({"id": "drawEllipse", "type": "radio", "name": "drawShape"}),
      poly = input({"id": "drawPoly", "type": "radio", "name": "drawShape"}),
      snap = input({"id": "drawSnap", "type": "checkbox", "checked": autosnap.value}),
      shiftSnap = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		snap.click();
	}
      };

window.addEventListener("keydown", shiftSnap);
window.addEventListener("keyup", shiftSnap);

export default Object.freeze({
	"name": "Draw",
	"icon": svg({"viewBox": "0 0 70 70"}, [
		polyline({"points": "51,7 58,0 69,11 62,18 51,7 7,52 18,63 62,18", "stroke": "#000", "fill": "none", "stroke-width": 2}),
		polyline({"points": "7,52 1,68 18,63", "stroke": "#000", "fill": "none", "stroke-width": 1}),
		line({"x1": 53, "y1": 12, "x2": 14, "y2": 51, "stroke": "#000", "stroke-width": 1}),
		line({"x1": 57, "y1": 16, "x2": 18, "y2": 55, "stroke": "#000", "stroke-width": 1})
	]),
	"options": div([
		label({"for": "drawRectangle"}, "Rectangle: "),
		rectangle,
		br(),
		label({"for": "drawEllipse"}, "Ellipse: "),
		ellipse,
		br(),
		label({"for": "drawPoly"}, "Polygon: "),
		poly,
		br(),
		label({"for": "drawSnap"}, "Snap to Grid: "),
		snap
	]),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		draw(this, e);
	},
	"mapMouseOver": function(this: SVGElement) {
		showMarker(this);
	},
	"tokenMouseDown": (e: MouseEvent) => draw(requestSVGRoot(), e),
	"tokenMouseOver": () => showMarker(requestSVGRoot())
});
