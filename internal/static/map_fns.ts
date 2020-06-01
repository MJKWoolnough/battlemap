import {Colour, GridDetails, Int} from './types.js';
import {Subscription} from './lib/inter.js';
import {SortNode} from './lib/ordered.js';
import {g, image, pattern, rect} from './lib/svg.js';
import {Defs, SVGLayer, SVGFolder, SVGGrid, SVGImage, SVGToken, SVGShape} from './map_types.js';

let layerNum = 0;

const splitAfterLastSlash = (path: string) => {
	const pos = path.lastIndexOf("/")
	return [path.slice(0, pos), path.slice(pos+1)];
      },
      idNames: Record<string, Int> = {
	"": 0,
	"Grid": -1,
	"Light": -2,
      };

export const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
},
isSVGFolder = (c: SVGFolder | SVGLayer): c is SVGFolder => (c as SVGFolder).children !== undefined,
isSVGLayer = (c: SVGFolder | SVGLayer): c is SVGLayer => (c as SVGLayer).tokens !== undefined,
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
getParentToken = (root: SVGFolder, path: string, pos: Int): [SVGLayer | null, SVGToken | SVGShape | null] => {
	const parent = getLayer(root, path);
	if (!parent || !isSVGLayer(parent)) {
		return [null, null];
	}
	return [parent as SVGLayer, parent.tokens[pos] as SVGToken | SVGShape];
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
setLayerVisibility = (layerList: SVGFolder, path: string, visibility: boolean) => {
	const layer = getLayer(layerList, path)!;
	if (visibility) {
		layer.node.removeAttribute("visibility");
	} else {
		layer.node.setAttribute("visibility", "hidden");
	}
},
setTokenType = (layerList: SVGFolder, definitions: Defs, path: string, pos: Int, imagePattern: boolean) => {
	const [layer, token] = getParentToken(layerList, path, pos),
	      newToken = imagePattern && token instanceof SVGToken ? new SVGShape(rect({"width": token.transform.width, "height": token.transform.height, "transform": token.transform.toString(), "fill": `url(#${definitions.add(pattern({"width": token.transform.width, "height": token.transform.height, "patternUnits": "userSpaceOnUse"}, image({"preserveAspectRatio": "none", "width": token.transform.width, "height": token.transform.height, "href": token.node.getAttribute("href")!})))})`})) : token instanceof SVGShape ? new SVGToken(image({"preserveAspectRatio": "none", "width": token.transform.width, "height": token.transform.height, "transform": token.transform.toString(), "href": (definitions.list[token.fillSrc] as SVGImage).source})) : null;
	if (layer && newToken && token) {
		newToken.snap = token.snap;
		layer.tokens.splice(pos, 1, newToken);
	}
	return newToken;
},
addLayerFolder = (layerList: SVGFolder, path: string) => (layerList.children.push(processLayers(g({"data-name": splitAfterLastSlash(path), "data-is-folder": "true"}))), path),
renameLayer = (layerList: SVGFolder, path: string, name: string) => getLayer(layerList, path)!.name = name,
removeLayer = (layerList: SVGFolder, path: string) => {
	const [fromParent, layer] = getParentLayer(layerList, path);
	return (fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer));
},
addLayer = (layerList: SVGFolder, name: string) => (layerList.children.push(processLayers(g({"data-name": name}))), name),
moveLayer = (layerList: SVGFolder, from: string, to: string, pos: Int) => {
	const [parentStr, nameStr] = splitAfterLastSlash(from),
	      fromParent = getLayer(layerList, parentStr)!,
	      toParent = getLayer(layerList, to) as SVGFolder;
	if (isSVGFolder(fromParent)) {
		toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
	}
},
setMapDetails = (root: SVGElement, definitions: Defs, details: GridDetails) => {
	const grid = definitions.list["gridPattern"] as SVGGrid;
	root.setAttribute("width", details["width"].toString());
	root.setAttribute("height", details["height"].toString());
	grid.width = details["square"];
	grid.stroke = details["colour"];
	grid.strokeWidth = details["stroke"];
	return details;
},
setLightColour = (layerList: SVGFolder, c: Colour) => ((getLayer(layerList, "/Light") as SVGLayer).tokens[0] as SVGShape).fill = c;
