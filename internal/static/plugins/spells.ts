import type {Uint} from '../types.js';
import type {Colour} from '../colours.js';
import type {RPCWaits} from '../rpc.js';
import {id} from '../lib/css.js';
import {amendNode} from '../lib/dom.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from '../lib/events.js';
import {br, div, fieldset, input, legend, option, select} from '../lib/html.js';
import {checkInt, isInt, mod} from '../lib/misc.js';
import {circle, g, path, rect, svg, title, use} from '../lib/svg.js';
import {hex2Colour} from '../colours.js';
import {settingsTicker} from '../ids.js';
import {registerKeyEvent} from '../keys.js';
import mainLang, {makeLangPack} from '../language.js';
import {mapData, root, screen2Grid} from '../map.js';
import {doTokenAdd} from '../map_fns.js';
import {selected, tokenSelectedReceive} from '../map_tokens.js';
import {combined, isAdmin, rpc} from '../rpc.js';
import {autosnap} from '../settings.js';
import {labels, mapLoadedReceive} from '../shared.js';
import {addTool, ignore} from '../tools.js';

const effectParams = {"stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "style": "clip-path: none; pointer-events: none;"},
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
	const {gridSize, gridDistance} = mapData,
	      s = gridSize * size / (gridDistance || 1),
	      sh = s >> 1,
	      w = gridSize * width / (gridDistance || 1);
	amendNode(circleCircle, {"r": s});
	amendNode(conePath, {"d": `M0,0 L${s},-${sh} q${s * 0.425},${sh} 0,${s} z`});
	amendNode(cubeRect, {"x": -sh, "y": -sh, "width": s, "height": s});
	amendNode(lineRect, {"x": 0, "y": -w/2, "width": s, "height": w});
	amendNode(wallRect, {"x": -sh, "y": -w/2, "width": s, "height": w});
      },
      types: [Colour, Colour][] = ["#ff0000", "#ddddff", "#00ff00", "#0000ff", "#ffffff", "#000000", "#ffff00", "#996622", "#000000"].map((c, n) => [hex2Colour(c), hex2Colour(c, n === 8 ? 255 : 128)]);

let size = 20,
    width = 5;

