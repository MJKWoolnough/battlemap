import {Colour, FromTo, IDName, Int, RPC, GridDetails, Layer, LayerFolder, LayerRPC, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createSVG, defs, g, image, path, pattern, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import place, {item, menu} from './lib/context.js';
import {colour2RGBA, rgba2Colour} from './misc.js';
import {ShellElement} from './windows.js';

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
		for (const [, fn, a, b] of transform.matchAll(/([a-z]+)\( *([\-]?[0-9]+) *,? *([\-]?[0-9]*) *,? *[\-]?[0-9]* *\)/g)) {
			switch (fn) {
			case "translate":
				if (b !== undefined) {
					this.x += parseInt(a);
					this.y += parseInt(b);
				} else {
					const da = parseInt(a);
					this.x += da;
					this.y += da;
				}
				break;
			case "rotate":
				this.rotation = 256 * parseInt(a) / 360;
				while (this.rotation < 0) {
					this.rotation += 256;
				}
				while (this.rotation >= 256) {
					this.rotation -=256;
				}
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
		}
		if (this.flop) {
			this.x -= this.width;
		}
		if (this.flip) {
			this.y -= this.height;
		}
		if (this.flip !== this.flop && this.rotation > 0) {
			this.rotation = 256 - this.rotation;
		}
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
		return this.image.getAttribute("href") || "";
	}
	set source(src: string) {
		this.image.setAttribute("href", src);
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
			while (this.list[`Pattern_${i}`] !== undefined) {
				i++;
			}
			id = `Pattern_${i}`;
			p.setAttribute("id", id);
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
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.transform.width && ry >= 0 && ry < this.transform.height;
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
		const fill = this.node.getAttribute("fill") || "";
		if (!fill.startsWith("rgb")) {
			throw new Error("invalid fill access");
		}
		return rgba2Colour(fill);
	}
	set fill(c: Colour) {
		this.node.setAttribute("fill", colour2RGBA(c));
	}
	get fillSrc() {
		const fill = this.node.getAttribute("fill") || "";
		if (!fill.startsWith("url(#")) {
			throw new Error("invalid fill access");
		}
		return fill.slice(5, -1);
	}
	get isPattern() {
		return (this.node.getAttribute("fill") || "").startsWith("url(#");
	}
	set fillSrc(src: string) {
		this.node.setAttribute("fill", "url(#" + src + ")");
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
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.transform.width && ry >= 0 && ry < this.transform.height;
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
      walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as SortNode<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn))),
      ratio = (mDx: Int, mDy: Int, width: Int, height: Int, dX: (-1 | 0 | 1), dY: (-1 | 0 | 1)) => {
	mDx *= dX;
	mDy *= dY;
	if (dX !== 0 && mDy < mDx * height / width || dY === 0) {
		mDy = mDx * height / width;
	} else {
		mDx = mDy * width / height;
	}
	if (width + mDx < 10) {
		mDx = 10 - width;
		mDy = 10 * height / width - height;
	}
	if (height + mDy < 10) {
		mDx = 10 * width / height - width;
		mDy = 10 - height;
	}
	return [mDx * dX, mDy * dY];
      };

