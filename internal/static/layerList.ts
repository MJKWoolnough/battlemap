import {Int, LayerRPC, Layer, LayerFolder, FolderItems, FolderRPC} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {br, button, div, h1, input, label, span} from './lib/html.js';
import {noSort} from './lib/ordered.js';
import {showError, enterKey, colour2Hex, colour2RGBA, hex2Colour} from './misc.js';
import {Root, Folder, Item, windowOptions} from './folders.js';
import {Shell} from './windows.js';

let selectedLayer: ItemLayer | undefined, maskSelected = false, dragging: ItemLayer | FolderLayer | undefined, draggedName: HTMLSpanElement | undefined, dragOffset = 0, dragBase: HTMLElement, sh: Shell;

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
      },
      isLayer = (c: Layer | LayerFolder): c is Layer => (c as Layer).mask !== undefined,
      isFolder = (c: ItemLayer | FolderLayer): c is FolderLayer => (c as FolderLayer).open !== undefined,
      renameLayer = (self: ItemLayer | FolderLayer) => {
	const root = self.parent!.root,
	      shell = root.shell,
	      newName = autoFocus(input({"type": "text", "id": "renameLayer", "value": self.name, "onkeypress": enterKey})),
	      window = shell.addWindow("Move Item", windowOptions);
	return createHTML(window, {"class": "renameItem"}, [
		h1("Rename Layer"),
		label({"for": "renameLayer"}, "Name: "),
		newName,
		br(),
		button("Rename", {"onclick": () => shell.addLoading(window, (root.rpcFuncs as LayerRPC).renameLayer(self.getPath(), name!)).then(name => {
			self.name = name;
			self.nameElem.innerText = name;
			shell.removeWindow(window);
		}).catch(e => showError(newName, e))})
	]);
      };

function dragPlace(this: ItemLayer | FolderLayer, beforeAfter: boolean) {
	if (dragging!.id < 0 && this.parent !== dragging!.parent) {
		return;
	}
	const currPos = dragging!.parent!.children.indexOf(dragging!),
	      oldPath = dragging!.getPath();
	let pos: Int,
	    newPath: string;
	if (dragging!.id >= 0 && beforeAfter && isFolder(this) && this.open.open) {
		pos = 0;
		dragging!.parent!.children.splice(currPos, 1);
		this.children.unshift(dragging!);
		newPath = this.getPath();
		dragging!.parent = this;
	} else {
		pos = this.parent!.children.indexOf(this) + (beforeAfter ? 1 : 0);
		if (this.parent === dragging!.parent) {
			pos -= pos > currPos ? 1 : 0;
			if (pos === currPos) {
				dropFn();
				return;
			}
			this.parent!.children.splice(currPos, 1);
			this.parent!.children.splice(pos, 0, dragging!);
		} else {
			dragging!.parent!.children.splice(currPos, 1);
			this.parent!.children.splice(pos, 0, dragging!);
			dragging!.parent = this.parent;
		}
		newPath = (this.parent as FolderLayer).getPath();
	}
	sh.addLoading(null, (this.parent!.root.rpcFuncs as LayerRPC).moveLayer(oldPath, newPath + "/", pos)).catch(alert);
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
	mask: string;
	nameElem: HTMLSpanElement;
	constructor(parent: Folder, id: Int, name: string, hidden = false, mask = "") {
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
			this.node.insertBefore(span({"class": "layerMask", "onclick": () => {
				this.show();
				this.node.classList.add("selectedMask");
				maskSelected = true;
				(parent.root.rpcFuncs as LayerRPC).setLayerMask(this.getPath());
			}}), this.node.firstChild!.nextSibling);
			if (selectedLayer === undefined) {
				this.show();
			}
		}
		if (hidden) {
			this.node.classList.add("layerHidden");
		}
		this.node.insertBefore(span({"class" : "layerVisibility", "onclick":() => (parent.root.rpcFuncs as LayerRPC).setVisibility(this.getPath(), !this.node.classList.toggle("layerHidden"))}), this.node.firstChild);
		this.node.appendChild(div({"class": "dragBefore", "onmouseup": dragPlace.bind(this, false)}));
		this.node.appendChild(div({"class": "dragAfter", "onmouseup": dragPlace.bind(this, true)}));
		this.nameElem.addEventListener("mousedown", dragStart.bind(this));
	}
	show() {
		const rpcFuncs = (this.parent.root.rpcFuncs as LayerRPC);
		if (this.id === -1) { // Grid
			const details = rpcFuncs.getMapDetails(),
			      width = input({"type": "number", "min": "10", "max": "1000", "value": details.width.toString(), "id": "mapWidth"}),
			      height = input({"type": "number", "min": "10", "max": "1000", "value": details.height.toString(), "id": "mapHeight"}),
			      sqWidth = input({"type": "number", "min": "1", "max": "500", "value": details.square.toString(), "id": "mapSquareWidth"}),
			      sqColour = input({"type": "color", "id": "mapSquareColour", "value": colour2Hex(details.colour)}),
			      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": details.stroke.toString(), "id": "mapSquareLineWidth"}),
			      window = sh.addWindow("Edit Map", windowOptions);
			return createHTML(window, {"class": "mapAdd"}, [
				h1("Edit Map"),
				label({"for": "mapWidth"}, "Width: "),
				width,
				br(),
				label({"for": "mapHeight"}, "Height: "),
				height,
				br(),
				label({"for": "mapSquareWidth"}, "Square Size: "),
				sqWidth,
				br(),
				label({"for": "mapSquareColour"}, "Square Line Colour: "),
				sqColour,
				br(),
				label({"for": "mapSquareLineWidth"}, "Square Line Width: "),
				sqLineWidth,
				br(),
				button("Add", {"onclick": function(this: HTMLButtonElement) {
					sh.addLoading(this.parentNode as HTMLDivElement, rpcFuncs.setMapDetails({
						"width": parseInt(width.value),
						"height": parseInt(height.value),
						"square": parseInt(sqWidth.value),
						"colour": hex2Colour(sqColour.value),
						"stroke": parseInt(sqLineWidth.value)
					})).then(() => sh.removeWindow(this.parentNode as HTMLDivElement))
					.catch(e => showError(this, e));
				}})
			]);
		} else if (this.id === -2) { // Light
			const colour = rpcFuncs.getLightColour(),
			      checkboard = div({"class": "checkboard"}),
			      preview = checkboard.appendChild(div({"style": `background-color: ${colour2RGBA(colour)}`})),
			      updatePreview = () => {
				const colour = hex2Colour(colourInput.value);
				colour.a = parseInt(alphaInput.value);
				preview.style.setProperty("background-color", colour2RGBA(colour));
			      },
			      colourInput = input({"id": "colourPick", "type": "color", "value": colour2Hex(colour), "onchange": updatePreview}),
			      alphaInput = input({"id": "alphaPick", "type": "range", "min": "0", "max": "255", "step": "1","value": colour.a.toString(), "oninput": updatePreview}),
			      window = sh.addWindow("Change Light Colour", windowOptions);
			return createHTML(window, {"class": "lightChange"}, [
				h1("Change Light Colour"),
				checkboard,
				label({"for": "colourPick"}, "Colour: "),
				colourInput,
				br(),
				label({"for": "alphaPick"}, "Alpha: "),
				alphaInput,
				br(),
				button("Update", {"onclick": function(this: HTMLButtonElement) {
					const colour = hex2Colour(colourInput.value);
					colour.a = parseInt(alphaInput.value);
					sh.addLoading(this.parentNode as HTMLDivElement, rpcFuncs.setLightColour(colour))
					.then(() => sh.removeWindow(this.parentNode as HTMLDivElement))
					.catch(e => showError(this, e));
				}})
			]);
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
			rpcFuncs.setLayer(this.getPath());
		}
	}
	rename() {
		return renameLayer(this);
	}
}

