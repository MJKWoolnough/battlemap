import type {Uint} from '../types.js';
import {br, div, input, label} from '../lib/html.js';
import {createSVG, svg, circle, g, path, rect, title, use} from '../lib/svg.js';
import {checkInt, globals, isAdmin, isInt, isUint, mapLoadedReceive} from '../shared.js';
import {addTool} from '../tools.js';
import {defaultMouseWheel, screen2Grid} from '../tools_default.js';
import {autosnap} from '../settings.js';
import {language} from '../language.js';
import defaultTool from '../tools_default.js';
import {rpc} from '../rpc.js';

const sparkID = "plugin-spell-spark",
      conePathStr = (n: Uint) => `M${n / 2},${n} L0,0 q${n/2},-${n * 0.425} ${n},0 z`,
      circleCircle = circle(),
      circleEffect = g({"stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "style": "clip-path: none; pointer-events: none;"}, circleCircle),
      conePath = path({"d": conePathStr(10)}),
      coneEffect = g({"stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "style": "clip-path: none; pointer-events: none;"}, conePath),
      cubeRect = rect(),
      cubeEffect = g({"stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "style": "clip-path: none; pointer-events: none;"}, cubeRect),
      setSize = (size: Uint) => {
	const {gridSize, gridDistance} = globals.mapData,
	      s = gridSize * size / gridDistance,
	      sh = s >> 1;
	circleCircle.setAttribute("r", s + "")
	conePath.setAttribute("d", conePathStr(s));
	createSVG(cubeRect, {"x": -sh, "y": -sh, "width": s, "height": s});
      };

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
	      size = input({"type": "number", "id": "plugin-spell-size", "min": 0, "value": 10, "onchange": () => setSize(checkInt(parseInt(size.value), 1, 1000, 10))}),
	      setEffect = (effect: SVGGElement) => {
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
			const [x, y] = screen2Grid(e.clientX, e.clientY, autosnap.value !== e.shiftKey),
			      mousemove = (e: MouseEvent) => {
				const [x, y] = screen2Grid(e.clientX, e.clientY, autosnap.value !== e.shiftKey);
				selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			      },
			      mouseout = () => {
				this.removeEventListener("mousemove", mousemove);
			      };
			selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			this.appendChild(selectedEffect);
			this.addEventListener("mousemove", mousemove);
			this.addEventListener("mouseout", mouseout, {"once": true});
			defaultTool.mapMouseOver.call(this, e);
		},
		"mapMouseWheel": defaultMouseWheel,
		"mapMouseContext": function(this: SVGElement, e: MouseEvent) {
			e.preventDefault();
			const [x, y] = screen2Grid(e.clientX, e.clientY, autosnap.value !== e.shiftKey),
			      cancel = (e: MouseEvent) => {
				if (e.button !== 2) {
					return;
				}
				rpc.broadcast({
					"type": "plugin-spells",
					"data": null
				});
				this.removeEventListener("mouseup", cancel);
			     };
			rpc.broadcast({
				"type": "plugin-spells",
				"data": [selectedEffect === circleEffect ? 0 : selectedEffect === coneEffect ? 1 : 2, parseInt(size.value), x, y]
			});
			this.addEventListener("mouseup", cancel);
		},
		"mapMouseDown": defaultTool.mapMouseDown,
		"tokenMouseDown": (e: Event) => e.preventDefault(),
		"tokenMouseContext": (e: Event) => e.preventDefault()
	});
	mapLoadedReceive(() => size.dispatchEvent(new CustomEvent("change")));
} else {
	let lastEffect: SVGGElement | null = null;
	rpc.waitBroadcast().then(({type, data}) => {
		if (type !== "plugin-spells") {
			return;
		}
		if (data === null) {
			lastEffect?.remove()
			lastEffect = null;
			return;
		}
		if (!(data instanceof Array) || data.length !== 4) {
			console.log("plugin spells: broadcast data must be an array with length 4");
		}
		const [effect, size, x, y] = data;
		if (!isUint(effect, 3)) {
			console.log("plugin spells: invalid type");
		}
		if (!isInt(size, 1, 1000)) {
			console.log("plugin spells: invalid size");
		}
		if (!isInt(x) || !isInt(y)) {
			console.log("plugin spells: invalid coords");
		}
		const selectedEffect = effect === 0 ? circleEffect : effect === 1 ? coneEffect : cubeEffect;
		if (lastEffect && lastEffect !== selectedEffect) {
			lastEffect.remove();
		}
		lastEffect = selectedEffect;
		if (!selectedEffect.parentNode) {
			globals.root.appendChild(selectedEffect);
		}
		setSize(size);
		selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
	});
}
