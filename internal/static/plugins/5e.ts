import type {Children} from '../lib/dom.js';
import type {WaitGroup} from '../lib/inter.js';
import type {MenuItems} from '../lib/menu.js';
import type {SVGLayer} from '../map.js';
import type {LightWall} from '../map_lighting.js';
import type {SVGDrawing, SVGShape, SVGToken} from '../map_tokens.js';
import type {PluginType, SVGTokenConstructor} from '../plugins.js';
import type {RPCWaits} from '../rpc.js';
import type {Int, KeystoreData, MapData, TokenImage, TokenSet, Uint} from '../types.js';
import bind from '../lib/bind.js';
import {add, ids} from '../lib/css.js';
import {amendNode, clearNode} from '../lib/dom.js';
import {br, button, div, h1, img, input, li, span, table, tbody, td, textarea, th, thead, tr, ul} from '../lib/html.js';
import {item, menu, submenu} from '../lib/menu.js';
import {checkInt, isInt, queue} from '../lib/misc.js';
import {NodeArray, node, noSort, stringSort} from '../lib/nodes.js';
import {BoolSetting} from '../lib/settings.js';
import {animate, animateMotion, circle, clipPath, defs, ellipse, feColorMatrix, filter, g, line, linearGradient, mask, mpath, ns as svgNS, path, pattern, polygon, radialGradient, rect, stop, svg, symbol, text, use} from '../lib/svg.js';
import {And, Arr, Null, Obj, Or, Take} from '../lib/typeguard.js';
import {selectToken} from '../adminMap.js';
import {imageIDtoURL} from '../asset_urls.js';
import {Colour, ColourSetting, makeColourPicker} from '../colours.js';
import {adminHideLight, itemControl, lighting, settingsTicker, tokenSelector} from '../ids.js';
import {registerKeyEvent} from '../keys.js';
import mainLang, {makeLangPack} from '../language.js';
import {centreOnGrid, getLayer, mapData, walkLayers, wallList} from '../map.js';
import {doMapDataRemove, doMapDataSet, doTokenSet, getToken} from '../map_fns.js';
import {makeLight} from '../map_lighting.js';
import {Lighting, definitions, masks, outline, selected, tokens, tokenSelectedReceive} from '../map_tokens.js';
import {addPlugin, getSettings, pluginName} from '../plugins.js';
import {combined as combinedRPC, isAdmin, rpc} from '../rpc.js';
import {enableAnimation} from '../settings.js';
import {characterData, cloneObject, labels, mapLoadedReceive} from '../shared.js';
import {remove, rename, symbols, visibility} from '../symbols.js';
import {addCharacterDataChecker, addMapDataChecker, addTokenDataChecker, isBool, isStr, isTokenImage, isUint} from '../types.js';
import {shell, windows} from '../windows.js';

type IDInitiative = {
	id: Uint;
	initiative: Int;
}

type InitialTokenData = {
	"name": KeystoreData<string> | null;
	"5e-ac": KeystoreData<Uint> | null;
	"5e-hp-max": KeystoreData<Uint> | null;
	"5e-hp-current": KeystoreData<Uint> | null;
}

type InitialToken = Pick<TokenImage, "src" | "width" | "height" | "flip" | "flop"> & {
	tokenData: InitialTokenData;
}

type TokenFields = {
	"name"?: KeystoreData<string>;
	"5e-ac"?: KeystoreData<Uint>;
	"5e-hp-max"?: KeystoreData<Uint>;
	"5e-hp-current"?: KeystoreData<Uint>;
	"5e-initiative-mod"?: KeystoreData<Int>;
	"5e-conditions"?: KeystoreData<boolean[]>;
	"5e-player"?: KeystoreData<boolean>;
	"5e-darkvision"?: KeystoreData<Uint>;
	"store-image-5e-initial-token"?: KeystoreData<InitialToken>;
	"5e-notes"?: KeystoreData<string> | null;
}

type Token5E = SVGToken & {
	tokenData: TokenFields;
}

type Initiative = {
	token: Token5E;
	initiative: Uint;
	hidden: boolean;
	[node]: HTMLLIElement;
}

type MapData5E = MapData & {
	data: {
		"5e-initiative"?: IDInitiative[];
	}
}

type ShapechangeCat = {
	"name": string;
	"images": boolean[];
}

type ShapechangeToken = InitialToken & {
	["5e-shapechange-name"]: string;
}

type Settings5E = {
	"shapechange-categories": KeystoreData<ShapechangeCat[]>;
	"store-image-shapechanges": KeystoreData<ShapechangeToken[]>;
}

type SVGToken5EType = SVGToken & {
	[select](): void;
	[unselect](): void;
	[updateData](): void;
	tokenData: Record<string, KeystoreData> & TokenFields;
}

interface SVGToken5EConstructor {
	new (token: TokenImage, wg?: WaitGroup): SVGToken5EType;
}

class PerspectiveLighting extends Lighting {
	wallInteraction(x: Int, y: Int, lightX: Int, lightY: Int, wallColour: Colour, cp: number, refraction = false): Lighting | null {
		if (refraction && cp <= this.lightStages[0]) {
			const {r, g, b, a} = wallColour,
			      l = ((255 - a) / 255) * (r + g + b) / (3 * 255),
			      c = 255 - Math.round((255 - this.lightColours[0][0].r) * l),
			      colour = new Colour(c, c, c);
			return new PerspectiveLighting(x, y, lightX, lightY, [[colour], [colour]], this.lightStages, this.lightTimings);
		}
		return null;
	}
	createLightPolygon(points: string) {
		return polygon({points, "fill": this.lightColours[0][0].toHexString()});
	}
}

let SVGToken5E: SVGToken5EConstructor;

