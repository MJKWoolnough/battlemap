import {RPC} from './types.js';
import {br, div, input, label} from './lib/html.js';
import {createSVG, circle, defs, g, path, polygon, radialGradient, stop, svg, use} from './lib/svg.js';
import {screen2Grid} from './misc.js';
import {addTool} from './tools.js';

const sunTool = input({"type": "radio", "name": "lightTool", "id": "sunTool", "checked": true}),
      wallTool = input({"type": "radio", "name": "lightTool", "id": "wallTool"}),
      lightMarker = g([
	      defs(radialGradient({"id": "lightGrad"}, [
		      stop({"offset": "30%", "style": "stop-color: currentColor"}),
		      stop({"offset": "100%", "style": "stop-color: currentColor; stop-opacity: 0"})
	      ])),
	      circle({"cx": 20, "cy": 20, "r": 20, "fill": "url(#lightGrad)"})
      ]),
      wallMarker = g([
	      polygon({"points": "5,0 16,0 10.5,5", "fill": "#000"}),
	      polygon({"points": "0,5 0,16 5,10.5", "fill": "#000"}),
	      polygon({"points": "5,21 16,21 10.5,16", "fill": "#000"}),
	      polygon({"points": "21,16 21,5 16,10.5", "fill": "#000"})
      ]),
      mouseOver = function(this: SVGElement, e: MouseEvent) {
	const marker = sunTool.checked ? lightMarker : wallMarker,
	      offset = sunTool.checked ? 20 : 10,
	      onmousemove = (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, false);
		createSVG(marker, {"transform": `translate(${x - offset}, ${y - offset})`});
	};
	createSVG(this, {"style": "cursor: none", "1onmouseleave": () => {
		marker.remove();
		this.removeEventListener("mousemove", onmousemove);
		this.style.removeProperty("cursor");
	}, onmousemove}, marker);
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
