import {Colour, GridDetails, KeystoreData, MapDetails, Byte, Int, Uint, LayerFolder, LayerTokens, Token, TokenImage, TokenShape, TokenDrawing, RPC, MapData} from './types.js';
import {Subscription} from './lib/inter.js';
import {SortNode} from './lib/ordered.js';
import {createSVG, defs, ellipse, g, image, path, pattern, rect, svg} from './lib/svg.js';
import {colour2RGBA, handleError} from './misc.js';
import {div} from './lib/html.js';
import {scrollAmount} from './settings.js';
import {characterData, tokenData} from './characters.js';
import {toolMapMouseDown, toolMapContext, toolMapWheel, toolMapMouseOver} from './tools.js';
import {respondWithSelected} from './comms.js';

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
	rotation: Byte = 0;
	flip: boolean = false;
	flop: boolean = false;
	width: Uint;
	height: Uint;
	constructor(token: Token) {
		this.width = token.width;
		this.height = token.height;
		this.x = token.x;
		this.y = token.y;
		this.rotation = token.rotation;
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
	src: Uint;
	stroke: Colour;
	strokeWidth: Uint;
	patternWidth: Uint;
	patternHeight: Uint;
	tokenData: Uint;
	tokenType: Uint;
	snap: boolean;
	constructor(token: TokenImage) {
		throw new Error("use from");
		super(token);
	}
	static from(token: TokenImage) {
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
		createSVG(this.node, {"width": this.width, "height": this.height, "transform": this.transformString()});
	}
}

export class SVGShape extends SVGTransform {
	node: SVGGraphicsElement;
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
			node = rect();
		} else {
			node = ellipse();
		}
		return Object.setPrototypeOf(Object.assign(token, {node}), SVGShape.prototype);
	}
	at(x: Int, y: Int) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.width && ry >= 0 && ry < this.height;
	}
	get isPattern() {
		return false;
	}
	updateNode() {
		createSVG(this.node, {"width": this.width, "height": this.height, "transform": this.transformString()});
	}
}

const splitAfterLastSlash = (path: string) => {
	const pos = path.lastIndexOf("/")
	return [path.slice(0, pos), path.slice(pos+1)];
      },
      idNames: Record<string, Int> = {
	"": 0,
	"Grid": -1,
	"Light": -2,
      },
      processLayers = (layer: LayerTokens | LayerFolder): SVGFolder | SVGLayer => {
	const node = g();
	if (layer.hidden) {
		node.setAttribute("visibility", "hidden");
	}
	if (isLayerFolder(layer)) {
		const children = new SortNode<SVGFolder | SVGLayer>(node);
		layer.children.forEach(c => children.push(processLayers(c)));
		return Object.assign(layer, {node, children});
	}
	const tokens = new SortNode<SVGToken | SVGShape>(node);
	if (layer.name !== "Grid") {
		layer.tokens.forEach(t => {
			if (isTokenImage(t)) {
				tokens.push(SVGToken.from(t));
			} else if (isTokenDrawing(t)) {
			} else {
				tokens.push(new SVGShape(t));
			}
		});
	}
	return Object.assign(layer, {id: idNames[layer.name] ?? 1, node, tokens});
      },
      setTokenType = (path: string, pos: Uint, imagePattern: boolean) => {
	const [layer, token] = getParentToken(path, pos);
	if (!token || !(token instanceof SVGToken)) {
		return;
	}
	token.setPattern(!imagePattern);
      },
      getParentLayer = (path: string): [SVGFolder | null, SVGFolder | SVGLayer | null] => {
	const [parentStr, name] = splitAfterLastSlash(path),
	      parent = getLayer(globals.layerList, parentStr);
	if (!parent || !isSVGFolder(parent)) {
		return [null, null];
	}
	return [parent, getLayer(parent, name)];
      },
      isLayerFolder = (ld: LayerTokens | LayerFolder): ld is LayerFolder => (ld as LayerFolder).children !== undefined,
      getParentToken = (path: string, pos: Uint): [SVGLayer | null, SVGToken | SVGShape | null] => {
	const parent = getLayer(globals.layerList, path);
	if (!parent || !isSVGLayer(parent)) {
		return [null, null];
	}
	return [parent as SVGLayer, parent.tokens[pos] as SVGToken | SVGShape];
      };

