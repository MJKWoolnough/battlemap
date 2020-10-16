import {KeystoreData, Uint, Int} from '../types.js';
import {br, button, img, input, label, li, style, ul} from '../lib/html.js';
import {polygon, svg} from '../lib/svg.js';
import {SortNode} from '../lib/ordered.js';
import {addPlugin, userLevel} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken, walkLayers, isSVGLayer, SVGLayer, SVGFolder} from '../map.js';
import {mapLoadedReceive, requestShell, handleError} from '../misc.js';
import mainLang, {language} from '../language.js';
import {windows, WindowElement} from '../windows.js';
import {rpc} from '../rpc.js';
import {characterData, iconSelector, tokenSelector, characterSelector} from '../characters.js';
import {getSymbol} from '../symbols.js';

document.head.appendChild(style({"type": "text/css"}, `
#initiative-list-5e {
	list-style: none;
	padding: 0;
}

.tokenHoverHighlight {
	border: 5px solid #f00;
}
`));

type Initiative = {
	token: SVGToken;
	hidden: boolean;
	node: HTMLLIElement;
}

type InitiativeData = {
	windowOpen: boolean;
	pos: Uint;
	list: [Uint, Uint][];
};

let lastMapChange = 0,
    n = 0;

const langs: Record<string, Record<string, string>> = {
	"en-GB": {
		"ARMOUR_CLASS": "Armour Class",
		"HP_CURRENT": "Current Hit Points",
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
      initAsc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,0 1,2", "style": "fill: currentColor"})),
      initDesc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "2,2 0,2 1,0", "style": "fill: currentColor"})),
      initNext = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,1 0,2", "style": "fill: currentColor"})),
      checkInt = (s: string, min: Int, max: Int, def: Int) => {
	const n = parseInt(s);
	return isNaN(n) ? def : n < min ? min : n > max ? max : n;
      },
      sortAsc = (a: Initiative, b: Initiative) => a.token.getData("5e-initiative") - b.token.getData("5e-Initiative"),
      sortDesc = (a: Initiative, b: Initiative) => b.token.getData("5e-initiative") - a.token.getData("5e-Initiative"),
      isInitiativeData = (data: any): data is InitiativeData => {
	return true;
      },
      initiativeList = new SortNode<Initiative, HTMLUListElement>(ul({"id": "initiative-list-5e"})),
      reorderInitiative = (sorter: (a: Initiative, b: Initiative) => number) => {
	initiativeList.sort(sorter);
	const data = {
		"windowOpen": globals.mapData.data["5e-initiative"]?.["windowOpen"] ?? false,
		"pos": 0,
		"list": initiativeList.map(i => [i.token.getData("5e-initiative-id"), i.token.getData("5e-initiative")])
	};
	rpc.setMapKeyData("5e-initiative", globals.mapData.data["5e-initiative"] = data);
      },
      initiativeWindow = windows({"window-title": lang["INITIATIVE"], "hide-close": true, "hide-maximise": true, "onmouseover": () => initiativeWindow.toggleAttribute("hide-titlebar", false), "onmouseleave": () => initiativeWindow.toggleAttribute("hide-titlebar", true)}, [
	userLevel === 1 ? [
		button({"title": lang["INITIATIVE_ASC"], "onclick": () => reorderInitiative(sortAsc)}, initAsc),
		button({"title": lang["INITIATIVE_DESC"], "onclick": () => reorderInitiative(sortDesc)}, initDesc),
	] : [],
	initiativeList.node,
	userLevel === 1 ? [
		button({"title": lang["INITIATIVE_NEXT"], "onclick": () => initiativeList.push(initiativeList.shift()!)}, initNext)
	] : []
      ]),
      updateInitiative = () => {
	const {mapData: {data: {"5e-initiative": initiative}}} = globals,
	      tokens = new Map<Uint, [boolean, SVGToken]>();
	if (!initiative || !isInitiativeData(initiative["data"]) || (!initiative["data"]["windowOpen"] && userLevel === 0)) {
		return;
	}
	walkLayers((e, isHidden) => {
		for (const t of e.tokens) {
			if (t instanceof SVGToken) {
				const {tokenData: {"5e-initiative-id": initID}} = t;
				if (initID && typeof initID["data"] === "number") {
					tokens.set(initID["data"], [isHidden, t]);
				}
			}
		}
	});
	initiativeList.splice(0, initiativeList.length);
	for (const i of initiative["data"]["list"]) {
		if (tokens.has(i[0])) {
			const [hidden, token] = tokens.get(i[0])!;
			initiativeList.push({
				token,
				hidden,
				node: li({"style": hidden && userLevel === 0 ? "display: none" : undefined, "onmouseover": () => token.node.classList.add("tokenHoverHighlight"), "onmouseleave": () => token.node.classList.remove("tokenHoverHighlight")}, [
					img({"src": `/images/${token.src}`}),
					token.getData("name"),
					i[1].toString()
				])
			});
		}
	}
	if (initiativeList.length && !initiativeWindow.parentNode) {
		requestShell().appendChild(initiativeWindow);
	}
      };

addPlugin("5e", {
	"characterEdit": {
		"priority": 0,
		"fn": (w: WindowElement, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => {
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
					changes["5e-ac"] = {"user": false, "data": checkInt(this.value, 0, 50, 10)};
				}}),
				br(),
				label({"for": `edit_5e_current_${n}`}, `${lang["HP_CURRENT"]}: `),
				input({"type": "number", "id": `edit_5e_ac_${n}`, "min": 0, "step": 1, "value": getData("5e-hp-current")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-hp-current"] = {"user": false, "data": checkInt(this.value, 0, Infinity, 10)};
				}}),
				br(),
				label({"for": `edit_5e_hp_${n}`}, `${lang["HP_MAX"]}: `),
				input({"type": "number", "id": `edit_5e_ac_${n}`, "min": 0, "step": 1, "value": getData("5e-hp-max")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-hp-max"] = {"user": false, "data": checkInt(this.value, 0, Infinity, 10)};
				}}),
				br(),
				button({"onclick": function(this: HTMLButtonElement) {
					this.toggleAttribute("disabled", true);
					save().finally(() => this.removeAttribute("disabled"));
				}}, mainLang["SAVE"])
			];
		}
	},
	"tokenContext": {
		"priority": 0,
		"fn": () => {
			const {selected: {token}} = globals,
			      mapChange = lastMapChange;
			if (!token || !(token instanceof SVGToken)) {
				return [];
			}
			if (token.tokenData["5e-initiative-id"]) {
				return [
					item(lang["INITIATIVE_CHANGE"], () => {}),
					item(lang["INITIATIVE_REMOVE"], () => {})
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
				const change = {"5e-initiative": {"user": true, "data": initiative}};
				Object.assign(token.tokenData, change);
				rpc.tokenModify(token.id, change, []).catch(handleError);
			}).catch(() => {}))];
		}
	}
});

mapLoadedReceive(() => {
	lastMapChange = Date.now();
	initiativeWindow.remove();
	updateInitiative();
});

rpc.waitTokenDataChange().then(changed => {
	const initiative = changed["setting"]["5e-initiative"];
	if (initiative) {
		// update initiative list
	}
});
