import type {WindowElement} from '../windows.js';
import {clearElement, createHTML} from '../lib/dom.js';
import {a, br, button, div, input, label} from '../lib/html.js';
import {addPlugin} from '../plugins.js';
import mainLang, {language} from '../language.js';
import {enterKey} from '../shared.js';
import {shell} from '../windows.js';

let beyondWindow: WindowElement | null = null;

const defaultLanguage = {
	"BEYOND_ID": "Beyond ID",
	"BEYOND_INVALID_ID": "Invalid ID",
	"BEYOND_INVALID_ID_LONG": "Unable to determine Beyond ID, please re-enter",
	"BEYOND_LOAD": "Load Beyond Data",
	"ERROR_INVALID_FILE": "Invalid Beyond JSON file",
	"DOWNLOAD": "Download Beyond Data",
	"PLUGIN_NAME": "Beyond",
	"UPLOAD": "Upload Beyond Data"
      },
      langs: Record<string, typeof defaultLanguage> = {
	"en-GB": defaultLanguage
      },
      lang = langs[language.value] ?? defaultLanguage,
      icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 950"%3E%3Crect width="100%25" height="100%25" fill="%23000" /%3E%3Cpath d="M30,35 l78,81 v276 h-106 l107,137 v302 l-78,81 h553 c104,0 194,-18 257,-56 c63,-38 93,-92 93,-165 v-50 c-1,-42 -17,-80 -49,-112 c-33,-32 -77,-56 -134,-72 c23,-6 44,-15 63,-27 c20,-12 35,-24 48,-39 s23,-30 30,-47 c8,-15 11,-30 11,-45 v-29 c0,-35 -8,-68 -24,-96 c-17,-29 -39,-54 -69,-74 c-30,-21 -72,-36 -114 -48 c-42,-11 -89,-17 -140,-17 z M333,163 h141 c41,0 74,6 99,18 c26,12 38,25 38,68 v29 c0,26 -9,45 -29,60 c-20,15 -45,23 -78,23 h-171 z M333,558 h179 c33,0 62,8 89,23 c26,15 39,35 39,60 v42 c0,18 -3,33 -11,44 c-8,11 -17,20 -29,27 c-12,6 -26,11 -42,14 c-17,2 -33,3 -50,3 h-176 z" fill="%23f00" stroke="%23000" /%3E%3C/svg%3E',
      handleError = (title: string, message: string) => (beyondWindow ?? shell).alert(title, message, icon),
      baseDiv = div({"onpopout": (e: CustomEvent) => beyondWindow = e.detail, "onpopin": () => beyondWindow = null}),
      noData = (() => {
	const beyondID = input({"id": "plugin-beyond-id", "type": "text", "onkeypress": enterKey}),
	      urlReg = /\/characters?\/([0-9]+)(\/json)?$/,
	      contents = [
		label({"for": "plugin-beyond-id"}, `${lang["BEYOND_ID"]}: `),
		beyondID,
		button({"onclick": () => {
			const urlMatch = beyondID.value.match(urlReg),
			      id = parseInt(urlMatch ? beyondID.value = urlMatch[1] : beyondID.value);
			if (id + "" === beyondID.value) {
				createHTML(clearElement(baseDiv), [
					a({"href": `https://www.dndbeyond.com/character/${id}/json`, "download": "beyond.json"}, lang["DOWNLOAD"]),
					br(),
					label({"for": "plugin-beyond-upload"}, lang["UPLOAD"]),
					input({"id": "plugin-beyond-upload", "type": "file", "style": "display: none", "onchange": function(this: HTMLInputElement) {
						if (!this.files || !this.files[0]) {
							handleError(mainLang["ERROR"], lang["ERROR_INVALID_FILE"]);
						} else {
							this.files[0].text().then(d => {
								const data = JSON.parse(d);
								if (typeof data !== "object") {
									throw -1;
								}
								if (typeof data["name"] !== "string") {
									throw -2;
								}
							}).catch(() => handleError(mainLang["ERROR"], lang["ERROR_INVALID_FILE"]));
						}
					}})
				]);
			} else {
				handleError(lang["BEYOND_INVALID_ID"], lang["BEYOND_INVALID_ID_LONG"]);
			}
		}}, lang["BEYOND_LOAD"])
	      ];
	return () => createHTML(clearElement(baseDiv), contents);
      })();

noData();

addPlugin(lang["PLUGIN_NAME"], {
	"menuItem": {
		"priority": 0,
		"fn": [lang["PLUGIN_NAME"], baseDiv, true, icon],
	}
});
