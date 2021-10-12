import type {WindowElement, WindowData} from './windows.js';
import RPC, {rpc, handleError} from './rpc.js';
import {createHTML, createDocumentFragment, clearElement, autoFocus} from './lib/dom.js';
import {div, h2, img, input, label, span} from './lib/html.js';
import {symbol, path, circle, animateTransform} from './lib/svg.js';
import assets, {imageIcon, audioIcon} from './assets.js';
import musicPacks, {userMusic, musicIcon} from './musicPacks.js';
import mapList, {mapIcon} from './mapList.js';
import layerList, {layerIcon} from './layerList.js';
import characters from './characterList.js';
import loadMap from './adminMap.js';
import loadUserMap from './map.js';
import {shell, desktop, windows, getWindowData, checkWindowData} from './windows.js';
import settings, {hideMenu, invert, panelOnTop, settingsIcon, tabIcons} from './settings.js';
import tools, {toolsIcon} from './tools.js';
import {characterIcon} from './characters.js';
import {addCSS, isAdmin, mod} from './shared.js';
import symbols, {addSymbol} from './symbols.js';
import keyEvent from './keys.js';
import './tools_draw.js';
import './tools_light.js';
import './tools_mask.js';
import './tools_measure.js';
import './tools_move.js';
import './tools_multiplace.js';
import help from './help.js';
import pluginInit, {menuItems} from './plugins.js';
import './messaging.js';
import lang from './language.js';
import {BoolSetting, IntSetting, JSONSetting, StringSetting} from './settings_types.js';

type savedWindow = {
	out: boolean;
	data: WindowData
}

declare const pageLoad: Promise<void>;

document.title = lang["TITLE"];

