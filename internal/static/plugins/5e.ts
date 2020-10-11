import {KeystoreData, Uint, Int} from '../types.js';
import {br, button, input, label} from '../lib/html.js';
import {addPlugin} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken} from '../map.js';
import {mapLoadedReceive, requestShell, handleError} from '../misc.js';
import mainLang, {language} from '../language.js';
import {windows, WindowElement} from '../windows.js';
import {rpc} from '../rpc.js';
import {characterData, iconSelector, tokenSelector, characterSelector} from '../characters.js';
import {getSymbol} from '../symbols.js';

let iWindow: WindowElement | null = null,
    lastMapChange = 0,
    n = 0;

const langs: Record<string, Record<string, string>> = {
	"en-GB": {
		"ARMOUR_CLASS": "Armour Class",
		"HP_CURRENT": "Current Hit Points",
		"HP_MAX": "Maximum Hit Points",
		"INITIATIVE": "Initiative",
		"INITIATIVE_ADD": "Add Initiative",
		"INITIATIVE_CHANGE": "Change Initiative",
		"INITIATIVE_ENTER": "Enter initiative",
		"INITIATIVE_ENTER_LONG": "Please enter the initiative value for this token",
		"INITIATIVE_MOD": "Initiative Mod",
		"INITIATIVE_REMOVE": "Remove Initiative",
		"NAME": "Character Name",
	}
      },
      lang = langs[Object.keys(langs).includes(language.value) ? language.value : "en-GB"],
      userVisibility = getSymbol("userVisibility")!,
      checkInt = (s: string, min: Int, max: Int, def: Int) => {
	const n = parseInt(s);
	return isNaN(n) ? def : n < min ? min : n > max ? max : n;
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
					label(lang["CHARACTER_IMAGE"]),
					iconSelector(data, changes),
					br(),
					label(`${lang["TOKEN"]}: `),
					tokenSelector(windows(), data, changes, removes)
				] : [
					label(lang["CHARACTER"]),
					characterSelector(data, changes)
				],
				br(),
				label({"for": `edit_5e_initiative_${n}`}, `${lang["INITIATIVE_MOD"]}: `),
				input({"type": "number", "id": `edit_5e_initiative_${n}`, "min": -20, "max": 20, "step": 1, "value": getData("5e-initiative-mod")["data"] ?? 0, "onchange": function(this: HTMLInputElement) {
					changes["5e-initiative-mod"] = {"user": false, "data": checkInt(this.value, -20, 20, 0)};
				}}),
				br(),
				label({"for": `edit_5e_ac_${n}`}, `${lang["ARMOUR_CLASS"]}: `),
				input({"type": "number", "id": `edit_5e_ac_${n}`, "min": 0, "max": 50, "step": 1, "value": getData("5e-ac")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-ac"] = {"user": false, "data": checkInt(this.value, 0, 50, 10)};
				}}),
				br(),
				label({"for": `edit_5e_current_${n}`}, `${lang["HIT_POINTS_CURRENT"]}: `),
				input({"type": "number", "id": `edit_5e_ac_${n}`, "min": 0, "step": 1, "value": getData("5e-hp-current")["data"] ?? 10, "onchange": function(this: HTMLInputElement) {
					changes["5e-hp-current"] = {"user": false, "data": checkInt(this.value, 0, Infinity, 10)};
				}}),
				br(),
				label({"for": `edit_5e_hp_${n}`}, `${lang["HIT_POINTS_MAX"]}: `),
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

mapLoadedReceive(isAdmin => {
	lastMapChange = Date.now();
	if (iWindow) {
		iWindow.remove();
	}
	const {mapData: {data: {"5e-initiative": initiative}}} = globals;
	if (!initiative || (!initiative["window-open"] && !isAdmin)) {
		return;
	}
	requestShell().addWindow(iWindow = windows({"window-title": lang["INITIATIVE"], "hide-close": true, "hide-maximise": true}));
});

rpc.waitTokenDataChange().then(changed => {
	const initiative = changed["setting"]["5e-initiative"];
	if (initiative) {
		// update initiative list
	}
});