class FolderLayer extends Folder {
	id: Int;
	hidden: boolean;
	nameElem: HTMLSpanElement;
	open: HTMLDetailsElement;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems, hidden = false) {
		super(root, parent, name, {folders: {}, items: {}});
		this.hidden = hidden;
		const lf = children as LayerFolder;
		this.open = this.node.firstChild as HTMLDetailsElement;
		this.nameElem = this.node.firstChild!.firstChild!.firstChild as HTMLSpanElement;
		if (hidden) {
			this.node.classList.add("layerHidden");
		}
		if (lf.id === undefined) {
			lf.id = 1;
		}
		this.id = lf.id;
		if (lf.children) {
			lf.children.forEach(c => this.children.push(isLayer(c) ? new ItemLayer(this, c.id, c.name, c.hidden, c.mask) : new FolderLayer(root, this, c.name, c as LayerFolder, c.hidden)));
		}
		if (lf.id > 0) {
			this.node.classList.add("layerFolder");
			this.node.firstChild!.firstChild!.insertBefore(span({"class" : "layerVisibility", "onclick": () => (root.rpcFuncs as LayerRPC).setVisibility(this.getPath(), !this.node.classList.toggle("layerHidden"))}), this.node.firstChild!.firstChild!.firstChild);
			this.node.appendChild(div({"class": "dragBefore", "onmouseup": dragPlace.bind(this, false)}));
			this.node.appendChild(div({"class": "dragAfter", "onmouseup": dragPlace.bind(this, true)}));
			this.nameElem.addEventListener("mousedown", (e: MouseEvent) => {
				if (this.open.open) {
					return;
				}
				dragStart.call(this, e)
			});
			this.node.insertBefore(div(Array.from(this.node.childNodes).filter(e => !(e instanceof HTMLUListElement || e instanceof HTMLInputElement))), this.node.lastChild);
		}
	}
	get sorter() {
		return noSort;
	}
	rename() {
		return renameLayer(this);
	}
}

export default function(shell: Shell, base: HTMLElement, mapChange: (fn: (rpc: LayerRPC) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	dragBase = base;
	sh = shell;
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
					button("Add Layer", {"onclick": () => shell.addLoading(window, rpc.newLayer(name.value)).then(name => {
						list.addItem(1, name);
						shell.removeWindow(window);
					}).catch(e => showError(name, e))})
				]);
			}}),
			list.node
		]);
	}));
}
