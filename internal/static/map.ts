import {Colour, GridDetails, MapDetails, Int, LayerFolder, LayerTokens, Token, RPC, MapData} from './types.js';
import {Subscription} from './lib/inter.js';
import {SortNode} from './lib/ordered.js';
import {createSVG, defs, g, image, path, pattern, rect, svg} from './lib/svg.js';
import {colour2RGBA, rgba2Colour, noColour} from './misc.js';
import {HTTPRequest} from './lib/conn.js';
import {clearElement, removeEventListeners} from './lib/dom.js';
import {div} from './lib/html.js';
import {scrollAmount} from './settings.js';


export type SVGLayer = LayerTokens & {
	node: SVGElement;
	tokens: SortNode<SVGToken | SVGShape>;
};

export type SVGFolder = LayerFolder & {
	node: SVGElement;
	children: SortNode<SVGFolder | SVGLayer>;
};

class Defs {
	node = defs();
	list: Record<string, SVGPatternElement> = {};
	add(t: SVGToken) {
		let i = 0;
		while (this.list[`Pattern_${i}`] !== undefined) {
			i++;
		}
		const id = `Pattern_${i}`;
		this.list[id] = this.node.appendChild(pattern({"id": id, "patternUnits": "userSpaceOnUse", "width": t.width, "height": t.height}, t.node.cloneNode(false)));
		return id;
	}
	remove(id: string) {
		this.node.removeChild(this.list[id]);
		delete(this.list[id]);
	}
	setGrid(grid: GridDetails) {
		const old = this.list["grid"];
		if (old) {
			this.node.removeChild(old);
		}
		this.list["grid"] = this.node.appendChild(pattern({"id": "gridPattern", "patternUnits": "userSpaceOnUse", "width": grid.gridSize, "height": grid.gridSize}, path({"d": `M 0 ${grid.gridSize} V 0 H ${grid.gridSize}`, "stroke": colour2RGBA(grid.gridColour), "stroke-width": grid.gridStroke, "fill": "transparent"})));
	}
}

class SVGTransform {
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
	node: SVGImageElement | SVGRectElement;
	src: Int;
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
		super(token);
	}
	static from(token: Token) {
		const node = image(),
		      svgToken = Object.setPrototypeOf(Object.assign(token, {node}), SVGToken.prototype);
		createSVG(node, {"href": `/images/${token.src}`, "preserveAspectRatio": "none", "width": token.width, "height": token.height, "transform": svgToken.transformString()});
		if (token.patternWidth > 0) {
			const {width, height} = token;
			svgToken.width = token.patternWidth;
			svgToken.height = token.patternHeight;
			svgToken.setPattern(true);
			svgToken.width = width;
			svgToken.height = height;
		}
		return svgToken;
	}
	at(x: Int, y: Int) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.width && ry >= 0 && ry < this.height;
	}
	setPattern(isPattern: boolean) {
		if (isPattern) {
			if (this.patternWidth > 0) {
				return;
			}
			const node = rect({"width": this.width, "height": this.height, "transform": this.transformString(), "fill": `url(#${globals.definitions.add(this)})`});
			this.node.replaceWith(node);
			this.node = node;
			this.patternWidth = this.width;
			this.patternHeight = this.height;
		} else if (this.patternWidth > 0) {
			globals.definitions.remove(this.node.getAttribute("fill")!.slice(5, -1));
			const node = image({"href": `/images/${this.src}`, "preserveAspectRatio": "none", "width": this.width, "height": this.height, "transform": this.transformString()});
			this.node.replaceWith(node);
			this.node = node;
		}
	}
	get isPattern() {
		return this.patternWidth > 0;
	}
	updateNode() {
		this.node.setAttribute("width", this.width + "");
		this.node.setAttribute("height", this.height + "");
		this.node.setAttribute("transform", this.transformString());
	}
}

