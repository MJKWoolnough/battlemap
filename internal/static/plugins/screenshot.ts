import {canvas, img} from '../lib/html.js';
import {shell, windows} from '../windows.js';
import {globals} from '../shared.js';

const walkElements = (n: Element) => {
	const styles = window.getComputedStyle(n);
	for (const s of styles) {
		if (s === "display") {
			if (styles.getPropertyValue(s) === "none") {
				return "";
			}
		}
	}
	let data = `<${n.nodeName}`;
	for (const a of n.attributes) {
		if (a.name === "href" && n.nodeName === "image") {
			data += ` href="#${window.location.host}${a.value}"`;
		} else {
			data += ` ${a.name}=\"${a.value}\"`;
		}
	}
	if (n.children.length === 0) {
		data += " />";
	} else {
		data += ">";
		for (const c of n.children) {
			data += walkElements(c);
		}
		data += `</${n.nodeName}>`;
	}
	return data;
};

document.body.addEventListener("keydown", (e: KeyboardEvent) => {
	if (e.key === "PrintScreen") {
		const {root, mapData: {width, height}} = globals,
		      c = canvas({width, height}),
		      ctx = c.getContext("2d")!;
		let data = "";
		for (const c of root.children) {
			data += walkElements(c);
		}
		ctx.drawImage(img({"crossorigin": "anonymous", "src": "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${data}</svg>`)}), 0, 0);
		shell.appendChild(windows(c));
		e.preventDefault();
	}
});
