import type {WindowData, WindowElement} from './windows.js';
import {amendNode, clearNode, event, eventPassive} from './lib/dom.js';
import {keyEvent, mouseDragEvent} from './lib/events.js';
import {div, img, input, label, span} from './lib/html.js';
import {BoolSetting, IntSetting, JSONSetting, StringSetting} from './lib/settings.js';
import loadMap from './adminMap.js';
import help from './help.js';
import {registerKey} from './keys.js';
import lang from './language.js';
import loadUserMap from './map.js';
import pluginInit, {menuItems} from './plugins.js';
import {handleError, inited, isAdmin, rpc} from './rpc.js';
import {hideMenu, invert, panelOnTop, tabIcons} from './settings.js';
import {addCSS, labels, menuItems as mI, mod} from './shared.js';
import {popout, symbols} from './symbols.js';
import {checkWindowData, desktop, getWindowData, shell, windows} from './windows.js';
import './assets.js';
import './characterList.js';
import './layerList.js';
import './mapList.js';
import './musicPacks.js';
import './tools_draw.js';
import './tools_mask.js';
import './tools_measure.js';
import './tools_move.js';
import './tools_multiplace.js';
import './tools_wall.js';

document.title = lang["TITLE"];

const lastTab = new StringSetting("lastTab"),
      tabs = (() => {
	type savedWindow = {
		out: boolean;
		data: WindowData;
	}

	let n = 0,
	    moved = false;
	const panelShow = new BoolSetting("panelShow"),
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
	      [setupPanelDrag] = mouseDragEvent(0, (e: MouseEvent) => {
		if (e.clientX > 0) {
			panelWidth.set(document.body.clientWidth - e.clientX);
			moved = true;
		}
	      }),
	      c = input({"id": "panelHider", "type": "checkbox", "checked": panelShow.value, "onchange": () => panelShow.set(c.checked)}),
	      t = div({"id": "tabLabels"}),
	      p = div({"id": "panelContainer"}),
	      m = label({"title": lang["PANEL_GRABBER"], "for": "panelHider", "class": hideMenu.value ? "menuHide" : undefined, "id": "panelGrabber", "onmousedown": (e: MouseEvent) => {
		if (e.button === 0 || e.button === 1) {
			if (!c.checked) {
				setupPanelDrag();
			}
			moved = false;
		}
	      }, "onclick": (e: MouseEvent) => {
		if (moved) {
			e.preventDefault();
		}
	      }}),
	      tc = div({"id": "tabs"}, [t, p]),
	      h = div({"id": "panels"}, [
		m,
		tc
	      ]),
	      panelWidth = new IntSetting("panelWidth", 300, 0).wait(w => amendNode(h, {"style": `--panel-width: ${w}px`})),
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
		for (const [, t] of tabs) {
			if (t.style.getPropertyValue("display") !== "none") {
				(t.control ?? t).click();
				return;
			}
		}
	      };
	hideMenu.wait(v => amendNode(m, {"class": {"menuHide": v}}));
	keyEvent(registerKey("helpKey", lang["KEY_HELP"], "F1"), (e: KeyboardEvent) => {
		help();
		e.preventDefault();
	})[0]();
	keyEvent(registerKey("togglePanel", lang["KEY_PANEL_TOGGLE"], "F9"), (e: KeyboardEvent) => {
		panelShow.set(c.checked = !c.checked);
		e.preventDefault();
	})[0]();
	return Object.freeze({
		"add": ([title, base, pop, popIcon]: [string, HTMLDivElement, boolean, string]) => {
			amendNode(p, base);
			const pos = n++,
			      popper = pop ? popout({"class": "popout", "title": `Popout ${title}`, "onclick": (e: Event) => {
				e.preventDefault();
				const replaced = div();
				base.replaceWith(replaced);
				if (windowData[title]) {
					windowData[title]["out"] = true;
				} else {
					windowData[title] = {"out": true, "data": [20, 20, 0, 0]};
				}
				updateWindowData();
				const [x, y, width, height] = windowData[title].data,
				      w = windows({"window-icon": popIcon, "window-title": title, "resizable": "true", "style": {"min-width": "45px", "--window-left": x + "px", "--window-top": y + "px", "--window-width": width === 0 ? undefined : width + "px", "--window-height": height === 0 ? undefined : height + "px"}, "onremove": () => {
					replaced.replaceWith(base);
					amendNode(l, {"style": {"display": undefined}});
					windowData[title]["out"] = false;
					updateWindowData();
					base.dispatchEvent(new CustomEvent("popin", {"cancelable": false}));
				      }, "onmoved": updateWindowDims, "onresized": updateWindowDims}, base);
				amendNode(shell, w);
				amendNode(l, {"style": {"display": "none"}});
				if (i.checked) {
					selectFirst()
				}
				base.dispatchEvent(new CustomEvent("popout", {"cancelable": false, "detail": w}));
			      }}) : null,
			      [l, i] = labels([
				img({"src": popIcon}),
				span(title),
				popper ? popper : []
			      ], tc.insertBefore(input({"name": "tabSelector", "type": "radio"}), t), {title, "tabindex": -1, "onkeyup": (e: KeyboardEvent) => {
				let a = pos,
				    n = 1;
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
			      }, "onclick": () => lastTab.set(title)});
			amendNode(t, l);
			tabs.push([title, l]);
			if (popper && windowData[title] && windowData[title]["out"]) {
				setTimeout(() => popper.dispatchEvent(new MouseEvent("click")));
			}
			return base;
		},
		css() {
			const a = Array.from({"length": n}, (_, n) => n+1);
			return `
${a.map(n => `#tabs > input:nth-child(${n}):checked ~ #panelContainer > div:nth-child(${n})`).join(",")}{display: block}
${a.map(n => `#tabs > input:nth-child(${n}):checked ~ #tabLabels > label:nth-child(${n})`).join(",")}{border-bottom-color:var(--c);z-index:2;background:var(--c) !important;cursor:default !important}
${a.map(n => `#tabs > input:nth-child(${n}):checked ~ #tabLabels > label:nth-child(${n}):before`).join(",")}{box-shadow: 2px 2px 0 var(--c)}
${a.map(n => `#tabs > input:nth-child(${n}):checked ~ #tabLabels > label:nth-child(${n}):after`).join(",")}{box-shadow: -2px 2px 0 var(--c)}
`;
		},
		setTab(title: string) {
			for (const [t, tab] of tabs) {
				if (t === title && tab.style.getPropertyValue("display") !== "none") {
					(tab.control ?? tab).click();
					return;
				}
			}
			selectFirst();
		},
		html() {return [c, h];}
	});
      })();

amendNode(desktop, symbols);

clearNode(document.body, amendNode(shell, {"snap": 50}));

invert.wait(v => amendNode(document.documentElement, {"class": {"invert": v}}));
tabIcons.wait(b => amendNode(document.documentElement, {"class": {"tabIcons": b}}));
panelOnTop.wait(p => amendNode(document.documentElement, {"class": {"panelOnTop": p}}));

inited.then(() => {
	const mIs = [...mI].sort(([a], [b]) => a - b),
	      settings = isAdmin ? mIs.pop()![1] : null;
	mI.splice(0, mI.length);
	Object.freeze(mI);
	return pluginInit().then(() => {
		amendNode(document.body, {"class": [isAdmin ? "isAdmin" : "isUser"], "oncontextmenu": (e: MouseEvent) => {
			if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
				e.preventDefault();
			}
		}});
		for (const [, fn] of mIs) {
			const data = fn();
			if (data) {
				tabs.add(data);
			}
		}
		for (const mi of menuItems()) {
			tabs.add(mi);
		}
		(isAdmin ? loadMap : loadUserMap)(desktop.appendChild(div()));
		if (settings) {
			tabs.add(settings()!);
		}
		addCSS(tabs.css());
		amendNode(desktop, tabs.html());
		setTimeout(() => tabs.setTab(lastTab.value));
		shell.realignWindows();
		amendNode(window, {"onresize": event(() => shell.realignWindows(), eventPassive)});
		rpc.ready();
	});
}).catch(handleError);
