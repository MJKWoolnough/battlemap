import type {Colour, GridDetails, KeystoreData, MapDetails, Byte, Int, Uint, LayerFolder, LayerTokens, Token, TokenImage, TokenShape, TokenDrawing, MapData, Coords, Wall, TokenSet} from './types.js';
import {SortNode} from './lib/ordered.js';
import {clearElement} from './lib/dom.js';
import {createSVG, defs, ellipse, filter, g, image, path, pattern, polygon, rect, svg} from './lib/svg.js';
import {characterData, mapLoadedSend, tokenSelected, queue} from './shared.js';
import {colour2RGBA} from './colours.js';
import {div} from './lib/html.js';
import {toolMapMouseDown, toolMapContext, toolMapWheel, toolMapMouseOver} from './tools.js';
import {rpc} from './rpc.js';
import {tokenClass} from './plugins.js';

export type SVGLayer = LayerTokens & {
	node: SVGElement;
	path: string;
	tokens: SortNode<SVGToken | SVGShape>;
};

export type SVGFolder = LayerFolder & {
	node: SVGElement;
	path: string;
	children: SortNode<SVGFolder | SVGLayer>;
};

class Defs {
	node = defs();
	list: Record<string, SVGPatternElement> = {};
	lighting: Record<string, SVGFilterElement> = {};
	add(t: SVGToken) {
		let i = 0;
		while (this.list[`Pattern_${i}`] !== undefined) {
			i++;
		}
		const id = `Pattern_${i}`;
		this.list[id] = this.node.appendChild(pattern({"id": id, "patternUnits": "userSpaceOnUse", "width": t.patternWidth, "height": t.patternHeight}, image({"href": `/images/${t.src}`, "width": t.patternWidth, "height": t.patternHeight, "preserveAspectRatio": "none"})));
		return id;
	}
	remove(id: string) {
		this.node.removeChild(this.list[id]).firstChild as SVGImageElement;
		delete(this.list[id]);
	}
	setGrid(grid: GridDetails) {
		const old = this.list["grid"];
		if (old) {
			this.node.removeChild(old);
		}
		switch (grid.gridType) {
		case 1: {
			const w = grid.gridSize,
			      h = 2 * w / SQRT3,
			      maxH = 2 * Math.round(1.5 * w / SQRT3);
			this.list["grid"] = this.node.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": w, "height": maxH}, path({"d": `M${w / 2},${maxH} V${h} l${w / 2},-${h / 4} V${h / 4} L${w / 2},0 L0,${h / 4} v${h / 2} L${w / 2},${h}`, "stroke": colour2RGBA(grid.gridColour), "stroke-width": grid.gridStroke, "fill": "transparent"})));
		}; break;
		case 2: {
			const h = grid.gridSize,
			      w = 2 * h / SQRT3,
			      maxW = 2 * Math.round(1.5 * h / SQRT3);
			this.list["grid"] = this.node.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": maxW, "height": h}, path({"d": `M${maxW},${h / 2} H${w} l-${w / 4},${h / 2} H${w / 4} L0,${h / 2} L${w / 4},0 h${w / 2} L${w},${h/2}`, "stroke": colour2RGBA(grid.gridColour), "stroke-width": grid.gridStroke, "fill": "transparent"})));
		}; break;
		default:
			this.list["grid"] = this.node.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": grid.gridSize, "height": grid.gridSize}, path({"d": `M0,${grid.gridSize} V0 H${grid.gridSize}`, "stroke": colour2RGBA(grid.gridColour), "stroke-width": grid.gridStroke, "fill": "transparent"})));
		}
	}
	getLighting(id: string) {
		if (this.lighting[id]) {
			return this.lighting[id];
		}
		return this.lighting[id] = this.node.appendChild(filter({id}));
	}
	clearLighting() {
		for (const key in this.lighting) {
			this.lighting[key].remove();
			delete this.lighting[key];
		}
	}
}

