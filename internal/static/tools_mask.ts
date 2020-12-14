import {svg, path} from './lib/svg.js';
import {addTool} from './tools.js';
import {defaultMouseWheel} from './tools_default.js';
import lang from './language.js';

addTool({
	"name": lang["TOOL_MASK"],
	"icon": svg({"viewBox": "0 0 60 50"}, path({"d": "M0,0 Q30,15 60,0 Q30,100 0,0 M32,20 q9,-10 18,0 q-9,-3 -18,0 M10,20 q9,-10 18,0 q-9,-3 -18,0 M20,35 q10,5 20,0 q-10,10 -20,0", "stroke": "none", "style": "fill: currentColor", "fill-rule": "evenodd"})),
	"mapMouseWheel": defaultMouseWheel
});
