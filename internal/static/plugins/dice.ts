import {div} from '../lib/html.js';
import {svg} from '../lib/svg.js';
import {makeLangPack} from '../language.js';
import {isAdmin} from '../rpc.js';
import {addTool} from '../tools.js';

if (isAdmin) {
	const lang = makeLangPack({
		"TITLE": "Dice Roller"
	      });
	addTool({
		"name": lang["TITLE"],
		"icon": svg(),
		"options": div(),
	});
}
