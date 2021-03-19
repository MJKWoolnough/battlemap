import {canvas, img} from '../lib/html.js';
import {shell, windows} from '../windows.js';
import {colour2RGBA} from '../colours.js';
import {globals} from '../shared.js';

const walkElements = (n: Element, ctx: CanvasRenderingContext2D, p: Promise<void>) => {
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
		p = p.then(() => {
			ctx.setTransform((n as SVGImageElement).getCTM()!);
			ctx.drawImage(n as SVGImageElement, 0, 0, parseInt(n.getAttribute("width")!), parseInt(n.getAttribute("height")!));
			ctx.resetTransform();
		});
		break;
	case "rect":
		if (n.getAttribute("fill")?.startsWith("url(#Pattern_")) {
			const pattern = globals.definitions.list.get(n.getAttribute("fill")!.slice(5, -1))?.firstChild
			if (pattern && pattern instanceof SVGImageElement) {
				p = p.then(() => {
					const fs = ctx.fillStyle,
					      width = parseInt(pattern.getAttribute("width")!),
					      height = parseInt(pattern.getAttribute("height")!),
					      oc = canvas({width, height});
					oc.getContext("2d")!.drawImage(pattern, 0, 0, width, height);
					ctx.fillStyle = ctx.createPattern(oc, "repeat")!;
					ctx.setTransform((n as SVGRectElement).getCTM()!);
					ctx.fillRect(0, 0, parseInt(n.getAttribute("width")!), parseInt(n.getAttribute("height")!));
					ctx.resetTransform();
					ctx.fillStyle = fs;
				});
			}
			break;
		}
	case "polygon":
	case "ellipse":
		break;
	case "g":
		if (id === "layerGrid") {
			p = p.then(() => new Promise(sfn => {
				const {width, height} = globals.mapData;
				img({"src": `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${globals.definitions.list.get("grid")!.outerHTML}</defs>${n.innerHTML}</svg>`)}`, width, height, "onload": function(this: HTMLImageElement) {
					ctx.drawImage(this, 0, 0);
					sfn();
				}});
			}));
			return p;
		} else if (id === "layerLight") {
			p = p.then(() => {
				const {lightColour, width, height} = globals.mapData,
				      fs = ctx.fillStyle;
				ctx.fillStyle = colour2RGBA(lightColour);
				ctx.fillRect(0, 0, width, height);
				ctx.fillStyle = fs;
			});
			return p;
		} else if (n.getAttribute("class") === "hiddenLayer") {
			return p;
		}
		break;
	case "defs":
		return p;
	}
	for (const c of n.children) {
		p = walkElements(c, ctx, p);
	}
	return p;
};

document.body.addEventListener("keydown", (e: KeyboardEvent) => {
	if (e.key === "PrintScreen") {
		const {root, mapData: {width, height}} = globals,
		      c = canvas({width, height}),
		      ctx = c.getContext("2d")!;
		let p = Promise.resolve();
		for (const c of root.children) {
			p = walkElements(c, ctx, p);
		}
		p.then(() => shell.appendChild(windows(c)));
		e.preventDefault();
	}
});
