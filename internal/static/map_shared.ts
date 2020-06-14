import {Colour, GridDetails, MapDetails, Int, LayerFolder, LayerTokens, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {SortNode} from './lib/ordered.js';
import {defs, g, image, path, pattern, rect} from './lib/svg.js';
import {colour2RGBA, rgba2Colour} from './misc.js';


export type SVGLayer = LayerTokens & {
	node: SVGElement;
	tokens: SortNode<SVGToken | SVGShape>;
};

export type SVGFolder = LayerFolder & {
	node: SVGElement;
	children: SortNode<SVGFolder | SVGLayer>;
};

export class Defs {
	defs: SVGDefsElement;
	list: Record<string, SVGPatternElement> = {};
	constructor(root: Node) {
		this.defs = root.appendChild(defs());
	}
	add(t: SVGToken) {
		let i = 0;
		while (this.list[`Pattern_${i}`] !== undefined) {
			i++;
		}
		const id = `Pattern_${i}`;
		this.list[id] = this.defs.appendChild(pattern({"id": id, "width": t.width, "height": t.height}, t.node.cloneNode(false)));
		return id;
	}
	remove(id: string) {
		this.defs.removeChild(this.list[id]);
		delete(this.list[id]);
	}
	setGrid(grid: GridDetails) {
		const old = this.list["grid"];
		if (old) {
			this.defs.removeChild(old);
		}
		this.list["grid"] = this.defs.appendChild(pattern({"id": "gridPattern", "width": grid.gridSize, "height": grid.gridSize}, path({"path": `M 0 ${grid.gridSize} V 0 H ${grid.gridSize}`, "stroke": colour2RGBA(grid.gridColour), "stroke-width": grid.gridStroke})));
	}
}

export class SVGTransform {
	x: Int = 0;
	y: Int = 0;
	rotation: Int = 0;
	flip: boolean = false;
	flop: boolean = false;
	width: Int;
	height: Int;
	constructor(token: Token) {
		this.width = token.width;
		this.height = token.height;
		this.x = token.x;
		this.y = token.y;
		this.rotation = token.rotation;
		this.flip = token.flip;
		this.flop = token.flop;
	}
	toString(scale = true) {
		let ret = "";
		if (this.x !== 0 || this.y !== 0) {
			ret += `translate(${this.x + (scale && this.flop ? this.width : 0)}, ${this.y + (scale && this.flip ? this.height : 0)}) `;
		}
		if (scale && (this.flip || this.flop)) {
			ret += `scale(${this.flop ? -1 : 1}, ${this.flip ? -1 : 1}) `;
		}
		if (this.rotation !== 0) {
			ret += `rotate(${(scale && this.flop ? -1 : 1) * (scale && this.flip ? -1 : 1) * 360 * this.rotation / 256}, ${this.width / 2}, ${this.height / 2})`;
		}
		return ret;
	}
}

export class SVGToken {
	node: SVGImageElement | SVGRectElement;
	transform: SVGTransform;
	source: Int;
	stroke: Colour;
	strokeWidth: Int;
	x: Int;
	y: Int;
	width: Int;
	height: Int;
	patternWidth: Int;
	patternHeight: Int;
	rotation: Int;
	flip: boolean;
	flop: boolean;
	tokenData: Int;
	tokenType: Int;
	snap: boolean;
	constructor(token: Token) {
		throw new Error("use from");
	}
	static from(token: Token) {
		const transform = new SVGTransform(token),
		      svgToken = Object.setPrototypeOf(Object.assign(token, {"node": image({"href": `/images/${token.source}`, "preserveAspectRatio": "none", "width": token.width, "height": token.height, "transform": transform.toString()}), transform, "prototype": SVGToken}), SVGToken);
		if (token.patternWidth > 0) {
			svgToken.node = rect({"width": token.width, "height": token.height, "transform": transform.toString(), "fill": `url(#${globals.definitions.add(svgToken)})`});
		}
		return svgToken;
	}
	at(x: Int, y: Int) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.transform.width && ry >= 0 && ry < this.transform.height;
	}
	get isPattern() {
		return this.patternWidth > 0;
	}
	updateNode() {
		this.node.setAttribute("width", this.width + "");
		this.node.setAttribute("height", this.height + "");
		this.node.setAttribute("transform", this.transform.toString());
	}
}

