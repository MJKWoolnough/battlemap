import type {Uint} from './types.js';
import {svg, path, title} from './lib/svg.js';
import lang from './language.js';

const noMouseFn = function (this: SVGElement, _: MouseEvent) {},
      noWheelFn = function (this: SVGElement, _: WheelEvent) {};

export default {
	"name": lang["TOOL_DEFAULT"],
	"icon": svg({"viewBox": "0 0 20 20"}, [title(lang["TOOL_DEFAULT"]), path({"d": "M1,1 L20,20 M1,10 V1 H10", "fill": "none", "stroke": "currentColor", "stroke-width": 2})]),
	"tokenMouseDown": function (this: SVGElement, _e: MouseEvent, _n: Uint) {},
	"mapMouseDown": noMouseFn,
	"tokenMouseContext": noMouseFn,
	"mapMouseContext": noMouseFn,
	"tokenMouseWheel": noWheelFn,
	"mapMouseWheel": noWheelFn,
	"tokenMouseOver": noMouseFn,
	"mapMouseOver": noMouseFn
};
