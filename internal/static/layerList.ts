import {Int, LayerRPC, Layer, LayerFolder, FolderItems, FolderRPC} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, h1, input, label, span} from './lib/dom.js';
import {showError, enterKey} from './misc.js';
import {SortHTML, noSort} from './lib/ordered.js';
import {Root, Folder, Item, windowOptions} from './folders.js';
import {Shell} from './windows.js';

class ItemLayer extends Item {
	hidden: boolean;
	mask: Int;
	constructor(parent: Folder, id: Int, name: string, hidden = false, mask: Int = 0) {
		super(parent, id, name);
		this.hidden = hidden;
		this.mask = mask;
		this.html.insertBefore(span("👁", Object.assign({"onclick": function(this: HTMLSpanElement) {
			(parent.root.rpcFuncs as LayerRPC).setVisibility(id, !this.classList.toggle("layerHidden"));
		}}, hidden ? {"class": "layerHidden"} : {})),  this.html.firstChild);
	}
	show() {
		(this.parent.root.rpcFuncs as LayerRPC).setLayer(this.id);
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
		this.html.insertBefore(span("👁", Object.assign({"onclick": function(this: HTMLSpanElement) {
			(root.rpcFuncs as LayerRPC).setVisibility(lf.id, !this.classList.toggle("layerHidden"));
		}}, hidden ? {"class": "layerHidden"} : {})),  this.html.firstChild);
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
