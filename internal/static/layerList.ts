import {Int, LayerRPC, LayerTokens, LayerFolder, FolderItems} from './types.js';
import {Subscription} from './lib/inter.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {br, button, div, h1, input, label, span} from './lib/html.js';
import {noSort} from './lib/ordered.js';
import {handleError, enterKey, colour2Hex, colour2RGBA, hex2Colour} from './misc.js';
import {Root, Folder, Item} from './folders.js';
import {ShellElement, loadingWindow, windows} from './windows.js';

let selectedLayer: ItemLayer | undefined, dragging: ItemLayer | FolderLayer | undefined, draggedName: HTMLSpanElement | undefined, dragOffset = 0, dragBase: HTMLElement, sh: ShellElement;

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
	dragBase.classList.remove("dragging", "draggingSpecial");
      },
      isLayer = (c: LayerTokens | LayerFolder): c is LayerTokens => (c as LayerFolder).children === undefined,
      isFolder = (c: ItemLayer | FolderLayer): c is FolderLayer => (c as FolderLayer).open !== undefined,
      renameLayer = (self: ItemLayer | FolderLayer) => {
	const root = self.parent!.root,
	      shell = root.shell,
	      newName = autoFocus(input({"type": "text", "id": "renameLayer", "value": self.name, "onkeypress": enterKey})),
	      window = shell.appendChild(windows({"window-title": "Move Item"}));
	return createHTML(window, {"class": "renameItem"}, [
		h1("Rename Layer"),
		label({"for": "renameLayer"}, "Name: "),
		newName,
		br(),
		button("Rename", {"onclick": function(this: HTMLButtonElement) {
			this.setAttribute("disabled", "disabled");
			loadingWindow((root.rpcFuncs as LayerRPC).renameLayer(self.getPath(), name!), window).then(name => {
				self.name = name;
				self.nameElem.innerText = name;
				window.remove();
			})
			.catch(handleError)
			.finally(() => this.removeAttribute("disabled"));
		}})
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
	loadingWindow((this.parent!.root.rpcFuncs as LayerRPC).moveLayer(oldPath, newPath + "/", pos, currPos), sh).catch(handleError);
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
	document.body.addEventListener("mouseup", dropFn, {"once": true});
}

class ItemLayer extends Item {
	hidden: boolean;
	nameElem: HTMLSpanElement;
	constructor(parent: Folder, id: Int, name: string, hidden = false) {
		super(parent, id, name);
		this.hidden = hidden;
		this.nameElem = this.node.firstChild as HTMLSpanElement;
		if (id < 0) {
			this.node.removeChild(this.node.lastChild!);
			this.node.removeChild(this.node.lastChild!);
			this.node.removeChild(this.node.lastChild!);
		} else {
			this.node.removeChild(this.node.lastChild!.previousSibling!);
			if (selectedLayer === undefined) {
				this.show();
			}
		}
		if (hidden) {
			this.node.classList.add("layerHidden");
		}
		this.node.insertBefore(span({"class" : "layerVisibility", "onclick": () => (parent.root.rpcFuncs as LayerRPC).setVisibility(this.getPath(), !this.node.classList.toggle("layerHidden")).catch(handleError)}), this.node.firstChild);
		this.node.appendChild(div({"class": "dragBefore", "onmouseup": dragPlace.bind(this, false)}));
		this.node.appendChild(div({"class": "dragAfter", "onmouseup": dragPlace.bind(this, true)}));
		this.nameElem.addEventListener("mousedown", dragStart.bind(this));
	}
	show() {
		const rpcFuncs = (this.parent.root.rpcFuncs as LayerRPC);
		if (this.id === -1) { // Grid
			const details = rpcFuncs.getMapDetails(),
			      width = input({"type": "number", "min": "1", "max": "1000", "value": Math.round(details.width / details.gridSize), "id": "mapWidth"}),
			      height = input({"type": "number", "min": "1", "max": "1000", "value": Math.round(details.height / details.gridSize), "id": "mapHeight"}),
			      sqWidth = input({"type": "number", "min": "10", "max": "1000", "value": details.gridSize, "id": "mapSquareWidth"}),
			      sqColour = input({"type": "color", "id": "mapSquareColour", "value": colour2Hex(details.gridColour)}),
			      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": details.gridStroke, "id": "mapSquareLineWidth"}),
			      window = sh.appendChild(windows({"window-title": "Edit Map", "class": "mapAdd"}, [
				h1("Edit Map"),
				label({"for": "mapWidth"}, "Width in Squares: "),
				width,
				br(),
				label({"for": "mapHeight"}, "Height in Squares: "),
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
				button("Apply", {"onclick": function(this: HTMLButtonElement) {
					this.setAttribute("disabled", "disabled");
					const sq = parseInt(sqWidth.value);
					loadingWindow(rpcFuncs.setMapDetails({
						"width": parseInt(width.value) * sq,
						"height": parseInt(height.value) * sq,
						"gridSize": sq,
						"gridColour": hex2Colour(sqColour.value),
						"gridStroke": parseInt(sqLineWidth.value)
					}), window).then(() => window.remove())
					.catch(handleError)
					.finally(() => this.removeAttribute("disabled"));
				}})
			      ]));
			return window;
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
			      alphaInput = input({"id": "alphaPick", "type": "range", "min": "0", "max": "255", "step": "1","value": colour.a, "oninput": updatePreview}),
			      window = sh.appendChild(windows({"window-title": "Change Light Colour", "class": "lightChange"}, [
				h1("Change Light Colour"),
				checkboard,
				label({"for": "colourPick"}, "Colour: "),
				colourInput,
				br(),
				label({"for": "alphaPick"}, "Alpha: "),
				alphaInput,
				br(),
				button("Update", {"onclick": function(this: HTMLButtonElement) {
					this.setAttribute("disabled", "disabled");
					const colour = hex2Colour(colourInput.value);
					colour.a = parseInt(alphaInput.value);
					loadingWindow(rpcFuncs.setLightColour(colour), window)
					.then(() => window.remove())
					.catch(handleError)
					.finally(() => this.removeAttribute("disabled"));
				}})
			      ]));
			return window;
		} else {
			if (selectedLayer) {
				selectedLayer.node.classList.remove("selectedLayer");
			}
			this.node.classList.add("selectedLayer");
			selectedLayer = this;
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
			lf.children.forEach(c => this.children.push(isLayer(c) ? new ItemLayer(this, c.id, c.name, c.hidden) : new FolderLayer(root, this, c.name, c as LayerFolder, c.hidden)));
		}
		if (lf.id > 0) {
			this.node.classList.add("layerFolder");
			this.node.firstChild!.firstChild!.insertBefore(span({"class" : "layerVisibility", "onclick": (e: Event) => {
				(root.rpcFuncs as LayerRPC).setVisibility(this.getPath(), !this.node.classList.toggle("layerHidden")).catch(handleError);
				e.preventDefault()
			}}), this.node.firstChild!.firstChild!.firstChild);
			this.node.appendChild(div({"class": "dragBefore", "onmouseup": dragPlace.bind(this, false)}));
			this.node.appendChild(div({"class": "dragAfter", "onmouseup": dragPlace.bind(this, true)}));
			this.nameElem.addEventListener("mousedown", (e: MouseEvent) => {
				if (this.open.open) {
					return;
				}
				dragStart.call(this, e);
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

class LayerRoot extends Root {
	constructor(layers: FolderItems, rpc: LayerRPC, shell: ShellElement) {
		super(layers, "Layer", rpc, shell, ItemLayer, FolderLayer);
	}
	getLayer(path: string) {
		const [folder, sub] = this.resolvePath(path);
		if (!folder) {
			return null;
		}
		if (!sub) {
			return folder as FolderLayer;
		}
		return folder.children.filter(c => c.name === sub).pop() as FolderLayer | ItemLayer;
	}
}

export default function(shell: ShellElement, base: HTMLElement, mapChange: (fn: (rpc: LayerRPC) => void) => void) {
	base.appendChild(h1("No Map Selected"));
	dragBase = base;
	sh = shell;
	let canceller = () => {};
	mapChange(rpc => rpc.list().then(layers => {
		canceller();
		selectedLayer = undefined;
		const list = new LayerRoot(layers, rpc, shell);
		canceller = Subscription.canceller(
			list,
			rpc.waitLayerSetVisible().then(path => {
				const l = list.getLayer(path);
				if (l) {
					l.node.classList.remove("layerHidden");
				}
			}),
			rpc.waitLayerSetInvisible().then(path => {
				const l = list.getLayer(path);
				if (l) {
					l.node.classList.remove("layerHidden");
				}
			}),
			rpc.waitLayerPositionChange().then(ml => {
				const l = list.getLayer(ml.to);
				if (l && l.parent!.children.length -1 !== ml.position) {
					l.parent!.children.pop();
					l.parent!.children.splice(ml.position, 0, l);
				}
			}),
			rpc.waitLayerRename().then(lr => {
				const l = list.getLayer(lr.path);
				if (l) {
					l.name = lr.name;
					l.nameElem.innerText = lr.name;
				}
			})
		);
		createHTML(clearElement(base), {"id": "layerList"}, [
			button("Add Layer", {"onclick": () => {
				const name = autoFocus(input({"id": "layerName", "onkeypress": enterKey})),
				      window = shell.appendChild(windows({"window-title": "Add Layer"}));
				createHTML(window, {"id": "layerAdd"}, [
					h1("Add Layer"),
					label({"for": "layerName"}, "Layer Name"),
					name,
					br(),
					button("Add Layer", {"onclick": function(this: HTMLButtonElement) {
						this.setAttribute("disabled", "disabled");
						loadingWindow(rpc.newLayer(name.value), window).then(name => {
							list.addItem(1, name);
							window.remove();
						})
						.catch(handleError)
						.finally(() => this.removeAttribute("disabled"));
					}})
				]);
			}}),
			list.node
		]);
	}));
}
