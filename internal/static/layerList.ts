import {Int, RPC, LayerType, Layer, LayerFolder, FolderItems, FolderRPC} from './types.js';
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
	id: Int;
	hidden: boolean = false;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, {folders: {}, items: {}});
		const lf = children as LayerFolder;
		this.id = lf.id;
		lf.children.forEach(c => {
			if ((c as Layer).mask !== undefined) {
				const i = new ItemLayer(this, c.id, c.name);
				this.children.push(i);
				i.hidden = c.hidden;
				i.mask = (c as Layer).mask;
			} else {
				const f = new FolderLayer(root, this, c.name, c as LayerFolder);
				this.children.push(f);
				f.hidden = c.hidden;
			}
		});
	}
	get sorter() {
		return noSort;
	}
}

export default function(rpc: RPC, overlay: LayerType, base: Node, mapChange: (fn: (layers: LayerFolder) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	mapChange((layers: LayerFolder) => {
		const list = new Root(layers, "Layer", {} as FolderRPC, overlay, ItemLayer, FolderLayer);
		createHTML(clearElement(base), {"id": "layerList"}, [
			button("Add Layer", {"onclick": () => {
				const name = input({"id": "layerName", "onkeypress": enterKey});
				createHTML(overlay.addLayer(), {"id": "layerAdd"}, [
					h1("Add Layer"),
					label({"for": "layerName"}, "Layer Name"),
					name,
					br(),
					button("Add Layer", {"onclick": () => overlay.loading(rpc.addLayer(name.value)).then(id => {
						list.addItem(id, name.value);
						// TODO: send new layer to map
						overlay.removeLayer();
					}).catch(e => showError(name, e))}),
					button("Cancel", {"onclick": () => overlay.removeLayer()})
				]);
			}}),
			list.html
		]);
	});
}
