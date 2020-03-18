import {createHTML} from './lib/html.js';
import {div} from './lib/dom.js';
import {Shell as WindowsShell, WindowOptions, DialogOptions} from './lib/windows.js';

type hasClose = {
	showClose?: boolean;
}

const addEscapeClose = (shell: WindowsShell, window: HTMLDivElement, options?: hasClose) => {
	if (options && options.showClose) {
		window.setAttribute("tabindex", "-1");
		window.addEventListener("keyup", (e: KeyboardEvent) => {
			if (e.keyCode === 27) {
				shell.closeWindow(window);
			}
		});
	}
	return window;
};

export class Shell extends WindowsShell {
	addLoading(w: HTMLDivElement | null, p: Promise<any>, title = "Loading", content?: HTMLElement) {
		return p.finally(this.removeWindow.bind(this, createHTML(this.addDialog(w, {
			"showTitlebar": true,
			"title": title
		}), content ? content : div({"class": "loadSpinner"}))));
	}
	addWindow(title: string, options?: WindowOptions): HTMLDivElement {
		return addEscapeClose(this, super.addWindow(title, options), options);
	}
	addDialog(parent: HTMLDivElement | null, options?: DialogOptions): HTMLDivElement {
		return addEscapeClose(this, super.addDialog(parent, options), options);
	}
}
