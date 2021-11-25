import type {Wall} from './types.js';
import type {Colour} from './colours.js';
import type {SVGLayer} from './map.js';
import type {WindowElement} from './windows.js';
import {clearElement} from './lib/dom.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {createHTML, br, div, fieldset, input, label, legend, span} from './lib/html.js';
import {createSVG, defs, g, path, pattern, rect, svg} from './lib/svg.js';
import {hex2Colour, makeColourPicker} from './colours.js';
import lang from './language.js';
import {root, screen2Grid} from './map.js';
import {doWallAdd} from './map_fns.js';
import {autosnap} from './settings.js';
import {combined, inited} from './rpc.js';
import {deselectToken, labels, selected, walls} from './shared.js';
import {addTool, marker} from './tools.js';
import {shell, windows} from './windows.js';

let wallColour = hex2Colour("#000"),
    active = false,
    overWall: {layer: SVGLayer, wall: Wall} | null = null,
    w: WindowElement | null = null;

const selectWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "checked": true}),
      placeWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker"}),
      snap = input({"type": "checkbox", "class": "settings_ticker"}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
      }, () => marker.remove()),
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
      genWalls = () => {
	if (!active) {
		return;
	}
	clearElement(wallLayer);
	for (const wl of walls.values()) {
		if (!wl.layer.hidden) {
			const {x1, y1, x2, y2, colour} = wl.wall;
			createSVG(wallLayer, rect({"x": x1, "y": y1 - 5, "width": Math.hypot(x1 - x2, y1 - y2), "height": 10, "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1})`, "fill": colour, "stroke": colour.toHexString(), "stroke-width": 2, "onmouseover": () => overWall = wl, "onmouseout": () => overWall = null}));
		}
	}
      },
      [startEscape, cancelEscape] = keyEvent("Escape", () => cancelWallDraw());

addTool({
	"name": lang["TOOL_WALL"],
	"icon": svg({"viewBox": "0 0 90 60"}, [
		defs(pattern({"id": "brick", "patternUnits": "userSpaceOnUse", "width": 30, "height": 30}, path({"d": "M15,30 V15 H0 V0 H30 V15 H15 M0,30 H30", "fill": "none", "style": "stroke: currentColor", "stroke-width": 3}))),
		path({"d": "M60,15 V0.5 H0.5 V59.5 H89.5 V15 Z", "fill": "url(#brick)", "style": "stroke: currentColor", "stroke-width": 2})
	]),
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
		span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_LIGHT_COLOUR"], () => wallColour, (c: Colour) => createSVG(wall, {"fill": wallColour = c, "stroke": c.toHexString()}), "wallColour")),
	]),
	"mapMouse0": (e: MouseEvent) => {
		if (placeWall.checked) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			createSVG(root, createSVG(wall, {"width": 0, "x": coords[0] = x, "y": (coords[1] = y) - 5, "transform": undefined}));
			startWallDraw();
		} else if (overWall) {
			createHTML(shell, w = windows());
		}
		return false;
	},
	"mapMouseOver": () => {
		startCursorMove();
		createSVG(root, marker);
		return false;
	},
	"set": () => {
		active = true;
		deselectToken();
		createHTML(snap, {"checked": autosnap.value});
		genWalls();
		createSVG(root, {"style": {"cursor": "none"}}, [
			wallLayer,
			marker
		]);
		setupShiftSnap();
		startEscape();
	},
	"unset": () => {
		active = false;
		overWall = null;
		createSVG(root, {"style": {"cursor": undefined}});
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
	const gw = () => window.setTimeout(genWalls, 0);
	combined.waitWallAdded().then(gw);
	combined.waitWallRemoved().then(gw);
	combined.waitWallModified().then(gw);
});
