import {addPlugin} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken} from '../map.js';
import {language} from '../language.js';

const langs: Record<string, Record<string, string>> = {
	"en-GB": {
		"INITIATIVE_ADD": "Add Initiative",
		"INITIATIVE_CHANGE": "Change Initiative",
		"INITIATIVE_REMOVE": "Remove Initiative"
	}
      },
      lang = langs[Object.keys(langs).includes(language.value) ? language.value : "en-GB"];

addPlugin("5e", {
	"tokenContext": {
		"priority": 0,
		"fn": () => {
			const {selected: {token}} = globals;
			if (!token || !(token instanceof SVGToken)) {
				return [];
			}
			if (token.tokenData["initiative-id"]) {
				return [
					item(lang["INITIATIVE_CHANGE"], () => {}),
					item(lang["INITIATIVE_REMOVE"], () => {})
				];
			}
			return [item(lang["INITIATIVE_ADD"], () => {})];
		}
	}
});
