import {Int, RPC, Map} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {button, li, ul} from './lib/dom.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';
import SortHTML, {SortHTMLType} from './lib/ordered.js';

const sorter = (a: MapItem, b: MapItem) => a.order - b.order; 
let n = 0;

class MapItem {
	html: Node;
	order = n++;
	id: Int;
	name: string;
	constructor(m: Map) {
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
		const list = SortHTML<MapItem>(ul(), sorter);
		mapList.forEach(m => list.push(new MapItem(m)));
		createHTML(clearElement(base), {"id": "mapList"}, [
			button("Add Map", {"onclick": () => createHTML(overlay.addLayer(), {"class": "mapAdd"}, [
				
			])}),
			list.html
		]);
	});
}