const select = Symbol("select"),
      unselect = Symbol("unselect"),
      updateData = Symbol("updateData"),
      lang = makeLangPack({
	"ARMOUR_CLASS": "Armour Class",
	"CONDITION_BANE": "Bane",
	"CONDITION_BLESSED": "Blessed",
	"CONDITION_BLINDED": "Blinded",
	"CONDITION_BLINK": "Blink",
	"CONDITION_BLUR": "Blur",
	"CONDITION_BURNING": "Burning",
	"CONDITION_CHARMED": "Charmed",
	"CONDITION_CONCENTRATING": "Concentrating",
	"CONDITION_CONFUSED": "Confused",
	"CONDITION_DEAD": "Dead",
	"CONDITION_DEAFENED": "Deafened",
	"CONDITION_DYING": "Dying",
	"CONDITION_EXHAUSTED": "Exhausted",
	"CONDITION_FLYING": "Flying",
	"CONDITION_FRIGHTENED": "Frightened",
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
	"CONDITION_UNCONSCIOUS": "Unconscious",
	"CONDITIONS": "Conditions",
	"DARKVISION": "Darkvision",
	"DESATURATE_CONDITIONS": "Greyscale Conditions",
	"HIDE_CONDITIONS": "Hide Token Conditions",
	"HIGHLIGHT_COLOUR": "Token Highlight Colour",
	"HP_CURRENT": "Current Hit Points",
	"HP_CURRENT_ENTER": "Please enter current Hit Points",
	"HP_MAX": "Maximum Hit Points",
	"INITIATIVE": "Initiative",
	"INITIATIVE_ADD": "Add Initiative",
	"INITIATIVE_ADV": "Advantage",
	"INITIATIVE_ASC": "Sort Initiative Ascending",
	"INITIATIVE_CHANGE": "Change Initiative",
	"INITIATIVE_DESC": "Sort Initiative Descending",
	"INITIATIVE_ENTER": "Enter initiative",
	"INITIATIVE_ENTER_LONG": "Please enter the initiative value for this token",
	"INITIATIVE_MOD": "Initiative Mod",
	"INITIATIVE_NEXT": "Next",
	"INITIATIVE_PREV": "Previous",
	"INITIATIVE_REMOVE": "Remove Initiative",
	"IS_PLAYER": "Is Player",
	"KEY_HEALTH": "Health Modification Key (5E)",
	"KEY_INITIATIVE": "Initiative Key (5E)",
	"NOTES": "Notes",
	"SHAPECHANGE": "Shapechange",
	"SHAPECHANGE_5E": "Shapechange (5E)",
	"SHAPECHANGE_CHANGE": "Change to Selected Token",
	"SHAPECHANGE_INITIAL_RESTORE": "Restore Initial Token",
	"SHAPECHANGE_TITLE": "Shapechange Settings",
	"SHAPECHANGE_TOKEN_ADD": "Add Token",
	"SHAPECHANGE_TOKEN_CATEGORY": "Add Category",
	"SHAPECHANGE_TOKEN_CATEGORY_LONG": "Please enter a name for this category of Shapechanges.",
	"SHAPECHANGE_TOKEN_CATEGORY_REMOVE": "Remove Shapechange Category",
	"SHAPECHANGE_TOKEN_CATEGORY_REMOVE_LONG": "Are you sure you wish to Remove this Shapechange Category?",
	"SHAPECHANGE_TOKEN_CATEGORY_RENAME": "Rename Shapechange Category",
	"SHAPECHANGE_TOKEN_CATEGORY_RENAME_LONG": "Please enter a new name for this Shapechange category.",
	"SHAPECHANGE_TOKEN_NAME": "Enter Name",
	"SHAPECHANGE_TOKEN_NAME_LONG": "Please enter a name for the selected token.",
	"SHAPECHANGE_TOKEN_REMOVE": "Remove Shapechange Token",
	"SHAPECHANGE_TOKEN_REMOVE_LONG": "Are you sure you wish to Remove this Shapechange Token?",
	"SHAPECHANGE_TOKEN_RENAME": "Rename Shapechange Token",
	"SHAPECHANGE_TOKEN_RENAME_LONG": "Please enter a new name for this token.",
	"SHOW_AC": "Show Token Armour Class",
	"SHOW_HP": "Show Token Hit Points",
	"SHOW_NAMES": "Show Token Names",
	"TOGGLE_CONDITION": "Toggle Condition",
	"TOKEN_SELECTED": "Selected",
	"TOKENS_UNSELECTED": "Unselected"
      }, {
	"en-US": {
		"ARMOUR_CLASS": "Armor Class",
		"DESATURATE_CONDITIONS": "Grayscale Conditions",
		"HIGHLIGHT_COLOUR": "Token Highlight Color",
		"SHOW_AC": "Show Token Armor Class"
	}
      }),
      importName = pluginName(import.meta),
      [initiativeWindow5E, initiativeList5E, conditionList, hasCondition, hideTokenHP, token5e, tokenHP5e, hideTokenAC, tokenAC5e, hideTokenNames, tokenName5e, hideTokenConditions, tokenConditions5e, hideSelectedHP, hideSelectedAC, hideSelectedNames, hideSelectedConditions, desaturateTokenConditions, desaturateSelectedConditions, tokenSelector5E, shapechangeSettings5E, tokenInitiative, displaySettings5e, perspectives5e, saturate5E, shield5E, hp5E, hpBack5E, blindMask, blurFace, concentratingSpoke, concentratingCog, dyingLine, flyingWing, guidancePoints, huntersMarkMask, levitateBoot, stunnedStar, unconsciousZ, burning, haste, hideousLaughter, poisoned, prone, slow, darksatID, darkvisID, darkvisionID] = ids(48),
      conditionIDs = ids(37),
      initAsc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "2,2 0,2 1,0", "fill": "currentColor"})),
      initDesc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,0 1,2", "fill": "currentColor"})),
      initNext = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,1 0,2", "fill": "currentColor"})),
      initPrev = svg({"viewBox": "0 0 2 2"}, polygon({"points": "2,0 0,1 2,2", "fill": "currentColor"})),
      conditions = (Object.keys(lang) as (keyof typeof lang)[]).filter(k => k.startsWith("CONDITION_")),
      sortAsc = (a: Initiative, b: Initiative) => a.initiative - b.initiative,
      sortDesc = (a: Initiative, b: Initiative) => b.initiative - a.initiative,
      isValidToken = (t: SVGToken | SVGShape | SVGDrawing | null): t is SVGToken5EType => t instanceof SVGToken5E && !t.isPattern && tokens.has(t.id),
      initiativeList = new NodeArray<Initiative, HTMLUListElement>(ul({"id": initiativeList5E})),
      saveInitiative = () => {
	if (initiativeList.length === 0) {
		doMapDataRemove("5e-initiative");
	} else {
		doMapDataSet("5e-initiative", initiativeList.map(i => ({
			"id": i.token.id,
			"initiative": i.initiative
		})));
	}
      },
      initiativeWindow = windows({"window-icon": `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cpath d="M92.5,7 l-30,30 h30 z" fill="%23000" stroke="%23fff" stroke-linejoin="round" /%3E%3Ccircle cx="50" cy="50" r="40" fill="none" stroke="%23fff" stroke-width="12" stroke-dasharray="191 1000" stroke-dashoffset="-29" /%3E%3Ccircle cx="50" cy="50" r="40" fill="none" stroke="%23000" stroke-width="10" stroke-dasharray="191 1000" stroke-dashoffset="-30" /%3E%3C/svg%3E`, "window-title": lang["INITIATIVE"], "style": "--window-left: 0px; --window-top: calc(100% - 400px); --window-width: 200px; --window-height: 400px", "window-data": "5e-window-data", "hide-close": true, "hide-maximise": true, "resizable": true}, div({"id": initiativeWindow5E}, [
	isAdmin ? div([
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
		br(),
		button({"title": lang["INITIATIVE_PREV"], "onclick": () => {
			const i = initiativeList.pop();
			if (i) {
				initiativeList.unshift(i);
				saveInitiative();
			}
		}}, initPrev),
		button({"title": lang["INITIATIVE_NEXT"], "onclick": () => {
			const i = initiativeList.shift();
			if (i) {
				initiativeList.push(i);
				saveInitiative();
			}
		}}, initNext)
	]) : [],
	initiativeList
      ])),
      initTokens = new Set<Uint>(),
      addToInitiative = (token: SVGToken, initiative: Int, hidden: boolean) => (initTokens.add(token.id), initiativeList.push({
	token,
	hidden,
	initiative,
	[node]: li({"style": hidden && !isAdmin ? "display: none" : undefined, "onmouseover": () => {
		if (token[node].parentNode) {
			amendNode(highlight, {"width": token.width, "height": token.height, "transform": token.transformString()});
			token[node].parentNode!.insertBefore(highlight, token[node]);
		}
	}, "onmouseleave": () => highlight.remove()}, [
		img({"src": imageIDtoURL(token.src), "onclick": (e: MouseEvent) => {
			centreOnGrid(token.x + (token.width >> 1), token.y + (token.height >> 1));
			if (isAdmin && e.ctrlKey) {
				selectToken(token);
			}
		}}),
		span(token.getData("name") ?? ""),
		span(isAdmin ? {"class": tokenInitiative, "onclick": () => {
			updateInitiative([token.id, null]);
			saveInitiative();
			highlight.remove();
		}} : {}, initiative + "")
	])
      })),
      updateInitiative = (change?: [Uint, Uint | null]) => {
	const {"5e-initiative": initiative} = mapData.data,
	      hiddenLayers = new Set<string>();
	initiativeList.splice(0, initiativeList.length);
	initTokens.clear();
	walkLayers((l, isHidden) => {
		if (isHidden) {
			hiddenLayers.add(l.path);
		}
	});
	if (initiative) {
		for (const i of initiative as IDInitiative[]) {
			const tk = tokens.get(i.id);
			if (tk) {
				const {layer, token} = tk;
				if (token instanceof SVGToken5E) {
					let initiative = i.initiative;
					const isHidden = hiddenLayers.has(layer.path);
					if (change && change[0] === i.id) {
						const i = change[1];
						change = undefined;
						if (i === null) {
							continue;
						}
						initiative = i;
					}
					if (!isHidden || isAdmin) {
						addToInitiative(token, initiative, isHidden);
					}
				}
			}
		}
	}
	if (change && change[1] !== null) {
		const {token, layer} = tokens.get(change[0])!;
		if (token instanceof SVGToken5E) {
			addToInitiative(token, change[1], hiddenLayers.has(layer.path));
		}
	}
	if (initiativeList.length === 0) {
		initiativeWindow.remove();
	} else if (!initiativeWindow.parentNode) {
		amendNode(shell, initiativeWindow);
	}
	updatePerspectives();
      },
      displaySettings = {
	"SHOW_HP": [new BoolSetting("5e-show-token-hp").wait(b => amendNode(document.body, {"class": {[hideTokenHP]: !b}})), new BoolSetting("5e-show-selected-hp").wait(b => amendNode(document.body, {"class": {[hideSelectedHP]: !b}}))],
	"SHOW_AC": [new BoolSetting("5e-show-token-ac").wait(b => amendNode(document.body, {"class": {[hideTokenAC]: !b}})), new BoolSetting("5e-show-selected-ac").wait(b => amendNode(document.body, {"class": {[hideSelectedAC]: !b}}))],
	"SHOW_NAMES": [new BoolSetting("5e-show-token-names").wait(b => amendNode(document.body, {"class": {[hideTokenNames]: !b}})), new BoolSetting("5e-show-selected-names").wait(b => amendNode(document.body, {"class": {[hideSelectedNames]: !b}}))],
	"HIDE_CONDITIONS": [new BoolSetting("5e-hide-token-conditions").wait(b => amendNode(document.body, {"class": {[hideTokenConditions]: b}})), new BoolSetting("5e-hide-selected-conditions").wait(b => amendNode(document.body, {"class": {[hideSelectedConditions]: b}}))],
	"DESATURATE_CONDITIONS": [new BoolSetting("5e-desaturate-token-conditions").wait(b => amendNode(document.body, {"class": {[desaturateTokenConditions]: b}})), new BoolSetting("5e-desaturate-selected-conditions").wait(b => amendNode(document.body, {"class": {[desaturateSelectedConditions]: b}}))]
      } as Record<keyof typeof lang, [BoolSetting, BoolSetting]>,
      highlight = rect({"stroke-width": 20}),
      highlightColour = new ColourSetting("5e-hightlight-colour", new Colour(255, 255, 0, 127)).wait(c => {
	const h = c.toHexString();
	amendNode(highlight, {"fill": h, "stroke": h, "opacity": c.a / 255});
      }),
      updatePerspectives = (() => {
	type PerspectiveData = [Int, Int, SVGPolygonElement[], Children, Children];
	const perspectives = g({"id": perspectives5e, "fill": "#000"}),
	      black = [[new Colour(0, 0, 0)]],
	      timings = [0],
	      darksat = filter({"id": darksatID}, feColorMatrix({"type": "matrix", "values": "0 0 0 0 0,0 0 0 0 0,0 0 0 0 0,-0.2125 -0.7154 -0.0721 1 0"})),
	      darkvis = filter({"id": darkvisID}, feColorMatrix({"type": "matrix", "values": "0.5 0 0 0 0.5,0 0.5 0 0 0.5,0 0 0.5 0 0.5,0 0 0 1 0"})),
	      dvcs = g(),
	      dv = clipPath({"id": darkvisionID}),
	      lastPerspectives: PerspectiveData[]= [];
	masks[node].firstChild?.after(perspectives);
	amendNode(definitions[node], [
		dvcs,
		dv,
		darksat,
		darkvis
	]);
	let nextID = 0,
	    lastScale = 0,
	    lastWalls: LightWall[] = [],
	    oldMapData: MapData | null = null;
	return () => {
		if (oldMapData !== mapData) {
			oldMapData = mapData;
			return;
		}
		nextID = 0;
		clearNode(perspectives);
		clearNode(dvcs);
		clearNode(dv);
		const tokens: (SVGToken | SVGShape | SVGDrawing)[] = [];
		if (initiativeList[0]?.token.getData("5e-player")) {
			tokens.push(initiativeList[0].token);
		} else {
			walkLayers((l: SVGLayer, hidden: boolean) => {
				if (!hidden) {
					for (const t of l.tokens) {
						if (t.getData("5e-player")) {
							tokens.push(t);
						}
					}
				}
			});
		}
		let update = wallList !== lastWalls || tokens.length !== lastPerspectives.length;
		lastWalls = wallList;
		if (tokens.length) {
			const {gridSize, gridDistance, width, height} = mapData,
			      scale = gridSize / (gridDistance || 1),
			      stages = [Math.max(width, height) / scale, 0];
			update ||= scale !== lastScale;
			lastScale = scale;
			amendNode(perspectives, [
				rect({"width": "100%", "height": "100%", "fill": "#fff"}),
				tokens.map((t, n) => {
					const [x, y] = t.getCentre();
					if (!update) {
						const [oldX, oldY, oldNode, a, b] = lastPerspectives[n];
						if (x === oldX && y === oldY) {
							amendNode(dvcs, a);
							amendNode(dv, b);
							return oldNode;
						}
					}
					const p = makeLight(new PerspectiveLighting(x, y, x, y, black, stages, timings), wallList, scale),
					      r = (t.getData("5e-darkvision") ?? 0) * scale,
					      data: PerspectiveData = [x, y, p, [], []];
					lastPerspectives.splice(n, 1, data);
					if (r) {
						const id = "DVC-5E_"+nextID++,
						      [cx, cy] = t.getCentre();
						amendNode(dvcs, data[3] = clipPath({id}, circle({r, cx, cy})));
						amendNode(dv, data[4] = p.map(p => amendNode(p.cloneNode(), {"clip-path": `url(#${id})`, "fill": undefined})));
					}
					return p;
				}).flat().sort((a, b) => stringSort(b.getAttribute("fill") ?? "", a.getAttribute("fill") ?? ""))
			]);
		}
	};
      })(),
      plugin: PluginType = {
	"settings": {
		"fn": div([
			labels([lang["HIGHLIGHT_COLOUR"], ": "], makeColourPicker(null, lang["HIGHLIGHT_COLOUR"], () => highlightColour.value, (c: Colour) => highlightColour.set(c))),
			table({"id": displaySettings5e}, [
				thead(tr([
					td(),
					th(lang["TOKENS_UNSELECTED"]),
					th(lang["TOKEN_SELECTED"])
				])),
				tbody(Object.entries(displaySettings).map(([name, settings]) => tr([
					td([lang[name as keyof typeof lang], ": "]),
					settings.map(setting => td(labels(input({"type": "checkbox", "class": settingsTicker, "checked": setting.value, "onchange": function(this: HTMLInputElement) {
						setting.set(this.checked);
					}}), "")))
				])))
			])
		])
	},
	"tokenClass": {
		"fn": (c: SVGTokenConstructor) => SVGToken5E = class extends c {
			#tokenNode: SVGGraphicsElement;
			#extra: SVGGElement;
			#hp: SVGGElement;
			#hpValue: SVGTextElement;
			#hpBar: SVGUseElement;
			#hpBack: SVGUseElement;
			#name: SVGTextElement;
			#ac: SVGGElement;
			#acValue: SVGTextElement;
			#shield: SVGUseElement;
			#conditions: SVGGElement;
			declare tokenData: Record<string, KeystoreData> & TokenFields;
			constructor(token: TokenImage, wg?: WaitGroup) {
				super(token, wg);
				const maxHP: Uint | null = this.getData("5e-hp-max"),
				      currentHP: Uint | null = this.getData("5e-hp-current"),
				      ac: Uint | null = this.getData("5e-ac"),
				      size = Math.min(this.width, this.height) / 4;
				this[node] = g([
					this.#tokenNode = this[node],
					this.#extra = g({"class": token5e, "transform": `translate(${this.x}, ${this.y})`, "style": "color: #000"}, [
						this.#hp = g({"class": tokenHP5e, "style": currentHP === null || maxHP === null ? "display: none" : undefined}, [
							this.#hpBack = use({"href": `#${hpBack5E}`, "width": size, "height": size}),
							this.#hpBar = use({"href": `#${hp5E}`, "width": size, "height": size, "stroke-dasharray": `${Math.PI * 19 * 0.75 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1)} 60`, "style": `color: rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`}),
							this.#hpValue = text({"x": this.width / 8, "y": "1.2em", "text-anchor": "middle", "fill": `rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`}, currentHP?.toString() ?? "")
						]),
						this.#name = text({"class": tokenName5e, "style": "user-select: none", "stroke": "#fff", "stroke-width": 1, "fill": "#000", "x": this.width / 2, "y": "1em", "text-anchor": "middle"}, this.getData("name") ?? ""),
						this.#ac = g({"class": tokenAC5e, "style": ac === null ? "display: none" : undefined}, [
							this.#shield = use({"href": `#${shield5E}`, "width": size, "height": size, "x": 3 * this.width / 4}),
							this.#acValue = text({"x": 7 * this.width / 8, "y": "1.2em", "text-anchor": "middle"}, ac?.toString() ?? "")
						]),
						this.#conditions = g({"class": tokenConditions5e})
					])
				]);
				setTimeout(() => this.#setTextWidth(), 0);
				this.#updateConditions();
			}
			#setTextWidth() {
				const maxNameLength = this.width / 2,
				      nameLength = this.#name.getComputedTextLength(),
				      size = Math.min(this.width, this.height) / 8,
				      textSize = Math.min(16 * (maxNameLength / nameLength), this.height / 8);
				amendNode(this.#name, {"style": {"font-size": textSize + "px"}, "stroke-width": textSize / 100});
				amendNode(this.#acValue, {"style": {"font-size": `${size}px`}});
				amendNode(this.#hpValue, {"style": {"font-size": `${size}px`}});
			}
			#swapNodes<T>(fn: () => T): T {
				const n = this[node];
				this[node] = this.#tokenNode;
				const ret = fn();
				this.#tokenNode = this[node];
				this[node] = n;
				return ret;
			}
			cleanup() {
				this.#swapNodes(() => super.cleanup());
			}
			uncleanup() {
				this.#swapNodes(() => super.uncleanup());
			}
			hasLight() {
				return super.hasLight() || this.getData("5e-player");
			}
			at(x: Int, y: Int) {
				return this.#swapNodes(() => super.at(x, y));
			}
			[select]() {
				outline.insertAdjacentElement("beforebegin", this.#extra);
			}
			[unselect]() {
				if (!this.isPattern) {
					amendNode(this[node], this.#extra);
				}
			}
			updateSource(source: Uint) {
				this.#swapNodes(() => super.updateSource(source));
			}
			updateNode() {
				const wasPattern = this.#tokenNode instanceof SVGRectElement;
				this.#swapNodes(() => super.updateNode());
				if (this.isPattern) {
					if (!wasPattern) {
						this.#extra.remove();
					}
				} else if (wasPattern) {
					if (selected.token === this) {
						outline.insertAdjacentElement("beforebegin", this.#extra);
					}
					this[node].replaceWith(this[node] = g([this.#tokenNode, this.#extra]));
				}
				amendNode(this.#tokenNode, {"width": this.width, "height": this.height, "transform": this.transformString()});
				amendNode(this.#extra, {"transform": `translate(${this.x}, ${this.y})`});
				amendNode(this.#shield, {"x": 3 * this.width / 4, "width": this.width / 4, "height": Math.min(this.height, this.width) / 4});
				amendNode(this.#hpBack, {"width": this.width / 4, "height": Math.min(this.width, this.height) / 4});
				amendNode(this.#hpBar, {"width": this.width / 4, "height": Math.min(this.width, this.height) / 4});
				amendNode(this.#name, {"x": this.width / 2, "style": {"font-size": undefined}});
				amendNode(this.#hpValue, {"x": this.width / 8});
				amendNode(this.#acValue, {"x": 7 * this.width / 8});
				this.#setTextWidth();
				this.#updateConditions();
			}
			[updateData]() {
				const maxHP: Uint | null = this.getData("5e-hp-max"),
				      currentHP: Uint | null = this.getData("5e-hp-current"),
				      ac: Uint | null = this.getData("5e-ac"),
				      name = this.getData("name") || "";
				if (ac === null) {
					amendNode(this.#ac, {"style": "display: none"});
				} else {
					amendNode(this.#ac, {"style": undefined});
					clearNode(this.#acValue, ac + "");
				}
				if (currentHP === null || maxHP === null) {
					amendNode(this.#hp, {"style": "display: none"});
				} else {
					amendNode(this.#hp, {"style": undefined});
					clearNode(this.#hpValue, {"fill": `rgba(${Math.round(255 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1))}, 0, 0, 1)`}, currentHP + "");
					amendNode(this.#hpBar, {"stroke-dasharray": `${Math.PI * 19 * 0.75 * Math.min(currentHP || 0, maxHP || 0) / (maxHP || 1)} 60`});
				}
				if (this.#name.innerHTML !== name) {
					clearNode(this.#name, {"style": {"font-size": undefined}}, name);
					this.#setTextWidth();
				}
				this.#updateConditions();
			}
			#updateConditions() {
				clearNode(this.#conditions);
				const myConditions: boolean[] = this.getData("5e-conditions") ?? [],
				      size = Math.min(this.width, this.height) / 4,
				      perRow = Math.floor(this.width / size);
				let row = -1,
				    col = 0;
				for (let i = 0; i < myConditions.length; i++) {
					if (myConditions[i]) {
						amendNode(this.#conditions, use({"href": `#${conditionIDs[i]}`, "x": col * size, "y": row * size, "width": size, "height": size}));
						col++;
						if (col === perRow) {
							col = 0;
							row--;
						}
					}
				}
				amendNode(this.#conditions, {"transform": `translate(0, ${this.height})`});
			}
		}
	},
	"handleWalls": {
		"fn": updatePerspectives
	}
      },
      dyingAnimate = animate({"attributeName": "stroke-dashoffset", "values": "251.26;0", "dur": "1s"}),
      dyingAnimateMotion = animateMotion({"dur": "1s", "begin": -0.6}, mpath({"href": "#5e-dying"})),
      dyingCircle = circle({"r": 3, "fill": "#fff", "stroke": "#000"}, dyingAnimateMotion);

add({
	[`#${initiativeWindow5E}`]: {
		" svg": {
			"width": "1.5em"
		},
		" button": {
			"height": "2em"
		}
	},
	[`#${initiativeList5E}`]: {
		"list-style": "none",
		"padding": 0,
		" li": {
			"display": "grid",
			"grid-template-columns": "4.5em auto 3em",
			"align-items": "center",
			" span": {
				"text-align": "center"
			}
		},
		" img": {
			"height": "4em",
			"width": "4em",
			"cursor": "pointer"
		}
	},
	[`.${conditionList}`]: {
		"padding-left": "1em",
		"box-styling": "padding-box",
		">menu-item": {
			"display": "list-item",
			"list-style": "none"
		}
	},
	[`.${hasCondition}`]: {
		"list-style": "square !important"
	},
	[`.${hideTokenHP} g .${token5e} .${tokenHP5e},.${hideTokenAC} g .${token5e} .${tokenAC5e},.${hideTokenNames} g .${token5e} .${tokenName5e},.${hideTokenConditions} g .${token5e} .${tokenConditions5e},.${hideSelectedHP} svg>.${token5e} .${tokenHP5e},.${hideSelectedAC} svg>.${token5e} .${tokenAC5e},.${hideSelectedNames} svg>.${token5e} .${tokenName5e},.${hideSelectedConditions} svg>.${token5e} .${tokenConditions5e}`]: {
		"visibility": "hidden"
	},
	[`.${desaturateTokenConditions} g .${token5e} .${tokenConditions5e},.${desaturateSelectedConditions} svg>.${token5e} .${tokenConditions5e}`]: {
		"filter": `url(#${saturate5E})`
	},
	[`.${tokenSelector5E},.${tokenSelector5E}>button,.${tokenSelector5E}>img`]: {
		"width": "100px",
		"height": "100px"
	},
	[`#${shapechangeSettings5E}`]: {
		"border-collapse": "collapse",
		" td": {
			"text-align": "center",
			"label": {
				"font-size": "2em"
			}
		},
		" th, td:not(:first-child)": {
			"border": "1px solid currentColor"
		}
	},
	[`.${tokenInitiative}:hover`]: {
		"background-color": "#800",
		"cursor": "pointer"
	}
});

enableAnimation.wait(v => {
	const params = {"repeatCount": v ? "indefinite" : 1};
	amendNode(dyingAnimate, params);
	amendNode(dyingAnimateMotion, params);
	amendNode(dyingCircle, v ? {"cx": 0, "cy": 0} : {"cx": 46, "cy": 38});
});

amendNode(symbols, [
	filter({"id": saturate5E}, feColorMatrix({"type": "saturate", "values": 0})),
	symbol({"id": shield5E, "viewBox": "0 0 8 9"}, path({"d": "M0,1 q2,0 4,-1 q2,1 4,1 q0,5 -4,8 q-4,-3 -4,-8 z", "fill": "#aaa"})),
	symbol({"id": hpBack5E, "viewBox": "0 0 20 20"}, circle({"r": 9.5, "fill": "#eee", "stroke": "#888", "stroke-width": 1, "stroke-linecap": "round", "stroke-dasharray": `${Math.PI * 19 * 0.75} ${Math.PI * 19 * 0.25}`, "transform": "translate(10, 10) rotate(135)"})),
	symbol({"id": hp5E, "viewBox": "0 0 20 20"}, circle({"r": 9.5, "fill": "transparent", "stroke": "#f00", "stroke-width": 1, "stroke-linecap": "round", "transform": "translate(10, 10) rotate(135)"})),
	[
		symbol({"viewBox": "0 0 80 85"}, g({"stroke": "#000", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round"}, [path({"d": "M5,37 a1,1 0,0,1 70,0 q4,-1 3,5 q-1,18 -6,10 q0,28 -15,30 q-17,3 -34,0 q-15,-2 -15,-30 q-5,8 -6,-10 q-1,-6 3,-5 z M40,2 v25 m-5,0 h10 m0,-6 h-10 m0,-6 h10 m0,-6 h-10", "fill": "#444"}), path({"d": "M57,82 q-17,3 -34,0 l10,-20 l-20,-18 l5,-20 l5,10 l17,5 l17,-5 l5,-10 l5,20 l-20,18 z", "fill": "#fff"}), path({"d": "M20,38 l15,5 a5,5 0,0,1 -15,-5 z M60,38 l-15,5 a5,5 0,0,0 15,-5 z", "fill": "#f00"})])), // Bane
		symbol({"viewBox": "0 0 11 10.5"}, [ellipse({"cx": 5.5, "cy": 2, "rx": 5, "ry": 1.5, "fill": "transparent", "stroke": "#ff0", "stroke-width": 1}), circle({"cx": 5.5, "cy": 5.5, "r": 5, "fill": "#fc8", "stroke": "#000", "stroke-width": 0.2}), ellipse({"cx": 5.5, "cy": 2, "rx": 5, "ry": 1.5, "fill": "transparent", "stroke": "#ff0", "stroke-width": 1, "stroke-dasharray": 10}), path({"d": "M2,5.5 q1,-1 2,0 m3,0 q1,-1 2,0 M3.5,8.5 q2,1 4,0", "fill": "transparent", "stroke": "#000", "stroke-width": 0.1, "stroke-linecap": "round"})]), // Blessed
		symbol({"viewBox": "0 0 100 70"}, [defs(mask({"id": blindMask}, [rect({"width": 100, "height": 70, "fill": "#fff"}), line({"x1": 10, "y1": 67, "x2": 90, "y2": 3, "stroke": "#000", "stroke-width": 9}),])), g({"mask": `url(#${blindMask})`}, visibility()), line({"x1": 10, "y1": 67, "x2": 90, "y2": 3, "stroke": "#000", "stroke-width": 5})]), // Blinded
		symbol({"viewBox": "0 0 100 80"}, g({"stroke": "#000", "stroke-width": 2}, [ellipse({"cx": 50, "cy": 35, "rx": 49, "ry": 34, "fill": "#fc8"}), path({"d": "M10,55 l-8,9 M20,62 l-5,9 M30,66 l-3,10 M40,69 l-1,10 M50,70 v10 M60,69 l1,10 M70,66 l3,10 M80,62 l5,9 M90,55 l8,9", "stroke-linecap": "round"})])), // Blink
		symbol({"viewBox": "0 0 150 90"}, [defs(g({"id": blurFace}, [circle({"cx": 50, "cy": 50, "r": 48, "fill": "#fc8", "stroke": "#000"}), path({"d": "M30,30 v10 a5,5 0,0,0 10,0 v-10 a5,5, 0,0,0 -10,0 M60,30 v10 a5,5 0,0,0 10,0 v-10 a5,5, 0,0,0 -10,0 M20,60 q30,20 60,0 q-30,40 -60,0 Z", "fill": "#321"})])), use({"href": `#${blurFace}`, "style": "opacity: 0.6"}), use({"href": `#${blurFace}`, "style": "opacity: 0.6", "transform": "translate(50, 0)"}), use({"href": `#${blurFace}`, "style": "opacity: 0.8", "transform": "translate(25, 0)"})]), // Blur
		symbol({"viewBox": "0 0 100 100"}, [defs(radialGradient({"id": burning, "cy": 0.55, "fy": 1}, [stop({"offset": "0%", "stop-color": "#fff"}), stop({"offset": "20%", "stop-color": "#ff0"}), stop({"offset": "100%", "stop-color": "#f00"})])), path({"d": "M43,99 c-20,0 -60,-30 -30,-70 q0,20 10,30 c0,-20 25,-40 20,-58 q20,30 20,58 q10,-10 5,-30 q10,15 15,35 q5,-10 0,-25 c40,50 -10,62 -40,60 z M25,20 c-15,30 5,30 0,0 z M60,20 c0,20 10,20 0,0 z", "stroke": "#000", "fill": `url(#${burning})`, "stroke-linejoin": "round"})]), // Burning
		symbol({"viewBox": "0 0 8.2 8.23"}, path({"d": "M0.1,2.1 a2,2 0,0,1 4,0 a2,2 0,0,1 4,0 q0,3 -4,6 q-4,-3 -4,-6 Z", "fill": "#f00", "stroke": "#000", "stroke-width": 0.2})), // Charmed
		symbol({"viewBox": "0 0 80 90"}, [defs([path({"id": concentratingSpoke, "d": "M1,7 v2 a1,1 0,0,1 -2,0 v-2 z", "fill": "#000"}), g({"id": concentratingCog}, [circle({"r": 5.5, "fill": "none", "stroke": "#000", "stroke-width": 4.5}), Array.from({"length": 12}, (_, n) => n * 30).map(r => use({"href": `#${concentratingSpoke}`, "transform": `rotate(${r})`}))])]), path({"d": "M64,88 c-15,-30 20,-30 15,-60 c-5,-35 -70,-40 -70,10 c-10,10 -10,10 -2,12 c-2,4 -2,4 2,5 c-4,4 -2,4 0,5 c-2,8 -1,10 20,12 q5,0 5,15 z", "fill": "#fc8", "stroke": "#000", "stroke-linejoin": "round"}), use({"href": `#${concentratingCog}`, "transform": "translate(55, 15)"}), use({"href": `#${concentratingCog}`, "transform": "translate(30, 20) scale(1.2)"}), use({"href": `#${concentratingCog}`, "transform": "translate(50, 42) scale(1.8)"})]), // Concentrating
		symbol({"viewBox": "0 0 58 100"}, path({"d": "M37,90 a8,8 0,1,0 0,0.1 z M25,70 h8 l1,-20 a11,8 -10,0,0 -30,-45 v15 h5 l2,-8 a9,6 -10,0,1 13,32 Z", "stroke": "#000", "stroke-width": 2, "fill": "#fff"})), // Confused
		symbol({"viewBox": "0 0 84 110"}, [rect({"x": 18, "y": 50, "width": 47, "height": 30, "fill": "#ffe"}), path({"d": "M12,52 q-9,-1 -10,-10 a35,35 0,1,1 80,0 q-1,9 -10,10 M32,83 c-10,-20 -27,0 -20,-30 c3,-4.5 -5,-13.5 0,-18 M72,35 c5,4.5 -3,13.5 0,18 c7,30 -10,10 -20,30 M17,72.2 c3,10 0,28 5,30 a40,40 0,0,0 40,0 c5,-2 2,-20 5,-30", "fill": "#ffe", "stroke": "#000", "stroke-width": 2, "stroke-linecap": "round"}), path({"d": "M23,74 c3,5 0,15 5,20 a30,30 0,0,0 28,0 c5,-5 2,-15 5,-20 M32,96 v-13 a25,30 0,0,0 20,0 v13 M37,85 v12 M42,86 v12 M47,85 v12 M32,89.5 a27,30 0,0,0 20,0", "fill": "none", "stroke": "#000", "stroke-width": 1}), path({"d": "M19,50 c0,20 18,10 18,5 c2,-15 -20,-10 -18,-5 M 65,50 c0,20 -18,10 -18,5 c-2,-15 20,-10 18,-5 M41,60 c-10,5 -5,25 0,15 Z M43,60 c10,5 5,25 0,15 Z", "fill": "#000"})]), // Dead
		symbol({"viewBox": "0 0 65 70"}, [path({"d": "M15,25 a20,20 0,1,1 40,10 c0,5 -10,5 -10,10 c-3,15 -10,30 -20,20 M20,25 a10,10 0,1,1 30,10", "fill": "#fff", "stroke": "#000", "stroke-width": 3, "stroke-linecap": "round"}), path({"d": "M5,60 l20,-20 M50,15 l10,-10", "stroke": "#000", "stroke-width": 8})]), // Deafened
		symbol({"viewBox": "0 0 100 54"}, [defs(path({"id": dyingLine, "d": "M0,32 h20 l3,-10 l6,30 l10,-50 l8,40 l4,-10 l4,15 l6,-25 l3,10 h36", "fill": "none", "stroke-linejoin": "round", "stroke-dasharray": "150 102"}, dyingAnimate)), use({"href": `#${dyingLine}`, "stroke": "#000", "stroke-width": 4}), use({"href": `#${dyingLine}`, "stroke": "#f00", "stroke-width": 2}), dyingCircle]), // Dying
		symbol({"viewBox": "0 0 82 107"}, g({"stroke": "#000", "fill": "#fff", "stroke-width": 1}, [circle({"cx": 41, "cy": 41, "r": 40, "fill": "#fa6"}), circle({"cx": 41, "cy": 60, "r": 6, "fill": "#000"}), path({"d": "M11,30 a2,1 0,0,0 20,0 m20,0 a2,1 0,0,0 20,0", "fill": "none"}), path({"d": "M38,70 l-6,18 l1,11 h16 l1,-11 l-6,-18"}), path({"d": "M36,90 a8,8 0,1,0 -3,10 M46,90 a8,8 0,1,1 3,10 M33,98 a8,8 0,1,0 16,0"})])), // Exhausted
		symbol({"viewBox": "0 0 200 100"}, [defs(path({"id": flyingWing, "d": "M100,99 c40,-20 30,-50 60,-40 q10,5 20,-10 h-40 c40,-10 45,-5 50,-20 l-45,5 c45,-20 50,-10 54,-33 c-120,20 -45,60 -99,98 z", "fill": "#fff", "stroke": "#000", "stroke-width": 2, "stroke-linejoin": "round"})), use({"href": `#${flyingWing}`, "transform": "translate(200, 0) scale(-1, 1)"}), use({"href": `#${flyingWing}`})]), // Flying
		symbol({"viewBox": "0 0 62 80"}, [path({"d": "M11,43 a25,26 0,1,1 40,0 a15,22 0,1,1 -40,0 z M11,79 q5,-5 5,-10 q0,-3.5 -1,-7 q-6,-9 -5,-18 q-4,-5 -5,-15 a1,1 0,0,0 -4,-1 q0,5 3,17 q-2,10 3,20 q-1,7 -5,14 z M51,79 q-5,-5 -5,-10 q0,-3.5 1,-7 q6,-9 5,-18 q4,-5 5,-15 a1,1 0,0,1 4,-1 q0,5 -3,17 q2,10 -3,20 q1,7 5,14 z", "fill": "#fc8", "stroke": "#000"}), ellipse({"cx": 31, "cy": 56, "rx": 5, "ry": 10, "fill": "#000"}), g({"fill": "#f80", "stroke": "#fff", "stroke-width": 3}, [circle({"cx": 21, "cy": 29, "r": 3}), circle({"cx": 41, "cy": 29, "r": 3}),]), path({"d": "M29,29 q-5,11 3,10", "stroke": "#000", "stroke-width": 0.5, "fill": "none"})]), // Frightened
		symbol({"viewBox": "0 0 75 70"}, g({"fill": "#fc8", "stroke": "#000", "stroke-linejoin": "round", "stroke-linecap": "round"}, [path({"d": "M11,44 l2,10 l5,5 l15,-5 l5,-3 q2,-12 9,-16 l21,-12 l-24,-11 l-26,-5 l-5,10 l-8,5 q0,5 -4,10"}), path({"d": "M11,44 q1,5 -1,10 q3,10 6,15 q10,-6 20,-10 q-4,-12 -18,-3 M6,44 q10,-1 20,0 q1,-5 0,-10 q-12,-2 -25,-2 q2,6 5,12 M11,24 q7,2 15,5 q3,-5 4,-10 q-10,-4 -20,-7 q-2,5 -5,10 q0,5 -4,10 M26,9 q15,10 20,0 q-8,-5 -15,-8 q-6,1.5 -12,2 l-4,10 M56,24 q-5,2 -10,5 q1,6 2,10 q5,2 25,-5 q-2,-7 -5,-15 q-10,0 -24,-7"})])), // Grappled
		symbol({"viewBox": "0 0 100 100"}, [defs(polygon({"id": guidancePoints, "points": "16,16 50,30 84,16 70,50 84,84 50,70 16,84 30,50"})), g({"stroke": "#000", "stroke-width": 1}, [use({"href": `#${guidancePoints}`, "fill": "#888"}), use({"href": `#${guidancePoints}`, "fill": "#ccc", "transform": "rotate(45, 50, 50)"}), circle({"cx": 50, "cy": 50, "r": 20, "fill": "#fff"})])]), // Guidance
		symbol({"viewBox": "0 0 100 80"}, [defs(pattern({"id": haste, "width": 100, "height": 80, "patternUnits": "userSpaceOnUse"}, [rect({"width": 100, "height": 80, "fill": "#f84"}), path({"d": "M11,58 a3,2 0,0,0 0,-10 M55,0 q23,10 17,20 M70,40 l21,5 v-6 l-14,-4 c-10,-5 0,-10 -10,-20 h-10 v5 c5,5 -5,20 13,20 M92,32 a1,1 0,0,1 0,-5", "fill": "#ffc"})])), path({"d": "M30,45 q3,5 -2,10 q-4,1 -8,5 c-8,5 0,20 -10,15 q-1,-1.5 0,-3 l1,-8 c2,-5 10,-10 5,-9 a4,2 0,1,1 1,-5 a4,1 330,0,1 55,-30 q0,-8 -10,-15 a2,5 320,0,1 3,0 q20,10 17,15 q8,0 10,10 q-5,5 -15,5 q6,3 12,5 a1,1 0,0,1 -1,3 q-10,-2 -20,-3 q-18,0 -37,11", "fill": `url(#${haste})`, "stroke": "#000", "stroke-linecap": "round", "stroke-linejoin": "round"}), circle({"cx": 82, "cy": 25, "r": 1.5, "fill": "#000"})]), // Haste
		symbol({"viewBox": "0 0 100 100"}, [circle({"cx": 50, "cy": 50, "r": 49.5, "fill": "#808", "stroke": "#000", "stroke-width": 1}), path({"d": "M3,35 L79,90 L50,1 L21,90 L97,35 Z", "stroke": "#000", "fill": "#fff", "stroke-linejoin": "bevel", "fill-rule": "evenodd"})]), // Hexed
		symbol({"viewBox": "0 0 100 100"}, [defs(radialGradient({"id": hideousLaughter, "cx": "50%", "cy": "50%", "fx": "15%", "fy": "15%"}, [stop({"offset": "0%", "stop-color": "#fff"}), stop({"offset": "50%", "stop-color": "#f00"}), stop({"offset": "100%", "stop-color": "#600"})])), g({"stroke": "#000", "stroke-linejoin": "round"}, [path({"d": "M1,10 q0,50 49,50 q49,0 49,-50 c-10,5 -30,-9 -49,-9 c-19,0 -39,14 -49,9 z", "fill": "#a00"}), path({"d": "M20,69 a1,1 0,0,0 60,0 v-30 q0,-20 -20,-20 c0,15 -20,15 -20,0 q-20,0 -20,20 z", "fill": "#ffd"}), path({"d": "M35,30 v20 c0,20 -15,10 -5,20 M65,30 v20 c0,20 15,10 5,20", "stroke": "#a00", "stroke-width": 2, "stroke-linecap": "round", "fill": "none"}), path({"d": "M30,70 a10,9 0,0,0 40,0 z a2,1 0,0,0 40,0 M35,70 v12 M40,70 v15.5 M45,70 v17 M50,70 v18 M55,70 v17 M60,70 v15.5 M65,70 v12", "fill": "#fff"}), circle({"cx": 50, "cy": 62, "r": 10, "fill": `url(#${hideousLaughter})`}), path({"d": "M27,40 l20,10 a1,1 0,0,1 -20,-10 z M73,40 l-20,10 a1,1 0,0,0 20,-10 z", "fill": "#ff0"}), circle({"cx": 35, "cy": 50, "r": 2, "fill": "#000"}), circle({"cx": 65, "cy": 50, "r": 2, "fill": "#000"})])]), // Hideous Laughter
		symbol({"viewBox": "0 0 100 100"}, [defs(mask({"id": huntersMarkMask}, [rect({"width": 100, "height": 100, "fill": "#fff"}), path({"d": "M0,50 h100 M50,0 v100", "stroke-width": 10, "stroke": "#000"})])), circle({"cx": 50, "cy": 50, "r": 47.5, "fill": "#fff"}), g({"mask": `url(#${huntersMarkMask})`}, [circle({"cx": 50, "cy": 50, "r": 30, "stroke": "#f00", "stroke-width": 2, "fill": "none"}), circle({"cx": 50, "cy": 50, "r": 45, "stroke": "#000", "stroke-width": 5, "fill": "none"})]), path({"d": "M0,50 h35 m30,0 h35 M50,0 v35 m0,30 v35", "stroke": "#000", "stroke-width": 3}), path({"d": "M35,50 h10 m10,0 h15 M50,35 v10 m0,10 v10", "stroke": "#000", "stroke-width": 1}), circle({"cx": 50, "cy": 50, "r": 2, "fill": "#f00"})]), // Hunter's Mark
		symbol({"viewBox": "0 0 100 100"}, [circle({"cx": 50, "cy": 50, "r": 49.5, "stroke": "#000", "fill": "#fc8"}), path({"d": "M20,30 l20,20 m-20,0 l20,-20 m20,0 l20,20 m-20,0 l20,-20 M30,75 h40 v5 a1,1 0,0,1 -15,0 v-5", "stroke": "#000", "stroke-width": 2, "fill": "#f00", "stroke-linecap": "round"})]), // Incapacitated
		symbol({"viewBox": "0 0 24 100"}, path({"d": "M20,90 a8,8 0,1,0 0,0.1 z M8,70 h8 l4,-65 h-16 z", "stroke": "#000", "stroke-width": 2, "fill": "#fff"})), // Inspired
		symbol({"viewBox": "0 0 82 92"}, g({"stroke": "#000", "stroke-width": 1, "fill": "rgba(255, 255, 255, 0.75)"}, [path({"d": "M81,91 v-50 a30,30 0,0,0 -80,0 v50 l10,-10 l10,10 l10,-10 l10,10 l10,-10 l10,10 l10,-10 z"}), circle({"cx": 20, "cy": 30, "r": 10}), circle({"cx": 60, "cy": 30, "r": 10})])), // Invisible
		symbol({"viewBox": "0 0 100 100"}, [defs(g({"id": levitateBoot, "transform": "rotate(10)", "stroke": "#000", "stroke-width": 1}, [path({"d": "M30,65 q-0.5,-5, 0,-10 h16 q15,6 30,6 h18 q1,3 0,6 h-18 q-15,0 -30,-6 v4 z", "fill": "#420"}), path({"d": "M30,55 h16 q15,6 30,6 h18 q0.5,-10 -10,-10 q-30,-4 -28,-10 q1,-15 -0,-30 q-12,-1 -26,0 q-1,22 0,44", "fill": "#840"})])), path({"d": "M0,100 v-30 l20,-5 h60 l20,5 v30 z", "fill": "#0a0"}), use({"href": `#${levitateBoot}`, "transform": "translate(10,0) scale(0.9)"}), use({"href": `#${levitateBoot}`}), path({"d": "M15,90 q-2,-2.5 5,-5 q-2,-2.5 5,-5 c3,0 40,2 58,5 q5,2.5 -5,5 q5,2.5 -5,5 c-15,2 -55,-5 -58,-5", "fill": "#040"})]), // Levitate
		symbol({"viewBox": "0 0 70 90"}, [rect({"x": 5, "y": 5, "width": 60, "height": 80, "fill": "#4df", "stroke": "#640", "stroke-width": 10, "rx": 1}), path({"d": "M10,50 v10 L60,15 v-5 h-5 z", "fill": "#8ff"})]), // Mirror Image
		symbol({"viewBox": "0 0 73 81"}, path({"d": "M10,32 a1,1 0,0,0 40,40 a1,1 0,0,0 -3,-3 a1,1 0,0,1 -34,-34 a1,1 0,0,0 -3,-3 z M60,77 l-20,-30 h-20 l-10,-35 a8,8 90,1,1 8,5 l7,24.5 h18 l18.5,28 l7,-4 l3,4 z", "fill": "#00a", "stroke": "#000", "stroke-width": 1})), // Paralyzed
		symbol({"viewBox": "0 0 100 90"}, [path({"d": "M5,90 a60,60 0,0,1 90,0 z", "fill": "red", "stroke": "#000"}), path({"d": "M50,20 c20,0 20,10 20,30 c-2,15 -5,20 -18,30 q-2,1 -4,0 c-13,-10 -16,-15 -18,-30 c0,-20 0,-30 20,-30", "fill": "#fc8", "stroke": "#000"}), path({"d": "M35,45 a10,10 0,0,1 10,0 a10,10 0,0,1 -10,0 M55,45 a10,10 0,0,1 10,0 a10,10 0,0,1 -10,0", "fill": "red", "stroke": "#000", "stroke-width": 0.3}), path({"d": "M40,65 c5,0 5,-5 10,-3 c5,-2 5,3 10,3 q-10,-0.5 -20,0 M41,65 q10,0.5 18,0 c-4,4 -14,4 -18,0", "fill": "#080"}), g({"stroke-width": 8, "stroke-linecap": "round", "fill": "none"}, [path({"d": "M30,40 c-15,-5 -10,20 -25,10 M70,40 c15,-5 10,20 25,10", "stroke": "#040"}), path({"d": "M33,32 c-15,-10 -10,5 -25,-10 M67,32 c15,-10 10,5, 25,-10", "stroke": "#060"}), path({"d": "M38,25 c-5,-10 -10,5 -15,-20 M 62,25 c5,-10 10,5, 15,-20", "stroke": "#080"}), path({"d": "M50,22 v-18", "stroke": "#0a0"})])]), // Petrified
		symbol({"viewBox": "0 0 6.2 9.3"}, [defs(linearGradient({"id": poisoned}, [stop({"offset": "0%", "stop-color": "#040"}), stop({"offset": "100%", "stop-color": "#0e0"})])), path({"d": "M3.1,0.2 q-6,8 0,9 q6,-1 0,-9 Z", "stroke": "#000", "stroke-width": 0.2, "fill": `url(#${poisoned})`})]), // Poisoned
		symbol({"viewBox": "0 0 100 60"}, [defs(pattern({"id": prone, "width": 100, "height": 60, "patternUnits": "userSpaceOnUse"}, [rect({"width": 100, "height": 60, "fill": "#cca"}), path({"d": "M100,60 h-53 l25,-60 h20 z", "fill": "#888"}), circle({"cx": 15, "cy": 20, "r": 13, "fill": "#840"}), path({"d": "M85,59 h15 v-20 h-15 z M0,59 h50 v-15 h-50 z M0,25 l28,-10 l-5,20 h-10 z", "fill": "#fc8"})])), g({"stroke": "#000", "stroke-linejoin": "round", "fill": `url(#${prone})`}, [path({"d": "M40,33.5 l-3,14.5 h-3.5 l-2,8 h9 q4,0 5,-4 l5,-20.5 z M90,59 a1,1 0,0,0 0,-12 h-20 l10,-23 c10,-8 0,-20 -5,-18 l-40,5 q-5,0 -6,5 l-8,33 h-15 a1,1 0,0,0 0,10 h20 q5,0 6,-5 l5,-20 l27,-5 l-10,25 q0,5 5,5 z M64,29 l-4,1 l-8,20 q-1,4 2,4 z"}), circle({"cx": 15, "cy": 20, "r": 12})])]), // Prone
		symbol({"viewBox": "0 0 100 100"}, g({"stroke": "#000", "stroke-width": 1, "fill": "#fff"}, [circle({"cx": 50, "cy": 50, "r": 49, "fill": "#a00"}), circle({"cx": 30, "cy": 40, "r": 8}), circle({"cx": 70, "cy": 40, "r": 8}), path({"d": "M22,25 l17,8 M61,33 l17,-8 M20,80 a3,2 0,0,1 60,0 z M30,80 v-15 M40,80 v-20 M50,80 v-20 M60,80 v-20 M70,80 v-15", "stroke-width": 3})])), // Rage
		symbol({"viewBox": "0 0 100 90"}, g({"stroke": "#000", "stroke-linejoin": "round", "stroke-linecap": "round"}, [path({"d": "M94,84 l-5,5 l-5,-5 l2,-2 l-75,-75 l0,-6", "fill": "#840"}), path({"d": "M94,84 l5,-5 l-5,-5 l-2,2 l-75,-75 l-6,0", "fill": "#c84"}), path({"d": "M7,20 h-5 q5,30 30,25 l-6,-15 z", "fill": "#aad"}), path({"d": "M20,10 q-10,10 -15,10 q10,20 25,20 q-2,-8 5,-15 l1,-1", "fill": "#88b"}), path({"d": "M20,10 l5,-5 l15,15 l-5,5", "fill": "#aad"}), path({"d": "M2,88 a1,1 0,1,1 3,-5 l13,-15 l-5,-5 l3,-3 l7,7", "fill": "#f80"}), path({"d": "M2,88 a1,1 0,1,0 5,-3 l15,-13 l5,5 l3,-3 l-7,-7", "fill": "#fa0"}), path({"d": "M1.75,87.80 l0.4,0.4"}), path({"d": "M26,70 l55,-50 l5,-16", "fill": "#88f"}), path({"d": "M86,4 l-5,16 l-55,50 l-3,-3", "fill": "#bbf"}), path({"d": "M86,4 l-16,5 l-50,55 l3,3", "fill": "#669"})])), // Reckless
		symbol({"viewBox": "0 0 37 37"}, g({"stroke": "#000", "stroke-width": 0.5, "fill": "#ccc", "stroke-linecap": "round", "fill-rule": "evenodd"}, [path({"d": "M2,28 a1,1 0,0,0 5,5 l4,-4 a1,1 0,0,0 -5,-5 z m1,1 a1,1 0,0,0 3,3 l4,-4 a1,1 0,0,0 -3,-3 z m10,-12 a1,1 0,0,0 5,5 l4,-4 a1,1 0,0,0 -5,-5 z m1,1 a1,1 0,0,0 3,3 l4,-4 a1,1 0,0,0 -3,-3 z m10,-12 a1,1 0,0,0 5,5 l4,-4 a1,1 0,0,0 -5,-5 z m1,1 a1,1 0,0,0 3,3 l4,-4 a1,1 0,0,0 -3,-3 z"}), path({"d": "M7.5,26.5 l8,-8 a1,1 0,0,1 1,1 l-8,8 a1,1 0,0,1 -1,-1 z m11,-11 l8,-8 a1,1 0,0,1 1,1 l-8,8 a1,1 0,0,1 -1,-1 z"})])), // Restrained
		symbol({"viewBox": "0 0 47 72"}, [g({"stroke": "#000", "fill": "none"}, [path({"d": "M2.5,41.5 l21,-21 l21,21", "stroke-width": 6.5}), path({"d": "M23.5,0.25 v21 M14.5,7 h18", "stroke-width": 3}), path({"d": "M23.5,21 l20,20 v30 h-40 v-30 z", "fill": "#efa"}), path({"d": "M23.5,1 v20 M15.5,7 h16", "stroke": "#fc4", "stroke-width": 1}), path({"d": "M3.5,41 l20,-20 l20,20", "stroke": "#e42", "stroke-width": 5}), circle({"cx": 23.5, "cy": 40, "r": 8, "fill": "#88f", "stroke-width": 0.5})]), path({"d": "M13.5,70.5 v-10 a10,10 0,0,1 20,0 v10 z", "fill": "#642"})]), // Sanctuary
		symbol({"viewBox": "0 0 100 65"}, [defs(pattern({"id": slow, "x": 15, "y": 12.5, "width": 22, "height": 12, "patternUnits": "userSpaceOnUse"}, [rect({"width": 22, "height": 12, "fill": "#420"}), path({"d": "M0,0 l3,6 h8 l3,-6 h8 l1,2 m0,8 l-1,2 h-8 l-3,-6 m-8,0 l-3,6", "fill": "transparent", "stroke": "#210", "stroke-linecap": "square"})])), path({"d": "M26,43 q-3,-10 -10,-20 q-30,0 0,-20 c30,-10 0,15 20,35 M30,43 q-5,20 0,20 q2.5,0.5 5,0 q5,0 5,-20 M80,43 q5,20 0,20 q-2.5,0.5 -5,0 q-5,0 -5,-20 M80,43 c40,-35 0,-10 -2,-3", "fill": "#080", "stroke": "#000", "stroke-linejoin": "round"}), path({"d": "M25,43 c20,-30 40,-30 60,0 c-20,5 -40,5 -60,0 Z", "fill": `url(#${slow})`, "stroke": "#210", "stroke-linejoin": "round"}), circle({"cx": 20, "cy": 10, "r": 2.5, "fill": "#000"})]), // Slow
		symbol({"viewBox": "0 0 100 100"}, g({"stroke": "#000"}, [circle({"cx": 50, "cy": 50, "r": 49, "fill": "#fc8"}), path({"id": stunnedStar, "d": "M30,40 l3,8.5 h9 l-7,5.5 l2.5,8 l-7.5,-5 l-7.5,5 l2.5,-8.5 l-7,-5.5 h9 z", "fill": "#ff0"}), use({"href": `#${stunnedStar}`, "transform": "translate(40, 0) scale(0.5)", "stroke-width": 1.5}), path({"d": "M50,80 l-1,-8 l16,2 l-2,-16 l16,2 l-1,-8", "fill": "none", "stroke-linecap": "round", "stroke-linejoin": "round"})])), // Stunned
		symbol({"viewBox": "0 0 100 100"}, [defs(path({"id": unconsciousZ, "d": "M3,2 h20 v3 l-15,20 h15 l1,-3 h1 l-1,5 h-20 v-3 l15,-20 h-15 l-1,3 h-1 z", "stroke-width": 1, "stroke": "#000", "fill": "#fff"})), use({"href": `#${unconsciousZ}`, "transform": "scale(1.2) translate(55, 0)"}), use({"href": `#${unconsciousZ}`, "transform": "translate(45, 30)"}), use({"href": `#${unconsciousZ}`, "transform": "scale(0.8) translate(35, 70)"}), use({"href": `#${unconsciousZ}`, "transform": "scale(0.6) translate(25, 130)"})]) // Unconscious
	].map((c, n) => amendNode(c, {"id": conditionIDs[n]}))
]);

if (isAdmin) {
	const isNull = Null(),
	      checkSettings = (() => {
		const tg = Obj({
			"shapechange-categories": Obj({
				"user": isBool,
				"data": Arr(Obj({
					"name": isStr,
					"images": Arr(isBool)
				}))
			}),
			"store-image-shapechanges": Obj({
				"user": isBool,
				"data": Arr(And(Take(isTokenImage, "src", "width", "height", "flip", "flop"), Obj({
					"tokenData": Obj({
						"name":Or(Obj({"user": isBool, "data": isStr}), isNull),
						"5e-ac":Or(Obj({"user": isBool, "data": isUint}), isNull),
						"5e-hp-max":Or(Obj({"user": isBool, "data": isUint}), isNull),
						"5e-hp-current":Or(Obj({"user": isBool, "data": isUint}), isNull)
					}),
					"5e-shapechange-name": isStr
				})))
			})
		      });

		return (v: unknown): Settings5E | null => {
			if (!tg(v)) {
				return null;
			}

			const numTokens = v["store-image-shapechanges"].data.length;

			for (const c of v["shapechange-categories"].data) {
				if (c.images.length > numTokens) {
					c.images.splice(numTokens);
				}

				while (c.images.length < numTokens) {
					c.images.push(false);
				}
			}

			return v;
		};
	      })(),
	      settings: Settings5E = checkSettings(getSettings(importName) as Settings5E) ?? {
		      "shapechange-categories": {"user": false, "data": []},
		      "store-image-shapechanges": {"user": false, "data": []}
	      },
	      initChange = (token: SVGToken) => {
		shell.prompt(lang["INITIATIVE_ENTER"], lang["INITIATIVE_ENTER_LONG"], "0").then(initiative => {
			if (isValidToken(token) && initiative !== null) {
				const init = parseInt(initiative);
				if (isInt(init, -20, 40)) {
					updateInitiative([token.id, init]);
					saveInitiative();
				}
			}
		});
	      },
	      initRemove = (token: SVGToken) => {
		if (isValidToken(token)) {
			updateInitiative([token.id, null]);
			saveInitiative();
		}
	      },
	      initAdd = (token: SVGToken, initMod: null | number, initAdv: boolean) => (initMod !== null ? Promise.resolve(Math.floor((initAdv ? Math.max(Math.random(), Math.random()) : Math.random()) * 20) + 1 + initMod) : shell.prompt(lang["INITIATIVE_ENTER"], lang["INITIATIVE_ENTER_LONG"], "0").then(initiative => {
		if (!initiative) {
			throw new Error("invalid initiative");
		}
		return parseInt(initiative);
	      })).then(initiative => {
		if (isValidToken(token) && isInt(initiative, -20, 40)) {
			updateInitiative([token.id, initiative]);
			saveInitiative();
		}
	      }).catch(() => {}),
	      shapechangeCats = settings["shapechange-categories"].data.map(c => ({"name": c["name"], "images": c["images"].slice()})),
	      shapechangeTokens = settings["store-image-shapechanges"].data.map(cloneObject),
	      isKeyStoreDataStr = Obj({"user": isBool, "data": isStr}),
	      isKeyStoreDataUint = Obj({"user": isBool, "data": isUint}),
	      asInitialToken = (t: Omit<TokenImage, "id" | "x" | "y">): InitialToken => {
		const tokenData: InitialTokenData = {
			"name": null,
			"5e-ac": null,
			"5e-hp-max": null,
			"5e-hp-current": null
		      },
		      {name, "5e-ac": ac, "5e-hp-max": hpMax, "5e-hp-current": hpCurrent} = t.tokenData;
		if (isKeyStoreDataStr(name)) {
			tokenData["name"] = cloneObject(name);
		}
		if (isKeyStoreDataUint(ac)) {
			tokenData["5e-ac"] = cloneObject(ac);
		}
		if (isKeyStoreDataUint(hpMax)) {
			tokenData["5e-hp-max"] = cloneObject(hpMax);
		}
		if (isKeyStoreDataUint(hpCurrent)) {
			tokenData["5e-hp-max"] = cloneObject(hpCurrent);
		}
		return {"src": t["src"], "width": t["width"], "height": t["height"], "flip": t["flip"], "flop": t["flop"], tokenData};
	      },
	      setShapechange = (t: SVGToken5EType, n?: InitialToken) => {
		const tk: TokenSet = {"id": t.id, "tokenData": {}, "removeTokenData": []};
		if (!n) {
			if (!t.tokenData["store-image-5e-initial-token"]) {
				return;
			}
			n = t.tokenData["store-image-5e-initial-token"].data;
			tk.removeTokenData!.push("store-image-5e-initial-token");
		} else if (!t.tokenData["store-image-5e-initial-token"]) {
			tk.tokenData!["store-image-5e-initial-token"] = {"user": false, "data": asInitialToken(t)};
		}
		tk.src = n.src;
		tk.width = n.width;
		tk.height = n.height;
		tk.flip = n.flip;
		tk.flop = n.flop;
		for (const k in tk.tokenData) {
			const v = tk.tokenData[k];
			if (v) {
				tk.tokenData![k] = cloneObject(v);
			} else {
				tk.removeTokenData!.push(k);
			}
		}
		doTokenSet(tk);
		t.updateNode();
		if (initTokens.has(tk.id)) {
			updateInitiative();
		}
	      },
	      addCat = (c: ShapechangeCat, pos = shapechangeCats.length - 1) => {
		const name = span(c.name),
		      t = th([
			name,
			rename({"title": lang["SHAPECHANGE_TOKEN_CATEGORY_RENAME"], "class": itemControl, "onclick": () => shell.prompt(lang["SHAPECHANGE_TOKEN_CATEGORY_RENAME"], lang["SHAPECHANGE_TOKEN_CATEGORY_RENAME_LONG"], c.name).then(newName => {
				if (newName && c.name !== newName) {
					clearNode(name, c.name = newName);
				}
			})}),
			remove({"title": lang["SHAPECHANGE_TOKEN_CATEGORY_REMOVE"], "class": itemControl, "onclick": () => shell.confirm(lang["SHAPECHANGE_TOKEN_CATEGORY_REMOVE"], lang["SHAPECHANGE_TOKEN_CATEGORY_REMOVE_LONG"], "").then(rm => {
				if (rm) {
					shapechangeCats[pos].name = "";
					for (const row of tickers) {
						row[pos].remove();
					}
					t.remove();
				}
			})})
		      ]);
		return t;
	      },
	      addTicker = (row: Uint, col: Uint, state = false) => {
		const t = td([
			labels(input({"class": settingsTicker, "type": "checkbox", "checked": state, "onchange": function(this: HTMLInputElement) {
				shapechangeCats[col]["images"][row] = this.checked;
			}}), "")
		      ]);
		tickers[row].push(t);
		return t;
	      },
	      addToken = (t: ShapechangeToken, row: Uint) => {
		tickers.push([]);
		const name = span(t["5e-shapechange-name"]),
		      r = tr([
			th([
				div({"class": [tokenSelector, tokenSelector5E], "style": "width: 100px; height: 100px"}, [
					button({"title": lang["SHAPECHANGE_CHANGE"], "style": `background-image: url(${imageIDtoURL(t["src"])})`, "onclick": function(this: HTMLButtonElement) {
						const gt = getToken();
						if (gt) {
							const token = asInitialToken(gt);
							shell.confirm(mainLang["TOKEN_REPLACE"], mainLang["TOKEN_REPLACE_CONFIRM"]).then(replace => {
								if (replace) {
									Object.assign(t, token);
									amendNode(this, {"style": {"background-image": imageIDtoURL(t.src)}});
								}
							});
						} else {
							shell.alert(mainLang["TOKEN_SELECT"], mainLang["TOKEN_NONE_SELECTED"]);
						}
					}})
				]),
				br(),
				name,
				rename({"title": lang["SHAPECHANGE_TOKEN_RENAME"], "class": itemControl, "onclick": () => shell.prompt(lang["SHAPECHANGE_TOKEN_RENAME"], lang["SHAPECHANGE_TOKEN_RENAME_LONG"], t["5e-shapechange-name"]).then(newName => {
					if (newName && t["5e-shapechange-name"] !== newName) {
						clearNode(name, t["5e-shapechange-name"] = newName);
					}
				})}),
				remove({"title": lang["SHAPECHANGE_TOKEN_REMOVE"], "class": itemControl, "onclick": () => shell.confirm(lang["SHAPECHANGE_TOKEN_REMOVE"], lang["SHAPECHANGE_TOKEN_REMOVE_LONG"]).then(rm => {
					if (rm) {
						rows[row].remove();
						shapechangeTokens[row]["5e-shapechange-name"] = "";
					}
				})})
			]),
			shapechangeCats.map((c, col) => addTicker(row, col, c["images"][row]))
		      ]);
		rows.push(r);
		return r;
	      },
	      cats = tr([
		td(),
		shapechangeCats.map(addCat)
	      ]),
	      rows: HTMLTableRowElement[] = [],
	      tickers: HTMLTableCellElement[][] = [],
	      ticks = tbody(shapechangeTokens.map(addToken)),
	      shapechangeSettings = windows({"window-icon": `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 2 2"%3E%3Crect width="2" height="2" fill="%23f00"%3E%3Canimate attributeName="rx" values="0;0;1;1;0" dur="16s" repeatCount="indefinite" keyTimes="0;0.375;0.5;0.875;1" /%3E%3Canimate attributeName="fill" values="%23f00;%23f00;%2300f;%2300f;%23f00" dur="16s" repeatCount="indefinite" keyTimes="0;0.375;0.5;0.875;1" /%3E%3C/rect%3E%3C/svg%3E`, "window-title": lang["SHAPECHANGE_TITLE"], "window-data": "shapechange-5e", "resizable": true}, div([
		h1(lang["SHAPECHANGE_TITLE"]),
		button({"onclick": () => shell.prompt(lang["SHAPECHANGE_TOKEN_CATEGORY"], lang["SHAPECHANGE_TOKEN_CATEGORY_LONG"]).then(cat => {
			if (cat) {
				const c = {
					"name": cat,
					"images": Array.from({"length": shapechangeTokens.length}, () => false)
				      },
				      p = shapechangeCats.push(c) - 1;
				amendNode(cats, addCat(c));
				for (let i = 0; i < rows.length; i++) {
					amendNode(rows[i], addTicker(i, p));
				}
			}
		})}, lang["SHAPECHANGE_TOKEN_CATEGORY"]),
		button({"onclick": () => {
			const t = getToken();
			if (t) {
				const token = asInitialToken(t);
				shell.prompt(lang["SHAPECHANGE_TOKEN_NAME"], lang["SHAPECHANGE_TOKEN_NAME_LONG"], selected?.token?.getData("name")).then(name => {
					if (name) {
						const t = Object.assign(token, {"5e-shapechange-name": name}) as ShapechangeToken;
						amendNode(ticks, addToken(t, shapechangeTokens.length));
						shapechangeTokens.push(t);
						for (const cat of shapechangeCats) {
							cat["images"].push(false);
						}
					}
				});
			} else {
				shell.alert(mainLang["TOKEN_SELECT"], mainLang["TOKEN_NONE_SELECTED"]);
			}
		}}, lang["SHAPECHANGE_TOKEN_ADD"]),
		table({"id": shapechangeSettings5E}, [
			thead(cats),
			ticks
		]),
		button({"onclick": () => {
			const cats: ShapechangeCat[] = [],
			      tokens: ShapechangeToken[] = [],
			      valid: boolean[] = [];
			for (const t of shapechangeTokens) {
				if (t["5e-shapechange-name"]) {
					valid.push(true);
					tokens.push(cloneObject(t));
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
			settings["shapechange-categories"] = {"user": false, "data": cats};
			settings["store-image-shapechanges"] = {"user": false, "data": tokens};
			rpc.pluginSetting(importName, settings, []);
		}}, mainLang["SAVE"])
	      ])),
	      [setupHealthButton, cancelHealthButton] = registerKeyEvent("5e-health-key", lang["KEY_HEALTH"], 'h', undefined, () => {
		const {token} = selected;
		if (token instanceof SVGToken5E) {
			const currHP = token.getData("5e-hp-current");
			if (currHP !== null) {
				shell.prompt(lang["HP_CURRENT"], lang["HP_CURRENT_ENTER"], currHP).then(hp => {
					if (hp !== null && isValidToken(token)) {
						const newHP = Math.max(0, parseInt(hp) + (hp.startsWith("+") || hp.startsWith("-") ? currHP : 0));
						if (!isNaN(newHP)) {
							doTokenSet({"id": token.id, "tokenData": {"5e-hp-current": {"user": false, "data": Math.max(0, (parseInt(hp) || 0) + (hp.startsWith("+") || hp.startsWith("-") ? currHP : 0))}}});
						}
					}
				});
			}
		}
	      }),
	      [setupInitiativeButton, cancelInitiativeButton] = registerKeyEvent("5e-initiative-key", lang["KEY_INITIATIVE"], 'i', undefined, () => {
		const {token} = selected;
		if (token instanceof SVGToken5E) {
			if (mapData.data["5e-initiative"] && (mapData as MapData5E).data["5e-initiative"]!.some(ii => ii.id === token.id)) {
				initChange(token);
			} else {
				initAdd(token, token.getData("5e-initiative-mod"), token.getData("5e-initiative-adv") ?? false);
			}
		}
	      }),
	      setCondition = (token: SVGToken | SVGShape | SVGDrawing | null, n: Uint) => {
		if (isValidToken(token)) {
			const data = token.getData("5e-conditions")?.slice() ?? Array.from({"length": conditions.length}, _ => false);
			data[n] = !data[n];
			doTokenSet({"id": token.id, "tokenData": {"5e-conditions": {"user": true, data}}});
		}
	      },
	      conditionKeys = conditions.map((condition, n) => registerKeyEvent("5e-" + condition, bind`${lang["TOGGLE_CONDITION"]}: ${lang[condition]}`, '', undefined, () => setCondition(selected.token, n)));

	add(`.${adminHideLight} #${perspectives5e}`, {
		"display": "none"
	});
	amendNode(plugin["settings"]!.fn, button({"onclick": () => amendNode(shell, shapechangeSettings)}, lang["SHAPECHANGE_5E"]));
	plugin["characterEdit"] = {
		"fn": (n: Node, id: Uint, data: Record<string, KeystoreData> & TokenFields, isCharacter: boolean, changes: Record<string, KeystoreData> & TokenFields, removes: Set<string>) => {
			const getData = !isCharacter && data["store-character-id"] && characterData.has(data["store-character-id"]["data"]) ? (() => {
				const cd = characterData.get(data["store-character-id"]["data"])!;
				return (key: string) => data[key] ?? cd[key] ?? {};
			})() : (key: string) => data[key] ?? {};
			amendNode(n, [
				labels([lang["INITIATIVE_MOD"], ": "], input({"type": "number", "min": -20, "max": 20, "step": 1, "value": getData("5e-initiative-mod")["data"] ?? "", "onchange": function(this: HTMLInputElement) {
					if (this.value === "") {
						removes.add("5e-initiative-mod");
					} else {
						removes.delete("5e-initiative-mod");
						changes["5e-initiative-mod"] = {"user": false, "data": checkInt(parseInt(this.value), -20, 20, 0)};
					}
				}})),
				labels([lang["INITIATIVE_ADV"], ": "], input({"type": "checkbox", "checked": getData("5e-initiative-adv")["data"] ?? false, "onchange": function(this: HTMLInputElement) {
					changes["5e-initiative-adv"] = {"user": false, "data": this.checked};
				}})),
				br(),
				labels([lang["ARMOUR_CLASS"], ": "], input({"type": "number", "min": 0, "max": 50, "step": 1, "value": getData("5e-ac")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-ac"] = {"user": false, "data": checkInt(parseInt(this.value), 0, 50, 0)};
				}})),
				br(),
				labels([lang["HP_CURRENT"], ": "], input({"type": "number", "min": 0, "step": 1, "value": getData("5e-hp-current")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-hp-current"] = {"user": false, "data": checkInt(parseInt(this.value), 0, Infinity, 0)};
				}})),
				br(),
				labels([lang["HP_MAX"], ": "], input({"type": "number", "min": 0, "step": 1, "value": getData("5e-hp-max")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-hp-max"] = {"user": false, "data": checkInt(parseInt(this.value), 0, Infinity, 0)};
				}})),
				br(),
				labels(input({"type": "checkbox", "class": settingsTicker, "checked": getData("5e-player")["data"], "onchange": function (this: HTMLInputElement) {
					changes["5e-player"] = {"user": true, "data": this.checked};
				}}), [lang["IS_PLAYER"], ": "]),
				br(),
				labels([lang["DARKVISION"], ": "], input({"type": "number", "min": 0, "step": 1, "value": getData("5e-darkvision")["data"] ?? 0, "onchange": function(this: HTMLInputElement) {
					changes["5e-darkvision"] = {"user": true, "data": checkInt(parseInt(this.value), 0, Infinity, 0)};
				}})),
				br(),
				labels([lang["NOTES"], ": "], textarea({"rows": 10, "cols": 30, "style": "resize: none", "onchange": function(this: HTMLTextAreaElement) {
					changes["5e-notes"] = {"user": false, "data": this.value};
				}}, getData("5e-notes")["data"] ?? ""))
			]);
			return () => {
				let ui = false,
				    up = false;
				if (!isCharacter) {
					(tokens.get(id)!.token as SVGToken5EType)[updateData]();
					ui = !!changes["name"] && initTokens.has(id);
					up = !!changes["5e-player"];
				} else {
					for (const [, {token}] of tokens) {
						if (token instanceof SVGToken5E && token.tokenData["store-character-id"]?.data === id) {
							token[updateData]();
							if (initTokens.has(token.id)) {
								ui = true;
							}
							if (changes["5e-player"] || changes["5e-darkvision"]) {
								up = true;
							}
						}
					}
				}
				if (ui) {
					updateInitiative();
				} else if (up) {
					updatePerspectives();
				}
			};
		}
	};
	plugin["tokenContext"] = {
		"fn": () => {
			const {token} = selected;
			if (!(token instanceof SVGToken5E)) {
				return [];
			}
			const initMod: number | null = token.getData("5e-initiative-mod"),
			      tokenConditions: boolean[] = token.getData("5e-conditions") ?? [],
			      {"shapechange-categories": {"data": shapechangeCats}, "store-image-shapechanges": {"data": shapechangeTokens}} = settings,
			      ctxList: MenuItems = [];
			if (mapData.data["5e-initiative"] && (mapData as MapData5E).data["5e-initiative"]!.some(ii => ii.id === token.id)) {
				ctxList.push(
					item({"onselect": () => isValidToken(token) && initChange(token)}, lang["INITIATIVE_CHANGE"]),
					item({"onselect": () => isValidToken(token) && initRemove(token)}, lang["INITIATIVE_REMOVE"])
				);
			} else {
				ctxList.push(item({"onselect": () => isValidToken(token) && initAdd(token, initMod, token.getData("5e-initiative-adv") ?? false)}, lang["INITIATIVE_ADD"]));
			}
			ctxList.push(submenu([
				item(lang["CONDITIONS"]),
				menu({"class": conditionList}, conditions.map((c, n) => [c, n] as const).sort(([a], [b]) => stringSort(lang[a] + "", lang[b] + "")).map(([c, n]) => item({"onselect": () => setCondition(token, n), "class": {[hasCondition]: !!tokenConditions[n]}}, lang[c])))
			]));
			if (shapechangeCats && shapechangeCats.length) {
				ctxList.push(submenu([
					item(lang["SHAPECHANGE"]),
					menu([
						token.tokenData["store-image-5e-initial-token"] ? item({"onselect": () => {
							if (isValidToken(token)) {
								setShapechange(token);
							}
						}}, lang["SHAPECHANGE_INITIAL_RESTORE"]) : [],
						shapechangeCats.map(c => submenu([
							item(c.name),
							menu(c.images.map((b, n) => {
								if (b) {
									const newToken = shapechangeTokens[n];
									return item({"onselect": () => {
										if (isValidToken(token)) {
											setShapechange(token, newToken);
										}
									}}, newToken["5e-shapechange-name"]);
								}
								return [];
							}))
						]))
					])
				]));
			}
			return ctxList;
		}
	};
	rpc.waitPluginSetting().when(setting => {
		if (setting["id"] === importName) {
			const setting5e = checkSettings(setting["setting"]);
			if (setting5e) {
				settings["shapechange-categories"] = setting5e["shapechange-categories"];
				settings["store-image-shapechanges"] = setting5e["store-image-shapechanges"];
			}
		}
	});
	tokenSelectedReceive((() => {
		let lastSelectedToken: SVGToken5EType | null = null;
		return () => {
			lastSelectedToken?.[unselect]();
			const {token} = selected;
			if (token instanceof SVGToken5E && !token.isPattern) {
				setupHealthButton();
				setupInitiativeButton();
				for (const [fn] of conditionKeys) {
					fn();
				}
				lastSelectedToken = token;
				token[select]();
			} else {
				cancelHealthButton();
				cancelInitiativeButton();
				for (const [, fn] of conditionKeys) {
					fn();
				}
			}
		}
	})());
} else {
	add(`#${displaySettings5e}`, {
		" thead, td:last-child": {
			"display": "none"
		}
	});
}

addPlugin("5e", plugin);

mapLoadedReceive(() => {
	initiativeWindow.remove();
	queue(async () => {
		for (const [, tk] of tokens) {
			if (tk instanceof SVGToken5E) {
				tk[updateData]();
			}
		}
		clearNode(getLayer("/Light")!.l, [
			use({"href": `#${lighting}`, "style": "mix-blend-mode: saturation", "filter": `url(#${darksatID})`, "clip-path": `url(#${darkvisionID})`}),
			g({"style": "mix-blend-mode: multiply"}, [
				use({"href": `#${lighting}`}),
				use({"href": `#${lighting}`, "filter": `url(#${darkvisID})`, "clip-path": `url(#${darkvisionID})`})
			])
		]);
		updateInitiative();
	});
});

combinedRPC.waitTokenSet().when(ts => {
	const {tokenData, removeTokenData} = ts;
	if (tokenData && (tokenData["5e-initiative"] || tokenData["name"] !== undefined) || removeTokenData && (removeTokenData.includes("5e-initiative") || removeTokenData.includes("name"))) {
		setTimeout(() => {
			if (initTokens.has(ts.id)) {
				updateInitiative();
			}
			(tokens.get(ts.id)!.token as SVGToken5EType)[updateData]();
		}, 0);
		return;
	}
	if (tokenData) {
		for (const key in tokenData) {
			switch (key) {
			case "5e-ac":
			case "5e-hp-max":
			case "5e-hp-current":
			case "5e-conditions":
				setTimeout(() => (tokens.get(ts.id)!.token as SVGToken5EType)[updateData](), 0);
				return;
			}
		}
	}
	if (removeTokenData) {
		for (const key of removeTokenData) {
			switch (key) {
			case "5e-ac":
			case "5e-hp-max":
			case "5e-hp-current":
			case "5e-conditions":
				setTimeout(() => (tokens.get(ts.id)!.token as SVGToken5EType)[updateData](), 0);
				return;
			}
		}
	}
});

combinedRPC.waitMapDataSet().when(changed => {
	if (changed.key === "5e-initiative") {
		setTimeout(updateInitiative, 0);
	}
});

combinedRPC.waitMapDataRemove().when(removed => {
	if (removed === "5e-initiative") {
		initiativeWindow.remove();
	}
});

combinedRPC.waitTokenRemove().when(id => setTimeout(initTokens.has(id) ? updateInitiative : updatePerspectives));

combinedRPC.waitTokenAdd().when(({token: {id}}) => setTimeout(initTokens.has(id) ? updateInitiative : updatePerspectives));

combinedRPC.waitTokenMoveLayerPos().when(({id}) => setTimeout(initTokens.has(id) ? updateInitiative : updatePerspectives));

combinedRPC.waitTokenSet().when(({id}) => setTimeout(initTokens.has(id) ? updateInitiative : updatePerspectives));

combinedRPC.waitTokenSetMulti().when(tks => {
	for (const {id} of tks) {
		if (initTokens.has(id)) {
			setTimeout(updateInitiative);
			return;
		}
	}
	setTimeout(updatePerspectives);
});

for (const k of (["waitLayerShow", "waitLayerHide", "waitLayerRemove"] as (keyof RPCWaits)[])) {
	combinedRPC[k]().when(() => setTimeout(updateInitiative));
}
for (const k of (["waitLayerShift", "waitLayerMove", "waitWallAdded", "waitWallRemoved", "waitWallModified", "waitWallMoved"] as (keyof RPCWaits)[])) {
	combinedRPC[k]().when(() => setTimeout(updatePerspectives));
}

rpc.waitCharacterDataChange().when(({id}) => setTimeout(() => {
	let ui = false;
	for (const [, {token}] of tokens) {
		if (token instanceof SVGToken5E && token.tokenData["store-character-id"]?.data === id) {
			token[updateData]();
			if (!ui && initTokens.has(token.id)) {
				setTimeout(updateInitiative);
				ui = true;
			}
		}
	}
}));

addMapDataChecker((data: Record<string, any>) => {
	for (const key in data) {
		let err = "";
		if (key === "5e-initiative") {
			const val = data[key] as IDInitiative[];
			if (!(val instanceof Array)) {
				err = "Map Data value of 5e-initiative needs to be an array";
			} else {
				for (const i of val) {
					if (!(i instanceof Object)) {
						err = "Map Data value of 5e-initiative needs to be an array of Objects";
						break;
					}
					if (!isInt(i.id, 0)) {
						err = "Map Data value of IDInitiative.id needs to be a Uint";
						break;
					}
					if (!isInt(i.initiative)) {
						err = "Map Data value of 5e-initiative needs to be an Int";
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
			if (!isInt(val, 0, 50)) {
				err = "Character Data '5e-ac' must be a Uint <= 50";
			}
			break;
		case "5e-hp-max":
			if (!isInt(val, 0)) {
				err = "Character Data '5e-hp-max' must be a Uint";
			}
			break;
		case "5e-hp-current":
			if (!isInt(val, 0)) {
				err = "Character Data '5e-hp-current' must be a Uint";
			}
			break;
		case "5e-initiative-adv":
			if (typeof val !== "boolean") {
				err = "Token Data '5e-initiative-adv' must be a boolean";
			}
			break;
		case "5e-initiative-mod":
			if (!isInt(val, -20, 20)) {
				err = "Character Data '5e-initiative-mod' must be an Int between -20 and 20";
			}
			break;
		case "5e-notes":
			if (typeof val !== "string") {
				err = "Character Data '5e-notes' must be a string";
			}
			break;
		case "5e-player":
			if (typeof val !== "boolean") {
				err = "Token Data '5e-player' must be a boolean";
			}
			break;
		case "5e-darkvision":
			if (!isInt(val, 0)) {
				err = "Token Data '5e-darkvision' must be a Uint";
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
			if (!isInt(val, 0, 50)) {
				err = "Token Data '5e-ac' must be a Uint <= 50";
			}
			break;
		case "5e-hp-max":
			if (!isInt(val, 0)) {
				err = "Token Data '5e-hp-max' must be a Uint";
			}
			break;
		case "5e-hp-current":
			if (!isInt(val, 0)) {
				err = "Token Data '5e-hp-current' must be a Uint";
			}
			break;
		case "5e-initiative-adv":
			if (typeof val !== "boolean") {
				err = "Token Data '5e-initiative-adv' must be a boolean";
			}
			break;
		case "5e-initiative-mod":
			if (!isInt(val, -20, 20)) {
				err = "Token Data '5e-initiative-mod' must be an Int between -20 and 20";
			}
			break;
		case "5e-conditions":
			if (!(val instanceof Array) || val.length !== conditions.length || !val.every(b => typeof b === "boolean")) {
				err = "Token Data '5e-conditions' must be a boolean array of correct length";
			}
			break;
		case "5e-player":
			if (typeof val !== "boolean") {
				err = "Token Data '5e-player' must be a boolean";
			}
			break;
		case "5e-darkvision":
			if (!isInt(val, 0)) {
				err = "Token Data '5e-darkvision' must be a Uint";
			}
			break;
		case "store-image-5e-initial-token":
			if (typeof val !== "object") {
				err = "Token Data 'store-image-5e-initial-token' must be an object";
			} else if (!isInt(val["src"], 0)) {
				err = "Token Data 'store-image-5e-initial-token' src must be a Uint";
			} else if (!isInt(val["width"], 0) || !isInt(val["height"], 0)) {
				err = "Token Data 'store-image-5e-initial-token' width & height must be Uints";
			} else if (typeof val["flip"] !== "boolean" || typeof val["flop"] !== "boolean") {
				err = "Token Data 'store-image-5e-initial-token' flip & flop must be boolean";
			}
			break;
		case "5e-notes":
			if (typeof val !== "string") {
				err = "Token Data '5e-notes' must be a string";
			}
			break;
		}
		if (err) {
			delete data[key];
			console.log(new TypeError(err));
		}
	}
});
