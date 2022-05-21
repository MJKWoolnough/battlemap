import {amendNode} from '../lib/dom.js';
import {br, div, input} from '../lib/html.js';
import {circle, svg} from '../lib/svg.js';
import {language} from '../language.js';
import {screen2Grid, showSignal} from '../map.js';
import {deselectToken} from '../map_tokens.js';
import {isAdmin, rpc} from '../rpc.js';
import {labels} from '../shared.js';
import {addTool} from '../tools.js';

if (isAdmin) {
	const defaultLanguage = {
		"HOME": "Set Map Start Location",
		"MOVE": "Move User Map",
		"TITLE": "Signal",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		      "en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      move = input({"type": "checkbox", "class": "settings_ticker", "onchange": function(this: HTMLInputElement) {
		      amendNode(home, {"disabled": !this.checked});
	      }}),
	      home = input({"type": "checkbox", "class": "settings_ticker", "disabled": true});
	addTool({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 100 100", "fill": "none", "stroke": "currentColor", "stroke-width": 3}, [
			circle({"cx": 50, "cy": 50, "r": 48}),
			circle({"cx": 50, "cy": 50, "r": 38})
		]),
		"options": div([
			labels(move, `${lang["MOVE"]}: `),
			br(),
			labels(home, `${lang["HOME"]}: `)
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
