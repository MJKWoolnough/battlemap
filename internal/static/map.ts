import {Int, RPC, LayerType, LayerFolder} from './types.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';

export default function(rpc: RPC, overlay: LayerType, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layers: LayerFolder) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		const root = (mapData as Document).getElementsByTagName("svg")[0];
		setLayers({"id": "", "name": "", "hidden": false,  "folders": {}, "items": {}, "children": Array.from((root.lastChild!).childNodes).filter(e => e.nodeName === "g").map(e => {
			const g = e as SVGGElement;
			return {"id": g.getAttribute("id")!, "name": g.getAttribute("data-name")!, "hidden": g.getAttribute("visibility") === "hidden", "mask": parseInt(g.getAttribute("mask")!), folders: {}, items: {}, children: []};
		})});
		base.appendChild(root);
	}));
}
