import {amendNode} from '../lib/dom.js';
import {br, div, input} from '../lib/html.js';
import {circle, svg} from '../lib/svg.js';
import {makeLangPack} from '../language.js';
import {screen2Grid, showSignal} from '../map.js';
import {deselectToken} from '../map_tokens.js';
import {isAdmin, rpc} from '../rpc.js';
import {settingsTicker} from '../settings.js';
import {labels} from '../shared.js';
import {addTool} from '../tools.js';

if (isAdmin) {
	const lang = makeLangPack({
		"HOME": "Set Map Start Location",
		"MOVE": "Move User Map",
		"TITLE": "Signal"
	      }),
	      move = input({"type": "checkbox", "class": settingsTicker, "onchange": () => amendNode(home, {"disabled": !move.checked})}),
	      home = input({"type": "checkbox", "class": settingsTicker, "disabled": true});
	addTool({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 100 100", "fill": "none", "stroke": "currentColor", "stroke-width": 3}, [
			circle({"cx": 50, "cy": 50, "r": 48}),
			circle({"cx": 50, "cy": 50, "r": 38})
		]),
		"options": div([
			labels(move, [lang["MOVE"], ": "]),
			br(),
			labels(home, [lang["HOME"], ": "])
		]),
		"mapMouse0": (e: MouseEvent) => {
			const pos = screen2Grid(e.clientX, e.clientY);
			showSignal(pos);
			if (move.checked) {
				if (home.checked) {
					rpc.setMapStart(pos);
				}
				rpc.signalMovePosition(pos);
			} else {
				rpc.signalPosition(pos);
			}
			return false;
		},
		"set": deselectToken
	});
}
