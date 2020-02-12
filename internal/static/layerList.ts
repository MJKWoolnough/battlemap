import {Int, RPC, LayerType, MapLayer} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, div, h1, input, label, li, span, ul} from './lib/dom.js';
import {showError, enterKey} from './misc.js';
import {sortHTML} from './lib/ordered.js';

export default function(rpc: RPC, overlay: LayerType, base: Node, mapChange: (fn: (layers: MapLayer[]) => void) => void) {
	clearElement(base).appendChild(h1("No Map Selected"));
	mapChange((layers: MapLayer[]) => {

	});
}
