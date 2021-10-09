import type {Uint} from '../types.js';
import {br, div, input, option, select} from '../lib/html.js';
import {createSVG, svg, circle, g, path, rect, title, use} from '../lib/svg.js';
import {addCSS, checkInt, globals, isAdmin, isInt, isUint, labels, mapLoadedReceive, mod, tokenSelectedReceive} from '../shared.js';
import {addTool} from '../tools.js';
import {screen2Grid} from '../map.js';
import {autosnap} from '../settings.js';
import mainLang, {language} from '../language.js';
import {rpc} from '../rpc.js';
import {colour2RGBA, hex2Colour, noColour} from '../colours.js';
import {doTokenAdd} from '../map_fns.js';

const sparkID = "plugin-spell-spark",
      effectParams = {"stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "style": "clip-path: none; pointer-events: none;"},
      circleCircle = circle(),
      circleEffect = g(effectParams, circleCircle),
      conePath = path(),
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
	      s = gridSize * size / (gridDistance || 1),
	      sh = s >> 1,
	      w = gridSize * width / (gridDistance || 1);
	circleCircle.setAttribute("r", s + "")
	conePath.setAttribute("d", `M0,0 L${s},-${sh} q${s * 0.425},${sh} 0,${s} z`);
	createSVG(cubeRect, {"x": -sh, "y": -sh, "width": s, "height": s});
	createSVG(lineRect, {"x": 0, "y": -w/2, "width": s, "height": w});
	createSVG(wallRect, {"x": -sh, "y": -w/2, "width": s, "height": w});
      },
	types: [string, string][] = ["#ff0000", "#ddddff", "#00ff00", "#0000ff", "#ffffff", "#000000", "#ffff00", "#996622", "#000000"].map((c, n) => [c, colour2RGBA(hex2Colour(c, n === 8 ? 255 : 128))]);

