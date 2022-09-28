import type {FolderItems, Uint} from './types.js';
import {add, id, ids} from './lib/css.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {DragTransfer} from './lib/drag.js';
import {br, button, div, h1, h2, input, option, select} from './lib/html.js';
import {node} from './lib/nodes.js';
import {IntSetting} from './lib/settings.js';
import {ns as svgNS} from './lib/svg.js';
import {mapLoadSend} from './adminMap.js';
import {hex2Colour} from './colours.js';
import {DragFolder, DraggableItem, Folder, Root, foldersItem} from './folders.js';
import lang from './language.js';
import {isAdmin, rpc} from './rpc.js';
import {invertID} from './settings.js';
import {checkInt, enterKey, labels, loading, menuItems, queue} from './shared.js';
import {userSelected} from './symbols.js';
import undo from './undo.js';
import {loadingWindow, shell, windows} from './windows.js';

const mapIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" width="50" height="50" viewBox="0 0 100 100"%3E%3Cg stroke-width="2" fill="none"%3E%3Cpath d="M30,1 L70,5 V99 L30,95" fill="%238f0" /%3E%3Cpath d="M30,55 h0.5 L69.5,48 H70 M40,53 L60,96 v2" stroke="%23333" stroke-width="10" /%3E%3Cpath d="M1,5 L30,1 70,5 99,1 M1,99 L30,95 70,99 99,95" stroke="%23eee" /%3E%3Cpath d="M30,1 L1,5 V99 L30,95 M70,5 L99,1 V95 L70,99" stroke="%23aaa" fill="%234a0" /%3E%3Cpath d="M2,40 Q10,40 30,35 V2 L2,6 Z M70,40 Q80,30 98,30 V2 L70,6 Z" fill="%2300a" /%3E%3Cpath d="M30,35 C50,30 50,50 70,40 V6 L30,2 Z" fill="%2300f" /%3E%3Cpath d="M2,75 h5 L26,55 H30 M70,48 h3 L96,37 H98" stroke="%23000" stroke-width="10" /%3E%3C/g%3E%3C/svg%3E`,
      setMap = (mapItem: MapItem | null, selected: MapItem | null, selectedClass: string, containsClass: string) => {
	if (selected) {
		amendNode(selected[node], {"class": {[selectedClass]: false}});
		for (let curr: Folder | null = selected.parent; curr; curr = curr.parent) {
			amendNode(curr[node], {"class": {[containsClass]: false}});
		}
	}
	if (mapItem) {
		amendNode(mapItem[node], {"class": [selectedClass]});
		for (let curr: Folder | null = mapItem.parent; curr; curr = curr.parent) {
			amendNode(curr[node], {"class": [containsClass]});
		}
	}
      },
      selectedMap = new IntSetting("selectedMap"),
      dragMapFolder = new DragTransfer<MapFolder>("mapfolder"),
      [mapItem, mapUser, hasMapUser, hasMapCurrent, mapCurrent, setUserMap] = ids(6);

export const dragMap = new DragTransfer<MapItem>("map");

let selectedUser: MapItem | null = null,
    selectedCurrent: MapItem | null = null;

