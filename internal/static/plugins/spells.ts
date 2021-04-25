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
      effectParams = {"stroke": "#f00", "fill": "rgba(255, 0, 0, 0.5)", "style": "clip-path: none; pointer-events: none;"},
      conePathStr = (n: Uint) => `M0,0 L${n},-${n/2} q${n * 0.425},${n/2} 0,${n} z`,
      circleCircle = circle(),
      circleEffect = g(effectParams, circleCircle),
      conePath = path({"d": conePathStr(10)}),
      coneEffect = g(effectParams, conePath),
      cubeRect = rect(),
      cubeEffect = g(effectParams, cubeRect),
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
	      },
	      sendEffect = () => rpc.broadcast({"type": "plugin-spells", "data": [selectedEffect === circleEffect ? 0 : selectedEffect === coneEffect ? 1 : 2, parseInt(size.value), 1, x, y, rotation]}),
	      cancelEffect = () => rpc.broadcast({"type": "plugin-spells", "data": null}),
	      setTokenCentre = () => {
		const {selected: {token}} = globals;
		if (token) {
			x = Math.round(token.x + token.width / 2);
			y = Math.round(token.y + token.height / 2);
		}
	      };
	let selectedEffect = circleEffect,
	    over = false,
	    x = 0,
	    y = 0,
	    rotation = 0;
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
			if (over) {
				return;
			}
			over = true;
			if (selectedEffect === coneEffect) {
				setTokenCentre();
			} else {
				[x, y] = screen2Grid(e.clientX, e.clientY, autosnap.value !== e.shiftKey);
			}
			let send = false,
			    rotate = false;
			const mousemove = (e: MouseEvent) => {
				if (rotate || selectedEffect === coneEffect) {
					const [px, py] = screen2Grid(e.clientX, e.clientY, autosnap.value !== e.shiftKey);
					rotation = Math.round(180 * Math.atan2(py - y, px - x) / Math.PI);
					while (rotation > 360) {
						rotation -= 360;
					}
					while (rotation < 0) {
						rotation += 360;
					}
					(selectedEffect === cubeEffect ? cubeRect : conePath).setAttribute("transform", `rotate(${rotation})`);
				} else {
					[x, y] = screen2Grid(e.clientX, e.clientY, autosnap.value !== e.shiftKey);
					selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
				}
				if (send) {
					sendEffect();
				}
			      },
			      mousedown = (e: MouseEvent) => {
				if (e.button === 0 && selectedEffect === cubeEffect) {
					rotate = true;
					this.addEventListener("mouseup", mouseupRotate);
					e.preventDefault();
				}
				if (e.button !== 2) {
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
				selectedEffect?.remove();
				over = false;
			      };
			selectedEffect.setAttribute("transform", `translate(${x}, ${y})`);
			this.appendChild(selectedEffect);
			this.addEventListener("mousemove", mousemove);
			this.addEventListener("mousedown", mousedown);
			this.addEventListener("mousedown", mousedown);
			this.addEventListener("mouseleave", mouseout, {"once": true});
			defaultTool.mapMouseOver.call(this, e);
		},
		"mapMouseWheel": defaultMouseWheel,
		"mapMouseContext": (e: Event) => e.preventDefault(),
		"mapMouseDown": function (this: SVGElement, e: MouseEvent) {
			if (selectedEffect === cubeEffect) {
				return;
			}
			defaultTool.mapMouseDown.call(this, e)
			if (selectedEffect === coneEffect) {
				setTokenCentre();
			}
		},
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
		if (!(data instanceof Array) || data.length !== 6) {
			console.log("plugin spells: broadcast data must be an array with length 6");
			return;
		}
		const [effect, size, width, x, y, rotation] = data;
		if (!isUint(effect, 3)) {
			console.log("plugin spells: invalid type");
			return;
		}
		if (!isInt(size, 1, 1000)) {
			console.log("plugin spells: invalid size");
			return;
		}
		if (!isInt(width, 1, 1000)) {
			console.log("plugin spells: invalid width");
			return;
		}
		if (!isInt(x) || !isInt(y)) {
			console.log("plugin spells: invalid coords");
			return;
		}
		if (!isUint(rotation, 360)) {
			console.log("plugin spells: invalid rotation");
			return;
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
		if (selectedEffect === cubeEffect) {
			cubeRect.setAttribute("transform", `rotate(${rotation})`);
		} else if (selectedEffect === coneEffect) {
			conePath.setAttribute("transform", `rotate(${rotation})`);
		}
	});
}
