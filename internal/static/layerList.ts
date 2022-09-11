import type {FolderItems, LayerFolder, LayerTokens, Uint} from './types.js';
import type {SVGLayer} from './map.js';
import {amendNode, autoFocus, clearNode, createDocumentFragment} from './lib/dom.js';
import {keyEvent, mouseDragEvent, mouseX, mouseY} from './lib/events.js';
import {br, button, div, h1, input, option, select, span} from './lib/html.js';
import {node, noSort} from './lib/nodes.js';
import {ns as svgNS} from './lib/svg.js';
import {colourPicker, hex2Colour} from './colours.js';
import {Folder, Item, Root} from './folders.js';
import {registerKey} from './keys.js';
import lang from './language.js';
import {getLayer, layerList, mapData, root} from './map.js';
import {doLayerAdd, doLayerMove, doLayerRename, doLockUnlockLayer, doMapChange, doSetLightColour, doShowHideLayer, layersRPC, setLayer} from './map_fns.js';
import {deselectToken, selected} from './map_tokens.js';
import {isAdmin, rpc} from './rpc.js';
import {checkInt, enterKey, labels, mapLoadedReceive, menuItems, queue} from './shared.js';
import {lightOnOff, lock, visibility} from './symbols.js';
import {loadingWindow, shell, windows} from './windows.js';

let selectedLayer: ItemLayer | undefined,
    dragging: ItemLayer | FolderLayer | undefined,
    draggedName: HTMLSpanElement | undefined,
    dragOffset = 0,
    dragBase: HTMLElement;

