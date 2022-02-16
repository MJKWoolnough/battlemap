import type {Byte, Coords, GridDetails, Int, KeystoreData, LayerFolder, LayerTokens, MapData, MapDetails, Mask, Token, TokenDrawing, TokenImage, TokenSet, TokenShape, Uint, Wall} from './types.js';
import type {Colour} from './colours.js';
import {amendNode} from './lib/dom.js';
import {mouseDragEvent} from './lib/events.js';
import {div, progress} from './lib/html.js';
import {WaitGroup} from './lib/inter.js';
import {NodeArray, node} from './lib/nodes.js';
import {animate, circle, defs, ellipse, filter, g, image, mask, path, pattern, polygon, rect, svg} from './lib/svg.js';
import lang from './language.js';
import {inited, isAdmin, rpc} from './rpc.js';
import {tokenClass} from './plugins.js';
import {scrollAmount, zoomSlider} from './settings.js';
import {characterData, checkInt, cloneObject, mapLoadedReceive, mapLoadedSend, queue, setAndReturn, SQRT3, tokens, walls} from './shared.js';
import {defaultTool, toolMapMouseDown, toolMapMouseOver, toolMapWheel} from './tools.js';
import {shell} from './windows.js';

export type SVGLayer = LayerTokens & {
	[node]: SVGElement;
	path: string;
	tokens: NodeArray<SVGToken | SVGShape>;
};

export type SVGFolder = LayerFolder & {
	[node]: SVGElement;
	path: string;
	children: NodeArray<SVGFolder | SVGLayer>;
};

