import {Uint} from '../types.js';
import {SortNode} from '../lib/ordered.js';
import {div} from '../lib/html.js';
import {addPlugin, getSettings} from '../plugins.js';
import {isUint, isAdmin} from '../misc.js';
import {rpc} from '../rpc.js';
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
}

if (isAdmin()) {
	const defaultLanguage = {
		"MENU_TITLE": "Towns",
		"PROFESSIONS_EDIT": "Edit Professions",
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
	      icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 75"%3E%3Cg id="h"%3E%3Cpath d="M30,50 v-30 l20,-15 l20,15 v30 h-15 v-15 a1,1 0,0,0 -10,0 v15 z" fill="%23ec5" stroke="%23000" /%3E%3Cpolyline points="28,20 30,20 50,4 70,20 72,20" stroke="%23940" fill="none" stroke-width="6"/%3E%3C/g%3E%3Cuse href="%23h" transform="translate(-28, 25)" /%3E%3Cuse href="%23h" transform="translate(28, 25)" /%3E%3C/svg%3E';

	addPlugin("towns", {
		"settings": {
			"priority": 0,
			"fn": div()
		},
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div(), true, icon]
		}
	});
}