export class SVGShape {
	node: SVGRectElement | SVGCircleElement;
	transform: SVGTransform;
	source: Int;
	stroke: Colour;
	strokeWidth: Int;
	x: Int;
	y: Int;
	width: Int;
	height: Int;
	rotation: Int;
	flip: boolean;
	flop: boolean;
	tokenData: Int;
	tokenType: Int;
	snap: boolean;
	constructor(token: Token) {
		this.transform = new SVGTransform(token);
		this.node = rect({"transform": this.transform.toString()});
		this.source = token.source;
		this.stroke = token.stroke;
		this.strokeWidth = token.strokeWidth;
		this.x = token.x;
		this.y = token.y;
		this.width = token.width;
		this.height = token.height;
		this.rotation = token.rotation;
		this.flip = token.flip;
		this.flop = token.flop;
		this.tokenData = token.tokenData;
		this.tokenType = token.tokenType;
		this.snap = token.snap;
	}
	at(x: Int, y: Int) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.transform.width && ry >= 0 && ry < this.transform.height;
	}
	get isPattern() {
		return false;
	}
	updateNode() {
		this.node.setAttribute("width", this.width + "");
		this.node.setAttribute("height", this.height + "");
		this.node.setAttribute("transform", this.transform.toString());
	}
}

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
getParentLayer = (path: string): [SVGFolder | null, SVGFolder | SVGLayer | null] => {
	const [parentStr, name] = splitAfterLastSlash(path),
	      parent = getLayer(globals.layerList, parentStr);
	if (!parent || !isSVGFolder(parent)) {
		return [null, null];
	}
	return [parent, getLayer(parent, name)];
},
getParentToken = (path: string, pos: Int): [SVGLayer | null, SVGToken | SVGShape | null] => {
	const parent = getLayer(globals.layerList, path);
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
			tokens.push(SVGToken.from(t));
		}
	});
	return Object.assign(layer, {id: idNames[name] ?? 1, node, tokens});
},
setLayerVisibility = (path: string, visibility: boolean) => {
	const layer = getLayer(globals.layerList, path)!;
	if (visibility) {
		layer.node.removeAttribute("visibility");
	} else {
		layer.node.setAttribute("visibility", "hidden");
	}
},
setTokenType = (path: string, pos: Int, imagePattern: boolean) => {
	const [layer, token] = getParentToken(path, pos);
	if (!token) {
		return;
	}
	const oldNode = token.node;
	if (imagePattern) {
		globals.definitions.remove(token.node.getAttribute("fill")!.replace(/^url(#/, "").replace(/)$/, ""));
		token.node = image({"preserveAspectRatio": "none", "width": token.width, "height": token.height, "transform": token.transform.toString(), "href": `/images/${token.source}`});
	} else {
		token.node = rect({"width": token.width, "height": token.height, "transform": token.transform.toString(), "fill": `url(#${globals.definitions.add(token as SVGToken)})`});
	}
	oldNode.replaceWith(token.node);
},
addLayerFolder = (path: string) => (globals.layerList.children.push(processLayers({"id": 0, "name": splitAfterLastSlash(path)[1], "hidden": false, "mask": 0, "children": [], "folders": {}, "items": {}})), path),
renameLayer = (path: string, name: string) => getLayer(globals.layerList, path)!.name = name,
removeLayer = (path: string) => {
	const [fromParent, layer] = getParentLayer(path);
	return (fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer));
},
addLayer = (name: string) => (globals.layerList.children.push(processLayers({name, "id": 0, "mask": 0, "hidden": false, "tokens": []})), name),
moveLayer = (from: string, to: string, pos: Int) => {
	const [parentStr, nameStr] = splitAfterLastSlash(from),
	      fromParent = getLayer(globals.layerList, parentStr)!,
	      toParent = getLayer(globals.layerList, to) as SVGFolder;
	if (isSVGFolder(fromParent)) {
		toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
	}
},
setMapDetails = (details: MapDetails) => {
	globals.root.setAttribute("width", details["width"].toString());
	globals.root.setAttribute("height", details["height"].toString());
	globals.definitions.setGrid(details);
	return details;
},
setLightColour = (c: Colour) => ((getLayer(globals.layerList, "/Light") as SVGLayer).tokens[0].node.setAttribute("fill", colour2RGBA(c)), c),
globals = {
	"definitions": null,
	"root": null,
	"layerList": null
} as unknown as {
	definitions: Defs,
	root: SVGSVGElement,
	layerList: SVGFolder
};
