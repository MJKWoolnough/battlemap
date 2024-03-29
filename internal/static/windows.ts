import type {Children, Props} from './lib/dom.js';
import type {WindowElement} from './lib/windows.js';
import type {ShellElement} from './lib/windows_taskmanager.js';
import type {Int, Uint} from './types.js';
import {amendNode} from './lib/dom.js';
import {hasKeyEvent} from './lib/events.js';
import {isInt} from './lib/misc.js';
import {JSONSetting} from './lib/settings.js';
import {defaultIcon, desktop as adesktop, setDefaultIcon, setLanguage, shell as ashell, windows as awindows} from './lib/windows_taskmanager.js';
import lang from './language.js';
import {loading} from './shared.js';

export type {ShellElement, WindowElement};

export type WindowData = [Int, Int, Uint, Uint];

setLanguage(Object.fromEntries((["CANCEL", "CLOSE", "MAXIMISE", "MINIMISE", "OK", "RESTORE"] as (keyof typeof lang)[]).map(k => [k, lang[k]])));
setDefaultIcon(document.getElementsByTagName("link")[0]?.getAttribute("href") ?? defaultIcon);

const defaultParams = {"hide-maximise": true, "hide-minimise": true, "tabindex": -1, "onkeydown": function (this: WindowElement, e: KeyboardEvent) {
	if (e.key === "Escape" && !this.hasAttribute("hide-close") && !hasKeyEvent("Escape")) {
		this.close();
	}
      }},
      hideWindow = {"style": {"visibility": "hidden"}},
      showWindow = {"style": {"visibility": undefined}};

export const loadingWindow = <T>(p: Promise<T>, parent: ShellElement | WindowElement, title = lang["LOADING"], content?: Children) => {
	const w = awindows({"window-title": title, "hide-minimise": true}, content || loading());
	parent.addWindow(w);
	return p.finally(() => w.remove());
},
windows = (props?: Props | Children, children?: Children) => {
	const w = amendNode(awindows(defaultParams), props, children),
	      saveName = w.getAttribute("window-data");
	if (saveName) {
		const settings = new JSONSetting(saveName, getWindowData(w), checkWindowData),
		      save = () => settings.set(getWindowData(w));
		amendNode(w, {"style": {"--window-left": settings.value[0] + "px", "--window-top": settings.value[1] + "px", "--window-width": settings.value[2] + "px", "--window-height": settings.value[3] + "px"}, "onmoved": save, "onresized": save});
	} else if (!(w.style.getPropertyValue("--window-width") || w.style.getPropertyValue("--window-height"))) {
		amendNode(w, hideWindow);
		setTimeout(() => {
			if (w.parentNode === shell) {
				const {offsetWidth: width, offsetHeight: height} = w,
				      {offsetWidth: swidth, offsetHeight: sheight} = shell;
				amendNode(w, {"style": {"--window-width": width + "px", "--window-height": height + "px", "--window-left": `${(swidth - width) / 2}px`, "--window-top": `${(sheight - height) / 2}px`}});
			}
			amendNode(w, showWindow);
			w.focus();
		});
	}
	return w;
},
desktop = adesktop(),
shell = ashell({"snap": 50}, desktop),
getWindowData = (w: WindowElement): WindowData => [parseInt(w.style.getPropertyValue("--window-left") || "0"), parseInt(w.style.getPropertyValue("--window-top") || "0"), parseInt(w.style.getPropertyValue("--window-width") || "200"), parseInt(w.style.getPropertyValue("--window-height") || "600")],
checkWindowData = (v: any): v is WindowData => v instanceof Array && v.length === 4 && isInt(v[0]) && isInt(v[1]) && isInt(v[2], 0) && isInt(v[3], 0);
