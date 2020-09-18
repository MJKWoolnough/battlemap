import {RPC, LayerRPC} from './types.js';
import {div} from './lib/html.js';
import {svg, g, line, path} from './lib/svg.js';
import {SVGToken, globals} from './map.js';
import {mapLayersReceive, handleError} from './misc.js';
import {defaultMouseWheel, panZoom} from './tools_default.js';
import {addTool} from './tools.js';

let ml: LayerRPC;
mapLayersReceive(l => ml = l);

const startDrag = function(this: SVGElement, e: MouseEvent, rpc: RPC) {
	e.preventDefault();
	e.stopPropagation();
	const ox = e.clientX, oy = e.clientY;
	let dx = 0, dy = 0;
	const {selected: {layer: selectedLayer}, deselectToken, undo} = globals;
	if (!selectedLayer) {
		return;
	}
	const snap = selectedLayer.tokens.some(t => t.snap),
	      sq = snap ? ml.getMapDetails().gridSize : 1,
	      mover = (e: MouseEvent) => {
		dx = (e.clientX - ox) / panZoom.zoom;
		dy = (e.clientY - oy) / panZoom.zoom;
		if (snap) {
			dx = Math.round(dx / sq) * sq;
			dy = Math.round(dy / sq) * sq;
		}
		selectedLayer.node.setAttribute("transform", `translate(${dx}, ${dy})`);
	      },
	      mouseUp = (e: MouseEvent) => {
		if (e.button !== 0) {
			return;
		}
		this.removeEventListener("mousemove", mover);
		this.removeEventListener("mouseup", mouseUp);
		selectedLayer.node.removeAttribute("transform");
		const doIt = () => {
			dx = Math.round(dx);
			dy = Math.round(dy);
			(selectedLayer.tokens as SVGToken[]).forEach(t => {
				t.x += dx;
				t.y += dy;
				t.updateNode();
			});
			rpc.shiftLayer(selectedLayer.path, dx, dy).catch(handleError);
			return () => {
				(selectedLayer.tokens as SVGToken[]).forEach(t => {
					t.x -= dx;
					t.y -= dy;
					t.updateNode();
				});
				rpc.shiftLayer(selectedLayer.path, -dx, -dy).catch(handleError);
				return doIt;
			};
		};
		undo.add(doIt);
	      };
	deselectToken();
	this.addEventListener("mousemove", mover);
	this.addEventListener("mouseup", mouseUp);
      },
      mouseCursor = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	this.style.setProperty("cursor", "move");
	this.addEventListener("mouseout", () => this.style.removeProperty("cursor"), {"once": true});
      };

addTool({
	"name": "Move All",
	"icon": svg({"viewBox": "0 0 22 22", "style": "fill: currentColor"}, [
		g({"stroke-width": 1, "style": "stroke: currentColor", "stroke-linecap": "round"}, [
			line({"x1": 11, "y1": 6, "x2": 11, "y2": 16}),
			line({"x1": 6, "y1": 11, "x2": 16, "y2": 11}),
		]),
		path({"d": "M11,0 L6,5 L16,5 Z M0,11 L5,6 L 5,16 Z M11,22 L6,17 L16,17 Z M22,11 L17,16 L17,6 Z"})
	]),
	"mapMouseOver": mouseCursor,
	"tokenMouseOver": mouseCursor,
	"mapMouseDown": startDrag,
	"tokenMouseDown": startDrag,
	"mapMouseWheel": defaultMouseWheel
});
