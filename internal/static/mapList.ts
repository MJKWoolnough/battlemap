import {Uint} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {br, button, h1, h2, input, label, option, span, select} from './lib/html.js';
import {symbol, g, path, rect} from './lib/svg.js';
import {mapLoadSend, enterKey, hex2Colour, requestShell} from './misc.js';
import {Root, Folder, Item} from './folders.js';
import {loadingWindow, windows} from './windows.js';
import {addSymbol} from './symbols.js';
import {IntSetting} from './settings_types.js';
import lang from './language.js';
import {rpc} from './rpc.js';
import undo from './undo.js';

const setMap = (mapItem: MapItem | null, selected: MapItem | null, selectedClass: string, containsClass: string) => {
	if (selected) {
		selected.node.classList.remove(selectedClass);
		for (let curr: Folder | null = selected.parent; curr; curr = curr.parent) {
			curr.node.classList.remove(containsClass);
		}
	}
	if (mapItem) {
		mapItem.node.classList.add(selectedClass);
		for (let curr: Folder | null = mapItem.parent; curr; curr = curr.parent) {
			curr.node.classList.add(containsClass);
		}
	}
      },
      userSelected = addSymbol("userMapSelected", symbol({"viewBox": "0 0 47 47"}, [
	rect({"width": 47, height: 47, "fill": "#eee"}),
	g({"style": "display: var(--map-selected, none)"}, [
		rect({"width": 47, height: 47, "fill": "#cfc"}),
		path({"d": "M3,17 H11 V27 H35 V17 H43 V40 H3 M14,6 H32 V24 H14"})
	])
      ])),
      selectedMap = new IntSetting("selectedMap")
let selectedUser: MapItem | null = null, selectedCurrent: MapItem | null = null;

class MapItem extends Item {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		this.node.classList.add("mapItem");
		this.node.insertBefore(userSelected({"class": "setUserMap", "title": lang["MAP_SET_USER"], "onclick": () => {
			this.setUserMap();
			rpc.setUserMap(id);
		}}), this.node.firstChild);
		this.node.removeChild(this.node.lastElementChild!.previousElementSibling!);
	}
	show() {
		let thisMap: MapItem = this,
		    oldMap = selectedCurrent!;
		const doIt = () => {
			if (oldMap) {
				setMap(this, oldMap, "mapCurrent", "hasMapCurrent");
			}
			selectedCurrent = thisMap;
			mapLoadSend(thisMap.id);
			rpc.setCurrentMap(thisMap.id);
			selectedMap.set(thisMap.id);
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
		if (this.node.classList.contains("mapCurrent") || this.node.classList.contains("mapUser")) {
			return autoFocus(requestShell().appendChild(windows({"window-title": lang["INVALID_ACTION"]}, h2(lang["INVALID_RENAME"]))));
		} else {
			return super.rename();
		}
	}
	remove() {
		if (this.node.classList.contains("mapCurrent") || this.node.classList.contains("mapUser")) {
			return autoFocus(requestShell().appendChild(windows({"window-title": lang["INVALID_ACTION"]}, h2(lang["INVALID_REMOVE"]))));
		} else {
			return super.remove();
		}
	}
	setUserMap() {
		setMap(this, selectedUser, "mapUser", "hasMapUser");
		selectedUser = this;
	}
}

class MapFolder extends Folder {
	rename(e: Event) {
		if (this.node.classList.contains("hasMapCurrent") || this.node.classList.contains("hasMapUser")) {
			return requestShell().appendChild(windows({"window-title":  lang["INVALID_ACTION"]}, h2(lang["INVALID_RENAME_CONTAIN"])));
		} else {
			return super.rename(e);
		}
	}
	remove(e: Event) {
		if (this.node.classList.contains("hasMapCurrent") || this.node.classList.contains("hasMapUser")) {
			return requestShell().appendChild(windows({"window-title": "Invalid Action"}, h2(lang["INVALID_REMOVE_CONTAIN"])));
		} else {
			return super.remove(e);
		}
	}
}

