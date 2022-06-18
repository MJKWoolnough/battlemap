import type {TokenImage, Uint} from './types.js';
import type {SVGToken} from './map_tokens.js';
import {amendNode} from './lib/dom.js';
import {setDragEffect} from './lib/drag.js';
import {mouseMoveEvent} from './lib/events.js';
import {br, button, div, img, input, label} from './lib/html.js';
import {node} from './lib/nodes.js';
import {circle, path, svg, title} from './lib/svg.js';
import {dragImage} from './assets.js';
import {dragCharacter} from './characters.js';
import {noColour} from './colours.js';
import lang from './language.js';
import {mapData, root, screen2Grid} from './map.js';
import {doTokenAdd, getToken, layersRPC} from './map_fns.js';
import {deselectToken, selected} from './map_tokens.js';
import {tokenClass} from './plugins.js';
import {autosnap} from './settings.js';
import {characterData, cloneObject, getCharacterToken, labels} from './shared.js';
import {addTool, defaultTool, disable, ignore} from './tools.js';

const mode = input({"type": "checkbox", "class": "settings_ticker", "onchange": function(this: HTMLInputElement) {
	if (this.checked) {
		hideCursor();
	} else {
		deselectToken();
		showCursor();
		defaultTool.unset?.();
	}
      }}),
      i = img(),
      setCursor = () => amendNode((cursor = new tokenClass(token = setToken!()))[node], {"opacity": 0.5}),
      setImg = (id: Uint) => {
	amendNode(i, {"src": `/images/${id}`});
	setCursor();
      },
      fullToken = (tk: Partial<TokenImage>) => Object.assign({"id": 0, "src": 0, "x": 0, "y": 0, "width": mapData.gridSize, "height": mapData.gridSize, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColours": [], "lightStages": [], "lightTimings": []}, tk),
      [moveCursor, stopCursor] = mouseMoveEvent((e: MouseEvent) => {
	[cursor!.x, cursor!.y] = screen2Grid(e.clientX - cursor!.width / 2, e.clientY - cursor!.height / 2, token!.snap);
	cursor!.updateNode();
      }),
      showCursor = () => {
	const {layer} = selected;
	if (!mode.checked && cursor && token && layer) {
		amendNode(layer[node], cursor[node]);
		amendNode(root, {"style": {"cursor": "none"}});
		moveCursor();
	}
      },
      hideCursor = () => {
	stopCursor();
	cursor?.[node].remove();
	cursor?.cleanup();
	amendNode(root, {"style": {"cursor": undefined}});
      };

let setToken: (() => TokenImage) | null = null,
    token: TokenImage | null = null,
    cursor: SVGToken | null = null;

addTool({
	"name": lang["TOOL_MULTIPLACE"],
	"icon": svg({"viewBox": "0 0 100 100", "stroke": "currentColor", "fill": "none"}, [
		title(lang["TOOL_MULTIPLACE"]),
		circle({"cx": 15, "cy": 15, "r": 10, "stroke-dasharray": "50 40", "stroke-dashoffset": 75}),
		circle({"cx": 28, "cy": 28, "r": 10, "stroke-dasharray": "50 40", "stroke-dashoffset": 75}),
		circle({"cx": 42, "cy": 42, "r": 10}),
		path({"d": "M28,77 l26,-26 a3,2 0,0,1 4,0 l40,40 M74,67 l10,-10 a3,2 0,0,1 5,0 l9,9 M14,63 l15,-15 M1,50 l15,-15"}),
		path({"d": "M98,39 s0,-10 -10,-10 h-49 s-10,0 -10,10 v49 s0,10 10,10 h49 s10,0 10,-10 z M84,28 v-3 s0,-10 -10,-10 h-49 s-10,0 -10,10 v49 s0,10 10,10 h3 M71,15 v-3 s0,-10 -10,-10 h-49 s-10,0 -10,10 v49 s0,10 10,10 h3", "stroke-width": 4})
	]),
	"options": div({"style": "overflow: hidden"}, [
		labels(mode, `${lang["TOOL_MULTIPLACE_MODE"]}: `),
		br(),
		label(`${lang["TOKEN"]}: `),
		div({"class": "tokenSelector"}, [
			button({"onclick": () => {
				const data = getToken();
				if (data) {
					setToken = () => fullToken(cloneObject(data));
					setImg(data["src"]);
					if (!mode.checked) {
						deselectToken();
					}
				}
			}, "ondragover": setDragEffect({"link": [dragCharacter, dragImage]}), "ondrop": (e: DragEvent) => {
				if (dragCharacter.is(e)) {
					const tD = dragCharacter.get(e),
					      char = characterData.get(tD.id);
					if (char) {
						setToken = () => {
							const ct = getCharacterToken(char);
							return ct ? fullToken(ct) : fullToken({"src": char["store-image-icon"].data});
						}
						setImg(parseInt(char["store-image-icon"].data));
					}
				} else if (dragImage.is(e)) {
					const {id: src, width, height} = dragImage.get(e);
					setToken = () => fullToken({src, width, height});
					setImg(src);
				}
			}}, lang["TOKEN_USE_SELECTED"]),
			i
		]),
		button({"onclick": () => cursor && setCursor()}, lang["TOKEN_NEXT"])
	]),
	"mapMouse0": function(this: SVGElement, e: MouseEvent) {
		const {layer} = selected;
		if (mode.checked || !token || !cursor || !layer) {
			return true;
		}
		e.preventDefault();
		cursor[node].remove();
		token.x = cursor.x;
		token.y = cursor.y;
		doTokenAdd(layer.path, token);
		setCursor();
		amendNode(selected.layer![node], cursor[node]);
		return false;
	},
	"mapMouse2": ignore,
	"mapMouseOver": () => {
		showCursor();
		return !mode.checked;
	},
	"tokenMouse2": disable,
	"set": () => {
		if (!mode.checked && token) {
			deselectToken();
		}
	},
	"unset": () => {
		hideCursor();
		if (!mode.checked) {
			defaultTool.unset?.();
		}
	}
});

layersRPC.waitLayerSelect().then(() => {
	const {layer} = selected;
	if (cursor && cursor[node].parentNode && layer) {
		amendNode(layer[node], cursor[node]);
	}
});
