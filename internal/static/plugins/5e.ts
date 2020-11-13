import {KeystoreData, Uint, Int, MapData, Colour, TokenImage} from '../types.js';
import {clearElement} from '../lib/dom.js';
import {br, button, div, h1, img, input, label, li, span, style, table, tbody, td, thead, th, tr, ul} from '../lib/html.js';
import {createSVG, circle, defs, ellipse, feColorMatrix, feGaussianBlur, filter, g, line, mask, path, polygon, rect, symbol, svg, text, use} from '../lib/svg.js';
import {SortNode, noSort} from '../lib/ordered.js';
import {addPlugin, userLevel, PluginType, getSettings} from '../plugins.js';
import {item, menu} from '../lib/context.js';
import {globals, SVGToken, walkLayers, isSVGLayer, SVGLayer, SVGFolder} from '../map.js';
import {getToken} from '../adminMap.js';
import {mapLoadedReceive, requestShell, handleError, makeColourPicker, colour2Hex, colour2RGBA, rgba2Colour, tokenSelectedReceive, isInt, isUint, isColour} from '../misc.js';
import mainLang, {language} from '../language.js';
import {windows, WindowElement} from '../lib/windows.js';
import {rpc, combined as combinedRPC, addMapDataChecker, addCharacterDataChecker, addTokenDataChecker} from '../rpc.js';
import {characterData, iconSelector, tokenSelector, characterSelector} from '../characters.js';
import {addSymbol, getSymbol, addFilter} from '../symbols.js';
import {BoolSetting, JSONSetting} from '../settings_types.js';

document.head.appendChild(style({"type": "text/css"}, ".isAdmin #initiative-window-5e{display:grid;grid-template-rows:2em auto 2em}#initiative-window-5e svg{width:1.5em}#initiative-ordering-5e button,#initiative-next-5e button{height:2em}#initiative-list-5e{list-style:none;padding:0;user-select:none;}#initiative-list-5e li{display:grid;grid-template-columns:4.5em auto 3em;align-items:center}#initiative-list-5e li span{text-align:center}#initiative-list-5e img{height:4em;width:4em}.contextMenu.conditionList{padding-left:1em;box-styling:padding-box}.hasCondition{list-style:square}.hide-token-hp-5e g .token-5e .token-hp-5e,.hide-token-ac-5e g .token-5e .token-ac-5e,.hide-token-names-5e g .token-5e .token-name-5e,.hide-token-conditions-5e g .token-5e .token-conditions-5e,.hide-selected-hp-5e svg>.token-5e .token-hp-5e,.hide-selected-ac-5e svg>.token-5e .token-ac-5e,.hide-selected-names-5e svg>.token-5e .token-name-5e,.hide-selected-conditions-5e svg>.token-5e .token-conditions-5e{visibility:hidden}.desaturate-token-conditions-5e g .token-5e .token-conditions-5e,.desaturate-selected-conditions-5e svg>.token-5e .token-conditions-5e{filter:url(#saturate-5e)}.isUser #display-settings-5e thead,.isUser #display-settings-5e td:last-child{display:none}"));

type IDInitiative = {
	id: Uint;
	initiative: Uint;
}

type TokenFields = {
	"name"?: KeystoreData<string>;
	"5e-initiative"?: KeystoreData<IDInitiative>;
	"5e-initiative-mod"?: KeystoreData<Int>;
	"5e-ac"?: KeystoreData<Uint>;
	"5e-hp-max"?: KeystoreData<Uint>;
	"5e-conditions"?: KeystoreData<boolean[]>;
}

type Token5E = SVGToken & {
	tokenData: TokenFields;
}

type Initiative = {
	token: Token5E;
	hidden: boolean;
	node: HTMLLIElement;
}

type MapData5E = MapData & {
	data: {
		"5e-initiative"?: Uint[];
	}
}

type WindowData = [Int, Int, Uint, Uint];

type MetaURL = {
	url: string;
}

type ShapechangeCat = {
	"name": string;
	"images": boolean[];
}

type ShapechangeToken = {
	src: Uint;
	name: string;
}

type Settings5E = {
	"shapechange-categories": ShapechangeCat[];
	"store-image-shapechanges": ShapechangeToken[];
}

class SVGToken5E extends SVGToken {
	tokenNode: SVGGraphicsElement;
	extra: SVGGElement;
	hp: SVGGElement;
	hpValue: SVGTextElement;
	hpBar: SVGUseElement;
	hpBack: SVGUseElement;
	name: SVGTextElement;
	ac: SVGGElement;
	acValue: SVGTextElement;
	shield: SVGUseElement;
	conditions: SVGGElement;
	tokenData: Record<string, KeystoreData> & TokenFields;
	constructor(token: TokenImage) {
		throw(new Error("use from"));
		super(token);
	}
	init() {
		const maxHP: Uint | null = this.getData("5e-hp-max"),
		      currentHP: Uint | null = this.getData("5e-hp-current"),
		      ac: Uint | null = this.getData("5e-ac"),
		      size = Math.min(this.width, this.height) / 4
		this.node = g([
			this.tokenNode = this.node,
			this.extra = g({"class": "token-5e", "transform": `translate(${this.x}, ${this.y})`, "style": "color: #000"}, [
				this.hp = g({"class": "token-hp-5e", "style": currentHP === null || maxHP === null ? "display: none" : undefined}, [
					this.hpBack = use({"href": "#5e-hp-back", "width": size, "height": size}),
					this.hpBar = use({"href": "#5e-hp", "width": size, "height": size, "stroke-dasharray": `${Math.PI * 19 * 0.75 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1)} 60`, "style": `color: rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`}),
					this.hpValue = text({"x": this.width / 8, "y": "1.2em", "text-anchor": "middle", "fill": `rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`}, currentHP?.toString() ?? "")
				]),
				this.name = text({"class": "token-name-5e", "style": {"user-select": "none"}, "stroke": "#fff", "stroke-width": 1, "fill": "#000", "x": this.width / 2, "y": "1em", "text-anchor": "middle"}, this.getData("name") ?? ""),
				this.ac = g({"class": "token-ac-5e", "style": ac === null ? "display: none" : undefined}, [
					this.shield = use({"href": "#5e-shield", "width": size, "height": size, "x": 3 * this.width / 4}),
					this.acValue = text({"x": 7 * this.width / 8, "y": "1.2em", "text-anchor": "middle"}, ac?.toString() ?? "")
				]),
				this.conditions = g({"class": "token-conditions-5e"})
			])
		]);
		window.setTimeout(this.setTextWidth.bind(this), 0);
		this.updateConditions();
	}
	setTextWidth() {
		const maxNameLength = this.width / 2,
		      nameLength = this.name.getComputedTextLength(),
		      size = Math.min(this.width, this.height) / 8,
		      textSize = Math.min(16 * (maxNameLength / nameLength), this.height / 8);
		this.name.style.setProperty("font-size", textSize + "px");
		this.name.setAttribute("stroke-width", `${textSize / 100}`);
		this.acValue.style.setProperty("font-size", `${size}px`);
		this.hpValue.style.setProperty("font-size", `${size}px`);
	}
	at(x: Int, y: Int) {
		return super.at(x, y, this.tokenNode);
	}
	setPattern(isPattern: boolean) {
		super.setPattern(isPattern);
		if (isPattern) {
			if (lastSelectedToken === this) {
				lastSelectedToken = null;
			}
			this.extra.remove();
		} else {
			if (globals.selected.token === this) {
				lastSelectedToken = this;
				globals.outline.insertAdjacentElement("beforebegin", lastSelectedToken.extra);
			}
			this.node.replaceWith(this.node = g([this.node, this.extra]));
		}
	}
	unselect() {
		if (!this.isPattern) {
			this.node.appendChild(this.extra);
		}
	}
	updateNode() {
		createSVG(this.tokenNode, {"width": this.width, "height": this.height, "transform": this.transformString()});
		createSVG(this.extra, {"transform": `translate(${this.x}, ${this.y})`});
		createSVG(this.shield, {"x": 3 * this.width / 4, "width": this.width / 4, "height": Math.min(this.height, this.width) / 4});
		createSVG(this.hpBack, {"width": this.width / 4, "height": Math.min(this.width, this.height) / 4});
		createSVG(this.hpBar, {"width": this.width / 4, "height": Math.min(this.width, this.height) / 4});
		createSVG(this.name, {"x": this.width / 2, "style": {"font-size": undefined}});
		createSVG(this.hpValue, {"x": this.width / 8});
		createSVG(this.acValue, {"x": 7 * this.width / 8});
		this.setTextWidth();
		this.updateConditions();
	}
	updateData() {
		const maxHP: Uint | null = this.getData("5e-hp-max"),
		      currentHP: Uint | null = this.getData("5e-hp-current"),
		      ac: Uint | null = this.getData("5e-ac"),
		      name = this.getData("name") || "";
		if (ac === null) {
			this.ac.setAttribute("style", "display: none");
		} else {
			this.ac.removeAttribute("style");
			this.acValue.innerHTML = ac.toString();
		}
		if (currentHP === null || maxHP === null) {
			this.hp.setAttribute("style", "display: none");
		} else {
			this.hp.removeAttribute("style");
			this.hpValue.innerHTML = currentHP.toString();
			this.hpValue.setAttribute("fill", `rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`);
			this.hpBar.setAttribute("stroke-dasharray", `${Math.PI * 19 * 0.75 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1)} 60`);
		}
		if (this.name.innerHTML !== name) {
			createSVG(this.name, {"style": {"font-size": undefined}}, name);
			this.setTextWidth();
		}
		this.updateConditions();
	}
	updateConditions() {
		clearElement(this.conditions);
		const myConditions: boolean[] = this.getData("5e-conditions") ?? [],
		      size = Math.min(this.width, this.height) / 8,
		      perRow = Math.floor(this.width / size);
		let row = -1, col = 0;
		for (let i = 0; i < myConditions.length; i++) {
			if (myConditions[i]) {
				this.conditions.appendChild(use({"href": `#5e-condition-${conditions[i]}`, "x": col * size, "y": row * size, "width": size, "height": size}));
				col++;
				if (col === perRow) {
					col = 0;
					row--;
				}
			}
		}
		this.conditions.setAttribute("transform", `translate(0, ${this.height})`);
	}

}

