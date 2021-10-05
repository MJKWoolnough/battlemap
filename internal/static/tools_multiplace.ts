import type {TokenImage, Uint} from './types.js';
import {br, button, div, img, input, label} from './lib/html.js';
import {createSVG, svg, circle, image, path, title} from './lib/svg.js';
import {node} from './lib/nodes.js';
import {addTool} from './tools.js';
import {defaultMouseWheel, screen2Grid} from './tools_default.js';
import {characterData, getCharacterToken, globals, labels} from './shared.js';
import {getToken, layersRPC} from './map_fns.js';
import {autosnap} from './settings.js';
import {noColour} from './colours.js';
import lang from './language.js';

const mode = input({"type": "checkbox", "class": "settings_ticker"}),
      i = img(),
      cursor = image({"opacity": 0.5, "preserveAspectRatio": "none"}),
      setCursor = () => {
	token = setToken!();
	createSVG(cursor, {"href": `/images/${token.src}`, "width": token.width, "height": token.height, "transform": `translate(-${token.width/2}, -${token.height/2})`});
      },
      setImg = (id: Uint) => {
	const src =`/images/${id}`;
	i.setAttribute("src", src);
	setCursor();
      },
      fullToken = (tk: Partial<TokenImage>) => Object.assign({"id": 0, "src": 0, "x": 0, "y": 0, "width": 100, "height": 100, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColour": noColour, "lightIntensity": 0}, tk);

let setToken: (() => TokenImage) | null = null,
    token: TokenImage | null = null;

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
		labels(`${lang["TOOL_MULTIPLACE_MODE"]}: `, mode, false),
		br(),
		label(`${lang["TOKEN"]}: `),
		div({"class": "tokenSelector"}, [
			button({"onclick": () => {
				const data = getToken();
				if (!data) {
					return;
				}
				setToken = () => fullToken(JSON.parse(JSON.stringify(data)));
				setImg(data["src"]);
			}, "ondragover": (e: DragEvent) => {
				if (e.dataTransfer && (e.dataTransfer.types.includes("character") || e.dataTransfer.types.includes("imageasset"))) {
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
						setToken = () => {
							const ct = getCharacterToken(char);
							if (ct) {
								return fullToken(ct);
							}
							return fullToken({"src": char["store-image-icon"].data});
						}
						setImg(parseInt(char["store-image-icon"].data));
						return;
					}
				}
				const {id: src, width, height} = JSON.parse(e.dataTransfer.getData("imageasset")),
				      tk = {src, width, height};
				setToken = () => fullToken(tk);
				setImg(src);
			}}, lang["TOKEN_USE_SELECTED"]),
			i
		])
	]),
	"mapMouseOver": (e: MouseEvent) => {
		if (e.target instanceof HTMLDivElement || cursor.parentNode || !token) {
			return;
		}
		const {layer} = globals.selected,
		      onmousemove = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY);
			createSVG(cursor, {x, y});
		      };
		if (!layer) {
			return;
		}
		onmousemove(e);
		layer[node].appendChild(cursor);
		createSVG(globals.root, {onmousemove, "1onmouseleave": () => {
			cursor.remove();
			globals.root.style.removeProperty("cursor");
			globals.root.removeEventListener("mousemove", onmousemove);
		}, "style": {"cursor": "none"}})
	},
	"mapMouseWheel": defaultMouseWheel
});

layersRPC.waitLayerSelect().then(() => {
	const {layer} = globals.selected;
	if (cursor.parentNode && layer) {
		layer[node].appendChild(cursor);
	}
});
