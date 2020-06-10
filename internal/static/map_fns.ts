import {Colour, GridDetails, Int, LayerFolder, LayerTokens} from './types.js';
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

export const isSVGFolder = (c: SVGFolder | SVGLayer): c is SVGFolder => (c as SVGFolder).children !== undefined,
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
isLayerFolder = (ld: LayerTokens | LayerFolder): ld is LayerFolder => (ld as LayerFolder).children !== undefined,
processLayers = (layer: LayerTokens | LayerFolder): SVGFolder | SVGLayer => {
	if (!layer["name"]) {
		layer["name"] = `Layer ${layerNum++}`;
	}
	const node = g();
	if (isLayerFolder(layer)) {
		const children = new SortNode<SVGFolder | SVGLayer>(node);
		layer.children.forEach(c => children.push(processLayers(c)));
		return Object.assign(layer, {node, children});
	}
	const tokens = new SortNode<SVGToken | SVGShape>(node);
	layer.tokens.forEach(t => {
		if (t["source"] === 0) {
			tokens.push(new SVGShape(t));
		} else {
			tokens.push(new SVGToken(t));
		}
	});
	return Object.assign(layer, {id: idNames[name] ?? 1, node, tokens});
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
addLayerFolder = (layerList: SVGFolder, path: string) => (layerList.children.push(processLayers({"id": 0, "name": splitAfterLastSlash(path)[1], "hidden": false, "mask": 0, "children": [], "folders": {}, "items": {}})), path),
renameLayer = (layerList: SVGFolder, path: string, name: string) => getLayer(layerList, path)!.name = name,
removeLayer = (layerList: SVGFolder, path: string) => {
	const [fromParent, layer] = getParentLayer(layerList, path);
	return (fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer));
},
addLayer = (layerList: SVGFolder, name: string) => (layerList.children.push(processLayers({name, "id": 0, "mask": 0, "hidden": false, "tokens": []})), name),
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
