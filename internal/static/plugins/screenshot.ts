import {amendNode} from '../lib/dom.js';
import {a, br, button, canvas, div, img, input} from '../lib/html.js';
import {node} from '../lib/nodes.js';
import {BoolSetting} from '../lib/settings.js';
import {ns as svgNS} from '../lib/svg.js';
import {hiddenLayer, layerGrid, layerLight, settingsTicker} from '../ids.js';
import {registerKeyEvent} from '../keys.js';
import mainLang, {makeLangPack} from '../language.js';
import {mapData, panZoom, root} from '../map.js';
import {definitions} from '../map_tokens.js';
import {addPlugin} from '../plugins.js';
import {labels} from '../shared.js';
import {shell, windows} from '../windows.js';

let defs = "";

const icon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cg stroke="%23000"%3E%3Crect x="2" y="2" width="96" height="96" stroke-width="4" stroke-dasharray="20 8" fill="%2388f" /%3E%3Cpath d="M10,40 v-15 q0,-2 2,-2 h75 q2,0 2,2 v17 z" fill="%23aaa" /%3E%3Cpath d="M10,40 v30 q0,2 2,2 h75 q2,0 2,-2 v-30 z m5,-17 v-3 q0,-2 2,-2 h12 q2,0 2,2 v3 z" fill="%23333" /%3E%3Ccircle cx="50" cy="50" r="18" fill="%23888" /%3E%3Ccircle cx="50" cy="50" r="12" fill="%23111" /%3E%3Crect x="70" y="36" width="15" height="8" rx="1" fill="%23cc0" /%3E%3C/g%3E%3Crect x="86" width="3" y="23.5" height="48" fill="rgba(0, 0, 0, 0.25)" /%3E%3Crect x="82" width="3" y="36" height="8" fill="rgba(0, 0, 0, 0.25)" /%3E%3C/svg%3E`,
      style = `<script type="text/css">#lighting>*{mix-blend-mode:screen;}</script>`,
      walkElements = (n: Element, ctx: CanvasRenderingContext2D, ctm: DOMMatrix, p: Promise<void>) => {
	const styles = window.getComputedStyle(n);
	for (const s of styles) {
		if (s === "display") {
			if (styles.getPropertyValue(s) === "none") {
				return p;
			}
		}
	}
	switch (n.nodeName) {
	case "image":
		return p.then(() => {
			ctx.setTransform(ctm.multiply((n as SVGImageElement).getCTM()!));
			ctx.drawImage(n as SVGImageElement, 0, 0, parseInt(n.getAttribute("width")!), parseInt(n.getAttribute("height")!));
			ctx.resetTransform();
		});
	case "rect":
		if (n.getAttribute("fill")?.startsWith("url(#Pattern_")) {
			const pattern = definitions.list.get(n.getAttribute("fill")!.slice(5, -1))?.firstChild;
			if (pattern instanceof SVGImageElement) {
				return p.then(() => {
					const fs = ctx.fillStyle,
					      width = parseInt(pattern.getAttribute("width")!),
					      height = parseInt(pattern.getAttribute("height")!),
					      oc = canvas({width, height});
					oc.getContext("2d")!.drawImage(pattern, 0, 0, width, height);
					ctx.fillStyle = ctx.createPattern(oc, "repeat")!;
					ctx.setTransform(ctm.multiply((n as SVGRectElement).getCTM()!));
					ctx.fillRect(0, 0, parseInt(n.getAttribute("width")!), parseInt(n.getAttribute("height")!));
					ctx.resetTransform();
					ctx.fillStyle = fs;
				});
			}
			break;
		}
	case "polygon":
	case "ellipse":
		return p.then(() => new Promise<void>(sfn => {
			const {width, height} = mapData;
			img({"src": `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${svgNS}" width="${width}" height="${height}">${definitions[node].outerHTML}${n.outerHTML}</svg>`)}`, width, height, "onload": function(this: HTMLImageElement) {
				ctx.drawImage(this, 0, 0);
				sfn();
			}});
		}));
	case "defs":
		defs = style + n.outerHTML;
		return p;
	case "g":
		const id = n.getAttribute("id");
		if (id === layerGrid) {
			if (hideGrid.value) {
				return p;
			}
			return p.then(() => new Promise<void>(sfn => {
				const {width, height} = mapData;
				img({"src": `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${svgNS}" width="${width}" height="${height}"><defs>${definitions.list.get("grid")!.outerHTML}</defs>${n.innerHTML}</svg>`)}`, width, height, "onload": function(this: HTMLImageElement) {
					ctx.drawImage(this, 0, 0);
					sfn();
				}});
			}));
		} else if (id === layerLight) {
			for (const c of n.childNodes as any as SVGElement[]) {
				p = p.then(() => new Promise<void>(sfn => {
					const {width, height} = mapData;
					img({"src": `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${svgNS}" width="${width}" height="${height}">${defs}${c.outerHTML.replace("mix-blend-mode", "mix-blend-mod")}</svg>`)}`, "onload": function(this: HTMLImageElement) {
						ctx.globalCompositeOperation = ((c as SVGElement).style.getPropertyValue("mix-blend-mode") || "none") as GlobalCompositeOperation;
						ctx.drawImage(this, 0, 0);
						ctx.globalCompositeOperation = "source-over";
						sfn();
					}});
				}));
			}
			return p;
		} else if (n.classList.contains(hiddenLayer)) {
			return p;
		}
	}
	for (const c of n.children) {
		p = walkElements(c, ctx, ctm, p);
	}
	return p;
      },
      lang = makeLangPack({
	"ENABLE_GRID": "Show Grid on Screenshot",
	"ENABLE_PNG": "Automatic PNG creation",
	"ERROR_GENERATING": "Unknown error while generating PNG",
	"KEY_SCREENSHOT": "Screenshot Key",
	"SCREENSHOT_TAKE": "Take Screenshot"
      }),
      disablePNG = new BoolSetting("plugin-screenshot-png"),
      hideGrid = new BoolSetting("plugin-screenshot-grid"),
      makeScreenshot = () => {
	const {width, height} = mapData,
	      c = canvas({width, height, "style": "max-width: 100%;max-height: 100%"}),
	      ctx = c.getContext("2d")!,
	      ctm = new DOMMatrix().scaleSelf(panZoom.zoom, panZoom.zoom, 1, width / 2, height / 2).inverse(),
	      now = new Date(),
	      title = `${now.getFullYear()}-${("0" + (now.getMonth()+1)).slice(-2)}-${("0" + now.getDate()).slice(-2)}_${("0" + now.getHours()).slice(-2)}-${("0" + now.getMinutes()).slice(-2)}-${("0" + now.getSeconds()).slice(-2)}`;
	let p = Promise.resolve();
	for (const c of root.children) {
		p = walkElements(c, ctx, ctm, p);
	}
	p.then(() => {
		const link = a({"download": `${title}.png`}, c),
		      w = windows({"window-icon": icon, "window-title": title}, link);
		amendNode(shell, w);
		if (!disablePNG.value) {
			c.toBlob(b => {
				if (b) {
					const href = URL.createObjectURL(b);
					amendNode(link, {href});
					amendNode(w, {"onremove": () => URL.revokeObjectURL(href)});
				} else {
					w.alert(mainLang["ERROR"], lang["ERROR_GENERATING"], icon);
				}
			});
		}
	});
      };

addPlugin("screenshot", {
	"settings": {
		"fn": div([
			([[hideGrid, "ENABLE_GRID"], [disablePNG, "ENABLE_PNG"]] as [BoolSetting, keyof typeof lang][]).map(([s, l]) => [labels(input({"type": "checkbox", "class": settingsTicker, "checked": !s.value, "onchange": function(this: HTMLInputElement) {
				s.set(!this.checked);
			}}), [lang[l], ": "]), br()]),
			button({"onclick": makeScreenshot}, lang["SCREENSHOT_TAKE"])
		])
	}
});

registerKeyEvent("screenshot-key", lang["KEY_SCREENSHOT"], "PrintScreen", (e: KeyboardEvent) => {
	makeScreenshot();
	e.preventDefault();
})[0]();