if (isAdmin) {
	addCSS(".plugin-spell-nowidth:not(:checked)~.plugin-spell-nowidth:not(:checked)~div{display:none}");
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
		"TYPE_4": "Steam",
		"TYPE_5": "Necrotic",
		"TYPE_6": "Lightning",
		"TYPE_7": "Earth",
		"TYPE_8": "Darkness",
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
	      snap = input({"type": "checkbox", "checked": autosnap.value}),
	      shiftSnap = (e: KeyboardEvent) => {
		if (e.key === "Shift") {
			snap.click();
		}
	      },
	      mouseupRotate = (e: MouseEvent) => {
		if (e.button === 0 && rotate) {
			rotate = false;
			document.body.removeEventListener("mouseup", mouseupRotate);
		}
	      },
	      mouseup = (e: MouseEvent) => {
		if (e.button === 2) {
			send = false;
			cancelEffect();
			document.body.removeEventListener("mouseup", mouseup);
		}
	      },
	      disabled = () => false,
	      mousemove = (e: MouseEvent) => {
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
	      mouseout = () => {
		if (send) {
			cancelEffect();
			send = false;
		}
		document.body.removeEventListener("mousemove", mousemove);
		document.body.removeEventListener("mouseup", mouseup);
		document.body.removeEventListener("keydown", keydown);
		selectedEffect?.remove();
		over = false;
	      },
	      keydown = (e: KeyboardEvent) => {
		if (e.key !== "Enter" || selectedEffect === coneEffect || selectedEffect === lineEffect) {
			return;
		}
		const {mapData: {gridSize, gridDistance}, selected: {layer}} = globals,
		      w = (selectedEffect === circleEffect ? 2 : 1) * gridSize * size / gridDistance,
		      h = selectedEffect === wallEffect ? gridSize * width / gridDistance : w,
		      token = {"id": 0, "x": x - (w >> 1), "y": y - (h >> 1), "width": w, "height": h, "rotation": mod(Math.floor(256 * rotation / 360), 256), "snap": snap.checked, "fill": hex2Colour(types[damageType][0], 128), "stroke": hex2Colour(types[damageType][0]), "strokeWidth": 1, "tokenType": 1, "isEllipse": selectedEffect === circleEffect, "lightColour": noColour, "lightIntensity": 0};
		if (layer) {
			doTokenAdd(layer.path, token);
		}
	      };
	let selectedEffect = circleEffect,
	    over = false,
	    x = 0,
	    y = 0,
	    rotation = 0,
	    size = 20,
	    width = 5,
	    damageType = 0,
	    send = false,
	    rotate = false;
	addTool(Object.freeze({
		"name": lang["TITLE"],
		"icon": svg({"viewBox": "0 0 100 100"}, [
			title(lang["TITLE"]),
			g({"fill": "currentColor", "stroke": "currentColor"}, [
				path({"d": "M60,35 v70 h-20 v-100 h20 v30 h-20 v-30 h20", "fill-rule": "evenodd", "transform": "rotate(-45, 50, 50)"}),
				path({"d": "M50,10 q0,10 10,10 q-10,0 -10,10 q0,-10 -10,-10 q10,0 10,-10", "id": sparkID}),
				use({"href": `#${sparkID}`, "transform": "translate(5, 0) scale(1.5)"}),
				use({"href": `#${sparkID}`, "transform": "translate(-45, 30) scale(1.2)"}),
				use({"href": `#${sparkID}`, "transform": "translate(-30, -5) scale(0.8)"}),
			]),
		]),
		"options": div([
			labels(`${lang["DAMAGE_TYPE"]}: `, select({"onchange": function(this: HTMLSelectElement) {
				damageType = checkInt(parseInt(this.value), 0, types.length - 1);
				for (const effect of effectList) {
					effect.setAttribute("stroke", types[damageType][0]);
					effect.setAttribute("fill", types[damageType][1]);
				}
			}}, Array.from({length: types.length}, (_, n) => option({"value": n+""}, lang["TYPE_"+n as keyof typeof lang])))),
			br(),
			labels(`${lang["SPELL_TYPE_CIRCLE"]}: `, input({"type": "radio", "name": "plugin-spell-type", "checked": true, "onclick": () => setEffect(circleEffect)})),
			br(),
			labels(`${lang["SPELL_TYPE_CONE"]}: `, input({"type": "radio", "name": "plugin-spell-type", "onclick": () => setEffect(coneEffect)})),
			br(),
			labels(`${lang["SPELL_TYPE_CUBE"]}: `, input({"type": "radio", "name": "plugin-spell-type", "onclick": () => setEffect(cubeEffect)})),
			br(),
			labels(`${lang["SPELL_TYPE_LINE"]}: `, input({"type": "radio", "class": "plugin-spell-nowidth", "name": "plugin-spell-type", "onclick": () => setEffect(lineEffect)})),
			br(),
			labels(`${lang["SPELL_TYPE_WALL"]}: `, input({"type": "radio", "class": "plugin-spell-nowidth", "name": "plugin-spell-type", "onclick": () => setEffect(wallEffect)})),
			br(),
			labels(`${mainLang["TOOL_MEASURE_SNAP"]}: `, snap),
			br(),
			labels(`${lang["SPELL_SIZE"]}: `, input({"type": "number", "min": 1, "value": size, "onchange": function (this: HTMLInputElement) {
				setSize(size = checkInt(parseInt(this.value), 1, 1000, 10), width);
			}})),
			div([
				labels(`${lang["SPELL_WIDTH"]}: `, input({"type": "number", "id": "plugin-spell-width", "min": 1, "value": width, "onchange": function (this: HTMLInputElement) {
					setSize(size, width = checkInt(parseInt(this.value), 1, 1000, 10));
				}}))
			])
		]),
		"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
			if (over) {
				return false;
			}
			over = true;
			if (selectedEffect === coneEffect || selectedEffect === lineEffect) {
				setTokenCentre();
			} else {
				[x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			}
			selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			if (selectedEffect !== coneEffect && selectedEffect !== lineEffect) {
				this.appendChild(selectedEffect);
			}
			document.body.addEventListener("mousemove", mousemove);
			document.body.addEventListener("keydown", keydown);
			document.body.addEventListener("mouseleave", mouseout, {"once": true});
			return true;
		},
		"mapMouse0": () => {
			if (selectedEffect === cubeEffect || selectedEffect === wallEffect) {
				rotate = true;
				document.body.addEventListener("mouseup", mouseupRotate);
				return false;
			}
			return true;
		},
		"mapMouse2": () => {
			send = true;
			sendEffect();
			document.body.addEventListener("mouseup", mouseup);
			return false;
		},
		"tokenMouse0": function(this: SVGElement, e: MouseEvent) {
			return !this.previousSibling && e.shiftKey;
		},
		"tokenMouse2": disabled,
		"unset": mouseout
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
		const [effect, size, width, x, y, rotation, damageType] = data,
		      selectedEffect = effectList[effect];
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