const [setupDrag] = mouseDragEvent(0, (e: MouseEvent) => {
	if (!draggedName) {
		amendNode(dragging![node], {"class": ["dragged"]});
		amendNode(document.body, draggedName = span({"class": "beingDragged"}, dragging!.name));
		amendNode(dragBase, {"class": ["dragging"]});
	}
	amendNode(draggedName, {"style": {"top": e.clientY + 1 + "px", "left": e.clientX + dragOffset + "px"}});
      }, () => {
	amendNode(dragging![node], {"class": ["!dragged"]});
	dragging = undefined;
	draggedName?.remove();
	draggedName = undefined;
	amendNode(dragBase, {"class": ["!dragging", "!draggingSpecial"]});
      }),
      layerIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cpath d="M50,50 l50,25 l-50,25 l-50,-25 Z" fill="%2300f" /%3E%3Cpath d="M50,25 l50,25 l-50,25 l-50,-25 Z" fill="%230f0" /%3E%3Cpath d="M50,0 l50,25 l-50,25 l-50,-25 Z" fill="%23f00" /%3E%3C/svg%3E`,
      isLayer = (c: LayerTokens | LayerFolder): c is LayerTokens => (c as LayerFolder).children === undefined,
      isFolder = (c: ItemLayer | FolderLayer): c is FolderLayer => (c as FolderLayer).open !== undefined,
      renameLayer = (self: ItemLayer | FolderLayer) => {
	const newName = input({"type": "text", "value": self.name, "onkeypress": enterKey}),
	      w = windows({"window-icon": layerIcon, "window-title": lang["LAYER_RENAME"], "class": "renameItem"}, [
		h1(lang["LAYER_RENAME"]),
		labels(`${lang["LAYER_NAME"]}: `, newName),
		br(),
		button({"onclick": function(this: HTMLButtonElement) {
			amendNode(this, {"disabled": true});
			loadingWindow(queue(() => rpc.renameLayer(self.getPath(), newName.value).then(({path, name}) => {
				self.parent!.children.reSet(self.name, name);
				clearNode(self.nameElem, self.name = name);
				doLayerRename(path, name, false);
				w.remove();
			})
			.finally(() => amendNode(this, {"disabled": true}))), w);
		}}, lang["LAYER_RENAME"])
	      ]);
	amendNode(shell, w);
	autoFocus(newName);
	return w;
      },
      dragPlace = (l: ItemLayer | FolderLayer, beforeAfter: boolean) => {
	if (dragging && (dragging.id >= 0 || l.parent === dragging.parent)) {
		dragging!.parent!.children.delete(dragging!.name);
		const oldPath = dragging!.getPath();
		let pos = 0,
		    newPath: string;
		if (dragging!.id >= 0 && isFolder(l) && beforeAfter && l.open.open) {
			if (l.children.size === 0) {
				l.children.set(dragging!.name, dragging!);
			} else {
				l.children.insertBefore(dragging!.name, dragging!, l.children.keyAt(0)!);
				pos = l.children.position(dragging!.name);
			}
			newPath = l.getPath() + "/";
			dragging!.parent = l;
		} else {
			l.parent!.children[beforeAfter ? "insertAfter" : "insertBefore"](dragging!.name, dragging!, l.name);
			newPath = l.parent!.getPath() + "/";
			pos = l.parent!.children.position(dragging!.name);
			dragging!.parent = l.parent!;
		}
		loadingWindow(queue(() => (doLayerMove(oldPath, newPath, pos, false), rpc.moveLayer(oldPath, newPath, pos))), shell);
	}
      },
      dragStart = (l: ItemLayer | FolderLayer, e: MouseEvent) => {
	if (!dragging && e.button === 0) {
		if (l.id < 0) {
			amendNode(dragBase, {"class": ["draggingSpecial"]});
		}
		dragOffset = l.nameElem.offsetLeft - e.clientX;
		for (let e = l.nameElem.offsetParent; e instanceof HTMLElement; e = e.offsetParent) {
			dragOffset += e.offsetLeft;
		}
		dragging = l;
		setupDrag();
	}
      },
      showHideLayer = (l: FolderLayer | ItemLayer) => queue(() => {
	const visible = !l[node].classList.toggle("layerHidden");
	return (visible ? rpc.showLayer : rpc.hideLayer)(doShowHideLayer(l.getPath(), visible, false));
      }),
      lockUnlockLayer = (l: FolderLayer | ItemLayer) => queue(() => {
	const locked = l[node].classList.toggle("layerLocked");
	return (locked ? rpc.lockLayer : rpc.unlockLayer)(doLockUnlockLayer(l.getPath(), locked, false));
      }),
      walkLayers = (f: FolderLayer, fn: (l: ItemLayer) => boolean) => {
	for (const [, c] of f.children) {
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
      },
      adminLightToggle = lightOnOff({"id": "toggleAdminLight", "title": lang["LAYER_LIGHT_TOGGLE"], "onclick": () => amendNode(document.body, {"class": ["~adminHideLight"]})});

class ItemLayer extends Item {
	#locked: boolean;
	constructor(parent: Folder, id: Uint, name: string, hidden = false, locked = false) {
		super(parent, id, id === -1 ? lang["LAYER_GRID"] : id === -2 ? lang["LAYER_LIGHT"] : name);
		if (this.#locked = locked) {
			amendNode(this[node], {"class": ["layerLocked"]});
		}
		if (id < 0) {
			clearNode(this[node], [this.nameElem, id === -2 ? adminLightToggle : []]);
		} else {
			this.copier.remove();
			if (selectedLayer === undefined) {
				this.show();
			}
		}
		if (hidden) {
			amendNode(this[node], {"class": ["layerHidden"]});
		}
		this[node].insertBefore(createDocumentFragment([
			id < 0 ? [] : lock({"title": lang["LAYER_TOGGLE_LOCK"], "class": "layerLock", "onclick": () => {
				this.#locked = !this.#locked;
				lockUnlockLayer(this);
			}}),
			visibility({"title": lang["LAYER_TOGGLE_VISIBILITY"], "class" : "layerVisibility", "onclick": () => showHideLayer(this)})
		]), this.nameElem);
		amendNode(this[node], [
			div({"class": "dragBefore", "onmouseup": () => dragPlace(this, false)}),
			div({"class": "dragAfter", "onmouseup": () => dragPlace(this, true)})
		]);
		amendNode(this.nameElem, {"onmousedown": (e: MouseEvent) => dragStart(this, e)});
	}
	show() {
		if (this.id === -1) { // Grid
			const width = input({"type": "number", "min": 1, "max": 1000, "value": Math.round(mapData.width / mapData.gridSize), "onkeypress": enterKey}),
			      height = input({"type": "number", "min": 1, "max": 1000, "value": Math.round(mapData.height / mapData.gridSize), "onkeypress": enterKey}),
			      sqType = select([lang["MAP_SQUARE_TYPE_SQUARE"], lang["MAP_SQUARE_TYPE_HEX_H"], lang["MAP_SQUARE_TYPE_HEX_V"]].map((l, n) => option({"value": n, "selected": mapData.gridType === n}, l))),
			      sqWidth = input({"type": "number", "min": 10, "max": 1000, "value": mapData.gridSize}),
			      sqColour = input({"type": "color", "value": mapData.gridColour.toHexString()}),
			      sqLineWidth = input({"type": "number", "min": 0, "max": 10, "value": mapData.gridStroke}),
			      w = windows({"window-icon": layerIcon, "window-title": lang["MAP_EDIT"], "class": "mapAdd"}, [
				h1(lang["MAP_EDIT"]),
				([["MAP_SQUARE_WIDTH", width], ["MAP_SQUARE_HEIGHT", height], ["MAP_SQUARE_TYPE", sqType], ["MAP_SQUARE_SIZE", sqWidth], ["MAP_SQUARE_COLOUR", sqColour], ["MAP_SQUARE_LINE", sqLineWidth]] as [keyof typeof lang, HTMLInputElement | HTMLSelectElement][]).map(([k, i]) => [labels(`${lang[k]}: `, i), br()]),
				button({"onclick": function(this: HTMLButtonElement) {
					amendNode(this, {"disabled": true});
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
							.then(() => w.remove())
							.finally(() => amendNode(this, {"disabled": false}));
						}),
						w
					);
				}}, lang["SAVE"])
			      ]);
			amendNode(shell, w);
		} else if (this.id === -2) { // Light
			colourPicker(shell, lang["LAYER_LIGHT_COLOUR"], mapData.lightColour, layerIcon).then(c => loadingWindow(queue(() => (doSetLightColour(c, false), rpc.setLightColour(c))), shell));
		} else if (!this.isLocked()) {
			amendNode(selectedLayer?.[node], {"class": ["!selectedLayer"]});
			amendNode(this[node], {"class": ["selectedLayer"]});
			selectedLayer = this;
			deselectToken();
			amendNode(selected.layer?.[node], {"class": ["!selectedLayer"]});
			setLayer(selected.layer = getLayer(this.getPath()) as SVGLayer);
			amendNode(selected.layer[node], {"class": ["selectedLayer"]});
		}
	}
	isLocked() {
		return this.#locked || (this.parent as FolderLayer).isLocked();
	}
	rename() {
		return renameLayer(this);
	}
}

class FolderLayer extends Folder {
	id: Uint;
	open: HTMLDetailsElement;
	#locked: boolean;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems, hidden = false, locked = false) {
		super(root, parent, name, {folders: {}, items: {}});
		const lf = children as LayerFolder;
		this.open = this[node].firstChild as HTMLDetailsElement;
		if (hidden) {
			amendNode(this[node], {"class": ["layerHidden"]});
		}
		if (this.#locked = locked) {
			amendNode(this[node], {"class": ["layerLocked"]});
		}
		this.id = lf.id ??= 1;
		if (lf.children) {
			for (const c of lf.children) {
				this.children.set(c.name, isLayer(c) ? new ItemLayer(this, c.id, c.name, c.hidden, c.locked) : new FolderLayer(root, this, c.name, c as LayerFolder, c.hidden));
			}
		}
		if (lf.id > 0) {
			amendNode(this.open.firstChild as HTMLElement, [
				div({"class": "dragBefore", "onmouseup": () => dragPlace(this, false)}),
				div({"class": "dragAfter", "onmouseup": () => dragPlace(this, true)})
			]).insertBefore(createDocumentFragment([
				lock({"title": lang["LAYER_TOGGLE_LOCK"], "class" : "layerLock", "onclick": (e: Event) => {
					this.#locked = !this.#locked;
					lockUnlockLayer(this);
					e.preventDefault()
				}}),
				visibility({"title": lang["LAYER_TOGGLE_VISIBILITY"], "class" : "layerVisibility", "onclick": (e: Event) => {
					showHideLayer(this);
					e.preventDefault()
				}})
			]), amendNode(this.nameElem, {"onmousedown": (e: MouseEvent) => {
				if (!this.open.open) {
					dragStart(this, e);
				}
			}}));
			amendNode(this[node], {"class": ["layerFolder"]}, div(this[node].childNodes));
		}
	}
	isLocked(): boolean {
		return this.#locked || ((this.parent as FolderLayer)?.isLocked() ?? false);
	}
	get sorter() { return noSort; }
	rename() {
		return renameLayer(this);
	}
}

class LayerRoot extends Root {
	constructor(layers: FolderItems) {
		super(layers, "Layer", layersRPC, ItemLayer, FolderLayer);
	}
	get filter() { return false; }
	getLayer(path: string) {
		const [folder, sub] = this.resolvePath(path);
		return !folder ? null : !sub ? folder as FolderLayer : folder.children.get(sub) as FolderLayer | ItemLayer;
	}
}

menuItems.push([5, () => isAdmin ? [
	lang["TAB_LAYERS"],
	(() => {
		const base = dragBase = div(h1(lang["MAP_NONE_SELECTED"])),
		      layerPrev = registerKey("layerPrev", lang["KEY_LAYER_PREV"], '['),
		      layerNext = registerKey("layerNext", lang["KEY_LAYER_NEXT"], ']');
		let loadFn = () => {
			const list = new LayerRoot(layerList),
			      setLayer = (sl: ItemLayer) => {
				const mo = {"clientX": mouseX, "clientY": mouseY};
				root.dispatchEvent(new MouseEvent("mouseout", mo));
				root.dispatchEvent(new MouseEvent("mouseleave", mo));
				sl.show();
				root.parentNode?.dispatchEvent(new MouseEvent("mouseover", mo));
			      };
			keyEvent(layerPrev, () => {
				let sl: ItemLayer | undefined;
				walkLayers(list.folder as FolderLayer, l => {
					if (l.id > 0 && !l.isLocked()) {
						if (l === selectedLayer) {
							return true;
						}
						sl = l;
					}
					return false;
				});
				if (sl) {
					setLayer(sl);
				}
			})[0]();
			keyEvent(layerNext, () => {
				let next = false;
				walkLayers(list.folder as FolderLayer, l => {
					if (l.id > 0 && !l.isLocked()) {
						if (next) {
							setLayer(l);
							return true;
						}
						next = l === selectedLayer;
					}
					return false;
				});
			})[0]();
			layersRPC.waitLayerSetVisible().then(path => amendNode(list.getLayer(path)?.[node], {"class": ["!layerHidden"]}));
			layersRPC.waitLayerSetInvisible().then(path => amendNode(list.getLayer(path)?.[node], {"class": ["layerHidden"]}));
			layersRPC.waitLayerPositionChange().then(ml => {
				const l = list.getLayer(ml.from),
				      np = list.getLayer(ml.to);
				if (l && np instanceof FolderLayer) {
					l.parent!.children.delete(l.name);
					l.parent = np;
					if (ml.position >= np.children.size) {
						np.children.set(l.name, l);
					} else {
						np.children.insertBefore(l.name, l, np.children.keyAt(ml.position)!);
					}
				}
			});
			layersRPC.waitLayerRename().then(lr => {
				const l = list.getLayer(lr.path);
				if (l) {
					l.parent!.children.reSet(l.name, lr.name);
					clearNode(l.nameElem, l.name = lr.name);
				}
			});
			layersRPC.waitLayerSelect().then(path => {
				const l = list.getLayer(path);
				if (l !== selectedLayer && l instanceof ItemLayer) {
					l.show();
				}
			});
			clearNode(base, {"id": "layerList"}, [
				button({"onclick": () => {
					const name = input({"onkeypress": enterKey}),
					      w = windows({"window-icon": layerIcon, "window-title": lang["LAYER_ADD"], "id": "layerAdd"}, [
						h1(lang["LAYER_ADD"]),
						labels(lang["LAYER_NAME"], name),
						br(),
						button({"onclick": function(this: HTMLButtonElement) {
							amendNode(this, {"disabled": true});
							loadingWindow(queue(() => rpc.addLayer(name.value).then(name => {
								doLayerAdd(name, false);
								list.addItem(1, name);
								w.remove();
							})
							.finally(() => amendNode(this, {"disabled": false}))), w);
						}}, lang["LAYER_ADD"])
					      ]);
					amendNode(shell, w);
					autoFocus(name);
				}}, lang["LAYER_ADD"]),
				list[node]
			]);
			loadFn = () => {
				selectedLayer = undefined;
				list.setRoot(layerList);
			};
		    };
		mapLoadedReceive(() => loadFn());
		return base;
	})(),
	true,
	layerIcon
] : null]);
