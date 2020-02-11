import {Int, RPC, LayerType, MapLayer} from './types.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';

export default function(rpc: RPC, overlay: LayerType, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layers: MapLayer[]) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}`, {"response": "document"}).then(mapData => {
		const root = (mapData as Document).getElementsByTagName("svg")[0];
		setLayers(Array.from((root.lastChild as Node).childNodes).filter(e => e.nodeName === "g").map(e => {
			const g = e as SVGGElement,
			      tid = g.getAttribute("id") as string,
			      id = tid === "Light" ? -1 : tid === "Grid" ? -2 : parseInt(tid.slice(6));
			return {id, "name": g.getAttribute("data-name") as string};
		}));
		base.appendChild(root);
	}))
}
