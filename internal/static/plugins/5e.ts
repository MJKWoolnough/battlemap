import {KeystoreData, Uint, Int, MapData} from '../types.js';
import {br, button, div, img, input, label, li, span, style, ul} from '../lib/html.js';
import {polygon, svg} from '../lib/svg.js';
import {SortNode, noSort} from '../lib/ordered.js';
import {addPlugin, userLevel} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken, walkLayers, isSVGLayer, SVGLayer, SVGFolder} from '../map.js';
import {mapLoadedReceive, requestShell, handleError} from '../misc.js';
import mainLang, {language} from '../language.js';
import {windows, WindowElement} from '../lib/windows.js';
import {rpc} from '../rpc.js';
import {characterData, iconSelector, tokenSelector, characterSelector} from '../characters.js';
import {getSymbol} from '../symbols.js';
import {StringSetting} from '../settings_types.js';

document.head.appendChild(style({"type": "text/css"}, `
.isAdmin #initiative-window-5e {
	display: grid;
	grid-template-rows: 2em auto 2em;
}

#initiative-window-5e svg {
	width: 1.5em;
}

#initiative-ordering-5e button, #initiative-next-5e button {
	height: 2em;
}

#initiative-list-5e {
	list-style: none;
	padding: 0;
}

#initiative-list-5e img {
	height: 4em;
	width: 4em;
}

.tokenHoverHighlight {
	border: 5px solid #f00;
}
`));

type IDInitiative = {
	id: Uint;
	initiative: Uint;
}

type Token5E = SVGToken & {
	tokenData: {
		"name"?: KeystoreData<string>;
		"5e-initiative"?: KeystoreData<IDInitiative>;
	}
}

type Initiative = {
	token: Token5E;
	hidden: boolean;
	node: HTMLLIElement;
}

type InitiativeData = Uint[];

type MapData5E = MapData & {
	data: {
		"5e-initiative"?: Uint[];
	}
}

let lastMapChange = 0,
    n = 0,
    lastInitiativeID = 0;

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
      initAsc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "2,2 0,2 1,0", "style": "fill: currentColor"})),
      initDesc = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,0 1,2", "style": "fill: currentColor"})),
      initNext = svg({"viewBox": "0 0 2 2"}, polygon({"points": "0,0 2,1 0,2", "style": "fill: currentColor"})),
      checkInt = (s: string, min: Int, max: Int, def: Int) => {
	const n = parseInt(s);
	return isNaN(n) ? def : n < min ? min : n > max ? max : n;
      },
      sortAsc = (a: Initiative, b: Initiative) => a.token.tokenData["5e-initiative"]!.data.initiative - b.token.tokenData["5e-initiative"]!.data.initiative,
      sortDesc = (a: Initiative, b: Initiative) => b.token.tokenData["5e-initiative"]!.data.initiative - a.token.tokenData["5e-initiative"]!.data.initiative,
      isInitiativeData = (data: any): data is InitiativeData => data instanceof Array && data.every(i => typeof i === "number"),
      initiativeList = new SortNode<Initiative, HTMLUListElement>(ul({"id": "initiative-list-5e"})),
      saveInitiative = () => rpc.setMapKeyData("5e-initiative", (globals.mapData as MapData5E).data["5e-initiative"] = initiativeList.map(i => i.token.tokenData["5e-initiative"]!.data.id)),
      savedWindowSetting = new StringSetting("5e-window-data"),
      savedWindowData = JSON.parse(savedWindowSetting.value || "[0, 0, 200, 400]") as [Int, Int, Uint, Uint],
      initiativeWindow = windows({"window-title": lang["INITIATIVE"], "--window-left": savedWindowData[0] + "px", "--window-top": savedWindowData[1] + "px", "--window-width": savedWindowData[2] + "px", "--window-height": savedWindowData[3] + "px", "hide-close": true, "hide-maximise": true, "hide-minimise": userLevel === 0, "resizable": true, "onmouseover": () => initiativeWindow.toggleAttribute("hide-titlebar", false), "onmouseleave": () => initiativeWindow.toggleAttribute("hide-titlebar", true), }, div({"id": "initiative-window-5e"}, [
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
	if (!isInitiativeData(initiative)) {
		return;
	}
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
				node: li({"style": hidden && userLevel === 0 ? "display: none" : undefined, "onmouseover": () => token.node.classList.add("tokenHoverHighlight"), "onmouseleave": () => token.node.classList.remove("tokenHoverHighlight")}, [
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
      mo = new MutationObserver(list => {
	for (const m of list) {
		if (m.target === initiativeWindow) {
			savedWindowSetting.set(`[${parseInt(initiativeWindow.style.getPropertyValue("--window-left"))}, ${parseInt(initiativeWindow.style.getPropertyValue("--window-top"))}, ${parseInt(initiativeWindow.style.getPropertyValue("--window-width"))}, ${parseInt(initiativeWindow.style.getPropertyValue("--window-height"))}]`);
		}
	}
      });

mo.observe(initiativeWindow, {"attributeFilter": ["style"], "attributes": true});

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
					const updateName = changes["name"];
					save().finally(() => {
						this.removeAttribute("disabled");
						if (updateName && data["5e-initiative"] !== undefined) {
							updateInitiative();
						}
					});
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
			if (token.tokenData["5e-initiative"]) {
				return [
					item(lang["INITIATIVE_CHANGE"], () => {
						if (token.tokenData["5e-initiative"]) {
							requestShell().prompt(lang["INITIATIVE_ENTER"], lang["INITIATIVE_ENTER_LONG"], token.tokenData["5e-initiative"].data.initiative.toString()).then(initiative => {
								if (token.tokenData["5e-initiative"]) {
									token.tokenData["5e-initiative"].data.initiative = initiative;
									rpc.tokenModify(token.id, { "5e-initiative": {"user": true, "data": token.tokenData["5e-initiative"].data}}, []);
									updateInitiative();
								}
							});
						}
					}),
					item(lang["INITIATIVE_REMOVE"], () => {
						initiativeList.filterRemove(i => i.token === token);
						if (initiativeList.length === 0) {
							initiativeWindow.remove();
						}
						delete(token.tokenData["5e-initiative"]);
						rpc.tokenModify(token.id, {}, ["5e-initiative"]);
						saveInitiative();
					})
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
	}
});

mapLoadedReceive(() => {
	lastMapChange = Date.now();
	initiativeWindow.remove();
	lastInitiativeID = 0;
	updateInitiative();
});

rpc.waitTokenDataChange().then(changed => {
	if (changed["setting"]["5e-initiative"] || changed["setting"]["name"] !== undefined || changed["removing"].includes("5e-initiative") || changed["removing"].includes("name")) {
		setTimeout(updateInitiative, 0);
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
