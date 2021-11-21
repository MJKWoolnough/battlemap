import type {Colour} from './colours.js';
import {br, div, fieldset, input, label, legend, span} from './lib/html.js';
import {defs, path, pattern, svg} from './lib/svg.js';
import {hex2Colour, makeColourPicker} from './colours.js';
import lang from './language.js';
import {labels} from './shared.js';
import {addTool} from './tools.js';

let wallColour = hex2Colour("#000");

const selectWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "checked": true}),
      placeWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker"});

addTool({
	"name": lang["TOOL_WALL"],
	"icon": svg({"viewBox": "0 0 90 60"}, [
		defs(pattern({"id": "brick", "patternUnits": "userSpaceOnUse", "width": 30, "height": 30}, path({"d": "M15,30 V15 H0 V0 H30 V15 H15 M0,30 H30", "fill": "none", "style": "stroke: currentColor", "stroke-width": 3}))),
		path({"d": "M60.5,14.5 V0 H0 V60 H90 V14.5 Z", "fill": "url(#brick)"}),
		path({"d": "M60,15 V0.5 H0 V59.5 H90 V15 Z", "fill": "none", "style": "stroke: currentColor", "stroke-width": 2})
	]),
	"options": div([
		fieldset([
			legend(lang["TOOL_WALL_MODE"]),
			labels(`${lang["TOOL_WALL_SELECT"]}: `, selectWall, false),
			br(),
			labels(`${lang["TOOL_WALL_PLACE"]}: `, placeWall, false)
		]),
		label(`${lang["TOOL_WALL_COLOUR"]}: `),
		span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_LIGHT_COLOUR"], () => wallColour, (c: Colour) => wallColour = c, "wallColour")),
	])
});