const popout = addSymbol("popout", symbol({"viewBox": "0 0 15 15"}, path({"d": "M7,1 H1 V14 H14 V8 M9,1 h5 v5 m0,-5 l-6,6", "stroke-linejoin": "round", "fill": "none", "stroke": "currentColor"}))),
      loading = addSymbol("loading", symbol({"viewBox": "0 0 10 10"}, circle({"cx": 5, "cy": 5, "r": 4, "stroke-width": 2, "stroke": "currentColor", "fill": "none", "stroke-linecap": "round", "stroke-dasharray": "12 12"}, animateTransform({"attributeName": "transform", "type": "rotate", "from": "0 5 5", "to": "360 5 5", "dur": "2s", "repeatCount": "indefinite"})))),
      lastTab = new StringSetting("lastTab"),
      tabs = (function() {
	let n = 0, moved = false;
	const panelShow = new BoolSetting("panelShow"),
	      panelWidth = new IntSetting("panelWidth", "300"),
	      windowSettings = new JSONSetting<Record<string, savedWindow>>("windowData", {}, (v: any): v is Record<string, savedWindow> => {
		if (!(v instanceof Object)) {
			return false;
		}
		for (const key in v) {
			const kv = v[key];
			if (typeof kv !== "object" || typeof kv.out !== "boolean" || !checkWindowData(kv.data)) {
				return false;
			}
		}
		return true;
	      }),
	      mousemove = function(e: MouseEvent) {
		if (e.clientX > 0) {
			const x = document.body.clientWidth - e.clientX;
			panelWidth.set(x);
			h.style.setProperty("--panel-width", `${x}px`);
			moved = true;
		}
	      },
	      mouseUp = (e: MouseEvent) => {
		if (e.button !== 0) {
			return;
		}
		window.removeEventListener("mousemove", mousemove);
		window.removeEventListener("mouseup", mouseUp);
	      },
	      c = input({"id": "panelHider", "type": "checkbox", "checked": panelShow.value, "onchange": () => panelShow.set(c.checked)}),
	      t = div({"id": "tabLabels"}),
	      p = div({"id": "panelContainer"}),
	      m = label({"title": lang["PANEL_GRABBER"], "for": "panelHider", "class": hideMenu.value ? "menuHide" : undefined, "id": "panelGrabber", "onmousedown": (e: MouseEvent) => {
			if (e.button !== 0) {
				return;
			}
			if (!c.checked) {
				window.addEventListener("mousemove", mousemove);
				window.addEventListener("mouseup", mouseUp);
			}
			moved = false;
	      }, "onclick": (e: MouseEvent) => {
		if (moved) {
			e.preventDefault();
		}
	      }}),
	      tc = div({"id": "tabs"}, [t, p]),
	      h = div({"id": "panels", "style": {"--panel-width": `${panelWidth.value}px`}}, [
		m,
		tc
	      ]),
	      windowData: Record<string, savedWindow> = windowSettings.value,
	      updateWindowData = () => windowSettings.set(windowData),
	      updateWindowDims = function (this: WindowElement) {
		windowData[this.getAttribute("window-title") || ""] = {
			"out": true,
			"data": getWindowData(this)
		};
		updateWindowData();
	      },
	      tabs: [string, HTMLLabelElement][] = [],
	      selectFirst = () => {
		for (const [_, t] of tabs) {
			if (t.style.getPropertyValue("display") !== "none") {
				if (t.control) {
					t.control.click();
				} else {
					t.click();
				}
				return;
			}
		};
	      },
	      o = Object.freeze({
		"add": (title: string, contents: Node, pop: boolean, popIcon: string) => {
			const base = p.appendChild(div(contents)),
			      pos = n++,
			      i = tc.insertBefore(input({"id": `tabSelector_${n}`, "name": "tabSelector", "type": "radio"}), t),
			      popper = pop ? popout({"class": "popout", "title": `Popout ${title}`, "onclick": (e: Event) => {
					const replaced = div();
					p.replaceChild(replaced, base);
					if (windowData[title]) {
						windowData[title]["out"] = true;
					} else {
						windowData[title] = {"out": true, "data": [20, 20, 0, 0]};
					}
					updateWindowData();
					const [x, y, width, height] = windowData[title].data,
					      w = shell.appendChild(autoFocus(windows({"window-icon": popIcon, "window-title": title, "resizable": "true", "style": {"min-width": "45px", "--window-left": x + "px", "--window-top": y + "px", "--window-width": width === 0 ? undefined : width + "px", "--window-height": height === 0 ? undefined : height + "px"}, "onremove": () => {
						p.replaceChild(base, replaced);
						l.style.removeProperty("display");
						windowData[title]["out"] = false;
						updateWindowData();
						base.dispatchEvent(new CustomEvent("popin", {"cancelable": false}));
					      }, "onmoved": updateWindowDims, "onresized": updateWindowDims}, base)));
					e.preventDefault();
					l.style.setProperty("display", "none");
					if (i.checked) {
						selectFirst()
					}
					base.dispatchEvent(new CustomEvent("popout", {"cancelable": false, "detail": w}));
			      }}) : null,
			      l = t.appendChild(label({title, "tabindex": -1, "for": `tabSelector_${n}`, "onkeyup": (e: KeyboardEvent) => {
				let a = pos, n = 1;
				switch (e.key) {
				case "ArrowLeft":
					n = -1;
				case "ArrowRight":
					do {
						a = mod(a + n, tabs.length);
					} while (a !== pos && tabs[a]![1].style.getPropertyValue("display") === "none");
					break;
				case "Enter":
					l.click();
				default:
					return;
				}
				tabs[a]![1].focus();
			      }, "onclick": () => lastTab.set(title)}, [
				img({"src": popIcon}),
				span(title),
				popper ? popper : []
			      ]));
			tabs.push([title, l]);
			if (popper && windowData[title] && windowData[title]["out"]) {
				window.setTimeout(() => popper.dispatchEvent(new MouseEvent("click")));
			}
			return base;
		},
		get css() {
			return `
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #panelContainer > div:nth-child(${n+1})`).join(",")}{display: block}
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #tabLabels > label:nth-child(${n+1})`).join(",")}{border-bottom-color:var(--c);z-index:2;background:var(--c) !important;cursor:default !important}
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #tabLabels > label:nth-child(${n+1}):before`).join(",")}{box-shadow: 2px 2px 0 var(--c)}
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #tabLabels > label:nth-child(${n+1}):after`).join(",")}{box-shadow: -2px 2px 0 var(--c)}
`;
		},
	        setTab(title: string) {
			for (const [t, tab] of tabs) {
				if (t === title) {
					if (tab.control) {
						tab.control.click();
					} else {
						tab.click();
					}
					return;
				}
			}
			selectFirst();
		},
		get html() {return createDocumentFragment([c , h]);}
	});
	hideMenu.wait((value: boolean) => m.classList.toggle("menuHide", value));
	keyEvent("F9", (e: KeyboardEvent) => {
		panelShow.set(c.checked = !c.checked);
		e.preventDefault();
	});
	keyEvent("F1", (e: KeyboardEvent) => {
		help();
		e.preventDefault();
	});
	return o;
      }()),
      spinner = (id: string) => createDocumentFragment([h2({"id": id}, lang["LOADING"]), loading({"style": "width: 64px"})]),
      base = desktop(symbols);

createHTML(shell, {"snap": 50}, base);

invert.wait((v: boolean) => document.documentElement.classList.toggle("invert", v));
tabIcons.wait((b: boolean) => document.documentElement.classList.toggle("tabIcons", b));
panelOnTop.wait((p: boolean) => document.documentElement.classList.toggle("panelOnTop", p));

pageLoad.then(() => RPC(`ws${window.location.protocol.slice(4)}//${window.location.host}/socket`).then(pluginInit).then(() => {
	rpc.ready();
	const admin = isAdmin;
	createHTML(document.body, {"class": [admin ? "isAdmin" : "isUser"], "oncontextmenu": (e: MouseEvent) => e.preventDefault()});
	if (admin) {
		assets(tabs.add(lang["TAB_IMAGES"], spinner("imagesLoading"), true, imageIcon), "IMAGES");
		assets(tabs.add(lang["TAB_AUDIO"], spinner("audioLoading"), true, audioIcon), "AUDIO");
		characters(tabs.add(lang["TAB_CHARACTERS"], spinner("charactersLoading"), true, characterIcon));
		musicPacks(tabs.add(lang["TAB_MUSIC_PACKS"], spinner("musicLoading"), true, musicIcon));
		mapList(tabs.add(lang["TAB_MAPS"], spinner("maps"), true, mapIcon));
		layerList(tabs.add(lang["TAB_LAYERS"], div(), true, layerIcon));
		tools(tabs.add(lang["TAB_TOOLS"], div(), true, toolsIcon));
		for (const mi of menuItems()) {
			tabs.add(mi[0], mi[1], mi[2], mi[3]);
		}
		settings(tabs.add(lang["TAB_SETTINGS"], div(), false, settingsIcon), true);
		loadMap(base.appendChild(div()));
	} else {
		settings(tabs.add(lang["TAB_SETTINGS"], div(), false, settingsIcon), false);
		for (const mi of menuItems()) {
			tabs.add(mi[0], mi[1], mi[2], mi[3]);
		}
		loadUserMap(base.appendChild(div()));
		userMusic();
	}
	addCSS(tabs.css);
	base.appendChild(tabs.html);
	window.setTimeout(() => tabs.setTab(lastTab.value));
	clearElement(document.body).appendChild(shell);
	shell.realignWindows();
	window.addEventListener("resize", () => shell.realignWindows(), {"passive": true});
})).catch(handleError);
