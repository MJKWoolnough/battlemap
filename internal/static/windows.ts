import type {Int, Uint} from './types.js';
import type {DOMBind, Props, Children} from './lib/dom.js';
import type {ShellElement, WindowElement} from './lib/windows.js';
import {createHTML, div} from './lib/html.js';
import {desktop, shell as ashell, windows as awindows} from './lib/windows.js';
import {JSONSetting} from './settings_types.js';
import {isInt, isUint} from './shared.js';
import lang from './language.js';

export {ShellElement, WindowElement, desktop};

export type WindowData = [Int, Int, Uint, Uint];

const getWindowData = (w: WindowElement): WindowData => [parseInt(w.style.getPropertyValue("--window-left") || "0"), parseInt(w.style.getPropertyValue("--window-top") || "0"), parseInt(w.style.getPropertyValue("--window-width") || "200"), parseInt(w.style.getPropertyValue("--window-height") || "600")],
      checkWindowData = (v: any): v is WindowData => v instanceof Array && v.length === 4 && isInt(v[0]) && isInt(v[1]) && isUint(v[2]) && isUint(v[3]);

class WindowSettings extends JSONSetting<WindowData> {
	constructor(name: string, starting: WindowData) {
		super(name, starting, checkWindowData);
	}
}

export const loadingWindow = <T>(p: Promise<T>, parent: ShellElement|WindowElement, title = lang["LOADING"], content?: Children) => {
        const w = awindows({"windows-title": title}, content || div({"class": "loadSpinner"}));
        parent.addWindow(w);
        return p.finally(() => w.remove());
},
windows: DOMBind<WindowElement> = (props?: Props | Children, children?: Props | Children) => {
	const w = createHTML(awindows({"hide-maximise": "true", "tabindex": "-1", "onkeyup": function(this: WindowElement, e: KeyboardEvent) {
		if (e.key === "Escape" && !this.hasAttribute("hide-close")) {
			this.remove();
		}
	}}), props, children),
	      saveName = w.getAttribute("window-data");
	if (saveName) {
		const settings = new WindowSettings(saveName, getWindowData(w)),
		      save = () => settings.set(getWindowData(w));
		createHTML(w, {"style": {"--window-left": settings.value[0] + "px", "--window-top": settings.value[1] + "px", "--window-width": settings.value[2] + "px", "--window-height": settings.value[3] + "px"}, "onmoved": save, "onresized": save});
	} else if (!(w.style.getPropertyValue("--window-width") || w.style.getPropertyValue("--windows-height"))) {
		w.style.setProperty("visibility", "hidden");
		window.setTimeout(() => {
			if (w.parentNode) {
				const {offsetWidth: width, offsetHeight: height} = w,
				      {offsetWidth: swidth, offsetHeight: sheight} = w.parentNode as ShellElement;
				createHTML(w, {"style": {"--window-width": width + "px", "--window-height": height + "px", "--window-left": ((swidth - width) / 2) + "px", "--window-top": ((sheight - height) / 2) + "px"}});
			}
			w.style.removeProperty("visibility");
		});
	}
	return w;
},
shell = ashell();
