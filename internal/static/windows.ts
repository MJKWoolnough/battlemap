import {createHTML} from './lib/html.js';
import {div} from './lib/dom.js';
import {Shell as WindowsShell, WindowOptions} from './lib/windows.js';

export class Shell extends WindowsShell {
	addLoading(w: HTMLDivElement | null, p: Promise<any>, title = "Loading", content?: HTMLElement) {
		return p.finally(this.removeWindow.bind(this, createHTML(this.addDialog(w, {
			"showTitlebar": true,
			"title": title
		}), content ? content : div({"class": "loadSpinner"}))));
	}
}
