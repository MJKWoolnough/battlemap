import {Int, RPC, LayerType, MapLayer} from './types.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';

export default function(rpc: RPC, overlay: LayerType, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layers: MapLayer[]) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		const root = (mapData as Document).getElementsByTagName("svg")[0];
		setLayers(Array.from((root.lastChild!).childNodes).filter(e => e.nodeName === "g").map(e => {
			const g = e as SVGGElement;
			return {"id": g.getAttribute("id")!, "name": g.getAttribute("data-name")!};
		}));
		base.appendChild(root);
	}))
}