export default function(rpc: RPC, shell: ShellElement, base: Element,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
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
			if (!selectedLayer || e.button !== 0) {
				return;
			}
			unselectToken();
			selectedToken = selectedLayer.tokens.reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | SVGShape | null);
			if (!selectedToken) {
				return;
			}
			root.appendChild(autoFocus(createSVG(outline, {"transform": selectedToken.transform.toString(false), "--outline-width": selectedToken.transform.width + "px", "--outline-height": selectedToken.transform.height + "px", "class": `cursor_${((selectedToken.transform.rotation + 143) >> 5) % 4}`})));
			tokenMousePos.x = selectedToken.transform.x;
			tokenMousePos.y = selectedToken.transform.y;
			tokenMousePos.width = selectedToken.transform.width;
			tokenMousePos.height = selectedToken.transform.height;
			tokenMousePos.rotation = selectedToken.transform.rotation;
		      }}),
		      tokenDrag = (e: MouseEvent) => {
			let {x, y, width, height, rotation} = tokenMousePos;
			const dx = e.clientX - tokenMousePos.mouseX,
			      dy = e.clientY - tokenMousePos.mouseY;
			switch (tokenDragMode) {
			case 0:
				x += dx;
				y += dy;
				break;
			case 1:
				rotation = Math.round(-128 * Math.atan2((x + width / 2) - e.clientX, (y + height / 2) - e.clientY) / Math.PI);
				while (rotation < 0) {
					rotation += 256;
				}
				outline.setAttribute("class", `cursor_${((rotation + 143) >> 5) % 4}`);
				break;
			default: {
				const r = -360 * rotation / 256,
				      {x: aDx, y: aDy} = new DOMPoint(dx, dy).matrixTransform(new DOMMatrix().rotateSelf(r)),
				      fr = new DOMMatrix().translateSelf(x + width / 2, y + height / 2).rotateSelf(-r).translateSelf(-(x + width / 2), -(y + height / 2)),
				      dirX = [2, 5, 7].includes(tokenDragMode) ? -1 : [4, 6, 9].includes(tokenDragMode) ? 1 : 0,
				      dirY = [2, 3, 4].includes(tokenDragMode) ? -1 : [7, 8, 9].includes(tokenDragMode) ? 1 : 0,
				      [mDx, mDy] = ratio(aDx, aDy, width, height, dirX, dirY);
				if (dirX === -1) {
					x += mDx;
					width -= mDx;
				} else if (dirX === 1) {
					width += mDx;
				}
				if (dirY === -1) {
					y += mDy;
					height -= mDy;
				} else if (dirY === 1) {
					height += mDy;
				}
				const {x: cx, y: cy} = new DOMPoint(x + width/2, y + height/2).matrixTransform(fr),
				      {x: nx, y: ny} = new DOMPoint(x, y).matrixTransform(fr).matrixTransform(new DOMMatrix().translateSelf(cx, cy).rotateSelf(r).translateSelf(-cx, -cy));
				x = nx;
				y = ny;
			}}
			selectedToken!.transform.x = x;
			selectedToken!.transform.y = y;
			selectedToken!.transform.width = width;
			selectedToken!.transform.rotation = rotation;
			selectedToken!.node.setAttribute("width", width.toString());
			outline.style.setProperty("--outline-width", width + "px");
			selectedToken!.transform.height = height;
			selectedToken!.node.setAttribute("height", height.toString());
			outline.style.setProperty("--outline-height", height + "px");
			selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
			outline.setAttribute("transform", selectedToken!.transform.toString(false));
		      },
		      tokenMouseDown = function(this: SVGRectElement, e: MouseEvent) {
			if (e.button !== 0) {
				return;
			}
			e.stopImmediatePropagation();
			root.addEventListener("mousemove", tokenDrag);
			root.addEventListener("mouseup", tokenMouseUp);
			tokenDragMode = parseInt(this.getAttribute("data-outline")!);
			root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((selectedToken!.transform.rotation + 143) >> 5)) % 4 + 2]);
			tokenMousePos.mouseX = e.clientX;
			tokenMousePos.mouseY = e.clientY;
		      },
		      tokenMouseUp = () => {
			if (!selectedToken) {
				return;
			}
			root.removeEventListener("mousemove", tokenDrag);
			root.removeEventListener("mouseup", tokenMouseUp);
			root.style.removeProperty("--outline-cursor");
			tokenMousePos.x = selectedToken!.transform.x = Math.round(selectedToken!.transform.x);
			tokenMousePos.y = selectedToken!.transform.y = Math.round(selectedToken!.transform.y);
			tokenMousePos.rotation = selectedToken!.transform.rotation = Math.round(selectedToken!.transform.rotation);
			tokenMousePos.width = selectedToken!.transform.width = Math.round(selectedToken!.transform.width);
			tokenMousePos.height = selectedToken!.transform.height = Math.round(selectedToken!.transform.height);
			selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
			outline.setAttribute("transform", selectedToken!.transform.toString(false));
			outline.focus();
			rpc.setToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.x, selectedToken!.transform.y, selectedToken!.transform.width, selectedToken!.transform.height, selectedToken!.transform.rotation).catch(alert);
		      },
		      tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
		      deleteToken = () => {
				const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
				selectedLayer!.tokens.splice(pos, 1);
				unselectToken();
				rpc.removeToken(selectedLayerPath, pos).catch(alert);
		      },
		      outline = g({"id": "outline", "tabindex": "-1", "onkeyup": (e: KeyboardEvent) => {
			switch (e.key) {
			case "Delete":
				deleteToken();
				break;
			case "ArrowUp":
			case "ArrowDown":
			case "ArrowLeft":
			case "ArrowRight":
				rpc.setToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.x, selectedToken!.transform.y, selectedToken!.transform.width, selectedToken!.transform.height, selectedToken!.transform.rotation).catch(alert);
			}
		      }, "onkeydown": (e: KeyboardEvent) => {
			switch (e.key) {
			case "ArrowUp":
				selectedToken!.transform.y--;
				break;
			case "ArrowDown":
				selectedToken!.transform.y++;
				break;
			case "ArrowLeft":
				selectedToken!.transform.x--;
				break;
			case "ArrowRight":
				selectedToken!.transform.x++;
				break;
			default:
				return;
			}
			selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
			outline.setAttribute("transform", selectedToken!.transform.toString(false));
		      }, "oncontextmenu": (e: MouseEvent) => {
			      e.preventDefault();
			      place(base, [e.clientX, e.clientY], [
				      item("Flip", () => {
					selectedToken!.transform.flip = !selectedToken!.transform.flip;
					selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
					outline.focus();
					rpc.flipToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.flip).catch(alert);
				      }),
				      item("Flop", () => {
					selectedToken!.transform.flop = !selectedToken!.transform.flop;
					selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
					outline.focus();
					rpc.flopToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.flop).catch(alert);
				      }),
				      item(`Set as ${selectedToken instanceof SVGShape && selectedToken.isPattern ? "Image" : "Pattern"}`, () => {
					const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
					let newToken: SVGToken | SVGShape;
					if (selectedToken instanceof SVGToken) {
						newToken = new SVGShape(rect({"width": selectedToken.transform.width, "height": selectedToken.transform.height, "transform": selectedToken.transform.toString(), "fill": `url(#${definitions.add(pattern({"width": selectedToken.transform.width, "height": selectedToken.transform.height, "patternUnits": "userSpaceOnUse"}, image({"preserveAspectRatio": "none", "width": selectedToken.transform.width, "height": selectedToken.transform.height, "href": selectedToken.node.getAttribute("href")!})))})`}));
						rpc.setTokenPattern(selectedLayerPath, pos).catch(alert);
					} else if (selectedToken instanceof SVGShape && selectedToken.isPattern) {
						newToken = new SVGToken(image({"preserveAspectRatio": "none", "width": selectedToken.transform.width, "height": selectedToken.transform.height, "transform": selectedToken.transform.toString(), "href": (definitions.list[selectedToken.fillSrc] as SVGImage).source}));
						rpc.setTokenImage(selectedLayerPath, pos).catch(alert);
					} else {
						return;
					}
					selectedLayer!.tokens.splice(pos, 1, newToken);
					selectedToken = newToken;
				      }),
				      item("Delete", deleteToken)
			      ]);
		      }}, Array.from({length: 10}, (_, n) => rect({"data-outline": n, "onmousedown": tokenMouseDown}))),
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
