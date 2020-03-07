import {createHTML} from './lib/html.js';
import {div} from './lib/dom.js';
import {Shell as WindowsShell, WindowOptions} from './lib/windows.js';

export class Shell extends WindowsShell {
	addWindow(title: string, options?: WindowOptions) {
		const w = super.addWindow(title, options),
		      p = w.parentNode as HTMLElement;
		if (options && options.resizeable) {
			p.style.setProperty("--window-left", "20px");
			p.style.setProperty("--window-top", "20px");
		} else {
			p.style.setProperty("--window-left", "50%");
			p.style.setProperty("--window-top", "50%");
			p.style.setProperty("transform", "translateX(-50%) translateY(-50%)");
		}
		return w;
	}
	addLoading(w: HTMLDivElement | null, p: Promise<any>, title = "Loading", content?: HTMLElement) {
		return p.finally(this.removeWindow.bind(this, createHTML(this.addDialog(w, {
			"showTitlebar": true,
			"title": title
		}), content ? content : div({"class": "loadSpinner"}))));
	}
}
