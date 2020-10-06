import {KeystoreData, Uint} from '../types.js';
import {addPlugin} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken} from '../map.js';
import {mapLoadedReceive, requestShell} from '../misc.js';
import {language} from '../language.js';
import {windows, WindowElement} from '../windows.js';

const langs: Record<string, Record<string, string>> = {
	"en-GB": {
		"INITIATIVE": "Initiative",
		"INITIATIVE_ADD": "Add Initiative",
		"INITIATIVE_CHANGE": "Change Initiative",
		"INITIATIVE_ENTER": "Enter initiative",
		"INITIATIVE_ENTER_LONG": "Please enter the initiative value for this token",
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
			return [item(lang["INITIATIVE_ADD"], () => (token.tokenData["5e-initiative-mod"] ? Promise.resolve(Math.ceil(Math.random() * 20) + token.tokenData["5e-initiative-mod"]["data"] as number) : requestShell().prompt(lang["INITIATIVE_ENTER"], lang["INITIATIVE_ENTER_LONG"], "0").then(initiative => {
				if (!initiative) {
					throw new Error("invalid initiative");
				}
				return parseInt(initiative);
			})).then(initiative => {

			}).catch(() => {}))];
		}
	}
});

let iWindow: WindowElement | null = null;

mapLoadedReceive(isAdmin => {
	if (iWindow) {
		iWindow.remove();
	}
	const {mapData: {data: {"5e-initiative": initiative}}} = globals;
	if (!initiative || (!initiative["window-open"] && !isAdmin)) {
		return;
	}
	requestShell().addWindow(iWindow = windows({"window-title": lang["INITIATIVE"]}));
});
