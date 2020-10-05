import {KeystoreData, Uint} from '../types.js';
import {addPlugin} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken} from '../map.js';
import {mapLayersReceive, requestShell} from '../misc.js';
import {language} from '../language.js';
import {windows} from '../windows.js';

const langs: Record<string, Record<string, string>> = {
	"en-GB": {
		"INITIATIVE": "Initiative",
		"INITIATIVE_ADD": "Add Initiative",
		"INITIATIVE_CHANGE": "Change Initiative",
		"INITIATIVE_REMOVE": "Remove Initiative"
	}
      },
      lang = langs[Object.keys(langs).includes(language.value) ? language.value : "en-GB"];

addPlugin("5e", {
	"characterEdit": {
		"priority": 0,
		"fn": (id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => {
			return null;
		}
	},
	"tokenContext": {
		"priority": 0,
		"fn": () => {
			const {selected: {token}} = globals;
			if (!token || !(token instanceof SVGToken)) {
				return [];
			}
			if (token.tokenData["5e-initiative-id"]) {
				return [
					item(lang["INITIATIVE_CHANGE"], () => {}),
					item(lang["INITIATIVE_REMOVE"], () => {})
				];
			}
			return [item(lang["INITIATIVE_ADD"], () => {})];
		}
	}
});

mapLayersReceive(() => {
	const {mapData: {data: {"5e-initiative": initiative}}} = globals;
	if (!initiative && !initiative["window-open"]) {
		return;
	}
	requestShell().addWindow(windows({"window-title": lang["INITIATIVE"]}));
});
