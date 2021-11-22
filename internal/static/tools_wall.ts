import type {Colour} from './colours.js';
import {keyEvent, mouseMoveEvent} from './lib/events.js';
import {createHTML, br, div, fieldset, input, label, legend, span} from './lib/html.js';
import {createSVG, defs, path, pattern, svg} from './lib/svg.js';
import {hex2Colour, makeColourPicker} from './colours.js';
import lang from './language.js';
import {root, screen2Grid} from './map.js';
import {autosnap} from './settings.js';
import {labels} from './shared.js';
import {addTool, marker} from './tools.js';

let wallColour = hex2Colour("#000");

const selectWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "checked": true}),
      placeWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker"}),
      snap = input({"type": "checkbox", "class": "settings_ticker"}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
      });

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
		span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_LIGHT_COLOUR"], () => wallColour, (c: Colour) => wallColour = c, "wallColour")),
	]),
	"mapMouseOver": () => {
		startCursorMove();
		return false;
	},
	"set": () => {
		createHTML(snap, {"checked": autosnap.value});
		createSVG(root, {"style": {"cursor": "none"}}, marker);
		setupShiftSnap();
	},
	"unset": () => {
		createSVG(root, {"style": {"cursor": undefined}});
		cancelShiftSnap();
		cancelCursorMove();
	}
});
