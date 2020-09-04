import {Colour, Coords, RPC, Uint} from './types.js';
import {br, button, div, input, label, span} from './lib/html.js';
import {createSVG, svg, rect, ellipse, g, path, polyline, polygon} from './lib/svg.js';
import {autosnap} from './settings.js';
import {defaultMouseWheel, panZoom} from './tools_default.js';
import {SVGShape, SVGDrawing, globals} from './map.js';
import {colour2RGBA, colourPicker, noColour, screen2Grid, handleError, requestShell} from './misc.js';
import {addTool} from './tools.js';

let over = false,
    clickOverride: null | ((e: MouseEvent) => void) = null,
    contextOverride: null | Function = null;
const draw = (root: SVGElement, e: MouseEvent, rpc: RPC) => {
	e.stopPropagation();
	if (clickOverride) {
		clickOverride(e);
		return;
	}
	const [cx, cy] = screen2Grid(e.clientX, e.clientY, snap.checked);
	if (rectangle.checked || circle.checked) {
		const isEllipse = circle.checked,
		      s = (isEllipse ? ellipse : rect)({"stroke": colour2RGBA(strokeColour), "fill": colour2RGBA(fillColour), "stroke-width": strokeWidth.value, cx, cy}),
		      onmousemove = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			if (isEllipse) {
				createSVG(s, {"rx": Math.abs(cx - x), "ry": Math.abs(cy - y)});
			} else {
				createSVG(s, {"x": Math.min(cx, x), "y": Math.min(cy, y), "width": Math.abs(cx - x), "height": Math.abs(cy - y)});
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
				const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked),
				      dr = isEllipse ? 2 : 1,
				      {selectedLayerPath, selectedLayer} = globals,
				      width = Math.abs(cx - x),
				      height = Math.abs(cy - y),
				      token = {"x": isEllipse ? cx - width : Math.min(cx, x), "y": isEllipse ? cy - height : Math.min(cy, y), "width": width * dr, "height": height * dr, "rotation": 0, "snap": snap.checked, "fill": fillColour, "stroke": strokeColour, "strokeWidth": parseInt(strokeWidth.value), "tokenType": 1, isEllipse};
				if (selectedLayer) {
					selectedLayer.tokens.push(SVGShape.from(token));
					rpc.addToken(selectedLayerPath, token).catch(handleError);
				} else {
					requestShell().alert("Draw Error", "No Layer Selected");
				}
			}
		      },
		      onkeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				clearup();
			}
		      };
		createSVG(root, {onmousemove, onmouseup}, s);
		window.addEventListener("keydown", onkeydown);
	} else {
		let minX = cx,
		    maxX = cx,
		    minY = cy,
		    maxY = cy;
		const points: Coords[] = [{"x": cx, "y": cy}],
		      close = fillColour.a > 0,
		      p = path({"stroke": colour2RGBA(strokeColour), "fill": colour2RGBA(fillColour), "stroke-width": strokeWidth.value}),
		      draw = (x?: Uint, y?: Uint) => {
			p.setAttribute("d", `M${points.map(c => `${c.x},${c.y}`).join(" L")}${x !== undefined ? ` ${x},${y}` : ""}${close ? " Z" : ""}`);
		      },
		      onmousemove = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			draw(x, y);
		      },
		      clearup = () => {
			clickOverride = null;
			root.removeEventListener("mousemove", onmousemove);
			window.removeEventListener("keydown", onkeydown);
			p.remove();
		      },
		      onkeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				clearup();
			}
		      };
		clickOverride = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			points.push({x, y});
			if (x < minX) {
				minX = x;
			} else if (x > maxX) {
				maxX = x;
			}
			if (y < minY) {
				minY = y;
			} else if (y > maxY) {
				maxY = y;
			}
			draw();
		};
		contextOverride = () => {
			clearup();
			for (const c of points) {
				c.x -= minX;
				c.y -= minY;
			}
			const {selectedLayerPath, selectedLayer} = globals,
			      token = {"x": minX, "y": minY, "width": maxX - minX, "height": maxY - minY, "rotation": 0, "snap": snap.checked, "fill": fillColour, "stroke": strokeColour, "strokeWidth": parseInt(strokeWidth.value), "tokenType": 2, points};
			if (selectedLayer) {
				selectedLayer.tokens.push(SVGDrawing.from(token));
				rpc.addToken(selectedLayerPath, token).catch(handleError);
			} else {
				requestShell().alert("Draw Error", "No Layer Selected");
			}
		};
		createSVG(root, {onmousemove}, p);
		window.addEventListener("keydown", onkeydown);
	}
      },
      oncontext = (e: MouseEvent) => {
	e.preventDefault();
	if (contextOverride) {
		contextOverride();
	}
      },
      marker = g([
	      polygon({"points": "5,0 16,0 10.5,5", "fill": "#000"}),
	      polygon({"points": "0,5 0,16 5,10.5", "fill": "#000"}),
	      polygon({"points": "5,21 16,21 10.5,16", "fill": "#000"}),
	      polygon({"points": "21,16 21,5 16,10.5", "fill": "#000"})
      ]),
      showMarker = (root: SVGElement) => {
	if (over) {
		return;
	}
	over = true;
	createSVG(root, {"style": {"cursor": "none"}}, marker);
	const {deselectToken} = globals,
	      onmousemove = (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
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
      strokeWidth = input({"id": "strokeWidth", "style": "width: 5em", "type": "number", "min": 0, "max": 100, "step": 1, "value": 1});

let fillColour = noColour,
    strokeColour: Colour = {"r": 0, "g": 0, "b": 0, "a": 255};

window.addEventListener("keydown", shiftSnap);
window.addEventListener("keyup", shiftSnap);

addTool({
	"name": "Draw",
	"icon": svg({"viewBox": "0 0 70 70", "fill": "none", "style": "stroke: currentColor"}, [
		polyline({"points": "51,7 58,0 69,11 62,18 51,7 7,52 18,63 62,18", "stroke-width": 2}),
		path({"d": "M7,52 L1,68 L18,63 M53,12 L14,51 M57,16 L18,55"})
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
		br(),
		label({"for": "strokeWidth"}, "Stroke Width: "),
		strokeWidth,
		br(),
		label({"for": "strokeColour"}, "Stroke Colour: "),
		span({"class": "checkboard colourButton"}, button({"id": "strokeColour", "style": "background-color: #000; width: 50px; height: 50px", "onclick": setColour("Set Stroke Colour", () => strokeColour, (c: Colour) => strokeColour = c)})),
		br(),
		label({"for": "fillColour"}, "Fill Colour: "),
		span({"class": "checkboard colourButton"}, button({"id": "fillColour", "style": "background-color: #fff; width: 50px; height: 50px", "onclick": setColour("Set Fill Colour", () => fillColour, (c: Colour) => fillColour = c)}, "None"))
	]),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent, rpc: RPC) {
		draw(this, e, rpc);
	},
	"mapMouseOver": function(this: SVGElement) {
		showMarker(this);
	},
	"mapMouseContext": oncontext,
	"tokenMouseDown": (e: MouseEvent, rpc: RPC) => {
		if (e.button === 0) {
			draw(globals.root, e, rpc);
		}
	},
	"tokenMouseOver": () => showMarker(globals.root),
	"tokenMouseContext": oncontext,
	"mapMouseWheel": defaultMouseWheel
});