class SVGTransform {
	id: Uint;
	x: Int = 0;
	y: Int = 0;
	rotation: Byte = 0;
	flip: boolean = false;
	flop: boolean = false;
	width: Uint;
	height: Uint;
	lightColour: Colour;
	lightIntensity: Uint;
	constructor(token: Token) {
		this.id = token.id;
		this.width = token.width;
		this.height = token.height;
		this.x = token.x;
		this.y = token.y;
		this.rotation = token.rotation;
		this.lightColour = token.lightColour;
		this.lightIntensity = token.lightIntensity;
	}
	at(x: Int, y: Int, node: SVGGraphicsElement) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.width && ry >= 0 && ry < this.height;
	}
	transformString(scale = true) {
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

export class SVGToken extends SVGTransform {
	node: SVGGraphicsElement;
	src: Uint;
	stroke: Colour;
	strokeWidth: Uint;
	patternWidth: Uint;
	patternHeight: Uint;
	tokenData: Record<string, KeystoreData>;
	tokenType: Uint;
	snap: boolean;
	constructor(token: TokenImage) {
		throw new Error("use from");
		super(token);
	}
	static from(token: TokenImage) {
		const node = image(),
		      tc = tokenClass() ?? SVGToken,
		      svgToken = Object.setPrototypeOf(Object.assign(token, {node}), tc.prototype);
		createSVG(node, {"class": "mapToken", "href": `/images/${token.src}`, "preserveAspectRatio": "none", "width": token.patternWidth > 0 ? token.patternWidth : token.width, "height": token.patternHeight > 0 ? token.patternHeight : token.height, "transform": svgToken.transformString()});
		Object.defineProperty(svgToken, "node", {"enumerable": false});
		if (svgToken.init instanceof Function) {
			svgToken.init();
		}
		if (token.patternWidth > 0) {
			svgToken.updateNode();
		}
		return svgToken;
	}
	at(x: Int, y: Int, node = this.node) {
		return super.at(x, y, node);
	}
	get isPattern() {
		return this.patternWidth > 0;
	}
	cleanup() {
		if (this.isPattern) {
			globals.definitions.remove(this.node.getAttribute("fill")!.slice(5, -1));
		}
	}
	uncleanup() {
		if (this.isPattern) {
			this.node.setAttribute("fill", `url(#${globals.definitions.add(this)})`);
		}
	}
	updateSource(source: Uint) {
		(this.node instanceof SVGRectElement ? (globals.definitions.list[this.node.getAttribute("fill")!.slice(5, -1)]!.firstChild as SVGImageElement) : this.node).setAttribute("href", `images/${this.src = source}`);
	}
	updateNode() {
		if (this.node instanceof SVGRectElement && !this.isPattern) {
			globals.definitions.remove(this.node.getAttribute("fill")!.slice(5, -1));
			this.node.replaceWith(this.node = image({"href": `/images/${this.src}`, "preserveAspectRatio": "none"}));
		} else if (this.node instanceof SVGImageElement && this.isPattern) {
			this.node.replaceWith(this.node = rect({"class": "mapPattern", "fill": `url(#${globals.definitions.add(this)})`}));
		}
		createSVG(this.node, {"width": this.width, "height": this.height, "transform": this.transformString()});
	}
	getData(key: string) {
		if (this.tokenData[key]) {
			return this.tokenData[key]["data"];
		} else if (this.tokenData["store-character-id"]) {
			const char = characterData.get(this.tokenData["store-character-id"]["data"]);
			if (char && char[key]) {
				return char[key]["data"];
			}
		}
		return null;
	}
}

export class SVGShape extends SVGTransform {
	node: SVGRectElement | SVGEllipseElement;
	fill: Colour;
	stroke: Colour;
	strokeWidth: Uint;
	isEllipse: boolean;
	snap: boolean;
	constructor(token: TokenShape) {
		throw new Error("use from");
		super(token);
	}
	static from(token: TokenShape) {
		let node: SVGGraphicsElement;
		if (!(token as any).isEllipse) {
			(token as any).isEllipse = false;
			node = rect({"width": token.width, "height": token.height});
		} else {
			const rx = token.width / 2,
			      ry = token.height / 2;
			node = ellipse({"cx": rx, "cy": ry, rx, ry});
		}
		const svgShape = Object.setPrototypeOf(Object.assign(token, {node}), SVGShape.prototype);
		createSVG(node, {"class": "mapShape", "fill": colour2RGBA(token.fill), "stroke": colour2RGBA(token.stroke), "stroke-width": token.strokeWidth, "transform": svgShape.transformString()});
		Object.defineProperty(svgShape, "node", {"enumerable": false});
		return svgShape;
	}
	at(x: Int, y: Int) {
		return super.at(x, y, this.node);
	}
	get isPattern() {
		return false;
	}
	updateNode() {
		if (this.isEllipse) {
			const rx = this.width / 2,
			      ry = this.height / 2;
			createSVG(this.node, {"cx": rx, "cy": ry, rx, ry, "transform": this.transformString()});
		} else {
			createSVG(this.node, {"width": this.width, "height": this.height, "transform": this.transformString()});
		}
	}
}

export class SVGDrawing extends SVGShape {
	points: Coords[];
	oWidth: Uint;
	oHeight: Uint;
	constructor(token: TokenDrawing) {
		throw new Error("use from");
		super(token);
	}
	static from(token: TokenDrawing) {
		(token as any).isEllipse = false;
		let oWidth: Uint = 0,
		    oHeight: Uint = 0;
		for (const c of token.points) {
			if (c.x > oWidth) {
				oWidth = c.x;
			}
			if (c.y > oHeight) {
				oHeight = c.y;
			}
		}
		const xr = token.width / oWidth,
		      yr = token.height / oHeight,
		      node = path({"class": "mapDrawing", "d": `M${token.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${token.fill.a === 0 ? "" : " Z"}`, "fill": colour2RGBA(token.fill), "stroke": colour2RGBA(token.stroke), "stroke-width": token.strokeWidth}),
		      svgDrawing = Object.setPrototypeOf(Object.assign(token, {node, oWidth, oHeight}), SVGDrawing.prototype);
		node.setAttribute("transform", svgDrawing.transformString());
		Object.defineProperty(svgDrawing, "node", {"enumerable": false});
		return svgDrawing;
	}
	updateNode() {
		const xr = this.width / this.oWidth,
		      yr = this.height / this.oHeight;
		createSVG(this.node, {"d": `M${this.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${this.fill.a === 0 ? "" : " Z"}`, "transform": this.transformString()});
	}
}

const idNames: Record<string, Int> = {
	"": 0,
	"Grid": -1,
	"Light": -2,
      },
      processLayers = (layer: LayerTokens | LayerFolder, path = ""): SVGFolder | SVGLayer => {
	path += "/" + layer.name
	const node = g();
	if (layer.hidden) {
		node.classList.add("hiddenLayer");
	}
	if (isLayerFolder(layer)) {
		const children = new SortNode<SVGFolder | SVGLayer>(node);
		for (const c of layer.children) {
			children.push(processLayers(c, path));
		}
		return Object.assign(layer, {node, children, path});
	}
	const tokens = new SortNode<SVGToken | SVGShape>(node);
	if (layer.name !== "Grid" && layer.name !== "Light") {
		for (const t of layer.tokens) {
			if (isTokenImage(t)) {
				tokens.push(SVGToken.from(t));
			} else if (isTokenDrawing(t)) {
				tokens.push(SVGDrawing.from(t));
			} else {
				tokens.push(SVGShape.from(t));
			}
		};
	} else {
		node.setAttribute("id", `layer${layer.name}`);
		layer.walls = [];
	}
	return Object.assign(layer, {id: idNames[layer.name] ?? 1, node, path, tokens});
      },
      isLayerFolder = (ld: LayerTokens | LayerFolder): ld is LayerFolder => (ld as LayerFolder).children !== undefined;

export const SQRT3 = Math.sqrt(3),
deselectToken = () => {
	globals.selected.token = null;
	globals.outline.style.setProperty("display", "none");
	tokenSelected();
	globals.root.focus();
},
point2Line = (px: Int, py: Int, x1: Int, y1: Int, x2: Int, y2: Int) => {
	if (x1 === x2) {
		if (py >= y1 && py <= y2) {
			return Math.abs(px - x1);
		}
		return Math.hypot(px - x1, Math.min(Math.abs(py - y1), Math.abs(py - y2)));
	} else if (y1 === y2) {
		if (px >= x1 && px <= x2) {
			return Math.abs(py - y1);
		}
		return Math.hypot(Math.min(Math.abs(px - x1), Math.abs(px - x2)), py - y1);
	}
	const m = (y2 - y1) / (x2 - x1),
	      n = (x1 - x2) / (y2 - y1),
	      c = y1 - m * x1,
	      d = py - px * n;
	let cx = (d - c) / (m - n);
	if (cx < x1) {
		cx = x1;
	} else if (cx > x2) {
		cx = x2;
	}
	return Math.hypot(px - cx, py - m * cx - c);
},
splitAfterLastSlash = (path: string) => {
	const pos = path.lastIndexOf("/")
	return [path.slice(0, pos), path.slice(pos+1)];
},
walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as SortNode<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn))),
walkLayers = (fn: (e: SVGLayer, hidden: boolean) => void, folder: SVGFolder = globals.layerList, hidden = false) => {
	for (const e of (folder.children as (SVGFolder | SVGLayer)[])) {
		if (isSVGLayer(e)) {
			fn(e, hidden || e.hidden);
		} else {
			walkLayers(fn, e, hidden || e.hidden);
		}
	}
},
isSVGFolder = (c: SVGFolder | SVGLayer): c is SVGFolder => (c as SVGFolder).children !== undefined,
isSVGLayer = (c: SVGFolder | SVGLayer): c is SVGLayer => (c as SVGLayer).tokens !== undefined,
getLayer = (path: string, layer: SVGFolder | SVGLayer = globals.layerList) => path.split("/").filter(b => b).every(p => {
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
	      parent = getLayer(parentStr);
	if (!parent || !isSVGFolder(parent)) {
		return [null, null];
	}
	return [parent, getLayer(name, parent)];
},
setLayerVisibility = (path: string, visibility: boolean) => {
	const layer = getLayer(path)!;
	if (visibility) {
		layer.node.classList.remove("hiddenLayer");
	} else {
		layer.node.classList.add("hiddenLayer");
	}
	layer.hidden = !visibility;
	updateLight();
},
addLayerFolder = (path: string) => (globals.layerList.children.push(processLayers({"id": 0, "name": splitAfterLastSlash(path)[1], "hidden": false, "mask": 0, "children": [], "folders": {}, "items": {}})), path),
renameLayer = (path: string, name: string) => {
	const l = getLayer(path)!;
	l.name = name
	l.path = `${splitAfterLastSlash(path)[0]}/${name}`;
	return name;
},
removeLayer = (path: string) => {
	const [fromParent, layer] = getParentLayer(path);
	(fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer));
	updateLight();
},
addLayer = (name: string) => (globals.layerList.children.push(processLayers({name, "id": 0, "mask": 0, "hidden": false, "tokens": [], "walls": []})), name),
moveLayer = (from: string, to: string, pos: Uint) => {
	const [parentStr, nameStr] = splitAfterLastSlash(from),
	      fromParent = getLayer(parentStr)!,
	      toParent = getLayer(to) as SVGFolder;
	if (isSVGFolder(fromParent)) {
		const l = (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop();
		l.path = to + "/" + l.name;
		toParent.children.splice(pos, 0, l);

	}
	updateLight();
},
setMapDetails = (details: MapDetails) => {
	Object.assign(globals.mapData, details);
	globals.root.setAttribute("width", details["width"].toString());
	globals.root.setAttribute("height", details["height"].toString());
	globals.definitions.setGrid(details);
	updateLight();
},
setLightColour = (c: Colour) => {
	((getLayer("/Light") as SVGLayer).node.firstChild as SVGRectElement).setAttribute("fill", colour2RGBA(globals.mapData.lightColour = c));
	updateLight();
},
globals = {
	"definitions": null,
	"root": null,
	"layerList": null,
	"mapData": null,
	"tokens": null,
	"walls": null,
	"selected": {},
	"outline": g(),
} as unknown as {
	definitions: Defs;
	root: SVGSVGElement;
	layerList: SVGFolder;
	mapData: MapData;
	tokens: {layer: SVGLayer, token: SVGToken | SVGShape}[];
	walls: {layer: SVGLayer, wall: Wall}[];
	selected: {layer: SVGLayer | null, token: SVGToken | SVGShape | null};
	outline: SVGGElement;
},
isTokenImage = (t: Token): t is TokenImage => (t as TokenImage).src !== undefined,
isTokenDrawing = (t: Token): t is TokenDrawing => (t as TokenDrawing).points !== undefined,
normaliseWall = (w: Wall) => {
	if (w.x1 > w.x2 || w.x1 === w.x2 && w.y1 > w.y2) {
		[w.x1, w.x2, w.y1, w.y2] = [w.x2, w.x1, w.y2, w.y1];
	}
	return w;
},
updateLight = () => {
	const x = globals.mapData.lightX,
	      y = globals.mapData.lightY,
	      distance = Math.hypot(Math.max(x, globals.mapData.width - x), Math.max(y, globals.mapData.height - y)),
	      fadedLight = `rgba(${globals.mapData.lightColour.r / 2}, ${globals.mapData.lightColour.g / 2}, ${globals.mapData.lightColour.b / 2}, ${1 - (255 - globals.mapData.lightColour.a) * 0.5 / 255}`,
	      wallPolygons: SVGPolygonElement[] = [];
	walkLayers((l: SVGLayer) => {
		for (const w of l.walls) {
			if (w.x1 === w.x2 && x === w.x1 || w.y1 === w.y2 && y === w.y1) {
				return;
			}
			const d = point2Line(x, y, w.x1, w.y1, w.x2, w.y2);
			if (d >= distance || d === 0) {
				return;
			}
			const dm = distance;
			wallPolygons.push(polygon({"fill": fadedLight, "points": `${w.x1},${w.y1} ${x + (w.x1 - x) * dm},${y + (w.y1 - y) * dm} ${x + (w.x2 - x) * dm},${y + (w.y2 - y) * dm} ${w.x2},${w.y2}`}));
		};
	});
	createSVG(clearElement(getLayer("/Light")!.node), [
		rect({"width": "100%", "height": "100%", "fill": colour2RGBA(globals.mapData.lightColour)}),
		wallPolygons
	]);
},
mapView = (mapData: MapData, loadChars = false) => {
	Object.assign(globals, {mapData, "tokens": [], "walls": []});
	const definitions = globals.definitions = new Defs(),
	      layerList = globals.layerList = (() => {
		const node = g(),
		children = new SortNode<SVGFolder | SVGLayer>(node);
		for (const c of mapData.children) {
			children.push(processLayers(c));
		}
		return {
			id: 0,
			name: "",
			hidden: false,
			node,
			children,
			folders: {},
			items: {},
			path: "/"
		} as SVGFolder;
	      })(),
	      {width, height, lightColour} = mapData,
	      root = globals.root = svg({"id": "map", "style": {"position": "absolute"}, width, height, "tabindex": -1}, [definitions.node, layerList.node]),
	      base = div({"id": "mapBase", "Conmousedown": (e: MouseEvent) => toolMapMouseDown.call(root, e), "onwheel": (e: WheelEvent) => toolMapWheel.call(root, e), "oncontextmenu": (e: MouseEvent) => toolMapContext.call(root, e), "onmouseover": (e: MouseEvent) => toolMapMouseOver.call(root, e)}, root);
	definitions.setGrid(mapData);
	(getLayer("/Grid") as SVGLayer).node.appendChild(rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)"}));
	(getLayer("/Light") as SVGLayer).node.appendChild(rect({"width": "100%", "height": "100%", "fill": colour2RGBA(lightColour)}));
	walkFolders(layerList, l => {
		if (!isLayerFolder(l)) {
			for (const t of l.tokens) {
				globals.tokens[t.id] = {
					layer: l,
					token: t
				};
				if (isTokenImage(t) && t.tokenData) {
					const cID = t.tokenData["store-character-id"];
					if (loadChars && cID && typeof cID.data === "number" && !characterData.has(cID.data)) {
						const c = cID.data;
						characterData.set(c, {});
						queue(() => rpc.characterGet(c).then(d => characterData.set(c, d)));
					}
				}
			}
			for (const w of l.walls) {
				globals.walls[w.id] = {
					layer: l,
					wall: w
				};
			}
		}
		return false;
	});
	updateLight();
	return base;
};

export default function(base: HTMLElement) {
	rpc.waitCurrentUserMapData().then(mapData => {
		const oldBase = base;
		oldBase.replaceWith(base = mapView(mapData, true));
		mapLoadedSend(false);
	});
	rpc.waitMapChange().then(setMapDetails),
	rpc.waitMapLightChange().then(setLightColour),
	rpc.waitLayerShow().then(path => setLayerVisibility(path, true)),
	rpc.waitLayerHide().then(path => setLayerVisibility(path, false)),
	rpc.waitLayerAdd().then(addLayer),
	rpc.waitLayerFolderAdd().then(addLayerFolder),
	rpc.waitLayerMove().then(lm => moveLayer(lm.from, lm.to, lm.position)),
	rpc.waitLayerRename().then(lr => renameLayer(lr.path, lr.name)),
	rpc.waitLayerRemove().then(removeLayer),
	rpc.waitTokenAdd().then(tk => {
		const layer = getLayer(tk.path);
		if (!layer || !isSVGLayer(layer)) {
			return;
		}
		delete (tk as Record<string, any>)["path"];
		let token: SVGToken | SVGShape | SVGDrawing;
		if (isTokenImage(tk.token)) {
			token = SVGToken.from(tk.token);
			const cID = tk.token.tokenData["store-character-id"];
			if (tk.token.tokenData && cID && typeof cID.data === "number") {
				rpc.characterGet(cID.data).then(d => characterData.set(cID.data, d));
			}
		} else if (isTokenDrawing(tk.token)) {
			token = SVGDrawing.from(tk.token);
		} else {
			token = SVGShape.from(tk.token);
		}
		layer.tokens.push(token);
		globals.tokens[token.id] = {layer, token};
	}),
	rpc.waitTokenMoveLayerPos().then(tm => {
		const {layer, token} = globals.tokens[tm.id],
		      newParent = getLayer(tm.to);
		if (layer && token && newParent && isSVGLayer(newParent)) {
			if (tm.newPos > newParent.tokens.length) {
				tm.newPos = newParent.tokens.length;
			}
			newParent.tokens.splice(tm.newPos, 0, layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0]);
			globals.tokens[tm.id].layer = newParent;
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
	}),
	rpc.waitTokenSet().then(ts => {
		const {token} = globals.tokens[ts.id];
		if (!token) {
			return;
		}
		for (const k in ts) {
			switch (k) {
			case "id":
				break;
			case "src":
				if (token instanceof SVGToken && ts["src"]) {
					token.updateSource(ts["src"]);
				}
				break;
			case "tokenData":
				if (token instanceof SVGToken) {
					const tokenData = ts[k];
					for (const k in tokenData) {
						token["tokenData"][k] = tokenData[k];
					}
				}
				break;
			case "removeTokenData":
				if (token instanceof SVGToken) {
					const removeTokenData = ts[k]!;
					for (const k of removeTokenData) {
						delete token["tokenData"][k];
					}
				}
				break;
			default:
				(token as Record<string, any>)[k] = ts[k as keyof TokenSet]
			}
		}
		token.updateNode()
	}),
	rpc.waitTokenRemove().then(tk => {
		const {layer, token} = globals.tokens[tk];
		layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0];
		if (token instanceof SVGToken) {
			token.cleanup();
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
	}),
	rpc.waitLayerShift().then(ls => {
		const layer = getLayer(ls.path);
		if (!layer || !isSVGLayer(layer)) {
			return;
		}
		for (const t of layer.tokens) {
			t.x += ls.dx;
			t.y += ls.dy;
			t.updateNode();
		};
		for (const w of layer.walls) {
			w.x1 += ls.dx;
			w.y1 += ls.dy;
			w.x2 += ls.dx;
			w.y2 += ls.dy;
		};
		updateLight();
	}),
	rpc.waitLightShift().then(pos => {
		globals.mapData.lightX = pos.x;
		globals.mapData.lightY = pos.y;
		updateLight();
	}),
	rpc.waitWallAdded().then(w => {
		const layer = getLayer(w.path);
		if (!layer || !isSVGLayer(layer)) {
			return;
		}
		delete (w as Record<string, any>)["path"];
		layer.walls.push(normaliseWall(w));
		updateLight();
	}),
	rpc.waitWallRemoved().then(wp => {
		const {layer, wall} = globals.walls[wp];
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
	}),
	rpc.waitTokenLightChange().then(lc => {
		const {token} = globals.tokens[lc.id];
		if (token instanceof SVGToken) {
			token.lightColour = lc.lightColour;
			token.lightIntensity = lc.lightIntensity;
			updateLight();
		}
	}),
	rpc.waitMapDataSet().then(kd => {
		if (kd.key) {
			globals.mapData.data[kd.key] = kd.data;
		}
	}),
	rpc.waitMapDataRemove().then(key => {
		delete globals.mapData.data[key];
	})
}
