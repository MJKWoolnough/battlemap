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
	tokens: SortNode<SVGToken | SVGShape>;
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
		return rgba2Colour(this.path.getAttribute("fill") || "");
	}
	set fill(f: Colour) {
		this.path.setAttribute("fill", colour2RGBA(f));
	}
	get stroke() {
		return rgba2Colour(this.path.getAttribute("stroke") || "");
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
		for (const [, fn, a, b] of transform.matchAll(/([a-z]+)\( *([0-9]+) *,? *([0-9]*) *,? *[0-9]* *\)/g)) {
			switch (fn) {
			case "translate":
				if (b) {
					this.x += parseInt(a);
					this.y += parseInt(b);
				} else {
					const da = parseInt(a);
					this.x += da;
					this.y += da;
				}
				break;
			case "rotate":
				this.rotation = 255 * parseInt(a) / 360;
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
			ret += `rotate(${360 * this.rotation / 256}, ${this.width / 2}, ${this.height / 2})`;
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

class SVGShape {
	node: SVGRectElement | SVGCircleElement;
	transform: SVGTransform;
	constructor(node: SVGRectElement | SVGCircleElement) {
		this.node = node;
		this.transform = new SVGTransform(node.getAttribute("transform") || "", parseInt(node.getAttribute("width") || "0"), parseInt(node.getAttribute("height") || "0"));
	}
	get fill() {
		return rgba2Colour(this.node.getAttribute("fill") || "");
	}
	set fill(c: Colour) {
		this.node.setAttribute("fill", colour2RGBA(c));
	}
	get stroke() {
		return rgba2Colour(this.node.getAttribute("stroke") || "");
	}
	set stroke(s: Colour) {
		this.node.setAttribute("stroke", colour2RGBA(s));
	}
	get strokeWidth() {
		return parseInt(this.node.getAttribute("stroke-width") || "0");
	}
	set strokeWidth(w: Int) {
		this.node.setAttribute("stroke-width", w.toString());
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
		tokens: SortNode.from<SVGToken | SVGShape, SVGElement>(node, c => c instanceof SVGImageElement ? new SVGToken(c) : c instanceof SVGRectElement || c instanceof SVGCircleElement ? new SVGShape(c) : undefined)
	};
      },
      walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as SortNode<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn)));

