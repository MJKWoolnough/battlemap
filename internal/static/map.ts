import {FromTo, IDName, Int, RPC, LayerFolder, LayerRPC} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';
import {Shell} from './windows.js';

const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
      };

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		let layerNum = 0;
		const root = (mapData as Document).getElementsByTagName("svg")[0],
		      layers = new Map<Int, string>(),
		      nameIDs = new Map<string, Int>(),
		      setNameID = (path: string, name: string) => {
			if (nameIDs.has(path + name)) {
				let a = 0;
				while (nameIDs.has(`${path}${name}_${a}`)) {
					a++;
				}
				name = `${name}_${a}`;
			}
			return name;
		      },
		      processLayers = (node: SVGGElement, path: string): LayerFolder => {
			const idStr = node.getAttribute("id") || "";
			let id: Int,
			    name = setNameID(path, node.getAttribute("data-name") || `Layer ${layerNum}`);
			switch (idStr) {
			case "Grid":
				id = -1;
				break;
			case "Light":
				id = -2;
				break;
			default:
				id = layerNum++;
			}
			layers.set(id, idStr);
			nameIDs.set(path + name, id);
			const layer = {"id": id, "name": name, "hidden": node.getAttribute("visibility") === "hidden", "mask": parseInt(node.getAttribute("mask")!), folders: {}, items: {}, children: []};
			if (node.firstChild && node.firstChild.nodeName === "g") {
				(Array.from(node.childNodes).filter(e => e instanceof SVGGElement) as SVGGElement[]).map(e =>processLayers(e, path + name + "/"));
			}
			return layer;
		      },
		      waitAdded = subFn<IDName[]>(),
		      waitMoved = subFn<FromTo>(),
		      waitRemoved = subFn<string>(),
		      waitFolderAdded = subFn<string>(),
		      waitFolderMoved = subFn<FromTo>(),
		      waitFolderRemoved = subFn<string>(),
		      waitLayerSetVisible = subFn<Int>(),
		      waitLayerSetInvisible = subFn<Int>(),
		      waitLayerAddMask = subFn<Int>(),
		      waitLayerRemoveMask = subFn<Int>();
		setLayers({
			"waitAdded": () => waitAdded[1],
			"waitMoved": () => waitMoved[1],
			"waitRemoved": () => waitRemoved[1],
			"waitLinked": () => new Subscription<IDName>(() => {}),
			"waitFolderAdded": () => waitFolderAdded[1],
			"waitFolderMoved": () => waitFolderMoved[1],
			"waitFolderRemoved": () => waitFolderRemoved[1],
			"waitLayerSetVisible": () => waitLayerSetVisible[1],
			"waitLayerSetInvisible": () => waitLayerSetInvisible[1],
			"waitLayerAddMask": () => waitLayerAddMask[1],
			"waitLayerRemoveMask": () => waitLayerRemoveMask[1],
			"list": () => Promise.resolve(processLayers(root.lastChild as SVGGElement, "/")),
			"createFolder": (path: string) => Promise.resolve(path),
			"move": (from: string, to: string) => Promise.resolve(to),
			"moveFolder": (from: string, to: string) => Promise.resolve(to),
			"remove": (path: string) => Promise.resolve(),
			"removeFolder": (path: string) => Promise.resolve(),
			"link": (id: Int, name: string) => Promise.resolve(name),
			"newLayer": (name: string) => Promise.resolve(0),
			"setVisibility": (id: Int, visibility: boolean)  => Promise.resolve(),
			"setLayer": (id: Int) => {},
			"setLayerMask": (id: Int) => {},
			"moveLayer": (id: Int, folderID: Int, pos: Int) => Promise.resolve()
		});
		base.appendChild(root);
	}));
}
