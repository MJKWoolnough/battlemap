import {iframe} from '../lib/html.js';
import {shell, windows} from '../windows.js';
import {globals} from '../shared.js';

const walkElements = (n: Element, ids: Map<string, string>) => {
	const styles = window.getComputedStyle(n);
	for (const s of styles) {
		if (s === "display") {
			if (styles.getPropertyValue(s) === "none") {
				return "";
			}
		}
	}
	let nodeName = n.nodeName;
	if (nodeName === "image") {
		const href = n.getAttribute("href");
		if (href && href.startsWith("/images/")) {
			nodeName = "use";
			if (!ids.has(href)) {
				ids.set(href, `PS${ids.size}`);
			}
		}
	} else if (nodeName === "text") {
		return "";
	}
	let data = `<${nodeName}`;
	for (const a of n.attributes) {
		if (a.name === "href" && nodeName != n.nodeName) {
			data += ` href="#${ids.get(a.value)}"`;
		} else if (a.name !== "class" && a.name !== "id") {
			data += ` ${a.name}=\"${escape(a.value)}\"`;
		}
	}
	if (n.children.length === 0) {
		data += " />";
	} else {
		data += ">";
		for (const c of n.children) {
			data += walkElements(c, ids);
		}
		data += `</${nodeName}>`;
	}
	return data;
};

document.body.addEventListener("keydown", (e: KeyboardEvent) => {
	if (e.key === "PrintScreen") {
		const {root, mapData: {width, height}} = globals,
		      svg = root.outerHTML,
		      p = svg.indexOf('>'),
		      ids = new Map<string, string>();
		let data = "";
		for (const c of root.children) {
			data += walkElements(c, ids);
		}
		shell.appendChild(windows(iframe({width, height, "src": "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style type="text/css">#outline,.hiddenLayer,text{display:none}g{clip-path: view-box}</style>${svg.slice(p).replaceAll("href=\"/images", `href="${window.location.origin}/images`)}`)})));
		e.preventDefault();
	}
});
