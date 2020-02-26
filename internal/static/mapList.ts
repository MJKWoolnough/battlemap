import {FolderItems, Int, RPC, MapDetails, LayerType} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, h1, input, label, span} from './lib/dom.js';
import {showError, enterKey, hex2Colour, colour2Hex} from './misc.js';
import {Root, Folder, Item} from './folders.js';

const setMapDetails = (md: MapDetails, submitFn: (errNode: HTMLElement, md: MapDetails) => void) => {
	const name = input({"type": "text", "id": "mapName", "value": md.name}),
	      width = input({"type": "number", "min": "10", "max": "1000", "value": md.width.toString(), "id": "mapWidth"}),
	      height = input({"type": "number", "min": "10", "max": "1000", "value": md.height.toString(), "id": "mapHeight"}),
	      sqWidth = input({"type": "number", "min": "1", "max": "100", "value": md.square.toString(), "id": "mapSquareWidth"}),
	      sqColour = input({"type": "color", "value": colour2Hex(md.colour), "id": "mapSquareColour"}),
	      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": md.stroke.toString(), "id": "mapSquareLineWidth"});
	return createHTML(overlay.addLayer(), {"class": `map${md.id === 0 ? "Add" : "Edit"}`}, [
		h1(`${md.id === 0 ? "New" : "Edit"} Map`),
		label({"for": "mapName"}),
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
			submitFn(this.nextElementSibling as HTMLElement, {
				"id": md.id,
				"name": name.value,
				"width": parseInt(width.value),
				"height": parseInt(height.value),
				"square": parseInt(sqWidth.value),
				"colour": hex2Colour(sqColour.value),
				"stroke": parseInt(sqLineWidth.value)
			});
		}}),
		button("Cancel", {"onclick": () => overlay.removeLayer()})
	]);
      },
      setMap = (mapItem: MapItem, selected: MapItem, selectedClass: string, containsClass: string) => {
	if (selected) {
		selected.html.classList.remove(selectedClass);
		for (let curr: Folder | null = selected.parent; curr; curr = curr.parent) {
			curr.html.classList.remove(containsClass);
		}
	}
	mapItem.html.classList.add(selectedClass);
	for (let curr: Folder | null = mapItem.parent; curr; curr = curr.parent) {
		curr.html.classList.add(containsClass);
	}
      };
let rpc: RPC, overlay: LayerType, selectedUser: MapItem, selectedCurrent: MapItem;

class MapItem extends Item {
	nameSpan: HTMLSpanElement;
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
		this.nameSpan = this.html.firstChild as HTMLSpanElement;
		[
			span({"onclick": () => {
				this.setCurrentMap();
				rpc.setCurrentMap(id);
			}}),
			span({"onclick": () => {
				this.setUserMap();
				rpc.setUserMap(id);
			}})
		].forEach(e => this.html.insertBefore(e, this.html.firstChild));
	}
	show() {
		overlay.loading(rpc.getMapDetails(this.id)).then(md => setMapDetails(md, (errorNode: HTMLElement, md: MapDetails) => {
			overlay.loading(rpc.setMapDetails(md)).then(() => {
				this.nameSpan.innerText = md.name;
				this.name = md.name;
				this.parent.items.sort();
			}).catch(e => showError(errorNode, e));
		}))
		.catch(e => {
			console.log(e);
			alert(e);
		});
	}
	setCurrentMap() {
		setMap(this, selectedCurrent, "mapCurrent", "hasMapCurrent");
		selectedCurrent = this;
		// send id to map layer to load
	}
	setUserMap() {
		setMap(this, selectedUser, "mapUser", "hasMapUser");
		selectedUser = this;
	}
}

class MapFolder extends Folder {
	constructor(root: Root, parent: Folder | null, name: string, folders: Record<string, FolderItems>, items: Record<string, Int>) {
		super(root, parent, name, folders, items);
		[span(), span()].forEach(e => this.html.insertBefore(e, this.html.firstChild));
	}
}

export default function(arpc: RPC, aoverlay: LayerType, base: Node, setCurrentMap: (id: Int) => void) {
	rpc = arpc;
	overlay = aoverlay;
	const rpcFuncs = arpc["maps"];
	Promise.all([
		rpcFuncs.list(),
		rpc.getUserMap()
	]).then(([folderList, userMap]) => {
		const root = new Root(folderList, "Maps", rpcFuncs, overlay, MapItem, MapFolder),
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
					m.setCurrentMap();
				}
			}
		      }
		rpc.waitCurrentUserMap().then(setUserMap);
		if (userMap > 0) {
			setUserMap(userMap, true);
		}
		createHTML(clearElement(base), {"id": "mapList"}, [
			button("New Map", {"onclick": () => setMapDetails({
				"id": 0,
				"name": "",
				"width": 20,
				"height": 20,
				"square": 1,
				"colour": hex2Colour("#000000"),
				"stroke": 1
			}, (errorNode: HTMLElement, md: MapDetails) => {
				overlay.loading(rpc.newMap(md)).then(({id, name}) => {
					root.addItem(id, name);
					overlay.removeLayer();
				})
				.catch(e => showError(errorNode, e));
			})}),
			root.html
		]);
	});
}
