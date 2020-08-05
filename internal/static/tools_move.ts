import {RPC} from './types.js';
import {SVGToken} from './map.js';
import {requestSelected} from './comms.js';
import {handleError} from './misc.js';

const startDrag = function(this: SVGElement, e: MouseEvent, rpc: RPC) {
	e.preventDefault();
	const ox = e.clientX, oy = e.clientY;
	let dx = 0, dy = 0;
	const {layer, layerPath, deselectToken} = requestSelected(),
	      mover = (e: MouseEvent) => {
		dx = e.clientX - ox;
		dy = e.clientY - oy;
		layer!.node.setAttribute("transform", `translate(${dx}, ${dy})`);
	      };
	if (!layer) {
		return;
	}
	deselectToken();
	this.addEventListener("mousemove", mover);
	this.addEventListener("mouseup", () => {
		this.removeEventListener("mousemove", mover);
		layer.node.removeAttribute("transform");
		(layer.tokens as SVGToken[]).forEach(t => {
			t.x += dx;
			t.y += dy;
			t.updateNode();
		});
		rpc.shiftLayer(layerPath, dx, dy).catch(handleError);
	}, {"once": true});
      },
      mouseCursor = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	this.style.setProperty("cursor", "move");
	this.addEventListener("mouseout", () => this.style.removeProperty("cursor"), {"once": true});
      };

export default Object.freeze({
	"name": "Move All",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAFYAAABVCAMAAADkHONrAAAAS1BMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADmYDp0AAAAGXRSTlMAAk2Bnv/t5uLo7PH0/vf6/PL1/UyAS8AEV9+5ZgAAAe5JREFUeAHN2Y2KqzAUBGCjnWq1qVVjet//SS8gA7thgIQBusN/gK+HpJBzTFeb0A996LwI9QbgJlxbla6v3oXrq6Oo11cnQLiu+gBcV6gz4LpCXQDXFeoTTHTcQn0BkabvUl2JefUW6pug71KlIqLdOpVZt2U/bJeqiOtS3X23pVa6vuq7PeqS2tihkj3/RLUhnzXJof5CDulM1UeReXBVf4Ksfk392AnpalUdRQKyZrUrVJwS0KvSFWo7K1yhtrPCFWo7S1erBktXqAZbuEJtZ3cg0lWqUe2brlANFitdoRosXnQLNXosnnSl2s6y9VnoarWd3S5gpivVdpat6oMuTwsWy3YC0+VSLdmQzt/5AJ9iKQWyOMCMAPrrMhR7m1CRTPZn7sDQDcAdjMeyLlY7gjnIFnev3oTMTSjCvZ24sLcfmVLLsWux2AiqdOdrcXNYqsXoFYHVYKnq4aud1Srdl8dSFQOYwQqV7ttkqYohbP/+zev3CX5X880ezO8Yv9Df+t24bvLt2SHkHOxJp3Yw+8dpq+6TakJd+q4pZyU7tLF+tf4HBds11Ap316rrGqpwj33ZVkulqxMdVXfUelYyXfYoVE2XdhRzkunKKcl0mcVXhTv7qnAfvircyVeFO/qq/wTlP5iZrq96j5H/AbtSR3ts3avHAAAAAElFTkSuQmCC",
	"reset": () => {},
	"mapMouseOver": mouseCursor,
	"tokenMouseOver": mouseCursor,
	"mapMouseDown": startDrag,
	"tokenMouseDown": startDrag
});
