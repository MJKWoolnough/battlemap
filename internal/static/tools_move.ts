import {RPC, LayerRPC} from './types.js';
import {div} from './lib/html.js';
import {svg, line, polygon} from './lib/svg.js';
import {SVGToken} from './map.js';
import {requestSelected, requestMapUndo, mapLayersReceive} from './comms.js';
import {handleError} from './misc.js';
import {panZoom} from './tools_default.js';

let ml: LayerRPC;
mapLayersReceive(l => ml = l);

const startDrag = function(this: SVGElement, e: MouseEvent, rpc: RPC) {
	e.preventDefault();
	e.stopPropagation();
	const ox = e.clientX, oy = e.clientY;
	let dx = 0, dy = 0;
	const {layer, layerPath, deselectToken} = requestSelected();
	if (!layer) {
		return;
	}
	const snap = layer.tokens.some(t => t.snap),
	      sq = snap ? ml.getMapDetails().gridSize : 1,
	      mover = (e: MouseEvent) => {
		dx = (e.clientX - ox) / panZoom.zoom;
		dy = (e.clientY - oy) / panZoom.zoom;
		if (snap) {
			dx = Math.round(dx / sq) * sq;
			dy = Math.round(dy / sq) * sq;
		}
		layer.node.setAttribute("transform", `translate(${dx}, ${dy})`);
	      },
	      mouseUp = (e: MouseEvent) => {
		if (e.button !== 0) {
			return;
		}
		this.removeEventListener("mousemove", mover);
		this.removeEventListener("mouseup", mouseUp);
		layer.node.removeAttribute("transform");
		const doIt = () => {
			dx = Math.round(dx);
			dy = Math.round(dy);
			(layer.tokens as SVGToken[]).forEach(t => {
				t.x += dx;
				t.y += dy;
				t.updateNode();
			});
			rpc.shiftLayer(layerPath, dx, dy).catch(handleError);
			return () => {
				(layer.tokens as SVGToken[]).forEach(t => {
					t.x -= dx;
					t.y -= dy;
					t.updateNode();
				});
				rpc.shiftLayer(layerPath, -dx, -dy).catch(handleError);
				return doIt;
			};
		};
		requestMapUndo().add(doIt);
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

export default Object.freeze({
	"name": "Move All",
	"icon": svg({"viewBox": "0 0 22 22", "style": "background-color: transparent"}, [
		line({"x1": 11, "y1": 6, "x2": 11, "y2": 16, "stroke-width": 1, "stroke": "#000", "stroke-linecap": "round"}),
		line({"x1": 6, "y1": 11, "x2": 16, "y2": 11, "stroke-width": 1, "stroke": "#000", "stroke-linecap": "round"}),
		polygon({"points": "11,0 6,5 16,5"}),
		polygon({"points": "0,11 5,6 5,16"}),
		polygon({"points": "11,22 6,17 16,17"}),
		polygon({"points": "22,11 17,16 17,6"}),
	]),
	"mapMouseOver": mouseCursor,
	"tokenMouseOver": mouseCursor,
	"mapMouseDown": startDrag,
	"tokenMouseDown": startDrag
});
