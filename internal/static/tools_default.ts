import {createSVG, svg, path, title} from './lib/svg.js';
import {scrollAmount} from './settings.js';
import {globals} from './shared.js';
import {panZoom, zoom} from './map.js';
import lang from './language.js';

const defaultMapMouseWheel = (e: WheelEvent) => {
	e.preventDefault();
	if (e.ctrlKey) {
		zoom(Math.sign(e.deltaY) * 0.95, e.clientX, e.clientY);
	} else {
		const amount = scrollAmount.value || 100;
		createSVG(globals.root, {"style": {"left": (panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount) + "px", "top": (panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount) + "px"}});
	}
      },
      noMouseFn = function (this: SVGElement, _: MouseEvent) {};

export default {
	"name": lang["TOOL_DEFAULT"],
	"icon": svg({"viewBox": "0 0 20 20"}, [title(lang["TOOL_DEFAULT"]), path({"d": "M1,1 L20,20 M1,10 V1 H10", "fill": "none", "stroke": "currentColor", "stroke-width": 2})]),
	"tokenMouseDown": noMouseFn,
	"mapMouseDown": noMouseFn,
	"tokenMouseContext": noMouseFn,
	"mapMouseContext": noMouseFn,
	"tokenMouseWheel": defaultMapMouseWheel,
	"mapMouseWheel": defaultMapMouseWheel,
	"tokenMouseOver": noMouseFn,
	"mapMouseOver": noMouseFn
};
