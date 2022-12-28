import {br, button, div, input} from '../lib/html.js';
import {path, svg} from '../lib/svg.js';
import {makeLangPack} from '../language.js';
import {isAdmin} from '../rpc.js';
import {labels} from '../shared.js';
import {addTool} from '../tools.js';

if (isAdmin) {
	const lang = makeLangPack({
		"DICE": "Dice",
		"NUMBER": "Number to Roll",
		"ROLL": "Roll!",
		"TITLE": "Dice Roller"
	      });
	let dieNum = 6,
	    numDice = 1;
	addTool({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 50 58"}, path({"d": "M24,1 L0,13 0,42 7,38 0,13 24,8 48,13 41,38 49,42 48,13 24,1 24,8 7,38 41,38 24,8 M7,38 L24,57 0,42 M41,38 L24,57 49,42", "stroke": "currentColor", "fill": "none", "stroke-linecap": "round", "stroke-linejoin": "round"})),
		"options": div([
			labels([lang["DICE"], ": "], input({"type": "number", "min": 1, "max": 100, "value": 6})),
			br(),
			labels([lang["NUMBER"], ": "], input({"type": "number", "min": 1, "max": 100, "value": 1})),
			br(),
			button(lang["ROLL"])
		]),
	});
}
