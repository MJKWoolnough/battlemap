import {KeystoreData, Uint, Int, MapData, Colour, TokenImage} from '../types.js';
import {clearElement} from '../lib/dom.js';
import {br, button, div, img, input, label, li, span, style, ul} from '../lib/html.js';
import {createSVG, circle, defs, ellipse, g, line, mask, path, polygon, rect, symbol, svg, text, use} from '../lib/svg.js';
import {SortNode, noSort} from '../lib/ordered.js';
import {addPlugin, userLevel} from '../plugins.js';
import {item, menu} from '../lib/context.js';
import {globals, SVGToken, walkLayers, isSVGLayer, SVGLayer, SVGFolder} from '../map.js';
import {mapLoadedReceive, requestShell, handleError, makeColourPicker, colour2RGBA, rgba2Colour, tokenSelectedReceive, isInt, isUint, isColour} from '../misc.js';
import mainLang, {language} from '../language.js';
import {windows, WindowElement} from '../lib/windows.js';
import {rpc, addMapDataChecker, addCharacterDataChecker, addTokenDataChecker} from '../rpc.js';
import {characterData, iconSelector, tokenSelector, characterSelector} from '../characters.js';
import {addSymbol, getSymbol} from '../symbols.js';
import {JSONSetting} from '../settings_types.js';

document.head.appendChild(style({"type": "text/css"}, ".isAdmin #initiative-window-5e{display:grid;grid-template-rows:2em auto 2em}#initiative-window-5e svg{width:1.5em}#initiative-ordering-5e button,#initiative-next-5e button{height:2em}#initiative-list-5e{list-style:none;padding:0;user-select:none;}#initiative-list-5e li{display:grid;grid-template-columns:4.5em auto 3em;align-items:center}#initiative-list-5e li span{text-align:center}#initiative-list-5e img{height:4em;width:4em}text {filter:drop-shadow(0 0 0.05em #fff);user-select:none}.contextMenu.conditionList{padding-left:1em;box-styling:padding-box}.hasCondition{list-style:square}"));

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
		      ac: Uint | null = this.getData("5e-ac");
		this.node = g([
			this.tokenNode = this.node,
			this.extra = g({"transform": `translate(${this.x}, ${this.y})`, "style": "color: #000"}, [
				this.hp = g({"style": currentHP === null || maxHP === null ? "display: none" : undefined}, [
					this.hpBack = use({"href": "#5e-hp-back", "width": this.width / 4, "height": this.width / 4}),
					this.hpBar = use({"href": "#5e-hp", "width": this.width / 4, "height": this.width / 4, "stroke-dasharray": `${Math.PI * 19 * 0.75 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1)} 60`, "style": `color: rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`}),
					this.hpValue = text({"x": this.width / 8, "y": "1.2em", "text-anchor": "middle", "fill": `rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`}, currentHP?.toString() ?? "")
				]),
				this.name = text({"x": this.width / 2, "y": this.height / 16, "text-anchor": "middle"}, this.getData("name") ?? ""),
				this.ac = g({"style": ac === null ? "display: none" : undefined}, [
					this.shield = use({"href": "#5e-shield", "width": this.width / 4, "height": this.width / 4, "x": 3 * this.width / 4}),
					this.acValue = text({"x": 7 * this.width / 8, "y": "1.2em", "text-anchor": "middle"}, ac?.toString() ?? "")
				]),
				this.conditions = g({"style": "clip-path: none"})
			])
		]);
		window.setTimeout(this.setTextWidth.bind(this), 0);
		this.updateConditions();
	}
	setTextWidth() {
		const maxNameLength = this.width / 2,
		      nameLength = this.name.getComputedTextLength();
		if (nameLength > maxNameLength) {
			this.name.style.setProperty("font-size", (maxNameLength / nameLength) + "em");
		}
		this.acValue.style.setProperty("font-size", `${this.width / 8}px`);
		this.hpValue.style.setProperty("font-size", `${this.width / 8}px`);
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
		createSVG(this.shield, {"x": 3 * this.width / 4, "width": this.width / 4, "height": this.height / 4});
		createSVG(this.hpBack, {"width": this.width / 4, "height": this.height / 4});
		createSVG(this.hpBar, {"width": this.width / 4, "height": this.height / 4});
		createSVG(this.name, {"x": this.width / 2, "style": {"font-size": undefined}});
		createSVG(this.hpValue, {"x": this.width / 8});
		createSVG(this.acValue, {"x": 7 * this.width / 8});
		this.setTextWidth();
		this.updateConditions();
	}
	updateData() {
		const maxHP: Uint | null = this.getData("5e-hp-max"),
		      currentHP: Uint | null = this.getData("5e-hp-current"),
		      ac: Uint | null = this.getData("5e-ac");
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
		this.name.innerHTML = this.getData("name") || "";
		this.updateConditions();
	}
	updateConditions() {
		clearElement(this.conditions);
		const myConditions: boolean[] = this.getData("5e-conditions") ?? [],
		      w = this.width / 8,
		      h = this.height / 8;
		let row = -1, col = 0;
		for (let i = 0; i < myConditions.length; i++) {
			if (myConditions[i]) {
				this.conditions.appendChild(use({"href": `#5e-condition-${conditions[i]}`, "x": col * w, "y": row * h, "width": w, "height": h}));
				col++;
				if (col === 8) {
					col = 0;
					row--;
				}
			}
		}
		this.conditions.setAttribute("transform", `translate(0, ${this.height})`);
	}

}

