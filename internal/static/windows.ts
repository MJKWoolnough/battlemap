import {DOMBind, Props, Children} from './lib/dom.js';
import {createHTML, div} from './lib/html.js';
import {ShellElement, WindowElement, desktop, shell, windows as awindows} from './lib/windows.js';

export {ShellElement, WindowElement, desktop, shell};

export const loadingWindow = (p: Promise<any>, parent: ShellElement|WindowElement, title = "Loading", content?: Children) => {
        const w = awindows({"windows-title": title}, content || div({"class": "loadSpinner"}));
        parent.addWindow(w);
        return p.finally(() => w.remove());
},
windows: DOMBind<WindowElement> = (props?: Props | Children, children?: Props | Children) => createHTML(awindows({"hide-maximise": "true", "tabindex": "-1", "onkeyup": function(this: WindowElement, e: KeyboardEvent) {
	if (e.key === "Escape") {
		this.remove();
	}
}}), props, children);
