import {RPC, LayerRPC} from './types.js';
import {div} from './lib/html.js';
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
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAFYAAABVCAMAAADkHONrAAAAS1BMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADmYDp0AAAAGXRSTlMAAk2Bnv/t5uLo7PH0/vf6/PL1/UyAS8AEV9+5ZgAAAe5JREFUeAHN2Y2KqzAUBGCjnWq1qVVjet//SS8gA7thgIQBusN/gK+HpJBzTFeb0A996LwI9QbgJlxbla6v3oXrq6Oo11cnQLiu+gBcV6gz4LpCXQDXFeoTTHTcQn0BkabvUl2JefUW6pug71KlIqLdOpVZt2U/bJeqiOtS3X23pVa6vuq7PeqS2tihkj3/RLUhnzXJof5CDulM1UeReXBVf4Ksfk392AnpalUdRQKyZrUrVJwS0KvSFWo7K1yhtrPCFWo7S1erBktXqAZbuEJtZ3cg0lWqUe2brlANFitdoRosXnQLNXosnnSl2s6y9VnoarWd3S5gpivVdpat6oMuTwsWy3YC0+VSLdmQzt/5AJ9iKQWyOMCMAPrrMhR7m1CRTPZn7sDQDcAdjMeyLlY7gjnIFnev3oTMTSjCvZ24sLcfmVLLsWux2AiqdOdrcXNYqsXoFYHVYKnq4aud1Srdl8dSFQOYwQqV7ttkqYohbP/+zev3CX5X880ezO8Yv9Df+t24bvLt2SHkHOxJp3Yw+8dpq+6TakJd+q4pZyU7tLF+tf4HBds11Ap316rrGqpwj33ZVkulqxMdVXfUelYyXfYoVE2XdhRzkunKKcl0mcVXhTv7qnAfvircyVeFO/qq/wTlP5iZrq96j5H/AbtSR3ts3avHAAAAAElFTkSuQmCC",
	"options": div("There are no options for this tool"),
	"mapMouseOver": mouseCursor,
	"tokenMouseOver": mouseCursor,
	"mapMouseDown": startDrag,
	"tokenMouseDown": startDrag
});