export const walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as SortNode<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn))),
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
setLayerVisibility = (path: string, visibility: boolean) => {
	const layer = getLayer(globals.layerList, path)!;
	if (visibility) {
		layer.node.removeAttribute("visibility");
	} else {
		layer.node.setAttribute("visibility", "hidden");
	}
},
addLayerFolder = (path: string) => (globals.layerList.children.push(processLayers({"id": 0, "name": splitAfterLastSlash(path)[1], "hidden": false, "mask": 0, "children": [], "folders": {}, "items": {}})), path),
renameLayer = (path: string, name: string) => getLayer(globals.layerList, path)!.name = name,
removeLayer = (path: string) => {
	const [fromParent, layer] = getParentLayer(path);
	return (fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer));
},
addLayer = (name: string) => (globals.layerList.children.push(processLayers({name, "id": 0, "mask": 0, "hidden": false, "tokens": []})), name),
moveLayer = (from: string, to: string, pos: Uint) => {
	const [parentStr, nameStr] = splitAfterLastSlash(from),
	      fromParent = getLayer(globals.layerList, parentStr)!,
	      toParent = getLayer(globals.layerList, to) as SVGFolder;
	if (isSVGFolder(fromParent)) {
		toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
	}
},
setMapDetails = (details: MapDetails) => {
	globals.root.setAttribute("width", (globals.mapData.width = details["width"]).toString());
	globals.root.setAttribute("height", (globals.mapData.height = details["height"]).toString());
	globals.definitions.setGrid(details);
	return details;
},
setLightColour = (c: Colour) => (((getLayer(globals.layerList, "/Light") as SVGLayer).node.firstChild as SVGRectElement).setAttribute("fill", colour2RGBA(c)), c),
globals = {
	"definitions": null,
	"root": null,
	"layerList": null,
	"mapData": null
} as unknown as {
	definitions: Defs,
	root: SVGSVGElement,
	layerList: SVGFolder,
	mapData: MapData
},
isTokenImage = (t: Token): t is TokenImage => (t as TokenImage).src !== undefined,
isTokenDrawing = (t: Token): t is TokenDrawing => (t as TokenDrawing).points !== undefined,
mapView = (rpc: RPC, oldBase: HTMLElement, mapData: MapData, loadChars = false): [HTMLDivElement, () => void] => {
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
	      root = svg({"style": "position: absolute", "width": mapData.width, "height": mapData.height}, [definitions.node, layerList.node]),
	      base = div({"style": "height: 100%", "Conmousedown": (e: MouseEvent) => toolMapMouseDown.call(root, e), "onwheel": (e: WheelEvent) => toolMapWheel.call(root, e), "oncontextmenu": (e: MouseEvent) => toolMapContext.call(root, e), "onmouseover": (e: MouseEvent) => toolMapMouseOver.call(root, e)}, root);
	Object.assign(globals, {definitions, root, layerList, mapData});
	definitions.setGrid(mapData);
	(getLayer(layerList, "/Grid") as SVGLayer).node.appendChild(rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)"}));
	(getLayer(layerList, "/Light") as SVGLayer).node.appendChild(rect({"width": "100%", "height": "100%", "fill": colour2RGBA(mapData.lightColour)}));
	oldBase.replaceWith(base);
	walkFolders(layerList, l => {
		if (!isLayerFolder(l)) {
			l.tokens.forEach(t => {
				if (isTokenImage(t) && t.tokenData) {
					const tID = t.tokenData;
					rpc.tokenGet(tID).then(d => {
						tokenData.set(tID, d);
						if (loadChars && typeof d["store-character-id"] === "number") {
							const cID = d["store-character-id"].data;
							rpc.characterGet(cID).then(d => characterData.set(cID, d)).catch(handleError);
						}
					}).catch(handleError);
				}
			})
		}
		return false;
	});
	return [
		base,
		Subscription.canceller(
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
				const layer = getLayer(layerList, tk.path);
				if (!layer || !isSVGLayer(layer)) {
					// error
					return;
				}
				delete tk["path"];
				delete tk["pos"];
				if (isTokenImage(tk)) {
					layer.tokens.push(new SVGToken(tk));
					if (tk.tokenData) {
						const tID = tk.tokenData;
						rpc.tokenGet(tID).then(d => {
							tokenData.set(tID, d);
							if (loadChars && typeof d["store-character-id"] === "number") {
								const cID = d["store-character-id"].data;
								rpc.characterGet(cID).then(d => characterData.set(cID, d)).catch(handleError);
							}
						}).catch(handleError);
					}
				} else if (isTokenDrawing(tk)) {

				} else {
					layer.tokens.push(new SVGShape(tk));
				}
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
					token.updateNode();
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
			}),
			rpc.waitTokenSetData().then(td => {
				const [, token] = getParentToken(td.path, td.pos);
				if (token instanceof SVGToken) {
					token.tokenData = td.id;
				}
			}),
			rpc.waitTokenUnsetData().then(tu => {
				const [, token] = getParentToken(tu.path, tu.pos);
				if (token instanceof SVGToken) {
					token.tokenData = 0;
				}
			}),
			rpc.waitLayerShift().then(ls => {
				const layer = getLayer(layerList, ls.path);
				if (!layer || !isSVGLayer(layer)) {
					// error
					return;
				}
				(layer.tokens as (SVGToken | SVGShape)[]).forEach(t => {
					t.x += ls.dx;
					t.y += ls.dy;
					t.updateNode();
				});
			})
		)
	];
};

export default function(rpc: RPC, base: HTMLElement) {
	let canceller = () => {}
	rpc.waitCurrentUserMapData().then(mapData => {
		const [newBase, cancel] = mapView(rpc, base, mapData, true);
		canceller();
		base = newBase;
		canceller = cancel;
	});
	const selected = {
		"layer": null,
		"layerPath": "",
		"token": null,
		"outline": g(),
		"deselectToken": () => {}
	};
	respondWithSelected(selected);
}
