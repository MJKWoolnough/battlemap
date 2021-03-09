import {addPlugin} from '../plugins.js';
import {div} from '../lib/html.js';
import {isAdmin} from '../shared.js';
import {language} from '../language.js';

if (isAdmin()) {
	const defaultLanguage = {
		"MENU_TITLE": "Notes"
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		      "en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 96"%3E%3Crect x="60" y="6" width="24" height="90" fill="%23888" rx="10" /%3E%3Crect x="1" y="6" width="80" height="90" stroke="%23000" fill="%23fff" rx="10" /%3E%3Cg id="h"%3E%3Ccircle cx="16" cy="11" r="2" fill="%23333" /%3E%3Cellipse cx="15" cy="6" rx="3" ry="5" stroke="%23aaa" stroke-width="2" fill="none" stroke-dasharray="0 5 15" /%3E%3C/g%3E%3Cuse href="%23h" x="10" /%3E%3Cuse href="%23h" x="20" /%3E%3Cuse href="%23h" x="30" /%3E%3Cuse href="%23h" x="40" /%3E%3Cuse href="%23h" x="50" /%3E%3Cpath d="M11,25 h60 M11,40 h60 M11,55 h60 M11,70 h30" stroke="%23000" stroke-width="4" stroke-linecap="round" /%3E%3C/svg%3E';

	addPlugin("notes", {
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div(), true, icon]
		}
	});
}