class BoolSetting5E extends BoolSetting {
	constructor(name: string, fn: (value: boolean) => void) {
		super(name);
		this.wait(fn);
		fn(this.value);
	}
}

addSymbol("5e-shield", symbol({"viewBox": "0 0 8 9"}, path({"d": "M0,1 q2,0 4,-1 q2,1 4,1 q0,5 -4,8 q-4,-3 -4,-8 z", "fill": "#aaa"})));
addSymbol("5e-hp-back", symbol({"viewBox": "0 0 20 20"}, circle({"r": 9.5, "fill": "#eee", "stroke": "#888", "stroke-width": 1, "stroke-linecap": "round", "stroke-dasharray": `${Math.PI * 19 * 0.75} ${Math.PI * 19 * 0.25}`, "transform": "translate(10, 10) rotate(135)"})));
addSymbol("5e-hp", symbol({"viewBox": "0 0 20 20"}, circle({"r": 9.5, "fill": "transparent", "stroke": "#f00", "stroke-width": 1, "stroke-linecap": "round", "transform": "translate(10, 10) rotate(135)"})));

addFilter(filter({"id": "saturate-5e"}, feColorMatrix({"type": "saturate", "values": 0})))

addSymbol("5e-condition-BLESSED", symbol({"viewBox": "0 0 10 11"}, [circle({"cx": 5, "cy": 6, "r": 5, "fill": "#fc8"}), ellipse({"cx": 5, "cy": 2.5, "rx": 5, "ry": 2, "fill": "transparent", "stroke": "#ff0", "stroke-width": 1}), path({"d": "M1.5,6 q1,-1 2,0 m2.5,0 q1,-1 2,0 M3,9 q2,1 4,0", "fill": "transparent", "stroke": "#000", "stroke-width": 0.1, "stroke-linecap": "round"})]));
addSymbol("5e-condition-BLINDED", symbol({"viewBox": "0 0 100 70"}, [defs(mask({"id": "5e-blind-mask"}, [rect({"width": 100, "height": 70, "fill": "#fff"}), line({"x1": 10, "y1": 67, "x2": 90, "y2": 3, "stroke": "#000", "stroke-width": 9}),])), g({"mask": "url(#5e-blind-mask)"}, use({"href": "#visibility"})), line({"x1": 10, "y1": 67, "x2": 90, "y2": 3, "stroke": "#000", "stroke-width": 5})]));
addSymbol("5e-condition-BLINK", symbol({"viewBox": "0 0 100 80"}, g({"stroke": "#000", "stroke-width": 2}, [ellipse({"cx": 50, "cy": 35, "rx": 49, "ry": 34, "fill": "#fc8"}), path({"d": "M10,55 l-8,9 M20,62 l-5,9 M30,66 l-3,10 M40,69 l-1,10 M50,70 v10 M60,69 l1,10 M70,66 l3,10 M80,62 l5,9 M90,55 l8,9", "stroke-linecap": "round"})])));
addSymbol("5e-condition-BLUR", symbol({"viewBox": "0 0 150 90"}, [defs(g({"id": "blur-face-5e"}, [circle({"cx": 50, "cy": 50, "r": 48, "fill": "#fc8"}), path({"d": "M30,30 v10 a5,5 0,0,0 10,0 v-10 a5,5, 0,0,0 -10,0 M60,30 v10 a5,5 0,0,0 10,0 v-10 a5,5, 0,0,0 -10,0 M20,60 q30,20 60,0 q-30,40 -60,0 Z", "fill": "#321"})])), use({"href": "#blur-face-5e", "style": "opacity: 0.6"}), use({"href": "#blur-face-5e", "style": "opacity: 0.6", "transform": "translate(50, 0)"}), use({"href": "#blur-face-5e", "style": "opacity: 0.8", "transform": "translate(25, 0)"})]));
addSymbol("5e-condition-CHARMED", symbol({"viewBox": "0 0 8.2 8.23"}, path({"d": "M0.1,2.1 a2,2 0,0,1 4,0 a2,2 0,0,1 4,0 q0,3 -4,6 q-4,-3 -4,-6 Z", "fill": "#f00", "stroke": "#000", "stroke-width": 0.2})));
addSymbol("5e-condition-CONFUSED", symbol({"viewBox": "0 0 58 100"}, path({"d": "M37,90 a8,8 0,1,0 0,0.1 z M25,70 h8 l1,-20 a11,8 -10,0,0 -30,-45 v15 h5 l2,-8 a9,6 -10,0,1 13,32 Z", "stroke": "#000", "stroke-width": 2, "fill": "#fff"})));
addSymbol("5e-condition-DEAD", symbol({"viewBox": "0 0 84 110"}, [rect({"x": 18, "y": 50, "width": 47, "height": 30, "fill": "#ffe"}), path({"d": "M12,52 q-9,-1 -10,-10 a35,35 0,1,1 80,0 q-1,9 -10,10 M32,83 c-10,-20 -27,0 -20,-30 c3,-4.5 -5,-13.5 0,-18 M72,35 c5,4.5 -3,13.5 0,18 c7,30 -10,10 -20,30 M17,72.2 c3,10 0,28 5,30 a40,40 0,0,0 40,0 c5,-2 2,-20 5,-30", "fill": "#ffe", "stroke": "#000", "stroke-width": 2, "stroke-linecap": "round"}), path({"d": "M23,74 c3,5 0,15 5,20 a30,30 0,0,0 28,0 c5,-5 2,-15 5,-20 M32,96 v-13 a25,30 0,0,0 20,0 v13 M37,85 v12 M42,86 v12 M47,85 v12 M32,89.5 a27,30 0,0,0 20,0", "fill": "none", "stroke": "#000", "stroke-width": 1}), path({"d": "M19,50 c0,20 18,10 18,5 c2,-15 -20,-10 -18,-5 M 65,50 c0,20 -18,10 -18,5 c-2,-15 20,-10 18,-5 M41,60 c-10,5 -5,25 0,15 Z M43,60 c10,5 5,25 0,15 Z", "fill": "#000"})]));
addSymbol("5e-condition-DEAFENED", symbol({"viewBox": "0 0 65 70"}, [path({"d": "M15,25 a20,20 0,1,1 40,10 c0,5 -10,5 -10,10 c-3,15 -10,30 -20,20 M20,25 a10,10 0,1,1 30,10", "fill": "#fff", "stroke": "#000", "stroke-width": 3, "stroke-linecap": "round"}), path({"d": "M5,60 l20,-20 M50,15 l10,-10", "stroke": "#000", "stroke-width": 8})]));
addSymbol("5e-condition-FLYING", symbol({"viewBox": "0 0 200 100"}, [defs(path({"id": "wing-5e", "d": "M100,99 c40,-20 30,-50 60,-40 q10,5 20,-10 h-40 c40,-10 45,-5 50,-20 l-45,5 c45,-20 50,-10 54,-33 c-120,20 -45,60 -99,98 z", "fill": "#fff", "stroke": "#000", "stroke-width": 2, "stroke-linejoin": "round"})), use({"href": "#wing-5e", "transform": "translate(200, 0) scale(-1, 1)"}), use({"href": "#wing-5e"})]));
addSymbol("5e-condition-GUIDANCE", symbol({"viewBox": "0 0 100 100"}, [defs(polygon({"id": "5e-guidance-points", "points": "16,16 50,30 84,16 70,50 84,84 50,70 16,84 30,50"})), g({"stroke": "#000", "stroke-width": 1}, [use({"href": "#5e-guidance-points", "fill": "#888"}), use({"href": "#5e-guidance-points", "fill": "#ccc", "transform": "rotate(45, 50, 50)"}), circle({"cx": 50, "cy": 50, "r": 20, "fill": "#fff"})])]));
addSymbol("5e-condition-HEXED", symbol({"viewBox": "0 0 100 100"}, [circle({"cx": 50, "cy": 50, "r": 49.5, "fill": "#808", "stroke": "#000", "stroke-width": 1}), path({"d": "M3,35 L79,90 L50,1 L21,90 L97,35 Z", "stroke": "#000", "fill": "#fff", "stroke-linejoin": "bevel", "fill-rule": "evenodd"})]));
addSymbol("5e-condition-HIDEOUS_LAUGHTER", symbol({"viewBox": "0 0 10 10"}, [circle({"cx": 5, "cy": 5, "r": 5, "fill": "#fc8"}), path({"d": "M2.5,2.5 l1,1 l-1,1 M7.5,2.5 l-1,1 l1,1", "stroke": "#000", "stroke-width": 0.2, "fill": "transparent"}), path({"d": "M2,6 h6 a3,3 0,0,1 -6,0 z", "fill": "#000"}), path({"d": "M2.5,7.66 a3,3 0,0,1 5,0 a3,3 0,0,1 -5,0 z", "fill": "#f00"})]));
addSymbol("5e-condition-HUNTERS_MARK", symbol({"viewBox": "0 0 100 100"}, [defs(mask({"id": "hm-5e"}, [rect({"width": 100, "height": 100, "fill": "#fff"}), path({"d": "M0,50 h100 M50,0 v100", "stroke-width": 10, "stroke": "#000"})])), circle({"cx": 50, "cy": 50, "r": 47.5, "fill": "#fff"}), g({"mask": "url(#hm-5e)"}, [circle({"cx": 50, "cy": 50, "r": 30, "stroke": "#f00", "stroke-width": 2, "fill": "none"}), circle({"cx": 50, "cy": 50, "r": 45, "stroke": "#000", "stroke-width": 5, "fill": "none"})]), path({"d": "M0,50 h35 m30,0 h35 M50,0 v35 m0,30 v35", "stroke": "#000", "stroke-width": 3}), path({"d": "M35,50 h10 m10,0 h15 M50,35 v10 m0,10 v10", "stroke": "#000", "stroke-width": 1}), circle({"cx": 50, "cy": 50, "r": 2, "fill": "#f00"})]));
addSymbol("5e-condition-INSPIRED", symbol({"viewBox": "0 0 24 100"}, path({"d": "M20,90 a8,8 0,1,0 0,0.1 z M8,70 h8 l4,-65 h-16 z", "stroke": "#000", "stroke-width": 2, "fill": "#fff"})));
addSymbol("5e-condition-INVISIBLE", symbol({"viewBox": "0 0 82 92"}, g({"stroke": "#000", "stroke-width": 1, "fill": "rgba(255, 255, 255, 0.75)"}, [path({"d": "M81,91 v-50 a30,30 0,0,0 -80,0 v50 l10,-10 l10,10 l10,-10 l10,10 l10,-10 l10,10 l10,-10 z"}), circle({"cx": 20, "cy": 30, "r": 10}), circle({"cx": 60, "cy": 30, "r": 10})])));
addSymbol("5e-condition-MIRROR_IMAGE", symbol({"viewBox": "0 0 70 90"}, [rect({"x": 5, "y": 5, "width": 60, "height": 80, "fill": "#4df", "stroke": "#640", "stroke-width": 10, "rx": 1}), path({"d": "M10,50 v10 L60,15 v-5 h-5 z", "fill": "#8ff"})]));
addSymbol("5e-condition-PETRIFIED", symbol({"viewBox": "0 0 100 90"}, [path({"d": "M5,90 a60,60 0,0,1 90,0", "fill": "red"}), path({"d": "M50,20 c20,0 20,10 20,30 c-2,15 -5,20 -18,30 q-2,1 -4,0 c-13,-10 -16,-15 -18,-30 c0,-20 0,-30 20,-30", "fill": "#fc8"}), path({"d": "M35,45 a10,10 0,0,1 10,0 a10,10 0,0,1 -10,0 M55,45 a10,10 0,0,1 10,0 a10,10 0,0,1 -10,0", "fill": "red", "stroke": "#000", "stroke-width": 0.3}), path({"d": "M40,65 c5,0 5,-5 10,-3 c5,-2 5,3 10,3 q-10,-0.5 -20,0 M41,65 q10,0.5 18,0 c-4,4 -14,4 -18,0", "fill": "#080"}), g({"stroke-width": 8, "stroke-linecap": "round", "fill": "none"}, [ path({"d": "M30,40 c-15,-5 -10,20 -25,10 M70,40 c15,-5 10,20 25,10", "stroke": "#040"}), path({"d": "M33,32 c-15,-10 -10,5 -25,-10 M67,32 c15,-10 10,5, 25,-10", "stroke": "#060"}), path({"d": "M38,25 c-5,-10 -10,5 -15,-20 M 62,25 c5,-10 10,5, 15,-20", "stroke": "#080"}), path({"d": "M50,22 v-18", "stroke": "#0a0"})])]));
addSymbol("5e-condition-POISONED", symbol({"viewBox": "0 0 6.2 9.3"}, path({"d": "M3.1,0.2 q-6,8 0,9 q6,-1 0,-9 Z", "stroke": "#000", "stroke-width": 0.2, "fill": "#0a0"})));
addSymbol("5e-condition-SANCTUARY", symbol({"viewBox": "0 0 44 70"}, [path({"d": "M22,20 l20,20 v30 h-40 v-30 z", "fill": "#efa"}), path({"d": "M22,0 v20 M12,6 h20", "stroke": "#fc4", "stroke-width": 1, "fill": "none"}), path({"d": "M2,40 l20,-20 l20,20", "stroke": "#e42", "stroke-width": 5, "fill": "none"}), path({"d": "M12,70 v-10 a10,10 0,0,1 20,0 v10 z", "fill": "#642"}), circle({"cx": 22, "cy": 40, "r": 8, "fill": "#88f", "stroke": "#000", "stroke-width": 0.5})]));
addSymbol("5e-condition-UNCONSCIOUS", symbol({"viewBox": "0 0 100 100"}, [defs(path({"id": "z-5e", "d": "M3,2 h20 v3 l-15,20 h15 l1,-3 h1 l-1,5 h-20 v-3 l15,-20 h-15 l-1,3 h-1 z", "stroke-width": 1, "stroke": "#000", "fill": "#fff"})), use({"href": "z-5e", "transform": "scale(1.2) translate(55, 0)"}), use({"href": "z-5e", "transform": "translate(45, 30)"}), use({"href": "z-5e", "transform": "scale(0.8) translate(35, 70)"}), use({"href": "z-5e", "transform": "scale(0.6) translate(25, 130)"})]));

