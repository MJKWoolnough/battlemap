import {svg} from '../lib/svg.js';
import {isAdmin} from '../shared.js';
import {addTool} from '../tools.js';
import {language} from '../language.js';

if (isAdmin()) {
	const defaultLanguage = {
		"TITLE": "Spell Effects",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage;
	addTool({
		"name": lang["TITLE"],
		"icon": svg()
	});
}
