import {FromTo, IDName, Int, RPC, Layer, LayerFolder, LayerRPC} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {g, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import {showError, enterKey, colour2RGBA, rgba2Colour} from './misc.js';
import {Shell} from './windows.js';

type SVGToken = {
	node: SVGRectElement;
};

type SVGLayer = {
	node: SVGElement;
	tokens: SortNode<SVGToken>;
};

type SVGPsuedo = {
	node: SVGGElement;
};

type SVGFolder = {
	node: SVGElement;
	layers: SortNode<SVGFolder | SVGLayer | SVGPsuedo>;
};

const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
      };

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		const root = (mapData as Document).getElementsByTagName("svg")[0];
		let layerNum = 0,
		    gridLayer = parseInt(root.getAttribute("data-grid") || "-1"),
		    lightLayer = parseInt(root.getAttribute("data-light") || "-1"),
		    gridOn = root.getAttribute("data-grid-on") === "true",
		    lightOn = root.getAttribute("data-light-on") === "true",
		    lightColour = rgba2Colour(root.getAttribute("data-light-colour") || "rgba(0, 0, 0, 0)");
		const layers = new Map<Int, Int[]>(),
		      nameIDs = new Map<string, Int[]>(),
		      processLayers = (node: SVGElement, path: string, idPath: Int[]): [Layer | LayerFolder, SVGFolder | SVGLayer] => {
			const id = layerNum++;
			let name = node.getAttribute("data-name") || `Layer ${layerNum}`;
			layers.set(id, idPath);
			nameIDs.set(path + name, idPath);
			const layer: Layer | LayerFolder = {"id": id, "name": name, "hidden": node.getAttribute("visibility") === "hidden", "mask": parseInt(node.getAttribute("mask") || "0"), folders: {}, items: {}, children: []},
			      children = Array.from(node.childNodes),
			      firstChild = children.filter(e => e instanceof SVGGElement || e instanceof SVGRectElement).shift();
			if (firstChild && firstChild.nodeName === "g") {
				const gs = children.filter(e => e instanceof SVGGElement) as SVGGElement[],
				      l = layer as LayerFolder,
				      f = new SortNode<SVGFolder | SVGLayer | SVGPsuedo>(node);
				l.children = gs.map((e, i) => processLayers(e, path + name + "/", idPath.concat(i))).map(([e, l]) => {
					f.push(l);
					return e;
				});
				if (idPath.length === 0) {
					l.children.splice(gridLayer, 0, {"id": -1, "name": "Grid", "hidden": !gridOn, "mask": 0});
					f.splice(gridLayer, 0, {"node": g({"fill": "url(#gridPattern)"})});
					l.children.splice(lightLayer, 0, {"id": -2, "name": "Light", "hidden": !lightOn, "mask": 0});
					f.splice(lightLayer, 0, {"node": g({"fill": colour2RGBA(lightColour)})});
				}
				return [layer, {"node": node, "layers": f}];
			}
			const r = new SortNode<SVGToken>(node);
			(children.filter(e => e instanceof SVGRectElement) as SVGRectElement[]).forEach(e => r.push({"node": e}));
			return [layer, {"node": node, "tokens": r}];
		      },
		      [layerList, folderList] = processLayers(root, "/", []),
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
			"list": () => Promise.resolve(layerList as LayerFolder),
			"createFolder": (path: string) => Promise.resolve(path),
			"move": (from: string, to: string) => Promise.resolve(to),
			"moveFolder": (from: string, to: string) => Promise.resolve(to),
			"remove": (path: string) => Promise.resolve(),
			"removeFolder": (path: string) => Promise.resolve(),
			"link": (path: Int, name: string) => Promise.resolve(name),
			"newLayer": (name: string) => Promise.resolve(),
			"setVisibility": (id: Int, visibility: boolean)  => Promise.resolve(),
			"setLayer": (id: Int) => {},
			"setLayerMask": (id: Int) => {},
			"moveLayer": (id: Int, to: Int, pos: Int) => Promise.resolve()
		});
		base.appendChild(root);
	}));
}
