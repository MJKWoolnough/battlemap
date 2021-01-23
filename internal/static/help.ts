import {div, h1, span} from './lib/html.js';
import {svg, animate, animateMotion, animateTransform, circle, g, path, rect, text} from './lib/svg.js';
import {shell, windows} from './windows.js';
import lang from './language.js';

const help = windows({"title": lang["HELP"], "maximised": true}, div({"id": "help"}, [
	h1(lang["HELP"])
]));

export default function () {
	if (!help.parentNode) {
		shell.appendChild(help);
	} else {
		help.remove();
	}
}
