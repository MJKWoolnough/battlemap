import {Int, LayerRPC, Layer, LayerFolder, FolderItems, FolderRPC} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/html.js';
import {br, button, div, h1, input, label, span} from './lib/dom.js';
import {noSort} from './lib/ordered.js';
import {showError, enterKey} from './misc.js';
import {Root, Folder, Item, windowOptions} from './folders.js';
import {Shell} from './windows.js';

let selectedLayer: ItemLayer | undefined, maskSelected = false, dragging: ItemLayer | FolderLayer | undefined, draggedName: HTMLSpanElement | undefined, dragOffset = 0, dragBase: HTMLElement;

const dragFn = (e: MouseEvent) => {
	if (!draggedName) {
		dragging!.node.classList.add("dragged");
		draggedName = document.body.appendChild(span(dragging!.name, {"class": "beingDragged"}));
		dragBase.classList.add("dragging");
	}
	draggedName!.style.setProperty("top", e.clientY + 1 + "px");
	draggedName!.style.setProperty("left", e.clientX + dragOffset + "px");
      },
      dropFn = () => {
	dragging!.node.classList.remove("dragged");
	dragging = undefined;
	if (draggedName) {
		document.body.removeChild(draggedName!);
	}
	draggedName = undefined;
	document.body.removeEventListener("mousemove", dragFn);
	document.body.removeEventListener("mouseup", dropFn);
	dragBase.classList.remove("dragging", "draggingSpecial");
      };

function dragPlace(this: ItemLayer | FolderLayer, beforeAfter: boolean) {
	if (dragging!.id < 0 && this.parent !== dragging!.parent) {
		return;
	}
	let pos = this.parent!.children.indexOf(this) + (beforeAfter ? 1 : 0);
	const currPos = dragging!.parent!.children.indexOf(dragging!);
	if (this.parent === dragging!.parent) {
		pos = pos > currPos ? pos - 1 : pos;
		if (pos !== currPos) {
			this.parent!.children.splice(currPos, 1);
			this.parent!.children.splice(pos, 0, dragging!);
		}
	} else {
		dragging!.parent!.children.splice(currPos, 1);
		this.parent!.children.splice(pos, 0, dragging!);
	}
	(this.parent!.root.rpcFuncs as LayerRPC).moveLayer(dragging!.getPath(), (this.parent as FolderLayer).getPath(), pos);
	dropFn();
}

function dragStart(this: ItemLayer | FolderLayer, e: MouseEvent) {
	if (dragging) {
		return;
	}
	if (this.id < 0) {
		dragBase.classList.add("draggingSpecial");
	}
	dragOffset = this.nameElem.offsetLeft - e.clientX;
	for (let e = this.nameElem.offsetParent; e instanceof HTMLElement; e = e.offsetParent) {
		dragOffset += e.offsetLeft!;
	}
	dragging = this;
	document.body.addEventListener("mousemove", dragFn);
	document.body.addEventListener("mouseup", dropFn);
}

class ItemLayer extends Item {
	hidden: boolean;
	mask: Int;
	nameElem: HTMLSpanElement;
	constructor(parent: Folder, id: Int, name: string, hidden = false, mask: Int = 0) {
		super(parent, id, name);
		this.hidden = hidden;
		this.mask = mask;
		this.nameElem = this.node.firstChild as HTMLSpanElement;
		if (id < 0) {
			this.node.removeChild(this.node.lastChild!);
			this.node.removeChild(this.node.lastChild!);
			this.node.removeChild(this.node.lastChild!);
		} else {
			this.node.removeChild(this.node.lastChild!.previousSibling!);
			this.node.insertBefore(span("M", {"class": "layerMask", "onclick": () => {
				this.show();
				this.node.classList.add("selectedMask");
				maskSelected = true;
				(parent.root.rpcFuncs as LayerRPC).setLayerMask(this.getPath());
			}}), this.node.firstChild!.nextSibling);
		}
		this.node.insertBefore(span({"class" : "layerVisibility", "onclick":() => (parent.root.rpcFuncs as LayerRPC).setVisibility(id, !this.node.classList.toggle("layerHidden"))}), this.node.firstChild);
		this.node.appendChild(div({"class": "dragBefore", "onmouseup": dragPlace.bind(this, false)}));
		this.node.appendChild(div({"class": "dragAfter", "onmouseup": dragPlace.bind(this, true)}));
		this.nameElem.addEventListener("mousedown", dragStart.bind(this));
	}
	show() {
		if (this.id === -1) { // Grid
			// Show/Edit Grid properties
		} else if (this.id === -2) { // Light
			// Show/Edit Light properties
		} else {
			if (selectedLayer) {
				selectedLayer.node.classList.remove("selectedLayer");
				if (maskSelected) {
					selectedLayer.node.classList.remove("selectedMask");
				}
			}
			this.node.classList.add("selectedLayer");
			selectedLayer = this;
			maskSelected = false;
			(this.parent.root.rpcFuncs as LayerRPC).setLayer(this.getPath());
		}
	}
}

function isLayer(c: Layer | LayerFolder): c is Layer {
	return (c as Layer).mask !== undefined;
}

class FolderLayer extends Folder {
	id: Int;
	hidden: boolean;
	nameElem: HTMLLabelElement;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems, hidden = false) {
		super(root, parent, name, {folders: {}, items: {}});
		this.hidden = hidden;
		const lf = children as LayerFolder,
		      checkbox = this.node.firstChild as HTMLInputElement;
		this.id = lf.id;
		this.nameElem = this.node.firstChild!.nextSibling as HTMLLabelElement;
		if (lf.children) {
			lf.children.forEach(c => this.children.push(isLayer(c) ? new ItemLayer(this, c.id, c.name, c.hidden, c.mask) : new FolderLayer(root, this, c.name, c as LayerFolder, c.hidden)));
		}
		if (this.id > 0) {
			this.node.classList.add("layerFolder");
			this.node.insertBefore(span("👁", {"class" : "layerVisibility", "onclick": () => (root.rpcFuncs as LayerRPC).setVisibility(this.id, !this.node.classList.toggle("layerHidden"))}), this.node.firstChild);
			this.node.appendChild(div({"class": "dragBefore", "onmouseup": dragPlace.bind(this, false)}));
			this.node.appendChild(div({"class": "dragAfter", "onmouseup": dragPlace.bind(this, true)}));
			this.nameElem.addEventListener("mousedown", (e: MouseEvent) => {
				if (checkbox.checked) {
					return;
				}
				dragStart.call(this, e)
			});
		}
	}
	get sorter() {
		return noSort;
	}
}

export default function(shell: Shell, base: HTMLElement, mapChange: (fn: (rpc: LayerRPC) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	dragBase = base;
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
				const name = autoFocus(input({"id": "layerName", "onkeypress": enterKey})),
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
			list.node
		]);
	}));
}
