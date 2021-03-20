import {a, canvas, img} from '../lib/html.js';
import {shell, windows} from '../windows.js';
import {colour2RGBA} from '../colours.js';
import {globals} from '../shared.js';
import {panZoom} from '../tools_default.js';

const icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Cg stroke="%23000"%3E%3Crect x="2" y="2" width="96" height="96" stroke-width="4" stroke-dasharray="20 8" fill="%2388f" /%3E%3Cpath d="M10,40 v-15 q0,-2 2,-2 h75 q2,0 2,2 v17 z" fill="%23aaa" /%3E%3Cpath d="M10,40 v30 q0,2 2,2 h75 q2,0 2,-2 v-30 z m5,-17 v-3 q0,-2 2,-2 h12 q2,0 2,2 v3 z" fill="%23333" /%3E%3Ccircle cx="50" cy="50" r="18" fill="%23888" /%3E%3Ccircle cx="50" cy="50" r="12" fill="%23111" /%3E%3Crect x="70" y="36" width="15" height="8" rx="1" fill="%23cc0" /%3E%3C/g%3E%3Crect x="86" width="3" y="23.5" height="48" fill="rgba(0, 0, 0, 0.25)" /%3E%3Crect x="82" width="3" y="36" height="8" fill="rgba(0, 0, 0, 0.25)" /%3E%3C/svg%3E',
      walkElements = (n: Element, ctx: CanvasRenderingContext2D, ctm: DOMMatrix, p: Promise<void>) => {
	const styles = window.getComputedStyle(n);
	for (const s of styles) {
		if (s === "display") {
			if (styles.getPropertyValue(s) === "none") {
				return p;
			}
		}
	}
	const id = n.getAttribute("id");
	switch (n.nodeName) {
	case "image":
		return p.then(() => {
			ctx.setTransform(ctm.multiply((n as SVGImageElement).getCTM()!));
			ctx.drawImage(n as SVGImageElement, 0, 0, parseInt(n.getAttribute("width")!), parseInt(n.getAttribute("height")!));
			ctx.resetTransform();
		});
	case "rect":
		if (n.getAttribute("fill")?.startsWith("url(#Pattern_")) {
			const pattern = globals.definitions.list.get(n.getAttribute("fill")!.slice(5, -1))?.firstChild;
			if (pattern && pattern instanceof SVGImageElement) {
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
			const {width, height} = globals.mapData;
			img({"src": `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${n.outerHTML}</svg>`)}`, width, height, "onload": function(this: HTMLImageElement) {
				ctx.drawImage(this, 0, 0);
				sfn();
			}});
		}));
	case "g":
		if (id === "layerGrid") {
			return p.then(() => new Promise<void>(sfn => {
				const {width, height} = globals.mapData;
				img({"src": `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${globals.definitions.list.get("grid")!.outerHTML}</defs>${n.innerHTML}</svg>`)}`, width, height, "onload": function(this: HTMLImageElement) {
					ctx.drawImage(this, 0, 0);
					sfn();
				}});
			}));
		} else if (id === "layerLight") {
			return p.then(() => {
				const {lightColour, width, height} = globals.mapData,
				      fs = ctx.fillStyle;
				ctx.fillStyle = colour2RGBA(lightColour);
				ctx.fillRect(0, 0, width, height);
				ctx.fillStyle = fs;
			});
		} else if (n.getAttribute("class") === "hiddenLayer") {
			return p;
		}
		break;
	case "defs":
		return p;
	}
	for (const c of n.children) {
		p = walkElements(c, ctx, ctm, p);
	}
	return p;
};

document.body.addEventListener("keydown", (e: KeyboardEvent) => {
	if (e.key === "PrintScreen") {
		const {root, mapData: {width, height}} = globals,
		      c = canvas({width, height}),
		      ctx = c.getContext("2d")!,
		      ctm = new DOMMatrix().scaleSelf(panZoom.zoom, panZoom.zoom, 1, width / 2, height / 2).inverse(),
		      now = new Date(),
		      title = `${now.getFullYear()}-${("0" + (now.getMonth()+1)).slice(-2)}-${("0" + now.getDate()).slice(-2)}_${("0" + now.getHours()).slice(-2)}-${("0" + now.getMinutes()).slice(-2)}-${("0" + now.getSeconds()).slice(-2)}`;
		let p = Promise.resolve();
		for (const c of root.children) {
			p = walkElements(c, ctx, ctm, p);
		}
		p.then(() => c.toBlob(b => {
			const src = URL.createObjectURL(b),
			      i = img({src, "style": "max-width: 100%; height: 100%", "1onload": () => {
				shell.appendChild(windows({"window-icon": icon, "window-title": title}, a({"href": src, "download": `${title}.png`}, i)));
			      }})
		}));
		e.preventDefault();
	}
});
