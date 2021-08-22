import type {Uint} from '../types.js';
//import {NodeArray} from '../lib/nodes.js';
import {clearElement} from '../lib/dom.js';
import {createHTML, br, button, div, h1, input, label, table, tbody, td, th, thead, tr} from '../lib/html.js';
import {addPlugin, getSettings} from '../plugins.js';
import {shell, windows} from '../windows.js';
import {getSymbol} from '../symbols.js';
import {isUint, isAdmin} from '../shared.js';
//import {rpc} from '../rpc.js';
import {language} from '../language.js';

type MetaURL = {
	url: string;
}

type rolledAmount = [Uint, Uint, Uint];

type Settings = {
	profs: Record<string, {
		priority: Uint;
		money: rolledAmount;
	}>;
	species: Record<string, {
		prority: Uint;
		age: [Uint, Uint];
		skin: Record<string, Uint>;
		hair: Record<string, Uint>;
		height: rolledAmount;
		weight: rolledAmount;
	}>;
}

if (isAdmin) {
	const defaultLanguage = {
		"MENU_TITLE": "Towns",
		"MONEY": "Wealth",
		"PRIORITY": "Priority",
		"PROFESSION": "Profession",
		"PROFESSIONS_EDIT": "Edit Professions",
		"PROFESSION_REMOVE": "Remove Profession",
		"SPECIES_EDIT": "Edit Species"
	},
	      langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
              importName = (import.meta as MetaURL).url.split("/").pop()!,
	      isRolledAmount = (data: any): data is rolledAmount => data instanceof Array && data.length === 3 && isUint(data[0]) && isUint(data[0]) && isUint(data[2]),
	      checkSettings = (data: any) => {
		const s = {"profs": {}} as Settings;
		if (data["profs"]) {
			for (const p in data["profs"]) {
				const d = data["profs"][p];
				if (!d || !isUint(d["priority"]) || !isRolledAmount(d["money"])) {
					continue
				}
				s["profs"][p] = {"priority": d["prority"], "money": d["money"]};
			}
		}
		return s;
	      },
	      data = checkSettings(getSettings(importName)),
	      //working = JSON.parse(JSON.stringify(data)),
	      icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 75"%3E%3Cg id="h"%3E%3Cpath d="M30,50 v-30 l20,-15 l20,15 v30 h-15 v-15 a1,1 0,0,0 -10,0 v15 z" fill="%23ec5" stroke="%23000" /%3E%3Cpolyline points="28,20 30,20 50,4 70,20 72,20" stroke="%23940" fill="none" stroke-width="6"/%3E%3C/g%3E%3Cuse href="%23h" transform="translate(-28, 25)" /%3E%3Cuse href="%23h" transform="translate(28, 25)" /%3E%3C/svg%3E',
	      remove = getSymbol("remove")!,
	      speciesWindow = windows({"window-data": "towns-species", "window-title": lang["SPECIES_EDIT"], "window-icon": icon, "resizable": true}, [

	      ]),
	      profWindow = windows({"window-data": "towns-profs", "window-title": lang["PROFESSIONS_EDIT"], "window-icon": icon, "resizable": true});

	addPlugin("towns", {
		"settings": {
			"priority": 0,
			"fn": div([
				button({"onclick": () => shell.appendChild(speciesWindow)}, lang["SPECIES_EDIT"]),
				br(),
				button({"onclick": () => shell.appendChild(createHTML(clearElement(profWindow), [
					h1(lang["PROFESSIONS_EDIT"]),
					table([
						thead(tr([
							th(lang["PROFESSION"]),
							th(lang["MONEY"]),
							th(lang["PRIORITY"]),
							th(remove({"title": lang["PROFESSION_REMOVE"]}))
						])),
						tbody(Object.entries(data["profs"]).map(([p, {priority, money}], n) => {
							console.log(priority, money, n)
							const moneyBase = input(),
							      moneyAdd = input(),
							      moneyMul = input(),
							      weight = input();
							return tr([
								td(p),
								td([
									moneyBase,
									' + ',
									moneyAdd,
									'd',
									moneyMul
								]),
								td(label(weight)), // remove label
								td(input()),
							]);
						}))
					])
				]))}, lang["PROFESSIONS_EDIT"]),
			])
		},
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div(), true, icon]
		}
	});
}
