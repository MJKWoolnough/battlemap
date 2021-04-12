import {div} from '../lib/html.js';
import {addPlugin} from '../plugins.js';
import {language} from '../language.js';

const defaultLanguage = {
	"PLUGIN_NAME": "Beyond"
      },
      langs: Record<string, typeof defaultLanguage> = {
	"en-GB": defaultLanguage
      },
      lang = langs[language.value] ?? defaultLanguage;

addPlugin(lang["PLUGIN_NAME"], {
	"menuItem": {
		"priority": 0,
		"fn": [lang["PLUGIN_NAME"], div(), true, ""]
	}
});