let lastMapChange = 0,
    n = 0,
    lastInitiativeID = 0,
    lastSelectedToken: SVGToken5E | null = null;

const langs: Record<string, Record<string, string>> = {
	"en-GB": {
		"ARMOUR_CLASS": "Armour Class",
		"CONDITION_BANE": "Bane",
		"CONDITION_BLESSED": "Blessed",
		"CONDITION_BLINDED": "Blinded",
		"CONDITION_BLINK": "Blink",
		"CONDITION_BLUR": "Blur",
		"CONDITION_CHARMED": "Charmed",
		"CONDITION_CONCENTRATING": "Concentrating",
		"CONDITION_CONFUSED": "Confused",
		"CONDITION_DEAD": "Dead",
		"CONDITION_DEAFENED": "Deafened",
		"CONDITION_DYING": "Dying",
		"CONDITION_EXHAUSTED": "Exhausted",
		"CONDITION_FRIGHTENED": "Frightened",
		"CONDITION_FLYING": "Flying",
		"CONDITION_GRAPPLED": "Grappled",
		"CONDITION_GUIDANCE": "Guidance",
		"CONDITION_HASTE": "Haste",
		"CONDITION_HEXED": "Hex",
		"CONDITION_HIDEOUS_LAUGHTER": "Hideous Laughter",
		"CONDITION_HUNTERS_MARK": "Hunters' Mark",
		"CONDITION_INCAPACITATED": "Incapacitated",
		"CONDITION_INSPIRED": "Inspired",
		"CONDITION_INVISIBLE": "Invisible",
		"CONDITION_LEVITATE": "Levitating",
		"CONDITION_MIRROR_IMAGE": "Mirror Image",
		"CONDITION_PARALYZED": "Paralyzed",
		"CONDITION_PETRIFIED": "Petrified",
		"CONDITION_POISONED": "Poisoned",
		"CONDITION_PRONE": "Prone",
		"CONDITION_RAGE": "Rage",
		"CONDITION_RECKLESS": "Reckless",
		"CONDITION_RESTRAINED": "Restrained",
		"CONDITION_SANCTUARY": "Sanctuary",
		"CONDITION_SLOW": "Slow",
		"CONDITION_STUNNED": "Stunned",
		"CONDITION_UNCONSCIOUS": "Unconcious",
		"CONDITIONS": "Conditions",
		"DESATURATE_CONDITIONS": "Greyscale Conditions",
		"HIGHLIGHT_COLOUR": "Token Highlight Colour",
		"HP_CURRENT": "Current Hit Points",
		"HP_CURRENT_ENTER": "Please enter current Hit Points",
		"HP_MAX": "Maximum Hit Points",
		"INITIATIVE": "Initiative",
		"INITIATIVE_ADD": "Add Initiative",
		"INITIATIVE_ASC": "Sort Initiative Ascending",
		"INITIATIVE_CHANGE": "Change Initiative",
		"INITIATIVE_DESC": "Sort Initiative Descending",
		"INITIATIVE_ENTER": "Enter initiative",
		"INITIATIVE_ENTER_LONG": "Please enter the initiative value for this token",
		"INITIATIVE_MOD": "Initiative Mod",
		"INITIATIVE_NEXT": "Next",
		"INITIATIVE_REMOVE": "Remove Initiative",
		"NAME": "Character Name",
		"SHAPECHANGE_TITLE": "Shapechange Settings",
		"SHAPECHANGE_TOKEN_ADD": "Add Token",
		"SHAPECHANGE_TOKEN_CATEGORY": "Add Category",
		"SHAPECHANGE_TOKEN_CATEGORY_LONG": "Please enter a name for this cateogory of Shapechanges.",
		"SHAPECHANGE_TOKEN_CATEGORY_RENAME": "Rename Shapechange Category",
		"SHAPECHANGE_TOKEN_CATEGORY_RENAME_LONG": "Please enter a new name for this Shapechange category.",
		"SHAPECHANGE_TOKEN_CATEGORY_REMOVE": "Remove Shapechange Category",
		"SHAPECHANGE_TOKEN_CATEGORY_REMOVE_LONG": "Are you sure you wish to Remove this Shapechange Category?",
		"SHAPECHANGE_TOKEN_NAME": "Enter Name",
		"SHAPECHANGE_TOKEN_NAME_LONG": "Please enter a name for the selected token.",
		"SHAPECHANGE_TOKEN_REMOVE": "Remove Shapechange Token",
		"SHAPECHANGE_TOKEN_REMOVE_LONG": "Are you sure you wish to Remove this Shapechange Token?",
		"SHAPECHANGE_TOKEN_RENAME": "Rename Shapechange Token",
		"SHAPECHANGE_TOKEN_RENAME_LONG": "Please enter a new name for this token.",
		"SHOW_AC": "Show Token Armour Class",
		"SHOW_HP": "Show Token Hit Points",
		"SHOW_NAMES": "Show Token Names",
		"SHOW_CONDITIONS": "Show Token Conditions",
		"TOKEN_SELECTED": "Selected",
		"TOKENS_UNSELECTED": "Unselected",
	}
      },
      lang = langs[Object.keys(langs).includes(language.value) ? language.value : "en-GB"],
      importName = (import.meta as MetaURL).url.split("/").pop()!,
      checkSettings = (data: any) => {
	if (!data["shapechange-categories"] || !data["store-image-shapechanges"]) {
		return null;
	}
	if (!(data["shapechange-categories"] instanceof Array)) {
		console.log("shapechange-categories must be an Array");
		return null;
	}
	if (!(data["store-image-shapechanges"] instanceof Array)) {
		console.log("store-image-shapechanges must be an Array");
		return null;
	}
	const numTokens = data["store-image-shapechanges"].length;
	for (const c of data["shapechange-categories"]) {
		if (typeof c !== "object") {
			console.log("entry of shapechange-categories is not an object");
			return null;
		}
		if (typeof c["name"] !== "string") {
			console.log("shapechange-categories.name must be a string");
			return null;
		}
		if (!(c["images"] instanceof Array)) {
			console.log("shapechange-categories.images must be an array");
			return null;
		}
		if (c["images"].length > numTokens) {
			c["images"].splice(numTokens);
		}
		for (const b of c["images"]) {
			if (typeof b !== "boolean") {
				console.log("entry of shapechange-categories.images must be boolean");
				return null;
			}
		}
		while (c["images"].length < numTokens) {
			c["images"].push(false);
		}
	}
	for (const s of data["store-image-shapechanges"]) {
		if (typeof s !== "object") {
			console.log("entry of store-image-shapechanges must be an object");
			return null;
		}
		if (!isUint(s["id"])) {
			console.log("store-image-shapechanges.id must be a Uint");
			return null;
		}
		if (typeof s["name"] !== "string") {
			console.log("store-image-shapechanges.name must be a string");
			return null;
		}
	}
	return data;
      },
      settings = (checkSettings(getSettings(importName)) ?? {
	      "shapechange-categories": [],
	      "store-image-shapechanges": []
      }) as Settings5E,
      userVisibility = getSymbol("userVisibility")!,
      remove = getSymbol("remove")!,
      rename = getSymbol("rename")!,
      initAsc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "2,2 0,2 1,0", "style": "fill: currentColor"})),
      initDesc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,0 1,2", "style": "fill: currentColor"})),
      initNext = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,1 0,2", "style": "fill: currentColor"})),
      conditions: string[] = ["BANE", "BLESSED", "BLINDED", "BLINK", "BLUR", "CHARMED", "CONCENTRATING", "CONFUSED", "DEAD", "DEAFENED", "DYING", "EXHAUSTED", "FRIGHTENED", "FLYING", "GRAPPLED", "GUIDANCE", "HASTE", "HEXED", "HIDEOUS_LAUGHTER", "HUNTERS_MARK", "INCAPACITATED", "INSPIRED", "INVISIBLE", "LEVITATE", "MIRROR_IMAGE", "PARALYZED", "PETRIFIED", "POISONED", "PRONE", "RAGE", "RECKLESS", "RESTRAINED", "SANCTUARY", "SLOW", "STUNNED", "UNCONSCIOUS"],
      checkInt = (s: string, min: Int, max: Int, def: Int) => {
	const n = parseInt(s);
	return isNaN(n) ? def : n < min ? min : n > max ? max : n;
      },
      sortAsc = (a: Initiative, b: Initiative) => a.token.tokenData["5e-initiative"]!.data.initiative - b.token.tokenData["5e-initiative"]!.data.initiative,
      sortDesc = (a: Initiative, b: Initiative) => b.token.tokenData["5e-initiative"]!.data.initiative - a.token.tokenData["5e-initiative"]!.data.initiative,
      initiativeList = new SortNode<Initiative, HTMLUListElement>(ul({"id": "initiative-list-5e"})),
      saveInitiative = () => rpc.setMapKeyData("5e-initiative", (globals.mapData as MapData5E).data["5e-initiative"] = initiativeList.map(i => i.token.tokenData["5e-initiative"]!.data.id)),
      savedWindowSetting = new JSONSetting<WindowData>("5e-window-data", [0, 0, 200, 400], (v: any): v is WindowData => v instanceof Array && v.length === 4 && isInt(v[0]) && isInt(v[1]) && isUint(v[2]) && isUint(v[3])),
      initiativeWindow = windows({"window-title": lang["INITIATIVE"], "--window-left": savedWindowSetting.value[0] + "px", "--window-top": savedWindowSetting.value[1] + "px", "--window-width": savedWindowSetting.value[2] + "px", "--window-height": savedWindowSetting.value[3] + "px", "hide-close": true, "hide-maximise": true, "hide-minimise": userLevel === 0, "resizable": true, "onmouseover": () => initiativeWindow.toggleAttribute("hide-titlebar", false), "onmouseleave": () => initiativeWindow.toggleAttribute("hide-titlebar", true), }, div({"id": "initiative-window-5e"}, [
	userLevel === 1 ? div({"id": "initiative-ordering-5e"}, [
		button({"title": lang["INITIATIVE_ASC"], "onclick": () => {
			initiativeList.sort(sortAsc);
			initiativeList.sort(noSort);
			saveInitiative();
		}}, initAsc),
		button({"title": lang["INITIATIVE_DESC"], "onclick": () => {
			initiativeList.sort(sortDesc);
			initiativeList.sort(noSort);
			saveInitiative();
		}}, initDesc),
	]) : [],
	div(initiativeList.node),
	userLevel === 1 ? [
		div({"id": "initiative-next-5e"}, button({"title": lang["INITIATIVE_NEXT"], "onclick": () => {
			if (initiativeList.length > 1) {
				initiativeList.push(initiativeList.shift()!);
				saveInitiative();
			}
		}}, initNext))
	] : []
      ])),
      updateInitiative = () => {
	const {mapData: {data: {"5e-initiative": initiative}}} = globals,
	      tokens = new Map<Uint, [boolean, Token5E]>();
	walkLayers((e, isHidden) => {
		for (const t of e.tokens) {
			if (t instanceof SVGToken && t.tokenData["5e-initiative"]) {
				const {tokenData: {"5e-initiative": {data: idInitiative}}} = t;
				tokens.set(idInitiative.id, [isHidden, t]);
				if (idInitiative.id > lastInitiativeID) {
					lastInitiativeID = idInitiative.id;
				}
			}
		}
	});
	initiativeList.splice(0, initiativeList.length);
	for (const i of initiative) {
		if (tokens.has(i)) {
			const [hidden, token] = tokens.get(i)!;
			initiativeList.push({
				token,
				hidden,
				node: li({"style": hidden && userLevel === 0 ? "display: none" : undefined, "onmouseover": () => {
					if (token.node.parentNode) {
						createSVG(highlight, {"width": token.width, "height": token.height, "transform": token.transformString()});
						token.node.parentNode.insertBefore(highlight, token.node);
					}
				}, "onmouseleave": () => highlight.remove()}, [
					img({"src": `/images/${token.src}`}),
					span(token.getData("name") ?? ""),
					span(token.tokenData["5e-initiative"]!.data.initiative.toString())
				])
			});
		}
	}
	if (initiativeList.length && !initiativeWindow.parentNode) {
		requestShell().appendChild(initiativeWindow);
	}
      },
      displaySettings = {
	"SHOW_HP": [new BoolSetting5E("5e-show-token-hp", b => document.body.classList.toggle("hide-token-hp-5e", !b)), new BoolSetting5E("5e-show-selected-hp", b => document.body.classList.toggle("hide-selected-hp-5e", !b))],
	"SHOW_AC": [new BoolSetting5E("5e-show-token-ac", b => document.body.classList.toggle("hide-token-ac-5e", !b)), new BoolSetting5E("5e-show-selected-ac", b => document.body.classList.toggle("hide-selected-ac-5e", !b))],
	"SHOW_NAMES": [new BoolSetting5E("5e-show-token-names", b => document.body.classList.toggle("hide-token-names-5e", !b)), new BoolSetting5E("5e-show-selected-names", b => document.body.classList.toggle("hide-selected-names-5e", !b))],
	"SHOW_CONDITIONS": [new BoolSetting5E("5e-show-token-conditions", b => document.body.classList.toggle("hide-token-conditions-5e", !b)), new BoolSetting5E("5e-show-selected-conditions", b => document.body.classList.toggle("hide-selected-conditions-5e", !b))],
	"DESATURATE_CONDITIONS": [new BoolSetting5E("5e-desaturate-token-conditions", b => document.body.classList.toggle("desaturate-token-conditions-5e", b)), new BoolSetting5E("5e-desaturate-selected-conditions", b => document.body.classList.toggle("desaturate-selected-conditions-5e", b))]
      } as Record<string, [BoolSetting5E, BoolSetting5E]>,
      highlightColour = new JSONSetting<Colour>("5e-hightlight-colour", {"r": 255, "g": 255, "b": 0, "a": 127}, isColour),
      highlight = rect({"fill": colour2Hex(highlightColour.value), "stroke": colour2Hex(highlightColour.value), "opacity": highlightColour.value.a / 255, "stroke-width": 20}),
      mo = new MutationObserver(list => {
	for (const m of list) {
		if (m.target === initiativeWindow) {
			savedWindowSetting.set([parseInt(initiativeWindow.style.getPropertyValue("--window-left")), parseInt(initiativeWindow.style.getPropertyValue("--window-top")), parseInt(initiativeWindow.style.getPropertyValue("--window-width")), parseInt(initiativeWindow.style.getPropertyValue("--window-height"))]);
		}
	}
      }),
      plugin: PluginType = {
	"characterEdit": {
		"priority": 0,
		"fn": (w: WindowElement, id: Uint, data: Record<string, KeystoreData> & TokenFields, isCharacter: boolean, changes: Record<string, KeystoreData> & TokenFields, removes: Set<string>, save: () => Promise<void>) => {
			n++;
			const getData = !isCharacter && data["store-character-id"] && characterData.has(data["store-character-id"]["data"]) ? (() => {
				const cd = characterData.get(data["store-character-id"]["data"])!;
				return (key: string) => data[key] ?? cd[key] ?? {};
			})() : (key: string) => data[key] ?? {},
			      name = getData("name"),
			      nameUpdate = () => changes["name"] = {"user": nameVisibility.checked, "data": nameInput.value},
			      nameInput = input({"type": "text", "id": `edit_5e_name_${n}`, "value": name["data"], "onchange": nameUpdate}),
			      nameVisibility = input({"type": "checkbox", "class": "userVisibility", "id": `edit_5e_nameVisibility_${n}`, "value": name["user"] !== false, "onchange": nameUpdate});
			return [
				label({"for": `edit_5e_name_${n}`}, `${lang["NAME"]}: `),
				nameInput,
				nameVisibility,
				label({"for": `edit_5e_nameVisibility_${n}`}, userVisibility()),
				br(),
				isCharacter ? [
					label(`${mainLang["CHARACTER_IMAGE"]}$: `),
					iconSelector(data, changes),
					br(),
					label(`${mainLang["TOKEN"]}: `),
					tokenSelector(windows(), data, changes, removes)
				] : [
					label(`${mainLang["CHARACTER"]}: `),
					characterSelector(data, changes)
				],
				br(),
				label({"for": `edit_5e_initiative_${n}`}, `${lang["INITIATIVE_MOD"]}: `),
				input({"type": "number", "id": `edit_5e_initiative_${n}`, "min": -20, "max": 20, "step": 1, "value": getData("5e-initiative-mod")["data"] ?? "", "onchange": function(this: HTMLInputElement) {
					if (this.value === "") {
						removes.add("5e-initiative-mod");
					} else {
						removes.delete("5e-initiative-mod");
						changes["5e-initiative-mod"] = {"user": false, "data": checkInt(this.value, -20, 20, 0)};
					}
				}}),
				br(),
				label({"for": `edit_5e_ac_${n}`}, `${lang["ARMOUR_CLASS"]}: `),
				input({"type": "number", "id": `edit_5e_ac_${n}`, "min": 0, "max": 50, "step": 1, "value": getData("5e-ac")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-ac"] = {"user": false, "data": checkInt(this.value, 0, 50, 0)};
				}}),
				br(),
				label({"for": `edit_5e_current_${n}`}, `${lang["HP_CURRENT"]}: `),
				input({"type": "number", "id": `edit_5e_ac_${n}`, "min": 0, "step": 1, "value": getData("5e-hp-current")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-hp-current"] = {"user": false, "data": checkInt(this.value, 0, Infinity, 0)};
				}}),
				br(),
				label({"for": `edit_5e_hp_${n}`}, `${lang["HP_MAX"]}: `),
				input({"type": "number", "id": `edit_5e_ac_${n}`, "min": 0, "step": 1, "value": getData("5e-hp-max")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-hp-max"] = {"user": false, "data": checkInt(this.value, 0, Infinity, 0)};
				}}),
				br(),
				button({"onclick": function(this: HTMLButtonElement) {
					this.toggleAttribute("disabled", true);
					const updateName = changes["name"];
					save().finally(() => {
						this.removeAttribute("disabled");
						if (updateName && data["5e-initiative"] !== undefined) {
							updateInitiative();
						}
						(globals.tokens[id].token as SVGToken5E).updateData();
					});
				}}, mainLang["SAVE"])
			];
		}
	},
	"tokenContext": {
		"priority": 0,
		"fn": () => {
			const token = lastSelectedToken,
			      mapChange = lastMapChange;
			if (!token || !(token instanceof SVGToken5E)) {
				return [];
			}
			if (token.tokenData["5e-initiative"]) {
				const tokenConditions = token.getData("5e-conditions") ?? [];
				return [
					item(lang["INITIATIVE_CHANGE"], () => {
						if (token.tokenData["5e-initiative"]) {
							requestShell().prompt(lang["INITIATIVE_ENTER"], lang["INITIATIVE_ENTER_LONG"], token.tokenData["5e-initiative"].data.initiative.toString()).then(initiative => {
								if (token === lastSelectedToken && token.tokenData["5e-initiative"] && initiative !== null) {
									const init = parseInt(initiative);
									if (isInt(init, -20, 40)) {
										token.tokenData["5e-initiative"].data.initiative = init;
										rpc.tokenModify(token.id, {"5e-initiative": {"user": true, "data": token.tokenData["5e-initiative"].data}}, []);
										updateInitiative();
									}
								}
							});
						}
					}),
					item(lang["INITIATIVE_REMOVE"], () => {
						if (token !== lastSelectedToken) {
							return;
						}
						initiativeList.filterRemove(i => i.token === token);
						if (initiativeList.length === 0) {
							initiativeWindow.remove();
						}
						delete(token.tokenData["5e-initiative"]);
						rpc.tokenModify(token.id, {}, ["5e-initiative"]);
						saveInitiative();
					}),
					menu(lang["CONDITIONS"], conditions.map((c, n) => item(lang[`CONDITION_${c}`], () => {
						if (token !== lastSelectedToken) {
							return;
						}
						let data = token.getData("5e-conditions");
						if (!data) {
							data = token.tokenData["5e-conditions"] = {"user": true, "data": data = Array.from({"length": conditions.length}, _ => false)};
						}
						data[n] = !data[n];
						rpc.tokenModify(token.id, {"5e-conditions": {"user": true, data}}, []);
						token.updateData();
					}, {"classes": tokenConditions[n] ? "hasCondition" : undefined})), {"classes": "conditionList"})
				];
			}
			const initMod: number | null = token.getData("5e-initiative-mod");
			return [item(lang["INITIATIVE_ADD"], () => (initMod !== null ? Promise.resolve(Math.floor(Math.random() * 20) + 1 + initMod) : requestShell().prompt(lang["INITIATIVE_ENTER"], lang["INITIATIVE_ENTER_LONG"], "0").then(initiative => {
				if (!initiative) {
					throw new Error("invalid initiative");
				}
				return parseInt(initiative);
			})).then(initiative => {
				if (lastMapChange !== mapChange) {
					requestShell().alert(mainLang["MAP_CHANGED"], mainLang["MAP_CHANGED_LONG"]);
					throw new Error("map changed");
				}
				const id = ++lastInitiativeID,
				      change = {"5e-initiative": {"user": true, "data": {id, initiative}}};
				Object.assign(token.tokenData, change);
				rpc.tokenModify(token.id, change, []);
				const md = globals.mapData as MapData5E;
				if (md.data["5e-initiative"]) {
					md.data["5e-initiative"].push(id);
				} else {
					md.data["5e-initiative"] = [id];
				}
				updateInitiative();
				saveInitiative();
			}).catch(() => {}))];
		}
	},
	"settings": {
		"priority": 0,
		"fn": () => div([
			label(`${lang["HIGHLIGHT_COLOUR"]}: `),
			span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["HIGHLIGHT_COLOUR"], () => highlightColour.value, (c: Colour) => {
				highlightColour.set(c);
				const rgba = colour2RGBA(c);
				highlight.setAttribute("fill", rgba);
				highlight.setAttribute("stroke", rgba);
			}, "highlight-colour-5e")),
			table({"id": "display-settings-5e"}, [
				thead(tr([
					td(),
					th(lang["TOKENS_UNSELECTED"]),
					th(lang["TOKEN_SELECTED"])
				])),
				tbody(Object.entries(displaySettings).map(([name, settings]) => tr([
					td(`${lang[name]}: `),
					settings.map((setting, n) => td([
						input({"type": "checkbox", "id": `5e-${name}-${n}`, "class": "settings_ticker", "checked": setting.value, "onchange": function(this: HTMLInputElement) {
							setting.set(this.checked);
						}}),
						label({"for": `5e-${name}-${n}`})
					])),
				])))
			]),
		])
	},
	"tokenClass": {
		"priority": 0,
		"fn": SVGToken5E
	},
	"tokenDataFilter": {
		"priority": 0,
		"fn": ["5e-initiative"]
	}
      };

