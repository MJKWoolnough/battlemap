import {amendNode, clearNode} from '../lib/dom.js';
import {br, button, div, input, table, tbody, td, th, thead, tr} from '../lib/html.js';
import {checkInt} from '../lib/misc.js';
import {path, svg} from '../lib/svg.js';
import {makeLangPack} from '../language.js';
import {isAdmin} from '../rpc.js';
import {enterKey, labels} from '../shared.js';
import {addTool} from '../tools.js';

if (isAdmin) {
	const lang = makeLangPack({
		"CLEAR": "Clear Rolls",
		"DICE": "Dice",
		"DICE_ROLLED": "Rolled",
		"MAX": "Max",
		"MIN": "Min",
		"NUMBER": "Number to Roll",
		"RESULT": "Result",
		"ROLL": "Roll!",
		"TITLE": "Dice Roller"
	      }),
	      dieNum = input({"type": "number", "min": 1, "max": 100, "value": 6, "onkeypress": enterKey}),
	      numDice = input({"type": "number", "min": 1, "max": 100, "value": 1, "onkeypress": enterKey}),
	      rolls = tbody(),
	      rollTable = table({"style": "display: none"}, [
		      thead(tr([
			      th(lang["DICE_ROLLED"]),
			      th(lang["MIN"]),
			      th(lang["MAX"]),
			      th(lang["RESULT"])
		      ])),
		      rolls
	      ]),
	      clearer = button({"style": "display: none", "onclick": () => {
		amendNode(rollTable, {"style": {"display": "none"}});
		clearNode(rolls);
		amendNode(clearer, {"style": {"display": "none"}});
	      }}, lang["CLEAR"]);
	addTool({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 50 58"}, path({"d": "M24,1 L0,13 0,42 7,38 0,13 24,8 48,13 41,38 49,42 48,13 24,1 24,8 7,38 41,38 24,8 M7,38 L24,57 0,42 M41,38 L24,57 49,42", "stroke": "currentColor", "fill": "none", "stroke-linecap": "round", "stroke-linejoin": "round"})),
		"options": div([
			labels([lang["DICE"], ": "], dieNum),
			br(),
			labels([lang["NUMBER"], ": "], numDice),
			br(),
			button({"onclick": () => {
				const nD = checkInt(parseInt(numDice.value), 1, 100, 6),
				      dN = checkInt(parseInt(dieNum.value), 1, 100, 1),
				      rolled = Array.from({"length": nD}, () => Math.ceil(Math.random() * dN));
				amendNode(rollTable, {"style": {"display": undefined}});
				amendNode(rolls, tr([
					td(`${nD}d${dN}`),
					td(Math.min(...rolled) + ""),
					td(Math.max(...rolled) + ""),
					td(rolled + "")
				]));
				amendNode(clearer, {"style": {"display": undefined}});
			}}, lang["ROLL"]),
			rollTable,
			clearer
		])
	});
}
