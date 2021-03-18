import {img} from '../lib/html.js';
import {shell, windows} from '../windows.js';
import {globals} from '../shared.js';

document.body.addEventListener("keydown", (e: KeyboardEvent) => {
	if (e.key === "PrintScreen") {
		const {root, mapData: {width, height}} = globals,
		      svg = root.outerHTML,
		      p = svg.indexOf('>');
		shell.appendChild(windows(img({"width": "100", "src": "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style type="text/css">#outline,.hiddenLayer{display:none}g{clip-path: view-box}</style>${svg.slice(p).replaceAll("href=\"/images", `href="${window.location.origin}/images`)}`)})));
		e.preventDefault();
	}
});
