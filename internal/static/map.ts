import {FromTo, IDName, Int, RPC, Layer, LayerFolder, LayerRPC, ParentPath} from './types.js';
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
      },
      isToken = (name: string) => name === "rect" || name === "circ" || name === "image";

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		const root = (mapData as Document).getElementsByTagName("svg")[0];
		let gridLayer = parseInt(root.getAttribute("data-grid-pos") || "-1"),
		    lightLayer = parseInt(root.getAttribute("data-light-pos") || "-1"),
		    gridOn = root.getAttribute("data-grid-on") === "true",
		    lightOn = root.getAttribute("data-light-on") === "true",
		    lightColour = rgba2Colour(root.getAttribute("data-light-colour") || "rgba(0, 0, 0, 0)");
		const processLayers = (node: SVGElement, path: string): [Layer | LayerFolder, SVGFolder | SVGLayer] => {
			let name = node.getAttribute("data-name")!;
			const layer: Layer | LayerFolder = {"id": path === "/" ? 0 : 1, name, "hidden": node.getAttribute("visibility") === "hidden", "mask": parseInt(node.getAttribute("mask") || "0"), folders: {}, items: {}, children: []},
			      children = Array.from(node.childNodes),
			      firstChild = children.filter(e => e instanceof SVGGElement || e instanceof SVGRectElement).shift();
			if (firstChild && !isToken(firstChild.nodeName)) {
				const gs = children.filter(e => e instanceof SVGGElement) as SVGGElement[],
				      l = layer as LayerFolder,
				      f = new SortNode<SVGFolder | SVGLayer | SVGPsuedo>(node);
				l.children = gs.map((e, i) => processLayers(e, path + name + "/")).map(([e, l]) => {
					f.push(l);
					return e;
				});
				if (path === "/") {
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
		      [layerList, folderList] = processLayers(root, "/") as [LayerFolder, SVGFolder],
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
			"createFolder": (path: string) => Promise.resolve(name),
			"move": (from: string, to: string) => Promise.resolve(to),
			"moveFolder": (from: string, to: string) => Promise.resolve(to),
			"remove": (path: string) => Promise.resolve(),
			"removeFolder": (path: string) => Promise.resolve(),
			"link": (id: Int, path: string) => Promise.resolve(name),
			"newLayer": (name: string) => rpc.addLayer(name).then(name => {
				const l = g(),
				      idPath = [layerList.children.length + 1];
				layerList.children.push({"id": 1, name, "hidden": false, "mask": 0});
				folderList.layers.push({"node": l, "tokens": new SortNode<SVGToken>(l)});
				return name;
			}),
			"setVisibility": (path: string, visibility: boolean)  => Promise.resolve(),
			"setLayer": (path: string) => {},
			"setLayerMask": (path: string) => {},
			"moveLayer": (from: string, to: string, pos: Int) => Promise.resolve()
		});
		base.appendChild(root);
	}));
}
