import {Int, RPC, LayerType, MapLayer} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, div, h1, input, label, li, span, ul} from './lib/dom.js';
import {showError, enterKey} from './misc.js';
import {sortHTML, noSort} from './lib/ordered.js';

class LayerList {
	list = sortHTML<LayerItem>(ul(), noSort);
	rpc: RPC;
	overlay: LayerType;
	constructor(rpc: RPC, overlay: LayerType) {
		this.rpc = rpc;
		this.overlay = overlay;
	}
	addLayer(l: MapLayer) {
		this.list.push(new LayerItem(l));
	}
	get html() {
		return this.list.html;
	}
}

class LayerItem {
	html: HTMLElement;
	id: string;
	name: string;
	constructor(l: MapLayer) {
		this.id = l.id;
		this.name = l.name;
		this.html = li(l.name);
	}
}


export default function(rpc: RPC, overlay: LayerType, base: Node, mapChange: (fn: (layers: MapLayer[]) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	mapChange((layers: MapLayer[]) => {
		const list = new LayerList(rpc, overlay);
		layers.forEach(l => list.addLayer(l));
		createHTML(clearElement(base), {"id": "layerList"}, [
			button("Add Layer", {"onclick": () => {

			}}),
			list.html
		]);
	});
}
