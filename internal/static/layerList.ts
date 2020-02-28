import {Int, RPC, LayerType, Layer, LayerFolder, FolderItems} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, div, h1, input, label, li, span, ul} from './lib/dom.js';
import {showError, enterKey} from './misc.js';
import {SortHTML, noSort} from './lib/ordered.js';
import {Root, Folder, Item} from './folders.js';

class ItemLayer extends Item {
	hidden: boolean = false;
	mask: Int = 0;
}

class FolderLayer extends Folder {
	hidden: boolean = false;
	mask: Int = 0;
	constructor(root: Root, parent: Folder | null, name: string, folders: Record<string, FolderItems>, items: Record<string, Int>) {
		super(root, parent, name, {folders: {}, items: {}});
	}
}

export default function(rpc: RPC, overlay: LayerType, base: Node, mapChange: (fn: (layers: LayerFolder) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	/*
	mapChange((layers: MapLayer[]) => {
		const list = new LayerList(rpc, overlay);
		layers.forEach(l => list.addLayer(l));
		createHTML(clearElement(base), {"id": "layerList"}, [
			button("Add Layer", {"onclick": () => {
				const name = input({"id": "layerName", "onkeypress": enterKey});
				createHTML(overlay.addLayer(), {"id": "layerAdd"}, [
					h1("Add Layer"),
					label({"for": "layerName"}, "Layer Name"),
					name,
					br(),
					button("Add Layer", {"onclick": () => overlay.loading(rpc.addLayer(name.value)).then(id => {
						list.addLayer({id, "name": name.value, "hidden": false, "mask": 0});
						// TODO: send new layer to map
						overlay.removeLayer();
					}).catch(e => showError(name, e))}),
					button("Cancel", {"onclick": () => overlay.removeLayer()})
				]);
			}}),
			list.html
		]);
	});
	*/
}
