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
	addWindow(title: string, options?: WindowOptions) {
		const window = super.addWindow(title, options);
		if (options && options.showClose) {
			window.setAttribute("tabindex", "-1");
			window.addEventListener("keyup", (e: KeyboardEvent) => {
				if (e.keyCode === 27) {
					this.removeWindow(window);
				}
			});
		}
		return window;
	}
}