type MaskNode = Mask & {
	[node]: SVGRectElement | SVGEllipseElement | SVGPolygonElement;
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
	tokenData: Record<string, KeystoreData>;
	constructor(token: Token) {
		this.id = token.id;
		this.width = token.width;
		this.height = token.height;
		this.x = token.x;
		this.y = token.y;
		this.rotation = token.rotation;
		this.lightColour = token.lightColour;
		this.lightIntensity = token.lightIntensity;
		this.tokenData = token.tokenData;
	}
	at(x: Int, y: Int, n: SVGGraphicsElement) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(n.getScreenCTM()!.inverse());
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

export class SVGToken extends SVGTransform {
	[node]: SVGGraphicsElement;
	src: Uint;
	patternWidth: Uint;
	patternHeight: Uint;
	tokenType: Uint;
	snap: boolean;
	constructor(token: TokenImage, wg?: WaitGroup) {
		super(token);
		if (wg) {
			wg.add();
		}
		this.src = token.src;
		this.patternWidth = token.patternWidth;
		this.patternHeight = token.patternWidth;
		this.tokenType = token.tokenType ?? 0;
		this.snap = token.snap;
		this[node] = amendNode(image(Object.assign({"class": "mapToken", "href": `/images/${token.src}`, "preserveAspectRatio": "none", "width": token.patternWidth > 0 ? token.patternWidth : token.width, "height": token.patternHeight > 0 ? token.patternHeight : token.height, "transform": this.transformString()}, wg ? {"onload": () => wg.done(), "onerror": () => wg.error()} : {})));
		if (token.patternWidth > 0) {
			this.updateNode();
		}
	}
	at(x: Int, y: Int, n = this[node]) {
		return super.at(x, y, n);
	}
	get isPattern() {
		return this.patternWidth > 0;
	}
	cleanup() {
		if (this.isPattern) {
			definitions.remove(this[node].getAttribute("fill")!.slice(5, -1));
		}
	}
	uncleanup() {
		if (this.isPattern) {
			amendNode(this[node], {"fill": `url(#${definitions.add(this)})`});
		}
	}
	updateSource(source: Uint) {
		amendNode(this[node] instanceof SVGRectElement ? definitions.list.get(this[node].getAttribute("fill")!.slice(5, -1))!.firstChild! : this[node], {"href": `images/${this.src = source}`});
	}
	updateNode() {
		if (this[node] instanceof SVGRectElement && !this.isPattern) {
			definitions.remove(this[node].getAttribute("fill")!.slice(5, -1));
			this[node].replaceWith(this[node] = image({"href": `/images/${this.src}`, "preserveAspectRatio": "none"}));
		} else if (this[node] instanceof SVGImageElement && this.isPattern) {
			this[node].replaceWith(this[node] = rect({"class": "mapPattern", "fill": `url(#${definitions.add(this)})`}));
		}
		amendNode(this[node], {"width": this.width, "height": this.height, "transform": this.transformString()});
	}
}

export class SVGShape extends SVGTransform {
	[node]: SVGRectElement | SVGEllipseElement;
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
		let n: SVGGraphicsElement;
		if (!token.isEllipse) {
			token.isEllipse = false;
			n = rect({"width": token.width, "height": token.height});
		} else {
			const rx = token.width / 2,
			      ry = token.height / 2;
			n = ellipse({"cx": rx, "cy": ry, rx, ry});
		}
		const svgShape = Object.setPrototypeOf(Object.assign(token, {[node]: n}), SVGShape.prototype);
		amendNode(n, {"class": "mapShape", "fill": token.fill, "stroke": token.stroke, "stroke-width": token.strokeWidth, "transform": svgShape.transformString()});
		Object.defineProperty(svgShape, node, {"enumerable": false});
		return svgShape;
	}
	at(x: Int, y: Int) {
		return super.at(x, y, this[node]);
	}
	get isPattern() {
		return false;
	}
	updateNode() {
		if (this.isEllipse) {
			const rx = this.width / 2,
			      ry = this.height / 2;
			amendNode(this[node], {"cx": rx, "cy": ry, rx, ry, "transform": this.transformString()});
		} else {
			amendNode(this[node], {"width": this.width, "height": this.height, "transform": this.transformString()});
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
		token.isEllipse = false;
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
		      n = path({"class": "mapDrawing", "d": `M${token.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${token.fill.a === 0 ? "" : " Z"}`, "fill": token.fill, "stroke": token.stroke, "stroke-width": token.strokeWidth}),
		      svgDrawing = Object.setPrototypeOf(Object.assign(token, {[node]: n, oWidth, oHeight}), SVGDrawing.prototype);
		amendNode(n, {"transform": svgDrawing.transformString()});
		Object.defineProperty(svgDrawing, node, {"enumerable": false});
		return svgDrawing;
	}
	updateNode() {
		const xr = this.width / this.oWidth,
		      yr = this.height / this.oHeight;
		amendNode(this[node], {"d": `M${this.points.map(c => `${c.x * xr},${c.y * yr}`).join(" L")}${this.fill.a === 0 ? "" : " Z"}`, "transform": this.transformString()});
	}
}

const idNames: Record<string, Int> = {
	"": 0,
	"Grid": -1,
	"Light": -2,
      },
      processLayers = (wg: WaitGroup | undefined, layer: LayerTokens | LayerFolder, path = ""): SVGFolder | SVGLayer => {
	path += "/" + layer.name
	const n = g();
	if (layer.hidden) {
		n.classList.add("hiddenLayer");
	}
	if (isLayerFolder(layer)) {
		const children = new NodeArray<SVGFolder | SVGLayer>(n);
		for (const c of layer.children) {
			children.push(processLayers(wg, c, path));
		}
		return Object.assign(layer, {[node]: n, children, path});
	}
	const tokens = new NodeArray<SVGToken | SVGShape>(n);
	if (layer.name !== "Grid" && layer.name !== "Light") {
		for (const t of layer.tokens) {
			tokens.push(isTokenImage(t) ? new (tokenClass())(t, wg) : isTokenDrawing(t) ? SVGDrawing.from(t) : SVGShape.from(t));
		};
	} else {
		amendNode(n, {"id": `layer${layer.name}`});
		layer.walls = [];
	}
	return Object.assign(layer, {id: idNames[layer.name] ?? 1, [node]: n, path, tokens});
      },
      isLayerFolder = (ld: LayerTokens | LayerFolder): ld is LayerFolder => (ld as LayerFolder).children !== undefined,
      walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as NodeArray<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn)));