if (userLevel === 1) {
	const shapechangeCats = settings["shapechange-categories"].map(c => ({"name": c["name"], "images": c["images"].slice()})),
	      shapechangeTokens = settings["store-image-shapechanges"].map(s => JSON.parse(JSON.stringify(s))),
	      addCat = (c: ShapechangeCat, pos = shapechangeCats.length - 1) => {
		const name = span(c.name),
		      t = th([
			name,
			rename({"class": "itemRename", "onclick": () => requestShell().prompt(lang["SHAPECHANGE_TOKEN_CATEGORY_RENAME"], lang["SHAPECHANGE_TOKEN_CATEGORY_RENAME_LONG"], c.name).then(newName => {
				if (!newName || c.name === newName) {
					return;
				}
				name.innerText = c.name = newName;
			})}),
			remove({"class": "itemRemove", "onclick": () => requestShell().confirm(lang["SHAPECHANGE_TOKEN_CATEGORY_REMOVE"], lang["SHAPECHANGE_TOKEN_CATEGORY_REMOVE_LONG"], "").then(rm => {
				if (!rm) {
					return;
				}
				shapechangeCats[pos].name = "";
				for (const row of tickers) {
					row[pos].style.setProperty("display", "none");
				}
				t.style.setProperty("display", "none");
			})})
		      ]);
		return t;
	      },
	      addTicker = (row: Uint, col: Uint, state = false) => {
		const t = td([
			input({"id": `5e-shapechange_${row}_${col}`, "class": "settings_ticker", "type": "checkbox", "checked": state, "onchange": function(this: HTMLInputElement) {
				shapechangeCats[col]["images"][row] = this.checked;
			}}),
			label({"for": `5e-shapechange_${row}_${col}`})
		      ]);
		tickers[row].push(t);
		return t;
	      },
	      addToken = (t: ShapechangeToken, row: Uint) => {
		tickers.push([]);
		const name = span(t.name),
		      i = img({"src": `/images/${t.src}`}),
		      r = tr([
			th([
				div({"class": "tokenSelector"}, [
					button({"onclick": () => {}}),
					i
				]),
				name,
				rename({"class": "itemRename", "onclick": () => requestShell().prompt(lang["SHAPECHANGE_TOKEN_RENAME"], lang["SHAPECHANGE_TOKEN_RENAME_LONG"], t.name).then(newName => {
					if (!newName || t.name === newName) {
						return;
					}
					name.innerText = t.name = newName;
				})}),
				remove({"class": "itemRemove", "onclick": () => requestShell().confirm(lang["SHAPECHANGE_TOKEN_REMOVE"], lang["SHAPECHANGE_TOKEN_REMOVE_LONG"]).then(rm => {
					if (!rm) {
						return;
					}
					rows[row].style.setProperty("display", "none");
					shapechangeTokens[row]["name"] = "";
				})})
			]),
			shapechangeCats.map((c, col) => addTicker(row, col, c["images"][row]))
		      ]);
		rows.push(r);
		return r;
	      },
	      cats = tr([
		td(),
		shapechangeCats.map(addCat),
	      ]),
	      rows: HTMLTableRowElement[] = [],
	      tickers: HTMLTableCellElement[][] = [],
	      ticks = tbody(shapechangeTokens.map(addToken));
	plugin["menuItem"] = {
		"priority": 0,
		"fn": ["5e", div([
			h1(lang["SHAPECHANGE_TITLE"]),
			button({"onclick": () => requestShell().prompt(lang["SHAPECHANGE_TOKEN_CATEGORY"], lang["SHAPECHANGE_TOKEN_CATEGORY_LONG"]).then(cat => {
				if (!cat) {
					return;
				}
				const c = {
					"name": cat,
					"images": Array.from({"length": shapechangeTokens.length}, _ => false),
				      },
				      p = shapechangeCats.push(c);
				cats.appendChild(addCat(c))
				for (let i = 0; i < rows.length; i++) {
					rows[i].appendChild(addTicker(i, p));
				}
			})}, lang["SHAPECHANGE_TOKEN_CATEGORY"]),
			button({"onclick": () => {
				const token = getToken();
				if (!token) {
					requestShell().alert(mainLang["TOKEN_SELECT"], mainLang["TOKEN_NONE_SELECTED"]);
				}
				requestShell().prompt(lang["SHAPECHANGE_TOKEN_NAME"], lang["SHAPECHANGE_TOKEN_NAME_LONG"]).then(name => {
					if (!name) { 
						return;
					}
					const t = Object.assign(token, {name}) as ShapechangeToken;
					ticks.appendChild(addToken(t, shapechangeTokens.length));
					shapechangeTokens.push(t);
					for (const cat of shapechangeCats) {
						cat["images"].push(false);
					}
				});
			}}, lang["SHAPECHANGE_TOKEN_ADD"]),
			table([
				thead(cats),
				ticks
			]),
			button({"onclick": () => {
				const cats: ShapechangeCat[] = [],
				      tokens: ShapechangeToken[] = [],
				      valid: boolean[] = [];
				for (const t of shapechangeTokens) {
					if (t["name"]) {
						valid.push(true);
						tokens.push(JSON.parse(JSON.stringify(t)));
					} else {
						valid.push(false);
					}
				}
				for (const cat of shapechangeCats) {
					if (cat["name"]) {
						const t: boolean[] = [];
						for (let i = 0; i < valid.length; i++) {
							if (valid[i]) {
								t.push(cat["images"][i]);
							}
						}
						cats.push({"name": cat["name"], "images": t});
					}
				}
				settings["shapechange-categories"] = cats;
				settings["store-image-shapechanges"] = tokens;
				rpc.pluginSetting(importName, settings);
			}}, mainLang["SAVE"])
		])]
	};
}

