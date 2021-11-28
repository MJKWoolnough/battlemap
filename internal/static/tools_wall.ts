import type {RPCWaits, Uint} from './types.js';
import type {Colour} from './colours.js';
import type {WindowElement} from './windows.js';
import {clearElement, svgNS} from './lib/dom.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {createHTML, br, button, div, fieldset, input, label, legend, span} from './lib/html.js';
import {createSVG, defs, g, path, pattern, rect, svg, title} from './lib/svg.js';
import {hex2Colour, makeColourPicker} from './colours.js';
import lang from './language.js';
import {root, screen2Grid} from './map.js';
import {doWallAdd, doWallModify, doWallRemove} from './map_fns.js';
import {autosnap} from './settings.js';
import {combined, inited} from './rpc.js';
import {cloneObject, deselectToken, labels, selected, setAndReturn, walls} from './shared.js';
import {addTool, marker, optionsWindow} from './tools.js';
import {shell, windows} from './windows.js';

let wallColour = hex2Colour("#000"),
    active = false,
    overWall: Uint = 0,
    w: WindowElement | null = null;

const updateCursorState = () => {
	if (placeWall.checked) {
		createSVG(root, {"style": {"cursor": "none"}}, marker);
		startCursorMove();
	} else {
		cancelCursorMove();
	}
      },
      selectWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "checked": true, "onchange": updateCursorState}),
      placeWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "onchange": updateCursorState}),
      snap = input({"type": "checkbox", "class": "settings_ticker"}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
      }, () => {
	createSVG(root, {"style": {"cursor": undefined}});
	marker.remove()
      }),
      coords = [0, 0],
      wall = rect({"height": 10, "fill": "#000", "stroke": "#000", "stroke-width": 2}),
      [startWallDraw, cancelWallDraw] = mouseDragEvent(0, (e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(wall, {"width": Math.hypot(x - coords[0], y - coords[1]), "transform": `rotate(${Math.atan2(y - coords[1], x - coords[0]) * 180 / Math.PI}, ${coords[0]}, ${coords[1]})`});
      }, (e: MouseEvent) => {
	if (e.isTrusted && selected.layer) {
		const [x2, y2] = screen2Grid(e.clientX, e.clientY, snap.checked);
		doWallAdd({"path": selected.layer.path, "wall": {"id": 0, "x1": coords[0], "y1": coords[1], x2, y2, "colour": wallColour}});
	}
	wall.remove();
      }),
      wallLayer = g(),
      wallMap = new Map<Uint, SVGRectElement>(),
      genWalls = () => {
	clearElement(wallLayer);
	wallMap.clear();
	for (const {layer, wall} of walls.values()) {
		if (!layer.hidden) {
			const {id, x1, y1, x2, y2, colour} = wall;
			createSVG(wallLayer, setAndReturn(wallMap, id, rect({"x": x1, "y": y1 - 5, "width": Math.hypot(x1 - x2, y1 - y2), "height": 10, "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1})`, "fill": colour, "stroke": colour.toHexString(), "stroke-width": 2, "onmouseover": () => overWall = id, "onmouseout": () => overWall = 0}, title(layer.path))));
		}
	}
      },
      [startEscape, cancelEscape] = keyEvent("Escape", () => cancelWallDraw()),
      icon = svg({"viewBox": "0 0 90 60"}, [
		defs(pattern({"id": "brick", "patternUnits": "userSpaceOnUse", "width": 30, "height": 30}, path({"d": "M15,30 V15 H0 V0 H30 V15 H15 M0,30 H30", "fill": "none", "style": "stroke: currentColor", "stroke-width": 3}))),
		path({"d": "M60,15 V0.5 H0.5 V59.5 H89.5 V15 Z", "fill": "url(#brick)", "style": "stroke: currentColor", "stroke-width": 2})
      ]),
      iconStr = "data:image/svg+xml," + encodeURIComponent("<svg xmlns=\"" + svgNS + "\"" + icon.outerHTML.slice(4));

addTool({
	"name": lang["TOOL_WALL"],
	icon,
	"options": div([
		fieldset([
			legend(lang["TOOL_WALL_MODE"]),
			labels(`${lang["TOOL_WALL_SELECT"]}: `, selectWall, false),
			br(),
			labels(`${lang["TOOL_WALL_PLACE"]}: `, placeWall, false)
		]),
		labels(`${lang["TOOL_WALL_SNAP"]}: `, snap, false),
		br(),
		label(`${lang["TOOL_WALL_COLOUR"]}: `),
		span({"class": "checkboard colourButton"}, makeColourPicker(optionsWindow, lang["TOOL_WALL_COLOUR"], () => wallColour, (c: Colour) => createSVG(wall, {"fill": wallColour = c, "stroke": c.toHexString()}), iconStr)),
	]),
	"mapMouse0": (e: MouseEvent) => {
		if (placeWall.checked) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			createSVG(root, createSVG(wall, {"width": 0, "x": coords[0] = x, "y": (coords[1] = y) - 5, "transform": undefined}));
			startWallDraw();
		} else if (overWall) {
			const wl = walls.get(overWall);
			if (wl) {
				const {id} = wl.wall;
				createHTML(shell, w = windows({"windows-title": lang["TOOL_WALL_PROPS"], "windows-icon": iconStr}, [
					div(`${lang["TOOL_WALL_LAYER"]}: ${wl.layer.path}`),
					label(`${lang["TOOL_WALL_COLOUR"]}: `),
					span({"class": "checkboard colourButton"}, makeColourPicker(w, lang["TOOL_WALL_COLOUR"], () => wl.wall.colour, (c: Colour) => {
						const wall = wallMap.get(id);
						if (wall) {
							createSVG(wall, {"fill": wl.wall.colour = c, "stroke": c.toHexString()});
							doWallModify(cloneObject(wl.wall));
						}
					}, iconStr)),
					br(),
					button({"onclick": () => {
						doWallRemove(id);
						w?.remove();
						wallMap.get(id)?.remove();
						wallMap.delete(id);
					}}, lang["TOOL_WALL_REMOVE"])
				]));
			}
		}
		return false;
	},
	"mapMouseOver": () => {
		updateCursorState();
		return false;
	},
	"set": () => {
		active = true;
		deselectToken();
		createHTML(snap, {"checked": autosnap.value});
		genWalls();
		createSVG(root, {"style": {"cursor": placeWall.checked ? "none" : undefined}}, [
			wallLayer,
			placeWall.checked ? marker : []
		]);
		setupShiftSnap();
		startEscape();
	},
	"unset": () => {
		active = false;
		overWall = 0;
		cancelShiftSnap();
		cancelCursorMove();
		cancelWallDraw();
		cancelEscape();
		wallLayer.remove();
		if (w) {
			w.remove();
			w = null;
		}
	}
});

inited.then(() => {
	const gw = () => {
		if (active) {
			window.setTimeout(genWalls, 0);
		}
	};
	for (const wait of ["waitWallAdded", "waitWallRemoved", "waitWallModified", "waitLayerMove", "waitLayerRemove", "waitLayerShift", "waitLayerShow", "waitLayerHide"] as (keyof RPCWaits)[]) {
		(combined as Omit<typeof combined, "images" | "audio" | "characters" | "map">)[wait]().then(gw);
	}
});
