import type {Token, Uint} from './types.js';
import {button, div, img, label} from './lib/html.js';
import {svg, circle, path, title} from './lib/svg.js';
import {addTool} from './tools.js';
import {defaultMouseWheel} from './tools_default.js';
import {characterData, getCharacterToken} from './shared.js';
import {getToken} from './map_fns.js';
import {autosnap} from './settings.js';
import {noColour} from './colours.js';
import lang from './language.js';

const i = img(),
      cursor = img(),
      setImg = (id: Uint) => {
	const url =`/images/${id}`;
	i.setAttribute("src", url);
	cursor.setAttribute("src", url);
      },
      fullToken = (tk: Partial<Token>) => Object.assign({"id": 0, "src": 0, "x": 0, "y": 0, "width": 100, "height": 100, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColour": noColour, "lightIntensity": 0}, tk);

let token: (() => Token) | null = null;


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
	"options": div({"style": {"overflow": "hidden"}}, [
		label(`${lang["TOKEN"]}: `),
		div({"class": "tokenSelector"}, [
			button({"onclick": () => {
				const data = getToken();
				if (!data) {
					return;
				}
				token = () => fullToken(JSON.parse(JSON.stringify(data)));
				setImg(data["src"]);
			}, "ondragover": (e: DragEvent) => {
				if (e.dataTransfer && e.dataTransfer.types.includes("character")) {
					e.preventDefault();
					e.dataTransfer.dropEffect = "link";
				}
			}, "ondrop": (e: DragEvent) => {
				if (!e.dataTransfer) {
					return;
				}
				if (e.dataTransfer.types.includes("character")) {
					const tD = JSON.parse(e.dataTransfer.getData("character")),
					      char = characterData.get(tD.id);
					if (char) {
						setImg(parseInt(char["store-image-icon"].data));
						token = () => {
							const ct = getCharacterToken(char);
							if (ct) {
								return fullToken(ct);
							}
							return fullToken({"src": char["store-image-icon"].data});
						}
						return;
					}
				}
			}}, lang["TOKEN_USE_SELECTED"]),
			i
		])
	]),
	"mapMouseWheel": defaultMouseWheel
});
