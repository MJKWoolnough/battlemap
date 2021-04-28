import type {Uint} from '../types.js';
import {br, div, input, label, option, select, style} from '../lib/html.js';
import {createSVG, svg, circle, g, path, rect, title, use} from '../lib/svg.js';
import {checkInt, globals, isAdmin, isInt, isUint, mapLoadedReceive, mod, tokenSelectedReceive} from '../shared.js';
import {addTool} from '../tools.js';
import {defaultMouseWheel, screen2Grid} from '../tools_default.js';
import {autosnap} from '../settings.js';
import mainLang, {language} from '../language.js';
import defaultTool from '../tools_default.js';
import {rpc} from '../rpc.js';
import {colour2RGBA, hex2Colour, noColour} from '../colours.js';
import {doTokenAdd} from '../map_fns.js';

const sparkID = "plugin-spell-spark",
      effectParams = {"stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "style": "clip-path: none; pointer-events: none;"},
      conePathStr = (n: Uint) => `M0,0 L${n},-${n/2} q${n * 0.425},${n/2} 0,${n} z`,
      circleCircle = circle(),
      circleEffect = g(effectParams, circleCircle),
      conePath = path({"d": conePathStr(10)}),
      coneEffect = g(effectParams, conePath),
      cubeRect = rect(),
      cubeEffect = g(effectParams, cubeRect),
      lineRect = rect(),
      lineEffect = g(effectParams, lineRect),
      wallRect = rect(),
      wallEffect = g(effectParams, wallRect),
      effectList = [circleEffect, coneEffect, cubeEffect, lineEffect, wallEffect],
      rotations = new Map<SVGGElement, SVGElement>([[coneEffect, conePath], [cubeEffect, cubeRect], [lineEffect, lineRect], [wallEffect, wallRect]]),
      setSize = (size: Uint, width: Uint) => {
	const {gridSize, gridDistance} = globals.mapData,
	      s = gridSize * size / gridDistance,
	      sh = s >> 1,
	      w = gridSize * width / gridDistance;
	circleCircle.setAttribute("r", s + "")
	conePath.setAttribute("d", conePathStr(s));
	createSVG(cubeRect, {"x": -sh, "y": -sh, "width": s, "height": s});
	createSVG(lineRect, {"x": 0, "y": -w/2, "width": s, "height": w});
	createSVG(wallRect, {"x": -sh, "y": -w/2, "width": s, "height": w});
      },
      types: [string, string][] = ["#ff0000", "#ffffff", "#00ff00", "#0000ff", "#000000", "#ffff00"].map(c => [c, colour2RGBA(hex2Colour(c, 128))]);

if (isAdmin()) {
	document.head.appendChild(style({"type": "text/css"}, "#plugin-spell-type-line:not(:checked)~#plugin-spell-type-wall:not(:checked)~div{display:none}"));
	const defaultLanguage = {
		"DAMAGE_TYPE": "Damage Type",
		"SPELL_SIZE": "Spell Size",
		"SPELL_TYPE_CIRCLE": "Circle Spell",
		"SPELL_TYPE_CONE": "Cone Spell",
		"SPELL_TYPE_CUBE": "Cube Spell",
		"SPELL_TYPE_LINE": "Line Spell",
		"SPELL_TYPE_WALL": "Wall Spell",
		"SPELL_WIDTH": "Spell Width",
		"TITLE": "Spell Effects",
		"TYPE_0": "Fire",
		"TYPE_1": "Ice",
		"TYPE_2": "Acid",
		"TYPE_3": "Water",
		"TYPE_4": "Necrotic",
		"TYPE_5": "Lightning",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      setEffect = (effect: SVGGElement) => {
		if (selectedEffect !== effect && selectedEffect.parentNode) {
			selectedEffect.replaceWith(effect);
		}
		selectedEffect = effect;
	      },
	      sendEffect = () => rpc.broadcast({"type": "plugin-spells", "data": [effectList.indexOf(selectedEffect) ?? 0, size, width, x, y, rotation, damageType]}),
	      cancelEffect = () => rpc.broadcast({"type": "plugin-spells", "data": null}),
	      setTokenCentre = () => {
		const {selected: {token}} = globals;
		if (token) {
			x = Math.round(token.x + token.width / 2);
			y = Math.round(token.y + token.height / 2);
			selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			if (!selectedEffect.parentNode) {
				globals.root.appendChild(selectedEffect);
			}
		} else {
			coneEffect.remove();
			lineEffect.remove();
		}
	      },
	      snap = input({"id": "plugin-spells-snap", "type": "checkbox", "checked": autosnap.value}),
	      shiftSnap = (e: KeyboardEvent) => {
		if (e.key === "Shift") {
			snap.click();
		}
	      },
	      disabled = (e: Event) => e.preventDefault();
	let selectedEffect = circleEffect,
	    over = false,
	    x = 0,
	    y = 0,
	    rotation = 0,
	    size = 20,
	    width = 5,
	    damageType = 0;
	addTool(Object.freeze({
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
			label({"for": "plugin-spell-damage-type"}, `${lang["DAMAGE_TYPE"]}: `),
			select({"id": "plugin-spell-damage-type", "onchange": function(this: HTMLSelectElement) {
				damageType = checkInt(parseInt(this.value), 0, types.length - 1);
				for (const effect of effectList) {
					effect.setAttribute("stroke", types[damageType][0]);
					effect.setAttribute("fill", types[damageType][1]);
				}
			}}, Array.from({length: types.length}, (_, n) => option({"value": n+""}, lang["TYPE_"+n as keyof typeof lang]))),
			br(),
			label({"for": "plugin-spell-type-circle"}, `${lang["SPELL_TYPE_CIRCLE"]}: `),
			input({"type": "radio", "id": "plugin-spell-type-circle", "name": "plugin-spell-type", "checked": true, "onclick": () => setEffect(circleEffect)}),
			br(),
			label({"for": "plugin-spell-type-cone"}, `${lang["SPELL_TYPE_CONE"]}: `),
			input({"type": "radio", "id": "plugin-spell-type-cone", "name": "plugin-spell-type", "onclick": () => setEffect(coneEffect)}),
			br(),
			label({"for": "plugin-spell-type-cube"}, `${lang["SPELL_TYPE_CUBE"]}: `),
			input({"type": "radio", "id": "plugin-spell-type-cube", "name": "plugin-spell-type", "onclick": () => setEffect(cubeEffect)}),
			br(),
			label({"for": "plugin-spell-type-line"}, `${lang["SPELL_TYPE_LINE"]}: `),
			input({"type": "radio", "id": "plugin-spell-type-line", "name": "plugin-spell-type", "onclick": () => setEffect(lineEffect)}),
			br(),
			label({"for": "plugin-spell-type-wall"}, `${lang["SPELL_TYPE_WALL"]}: `),
			input({"type": "radio", "id": "plugin-spell-type-wall", "name": "plugin-spell-type", "onclick": () => setEffect(wallEffect)}),
			br(),
			label({"for": "plugin-spell-snap"}, `${mainLang["TOOL_MEASURE_SNAP"]}: `),
			snap,
			br(),
			label({"for": "plugin-spell-size"}, `${lang["SPELL_SIZE"]}: `),
			input({"type": "number", "id": "plugin-spell-size", "min": 1, "value": size, "onchange": function (this: HTMLInputElement) {
				setSize(size = checkInt(parseInt(this.value), 1, 1000, 10), width);
			}}),
			div([
				label({"id": "plugin-spell-width-label", "for": "plugin-spell-width"}, `${lang["SPELL_WIDTH"]}: `),
				input({"type": "number", "id": "plugin-spell-width", "min": 1, "value": width, "onchange": function (this: HTMLInputElement) {
					setSize(size, width = checkInt(parseInt(this.value), 1, 1000, 10));
				}})
			])
		]),
		"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
			if (over) {
				return;
			}
			over = true;
			if (selectedEffect === coneEffect || selectedEffect === lineEffect) {
				setTokenCentre();
			} else {
				[x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			}
			let send = false,
			    rotate = false;
			const mousemove = (e: MouseEvent) => {
				if (rotate || selectedEffect === coneEffect || selectedEffect === lineEffect) {
					const [px, py] = screen2Grid(e.clientX, e.clientY, snap.checked);
					rotation = mod(Math.round(180 * Math.atan2(py - y, px - x) / Math.PI), 360);
					rotations.get(selectedEffect)?.setAttribute("transform", `rotate(${rotation})`);
				} else {
					[x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
					selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
				}
				if (send) {
					sendEffect();
				}
			      },
			      mousedown = (e: MouseEvent) => {
				if (e.button === 0 && (selectedEffect === cubeEffect || selectedEffect === wallEffect)) {
					rotate = true;
					this.addEventListener("mouseup", mouseupRotate);
					e.preventDefault();
				}
				if (e.button !== 2 || !selectedEffect.parentNode) {
					return;
				}
				send = true;
				sendEffect();
				this.addEventListener("mouseup", mouseup);
			      },
			      mouseupRotate = (e: MouseEvent) => {
				if (e.button === 0 && rotate) {
					rotate = false;
				}
			      },
			      mouseup = (e: MouseEvent) => {
				if (e.button !== 2) {
					return;
				}
				send = false;
				cancelEffect();
				this.removeEventListener("mouseup", mouseup);
			      },
			      mouseout = () => {
				if (send) {
					cancelEffect();
				}
				this.removeEventListener("mousemove", mousemove);
				this.removeEventListener("mousedown", mousedown);
				this.removeEventListener("mouseup", mouseup);
				this.removeEventListener("keydown", keydown);
				selectedEffect?.remove();
				over = false;
			      },
			      keydown = (e: KeyboardEvent) => {
				if (e.key !== "Enter" || selectedEffect === coneEffect || selectedEffect === lineEffect) {
					return;
				}
				let r = mod(Math.floor(256 * rotation / 360), 256);
				const {mapData: {gridSize, gridDistance}, selected: {layer}} = globals,
				      w = (selectedEffect === circleEffect ? 2 : 1) * gridSize * size / gridDistance,
				      h = selectedEffect === wallEffect ? gridSize * width / gridDistance : w,
				      token = {"id": 0, "x": x - (w >> 1), "y": y - (h >> 1), "width": w, "height": h, "rotation": r, "snap": snap.checked, "fill": hex2Colour(types[damageType][0], 128), "stroke": hex2Colour(types[damageType][0]), "strokeWidth": 1, "tokenType": 1, "isEllipse": selectedEffect === circleEffect, "lightColour": noColour, "lightIntensity": 0};
				if (layer) {
					doTokenAdd(layer.path, token);
				}
			      };
			selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			if (selectedEffect !== coneEffect && selectedEffect !== lineEffect) {
				this.appendChild(selectedEffect);
			}
			this.addEventListener("mousemove", mousemove);
			this.addEventListener("mousedown", mousedown);
			this.addEventListener("keydown", keydown);
			this.addEventListener("mouseleave", mouseout, {"once": true});
			defaultTool.mapMouseOver.call(this, e);
		},
		"mapMouseWheel": defaultMouseWheel,
		"mapMouseContext": disabled,
		"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
			if (selectedEffect === cubeEffect || selectedEffect === wallEffect) {
				return;
			}
			defaultTool.mapMouseDown.call(this, e);
		},
		"tokenMouseDown": function(this: SVGElement, e: MouseEvent) {
			if (this.previousSibling || !e.shiftKey) {
				e.preventDefault();
			}
		},
		"tokenMouseContext": disabled
	}));
	mapLoadedReceive(() => setSize(size, width));
	tokenSelectedReceive(() => {
		if (over && (selectedEffect === coneEffect || selectedEffect === lineEffect)) {
			setTokenCentre()
		}
	});
	window.addEventListener("keydown", shiftSnap);
	window.addEventListener("keyup", shiftSnap);
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
		if (!(data instanceof Array) || data.length !== 7) {
			console.log("plugin spells: broadcast data must be an array with length 7");
			return;
		}
		const [effect, size, width, x, y, rotation, damageType] = data;
		for (const [a, log] of [
			[isUint(effect, effectList.length - 1), "invalid type"],
			[isInt(size, 1, 1000), "invalid size"],
			[isInt(width, 1, 1000), "invalid width"],
			[isInt(x) && isInt(y), "invalid coords"],
			[isUint(rotation, 360), "invalid rotation"],
			[isUint(damageType, types.length - 1), "invalid damage type"]
		]) {
			if (!a) {
				console.log("plugin spells: " + log);
				return;
			}
		}
		const selectedEffect = effectList[effect];
		if (lastEffect !== selectedEffect) {
			lastEffect?.remove();
			globals.root.appendChild(selectedEffect);
		}
		lastEffect = selectedEffect;
		setSize(size, width);
		selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
		selectedEffect.setAttribute("stroke", types[damageType][0]);
		selectedEffect.setAttribute("fill", types[damageType][1]);
		rotations.get(selectedEffect)?.setAttribute("transform", `rotate(${rotation})`);
	});
}
