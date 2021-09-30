import {svg, title} from './lib/svg.js';
import {addTool} from './tools.js';
import {defaultMouseWheel} from './tools_default.js';
import lang from './language.js';

addTool({
	"name": lang["TOOL_MULTIPLACE"],
	"icon": svg(title(lang["TOOL_MULTIPLACE"])),
	"mapMouseWheel": defaultMouseWheel
});