export let root = svg(),
layerList: SVGFolder,
mapData: MapData;

export const point2Line = (px: Int, py: Int, x1: Int, y1: Int, x2: Int, y2: Int) => {
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
walkLayers = (fn: (e: SVGLayer, hidden: boolean) => void, folder: SVGFolder = layerList, hidden = false) => {
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
getLayer = (path: string, layer: SVGFolder | SVGLayer = layerList) => path.split("/").filter(b => b).every(p => {
	if (!isSVGFolder(layer)) {
		return false;
	}
	const a = (layer.children as NodeArray<SVGFolder | SVGLayer>).filter(c => c.name === p).pop();
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
		layer[node].classList.remove("hiddenLayer");
	} else {
		layer[node].classList.add("hiddenLayer");
	}
	layer.hidden = !visibility;
	updateLight();
},
addLayerFolder = (path: string) => (layerList.children.push(processLayers(undefined, {"id": 0, "name": splitAfterLastSlash(path)[1], "hidden": false, "mask": 0, "children": [], "folders": {}, "items": {}})), path),
renameLayer = (path: string, name: string) => {
	const l = getLayer(path)!;
	l.name = name
	l.path = `${splitAfterLastSlash(path)[0]}/${name}`;
	return name;
},
removeLayer = (path: string) => {
	const [fromParent, layer] = getParentLayer(path);
	(fromParent!.children as NodeArray<any>).filterRemove(e => Object.is(e, layer));
	updateLight();
},
addLayer = (name: string) => (layerList.children.push(processLayers(undefined, {name, "id": 0, "mask": 0, "hidden": false, "tokens": [], "walls": []})), name),
moveLayer = (from: string, to: string, pos: Uint) => {
	const [parentStr, nameStr] = splitAfterLastSlash(from),
	      fromParent = getLayer(parentStr)!,
	      toParent = getLayer(to) as SVGFolder;
	if (isSVGFolder(fromParent)) {
		const l = (fromParent.children as NodeArray<any>).filterRemove(e => e.name === nameStr).pop();
		l.path = to + "/" + l.name;
		toParent.children.splice(pos, 0, l);
	}
	updateLight();
},
setMapDetails = (details: MapDetails) => {
	Object.assign(mapData, details);
	amendNode(root, {"width": details["width"], "height": details["height"]});
	definitions.setGrid(details);
	updateLight();
},
setLightColour = (c: Colour) => {
	amendNode((getLayer("/Light") as SVGLayer)[node].firstChild as SVGRectElement, {"fill": mapData.lightColour = c});
	updateLight();
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
},
showSignal = (() => {
	const signalAnim1 = animate({"attributeName": "r", "values": "4;46", "dur": "1s"}),
	      signalAnim2 = animate({"attributeName": "r", "values": "4;46", "dur": "1s"}),
	      signal = g([
		circle({"cx": 50, "cy": 50, "stroke": "#f00", "stroke-width": 8, "fill": "none"}, signalAnim1),
		circle({"cx": 50, "cy": 50, "stroke": "#00f", "stroke-width": 4, "fill": "none"}, signalAnim2)
	      ]);
	return (pos: [Uint, Uint]) => {
		amendNode(root, amendNode(signal, {"transform": `translate(${pos[0] - 50}, ${pos[1] - 50})`}));
		signalAnim1.beginElement();
		signalAnim2.beginElement();
	};
})(),
panZoom = {"x": 0, "y": 0, "zoom": 1},
screen2Grid = (() => {
	const points: readonly [number, number][] = [
		[0, 1/6],
		[0, 2/6],
		[0, 3/6],
		[0, 5/6],
		[1/4, 1/12],
		[1/4, 7/12],
		[1/2, 0],
		[1/2, 1/3],
		[1/2, 2/3],
		[1/2, 5/6],
		[1/2, 1],
		[3/4, 1/12],
		[3/4, 7/12],
		[1, 1/6],
		[1, 2/6],
		[1, 3/6],
		[1, 5/6]
	      ];
	return (mx: Uint, my: Uint, snap = false): [Int, Int] => {
		const {width, height, gridType, gridSize} = mapData,
		      {x, y, zoom} = panZoom,
		      sx = (mx + ((zoom - 1) * width / 2) - x) / zoom,
		      sy = (my + ((zoom - 1) * height / 2) - y) / zoom;
		if (snap) {
			switch (gridType) {
			case 1:
			case 2: {
				const o = 2 * Math.round(1.5 * gridSize / SQRT3),
				      w = gridType === 1 ? gridSize : o,
				      h = gridType === 2 ? gridSize : o,
				      px = sx / w,
				      py = sy / h,
				      dx = px % 1,
				      dy = py % 1,
				      first = gridType - 1,
				      second = 1 - first;
				let nearestPoint: [number, number] = [0, 0],
				    nearest = Infinity;
				for (const point of points) {
					const d = Math.hypot(point[first] - dx, point[second] - dy);
					if (d < nearest) {
						nearest = d;
						nearestPoint = point;
					}
				}
				return [Math.round((Math.floor(px) + nearestPoint[first]) * w), Math.round((Math.floor(py) + nearestPoint[second]) * h)];
			}
			default:
				const size = gridSize >> 1;
				return [size * Math.round(sx / size), size * Math.round(sy / size)];
			}
		}
		return [Math.round(sx), Math.round(sy)];
	};
})(),
zoom = (() => {
	const zoomMove = (e: MouseEvent) => {
		const v = Math.max(10, Math.min(110, e.clientY)),
		      z = Math.pow(1.4, (60 - v) / 10);
		amendNode(zoomerControl, {"cy": v});
		zoom(z / panZoom.zoom, window.innerWidth >> 1, window.innerHeight >> 1, false);
	      },
	      [setupZoomDrag] = mouseDragEvent(0, zoomMove, () => document.body.classList.remove("zooming")),
	      zoomWheel = (e: WheelEvent) => zoom(Math.sign(e.deltaY) * 0.95, window.innerWidth >> 1, window.innerHeight >> 1),
	      zoomerControl = circle({"cx": 10, "cy": 60, "r": 10, "stroke": "#000", "onmousedown": (e: MouseEvent) => {
		if (e.button !== 0) {
			return;
		}
		setupZoomDrag();
		document.body.classList.add("zooming");
	      }, "onwheel": zoomWheel}),
	      l4 = Math.log(1.4)
	inited.then(() => amendNode(shell, svg({"id": "zoomSlider", "viewBox": "0 0 20 120"}, [
		rect({"width": 20, "height": 120, "rx": 10, "stroke": "#000", "onclick": (e: MouseEvent) => {
			if (e.button === 0) {
				zoomMove(e);
			}
		}, "onwheel": zoomWheel}),
		zoomerControl
	])));
	zoomSlider.wait(enabled => document.body.classList.toggle("hideZoomSlider", enabled));
	mapLoadedReceive(() => amendNode(zoomerControl, {"cy": "60"}));
	return (delta: number, x: number, y: number, moveControl = true) => {
		const width = checkInt(parseInt(root.getAttribute("width") || "0"), 0) / 2,
		      height = checkInt(parseInt(root.getAttribute("height") || "0"), 0) / 2,
		      oldZoom = panZoom.zoom;
		if (delta < 0) {
			panZoom.zoom /= -delta;
		} else if (delta > 0) {
			panZoom.zoom *= delta;
		}
		panZoom.x += x - (panZoom.zoom * ((x + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
		panZoom.y += y - (panZoom.zoom * ((y + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
		amendNode(root, {"transform": `scale(${panZoom.zoom})` ,"style": {"left": panZoom.x + "px", "top": panZoom.y + "px", "--zoom": panZoom.zoom}});
		if (moveControl) {
			amendNode(zoomerControl, {"cy": Math.max(10, 120 - Math.min(110, 60 + 10 * Math.log(panZoom.zoom) / l4))});
		}
	};
})(),
centreOnGrid = (x: Uint, y: Uint) => {
	const {width, height} = mapData,
	      iw = window.innerWidth,
	      ih = window.innerHeight,
	      {zoom} = panZoom;
	panZoom.x = Math.min(Math.max((iw - width) / 2 - (x - width / 2) * zoom, iw - width * (zoom + 1) / 2), width * (zoom - 1) / 2);
	panZoom.y = Math.min(Math.max((ih - height) / 2 - (y - height / 2) * zoom, ih - height * (zoom + 1) / 2), height * (zoom - 1) / 2);
	amendNode(root, {"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}})
},
masks = (() => {
	const base = rect({"width": "100%", "height": "100%", "fill": "#000"}),
	      masks = new NodeArray<MaskNode>(g()),
	      baseNode = mask({"id": "mapMask"}, [base, masks[node]]);
	let baseOpaque = false;
	return {
		get [node]() {return baseNode;},
		get baseOpaque() {return baseOpaque;},
		get masks() {return cloneObject(masks);},
		index(i: Uint) {
			return masks[i];
		},
		at(x: Uint, y: Uint) {
			let selected: Int = -1,
			    selectedMask: Mask | null = null;
			for (const [n, m] of masks.entries()) {
				switch (m[0]) {
				case 0:
				case 1: {
					const [, i, j, w, h] = m;
					if (i <= x && x <= i + w && j <= y && y <= j + h) {
						selected = n;
						selectedMask = m;
					}
				}; break;
				case 2:
				case 3: {
					const [, cx, cy, rx, ry] = m,
					      rx2 = Math.pow(rx, 2),
					      ry2 = Math.pow(ry, 2);
					if (ry2 * Math.pow(x - cx, 2) + rx2 * Math.pow(y - cy, 2) <= rx2 * ry2) {
						selected = n;
						selectedMask = m;
					}
				}; break;
				case 4:
				case 5: {
					const points = m.reduce((res, _, i) => {
						if (i % 2 === 1) {
							res.push([m[i], m[i+1]]);
						}
						return res;
					}, [] as [Uint, Uint][]);
					let last = points[points.length-1],
					    inside = false;
					for (const point of points) {
						if (y > Math.min(point[1], last[1]) && y <= Math.max(point[1], last[1]) && x <= (y - point[1]) * (last[0] - point[0]) / (last[1] - point[1]) + point[0]) {
							inside = !inside;
						}
						last = point;
					}
					if (inside) {
						selected = n;
						selectedMask = m;
					}
				}
				}
			}
			return [selectedMask, selected] as const;
		},
		add(m: Mask) {
			const fill = (m[0] & 1) === 1 ? "#000" : "#fff";
			let shape: SVGRectElement | SVGEllipseElement | SVGPolygonElement;
			switch (m[0]) {
			case 0:
			case 1:
				shape = rect({"x": m[1], "y": m[2], "width": m[3], "height": m[4], fill});
				break;
			case 2:
			case 3:
				shape = ellipse({"cx": m[1], "cy": m[2], "rx": m[3], "ry": m[4], fill});
				break;
			case 4:
			case 5:
				shape = polygon({"points": m.reduce((res, _, i) => i % 2 === 1 ? `${res} ${m[i]},${m[i+1]}` : res, ""), fill});
				break;
			default:
				return -1;
			}
			return masks.push(Object.assign(m, {[node]: shape})) - 1;
		},
		remove(index: Uint) {
			masks.splice(index, 1);
		},
		set(bO: boolean, maskList: Mask[]) {
			amendNode(base, {"fill": (baseOpaque = bO) ? "#fff" : "#000"});
			masks.splice(0, masks.length);
			for (const mask of maskList) {
				this.add(mask);
			}
		}
	}
})(),
definitions = (() => {
	const base = defs(masks[node]),
	      list = new Map<string, SVGPatternElement>(),
	      lighting = new Map<string, SVGFilterElement>();
	return {
		get [node]() {return base;},
		get list() {return list;},
		add(t: SVGToken) {
			let i = 0;
			while (list.has(`Pattern_${i}`)) {
				i++;
			}
			const id = `Pattern_${i}`;
			list.set(id, base.appendChild(pattern({"id": id, "patternUnits": "userSpaceOnUse", "width": t.patternWidth, "height": t.patternHeight}, image({"href": `/images/${t.src}`, "width": t.patternWidth, "height": t.patternHeight, "preserveAspectRatio": "none"}))));
			return id;
		},
		remove(id: string) {
			base.removeChild(list.get(id)!).firstChild as SVGImageElement;
			list.delete(id);
		},
		setGrid(grid: GridDetails) {
			const old = list.get("grid");
			old?.remove();
			switch (grid.gridType) {
			case 1: {
				const w = grid.gridSize,
				      h = 2 * w / SQRT3,
				      maxH = 2 * Math.round(1.5 * w / SQRT3);
				list.set("grid", base.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": w, "height": maxH}, path({"d": `M${w / 2},${maxH} V${h} l${w / 2},-${h / 4} V${h / 4} L${w / 2},0 L0,${h / 4} v${h / 2} L${w / 2},${h}`, "stroke": grid.gridColour, "stroke-width": grid.gridStroke, "fill": "transparent"}))));
			}; break;
			case 2: {
				const h = grid.gridSize,
				      w = 2 * h / SQRT3,
				      maxW = 2 * Math.round(1.5 * h / SQRT3);
				list.set("grid", base.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": maxW, "height": h}, path({"d": `M${maxW},${h / 2} H${w} l-${w / 4},${h / 2} H${w / 4} L0,${h / 2} L${w / 4},0 h${w / 2} L${w},${h/2}`, "stroke": grid.gridColour, "stroke-width": grid.gridStroke, "fill": "transparent"}))));
			}; break;
			default:
				list.set("grid", base.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": grid.gridSize, "height": grid.gridSize}, path({"d": `M0,${grid.gridSize} V0 H${grid.gridSize}`, "stroke": grid.gridColour, "stroke-width": grid.gridStroke, "fill": "transparent"}))));
			}
		},
		getLighting(id: string) {
			return lighting.get(id) ?? setAndReturn(lighting, id, base.appendChild(filter({id})));
		},
		clearLighting() {
			for (const l of lighting.values()) {
				l.remove();
			}
			lighting.clear();
		},
		clear() {
			this.clearLighting();
			for (const d of list.values()) {
				d.remove();
			}
			list.clear();
		}
	}
})(),
mapView = (mD: MapData, loadChars = false) => {
	mapData = mD;
	tokens.clear();
	walls.clear();
	masks.set(mapData.baseOpaque, mapData.masks);
	definitions.clear();
	const wg = new WaitGroup(),
	      {width, height, lightColour, startX, startY} = mapData,
	      items = div(),
	      percent = progress(),
	      loader = div({"id": "mapLoading"}, div([`${lang["LOADING_MAP"]}: `, percent, items]));
	layerList = (() => {
		const n = g(),
		      children = new NodeArray<SVGFolder | SVGLayer>(n);
		for (const c of mapData.children) {
			children.push(processLayers(wg, c));
		}
		return {
			id: 0,
			name: "",
			hidden: false,
			[node]: n,
			children,
			folders: {},
			items: {},
			path: "/"
		} as SVGFolder;
	})();
	root = svg({"id": "map", "style": {"position": "absolute"}, width, height}, [definitions[node], layerList[node], rect({"width": "100%", "height": "100%", "fill": "#000", "style": isAdmin ? {"fill-opacity": "var(--maskOpacity, 1)"} : undefined, "mask": "url(#mapMask)"})]);
	wg.onComplete(() => setTimeout(() => loader.remove(), isAdmin ? 0 : 1000));
	definitions.setGrid(mapData);
	amendNode((getLayer("/Grid") as SVGLayer)[node], rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)"}));
	amendNode((getLayer("/Light") as SVGLayer)[node], rect({"width": "100%", "height": "100%", "fill": lightColour}));
	walkFolders(layerList, l => {
		if (!isLayerFolder(l)) {
			for (const t of l.tokens) {
				tokens.set(t.id, {
					layer: l,
					token: t
				});
				if (isTokenImage(t) && t.tokenData) {
					const cID = t.tokenData["store-character-id"];
					if (loadChars && cID && typeof cID.data === "number" && !characterData.has(cID.data)) {
						const c = cID.data;
						characterData.set(c, {});
						wg.add();
						queue(() => rpc.characterGet(c).then(d => characterData.set(c, d)).finally(() => wg.done()));
					}
				}
			}
			for (const w of l.walls) {
				walls.set(w.id, {
					layer: l,
					wall: w
				});
			}
		}
		return false;
	});
	wg.onUpdate(({waits, done, errors}) => {
		const d = done + errors;
		items.innerText = `${d} / ${waits}`;
		amendNode(percent, {"max": waits, "value": d});
	});
	wg.add();
	wg.done();
	updateLight();
	panZoom.zoom = 1;
	centreOnGrid(startX, startY);
	return div({"id": "mapBase", "onmousedown": (e: MouseEvent) => toolMapMouseDown.call(root, e), "onwheel": (e: WheelEvent) => toolMapWheel.call(root, e), "onmouseover": (e: MouseEvent) => toolMapMouseOver.call(root, e)}, [root, loader]);
};

defaultTool.mapMouseWheel = (e: WheelEvent) => {
	if (e.ctrlKey) {
		zoom(Math.sign(e.deltaY) * 0.95, e.clientX, e.clientY);
	} else {
		const amount = scrollAmount.value || 100;
		amendNode(root, {"style": {"left": (panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount) + "px", "top": (panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount) + "px"}});
	}
	return false;
};

export default (base: HTMLElement) => {
	rpc.waitCurrentUserMapData().then(mapData => {
		const oldBase = base;
		oldBase.replaceWith(base = mapView(mapData, true));
		mapLoadedSend(false);
	});
	let sliding = -1,
	    mX = 0,
	    mY = 0;
	const startMapMove = (e: MouseEvent) => {
		amendNode(root, {"style": {"left": `${panZoom.x += e.clientX - mX}px`, "top": `${panZoom.y += e.clientY - mY}px`}});
		mX = e.clientX;
		mY = e.clientY;
	      },
	      stopMapMove = () => document.body.classList.remove("dragging"),
	      [startMapMove0] = mouseDragEvent(0, startMapMove, stopMapMove),
	      [startMapMove1] = mouseDragEvent(1, startMapMove, stopMapMove),
	      initMapMove = (e: MouseEvent, initFn: () => void) => {
		mX = e.clientX;
		mY = e.clientY;
		document.body.classList.toggle("dragging", true);
		initFn();
		return false;
	      };
	defaultTool.mapMouse0 = (e: MouseEvent) => initMapMove(e, startMapMove0);
	defaultTool.mapMouse1 = (e: MouseEvent) => initMapMove(e, startMapMove1);
	defaultTool.mapMouse2 = (e: MouseEvent) => {
		const pos = screen2Grid(e.clientX, e.clientY);
		showSignal(pos);
		rpc.signalPosition(pos);
		return false;
	};
	rpc.waitSignalMovePosition().then(pos => {
		if (sliding === -1) {
			document.body.classList.toggle("sliding", true);
		} else {
			window.clearTimeout(sliding);
		}
		sliding = window.setTimeout(() => {
			document.body.classList.remove("sliding")
			sliding = -1;
		}, 1000);
		centreOnGrid(pos[0], pos[1]);
		showSignal(pos);
	});
	rpc.waitSignalPosition().then(showSignal);
	rpc.waitMapChange().then(setMapDetails),
	rpc.waitMapLightChange().then(setLightColour),
	rpc.waitLayerShow().then(path => setLayerVisibility(path, true)),
	rpc.waitLayerHide().then(path => setLayerVisibility(path, false)),
	rpc.waitLayerAdd().then(addLayer),
	rpc.waitLayerFolderAdd().then(addLayerFolder),
	rpc.waitLayerMove().then(({from, to, position}) => moveLayer(from, to, position)),
	rpc.waitLayerRename().then(({path, name}) => renameLayer(path, name)),
	rpc.waitLayerRemove().then(removeLayer),
	rpc.waitTokenAdd().then(tk => {
		const layer = getLayer(tk.path);
		if (!layer || !isSVGLayer(layer)) {
			return;
		}
		delete (tk as Record<string, any>)["path"];
		let token: SVGToken | SVGShape | SVGDrawing;
		if (isTokenImage(tk.token)) {
			token = new (tokenClass())(tk.token);
			const cID = tk.token.tokenData["store-character-id"];
			if (cID && typeof cID.data === "number") {
				rpc.characterGet(cID.data).then(d => characterData.set(cID.data, d));
			}
		} else if (isTokenDrawing(tk.token)) {
			token = SVGDrawing.from(tk.token);
		} else {
			token = SVGShape.from(tk.token);
		}
		layer.tokens.push(token);
		tokens.set(token.id, {layer, token});
	}),
	rpc.waitTokenMoveLayerPos().then(({id, to, newPos}) => {
		const tk = tokens.get(id) ?? {"layer": null, "token": null},
		      {layer, token} = tk,
		      newParent = getLayer(to);
		if (layer && token && newParent && isSVGLayer(newParent)) {
			if (newPos > newParent.tokens.length) {
				newPos = newParent.tokens.length;
			}
			newParent.tokens.splice(newPos, 0, layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0]);
			tk.layer = newParent;
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
	}),
	rpc.waitTokenSet().then(ts => {
		const {token} = tokens.get(ts.id) ?? {"token": null};
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
		const {layer, token} = tokens.get(tk)!;
		layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0];
		if (token instanceof SVGToken) {
			token.cleanup();
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
	}),
	rpc.waitLayerShift().then(({path, dx, dy}) => {
		const layer = getLayer(path);
		if (!layer || !isSVGLayer(layer)) {
			return;
		}
		for (const t of layer.tokens) {
			t.x += dx;
			t.y += dy;
			t.updateNode();
		};
		for (const w of layer.walls) {
			w.x1 += dx;
			w.y1 += dy;
			w.x2 += dx;
			w.y2 += dy;
		};
		updateLight();
	}),
	rpc.waitWallAdded().then(({path, wall}) => {
		const layer = getLayer(path);
		if (!layer || !isSVGLayer(layer)) {
			return;
		}
		layer.walls.push(normaliseWall(wall));
		updateLight();
	}),
	rpc.waitWallRemoved().then(wp => {
		const {layer, wall} = walls.get(wp)!;
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
	}),
	rpc.waitWallModified().then(w => {
		const wall = walls.get(w.id);
		if (!wall) {
			return;
		}
		Object.assign(wall.wall, w);
	});
	rpc.waitTokenLightChange().then(({id, lightColour, lightIntensity}) => {
		const {token} = tokens.get(id)!;
		if (token instanceof SVGToken) {
			token.lightColour = lightColour;
			token.lightIntensity = lightIntensity;
			updateLight();
		}
	}),
	rpc.waitMapDataSet().then(kd => {
		if (kd.key) {
			mapData.data[kd.key] = kd.data;
		}
	}),
	rpc.waitMapDataRemove().then(key => delete mapData.data[key])
	rpc.waitMaskAdd().then(masks.add);
	rpc.waitMaskRemove().then(masks.remove);
	rpc.waitMaskSet().then(({baseOpaque, masks: ms}) => masks.set(baseOpaque, ms));
};
