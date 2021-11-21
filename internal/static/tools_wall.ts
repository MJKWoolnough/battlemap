import {defs, path, pattern, svg} from './lib/svg.js';
import lang from './language.js';
import {addTool} from './tools.js';

addTool({
	"name": lang["TOOL_WALL"],
	"icon": svg({"viewBox": "0 0 90 60"}, [
		defs(pattern({"id": "brick", "patternUnits": "userSpaceOnUse", "width": 30, "height": 30}, path({"d": "M15,30 V15 H0 V0 H30 V15 H15 M0,30 H30", "fill": "none", "style": "stroke: currentColor", "stroke-width": 3}))),
		path({"d": "M60.5,14.5 V0 H0 V60 H90 V14.5 Z", "fill": "url(#brick)"}),
		path({"d": "M60,15 V0.5 H0 V59.5 H90 V15 Z", "fill": "none", "style": "stroke: currentColor", "stroke-width": 2})
	]),
});
