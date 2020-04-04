import {FromTo, IDName, Int, RPC, Layer, LayerFolder, LayerRPC, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {g} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
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
      getLayer = (layer: SVGFolder | SVGLayer | SVGPsuedo, path: string) => path.split("/").filter(b => b).every(p => {
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
      getParentLayer = (root: SVGFolder, path: string): [SVGFolder | null, SVGFolder | SVGLayer | SVGPsuedo | null] => {
	const [parentStr, name] = splitAfterLastSlash(path),
	      parent = getLayer(root, parentStr);
	if (!parent || !isSVGFolder(parent)) {
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
		let layerNum = 0;
		root.setAttribute("data-is-folder", "true");
		root.setAttribute("data-name", "");
		const processLayers = (node: SVGElement): SVGFolder | SVGLayer => {
			const name = node.getAttribute("data-name") ?? `Layer ${layerNum++}`;
			let id = 1;
			switch (name) {
			case "":
				id = 0;
				break;
			case "Grid":
				id = -1;
				break;
			case "Light":
				id = -2;
				break;
			}
			console.log(id);
			if (node.getAttribute("data-is-folder") === "true") {
				const l: SVGFolder = {
					node,
					id,
					name,
					"hidden": node.getAttribute("visibility") === "hidden",
					children: new SortNode<SVGFolder | SVGLayer | SVGPsuedo>(node),
					folders: {},
					items: {},
				      };
				(Array.from(node.childNodes).filter(e => e instanceof SVGGElement) as SVGGElement[]).map(processLayers).forEach(layer => {
					l.children.push(layer);
				});
				return l;
			}
			const l: SVGLayer = {
				id,
				name,
				"hidden": node.getAttribute("visibility") === "hidden",
				"mask": node.getAttribute("mask") || "",
				node: node,
				tokens: new SortNode<SVGToken, SVGElement>(node)
			      };
			(Array.from(node.childNodes).filter(e => e instanceof SVGRectElement) as SVGRectElement[]).forEach(e => l.tokens.push({
				"node": e
			}));
			return l;
		      },
		      layerList = processLayers(root) as SVGFolder,
		      waitAdded = subFn<IDName[]>(),
		      waitMoved = subFn<FromTo>(),
		      waitRemoved = subFn<string>(),
		      waitFolderAdded = subFn<string>(),
		      waitFolderMoved = subFn<FromTo>(),
		      waitFolderRemoved = subFn<string>(),
		      waitLayerSetVisible = subFn<Int>(),
		      waitLayerSetInvisible = subFn<Int>(),
		      waitLayerAddMask = subFn<Int>(),
		      waitLayerRemoveMask = subFn<Int>(),
		      remove = (path: string) => {
			const [fromParent, layer] = getParentLayer(layerList, path);
			(fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer));
		      };
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
				(getLayer(layerList, parentStr) as SVGFolder).children.push(processLayers(g({"data-name": name, "data-is-folder": "true"})));
				return parentStr + "/" + name;
			}),
			"move": (from: string, to: string) => Promise.reject("invalid"),
			"moveFolder": (from: string, to: string) => Promise.reject("invalid"),
			"renameLayer": (path: string, name: string) => rpc.renameLayer(path, name).then(name => {
				getLayer(layerList, path)!.name = name;
				return name;
			}),
			"remove": (path: string) => rpc.removeLayer(path).then(() => remove(path)),
			"removeFolder": (path: string) => rpc.removeLayer(path).then(() => remove(path)),
			"link": (id: Int, path: string) => Promise.reject("invalid"),
			"newLayer": (name: string) => rpc.addLayer(name).then(name => {
				layerList.children.push(processLayers(g({"data-name": name})));
				return name;
			}),
			"setVisibility": (path: string, visibility: boolean)  => (visibility ? rpc.showLayer : rpc.hideLayer)(path).then(() => {
				const layer = getLayer(layerList, path)!;
				if (visibility) {
					layer.node.removeAttribute("visibility");
				} else {
					layer.node.setAttribute("visibility", "hidden");
				}
			}),
			"setLayer": (path: string) => {},
			"setLayerMask": (path: string) => {},
			"moveLayer": (from: string, to: string, pos: Int) => rpc.moveLayer(from, to, pos).then(() => {
				const [parentStr, nameStr] = splitAfterLastSlash(from),
				      fromParent = getLayer(layerList, parentStr)!,
				      toParent = getLayer(layerList, to) as SVGFolder;
				if (!isSVGFolder(fromParent)) {
					return;
				}
				toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
			}),
		});
		base.appendChild(root);
	}));
}
