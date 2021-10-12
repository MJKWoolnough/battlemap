import type {CancelFn} from './events.js';
import {br, button, div, input} from './lib/html.js';
import {svg, path, title} from './lib/svg.js';
import {addTool} from './tools.js';
import {deselectToken, labels} from './shared.js';
import {autosnap} from './settings.js';
import {keyEvent} from './events.js';
import lang from './language.js';

const opaque = input({"name": "maskColour", "type": "radio", "class": "settings_ticker", "checked": true}),
      transparent = input({"name": "maskColour", "type": "radio", "class": "settings_ticker", "checked": true}),
      rectangle = input({"name": "maskShape", "type": "radio", "class": "settings_ticker", "checked": true}),
      ellipse = input({"type": "radio", "name": "maskShape", "class": "settings_ticker"}),
      poly = input({"type": "radio", "name": "maskShape", "class": "settings_ticker"}),
      snap = input({"type": "checkbox", "class": "settings_ticker", "checked": autosnap.value}),
      shiftSnap = () => snap.click();

let cancelShift: CancelFn | null = null;

addTool({
	"name": lang["TOOL_MASK"],
	"icon": svg({"viewBox": "0 0 60 50"}, [title(lang["TOOL_MASK"]), path({"d": "M0,0 Q30,15 60,0 Q30,100 0,0 M32,20 q9,-10 18,0 q-9,-3 -18,0 M10,20 q9,-10 18,0 q-9,-3 -18,0 M20,35 q10,5 20,0 q-10,10 -20,0", "stroke": "none", "fill": "currentColor", "fill-rule": "evenodd"})]),
	"options": div([
		labels(`${lang["TOOL_MASK_OPAQUE"]}: `, opaque, false),
		br(),
		labels(`${lang["TOOL_MASK_TRANSPARENT"]}: `, transparent, false),
		br(),
		labels(`${lang["TOOL_DRAW_RECT"]}: `, rectangle, false),
		br(),
		labels(`${lang["TOOL_DRAW_ELLIPSE"]}: `, ellipse, false),
		br(),
		labels(`${lang["TOOL_DRAW_POLYGON"]}: `, poly, false),
		br(),
		labels(`${lang["TOOL_DRAW_SNAP"]}: `, snap, false),
		br(),
		button(lang["TOOL_MASK_CLEAR"])
	]),
	"set": () => {
		deselectToken();
		cancelShift = keyEvent("Shift", shiftSnap, shiftSnap, true);
	},
	"unset": () => cancelShift?.(true)
});