class MapItem extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name, dragMap);
		amendNode(this.image, {"src": mapIcon});
		amendNode(this[node], {"class": [mapItem]});
		this[node].insertBefore(userSelected({"class": setUserMap, "title": lang["MAP_SET_USER"], "onclick": () => {
			this.setUserMap();
			rpc.setUserMap(id);
		}}), this[node].firstChild);
	}
	show() {
		let thisMap: MapItem = this,
		    oldMap = selectedCurrent!;
		const doIt = () => {
			if (oldMap) {
				setMap(thisMap, oldMap, mapCurrent, hasMapCurrent);
			} else {
				amendNode(this[node], {"class": [mapCurrent]});
			}
			selectedCurrent = thisMap;
			const id = thisMap.id;
			queue(() => rpc.setCurrentMap(id).then(() => mapLoadSend(id)));
			selectedMap.set(id);
			[thisMap, oldMap] = [oldMap, thisMap];
			return doIt;
		      };
		if (selectedCurrent) {
			undo.add(doIt(), lang["UNDO_MAP_LOAD"]);
		} else {
			doIt();
		}
	}
	rename() {
		return this[node].classList.contains(mapCurrent) || this[node].classList.contains(mapUser) ? shell.appendChild(windows({"window-icon": mapIcon, "window-title": lang["INVALID_ACTION"]}, h2(lang["INVALID_RENAME"]))) : super.rename();
	}
	remove() {
		return this[node].classList.contains(mapCurrent) || this[node].classList.contains(mapUser) ? shell.appendChild(windows({"window-icon": mapIcon, "window-title": lang["INVALID_ACTION"]}, h2(lang["INVALID_REMOVE"]))) : super.remove();
	}
	setUserMap() {
		setMap(this, selectedUser, mapUser, hasMapUser);
		selectedUser = this;
	}
}

class MapFolder extends DragFolder<MapItem> {
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems){
		super(root, parent, name, children, dragMap, dragMapFolder);
	}
	rename(e: Event) {
		return this[node].classList.contains(hasMapCurrent) || this[node].classList.contains(hasMapUser) ? shell.appendChild(windows({"window-icon": mapIcon, "window-title":  lang["INVALID_ACTION"]}, h2(lang["INVALID_RENAME_CONTAIN"]))) : super.rename(e);
	}
	remove(e: Event) {
		return this[node].classList.contains(hasMapCurrent) || this[node].classList.contains(hasMapUser) ? shell.appendChild(windows({"window-icon": mapIcon, "window-title": "Invalid Action"}, h2(lang["INVALID_REMOVE_CONTAIN"]))) : super.remove(e);
	}
}

class MapRoot extends Root {
	moveItem(from: string, to: string) {
		if (selectedCurrent && selectedCurrent.getPath() === from) {
			setMap(null, selectedCurrent, mapCurrent, hasMapCurrent);
			super.moveItem(from, to);
			setMap(selectedCurrent, null, mapCurrent, hasMapCurrent);
		} else {
			super.moveItem(from, to);
		}
	}
	removeItem(from: string) {
		if (selectedCurrent && selectedCurrent.getPath() === from) {
			setMap(null, selectedCurrent, mapCurrent, hasMapCurrent);
			mapLoadSend(0);
		}
		return super.removeItem(from);
	}
	moveFolder(from: string, to: string) {
		const [f] = this.resolvePath(from);
		if (f && f[node].classList.contains(hasMapCurrent)) {
			setMap(null, selectedCurrent, mapCurrent, hasMapCurrent);
			const t = super.moveFolder(from, to);
			setMap(selectedCurrent, null, mapCurrent, hasMapCurrent);
			return t;
		}
		return super.moveFolder(from, to);
	}
	removeFolder(from: string) {
		const [f] = this.resolvePath(from);
		if (f && f[node].classList.contains(hasMapCurrent)) {
			setMap(null, selectedCurrent, mapCurrent, hasMapCurrent);
			mapLoadSend(0);
		}
		return super.removeFolder(from);
	}
}

