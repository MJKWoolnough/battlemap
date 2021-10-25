import {br, button, div, input} from './lib/html.js';
import {createSVG, svg, g, path, polygon, title} from './lib/svg.js';
import {addTool} from './tools.js';
import {deselectToken, globals, labels} from './shared.js';
import {autosnap} from './settings.js';
import {keyEvent} from './events.js';
import {shell} from './windows.js';
import {screen2Grid} from './map.js';
import {doMaskSet} from './map_fns.js';
import lang from './language.js';

const opaque = input({"name": "maskColour", "type": "radio", "class": "settings_ticker", "checked": true}),
      transparent = input({"name": "maskColour", "type": "radio", "class": "settings_ticker"}),
      rectangle = input({"name": "maskShape", "type": "radio", "class": "settings_ticker", "checked": true}),
      ellipse = input({"type": "radio", "name": "maskShape", "class": "settings_ticker"}),
      poly = input({"type": "radio", "name": "maskShape", "class": "settings_ticker"}),
      snap = input({"type": "checkbox", "class": "settings_ticker", "checked": autosnap.value}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      marker = g(["5,0 16,0 10.5,5", "0,5 0,16 5,10.5", "5,21 16,21 10.5,16", "21,16 21,5 16,10.5"].map(points => polygon({points, "fill": "#000"}))),
	onmousemove = (e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
      },
      onmouseleave = () => {
	const {root} = globals;
	over = false;
	root.removeEventListener("mousemove", onmousemove);
	root.removeEventListener("mouseleave", onmouseleave);
	root.style.removeProperty("cursor");
	marker.remove();
      };

let over = false;

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
		button({"onclick": () => shell.confirm(lang["ARE_YOU_SURE"], lang["TOOL_MASK_CLEAR_CONFIRM"]).then(c => {
			if (c) {
				doMaskSet({"baseOpaque": opaque.checked, "masks": []});
			}
		})}, lang["TOOL_MASK_CLEAR"])
	]),
	"mapMouseOver": () => {
		if (!over) {
			over = true;
			createSVG(globals.root, {"style": {"cursor": "none"}, onmousemove, onmouseleave}, marker);
		}
		return false;
	},
	"mapMouse0": () => {
		return false;
	},
	"mapMouse2": () => {
		return false;
	},
	"set": () => {
		deselectToken();
		setupShiftSnap();
	},
	"unset": () => {
		cancelShiftSnap();
		onmouseleave();
	}
});
