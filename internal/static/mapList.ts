import {FolderItems, Int, RPC, MapDetails} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {br, button, h1, h2, input, label, span} from './lib/html.js';
import {showError, enterKey, hex2Colour, colour2Hex} from './misc.js';
import {Root, Folder, Item, windowOptions} from './folders.js';
import {Shell} from './windows.js';

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
      };
let rpc: RPC, shell: Shell, selectedUser: MapItem | null = null, selectedCurrent: MapItem | null = null, sendCurrentMap: (id: Int) => void;

class MapItem extends Item {
	nameSpan: HTMLSpanElement;
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
		this.node.classList.add("mapItem");
		this.nameSpan = this.node.firstChild as HTMLSpanElement;
		this.node.insertBefore(span({"class": "setUserMap", "title": "Set User Map", "onclick": () => {
			this.setUserMap();
			rpc.setUserMap(id);
		}}), this.node.firstChild);
		this.node.removeChild(this.node.lastElementChild!.previousElementSibling!);
	}
	show() {
		setMap(this, selectedCurrent, "mapCurrent", "hasMapCurrent");
		selectedCurrent = this;
		sendCurrentMap(this.id);
	}
	rename() {
		if (this.node.classList.contains("mapCurrent") || this.node.classList.contains("mapUser")) {
			return createHTML(autoFocus(shell.addWindow("Invalid Action", windowOptions)), h2("Cannot rename active map"));
		} else {
			return super.rename();
		}
	}
	remove() {
		if (this.node.classList.contains("mapCurrent") || this.node.classList.contains("mapUser")) {
			return createHTML(autoFocus(shell.addWindow("Invalid Action", windowOptions)), h2("Cannot remove active map"));
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
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, children);
		[span({"class": "showCurrentMapFolder"}), span({"class": "showUserMapFolder"})].forEach(e => this.node.insertBefore(e, this.node.firstChild));
	}
	rename() {
		if (this.node.classList.contains("hasMapCurrent") || this.node.classList.contains("hasMapUser")) {
			return createHTML(shell.addWindow("Invalid Action", windowOptions), h2("Cannot rename while containing active map"));
		} else {
			return super.rename();
		}
	}
	remove() {
		if (this.node.classList.contains("hasMapCurrent") || this.node.classList.contains("hasMapUser")) {
			return createHTML(shell.addWindow("Invalid Action", windowOptions), h2("Cannot remove while containing active map"));
		} else {
			return super.remove();
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
			sendCurrentMap(0);
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
			sendCurrentMap(0);
		}
		return super.removeFolder(from);
	}
}

export default function(arpc: RPC, ashell: Shell, base: Node, setCurrentMap: (id: Int) => void) {
	rpc = arpc;
	shell = ashell;
	sendCurrentMap = setCurrentMap;
	const rpcFuncs = arpc["maps"];
	Promise.all([
		rpcFuncs.list(),
		rpc.getUserMap()
	]).then(([folderList, userMap]) => {
		const root = new MapRoot(folderList, "Maps", rpcFuncs, shell, MapItem, MapFolder),
		      findMap = (folder: Folder, id: Int): MapItem | undefined => {
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
		      setUserMap = (id: Int, setCurrent: boolean = false) => {
			const m = findMap(root.folder, userMap);
			if (m) {
				m.setUserMap();
				if (setCurrent) {
					m.show();
				}
			}
		      }
		rpc.waitCurrentUserMap().then(setUserMap);
		if (userMap > 0) {
			setUserMap(userMap, true);
		}
		createHTML(clearElement(base), {"id": "mapList"}, [
			button("New Map", {"onclick": () => {
				const name = autoFocus(input({"type": "text", "id": "mapName"})),
				      width = input({"type": "number", "min": "10", "max": "1000", "value": "30", "id": "mapWidth"}),
				      height = input({"type": "number", "min": "10", "max": "1000", "value": "30", "id": "mapHeight"}),
				      sqWidth = input({"type": "number", "min": "1", "max": "500", "value": "100", "id": "mapSquareWidth"}),
				      sqColour = input({"type": "color", "id": "mapSquareColour"}),
				      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": "1", "id": "mapSquareLineWidth"}),
				      window = shell.addWindow("New Map", windowOptions);
				return createHTML(window, {"class": "mapAdd"}, [
					h1("New Map"),
					label({"for": "mapName"}, "Name: "),
					name,
					br(),
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
						shell.addLoading(this.parentNode as HTMLDivElement, rpc.newMap({
							"id": 0,
							"name": name.value,
							"width": parseInt(width.value),
							"height": parseInt(height.value),
							"square": parseInt(sqWidth.value),
							"colour": hex2Colour(sqColour.value),
							"stroke": parseInt(sqLineWidth.value)
						})).then(({id, name}) => {
							root.addItem(id, name);
							shell.removeWindow(this.parentNode as HTMLDivElement);
						})
						.catch(e => showError(this, e));
					}})
				])
			}}),
			root.node
		]);
	});
}
