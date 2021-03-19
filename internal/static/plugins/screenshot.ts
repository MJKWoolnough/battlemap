import {canvas, img} from '../lib/html.js';
import {shell, windows} from '../windows.js';
import {colour2RGBA} from '../colours.js';
import {globals} from '../shared.js';

const walkElements = (n: Element, ctx: CanvasRenderingContext2D) => {
	const styles = window.getComputedStyle(n);
	for (const s of styles) {
		if (s === "display") {
			if (styles.getPropertyValue(s) === "none") {
				return;
			}
		}
	}
	const id = n.getAttribute("id");
	switch (n.nodeName) {
	case "image":
		ctx.setTransform((n as SVGImageElement).getCTM()!);
		ctx.drawImage(n as SVGImageElement, 0, 0, parseInt(n.getAttribute("width")!), parseInt(n.getAttribute("height")!));
		ctx.resetTransform();
		break;
	case "rect":
		if (n.getAttribute("fill")?.startsWith("url(#Pattern_")) {
			const p = globals.definitions.list.get(n.getAttribute("fill")!.slice(5, -1));
			if (p && p.firstChild instanceof SVGImageElement) {
				const fs = ctx.fillStyle,
				      width = parseInt(p.firstChild.getAttribute("width")!),
				      height = parseInt(p.firstChild.getAttribute("height")!),
				      oc = canvas({width, height});
				oc.getContext("2d")!.drawImage(p.firstChild, 0, 0, width, height);
				ctx.fillStyle = ctx.createPattern(oc, "repeat")!;
				ctx.setTransform((n as SVGRectElement).getCTM()!);
				ctx.fillRect(0, 0, parseInt(n.getAttribute("width")!), parseInt(n.getAttribute("height")!));
				ctx.resetTransform();
				ctx.fillStyle = fs;
			}
			break;
		}
	case "polygon":
	case "ellipse":
		break;
	case "g":
		if (id === "layerGrid") {
			const {width, height} = globals.mapData;
			img({"src": `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${globals.definitions.list.get("grid")!.outerHTML}</defs>${n.innerHTML}</svg>`)}`, width, height, "onload": function(this: HTMLImageElement) {
				ctx.drawImage(this, 0, 0);
			}});
			return;
		} else if (id === "layerLight") {
			const {lightColour, width, height} = globals.mapData,
			      fs = ctx.fillStyle;
			ctx.fillStyle = colour2RGBA(lightColour);
			ctx.fillRect(0, 0, width, height);
			ctx.fillStyle = fs;
			return;
		}
		break;
	case "defs":
		return;
	}
	for (const c of n.children) {
		walkElements(c, ctx);
	}
};

document.body.addEventListener("keydown", (e: KeyboardEvent) => {
	if (e.key === "PrintScreen") {
		const {root, mapData: {width, height}} = globals,
		      c = canvas({width, height}),
		      ctx = c.getContext("2d")!;
		for (const c of root.children) {
			walkElements(c, ctx);
		}
		shell.appendChild(windows(c));
		e.preventDefault();
	}
});