addSymbol("5e-shield", symbol({"viewBox": "0 0 8 9"}, path({"d": "M0,1 q2,0 4,-1 q2,1 4,1 q0,5 -4,8 q-4,-3 -4,-8 z", "fill": "#aaa"})));
addSymbol("5e-hp-back", symbol({"viewBox": "0 0 20 20"}, circle({"r": 9.5, "fill": "#eee", "stroke": "#888", "stroke-width": 1, "stroke-linecap": "round", "stroke-dasharray": `${Math.PI * 19 * 0.75} ${Math.PI * 19 * 0.25}`, "transform": "translate(10, 10) rotate(135)"})));
addSymbol("5e-hp", symbol({"viewBox": "0 0 20 20"}, circle({"r": 9.5, "fill": "transparent", "stroke": "#f00", "stroke-width": 1, "stroke-linecap": "round", "transform": "translate(10, 10) rotate(135)"})));

addSymbol("5e-condition-BLESSED", symbol({"viewBox": "0 0 10 11"}, [circle({"cx": 5, "cy": 6, "r": 5, "fill": "#fc8"}), ellipse({"cx": 5, "cy": 2.5, "rx": 5, "ry": 2, "fill": "transparent", "stroke": "#ff0", "stroke-width": 1}), path({"d": "M1.5,6 q1,-1 2,0 m2.5,0 q1,-1 2,0 M3,9 q2,1 4,0", "fill": "transparent", "stroke": "#000", "stroke-width": 0.1, "stroke-linecap": "round"})]));
addSymbol("5e-condition-BLINDED", symbol({"viewBox": "0 0 100 70"}, [defs(mask({"id": "5e-blind-mask"}, [rect({"width": 100, "height": 70, "fill": "#fff"}), line({"x1": 10, "y1": 67, "x2": 90, "y2": 3, "stroke": "#000", "stroke-width": 9}),])), g({"mask": "url(#5e-blind-mask)"}, use({"href": "#visibility"})), line({"x1": 10, "y1": 67, "x2": 90, "y2": 3, "stroke": "#000", "stroke-width": 5})]));
addSymbol("5e-condition-BLINK", symbol({"viewBow": "0 0 100 80"}, g({"stroke": "#000", "stroke-width": 2}, [ellipse({"cx": 50, "cy": 35, "rx": 49, "ry": 34, "fill": "#fff"}), path({"d": "M10,55 l-8,9 M20,62 l-5,9 M30,66 l-3,10 M40,69 l-1,10 M50,70 v10 M60,69 l1,10 M70,66 l3,10 M80,62 l5,9 M90,55 l8,9", "stroke-linecap": "round"})])));
addSymbol("5e-condition-CHARMED", symbol({"viewBox": "0 0 8.2 8.23"}, path({"d": "M0.1,2.1 a2,2 0,0,1 4,0 a2,2 0,0,1 4,0 q0,3 -4,6 q-4,-3 -4,-6 Z", "fill": "#f00", "stroke": "#000", "stroke-width": 0.2})));
addSymbol("5e-condition-DEAD", symbol({"viewBox": "0 0 10 10"}, [circle({"cx": 5, "cy": 5, "r": 4.9, "fill": "#aea", "stroke": "#000", "stroke-width": 0.2}), path({"d": "M2,2 l2,2 M2,4 l2,-2 m2,0 l2,2 M6,4 l2,-2 M2,6 l1,1 l1,-1 l1,1 l1,-1 l1,1 l1,-1", "stroke": "#000", "stroke-width": "0.1", "fill": "transparent"})]));
addSymbol("5e-condition-DEAFENED", symbol({"viewBox": "0 0 10 10"}, path({"d": "M0.1,3 h2 l2,-2 v8 l-2,-2 h-2 z M5,3 l4,4 M5,7 l4,-4", "stroke": "#000", "stroke-width": 0.1, "fill": "#fff"})));
addSymbol("5e-condition-GUIDANCE", symbol({"viewBox": "0 0 100 100"}, [defs(polygon({"id": "5e-guidance-points", "points": "16,16 50,30 84,16 70,50 84,84 50,70 16,84 30,50"})), g({"stroke": "#000", "stroke-width": 1}, [use({"href": "#5e-guidance-points", "fill": "#888"}), use({"href": "#5e-guidance-points", "fill": "#ccc", "transform": "rotate(45, 50, 50)"}), circle({"cx": 50, "cy": 50, "r": 20, "fill": "#fff"})])]));
addSymbol("5e-condition-HEXED", symbol({"viewBox": "0 0 100 100"}, [circle({"cx": 50, "cy": 50, "r": 49.5, "fill": "#808", "stroke": "#000", "stroke-width": 1}), path({"d": "M3,35 L79,90 L50,1 L21,90 L97,35 Z", "stroke": "#000", "fill": "#fff", "stroke-linejoin": "bevel", "fill-rule": "evenodd"})]));
addSymbol("5e-condition-HIDEOUS_LAUGHTER", symbol({"viewBox": "0 0 10 10"}, [circle({"cx": 5, "cy": 5, "r": 5, "fill": "#dd0"}), path({"d": "M2.5,2.5 l1,1 l-1,1 M7.5,2.5 l-1,1 l1,1", "stroke": "#000", "stroke-width": 0.2, "fill": "transparent"}), path({"d": "M2,6 h6 a3,3 0,0,1 -6,0 z", "fill": "#000"}), path({"d": "M2.5,7.66 a3,3 0,0,1 5,0 a3,3 0,0,1 -5,0 z", "fill": "#f00"})]));
addSymbol("5e-condition-HUNTERS_MARK", symbol({"viewBox": "0 0 20 20"}, g({"stroke": "#000", "stroke-width": "0.2", "transform": "translate(10, 10)"}, [circle({"r": 9.9, "fill": "#00f"}), circle({"r": 7, "fill": "#f00"}), circle({"r": 4, "fill": "#ff0"}), path({"d": "M0,0 l8,-8 l1,0 l-3,2 l2,-3 l0,1", "stroke-width": 0.4, "fill": "#000"})])));
addSymbol("5e-condition-INVISIBLE", symbol({"viewBox": "0 0 82 92"}, g({"stroke": "#000", "stroke-width": 1, "fill": "rgba(255, 255, 255, 0.75)"}, [path({"d": "M81,91 v-50 a30,30 0,0,0 -80,0 v50 l10,-10 l10,10 l10,-10 l10,10 l10,-10 l10,10 l10,-10 z"}), circle({"cx": 20, "cy": 30, "r": 10}), circle({"cx": 60, "cy": 30, "r": 10})])));
addSymbol("5e-condition-POISONED", symbol({"viewBox": "0 0 6.2 9.3"}, path({"d": "M3.1,0.2 q-6,8 0,9 q6,-1 0,-9 Z", "stroke": "#000", "stroke-width": 0.2, "fill": "#0a0"})));

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
	}
      },
      lang = langs[Object.keys(langs).includes(language.value) ? language.value : "en-GB"],
      userVisibility = getSymbol("userVisibility")!,
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
      highlightColour = new JSONSetting<Colour>("5e-hightlight-colour", {"r": 255, "g": 255, "b": 0, "a": 127}, isColour),
      highlight = rect({"fill": colour2RGBA(highlightColour.value), "stroke": colour2RGBA(highlightColour.value), "stroke-width": 20}),
      mo = new MutationObserver(list => {
	for (const m of list) {
		if (m.target === initiativeWindow) {
			savedWindowSetting.set([parseInt(initiativeWindow.style.getPropertyValue("--window-left")), parseInt(initiativeWindow.style.getPropertyValue("--window-top")), parseInt(initiativeWindow.style.getPropertyValue("--window-width")), parseInt(initiativeWindow.style.getPropertyValue("--window-height"))]);
		}
	}
      });

mo.observe(initiativeWindow, {"attributeFilter": ["style"], "attributes": true});

addPlugin("5e", {
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
		])
	},
	"tokenClass": {
		"priority": 0,
		"fn": SVGToken5E
	}
});

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
