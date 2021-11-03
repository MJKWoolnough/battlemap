import type {Uint} from './types.js';
import {br, div, input, label, span} from './lib/html.js';
import {createSVG, svg, rect, ellipse, g, path, polyline, polygon, title} from './lib/svg.js';
import {node} from './lib/nodes.js';
import {autosnap} from './settings.js';
import {screen2Grid} from './map.js';
import {checkInt, deselectToken, globals, labels} from './shared.js';
import {doTokenAdd} from './map_fns.js';
import {shell} from './windows.js';
import {Colour, makeColourPicker, noColour} from './colours.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './events.js';
import {addTool} from './tools.js';
import lang from './language.js';

let fill = noColour,
    stroke = Colour.from({"r": 0, "g": 0, "b": 0, "a": 255}),
    drawElement: SVGRectElement | SVGEllipseElement | SVGPolygonElement | null = null;

const marker = g({"fill": "#000", "stroke": "#fff", "stroke-width": 0.5}, ["5,0 16,0 10.5,5", "0,5 0,16 5,10.5", "5,21 16,21 10.5,16", "21,16 21,5 16,10.5"].map(points => polygon({points}))),
      rectangle = input({"name": "drawShape", "type": "radio", "checked": true, "class": "settings_ticker"}),
      circle = input({"type": "radio", "name": "drawShape", "class": "settings_ticker"}),
      poly = input({"type": "radio", "name": "drawShape", "class": "settings_ticker"}),
      snap = input({"type": "checkbox", "checked": autosnap.value, "class": "settings_ticker"}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      strokeWidth = input({"id": "strokeWidth", "style": "width: 5em", "type": "number", "min": 0, "max": 100, "step": 1, "value": 1}),
      [rectDrag, cancelRectDrag] = mouseDragEvent(0, (e: MouseEvent) => {
	if (!drawElement) {
		cancelRectDrag();
		return;
	}
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(drawElement, {"x": Math.min(coords[0], x), "y": Math.min(coords[1], y), "width": Math.abs(coords[0] - x), "height": Math.abs(coords[1] - y)});
      }, (e: MouseEvent) => {
	if (e.isTrusted) {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked),
		      {layer} = globals.selected;
		if (layer) {
			doTokenAdd(layer.path, {"id": 0, "x": Math.min(coords[0], x), "y": Math.min(coords[1], y), "width": Math.abs(coords[0] - x), "height": Math.abs(coords[1] - y), "rotation": 0, "snap": snap.checked, fill, stroke, "strokeWidth": checkInt(parseInt(strokeWidth.value), 0, 100), "tokenType": 1, "lightColour": noColour, "lightIntensity": 0});
		} else {
			shell.alert(lang["ERROR"], lang["TOOL_DRAW_ERROR"]);
		}
	}
	drawElement?.remove();
	drawElement = null;
	cancelEscape();
      }),
      [ellipseDrag, cancelEllipseDrag] = mouseDragEvent(0, (e: MouseEvent) => {
	if (!drawElement) {
		cancelEllipseDrag();
		return;
	}
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(drawElement, {"rx": Math.abs(coords[0] - x), "ry": Math.abs(coords[1] - y)});
      }, (e: MouseEvent) => {
	if (e.isTrusted) {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked),
		      {layer} = globals.selected;
		if (layer) {
			const width = Math.abs(coords[0] - x),
			      height = Math.abs(coords[1] - y);
			doTokenAdd(layer.path, {"id": 0, "x": coords[0] - width, "y": coords[1] - height, "width": width * 2, "height": height * 2, "rotation": 0, "snap": snap.checked, fill, stroke, "strokeWidth": checkInt(parseInt(strokeWidth.value), 0, 100), "tokenType": 1, "isEllipse": true, "lightColour": noColour, "lightIntensity": 0});
		} else {
			shell.alert(lang["ERROR"], lang["TOOL_DRAW_ERROR"]);
		}
	}
	drawElement?.remove();
	drawElement = null;
	cancelEscape();
      }),
      [polyMove, cancelPolyMove] = mouseMoveEvent((e: MouseEvent) => {
	if (!drawElement) {
		cancelPolyMove();
		return;
	}
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(drawElement, {"points": coords.reduce((res, _, i) => i % 2 === 0 ? `${res} ${coords[i]},${coords[i+1]}` : res, "") + ` ${x},${y}`});
      }),
      [setEscape, cancelEscape] = keyEvent("Escape", () => {
	cancelRectDrag();
	cancelEllipseDrag();
      }),
      [setPolyEscape, cancelPolyEscape] = keyEvent("Escape", () => {
	if (!drawElement) {
		return;
	}
	if (coords.length === 2) {
		drawElement.remove();
		drawElement = null;
		cancelPolyMove();
		return;
	} else {
		coords.pop();
		coords.pop();
		createSVG(drawElement, {"points": coords.reduce((res, _, i) => i % 2 === 0 ? `${res} ${coords[i]},${coords[i+1]}` : res, "")});
	}
      }),
      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
      }),
      coords: [Uint, Uint, ...Uint[]] = [0, 0];