if (isAdmin) {
	let selectedEffect = circleEffect,
	    over = false,
	    x = 0,
	    y = 0,
	    rotation = 0,
	    damageType = 0,
	    send = false,
	    rotate = false;
	const lang = makeLangPack({
		"ADD_SPELL": "Add Spell to Map",
		"DAMAGE_TYPE": "Damage Type",
		"SPELL_SIZE": "Spell Size",
		"SPELL_TYPE": "Spell Shape",
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
		"TYPE_8": "Darkness"
	      }),
	      sparkID = id(),
	      setEffect = (effect: SVGGElement) => {
		rotation = 0;
		if (selectedEffect !== effect && selectedEffect.parentNode) {
			selectedEffect.replaceWith(effect);
		}
		selectedEffect = effect;
		if (selectedEffect === coneEffect || selectedEffect === lineEffect) {
			setTokenCentre();
		}
		amendNode(options, {"style": {"--spell-display": selectedEffect === lineEffect || selectedEffect === wallEffect ? "block" : ""}});
	      },
	      sendEffect = () => rpc.broadcast({"type": "plugin-spells", "data": [effectList.indexOf(selectedEffect) ?? 0, size, width, x, y, rotation, damageType]}),
	      cancelEffect = () => rpc.broadcast({"type": "plugin-spells", "data": null}),
	      setTokenCentre = () => {
		const {token} = selected;
		if (token) {
			amendNode(selectedEffect, {"transform": `translate(${x = Math.round(token.x + token.width / 2)}, ${y = Math.round(token.y + token.height / 2)})`});
			if (!selectedEffect.parentNode) {
				amendNode(root, selectedEffect);
			}
		} else {
			coneEffect.remove();
			lineEffect.remove();
		}
	      },
	      snap = input({"type": "checkbox", "checked": autosnap.value, "class": settingsTicker}),
	      shiftSnap = () => snap.click(),
	      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
	      [setupRotate, cancelRotate] = mouseDragEvent(0, undefined, () => rotate = false),
	      [setupMouseUp, cancelMouseUp] = mouseDragEvent(2, undefined, () => {
		send = false;
		cancelEffect();
	      }),
	      [setupMouseMove, cancelMouseMove] = mouseMoveEvent((e: MouseEvent) => {
		if (rotate || selectedEffect === coneEffect || selectedEffect === lineEffect) {
			const [px, py] = screen2Grid(e.clientX, e.clientY, snap.checked);
			amendNode(rotations.get(selectedEffect), {"transform": `rotate(${rotation = mod(Math.round(180 * Math.atan2(py - y, px - x) / Math.PI), 360)})`});
		} else {
			[x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			amendNode(selectedEffect, {"transform": `translate(${x}, ${y})`});
		}
		if (send) {
			sendEffect();
		}
	      }, () => over = false),
	      addSpell = () => {
		if (selectedEffect !== coneEffect && selectedEffect !== lineEffect) {
			const {layer} = selected;
			if (layer) {
				const {gridSize, gridDistance} = mapData,
				      w = (selectedEffect === circleEffect ? 2 : 1) * gridSize * size / gridDistance,
				      h = selectedEffect === wallEffect ? gridSize * width / gridDistance : w;
				doTokenAdd(layer.path, {"id": 0, "x": x - (w >> 1), "y": y - (h >> 1), "width": w, "height": h, "rotation": mod(Math.floor(256 * rotation / 360), 256), "snap": snap.checked, "fill": types[damageType][1], "stroke": types[damageType][0], "strokeWidth": 1, "tokenType": 1, "isEllipse": selectedEffect === circleEffect, "lightColours": [], "lightStages": [], "lightTimings": [], "tokenData": {}});
			}
		}
	      },
	      [setupEnter, cancelEnter] = registerKeyEvent("spells-create", lang["ADD_SPELL"], "Enter", addSpell),
	      options = div([
		labels([lang["DAMAGE_TYPE"], ": "], select({"onchange": function(this: HTMLSelectElement) {
			damageType = checkInt(parseInt(this.value), 0, types.length - 1);
			for (const effect of effectList) {
				amendNode(effect, {"stroke": types[damageType][0], "fill": types[damageType][1]});
			}
		}}, Array.from({length: types.length}, (_, n) => option({"value": n}, lang["TYPE_"+n as keyof typeof lang])))),
		fieldset([
			legend(lang["SPELL_TYPE"]),
			([[circleEffect, "SPELL_TYPE_CIRCLE"], [coneEffect, "SPELL_TYPE_CONE"], [cubeEffect, "SPELL_TYPE_CUBE"], [lineEffect, "SPELL_TYPE_LINE"], [wallEffect, "SPELL_TYPE_WALL"]] as const).map(([e, k], n) => [n > 0 ? br() : [], labels(input({"type": "radio", "name": "plugin-spell-type", "checked": !n, "class": settingsTicker, "onclick": () => setEffect(e)}), [lang[k], ": "])])
		]),
		labels(snap, `${mainLang["TOOL_MEASURE_SNAP"]}: `),
		br(),
		labels([lang["SPELL_SIZE"], ": "], input({"type": "number", "min": 1, "value": size, "onchange": function (this: HTMLInputElement) {
			setSize(size = checkInt(parseInt(this.value), 1, 1000, 10), width);
		}})),
		div({"style": "display: var(--spell-display, none)"}, labels([lang["SPELL_WIDTH"], ": "], input({"type": "number", "min": 1, "value": width, "onchange": function (this: HTMLInputElement) {
			setSize(size, width = checkInt(parseInt(this.value), 1, 1000, 10));
		}})))
	      ]),
	      tokenMoved = () => {
		if (over && (selectedEffect === coneEffect || selectedEffect === lineEffect)) {
			setTokenCentre()
		}
	      };
	addTool(Object.freeze({
		"name": lang["TITLE"],
		"id": "tool_spells",
		"icon": svg({"viewBox": "0 0 100 100"}, [
			title(lang["TITLE"]),
			g({"fill": "currentColor", "stroke": "currentColor"}, [
				path({"d": "M60,35 v70 h-20 v-100 h20 v30 h-20 v-30 h20", "fill-rule": "evenodd", "transform": "rotate(-45, 50, 50)"}),
				path({"d": "M50,10 q0,10 10,10 q-10,0 -10,10 q0,-10 -10,-10 q10,0 10,-10", "id": sparkID}),
				use({"href": `#${sparkID}`, "transform": "translate(5, 0) scale(1.5)"}),
				use({"href": `#${sparkID}`, "transform": "translate(-45, 30) scale(1.2)"}),
				use({"href": `#${sparkID}`, "transform": "translate(-30, -5) scale(0.8)"})
			])
		]),
		options,
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
			amendNode(selectedEffect, {"transform": `translate(${x}, ${y})`});
			if (selectedEffect !== coneEffect && selectedEffect !== lineEffect) {
				amendNode(this, selectedEffect);
			}
			setupEnter();
			setupMouseMove();
			return true;
		},
		"mapMouse0": () => {
			if (selectedEffect === cubeEffect || selectedEffect === wallEffect) {
				rotate = true;
				setupRotate();
				return false;
			}
			return true;
		},
		"mapMouse2": () => {
			send = true;
			sendEffect();
			setupMouseUp();
			return false;
		},
		"tokenMouse0": function(this: SVGElement, e: MouseEvent) {
			return !this.previousSibling && e.shiftKey;
		},
		"tokenMouse2": ignore,
		"set": setupShiftSnap,
		"unset": () => {
			if (send) {
				cancelEffect();
				send = false;
			}
			cancelMouseMove();
			cancelMouseUp();
			cancelEnter();
			cancelRotate();
			selectedEffect?.remove();
			cancelShiftSnap();
		}
	}));
	mapLoadedReceive(() => setSize(size, width));
	tokenSelectedReceive(tokenMoved);
	for (const k of (["waitTokenMoveLayerPos", "waitTokenSet", "waitTokenSetMulti", "waitLayerShift"] as (keyof RPCWaits)[])) {
		combined[k]().when(() => setTimeout(tokenMoved));
	}
} else {
	let lastEffect: SVGGElement | null = null;
	rpc.waitBroadcast().when(({type, data}) => {
		if (type !== "plugin-spells") {
			return;
		}
		if (data === null) {
			lastEffect?.remove();
			lastEffect = null;
			return;
		}
		if (!(data instanceof Array) || data.length !== 7) {
			console.log("plugin spells: broadcast data must be an array with length 7");
			return;
		}
		const [effect, spellSize, spellWidth, x, y, rotation, damageType] = data,
		      selectedEffect = effectList[effect];
		for (const [a, log] of [
			[isInt(effect, 0, effectList.length - 1), "invalid type"],
			[isInt(spellSize, 1, 1000), "invalid size"],
			[isInt(spellWidth, 1, 1000), "invalid width"],
			[isInt(x) && isInt(y), "invalid coords"],
			[isInt(rotation, 0, 360), "invalid rotation"],
			[isInt(damageType, 0, types.length - 1), "invalid damage type"]
		]) {
			if (!a) {
				console.log("plugin spells: " + log);
				return;
			}
		}
		if (lastEffect !== selectedEffect) {
			lastEffect?.remove();
			amendNode(root, selectedEffect);
		}
		setSize(size = spellSize, width = spellWidth);
		amendNode(rotations.get(amendNode(lastEffect = selectedEffect, {"transform": `translate(${x}, ${y})`, "stroke": types[damageType][0], "fill": types[damageType][1]})), {"transform": `rotate(${rotation})`});
	});
}

combined.waitGridDistanceChange().when(() => setTimeout(setSize, 0, size, width));
