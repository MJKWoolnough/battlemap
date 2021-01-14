import {Int, Uint} from './types.js';
import {DOMBind, Props, Children} from './lib/dom.js';
import {createHTML, div} from './lib/html.js';
import {ShellElement, WindowElement, desktop, shell, windows as awindows} from './lib/windows.js';
import {JSONSetting} from './settings_types.js';
import {isInt, isUint} from './misc.js';
import lang from './language.js';

export {ShellElement, WindowElement, desktop, shell};

type WindowData = [Int, Int, Uint, Uint];

export class WindowSettings extends JSONSetting<WindowData> {
	constructor(name: string, starting: WindowData) {
		super(name, starting, (v: any): v is WindowData => v instanceof Array && v.length === 4 && isInt(v[0]) && isInt(v[1]) && isUint(v[2]) && isUint(v[3]));
	}
}

export const loadingWindow = <T>(p: Promise<T>, parent: ShellElement|WindowElement, title = lang["LOADING"], content?: Children) => {
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
			if (w.parentNode) {
				const {offsetWidth: width, offsetHeight: height} = w,
				      {offsetWidth: swidth, offsetHeight: sheight} = w.parentNode as ShellElement;
				createHTML(w, {"--window-width": width + "px", "--window-height": height + "px", "--window-left": ((swidth - width) / 2) + "px", "--window-top": ((sheight - height) / 2) + "px"});
			}
			w.style.removeProperty("visibility");
		}, 0);
	}
	return w;
};
