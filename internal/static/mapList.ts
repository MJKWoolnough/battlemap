import {Int, RPC, Map} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, h1, input, label, li, ul} from './lib/dom.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';
import SortHTML, {SortHTMLType} from './lib/ordered.js';

const sorter = (a: MapItem, b: MapItem) => a.order - b.order; 
let n = 0;

class MapList {
	list = SortHTML<MapItem>(ul(), sorter);
	rpc: RPC;
	overlay: LayerType;
	constructor(rpc: RPC, overlay: LayerType) {
		this.rpc = rpc;
		this.overlay = overlay;
	}
	addMap(m: Map) {
		this.list.push(new MapItem(this, m));
	}
	get html() {
		return this.list.html;
	}
}

class MapItem {
	list: MapList;
	html: Node;
	order = n++;
	id: Int;
	name: string;
	constructor(mapList: MapList, m: Map) {
		this.list = mapList;
		this.id = m.id;
		this.name = m.name;
		this.html = li(
			m.name
		);
	}
}

export default function(rpc: RPC, overlay: LayerType, base: Node) {
	Promise.all([
		rpc.getMapList(),
		rpc.getCurrentMap(),
		rpc.getUserMap()
	]).then(([mapList, currentMap, userMap]) => {
		const list = new MapList(rpc, overlay);
		rpc.waitCurrentUserMap().then(mapID => {

		});
		rpc.waitMapAdd().then(map => {

		});
		rpc.waitMapRename().then(map => {

		});
		rpc.waitMapOrderChange().then(maps => {

		});
		rpc.getMapList().then(mapList => {

		});
		mapList.forEach(m => list.addMap(m));
		createHTML(clearElement(base), {"id": "mapList"}, [
			button("Add Map", {"onclick": () => {
				const name = input({"type": "text", "id": "mapName"}),
				      width = input({"type": "number", "min": "10", "max": "1000", "value": "20", "id": "mapWidth"}),
				      height = input({"type": "number", "min": "10", "max": "1000", "value": "20", "id": "mapHeight"}),
				      sqWidth = input({"type": "number", "min": "1", "max": "100", "value": "10", "id": "mapSquareWidth"}),
				      sqColour = input({"type": "color", "value": "#000000", "id": "mapSquareColour"}),
				      sqLineWidth = input({"type": "number", "min": "0", "max": "10", "value": "1", "id": "mapSquareLineWidth"});
				return createHTML(overlay.addLayer(), {"class": "mapAdd"}, [
					h1("Add Map"),
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
						overlay.loading(rpc.newMap({
							"name": name.value,
							"width": parseInt(width.value),
							"height": parseInt(height.value),
							"square": parseInt(sqWidth.value),
							"colour": {
								"r": parseInt(sqColour.value.slice(1, 3), 16),
								"g": parseInt(sqColour.value.slice(3, 5), 16),
								"b": parseInt(sqColour.value.slice(5, 7), 16),
								"a": 1,
							},
							"stroke": parseInt(sqLineWidth.value)
						})).then(mapID => list.addMap({"id": mapID, "name": name.value || `Map ${mapID}`})).catch(e => showError(this.nextElementSibling as Node, e));
					}}),
					button("Cancel", {"onclick": () => overlay.removeLayer()})
				]);
			}}),
			list.html
		]);
	});
}