addPlugin("5e", plugin);

mo.observe(initiativeWindow, {"attributeFilter": ["style"], "attributes": true});

mapLoadedReceive(() => {
	lastMapChange = Date.now();
	initiativeWindow.remove();
	lastInitiativeID = 0;
	updateInitiative();
	lastSelectedToken = null;
	if (userLevel === 1) {
		globals.outline.addEventListener("keydown", (e: KeyboardEvent) => {
			e.preventDefault();
			if (lastSelectedToken !== null && e.key === 'h') {
				const token = lastSelectedToken,
				      hp = token.getData("5e-hp-current");
				if (hp !== null) {
					requestShell().prompt(lang["HP_CURRENT"], lang["HP_CURRENT_ENTER"], hp).then(hp => {
						if (hp === null || token !== lastSelectedToken) {
							return;
						}
						const data = parseInt(hp);
						if (data >= 0) {
							rpc.tokenModify(token.id, {"5e-hp-current": {"user": false, data}}, []);
							token.tokenData["5e-hp-current"] = {"user": false, data};
							token.updateData();
						}
						globals.outline.focus();
					});
				}
			}
		});
	}
});

rpc.waitTokenDataChange().then(changed => {
	if (changed["setting"]["5e-initiative"] || changed["setting"]["name"] !== undefined || changed["removing"].includes("5e-initiative") || changed["removing"].includes("name")) {
		setTimeout(() => {
			updateInitiative();
			(globals.tokens[changed.id].token as SVGToken5E).updateData();
		}, 0);
		return;
	}
	for (const key in changed["setting"]) {
		switch (key) {
		case "5e-ac":
		case "5e-hp-max":
		case "5e-hp-current":
		case "5e-conditions":
			setTimeout(() => (globals.tokens[changed.id].token as SVGToken5E).updateData(), 0);
			return;
		}
	}
});

