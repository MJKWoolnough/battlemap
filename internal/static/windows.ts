import {DOMBind, Props, Children} from './lib/dom.js';
import {createHTML, div} from './lib/html.js';
import {ShellElement, WindowElement, desktop, shell, windows as awindows} from './lib/windows.js';

export {ShellElement, WindowElement, desktop, shell};

export const loadingWindow = (p: Promise<any>, parent: ShellElement|WindowElement, title = "Loading", content?: Children) => {
        const w = awindows({"windows-title": title}, content || div({"class": "loadSpinner"}));
        parent.addWindow(w);
        return p.finally(() => w.remove());
},
windows: DOMBind<WindowElement> = (props?: Props | Children, children?: Props | Children) => {
	const w = createHTML(awindows({"hide-maximise": "true", "tabindex": "-1", "onkeyup": function(this: WindowElement, e: KeyboardEvent) {
		if (e.key === "Escape") {
			this.remove();
		}
	}}), props, children);
	if (!(w.style.getPropertyValue("--window-width") || w.style.getPropertyValue("--windows-height"))) {
		w.style.setProperty("visibility", "hidden");
		window.setTimeout(() => {
			const {offsetWidth: width, offsetHeight: height} = w,
			      {offsetWidth: swidth, offsetHeight: sheight} = w.parentNode as ShellElement;
			w.style.setProperty("--window-width", width + "px");
			w.style.setProperty("--window-height", height + "px");
			w.style.setProperty("--window-left", ((swidth - width) / 2) + "px");
			w.style.setProperty("--window-top", ((sheight - height) / 2) + "px");
			w.style.removeProperty("visibility");
		}, 0);
	}
	return w;
};
