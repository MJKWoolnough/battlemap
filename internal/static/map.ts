import {Colour, FromTo, IDName, Int, RPC, GridDetails, Layer, LayerFolder, LayerRPC, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {clearElement} from './lib/dom.js';
import {createSVG, defs, g, image, path, pattern, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import {colour2RGBA, rgba2Colour} from './misc.js';
import {Shell} from './windows.js';

type SVGLayer = Layer & {
	node: SVGElement;
	tokens: SortNode<SVGToken>;
};

type SVGFolder = LayerFolder & {
	node: SVGElement;
	children: SortNode<SVGFolder | SVGLayer>;
};

class SVGPattern {
	pattern: SVGPatternElement;
	constructor(pattern: SVGPatternElement) {
		this.pattern = pattern;
	}
	static from(p: SVGPatternElement) {
		if (p.firstChild instanceof SVGPathElement) {
			if (p.firstChild.getAttribute("id") === "gridPattern") {
				return new SVGGrid(p.firstChild);
			}
			return new SVGPath(p.firstChild);
		} else if (p.firstChild instanceof SVGImageElement) {
			return new SVGImage(p.firstChild);
		}
		return new SVGPattern(p);
	}
	get id() {
		return this.pattern.getAttribute("id") || "";
	}
	get width() {
		return parseInt(this.pattern.getAttribute("width") || "0");
	}
	set width(w: Int) {
		this.pattern.setAttribute("width", w.toString());
	}
	get height() {
		return parseInt(this.pattern.getAttribute("height") || "0");
	}
	set height(h: Int) {
		this.pattern.setAttribute("height", h.toString());
	}
}

class SVGPath extends SVGPattern {
	path: SVGPathElement;
	constructor(path: SVGPathElement) {
		super(path.parentNode as SVGPatternElement);
		this.path = path;
	}
	get d() {
		return this.path.getAttribute("d") || "";
	}
	set d(d: string) {
		this.path.setAttribute("d", d);
	}
	get fill() {
		return rgba2Colour(this.path.getAttribute("fill") || "rgba(0, 0, 0, 0)");
	}
	set fill(f: Colour) {
		this.path.setAttribute("fill", colour2RGBA(f));
	}
	get stroke() {
		return rgba2Colour(this.path.getAttribute("stroke") || "rgba(0, 0, 0, 0)");
	}
	set stroke(s: Colour) {
		this.path.setAttribute("stroke", colour2RGBA(s));
	}
	get strokeWidth() {
		return parseInt(this.path.getAttribute("stroke-width") || "0");
	}
	set strokeWidth(w: Int) {
		this.path.setAttribute("stroke-width", w.toString());
	}
}

class SVGGrid extends SVGPath {
	get width() {
		return super.width;
	}
	set width(w: Int) {
		this.d = `M 0 ${w} V 0 H ${w}`;
		super.width = w;
	}
	get height() {
		return this.width;
	}
	set height(h: Int) {}
}

class SVGTransform {
	x: Int = 0;
	y: Int = 0;
	rotation: Int = 0;
	flip: boolean = false;
	flop: boolean = false;
	width: Int;
	height: Int;
	constructor(transform: string, width: Int, height: Int) {
		this.width = width;
		this.height = height;
		for (const [, fn, a, b] of transform.matchAll(/([a-z]+)\( *([0-9]+) *,? *([0-9]*) *\)/g)) {
			switch (fn) {
			case "translate":
				if (b) {
					this.x = parseInt(a);
					this.y = parseInt(b);
				} else {
					this.x = this.y = parseInt(a);
				}
				break;
			case "rotate":
				this.rotation = parseInt(a);
				break;
			case "scale":
				if (b) {
					this.flop = parseInt(a) === -1;
					this.flip = parseInt(b) === -1;
				} else {
					this.flip = this.flop = parseInt(a) === -1;
				}
				break;
			}
			if (this.flop) {
				this.x = -this.x - this.width;
			}
			if (this.flip) {
				this.y = -this.y - this.height;
			}
		}
	}
	toString() {
		let ret = "";
		if (this.x !== 0 || this.y !== 0) {
			ret += `translate(${this.flop ? -this.x - this.width : this.x}, ${this.flip ? -this.y - this.height : this.y}) `;
		}
		if (this.flip || this.flop) {
			ret += `scale(${this.flop ? -1 : 1}, ${this.flip ? -1 : 1}) `;
		}
		if (this.rotation !== 0) {
			ret += `rotate(${this.rotation})`;
		}
		return ret;
	}
}

class SVGImage extends SVGPattern {
	image: SVGImageElement;
	transform: SVGTransform;
	constructor(image: SVGImageElement) {
		super(image.parentNode as SVGPatternElement);
		this.image = image;
		this.transform = new SVGTransform(image.getAttribute("transform") || "", this.width, this.height);
	}
	get width() {
		return super.width;
	}
	set width(w: Int) {
		this.transform.width = w;
		this.updateTransform();
		super.width = w;
	}
	get height() {
		return super.height;
	}
	set height(h: Int) {
		this.transform.height = h;
		this.updateTransform();
		super.height = h;
	}
	get source() {
		return this.image.getAttribute("xlink:href") || "";
	}
	set source(src: string) {
		this.image.setAttribute("xlink:href", src);
	}
	get translateX() {
		return this.transform.x;
	}
	set translateX(x: Int) {
		this.transform.x = x;
		this.updateTransform();
	}
	get translateY() {
		return this.transform.x;
	}
	set translateY(y: Int) {
		this.transform.y = y;
		this.updateTransform();
	}
	get translate() {
		return [this.transform.x, this.transform.y];
	}
	set translate(t: [Int, Int]) {
		this.transform.x = t[0];
		this.transform.y = t[1];
		this.updateTransform();
	}
	get rotation() {
		return this.transform.rotation;
	}
	set rotation(r: Int) {
		this.transform.rotation = r;
		this.updateTransform();
	}
	get flip() {
		return this.transform.flip;
	}
	set flip(f: boolean) {
		this.flip = f;
		this.updateTransform();
	}
	get flop() {
		return this.transform.flop;
	}
	set flop(f: boolean) {
		this.flop = f;
		this.updateTransform();
	}
	updateTransform() {
		this.image.setAttribute("transform", this.transform.toString());
	}
}

class Defs {
	defs: SVGDefsElement;
	list: Record<string, SVGPattern | SVGImage> = {};
	constructor(root: Node) {
		this.defs = root.appendChild(defs(SortNode.from(root).filterRemove(({node}) => node instanceof SVGDefsElement).flatMap(c => Array.from(c.node.childNodes))));
		(Array.from(this.defs.childNodes).filter(c => c instanceof SVGPatternElement) as SVGPatternElement[]).forEach(c => {
			const p = SVGPattern.from(c);
			this.list[p.id] = p;
		});
	}
	add(p: SVGPatternElement) {
		let id = p.getAttribute("id");
		if (!id) {
			let i = 0;
			while (!this.list[`Pattern_${i}`]) {
				i++;
			};
			id = `Pattern_${i}`;
		}
		this.list[id] = SVGPattern.from(p);
		this.defs.appendChild(p);
		return id;
	}
	remove(id: string) {
		this.defs.removeChild(this.list[id].pattern);
		delete(this.list[id]);
	}
}

class SVGToken {
	node: SVGImageElement;
	transform: SVGTransform;
	constructor(node: SVGImageElement) {
		this.node = node;
		this.transform = new SVGTransform(node.getAttribute("transform") || "", parseInt(node.getAttribute("width") || "0"), parseInt(node.getAttribute("height") || "0"));
	}
	at(x: Int, y: Int) {
		return x >= this.transform.x && x < this.transform.x + this.transform.width && y >= this.transform.y && y < this.transform.y + this.transform.height;
	}
}


let layerNum = 0;

const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
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
		tokens: SortNode.from<SVGToken, SVGElement>(node, c => c instanceof SVGImageElement ? new SVGToken(c) : undefined)
	};
      },
      walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as SortNode<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn)));

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		layerNum = 0;
		const root = createSVG((mapData as Document).getElementsByTagName("svg")[0], {"data-is-folder": "true", "data-name": "", "ondragover": (e: DragEvent) => {
			e.preventDefault();
			e.dataTransfer!.dropEffect = "link";
		      }, "ondrop": (e: DragEvent) => {
			if (selectedLayer === null) {
				return;
			}
			const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset")),
			      src = `/images/${tokenData.id}`;
			selectedLayer.tokens.push(new SVGToken(image({"href": src, "preserveAspectRatio": "none", "width": tokenData.width, "height": tokenData.height, "transform": `translate(${e.clientX}, ${e.clientY})`})));
			rpc.addToken(selectedLayerPath, {"source": src, "x": e.clientX, "y": e.clientY, "width": tokenData.width, "height": tokenData.height, tokenType: 1} as Token).catch(alert);
		      }, "onclick": (e: MouseEvent) => {
			if (!selectedLayer) {
				return;
			}
			if (selectedToken) {
				outline.setAttribute("visibility", "hidden");
			}
			selectedToken = selectedLayer.tokens.reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | null);
			if (!selectedToken) {
				return;
			}
			createSVG(outline, {"x": selectedToken.transform.x.toString(), "y": selectedToken.transform.y.toString(), "width": selectedToken.transform.width.toString(), "height": selectedToken.transform.height.toString()}).removeAttribute("visibility");
		      }}),
		      definitions = new Defs(root),
		      layerList = processLayers(root) as SVGFolder,
		      outline = root.appendChild(rect({"stroke": "#000", "stroke-width": "1", "visibility": "hidden", "fill": "transparent"})),
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
			(fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer)).forEach(e => {
				if (selectedLayer === e) {
					selectedLayer = null;
				} else if (isSVGFolder(e)) {
					if (walkFolders(e, (e: SVGFolder | SVGLayer) => Object.is(e, selectedLayer))) {
						selectedLayer  = null;
					}
				}
			});
		      };
		let selectedLayer: SVGLayer | null = null, selectedLayerPath = "", selectedToken: SVGToken | null = null;
		if (!definitions.list["gridPattern"]) {
			definitions.add(pattern({"id": "gridPattern"}, path()));
		}
		if (!getLayer(layerList, "/Grid")) {
			layerList.children.push(processLayers(g({"data-name": "Grid"})));
		}
		if (!getLayer(layerList, "/Light")) {
			layerList.children.push(processLayers(g({"data-name": "Light"})));
		}
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
				if (selectedLayerPath === path) {
					selectedLayerPath = splitAfterLastSlash(path)[0] + "/" + name;
				}
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
			"setLayer": (path: string) => {
				selectedLayer = getLayer(layerList, path) as SVGLayer;
				selectedLayerPath = path;
			},
			"setLayerMask": (path: string) => {},
			"moveLayer": (from: string, to: string, pos: Int) => rpc.moveLayer(from, to, pos).then(() => {
				const [parentStr, nameStr] = splitAfterLastSlash(from),
				      fromParent = getLayer(layerList, parentStr)!,
				      toParent = getLayer(layerList, to) as SVGFolder;
				if (isSVGFolder(fromParent)) {
					toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
				}
			}),
			"getMapDetails": () => {
				const grid = definitions.list["gridPattern"] as SVGGrid;
				return {
					"width": parseInt(root.getAttribute("width")!),
					"height": parseInt(root.getAttribute("height")!),
					"square": grid.width,
					"colour": grid.stroke,
					"stroke": grid.strokeWidth
				}
			},
			"setMapDetails": (details: GridDetails) => rpc.setMapDetails(details).then(() => {
				const grid = definitions.list["gridPattern"] as SVGGrid;
				root.setAttribute("width", details["width"].toString());
				root.setAttribute("height", details["height"].toString());
				grid.width = details["square"];
				grid.stroke = details["colour"];
				grid.strokeWidth = details["stroke"];
			})
		});
		clearElement(base).appendChild(root);
	}));
}
