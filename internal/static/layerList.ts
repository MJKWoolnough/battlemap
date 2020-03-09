import {Int, LayerRPC, Layer, LayerFolder, FolderItems, FolderRPC} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, div, h1, input, label, li, span, ul} from './lib/dom.js';
import {showError, enterKey} from './misc.js';
import {SortHTML, noSort} from './lib/ordered.js';
import {Root, Folder, Item, windowOptions} from './folders.js';
import {Shell} from './windows.js';

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

export default function(shell: Shell, base: Node, mapChange: (fn: (rpc: LayerRPC) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	mapChange(rpc => rpc.list().then(layers => {
		const list = new Root(layers, "Layer", {} as FolderRPC, shell, ItemLayer, FolderLayer);
		rpc.waitLayerSetVisible().then(id => {

		});
		rpc.waitLayerSetInvisible().then(id => {

		});
		rpc.waitLayerAddMask().then(id => {

		});
		rpc.waitLayerRemoveMask().then(id => {

		});
		createHTML(clearElement(base), {"id": "layerList"}, [
			button("Add Layer", {"onclick": () => {
				const name = input({"id": "layerName", "onkeypress": enterKey}),
				      window = shell.addWindow("Add Layer", windowOptions);
				createHTML(window, {"id": "layerAdd"}, [
					h1("Add Layer"),
					label({"for": "layerName"}, "Layer Name"),
					name,
					br(),
					button("Add Layer", {"onclick": () => shell.addLoading(window, rpc.newLayer(name.value)).then(id => {
						list.addItem(id, name.value);
						shell.removeWindow(window);
					}).catch(e => showError(name, e))})
				]);
			}}),
			list.html
		]);
	}));
}
