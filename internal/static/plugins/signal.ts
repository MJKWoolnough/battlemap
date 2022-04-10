import {svg} from '../lib/svg.js';
import {language} from '../language.js';
import {isAdmin} from '../rpc.js';
import {addTool} from '../tools.js';

if (isAdmin) {
	const defaultLanguage = {
		"TITLE": "Signal",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		      "en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage;
	addTool({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 100 100"}),
		"mapMouse1": (e: MouseEvent) => {
			return false;
		}
	});
}
