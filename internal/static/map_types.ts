import {Colour, GridDetails, Int, LayerTokens, LayerFolder, Token} from './types.js';
import {defs, image, path, pattern, rect} from './lib/svg.js';
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
	rotation: Int;
	flip: boolean;
	flop: boolean;
	tokenData: Int;
	tokenType: Int;
	snap: boolean;
	constructor(token: Token) {
		this.transform = new SVGTransform(token);
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
		if (token.patternWidth > 0) {
			this.node = rect({"width": token.width, "height": token.height, "transform": this.transform.toString(), "fill": `url(#${/*definitions.add(this)*/1})`});
		} else {
			this.node = image({"href": `/images/${token.source}`, "preserveAspectRatio": "none", "width": token.width, "height": token.height, "transform": this.transform.toString()});
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
}
