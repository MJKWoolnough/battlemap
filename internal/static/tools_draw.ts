import type {Colour, Coords, Uint} from './types.js';
import {br, div, input, label, span} from './lib/html.js';
import {createSVG, svg, rect, ellipse, g, path, polyline, polygon, title} from './lib/svg.js';
import {autosnap} from './settings.js';
import {screen2Grid} from './map.js';
import {checkInt, deselectToken, globals, labels} from './shared.js';
import {doTokenAdd} from './map_fns.js';
import {shell} from './windows.js';
import {colour2RGBA, makeColourPicker, noColour} from './colours.js';
import {addTool, ignore} from './tools.js';
import lang from './language.js';

let over = false,
    clickOverride: null | ((e: MouseEvent) => void) = null,
    contextOverride: null | Function = null,
    fillColour = noColour,
    strokeColour: Colour = {"r": 0, "g": 0, "b": 0, "a": 255};


const marker = g([
	      polygon({"points": "5,0 16,0 10.5,5", "fill": "#000"}),
	      polygon({"points": "0,5 0,16 5,10.5", "fill": "#000"}),
	      polygon({"points": "5,21 16,21 10.5,16", "fill": "#000"}),
	      polygon({"points": "21,16 21,5 16,10.5", "fill": "#000"})
      ]),
      rectangle = input({"name": "drawShape", "type": "radio", "checked": true}),
      circle = input({"type": "radio", "name": "drawShape"}),
      poly = input({"type": "radio", "name": "drawShape"}),
      snap = input({"type": "checkbox", "checked": autosnap.value}),
      shiftSnap = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		snap.click();
	}
      },
      strokeWidth = input({"id": "strokeWidth", "style": "width: 5em", "type": "number", "min": 0, "max": 100, "step": 1, "value": 1});

window.addEventListener("keydown", shiftSnap);
window.addEventListener("keyup", shiftSnap);

addTool({
	"name": lang["TOOL_DRAW"],
	"icon": svg({"viewBox": "0 0 70 70", "fill": "none", "stroke": "currentColor"}, [
		title(lang["TOOL_DRAW"]),
		polyline({"points": "51,7 58,0 69,11 62,18 51,7 7,52 18,63 62,18", "stroke-width": 2}),
		path({"d": "M7,52 L1,68 L18,63 M53,12 L14,51 M57,16 L18,55"})
	]),
	"options": div([
		labels(`${lang["TOOL_DRAW_RECT"]}: `, rectangle),
		br(),
		labels(`${lang["TOOL_DRAW_ELLIPSE"]}: `, circle),
		br(),
		labels(`${lang["TOOL_DRAW_POLYGON"]}: `, poly),
		br(),
		labels(`${lang["TOOL_DRAW_SNAP"]}: `, snap),
		br(),
		labels(`${lang["TOOL_DRAW_STROKE_WIDTH"]}: `, strokeWidth),
		br(),
		label(`${lang["TOOL_DRAW_STROKE_COLOUR"]}: `),
		span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_DRAW_STROKE_COLOUR"], () => strokeColour, (c: Colour) => strokeColour = c, "strokeColour")),
		br(),
		label(`${lang["TOOL_DRAW_FILL_COLOUR"]}: `),
		span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_DRAW_STROKE_WIDTH"], () => fillColour, (c: Colour) => fillColour = c, "fillColour"))
	]),
	"mapMouse0": (e: MouseEvent) => {
		e.stopPropagation();
		if (clickOverride) {
			clickOverride(e);
			return false;
		}
		const [cx, cy] = screen2Grid(e.clientX, e.clientY, snap.checked),
		      {root} = globals;
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
					      {layer: selectedLayer} = globals.selected,
					      width = Math.abs(cx - x),
					      height = Math.abs(cy - y),
					      token = {"id": 0, "x": isEllipse ? cx - width : Math.min(cx, x), "y": isEllipse ? cy - height : Math.min(cy, y), "width": width * dr, "height": height * dr, "rotation": 0, "snap": snap.checked, "fill": fillColour, "stroke": strokeColour, "strokeWidth": checkInt(parseInt(strokeWidth.value), 0, 100), "tokenType": 1, isEllipse, "lightColour": noColour, "lightIntensity": 0};
					if (selectedLayer) {
						doTokenAdd(selectedLayer.path, token);
					} else {
						shell.alert(lang["ERROR"], lang["TOOL_DRAW_ERROR"]);
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
				const {layer: selectedLayer} = globals.selected,
				      token = {"id": 0, "x": minX, "y": minY, "width": maxX - minX, "height": maxY - minY, "rotation": 0, "snap": snap.checked, "fill": fillColour, "stroke": strokeColour, "strokeWidth": checkInt(parseInt(strokeWidth.value), 0, 100), "tokenType": 2, points, "lightColour": noColour, "lightIntensity": 0};
				if (selectedLayer) {
					doTokenAdd(selectedLayer.path, token);
				} else {
					shell.alert(lang["ERROR"], lang["TOOL_DRAW_ERROR"]);
				}
			};
			createSVG(root, {onmousemove}, p);
			window.addEventListener("keydown", onkeydown);
		}
		return false;
	},
	"mapMouse2": () => {
		if (contextOverride) {
			contextOverride();
		}
		return false;
	},
	"mapMouseOver": () => {
		if (over) {
			return false;
		}
		const {root} = globals;
		over = true;
		createSVG(root, {"style": {"cursor": "none"}}, marker);
		const onmousemove = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
		};
		deselectToken();
		createSVG(root, {onmousemove, "1onmouseleave": () => {
			over = false;
			root.removeEventListener("mousemove", onmousemove);
			root.style.removeProperty("cursor");
			marker.remove();
		}});
		return false;
	},
	"tokenMouse0": ignore,
	"tokenMouse2": ignore,
	"tokenMouseOver": ignore,
	"unset": () => marker.remove()
});