class MapRoot extends Root {
	moveItem(from: string, to: string) {
		if (selectedCurrent && selectedCurrent.getPath() === from) {
			setMap(null, selectedCurrent, "mapCurrent", "hasMapCurrent");
			super.moveItem(from, to);
			setMap(selectedCurrent, null, "mapCurrent", "hasMapCurrent");
		} else {
			super.moveItem(from, to);
		}
	}
	removeItem(from: string) {
		if (selectedCurrent && selectedCurrent.getPath() === from) {
			setMap(null, selectedCurrent, "mapCurrent", "hasMapCurrent");
			mapLoadSend(0);
		}
		return super.removeItem(from);
	}
	moveFolder(from: string, to: string) {
		const [f] = this.resolvePath(from);
		if (f && f.node.classList.contains("hasMapCurrent")) {
			setMap(null, selectedCurrent, "mapCurrent", "hasMapCurrent");
			const t = super.moveFolder(from, to);
			setMap(selectedCurrent, null, "mapCurrent", "hasMapCurrent");
			return t;
		} else {
			return super.moveFolder(from, to);
		}
	}
	removeFolder(from: string) {
		const [f] = this.resolvePath(from);
		if (f && f.node.classList.contains("hasMapCurrent")) {
			setMap(null, selectedCurrent, "mapCurrent", "hasMapCurrent");
			mapLoadSend(0);
		}
		return super.removeFolder(from);
	}
}

export default function(base: Node) {
	const rpcFuncs = rpc["maps"];
	Promise.all([
		rpcFuncs.list(),
		rpc.getUserMap()
	]).then(([folderList, userMap]) => {
		const root = new MapRoot(folderList, "Maps", rpcFuncs, MapItem, MapFolder),
		      findMap = (folder: Folder, id: Uint): MapItem | undefined => {
			const m = folder.items.find(i => i.id === id);
			if (m) {
				return m as MapItem;
			}
			for (const f of folder.folders) {
				const m = findMap(f, id);
				if (m) {
					return m;
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
		      }
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
		createHTML(clearElement(base), {"id": "mapList"}, [
			button("New Map", {"onclick": () => {
				const name = autoFocus(input({"type": "text", "id": "mapName"})),
				      width = input({"type": "number", "min": "10", "max": "1000", "value": "30", "id": "mapWidth"}),
				      height = input({"type": "number", "min": "10", "max": "1000", "value": "30", "id": "mapHeight"}),
				      sqType = select({"id": "mapSquareType"}, [lang["MAP_SQUARE_TYPE_SQUARE"], lang["MAP_SQUARE_TYPE_HEX_H"], lang["MAP_SQUARE_TYPE_HEX_V"]].map((l, n) => option({"value": n}, l))),
				      sqWidth = input({"type": "number", "min": "1", "max": "500", "value": "100", "id": "mapSquareWidth"}),
				      sqColour = input({"type": "color", "id": "mapSquareColour"}),
				      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": "1", "id": "mapSquareLineWidth"}),
				      window = requestShell().appendChild(windows({"window-title": lang["MAP_NEW"]}));
				return createHTML(window, {"class": "mapAdd"}, [
					h1(lang["MAP_NEW"]),
					label({"for": "mapName"},  `${lang["MAP_NAME"]}: `),
					name,
					br(),
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
					button(lang["MAP_ADD"], {"onclick": function(this: HTMLButtonElement) {
						this.setAttribute("disabled", "disabled");
						const sq = parseInt(sqWidth.value);
						loadingWindow(rpc.newMap({
							"name": name.value,
							"width": parseInt(width.value) * sq,
							"height": parseInt(height.value) * sq,
							"gridType": parseInt(sqType.value),
							"gridSize": sq,
							"gridColour": hex2Colour(sqColour.value),
							"gridStroke": parseInt(sqLineWidth.value)
						}), window).then(({id, name}) => {
							root.addItem(id, name);
							window.remove();
						})
						.finally(() => this.removeAttribute("disabled"));
					}})
				])
			}}),
			root.node
		]);
	});
}