export class SVGShape extends SVGTransform {
	node: SVGRectElement | SVGCircleElement;
	src: Int;
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
		super(token);
		this.node = rect({"transform": this.transformString()});
		this.src = token.src;
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
		return rx >= 0 && rx < this.width && ry >= 0 && ry < this.height;
	}
	get isPattern() {
		return false;
	}
	updateNode() {
		this.node.setAttribute("width", this.width + "");
		this.node.setAttribute("height", this.height + "");
		this.node.setAttribute("transform", this.transformString());
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

export const getParentLayer = (path: string): [SVGFolder | null, SVGFolder | SVGLayer | null] => {
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
	if (layer.name !== "Grid") {
		layer.tokens.forEach(t => {
			if (t["src"] === 0) {
				tokens.push(new SVGShape(t));
			} else {
				tokens.push(SVGToken.from(t));
			}
		});
	}
	return Object.assign(layer, {id: idNames[layer.name] ?? 1, node, tokens});
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
	if (!token || !(token instanceof SVGToken)) {
		return;
	}
	token.setPattern(!imagePattern);
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
},
mapView = (rpc: RPC, oldBase: HTMLElement, mapID: Int) => {
	return (HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "json"}) as Promise<MapData>).then(mapData => {
		const layerList = (() => {
			const node = g(),
			children = new SortNode<SVGFolder | SVGLayer>(node);
			mapData.children.forEach(c => children.push(processLayers(c)));
			return {
				id: 0,
				name: "",
				hidden: false,
				node,
				children,
				folders: {},
				items: {},
			} as SVGFolder;
		      })(),
		      definitions = new Defs(),
		      outline = g(),
		      root = svg({"style": "position: absolute", "width": mapData.width, "height": mapData.height}, [definitions.node, layerList.node, outline]),
		      base = div({"style": "height: 100%", "onmousedown": (e: MouseEvent) => {
			viewPos.mouseX = e.clientX;
			viewPos.mouseY = e.clientY;
			base.addEventListener("mousemove", viewDrag);
			base.addEventListener("mouseup", () => base.removeEventListener("mousemove", viewDrag), {"once": true});
		      }, "onwheel": (e: WheelEvent) => {
			e.preventDefault();
			if (e.ctrlKey) {
				const width = parseInt(root.getAttribute("width") || "0") / 2,
				      height = parseInt(root.getAttribute("height") || "0") / 2,
				      oldZoom = panZoom.zoom;
				if (e.deltaY < 0) {
					panZoom.zoom /= 0.95;
				} else if (e.deltaY > 0) {
					panZoom.zoom *= 0.95;
				}
				panZoom.x += e.clientX - (panZoom.zoom * ((e.clientX + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
				panZoom.y += e.clientY - (panZoom.zoom * ((e.clientY + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
				root.setAttribute("transform", `scale(${panZoom.zoom})`);
				outline.style.setProperty("--zoom", panZoom.zoom.toString());
			} else {
				const deltaY = e.shiftKey ? 0 : -e.deltaY,
				      deltaX = e.shiftKey ? -e.deltaY : -e.deltaX,
				      amount = scrollAmount.value || mapData.gridSize;
				panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount;
				panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount;
			}
			root.style.setProperty("left", panZoom.x + "px");
			root.style.setProperty("top", panZoom.y + "px");
		      }}, root),
		      panZoom = {x: 0, y: 0, zoom: 1},
		      viewPos = {mouseX: 0, mouseY: 0},
		      viewDrag = (e: MouseEvent) => {
			panZoom.x += e.clientX - viewPos.mouseX;
			panZoom.y += e.clientY - viewPos.mouseY;
			root.style.setProperty("left", panZoom.x + "px");
			root.style.setProperty("top", panZoom.y + "px");
			viewPos.mouseX = e.clientX;
			viewPos.mouseY = e.clientY;
		      };
		Object.assign(globals, {definitions, root, layerList});
		definitions.setGrid(mapData);
		(getLayer(layerList, "/Grid") as SVGLayer).tokens.node.appendChild(rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)"}));
		(getLayer(layerList, "/Light") as SVGLayer).tokens.node.appendChild(rect({"width": "100%", "height": "100%", "fill": colour2RGBA(mapData.lightColour)}));
		oldBase.replaceWith(base);
		return [
			base,
			Subscription.canceller(
				rpc.waitMapChange().then(mc => setMapDetails(mc)),
				rpc.waitMapLightChange().then(c => setLightColour(c)),
				rpc.waitLayerShow().then(path => setLayerVisibility(path, true)),
				rpc.waitLayerHide().then(path => setLayerVisibility(path, false)),
				rpc.waitLayerAdd().then(addLayer),
				rpc.waitLayerFolderAdd().then(path => addLayerFolder(path)),
				rpc.waitLayerMove().then(lm => moveLayer(lm.from, lm.to, lm.position)),
				rpc.waitLayerRename().then(lr => renameLayer(lr.path, lr.name)),
				rpc.waitLayerRemove().then(removeLayer),
				rpc.waitTokenAdd().then(tk => {
					const layer = getLayer(layerList, tk.path);
					if (!layer || !isSVGLayer(layer)) {
						// error
						return;
					}
					layer.tokens.push(new SVGToken(Object.assign(tk, {"rotation": 0, "patternWidth": 0, "patternHeight": 0, "flip": false, "flop": false, "tokenData": 0, "stroke": noColour, "strokeWidth": 0, "snap": false, "tokenType": 0})))
				}),
				rpc.waitTokenMoveLayer().then(tm => {
					const [parent, token] = getParentToken(tm.from, tm.pos);
					if (token instanceof SVGToken && parent) {
						const newParent = getLayer(layerList, tm.to);
						if (newParent && isSVGLayer(newParent)) {
							newParent.tokens.push(parent.tokens.splice(tm.pos, 1)[0]);
						}
					}
				}),
				rpc.waitTokenSnap().then(ts => {
					const [, token] = getParentToken(ts.path, ts.pos);
					if (token instanceof SVGToken) {
						token.snap = true;
					}
				}),
				rpc.waitTokenRemove().then(tk => {
					const layer = getLayer(layerList, tk.path);
					if (!layer || !isSVGLayer(layer)) {
						// error
						return;
					}
					layer.tokens.splice(tk.pos, 1);
				}),
				rpc.waitTokenChange().then(st => {
					const [, token] = getParentToken(st.path, st.pos);
					if (token instanceof SVGToken) {
						token.x = st.x;
						token.y = st.y;
						token.width = st.width;
						token.height = st.height;
						token.rotation = st.rotation;
						token.node.setAttribute("width", st.width + "px");
						token.node.setAttribute("height", st.height + "px");
						token.node.setAttribute("transform", token.transformString());
					}
				}),
				rpc.waitTokenFlip().then(tf => {
					const [, token] = getParentToken(tf.path, tf.pos);
					if (token instanceof SVGToken) {
						token.flip = tf.flip;
						token.node.setAttribute("transform", token.transformString());
					}
				}),
				rpc.waitTokenFlop().then(tf => {
					const [, token] = getParentToken(tf.path, tf.pos);
					if (token instanceof SVGToken) {
						token.flop = tf.flop;
						token.node.setAttribute("transform", token.transformString());
					}
				}),
				rpc.waitTokenSetImage().then(ti => setTokenType(ti.path, ti.pos, true)),
				rpc.waitTokenSetPattern().then(ti => setTokenType(ti.path, ti.pos, false)),
				rpc.waitTokenMovePos().then(to => {
					const [layer, token] = getParentToken(to.path, to.pos);
					if (layer && token) {
						layer.tokens.splice(to.newPos, 0, layer.tokens.splice(to.pos, 1)[0])
					}
				})
			),
			panZoom,
			outline,
			mapData
		] as [
			HTMLDivElement,
			() => void,
			{ x: Int; y: Int; zoom: Int},
			SVGGElement,
			MapData
		];
	});
};

export default function(rpc: RPC, base: HTMLElement) {
	let canceller = () => {}
	rpc.waitCurrentUserMap().then(mapID => mapView(rpc, base, mapID).then(([newBase, cancel]) => {
		canceller();
		base = newBase;
		canceller = cancel;
	}));
}
