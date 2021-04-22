import {svg, g, path, use} from '../lib/svg.js';
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
	      lang = langs[language.value] ?? defaultLanguage,
	      sparkID = "plugin-spell-spark";
	addTool({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 100 100"}, g({"style": "fill: currentColor; stroke: currentColor"}, [
			path({"d": "M60,35 v70 h-20 v-100 h20 v30 h-20 v-30 h20", "fill-rule": "evenodd", "transform": "rotate(-45, 50, 50)"}),
			path({"d": "M50,10 q0,10 10,10 q-10,0 -10,10 q0,-10 -10,-10 q10,0 10,-10", "id": sparkID}),
			use({"href": `#${sparkID}`, "transform": "translate(5, 0) scale(1.5)"}),
			use({"href": `#${sparkID}`, "transform": "translate(-45, 30) scale(1.2)"}),
			use({"href": `#${sparkID}`, "transform": "translate(-30, -5) scale(0.8)"}),
		])),
	});
}