export default function(rpc: RPC, shell: Shell, base: Node,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		layerNum = 0;
		let selectedLayer: SVGLayer | null = null, selectedLayerPath = "", selectedToken: SVGToken | SVGShape | null = null, tokenDragX = 0, tokenDragY = 0, tokenDragMode = 0;
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
		      }, "onmousedown": (e: MouseEvent) => {
			if (!selectedLayer) {
				return;
			}
			unselectToken();
			selectedToken = selectedLayer.tokens.reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | SVGShape | null);
			if (!selectedToken) {
				return;
			}
			root.appendChild(createSVG(outline, {"transform": selectedToken.transform.toString(), "--outline-width": selectedToken.transform.width.toString() + "px", "--outline-height": selectedToken.transform.height.toString() + "px"}));
		      }}),
		      tokenDrag = (e: MouseEvent) => {
			let {x, y, width, height, rotation} = selectedToken!.transform;
			const r = -(Math.PI / 128) * rotation,
			      c = Math.cos(r),
			      s = Math.sin(r),
			      dx = e.clientX - tokenMousePos[0],
			      dy = e.clientY - tokenMousePos[1],
			      mDx = c * dx - s * dy,
			      mDy = c * dy + s * dx;
			tokenMousePos[0] = e.clientX;
			tokenMousePos[1] = e.clientY;
			switch (tokenDragMode) {
			case 0:
				x += dx;
				y += dy;
				break;
			case 1:
				rotation = Math.round(-128 * Math.atan2((x + width / 2) - e.clientX, (y + height / 2) - e.clientY) / Math.PI);
				break;
			case 2:
			case 3:
			case 4:
				y += mDy;
				height -= mDy;
				break;
			case 7:
			case 8:
			case 9:
				height += mDy;
				break;
			}
			switch (tokenDragMode) {
			case 2:
			case 5:
			case 7:
				x += mDx;
				width -= mDx;
				break;
			case 4:
			case 6:
			case 9:
				width += mDx;
				break;
			}
			selectedToken!.transform.x = x;
			selectedToken!.transform.y = y;
			selectedToken!.transform.width = width;
			selectedToken!.transform.rotation = rotation;
			selectedToken!.node.setAttribute("width", width.toString());
			outline.style.setProperty("--outline-width", width.toString() + "px");
			selectedToken!.transform.height = height;
			selectedToken!.node.setAttribute("height", height.toString());
			outline.style.setProperty("--outline-height", height.toString() + "px");
			const t = selectedToken!.transform.toString();
			selectedToken!.node.setAttribute("transform", t);
			outline.setAttribute("transform", t);
		      },
		      tokenMouseDown = function(this: SVGRectElement, e: MouseEvent) {
			e.stopImmediatePropagation();
			root.addEventListener("mousemove", tokenDrag);
			root.addEventListener("mouseup", tokenMouseUp);
			tokenDragMode = parseInt(this.getAttribute("data-outline")!);
			root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize"][tokenDragMode]);
			tokenMousePos[0] = e.clientX;
			tokenMousePos[1] = e.clientY;
		      },
		      tokenMouseUp = (e: MouseEvent) => {
			root.removeEventListener("mousemove", tokenDrag);
			root.removeEventListener("mouseup", tokenMouseUp);
			root.style.removeProperty("--outline-cursor");
			selectedToken!.transform.x = Math.round(selectedToken!.transform.x);
			selectedToken!.transform.y = Math.round(selectedToken!.transform.y);
			selectedToken!.transform.rotation = Math.round(selectedToken!.transform.rotation);
			selectedToken!.transform.width = Math.round(selectedToken!.transform.width);
			selectedToken!.transform.height = Math.round(selectedToken!.transform.height);
			rpc.setToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.x, selectedToken!.transform.y, selectedToken!.transform.width, selectedToken!.transform.height, selectedToken!.transform.rotation).catch(alert);
		      },
		      tokenMousePos = [0, 0],
		      outline = g({"id": "outline"}, Array.from({length: 10}, (_, n) => rect({"data-outline": n.toString(), "onmousedown": tokenMouseDown}))),
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
			(fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer)).forEach(e => {
				if (selectedLayer === e) {
					selectedLayer = null;
				} else if (isSVGFolder(e)) {
					if (walkFolders(e, (e: SVGFolder | SVGLayer) => Object.is(e, selectedLayer))) {
						selectedLayer  = null;
					}
				}
			});
		      },
		      unselectToken = () => {
			selectedToken = null;
			if (outline.parentNode) {
				outline.parentNode.removeChild(outline);
			}
		      };
		if (!definitions.list["gridPattern"]) {
			definitions.add(pattern({"id": "gridPattern"}, path()));
		}
		{
			const gridRect = rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)" }),
			      grid = getLayer(layerList, "/Grid");
			if (grid && isSVGLayer(grid)) {
				grid.tokens.filterRemove(() => true);
				grid.tokens.push(new SVGShape(gridRect));
			} else {
				layerList.children.push(processLayers(g({"data-name": "Grid"}, gridRect)));
			}
		}
		{
			const lightRect = rect({"width": "100%", "height": "100%", "fill": "transparent" }),
			      light = getLayer(layerList, "/Light");
			if (light && isSVGLayer(light)) {
				if (light.tokens.length !== 1) {
					light.tokens.filterRemove(() => true);
					light.tokens.push(new SVGShape(lightRect));
				} else {
					const rect = light.tokens[0];
					if (!(rect instanceof SVGShape) || rect.node.getAttribute("width") !== "100%" || rect.node.getAttribute("height") !== "100%") {
						light.tokens.filterRemove(() => true);
						light.tokens.push(new SVGShape(lightRect));
					}
				}
			} else {
				layerList.children.push(processLayers(g({"data-name": "Light"}, lightRect)));
			}
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
			"renameLayer": (path: string, name: string) => {
				getLayer(layerList, path)!.name = name;
				if (selectedLayerPath === path) {
					selectedLayerPath = splitAfterLastSlash(path)[0] + "/" + name;
				}
				return rpc.renameLayer(path, name)
			},
			"remove": (path: string) => {
				remove(path);
				return rpc.removeLayer(path);
			},
			"removeFolder": (path: string) => {
				remove(path);
				return rpc.removeLayer(path);
			},
			"link": (id: Int, path: string) => Promise.reject("invalid"),
			"newLayer": (name: string) => rpc.addLayer(name).then(name => {
				layerList.children.push(processLayers(g({"data-name": name})));
				return name;
			}),
			"setVisibility": (path: string, visibility: boolean) => {
				const layer = getLayer(layerList, path)!;
				if (layer === selectedLayer) {
					unselectToken();
				}
				if (visibility) {
					layer.node.removeAttribute("visibility");
					return rpc.showLayer(path);
				} else {
					layer.node.setAttribute("visibility", "hidden");
					return rpc.hideLayer(path);
				}
			},
			"setLayer": (path: string) => {
				selectedLayer = getLayer(layerList, path) as SVGLayer;
				selectedLayerPath = path;
				unselectToken();
			},
			"setLayerMask": (path: string) => {},
			"moveLayer": (from: string, to: string, pos: Int) => {
				const [parentStr, nameStr] = splitAfterLastSlash(from),
				      fromParent = getLayer(layerList, parentStr)!,
				      toParent = getLayer(layerList, to) as SVGFolder;
				if (isSVGFolder(fromParent)) {
					toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
				}
				unselectToken();
				return rpc.moveLayer(from, to, pos);
			},
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
			"setMapDetails": (details: GridDetails) => {
				const grid = definitions.list["gridPattern"] as SVGGrid;
				root.setAttribute("width", details["width"].toString());
				root.setAttribute("height", details["height"].toString());
				grid.width = details["square"];
				grid.stroke = details["colour"];
				grid.strokeWidth = details["stroke"];
				return rpc.setMapDetails(details);
			},
			"getLightColour": () => {
				return ((getLayer(layerList, "/Light") as SVGLayer).tokens[0] as SVGShape).fill
			},
			"setLightColour": (c: Colour) => {
				((getLayer(layerList, "/Light") as SVGLayer).tokens[0] as SVGShape).fill = c;
				return rpc.setLightColour(c);
			}
		});
		clearElement(base).appendChild(root);
	}));
}
