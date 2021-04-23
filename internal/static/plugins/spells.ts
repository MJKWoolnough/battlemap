import type {Uint} from '../types.js';
import {br, div, input, label} from '../lib/html.js';
import {createSVG, svg, circle, g, path, rect, title, use} from '../lib/svg.js';
import {checkInt, isAdmin} from '../shared.js';
import {addTool} from '../tools.js';
import {defaultMouseWheel, screen2Grid} from '../tools_default.js';
import {autosnap} from '../settings.js';
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
	      conePathStr = (n: Uint) => `M${n / 2},${n} L0,0 q${n/2},-${n * 0.425} ${n},0 z`,
	      circleEffect = svg({"viewBox": "0 0 10 10", "stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "width": 10, "height": 10}, circle({"cx": "50%", "cy": "50%", "r": "50%"})),
	      conePath = path({"d": conePathStr(10)}),
	      coneEffect = svg({"viewBox": "0 0 10 10", "stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "width": 10, "height": 10}, conePath),
	      cubeEffect = svg({"viewBox": "0 0 10 10", "stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "width": 10, "height": 10}, rect({"width": "100%", "height": "100%"})),
	      size = input({"type": "number", "id": "plugin-spell-size", "min": 0, "value": 10, "onchange": () => {
		const s = checkInt(parseInt(size.value), 1, 1000, 10),
		      params = {"viewBox": `0 0 ${s} ${s}`, "width": s, "height": s};
		createSVG(circleEffect, params);
		createSVG(coneEffect, params);
		conePath.setAttribute("d", conePathStr(s));
		createSVG(cubeEffect, params);
	      }}),
	      setEffect = (effect: SVGSVGElement) => {
		if (selectedEffect !== effect && selectedEffect.parentNode) {
			selectedEffect.replaceWith(effect);
		}
		selectedEffect = effect;
	      };
	let selectedEffect = circleEffect;
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
			input({"type": "radio", "id": "plugin-spell-type-circle", "name": "plugin-spell-type", "checked": true, "onclick": () => setEffect(circleEffect)}),
			br(),
			label({"for": "plugin-spell-type-cone"}, `${lang["SPELL_TYPE_CONE"]}: `),
			input({"type": "radio", "id": "plugin-spell-type-cone", "name": "plugin-spell-type", "onclick": () => setEffect(coneEffect)}),
			br(),
			label({"for": "plugin-spell-type-cube"}, `${lang["SPELL_TYPE_CUBE"]}: `),
			input({"type": "radio", "id": "plugin-spell-type-cube", "name": "plugin-spell-type", "onclick": () => setEffect(cubeEffect)}),
			br(),
			label({"for": "plugin-spell-size"}, `${lang["SPELL_SIZE"]}: `),
			size
		]),
		"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, autosnap.value),
			      mousemove = (e: MouseEvent) => {
				const [x, y] = screen2Grid(e.clientX, e.clientY, autosnap.value);
				selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			      },
			      mouseout = () => {
				this.removeEventListener("mousemove", mousemove);
			      };
			selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			this.appendChild(selectedEffect);
			this.addEventListener("mousemove", mousemove);
			this.addEventListener("mouseout", mouseout, {"once": true});
		},
		"mapMouseWheel": defaultMouseWheel
	});
}