menuItems.push([4, () => isAdmin ? [
	lang["TAB_MAPS"],
	(() => {
		const rpcFuncs = rpc["maps"],
		      base = div(loading()),
		      mapList = id();
		add(`#${mapList}`, {
			" ul": {
				"list-style": "none",
				"margin": 0,
				"padding-left": "calc(1em + 4px)"
			},
			" li>svg:first-child": {
				"display": "inline-block",
				"width": "1em",
				"height": "1em",
				"margin": "0 2px"
			},
			[` li.${mapItem}>svg:first-child`]: {
				"cursor": "pointer"
			},
			[` li.${mapUser}>svg:first-child`]: {
				"--map-selected": "block"
			},
			[` .${foldersItem}`]: {
				"grid-template-columns": "auto 1em 1em 1em"
			}
		});
		add(`.${hasMapUser}>details>summary`, {
			"background-color": "#ccffcc"
		});
		add(`.${hasMapCurrent}>details>summary`, {
			"background-color": "#f8f8f8"
		});
		add(`.${mapCurrent}`, {
			"background-color": "#eee"
		});
		add(`.${setUserMap}`, {
			"position": "absolute",
			"left": 0
		});
		add(`.${invertID}`, {
			[` .${mapCurrent}`]: {
				"background-color": "#555"
			},
			[` .${hasMapCurrent}>details>summary`]: {
				"background-color": "#600"
			},
			[` .${hasMapUser}>details>summary`]: {
				"background-color": "#400"
			}
		});
		Promise.all([
			rpcFuncs.list(),
			rpc.getUserMap()
		]).then(([folderList, userMap]) => {
			const root = new MapRoot(folderList, lang["TAB_MAPS"], rpcFuncs, MapItem, MapFolder),
			      findMap = (folder: Folder, id: Uint): MapItem | undefined => {
				for (const [, item] of folder.children) {
					if (item instanceof Folder) {
						const m = findMap(item, id);
						if (m) {
							return m;
						}
					} else if (item.id === id) {
						return item as MapItem;
					}
				}
				return undefined;
			      },
			      setUserMap = (id: Uint, setCurrent: boolean = false) => {
				const m = findMap(root.folder, id);
				if (m) {
					m.setUserMap();
					if (setCurrent) {
						m.show();
					}
				}
			      };
			root.windowIcon = mapIcon;
			rpc.waitCurrentUserMap().then(setUserMap);
			let s = true;
			if (selectedMap.value > 0) {
				const m = findMap(root.folder, selectedMap.value);
				if (m) {
					m.show();
					s = false;
				}
			}
			if (userMap > 0) {
				setUserMap(userMap, s);
			}
			clearNode(base, {"id": mapList}, [
				button({"onclick": () => {
					const name = input({"type": "text", "onkeypress": enterKey}),
					      width = input({"type": "number", "min": 10, "max": 1000, "value": 30, "onkeypress": enterKey}),
					      height = input({"type": "number", "min": 10, "max": 1000, "value": 30, "onkeypress": enterKey}),
					      sqType = select([lang["MAP_SQUARE_TYPE_SQUARE"], lang["MAP_SQUARE_TYPE_HEX_H"], lang["MAP_SQUARE_TYPE_HEX_V"]].map((l, n) => option({"value": n}, l))),
					      sqWidth = input({"type": "number", "min": 1, "max": 1000, "value": 100}),
					      sqColour = input({"type": "color"}),
					      sqLineWidth = input({"type": "number", "min": 0, "max": 10, "value": 1}),
					      w = windows({"window-icon": mapIcon, "window-title": lang["MAP_NEW"]}, [
						h1(lang["MAP_NEW"]),
						labels(`${lang["MAP_NAME"]}: `, name),
						br(),
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
						button({"onclick": function(this: HTMLButtonElement) {
							amendNode(this, {"disabled": true});
							const sq = checkInt(parseInt(sqWidth.value), 1, 1000, 1);
							loadingWindow(rpc.newMap({
								"name": name.value,
								"width": checkInt(parseInt(width.value), 1, 1000, 1) * sq,
								"height": checkInt(parseInt(height.value), 1, 1000, 1) * sq,
								"gridType": checkInt(parseInt(sqType.value), 0, 2, 0),
								"gridSize": sq,
								"gridColour": hex2Colour(sqColour.value),
								"gridStroke": checkInt(parseInt(sqLineWidth.value), 0, 10, 0)
							}), w).then(({id, name}) => {
								root.addItem(id, name);
								w.remove();
							})
							.finally(() => amendNode(this, {"disabled": false}));
						}}, lang["MAP_ADD"])
					      ]);
					amendNode(shell, w);
					autoFocus(name);
				}}, lang["MAP_NEW"]),
				root[node]
			]);
		});
		return base;
	})(),
	true,
	mapIcon
] : null]);
