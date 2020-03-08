import {Int, RPC, LayerFolder} from './types.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';
import {Shell} from './windows.js';

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layers: LayerFolder) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		let layerNum = 0;
		const root = (mapData as Document).getElementsByTagName("svg")[0],
		      layers = new Map<Int, string>(),
		      processLayers = (node: SVGGElement): LayerFolder => {
			const idStr = node.getAttribute("id") || "";
			let id: Int;
			switch (idStr) {
			case "Grid":
				id = -1;
				break;
			case "Light":
				id = -2;
				break;
			default:
				id = layerNum++;
			}
			layers.set(id, idStr);
			const layer = {"id": id, "name": node.getAttribute("data-name") || `Layer ${id}`, "hidden": node.getAttribute("visibility") === "hidden", "mask": parseInt(node.getAttribute("mask")!), folders: {}, items: {}, children: []};
			if (node.firstChild && node.firstChild.nodeName === "g") {
				(Array.from(node.childNodes).filter(e => e instanceof SVGGElement) as SVGGElement[]).map(processLayers);
			}
			return layer;
		      };
		setLayers(processLayers(root.lastChild as SVGGElement));
		base.appendChild(root);
	}));
}
