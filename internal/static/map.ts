import {Colour, FromTo, IDName, Int, RPC, GridDetails, Layer, LayerFolder, LayerRPC, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {createHTML} from './lib/html.js';
import {defs, g, path, pattern} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import {colour2RGBA, rgba2Colour} from './misc.js';
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
	get width() {
		return super.width;
	}
	set width(w: Int) {
		this.path.setAttribute("width", w.toString());
		super.width = w;
	}
	get height() {
		return super.height;
	}
	set height(h: Int) {
		this.path.setAttribute("height", h.toString());
		super.height = h;
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
		for (const [fn, a, b] of transform.matchAll(/([a-z]+)\( *([0-9]+) *,? *([0-9]*) *\)/g)) {
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
			ret += `transform(${this.flop ? -this.x - this.width : this.x}, ${this.flip ? -this.y - this.height : this.y}) `;
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
		this.defs = root.appendChild(defs(SortNode.from(root).filterRemove(c => c instanceof SVGDefsElement).flatMap(c => Array.from(c.node.childNodes))));
		(Array.from(this.defs.childNodes).filter(c => c instanceof SVGPatternElement) as SVGPatternElement[]).forEach(c => {
			const p = SVGPattern.from(c);
			this.list[p.id] = p;
		});
	}
	add(p: SVGPatternElement) {
		this.list[p.getAttribute("id") || ""] = SVGPattern.from(p);
		this.defs.appendChild(p);
	}
	remove(id: string) {
		this.defs.removeChild(this.list[id].pattern);
		delete(this.list[id]);
	}
}


let layerNum = 0;

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
		children: SortNode.from<SVGFolder | SVGLayer | SVGPsuedo>(node, c => c instanceof SVGGElement ? processLayers(c) : undefined),
		folders: {},
		items: {},
	} : {
		id,
		node,
		name,
		hidden,
		mask: node.getAttribute("mask") || "",
		tokens: SortNode.from<SVGToken, SVGElement>(node, c => c instanceof SVGRectElement ? {node: c} : undefined)
	};
      };

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		layerNum = 0;
		const root = createHTML((mapData as Document).getElementsByTagName("svg")[0], {"data-is-folder": "true", "data-name": ""}),
		      definitions = new Defs(root),
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
		if (!definitions.list["gridPattern"]) {
			definitions.add(pattern({"id": "gridPattern"}, path()));
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
				if (isSVGFolder(fromParent)) {
					toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
				}
			}),
			"getMapDetails": () => {
				const grid = (Array.from(root.childNodes).filter(e => e instanceof SVGDefsElement).flatMap(e => Array.from(e.childNodes)).filter(e => e instanceof SVGPatternElement && e.getAttribute("id") === "gridPattern") as SVGPatternElement[]).pop() || pattern({"width": "0"}),
				      gridColour = (Array.from(grid.childNodes).filter(e => e instanceof SVGPathElement) as SVGPathElement[]).map(e => ({"colour": e.getAttribute("stroke") || "rgba(0, 0, 0, 0)", "stroke": e.getAttribute("stroke-width") || "0"})).pop() || {"colour": "rgba(0, 0, 0, 0)", "stroke": "0"};
				return {
					"width": parseInt(root.getAttribute("width")!),
					"height": parseInt(root.getAttribute("height")!),
					"square": parseInt(grid.getAttribute("width")!),
					"colour": rgba2Colour(gridColour["colour"]),
					"stroke": parseInt(gridColour["stroke"])
				}
			},
			"setMapDetails": (details: GridDetails) => rpc.setMapDetails(details).then(() => {
				const grid = (Array.from(root.childNodes).filter(e => e instanceof SVGDefsElement).flatMap(e => Array.from(e.childNodes)).filter(e => e instanceof SVGPatternElement && e.getAttribute("id") === "gridPattern") as SVGPatternElement[]).pop() || (Array.from(root.childNodes).filter(e => e instanceof SVGDefsElement).pop() || root.appendChild(defs())).appendChild(pattern({"patternUnits": "userSpaceOnUse", "id": "gridPattern"})),
				      gridPath = (Array.from(grid.childNodes).filter(e => e instanceof SVGPathElement) as SVGPathElement[]).pop() || path({"d": "M 0 1 V 0 H 1"});
				root.setAttribute("width", details["width"].toString());
				root.setAttribute("height", details["height"].toString());
				grid.setAttribute("width", details["square"].toString());
				grid.setAttribute("height", details["square"].toString());
				gridPath.setAttribute("stroke", colour2RGBA(details["colour"]));
				gridPath.setAttribute("stroke-width", details["stroke"].toString());
			})
		});
		base.appendChild(root);
	}));
}
