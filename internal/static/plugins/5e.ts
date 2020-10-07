import {KeystoreData, Uint} from '../types.js';
import {addPlugin} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken} from '../map.js';
import {mapLoadedReceive, requestShell, handleError} from '../misc.js';
import mainLang, {language} from '../language.js';
import {windows, WindowElement} from '../windows.js';
import {rpc} from '../rpc.js';

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
			return [item(lang["INITIATIVE_ADD"], () => (initMod !== null ? Promise.resolve(Math.ceil(Math.random() * 20) + initMod) : requestShell().prompt(lang["INITIATIVE_ENTER"], lang["INITIATIVE_ENTER_LONG"], "0").then(initiative => {
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

let iWindow: WindowElement | null = null,
    lastMapChange = 0;

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
