import {Colour} from './types.js';
import {br, button, div, input, label, span} from './lib/html.js';
import {createSVG, svg, rect, ellipse, g, line, polyline, polygon} from './lib/svg.js';
import {requestSVGRoot, requestMapData, requestSelected, requestShell} from './comms.js';
import {autosnap} from './settings.js';
import {panZoom} from './tools_default.js';
import {colour2RGBA, colourPicker, noColour, screen2Grid} from './misc.js';

let over = false;
const draw = (root: SVGElement, e: MouseEvent) => {
	e.stopPropagation();
	const [cx, cy] = screen2Grid(e.clientX, e.clientY, snap.checked, requestMapData());
	if (rectangle.checked || circle.checked) {
		const isRect = rectangle.checked,
		      s = (isRect ? rect : ellipse)({"stroke": colour2RGBA(strokeColour), "fill": colour2RGBA(fillColour), "stroke-width": strokeWidth.value, cx, cy}),
		      onmousemove = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked, requestMapData());
			if (isRect) {
				createSVG(s, {"x": Math.min(cx, x), "y": Math.min(cy, y), "width": Math.abs(cx - x), "height": Math.abs(cy - y)});
			} else {
				createSVG(s, {"rx": Math.abs(cx - x), "ry": Math.abs(cy - y)});
			}
		      },
		      clearup = () => {
			root.removeEventListener("mousemove", onmousemove);
			root.removeEventListener("mouseup", onmouseup);
			window.removeEventListener("keydown", onkeydown);
			s.remove();
		      },
		      onmouseup = (e: MouseEvent) => {
			if (e.button === 0) {
				clearup();
			}
		      },
		      onkeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				clearup();
			}
		      };
		createSVG(root, {onmousemove, onmouseup}, s);
		window.addEventListener("keydown", onkeydown);
	}
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
      circle = input({"id": "drawEllipse", "type": "radio", "name": "drawShape"}),
      poly = input({"id": "drawPoly", "type": "radio", "name": "drawShape"}),
      snap = input({"id": "drawSnap", "type": "checkbox", "checked": autosnap.value}),
      shiftSnap = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		snap.click();
	}
      },
      setColour = (title: string, getColour: () => Colour, setColour: (c: Colour) => void) => function(this: HTMLButtonElement) {
	colourPicker(requestShell(), title, getColour()).then(c => {
		setColour(c);
		if (c.a === 0) {
			this.style.setProperty("background-color", "#fff");
			this.innerText = "None";
		} else {
			this.style.setProperty("background-color", colour2RGBA(c));
			this.innerText = "";
		}
	});
      },
      stroke = span({"class": "checkboard colourButton"}, button({"id": "strokeColour", "style": "background-color: #000; width: 50px; height: 50px", "onclick": setColour("Set Stroke Colour", () => strokeColour, (c: Colour) => strokeColour = c)})),
      fill = span({"class": "checkboard colourButton"}, button({"id": "fillColour", "style": "background-color: #fff; width: 50px; height: 50px", "onclick": setColour("Set Stroke Colour", () => fillColour, (c: Colour) => fillColour = c)}, "None")),
      strokeWidth = input({"id": "strokeWidth", "style": "width: 5em", "type": "number", "min": 0, "max": 100, "step": 1, "value": 1});

let fillColour = noColour,
    strokeColour: Colour = {"r": 0, "g": 0, "b": 0, "a": 255};

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
		circle,
		br(),
		label({"for": "drawPoly"}, "Polygon: "),
		poly,
		br(),
		label({"for": "drawSnap"}, "Snap to Grid: "),
		snap,
		label({"for": "strokeWidth"}, "Stroke Width: "),
		strokeWidth,
		br(),
		label({"for": "strokeColour"}, "Stroke Colour: "),
		stroke,
		br(),
		label({"for": "fillColour"}, "Fill Colour: "),
		fill
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
