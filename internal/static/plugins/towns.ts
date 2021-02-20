import {SortNode} from '../lib/ordered.js';
import {div} from '../lib/html.js';
import {addPlugin, getSettings, userLevel} from '../plugins.js';
import {rpc} from '../rpc.js';
import {language} from '../language.js';

type MetaURL = {
	url: string;
}

if (userLevel === 1) {
	const defaultLanguage = {
		"MENU_TITLE": "Towns"
	},
	langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	},
	lang = langs[language.value] ?? defaultLanguage,
        importName = (import.meta as MetaURL).url.split("/").pop()!,
	data = getSettings(importName),
	icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 75"%3E%3Cg id="h"%3E%3Cpath d="M30,50 v-30 l20,-15 l20,15 v30 h-15 v-15 a1,1 0,0,0 -10,0 v15 z" fill="%23ec5" stroke="%23000" /%3E%3Cpolyline points="28,20 30,20 50,4 70,20 72,20" stroke="%23940" fill="none" stroke-width="6"/%3E%3C/g%3E%3Cuse href="%23h" transform="translate(-28, 25)" /%3E%3Cuse href="%23h" transform="translate(28, 25)" /%3E%3C/svg%3E';

	addPlugin("towns", {
		"settings": {
			"priority": 0,
			"fn": () => div()
		},
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div(), true, icon]
		}
	});
}
