import {Colour, Int, LayerTokens, LayerFolder} from './types.js';
import {defs} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import {colour2RGBA, rgba2Colour} from './misc.js';

export type SVGLayer = LayerTokens & {
	node: SVGElement;
	tokens: SortNode<SVGToken | SVGShape>;
};

export type SVGFolder = LayerFolder & {
	node: SVGElement;
	children: SortNode<SVGFolder | SVGLayer>;
};

export class SVGPattern {
	pattern: SVGPatternElement;
	constructor(pattern: SVGPatternElement) {
		this.pattern = pattern;
	}
	static from(p: SVGPatternElement) {
		if (p.firstChild instanceof SVGPathElement) {
			if (p.getAttribute("id") === "gridPattern") {
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

export class SVGPath extends SVGPattern {
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

export class SVGGrid extends SVGPath {
	get width() {
		return super.width;
	}
	set width(w: Int) {
		this.d = `M 0 ${w} V 0 H ${w}`;
		super.width = w;
		super.height = w;
	}
	get height() {
		return this.width;
	}
	set height(h: Int) {}
}

export class SVGTransform {
	x: Int = 0;
	y: Int = 0;
	rotation: Int = 0;
	flip: boolean = false;
	flop: boolean = false;
	width: Int;
	height: Int;
	constructor(transform: SVGAnimatedTransformList, width: Int, height: Int) {
		this.width = width;
		this.height = height;
		for (let i = 0; i < transform.baseVal.numberOfItems; i++) {
			const svgTransform = transform.baseVal.getItem(i);
			switch (svgTransform.type) {
			case 2: // Translate
				this.x += Math.round(svgTransform.matrix.e);
				this.y += Math.round(svgTransform.matrix.f);
				break;
			case 3: // Scale
				this.flop = svgTransform.matrix.a === -1;
				this.flip = svgTransform.matrix.d === -1;
				break;
			case 4: // Rotate
				this.rotation = 256 * Math.round(svgTransform.angle) / 360;
				while (this.rotation < 0) {
					this.rotation += 256;
				}
				while (this.rotation >= 256) {
					this.rotation -=256;
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

export class SVGImage extends SVGPattern {
	image: SVGImageElement;
	transform: SVGTransform;
	constructor(image: SVGImageElement) {
		super(image.parentNode as SVGPatternElement);
		this.image = image;
		this.transform = new SVGTransform(image.transform, this.width, this.height);
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

export class Defs {
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

export class SVGToken {
	node: SVGImageElement;
	transform: SVGTransform;
	constructor(node: SVGImageElement) {
		this.node = node;
		this.transform = new SVGTransform(node.transform, parseInt(node.getAttribute("width") || "0"), parseInt(node.getAttribute("height") || "0"));
	}
	get snap() {
		return this.node.getAttribute("data-snap") === "true";
	}
	set snap(s: boolean) {
		if (s) {
			this.node.setAttribute("data-snap", "true");
		} else {
			this.node.removeAttribute("data-snap");
		}
	}
	at(x: Int, y: Int) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.transform.width && ry >= 0 && ry < this.transform.height;
	}
}

export class SVGShape {
	node: SVGRectElement | SVGCircleElement;
	transform: SVGTransform;
	constructor(node: SVGRectElement | SVGCircleElement) {
		this.node = node;
		this.transform = new SVGTransform(node.transform, parseInt(node.getAttribute("width") || "0"), parseInt(node.getAttribute("height") || "0"));
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
	get snap() {
		return this.node.getAttribute("data-snap") === "true";
	}
	set snap(s: boolean) {
		if (s) {
			this.node.setAttribute("data-snap", "true");
		} else {
			this.node.removeAttribute("data-snap");
		}
	}
	at(x: Int, y: Int) {
		const {x: rx, y: ry} = new DOMPoint(x, y).matrixTransform(this.node.getScreenCTM()!.inverse());
		return rx >= 0 && rx < this.transform.width && ry >= 0 && ry < this.transform.height;
	}
}
