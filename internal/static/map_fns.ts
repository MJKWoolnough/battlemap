import {Int} from './types.js';
import {Subscription} from './lib/inter.js';
import {SortNode} from './lib/ordered.js';
import {SVGLayer, SVGFolder, SVGToken, SVGShape} from './map_types.js';
import {item, menu, disable, List} from './lib/context.js';

let layerNum = 0;

export const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
},
isSVGFolder = (c: SVGFolder | SVGLayer): c is SVGFolder => (c as SVGFolder).children !== undefined,
isSVGLayer = (c: SVGFolder | SVGLayer): c is SVGLayer => (c as SVGLayer).tokens !== undefined,
splitAfterLastSlash = (path: string) => {
	const pos = path.lastIndexOf("/")
	return [path.slice(0, pos), path.slice(pos+1)];
},
getLayer = (layer: SVGFolder | SVGLayer, path: string) => path.split("/").filter(b => b).every(p => {
	if (!isSVGFolder(layer)) {
		return false;
	}
	const a = (layer.children as SortNode<SVGFolder | SVGLayer>).filter(c => c.name === p).pop();
	if (a) {
		layer = a;
		return true;
	}
	return false;
}) ? layer : null,
getParentLayer = (root: SVGFolder, path: string): [SVGFolder | null, SVGFolder | SVGLayer | null] => {
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
},
idNames: Record<string, Int> = {
	"": 0,
	"Grid": -1,
	"Light": -2,
},
processLayers = (node: SVGElement): SVGFolder | SVGLayer => {
	const name = node.getAttribute("data-name") ?? `Layer ${layerNum++}`,
	      hidden = node.getAttribute("visibility") === "hidden",
	      id = idNames[name] ?? 1;
	return node.getAttribute("data-is-folder") === "true" ? {
		id,
		node,
		name,
		hidden,
		children: SortNode.from<SVGFolder | SVGLayer>(node, c => c instanceof SVGGElement ? processLayers(c) : undefined),
		folders: {},
		items: {},
	} : {
		id,
		node,
		name,
		hidden,
		mask: node.getAttribute("mask") || "",
		tokens: SortNode.from<SVGToken | SVGShape, SVGElement>(node, c => c instanceof SVGImageElement ? new SVGToken(c) : c instanceof SVGRectElement || c instanceof SVGCircleElement ? new SVGShape(c) : undefined)
	};
},
walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as SortNode<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn))),
ratio = (mDx: Int, mDy: Int, width: Int, height: Int, dX: (-1 | 0 | 1), dY: (-1 | 0 | 1)) => {
	mDx *= dX;
	mDy *= dY;
	if (dX !== 0 && mDy < mDx * height / width || dY === 0) {
		mDy = mDx * height / width;
	} else {
		mDx = mDy * width / height;
	}
	if (width + mDx < 10) {
		mDx = 10 - width;
		mDy = 10 * height / width - height;
	}
	if (height + mDy < 10) {
		mDx = 10 * width / height - width;
		mDy = 10 - height;
	}
	return [mDx * dX, mDy * dY];
},
noop = <T>(e: T) => e,
makeLayerContext = (folder: SVGFolder, fn: (path: string) => void, disabled = "", path = "/"): List => (folder.children as SortNode<SVGFolder | SVGLayer>).map(e => isSVGFolder(e) ? menu(e.name, makeLayerContext(e, fn, disabled, path + e.name + "/")) : (e.name === "disabled" ? disable : noop)(item(e.name, fn.bind(e, path + e.name))));