rpc.waitMapDataSet().then(changed => {
	if (changed.key === "5e-initiative") {
		setTimeout(updateInitiative, 0);
	}
});

rpc.waitMapDataRemove().then(removed => {
	if (removed === "5e-initiative") {
		initiativeWindow.remove();
	}
});

rpc.waitPluginSetting().then(setting => {
	if (setting["file"] === importName && checkSettings(setting["data"])) {
		settings["shapechange-categories"] = setting["data"]["shapechange-categories"];
		settings["store-image-shapechanges"] = setting["data"]["store-image-shapechanges"];
	}
})

combinedRPC.waitTokenRemove().then(id => {
	setTimeout(updateInitiative, 0);
});

tokenSelectedReceive(() => {
	if (lastSelectedToken) {
		lastSelectedToken.unselect();
		lastSelectedToken = null;
	}
	if (globals.selected.token instanceof SVGToken5E && !globals.selected.token.isPattern) {
		lastSelectedToken = globals.selected.token;
		globals.outline.insertAdjacentElement("beforebegin", lastSelectedToken.extra);
	}
});

addMapDataChecker((data: Record<string, any>) => {
	for (const key in data) {
		let err = "";
		if (key === "5e-initiative") {
			const val = data[key];
			if (!(val instanceof Array)) {
				err = "Map Data value of 5e-initiative needs to be an array";
			} else {
				for (const i of val) {
					if (!isUint(i)) {
						err = "Map Data value of 5e-initiative needs to be an array of Uints";
						break;
					}
				}
			}
		}
		if (err) {
			delete data[key];
			console.log(new TypeError(err));
		}
	}
});