addTool({
	"name": lang["TOOL_DRAW"],
	"icon": svg({"viewBox": "0 0 70 70", "fill": "none", "stroke": "currentColor"}, [
		title(lang["TOOL_DRAW"]),
		polyline({"points": "51,7 58,0 69,11 62,18 51,7 7,52 18,63 62,18", "stroke-width": 2}),
		path({"d": "M7,52 L1,68 L18,63 M53,12 L14,51 M57,16 L18,55"})
	]),
	"options": div([
		labels(`${lang["TOOL_DRAW_RECT"]}: `, rectangle, false),
		br(),
		labels(`${lang["TOOL_DRAW_ELLIPSE"]}: `, circle, false),
		br(),
		labels(`${lang["TOOL_DRAW_POLYGON"]}: `, poly, false),
		br(),
		labels(`${lang["TOOL_DRAW_SNAP"]}: `, snap, false),
		br(),
		labels(`${lang["TOOL_DRAW_STROKE_WIDTH"]}: `, strokeWidth),
		br(),
		label(`${lang["TOOL_DRAW_STROKE_COLOUR"]}: `),
		span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_DRAW_STROKE_COLOUR"], () => stroke, (c: Colour) => stroke = c, "strokeColour")),
		br(),
		label(`${lang["TOOL_DRAW_FILL_COLOUR"]}: `),
		span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_DRAW_STROKE_WIDTH"], () => fill, (c: Colour) => fill = c, "fillColour"))
	]),
	"mapMouseOver": () => {
		startCursorMove();
		return false;
	},
	"mapMouse0": (e: MouseEvent) => {
		const {layer} = globals.selected,
		      [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked),
		      sw = checkInt(parseInt(strokeWidth.value), 0, 100);
		if (layer) {
			if (rectangle.checked) {
				coords[0] = x;
				coords[1] = y;
				drawElement?.remove();
				drawElement = layer[node].appendChild(rect({x, y, fill, stroke, "stroke-width": sw}));
				rectDrag();
				setEscape();
			} else if (circle.checked) {
				coords[0] = x;
				coords[1] = y;
				drawElement?.remove();
				drawElement = layer[node].appendChild(ellipse({"cx": x, "cy": y, fill, stroke, "stroke-width": sw}));
				ellipseDrag();
				setEscape();
			} else if (poly.checked) {
				if (drawElement instanceof SVGPolygonElement) {
					coords.push(x, y);
					createSVG(drawElement, {"points": coords.reduce((res, _, i) => i % 2 === 0 ? `${res} ${coords[i]},${coords[i+1]}` : res, "")});
				} else {
					coords.splice(0, coords.length, x, y);
					drawElement?.remove();
					drawElement = layer[node].appendChild(polygon({stroke, fill, "stroke-width": sw}));
					polyMove();
					setPolyEscape();
				}
			}
		}
		return false;
	},
	"mapMouse2": (e: MouseEvent) => {
		const {layer} = globals.selected;
		if (layer && drawElement instanceof SVGPolygonElement && coords.length >= 4) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			coords.push(x, y);
			let minX = Infinity,
			    minY = Infinity,
			    maxX = -Infinity,
			    maxY = -Infinity;
			const points = coords.reduce((res, _, i) => {
				if (i % 2 === 0) {
					const x = coords[i],
					      y = coords[i+1];
					res.push([x, y]);
					if (x < minX) {
						minX = x;
					}
					if (y < minY) {
						minY = y;
					}
					if (x > maxX) {
						maxX = x;
					}
					if (y > maxY) {
						maxY = y;
					}
				}
				return res;
			}, [] as [Uint, Uint][]).map(([x, y]) => ({"x": x - minX, "y": y - minY}));
			doTokenAdd(layer.path, {"id": 0, "x": minX, "y": minY, "width": maxX - minX, "height": maxY - minY, "rotation": 0, "snap": snap.checked, fill, stroke, "strokeWidth": checkInt(parseInt(strokeWidth.value), 0, 100), "tokenType": 2, points, "lightColour": noColour, "lightIntensity": 0});
			cancelPolyMove();
			cancelPolyEscape();
			drawElement.remove();
			drawElement = null;
		}
		return false;
	},
	"set": () => {
		deselectToken();
		setupShiftSnap();
		createSVG(globals.root, {"style": {"cursor": "none"}}, marker);
	},
	"unset": () => {
		cancelShiftSnap();
		cancelRectDrag()
		cancelEllipseDrag();
		cancelPolyMove();
		cancelEscape();
		cancelPolyEscape();
		cancelCursorMove();
		marker.remove();
		globals.root.style.removeProperty("cursor");
	}
});
