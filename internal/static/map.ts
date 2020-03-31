import {Colour, FromTo, IDName, Int, RPC, Layer, LayerFolder, LayerRPC, ParentPath, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {g, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import {showError, enterKey, colour2RGBA, rgba2Colour} from './misc.js';
import {Shell} from './windows.js';

type SVGToken = {
	node: SVGElement;
};

type SVGLayer = Layer & {
	node: SVGElement;
	tokens: SortNode<SVGToken>;
};

type SVGPsuedo = Layer & {
	node: SVGGElement;
	id: Int;
};

type SVGFolder = LayerFolder & {
	node: SVGElement;
	children: SortNode<SVGFolder | SVGLayer | SVGPsuedo>;
};


const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
      },
      isSVGFolder = (c: SVGFolder | SVGLayer | SVGPsuedo): c is SVGFolder => (c as SVGFolder).children !== undefined,
      isSVGLayer = (c: SVGFolder | SVGLayer | SVGPsuedo): c is SVGLayer => (c as SVGLayer).tokens !== undefined,
      splitAfterLastSlash = (path: string) => {
	const pos = path.lastIndexOf("/")
	return [path.slice(0, pos), path.slice(pos+1)];
      },
      getLayer = (layer: SVGFolder | SVGLayer | SVGPsuedo, path: string) => path.split("/").every(p => {
	if (!isSVGFolder(layer)) {
		return false;
	}
	const a = (layer.children as SortNode<SVGFolder | SVGLayer | SVGPsuedo>).filter(c => c.name === p).pop();
	if (a) {
		layer = a;
		return true;
	}
	return false;
      }) ? layer : null,
      getParentLayer = (root: SVGFolder, path: string) => {
	const [parentStr, name] = splitAfterLastSlash(path),
	      parent = getLayer(root, parentStr);
	if (!parent) {
		return [null, null];
	}
	return [parent, getLayer(parent, name)];
      },
      getParentToken = (root: SVGFolder, path: string, pos: Int) => {
	const parent = getLayer(root, path);
	if (!parent || !isSVGLayer(parent)) {
		return [null, null];
	}
	return [parent, parent.tokens[pos]];
      };

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		const root = (mapData as Document).getElementsByTagName("svg")[0];
		let gridLayer = parseInt(root.getAttribute("data-grid-pos") || "-1"),
		    lightLayer = parseInt(root.getAttribute("data-light-pos") || "-1"),
		    gridOn = root.getAttribute("data-grid-on") === "true",
		    lightOn = root.getAttribute("data-light-on") === "true",
		    lightColour = rgba2Colour(root.getAttribute("data-light-colour") || "rgba(0, 0, 0, 0)"),
		    layerNum = 0;
		const processLayers = (node: SVGElement, path: string): SVGFolder | SVGLayer => {
			const name = node.getAttribute("data-name") || `Layer ${layerNum++}`;
			if (node.getAttribute("data-is-folder") === "true") {
				const node = g(),
				      l: SVGFolder = {
					node,
					"id": 1,
					name,
					"hidden": node.getAttribute("visibility") === "hidden",
					children: new SortNode<SVGFolder | SVGLayer | SVGPsuedo, SVGGElement>(node),
					folders: {},
					items: {},
				      };
				(Array.from(node.childNodes).filter(e => e instanceof SVGGElement) as SVGGElement[]).map((e, i) => processLayers(e, path + name + "/")).forEach(layer => {
					l.children.push(layer);
				});
				if (path === "/") {
					const grid = g({"fill": "url(#gridPattern)"}),
					      light = g({"fill": colour2RGBA(lightColour)});
					l.children.splice(gridLayer, 0, {"id": -1, "name": "Grid", "hidden": !gridOn, "mask": 0, "node": grid});
					l.children.splice(lightLayer, 0, {"id": -2, "name": "Light", "hidden": !lightOn, "mask": 0, "node": light});
				}
				return l;
			}
			const gnode = g(),
			      l: SVGLayer = {
				"id": path === "/" ? 0 : 1,
				name,
				"hidden": node.getAttribute("visibility") === "hidden",
				"mask": parseInt(node.getAttribute("mask") || "0"),
				node: gnode,
				tokens: new SortNode<SVGToken, SVGElement>(node)
			      };
			(Array.from(node.childNodes).filter(e => e instanceof SVGRectElement) as SVGRectElement[]).forEach(e => l.tokens.push({
				"node": e
			}));
			return l;
		      },
		      layerList = processLayers(root, "/") as SVGFolder,
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
			"createFolder": (path: string) => rpc.addLayerFolder(path).then(name => {
				const [parentStr] = splitAfterLastSlash(path);
				(getLayer(layerList, parentStr) as SVGFolder).children.push(processLayers(g({"data-name": name, "data-is-folder": "true"}), parentStr + "/"));
				return parentStr + "/" + name;
			}),
			"move": (from: string, to: string) => Promise.resolve(to),
			"moveFolder": (from: string, to: string) => Promise.resolve(to),
			"remove": (path: string) => Promise.resolve(),
			"removeFolder": (path: string) => Promise.resolve(),
			"link": (id: Int, path: string) => Promise.resolve(name),
			"newLayer": (name: string) => rpc.addLayer(name).then(name => {
				layerList.children.push(processLayers(g({"data-name": name}), "/"));
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