addCharacterDataChecker((data: Record<string, KeystoreData>) => {
	for (const key in data) {
		const val = data[key].data;
		let err = "";
		switch (key) {
		case "name":
			if (typeof val !== "string") {
				err = "Character Data 'name' must be a string";
			}
			break;
		case "5e-ac":
			if (!isUint(val, 50)) {
				err = "Character Data '5e-ac' must be a Uint <= 50";
			}
			break;
		case "5e-hp-max":
			if (!isUint(val)) {
				err = "Character Data '5e-hp-max' must be a Uint";
			}
			break;
		case "5e-hp-current":
			if (!isUint(val)) {
				err = "Character Data '5e-hp-current' must be a Uint";
			}
			break;
		case "5e-initiative-mod":
			if (!isInt(val, -20, 20)) {
				err = "Character Data '5e-initiative-mod' must be an Int between -20 and 20";
			}
			break;
		}
		if (err) {
			delete data[key];
			console.log(new TypeError(err));
		}
	}
});

addTokenDataChecker((data: Record<string, KeystoreData>) => {
	for (const key in data) {
		const val = data[key].data;
		let err = "";
		switch (key) {
		case "name":
			if (typeof val !== "string") {
				err = "Token Data 'name' must be a string";
			}
			break;
		case "5e-ac":
			if (!isUint(val, 50)) {
				err = "Token Data '5e-ac' must be a Uint <= 50";
			}
			break;
		case "5e-hp-max":
			if (!isUint(val)) {
				err = "Token Data '5e-hp-max' must be a Uint";
			}
			break;
		case "5e-hp-current":
			if (!isUint(val)) {
				err = "Token Data '5e-hp-current' must be a Uint";
			}
			break;
		case "5e-initiative-mod":
			if (!isInt(val, -20, 20)) {
				err = "Token Data '5e-initiative-mod' must be an Int between -20 and 20";
			}
			break;
		case "5e-initiative":
			if (!(val instanceof Object) || !isUint(val.id) || !isInt(val.initiative, -20, 40)) {
				err = "Token Data '5e-initiative' must be an IDInitiative object";
			}
			break;
		case "5e-conditions":
			if (!(val instanceof Array) || val.length !== conditions.length || !val.every(b => typeof b === "boolean")) {
				err = "Token Data '5e-conditions' must be a boolean array of correct length";
			}
			break;
		}
		if (err) {
			delete data[key];
			console.log(new TypeError(err));
		}
	}
});
