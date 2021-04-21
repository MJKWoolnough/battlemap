import type {Uint, LayerRPC, LayerTokens, LayerFolder, FolderItems} from './types.js';
import type {SVGLayer} from './map.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {br, button, div, h1, input, option, select, span} from './lib/html.js';
import {symbol, circle, ellipse, g} from './lib/svg.js';
import {noSort} from './lib/ordered.js';
import {getLayer} from './map.js';
import {doLayerAdd, doLayerMove, doLayerRename, doMapChange, doSetLightColour, doShowHideLayer, layersRPC} from './map_fns.js';
import {checkInt, deselectToken, globals, mapLoadedReceive, enterKey, queue, labels} from './shared.js';
import {colour2Hex, colourPicker, hex2Colour} from './colours.js';
import {Root, Folder, Item} from './folders.js';
import {loadingWindow, windows, shell} from './windows.js';
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
	const window = shell.appendChild(windows({"window-icon": layerIcon, "window-title": lang["LAYER_RENAME"]})),
	      newName = autoFocus(input({"type": "text", "id": "renameLayer_", "value": self.name, "onkeypress": enterKey}));
	return createHTML(window, {"class": "renameItem"}, [
		h1(lang["LAYER_RENAME"]),
		labels(`${lang["LAYER_NAME"]}: `, newName),
		br(),
		button(lang["LAYER_RENAME"], {"onclick": function(this: HTMLButtonElement) {
			this.toggleAttribute("disabled", true);
			loadingWindow(queue(() => rpc.renameLayer(self.getPath(), newName.value).then(({path, name}) => {
				doLayerRename(path, name, false);
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
	loadingWindow(queue(() => (doLayerMove(oldPath, newPath + "/", pos, false), rpc.moveLayer(oldPath, newPath + "/", pos))), shell);
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
      ])),
      showHideLayer = (l: FolderLayer | ItemLayer) => queue(() => {
	const visible = !l.node.classList.toggle("layerHidden");
	return (visible ? rpc.showLayer : rpc.hideLayer)(doShowHideLayer(l.getPath(), visible, false));
      }),
      walkLayers = (f: FolderLayer, fn: (l: ItemLayer) => boolean) => {
	for (const c of f.children) {
		if (c instanceof FolderLayer) {
			if (walkLayers(c, fn)) {
				return true;
			}
		} else if (c instanceof ItemLayer) {
			if (fn(c)) {
				return true;
			}
		}
	}
	return false;
      };

class ItemLayer extends Item {
	hidden: boolean;
	constructor(parent: Folder, id: Uint, name: string, hidden = false) {
		super(parent, id, id === -1 ? lang["LAYER_GRID"] : id === -2 ? lang["LAYER_LIGHT"] : name);
		this.hidden = hidden;
		if (id < 0) {
			clearElement(this.node).appendChild(this.nameElem);
		} else {
			this.copier.remove();
			if (selectedLayer === undefined) {
				this.show();
			}
		}
		if (hidden) {
			this.node.classList.add("layerHidden");
		}
		this.node.insertBefore(visibility({"title": lang["LAYER_TOGGLE_VISIBILITY"], "class" : "layerVisibility", "onclick": () => showHideLayer(this)}), this.nameElem);
		this.node.appendChild(div({"class": "dragBefore", "onmouseup": () => dragPlace(this, false)}));
		this.node.appendChild(div({"class": "dragAfter", "onmouseup": () => dragPlace(this, true)}));
		this.nameElem.addEventListener("mousedown", (e: MouseEvent) => dragStart(this, e));
	}
	show() {
		if (this.id === -1) { // Grid
			const {mapData} = globals,
			      width = input({"type": "number", "min": "1", "max": "1000", "value": Math.round(mapData.width / mapData.gridSize), "id": "mapWidth_"}),
			      height = input({"type": "number", "min": "1", "max": "1000", "value": Math.round(mapData.height / mapData.gridSize), "id": "mapHeight_"}),
			      sqType = select({"id": "mapSquareType_"}, [lang["MAP_SQUARE_TYPE_SQUARE"], lang["MAP_SQUARE_TYPE_HEX_H"], lang["MAP_SQUARE_TYPE_HEX_V"]].map((l, n) => option({"value": n, "selected": mapData.gridType === n}, l))),
			      sqWidth = input({"type": "number", "min": "10", "max": "1000", "value": mapData.gridSize, "id": "mapSquareWidth_"}),
			      sqColour = input({"type": "color", "id": "mapSquareColour_", "value": colour2Hex(mapData.gridColour)}),
			      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": mapData.gridStroke, "id": "mapSquareLineWidth_"}),
			      window = shell.appendChild(windows({"window-icon": layerIcon, "window-title": lang["MAP_EDIT"], "class": "mapAdd"}, [
				h1(lang["MAP_EDIT"]),
				labels(`${lang["MAP_SQUARE_WIDTH"]}: `, width),
				br(),
				labels(`${lang["MAP_SQUARE_HEIGHT"]}: `, height),
				br(),
				labels(`${lang["MAP_SQUARE_TYPE"]}: `, sqType),
				br(),
				labels(`${lang["MAP_SQUARE_SIZE"]}: `, sqWidth),
				br(),
				labels(`${lang["MAP_SQUARE_COLOUR"]}: `, sqColour),
				br(),
				labels(`${lang["MAP_SQUARE_LINE"]}: `, sqLineWidth),
				br(),
				button(lang["SAVE"], {"onclick": function(this: HTMLButtonElement) {
					this.toggleAttribute("disabled", true);
					const sq = checkInt(parseInt(sqWidth.value), 10, 1000, 10);
					loadingWindow(
						queue(() => {
							const details = {
								"width": checkInt(parseInt(width.value), 1, 1000, 1) * sq,
								"height": checkInt(parseInt(height.value), 1, 1000, 1) * sq,
								"gridType": checkInt(parseInt(sqType.value), 0, 2, 0),
								"gridSize": sq,
								"gridColour": hex2Colour(sqColour.value),
								"gridStroke": checkInt(parseInt(sqLineWidth.value), 0, 10, 0)
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
		} else if (this.id === -2) { // Light
			colourPicker(shell, lang["LAYER_LIGHT_COLOUR"], globals.mapData.lightColour, layerIcon).then(c => loadingWindow(queue(() => (doSetLightColour(c, false), rpc.setLightColour(c))), shell));
		} else {
			if (selectedLayer) {
				selectedLayer.node.classList.remove("selectedLayer");
			}
			this.node.classList.add("selectedLayer");
			selectedLayer = this;
			deselectToken();
			globals.selected.layer = getLayer(this.getPath()) as SVGLayer;
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
			for (const c of lf.children) {
				this.children.push(isLayer(c) ? new ItemLayer(this, c.id, c.name, c.hidden) : new FolderLayer(root, this, c.name, c as LayerFolder, c.hidden));
			}
		}
		if (lf.id > 0) {
			this.node.classList.add("layerFolder");
			const fc = this.open.firstChild as HTMLElement;
			fc.insertBefore(visibility({"class" : "layerVisibility", "onclick": (e: Event) => {
				showHideLayer(this);
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
			this.node.appendChild(div(Array.from(this.node.childNodes)));
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

export const layerIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Cpath d="M50,50 l50,25 l-50,25 l-50,-25 Z" fill="%2300f" /%3E%3Cpath d="M50,25 l50,25 l-50,25 l-50,-25 Z" fill="%230f0" /%3E%3Cpath d="M50,0 l50,25 l-50,25 l-50,-25 Z" fill="%23f00" /%3E%3C/svg%3E';

export default function(base: HTMLElement) {
	base.appendChild(h1(lang["MAP_NONE_SELECTED"]));
	dragBase = base;
	const mousePos = {"clientX": 0, "clientY": 0};
	window.addEventListener("mousemove", e => {
		mousePos.clientX = e.clientX;
		mousePos.clientY = e.clientY;
	}, {"passive": true});
	let loadFn = () => {
		const list = new LayerRoot(globals.layerList, layersRPC),
		      addKeyboard =  () => globals.root.addEventListener("keypress", (e: KeyboardEvent) => {
			let sl: ItemLayer | undefined;
			switch (e.key) {
			case '[':
				walkLayers(list.folder as FolderLayer, l => {
					if (l.id > 0) {
						if (l === selectedLayer) {
							return true;
						}
						sl = l;
					}
					return false;
				});
				break;
			case ']':
				let next = false;
				walkLayers(list.folder as FolderLayer, l => {
					if (l.id > 0) {
						if (next) {
							sl = l;
							return true;
						}
						next = l === selectedLayer;
					}
					return false;
				});
			}
			if (sl) {
				const {root} = globals;
				root.dispatchEvent(new MouseEvent("mouseout", mousePos));
				root.dispatchEvent(new MouseEvent("mouseleave", mousePos));
				sl.show();
				root.parentNode?.dispatchEvent(new MouseEvent("mouseover", mousePos));
			}
		      });
		layersRPC.waitLayerSetVisible().then(path => {
			const l = list.getLayer(path);
			if (l) {
				l.node.classList.remove("layerHidden");
			}
		});
		layersRPC.waitLayerSetInvisible().then(path => {
			const l = list.getLayer(path);
			if (l) {
				l.node.classList.add("layerHidden");
			}
		});
		layersRPC.waitLayerPositionChange().then(ml => {
			const l = list.getLayer(ml.from),
			      np = list.getLayer(ml.to);
			if (!l || !(np instanceof FolderLayer)) {
				return;
			}
			l.parent!.children.filterRemove(i => i === l);
			np.children.splice(ml.position, 0, l);
		});
		layersRPC.waitLayerRename().then(lr => {
			const l = list.getLayer(lr.path);
			if (l) {
				l.name = lr.name;
				l.nameElem.innerText = lr.name;
			}
		});
		createHTML(clearElement(base), {"id": "layerList"}, [
			button(lang["LAYER_ADD"], {"onclick": () => {
				const window = shell.appendChild(windows({"window-icon": layerIcon, "window-title": lang["LAYER_ADD"]})),
				      name = autoFocus(input({"id": "layerName_", "onkeypress": enterKey}));
				createHTML(window, {"id": "layerAdd"}, [
					h1(lang["LAYER_ADD"]),
					labels(lang["LAYER_NAME"], name),
					br(),
					button(lang["LAYER_ADD"], {"onclick": function(this: HTMLButtonElement) {
						this.toggleAttribute("disabled", true);
						loadingWindow(queue(() => rpc.addLayer(name.value).then(name => {
							doLayerAdd(name, false);
							list.addItem(1, name);
							window.remove();
						})
						.finally(() => this.removeAttribute("disabled"))), window);
					}})
				]);
			}}),
			list.node
		]);
		addKeyboard();
		loadFn = () => {
			selectedLayer = undefined;
			list.setRoot(globals.layerList);
			addKeyboard();
		};
	    };
	mapLoadedReceive(() => loadFn());
}
