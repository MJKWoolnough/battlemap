import {Int, LayerRPC, Layer, LayerFolder, FolderItems, FolderRPC} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, h1, input, label, span} from './lib/dom.js';
import {showError, enterKey} from './misc.js';
import {SortHTML, noSort} from './lib/ordered.js';
import {Root, Folder, Item, windowOptions} from './folders.js';
import {Shell} from './windows.js';

let selectedLayer: ItemLayer | undefined, maskSelected = false;

class ItemLayer extends Item {
	hidden: boolean;
	mask: Int;
	constructor(parent: Folder, id: Int, name: string, hidden = false, mask: Int = 0) {
		super(parent, id, name);
		this.hidden = hidden;
		this.mask = mask;
		if (id < 0) {
			this.html.removeChild(this.html.lastChild!);
			this.html.removeChild(this.html.lastChild!);
			this.html.removeChild(this.html.lastChild!);
		} else {
			this.html.removeChild(this.html.lastChild!.previousSibling!);
			this.html.insertBefore(span("M", {"class": "layerMask", "onclick": () => {
				this.show();
				this.html.classList.add("selectedMask");
				maskSelected = true;
				(parent.root.rpcFuncs as LayerRPC).setLayerMask(id);
			}}), this.html.firstChild!.nextSibling);
		}
		this.html.insertBefore(span("👁", {"class" : "layerVisibility", "onclick":() => (parent.root.rpcFuncs as LayerRPC).setVisibility(id, !this.html.classList.toggle("layerHidden"))}), this.html.firstChild);
	}
	show() {
		if (this.id === -1) { // Grid
			// Show/Edit Grid properties
		} else if (this.id === -2) { // Light
			// Show/Edit Light properties
		} else {
			if (selectedLayer) {
				selectedLayer.html.classList.remove("selectedLayer");
				if (maskSelected) {
					selectedLayer.html.classList.remove("selectedMask");
				}
			}
			this.html.classList.add("selectedLayer");
			selectedLayer = this;
			maskSelected = false;
			(this.parent.root.rpcFuncs as LayerRPC).setLayer(this.id);
		}
	}
}

function isLayer(c: Layer | LayerFolder): c is Layer {
	return (c as Layer).mask !== undefined;
}

class FolderLayer extends Folder {
	id: Int;
	hidden: boolean;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems, hidden = false) {
		super(root, parent, name, {folders: {}, items: {}});
		this.hidden = hidden;
		const lf = children as LayerFolder;
		this.id = lf.id;
		lf.children.forEach(c => this.children.push(isLayer(c) ? new ItemLayer(this, c.id, c.name, c.hidden, c.mask) : new FolderLayer(root, this, c.name, c as LayerFolder, c.hidden)));
		this.html.insertBefore(span("👁", {"class" : "layerVisibility", "onclick": () => (root.rpcFuncs as LayerRPC).setVisibility(this.id, !this.html.classList.toggle("layerHidden"))}), this.html.firstChild);
	}
	get sorter() {
		return noSort;
	}
}

export default function(shell: Shell, base: Node, mapChange: (fn: (rpc: LayerRPC) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	mapChange(rpc => rpc.list().then(layers => {
		selectedLayer = undefined;
		maskSelected = false;
		const list = new Root(layers, "Layer", rpc, shell, ItemLayer, FolderLayer);
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
