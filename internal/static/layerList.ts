import {Uint, LayerRPC, LayerTokens, LayerFolder, FolderItems} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {br, button, div, h1, input, label, option, select, span} from './lib/html.js';
import {symbol, circle, ellipse, g} from './lib/svg.js';
import {noSort} from './lib/ordered.js';
import {globals} from './map.js';
import {doMapChange, doSetLightColour} from './adminMap.js';
import {mapLayersReceive, mapLoadedReceive, enterKey, colour2Hex, hex2Colour, colourPicker, requestShell, queue} from './misc.js';
import {Root, Folder, Item} from './folders.js';
import {loadingWindow, windows} from './windows.js';
import {addSymbol} from './symbols.js';
import lang from './language.js';
import {rpc} from './rpc.js';

let selectedLayer: ItemLayer | undefined, dragging: ItemLayer | FolderLayer | undefined, draggedName: HTMLSpanElement | undefined, dragOffset = 0, dragBase: HTMLElement;

const dragFn = (e: MouseEvent) => {
	if (!draggedName) {
		dragging!.node.classList.add("dragged");
		draggedName = document.body.appendChild(span(dragging!.name, {"class": "beingDragged"}));
		dragBase.classList.add("dragging");
	}
	draggedName!.style.setProperty("top", e.clientY + 1 + "px");
	draggedName!.style.setProperty("left", e.clientX + dragOffset + "px");
      },
      dropFn = (e: MouseEvent) => {
	if (e.button !== 0) {
		return;
	}
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
      isLayer = (c: LayerTokens | LayerFolder): c is LayerTokens => (c as LayerFolder).children === undefined,
      isFolder = (c: ItemLayer | FolderLayer): c is FolderLayer => (c as FolderLayer).open !== undefined,
      renameLayer = (self: ItemLayer | FolderLayer) => {
	const root = self.parent!.root,
	      newName = autoFocus(input({"type": "text", "id": "renameLayer", "value": self.name, "onkeypress": enterKey})),
	      window = requestShell().appendChild(windows({"window-title": lang["LAYER_RENAME"]}));
	return createHTML(window, {"class": "renameItem"}, [
		h1(lang["LAYER_RENAME"]),
		label({"for": "renameLayer"}, `${lang["LAYER_NAME"]}: `),
		newName,
		br(),
		button(lang["LAYER_RENAME"], {"onclick": function(this: HTMLButtonElement) {
			this.toggleAttribute("disabled", true);
			loadingWindow(queue(() => (root.rpcFuncs as LayerRPC).renameLayer(self.getPath(), newName.value).then(name => {
				self.name = name;
				self.nameElem.innerText = name;
				window.remove();
			})
			.finally(() => this.removeAttribute("disabled"))), window);
		}})
	]);
      },
      dragPlace = (l: ItemLayer | FolderLayer, beforeAfter: boolean) => {
	if (dragging!.id < 0 && l.parent !== dragging!.parent) {
		return;
	}
	const currPos = dragging!.parent!.children.indexOf(dragging!),
	      oldPath = dragging!.getPath();
	let pos: Uint,
	    newPath: string;
	if (dragging!.id >= 0 && beforeAfter && isFolder(l) && l.open.open) {
		pos = 0;
		dragging!.parent!.children.splice(currPos, 1);
		l.children.unshift(dragging!);
		newPath = l.getPath();
		dragging!.parent = l;
	} else {
		pos = l.parent!.children.indexOf(l) + (beforeAfter ? 1 : 0);
		if (l.parent === dragging!.parent) {
			pos -= pos > currPos ? 1 : 0;
			if (pos === currPos) {
				return;
			}
			l.parent!.children.splice(currPos, 1);
			l.parent!.children.splice(pos, 0, dragging!);
		} else {
			dragging!.parent!.children.splice(currPos, 1);
			l.parent!.children.splice(pos, 0, dragging!);
			dragging!.parent = l.parent;
		}
		newPath = (l.parent as FolderLayer).getPath();
	}
	loadingWindow(queue(() => (l.parent!.root.rpcFuncs as LayerRPC).moveLayer(oldPath, newPath + "/", pos)), requestShell());
      },
      dragStart = (l: ItemLayer | FolderLayer, e: MouseEvent) => {
	if (dragging || e.button !== 0) {
		return;
	}
	if (l.id < 0) {
		dragBase.classList.add("draggingSpecial");
	}
	dragOffset = l.nameElem.offsetLeft - e.clientX;
	for (let e = l.nameElem.offsetParent; e instanceof HTMLElement; e = e.offsetParent) {
		dragOffset += e.offsetLeft!;
	}
	dragging = l;
	document.body.addEventListener("mousemove", dragFn);
	document.body.addEventListener("mouseup", dropFn);
      },
      visibility = addSymbol("visibility", symbol({"viewBox": "0 0 100 70"}, [
	ellipse({"cx": 50, "cy": 35, "rx": 49, "ry": 34, "stroke-width": 2, "stroke": "#000", "fill": "#fff"}),
	g({"style": "display: var(--invisible, block)"}, [
		circle({"cx": 50, "cy": 35, "r": 27, "stroke": "#888", "stroke-width": 10}),
		circle({"cx": 59, "cy": 27, "r": 10, "fill": "#fff"})
	])
      ]));

class ItemLayer extends Item {
	hidden: boolean;
	nameElem: HTMLSpanElement;
	constructor(parent: Folder, id: Uint, name: string, hidden = false) {
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
		this.node.insertBefore(visibility({"title": lang["LAYER_TOGGLE_VISIBILITY"], "class" : "layerVisibility", "onclick": () => queue(() => (parent.root.rpcFuncs as LayerRPC).setVisibility(this.getPath(), !this.node.classList.toggle("layerHidden")))}), this.nameElem);
		this.node.appendChild(div({"class": "dragBefore", "onmouseup": () => dragPlace(this, false)}));
		this.node.appendChild(div({"class": "dragAfter", "onmouseup": () => dragPlace(this, true)}));
		this.nameElem.addEventListener("mousedown", (e: MouseEvent) => dragStart(this, e));
	}
	show() {
		const rpcFuncs = (this.parent.root.rpcFuncs as LayerRPC);
		if (this.id === -1) { // Grid
			const {mapData} = globals,
			      width = input({"type": "number", "min": "1", "max": "1000", "value": Math.round(mapData.width / mapData.gridSize), "id": "mapWidth"}),
			      height = input({"type": "number", "min": "1", "max": "1000", "value": Math.round(mapData.height / mapData.gridSize), "id": "mapHeight"}),
			      sqType = select({"id": "mapSquareType"}, [lang["MAP_SQUARE_TYPE_SQUARE"], lang["MAP_SQUARE_TYPE_HEX_H"], lang["MAP_SQUARE_TYPE_HEX_V"]].map((l, n) => option({"value": n, "selected": mapData.gridType === n}, l))),
			      sqWidth = input({"type": "number", "min": "10", "max": "1000", "value": mapData.gridSize, "id": "mapSquareWidth"}),
			      sqColour = input({"type": "color", "id": "mapSquareColour", "value": colour2Hex(mapData.gridColour)}),
			      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": mapData.gridStroke, "id": "mapSquareLineWidth"}),
			      window = requestShell().appendChild(windows({"window-title": lang["MAP_EDIT"], "class": "mapAdd"}, [
				h1(lang["MAP_EDIT"]),
				label({"for": "mapWidth"}, `${lang["MAP_SQUARE_WIDTH"]}: `),
				width,
				br(),
				label({"for": "mapHeight"}, `${lang["MAP_SQUARE_HEIGHT"]}: `),
				height,
				br(),
				label({"for": "mapSquareType"}, `${lang["MAP_SQUARE_TYPE"]}: `),
				sqType,
				br(),
				label({"for": "mapSquareWidth"}, `${lang["MAP_SQUARE_SIZE"]}: `),
				sqWidth,
				br(),
				label({"for": "mapSquareColour"}, `${lang["MAP_SQUARE_COLOUR"]}: `),
				sqColour,
				br(),
				label({"for": "mapSquareLineWidth"}, `${lang["MAP_SQUARE_LINE"]}: `),
				sqLineWidth,
				br(),
				button(lang["SAVE"], {"onclick": function(this: HTMLButtonElement) {
					this.toggleAttribute("disabled", true);
					const sq = parseInt(sqWidth.value);
					loadingWindow(
						queue(() => {
							const details = {
								"width": parseInt(width.value) * sq,
								"height": parseInt(height.value) * sq,
								"gridType": parseInt(sqType.value),
								"gridSize": sq,
								"gridColour": hex2Colour(sqColour.value),
								"gridStroke": parseInt(sqLineWidth.value)
							      };
							doMapChange(details, false);
							return rpc.setMapDetails(details)
							.then(() => window.remove())
							.finally(() => this.removeAttribute("disabled"))
						}),
						window
					);
				}})
			      ]));
			return window;
		} else if (this.id === -2) { // Light
			colourPicker(requestShell(), lang["LAYER_LIGHT_COLOUR"], globals.mapData.lightColour).then(c => loadingWindow(queue(() => (doSetLightColour(c, false), rpc.setLightColour(c))), requestShell()));
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
	id: Uint;
	hidden: boolean;
	nameElem: HTMLSpanElement;
	open: HTMLDetailsElement;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems, hidden = false) {
		super(root, parent, name, {folders: {}, items: {}});
		this.hidden = hidden;
		const lf = children as LayerFolder;
		this.open = this.node.firstChild as HTMLDetailsElement;
		this.nameElem = this.open.firstChild!.firstChild as HTMLSpanElement;
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
			const fc = this.open.firstChild as HTMLElement;
			fc.insertBefore(visibility({"class" : "layerVisibility", "onclick": (e: Event) => {
				queue(() => (root.rpcFuncs as LayerRPC).setVisibility(this.getPath(), !this.node.classList.toggle("layerHidden")));
				e.preventDefault()
			}}), this.nameElem);
			createHTML(fc, [
				div({"class": "dragBefore", "onmouseup": () => dragPlace(this, false)}),
				div({"class": "dragAfter", "onmouseup": () => dragPlace(this, true)})
			]);
			this.nameElem.addEventListener("mousedown", (e: MouseEvent) => {
				if (this.open.open) {
					return;
				}
				dragStart(this, e);
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
	constructor(layers: FolderItems, rpc: LayerRPC) {
		super(layers, "Layer", rpc, ItemLayer, FolderLayer);
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

export default function(base: HTMLElement) {
	base.appendChild(h1("No Map Selected"));
	dragBase = base;
	mapLayersReceive(rpc => {
		let loadFn = () => {
			let selectedLayer = undefined;
			const list = new LayerRoot(globals.layerList, rpc);
			rpc.waitLayerSetVisible().then(path => {
				const l = list.getLayer(path);
				if (l) {
					l.node.classList.remove("layerHidden");
				}
			});
			rpc.waitLayerSetInvisible().then(path => {
				const l = list.getLayer(path);
				if (l) {
					l.node.classList.remove("layerHidden");
				}
			});
			rpc.waitLayerPositionChange().then(ml => {
				const l = list.getLayer(ml.from),
				      np = list.getLayer(ml.to);
				if (!l || !(np instanceof FolderLayer)) {
					return;
				}
				l.parent!.children.filterRemove(i => i === l);
				np.children.splice(ml.position, 0, l);
			});
			rpc.waitLayerRename().then(lr => {
				const l = list.getLayer(lr.path);
				if (l) {
					l.name = lr.name;
					l.nameElem.innerText = lr.name;
				}
			});
			createHTML(clearElement(base), {"id": "layerList"}, [
				button("Add Layer", {"onclick": () => {
					const name = autoFocus(input({"id": "layerName", "onkeypress": enterKey})),
					      window = requestShell().appendChild(windows({"window-title": "Add Layer"}));
					createHTML(window, {"id": "layerAdd"}, [
						h1("Add Layer"),
						label({"for": "layerName"}, "Layer Name"),
						name,
						br(),
						button("Add Layer", {"onclick": function(this: HTMLButtonElement) {
							this.toggleAttribute("disabled", true);
							loadingWindow(queue(() => rpc.newLayer(name.value).then(name => {
								list.addItem(1, name);
								window.remove();
							})
							.finally(() => this.removeAttribute("disabled"))), window);
						}})
					]);
				}}),
				list.node
			]);
			loadFn = () => list.setRoot(globals.layerList);
		    };
		mapLoadedReceive(() => loadFn());
	});
}
