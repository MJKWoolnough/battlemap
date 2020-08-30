import {RPC} from './types.js';
import {br, div, input, label} from './lib/html.js';
import {svg, defs, g, path, use} from './lib/svg.js';
import {addTool} from './tools.js';

const sunTool = input({"type": "radio", "name": "lightTool", "id": "sunTool", "checked": true}),
      wallTool = input({"type": "radio", "name": "lightTool", "id": "wallTool"}),
      mouseOver = function(this: SVGElement, e: MouseEvent) {
	if (sunTool.checked) {
	} else {
	}
      },
      mouseDown = function(this: SVGElement, e: MouseEvent, rpc: RPC) {
	if (sunTool.checked) {
	} else {
	}
      };

addTool({
	"name": "Light Layer",
	"icon": svg({"viewBox": "0 0 44 75"}, [
		defs(path({"id": "c", "d": "M12,61 q-2,2 0,4 q10,3 20,0 q2,-2 0,-4", "stroke-width": 1})),
		g({"style": "stroke: currentColor", "fill": "none", "stroke-linejoin": "round"}, [
			path({"d": "M12,61 c0,-20 -30,-58 10,-60 c40,2 10,40 10,60 q-10,3 -20,0 Z", "stroke-width": 2}),
			use({"href": "#c"}),
			use({"href": "#c", "y": 4}),
			use({"href": "#c", "y": 8}),
		])
	]),
	"options": div([
		label({"for": "sunTool"}, "Position Sun/Moon: "),
		sunTool,
		br(),
		label({"for": "wallTool"}, "Wall Tool: "),
		wallTool
	]),
	"mapMouseOver": mouseOver,
	"mapMouseDown": mouseDown
});
