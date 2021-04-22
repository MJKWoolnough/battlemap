import {br, div, input, label} from '../lib/html.js';
import {svg, g, path, title, use} from '../lib/svg.js';
import {isAdmin} from '../shared.js';
import {addTool} from '../tools.js';
import {language} from '../language.js';

if (isAdmin()) {
	const defaultLanguage = {
		"SPELL_SIZE": "Spell Size",
		"SPELL_TYPE_CIRCLE": "Circle Spell",
		"SPELL_TYPE_CONE": "Cone Spell",
		"SPELL_TYPE_CUBE": "Cube Spell",
		"TITLE": "Spell Effects",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      sparkID = "plugin-spell-spark",
	      circleSpell = input({"type": "radio", "id": "plugin-spell-type-circle", "name": "plugin-spell-type", "checked": true}),
	      coneSpell = input({"type": "radio", "id": "plugin-spell-type-cone", "name": "plugin-spell-type"}),
	      cubeSpell = input({"type": "radio", "id": "plugin-spell-type-cube", "name": "plugin-spell-type"}),
	      size = input({"type": "number", "id": "plugin-spell-size", "min": 0, "value": 10});
	addTool({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 100 100"}, [
			title(lang["TITLE"]),
			g({"style": "fill: currentColor; stroke: currentColor"}, [
				path({"d": "M60,35 v70 h-20 v-100 h20 v30 h-20 v-30 h20", "fill-rule": "evenodd", "transform": "rotate(-45, 50, 50)"}),
				path({"d": "M50,10 q0,10 10,10 q-10,0 -10,10 q0,-10 -10,-10 q10,0 10,-10", "id": sparkID}),
				use({"href": `#${sparkID}`, "transform": "translate(5, 0) scale(1.5)"}),
				use({"href": `#${sparkID}`, "transform": "translate(-45, 30) scale(1.2)"}),
				use({"href": `#${sparkID}`, "transform": "translate(-30, -5) scale(0.8)"}),
			]),
		]),
		"options": div([
			label({"for": "plugin-spell-type-circle"}, `${lang["SPELL_TYPE_CIRCLE"]}: `),
			circleSpell,
			br(),
			label({"for": "plugin-spell-type-cone"}, `${lang["SPELL_TYPE_CONE"]}: `),
			coneSpell,
			br(),
			label({"for": "plugin-spell-type-cube"}, `${lang["SPELL_TYPE_CUBE"]}: `),
			cubeSpell,
			br(),
			label({"for": "plugin-spell-size"}, `${lang["SPELL_SIZE"]}: `),
			size
		]),
	});
}
