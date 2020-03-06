import {Int, RPC, LayerFolder} from './types.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';
import {Shell} from './windows.js';

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layers: LayerFolder) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		const root = (mapData as Document).getElementsByTagName("svg")[0],
		      layers = new Map<Int, string>();
		let layerNum = 0;
		setLayers({"id": 0, "name": "", "hidden": false,  "folders": {}, "items": {}, "children": Array.from((root.lastChild!).childNodes).filter(e => e.nodeName === "g").map(e => {
			const g = e as SVGGElement,
			      idStr = g.getAttribute("id")!;
			let id: Int;
			switch (idStr) {
			case "Grid":
				id = -1;
				break;
			case "Light":
				id = -2;
				break;
			default:
				id = ++layerNum;
			}
			layers.set(id, g.getAttribute("id")!);
			return {"id": id, "name": g.getAttribute("data-name")!, "hidden": g.getAttribute("visibility") === "hidden", "mask": parseInt(g.getAttribute("mask")!), folders: {}, items: {}, children: []};
		})});
		base.appendChild(root);
	}));
}
