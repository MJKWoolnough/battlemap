import type {WindowData, WindowElement} from './windows.js';
import {add, id, render} from './lib/css.js';
import {amendNode, clearNode, event, eventPassive} from './lib/dom.js';
import {keyEvent, mouseDragEvent} from './lib/events.js';
import {div, img, input, label, span} from './lib/html.js';
import {BoolSetting, IntSetting, JSONSetting, StringSetting} from './lib/settings.js';
import loadMap from './adminMap.js';
import help from './help.js';
import {registerKey} from './keys.js';
import lang from './language.js';
import loadUserMap from './map.js';
import {psuedoLink} from './messaging.js';
import pluginInit, {menuItems} from './plugins.js';
import {handleError, inited, isAdmin, rpc} from './rpc.js';
import {hideMenu, invert, invertID, panelOnTop, tabIcons} from './settings.js';
import {labels, menuItems as mI, mod} from './shared.js';
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

const panelsID = id(),
      tabsID = id(),
      panelContainerID = id(),
      panelOnTopID = id(),
      tabLabelsID = id(),
      panelHiderID = id(),
      panelGrabberID = id(),
      popoutID = id(),
      menuHideID = id(),
      tabIconsID = id(),
      lastTab = new StringSetting("lastTab"),
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
	      panelDrag = (e: MouseEvent) => {
		if (e.clientX > 0) {
			panelWidth.set(document.body.clientWidth - e.clientX);
			moved = true;
		}
	      },
	      [setupPanelDrag0] = mouseDragEvent(0, panelDrag),
	      [setupPanelDrag1] = mouseDragEvent(1, panelDrag),
	      c = input({"id": panelHiderID, "type": "checkbox", "checked": panelShow.value, "onchange": () => panelShow.set(c.checked)}),
	      t = div({"id": tabLabelsID}),
	      p = div({"id": panelContainerID}),
	      m = label({"title": lang["PANEL_GRABBER"], "for": panelHiderID, "class": hideMenu.value ? menuHideID : undefined, "id": panelGrabberID, "onmousedown": (e: MouseEvent) => {
		if (!c.checked) {
			if (e.button === 0) {
				setupPanelDrag0();
			} else if (e.button === 1) {
				setupPanelDrag1();
			}
			moved = false;
		}
	      }, "onclick": (e: MouseEvent) => {
		if (moved) {
			e.preventDefault();
		}
	      }}),
	      tc = div({"id": tabsID}, [t, p]),
	      h = div({"id": panelsID}, [
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
	hideMenu.wait(v => amendNode(m, {"class": {[menuHideID]: v}}));
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
			      popper = pop ? popout({"class": popoutID, "title": `Popout ${title}`, "onclick": (e: Event) => {
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
				e.stopPropagation();
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
			add(a.map(n => `#${tabsID}>input:nth-child(${n}):checked~#${panelContainerID}>div:nth-child(${n})`).join(","), {"display": "block"});
			add(a.map(n => `#${tabsID}>input:nth-child(${n}):checked~#${tabLabelsID}>label:nth-child(${n})`).join(","), {
				"border-bottom-color": "var(--c)",
				"z-index": 2,
				"background": "var(--c) !important",
				"cursor": "default !important"
			});
			add(a.map(n => `#${tabsID}>input:nth-child(${n}):checked~#${tabLabelsID}>label:nth-child(${n}):before`).join(","), {
				"box-shadow": "22px 2px 0 var(--c)"
			});
			add(a.map(n => `#${tabsID}>input:nth-child(${n}):checked~#${tabLabelsID}>label:nth-child(${n}):after`).join(","), {
				"box-shadow": "-2px 2px 0 var(--c)"
			});
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
add("html, body", {
	"color": "#000",
	"background-color": "#fff",
	"margin": 0,
	"padding": 0,
	"user-select": "none",
	"height": "100%",
	"width": "100%"
});
add(`.${psuedoLink}`, {
	"cursor": "pointer"
});
add(`a, .${psuedoLink}`, {
	"color": "#00f",
	"text-decoration": "none",
	":hover": {
		"text-decoration": "underline"
	}
});
add(`#${panelsID}`, {
	"position": "fixed",
	"top": 0,
	"right": 0,
	"bottom": 0,
	"width": "var(--panel-width, 300px)",
	"border-left": "1px solid #000",
	"transition": "right 1s, border-color 1s",
	"background-color": "#fff"
});
add(`.${panelOnTopID} #${panelsID}`, {
	"z-index": 1
});
add(`#${tabsID}>input,#${panelContainerID}>div`, {
	"display": "none"
});
add(`#${tabLabelsID}`, {
	"padding-left": 0,
	"margin-top": "-24px",
	"line-height": "24px",
	"position": "relative",
	"width": "100%",
	"overflow": "hidden",
	"padding": "0 0 0 20px",
	"white-space": "nowrap",
	"--c": "#fff",
	":after": {
		"position": "absolute",
		"content": `""`,
		"width": "100%",
		"bottom": 0,
		"left": 0,
		"border-bottom": "1px solid #000",
		"z-index": 1,
		"overflow": "hidden",
		"text-align": "center",
		"transform": "translateX(-20px)"
	},
	">label": {
		"border": "1px solid #000",
		"display": "inline-block",
		"position": "relative",
		"z-index": 1,
		"margin": "0 -5px",
		"padding": "0 20px",
		"border-top-right-radius": "6px",
		"border-top-left-radius": "6px",
		"background": "linear-gradient(to bottom, #ececec 50%, #d1d1d1 100%)",
		"box-shadow": "0 3px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 #fff",
		"text-shadow": "0 1px #fff",
		":hover,:focus": {
			"background": "linear-gradient(to bottom, #faa 1%, #ffecec 50%, #d1d1d1 100%)",
			"cursor": "pointer",
			"outline": "none"
		},
		":before,:after": {
			"position": "absolute",
			"bottom": "-1px",
			"width": "6px",
			"height": "6px",
			"content": `" "`,
			"border": "1px solid #000"
		},
		":before": {
			"left": "-7px",
			"border-bottom-right-radius": "6px",
			"border-width": "0 1px 1px 0",
			"box-shadow": "2px 2px 0 #d1d1d1"
		},
		":after": {
			"right": "-7px",
			"border-bottom-left-radius": "6px",
			"border-width": "0 0 1px 1px",
			"box-shadow": "-2px 2px 0 #d1d1d1"
		}
	}
});
add(`#${panelHiderID}`, {
	"display": "none",
	[`:checked~#${panelsID}`]: {
		"right": "calc(-1 * var(--panel-width) - 1px)",
		[`>#${panelGrabberID}`]: {
			"background-color": "#000",
			[`.${menuHideID}:not(:hover)`]: {
				"opacity": 0,
				"transition": "background 1s, opacity 2s 10s"
			}
		}
	}
});
add(`#${panelGrabberID}`, {
	"background": "#fff",
	"border": "2px solid #f00",
	"border-radius": "20px",
	"position": "relative",
	"left": "-12px",
	"display": "block",
	"width": "20px",
	"height": "20px",
	"transition": "background 1s",
	"z-index": 9,
	"cursor": "pointer"
});
add("windows-shell-taskmanager", {
	"position": "absolute",
	"top": 0,
	"left": 0,
	"right": 0,
	"bottom": 0,
	"overflow": "clip"
});
add("windows-window", {
	"--window-left": "20px",
	"--window-top": "20px",
	"max-width": "100%",
	"max-height": "100%",
	"outline": "none",
	">*": {
		"padding": "0 1px"
	}
});
add(`.${popoutID}`, {
	"display": "inline-block",
	"margin-left": "5px",
	"margin-right": "-10px",
	"cursor": "pointer",
	"width": "1em",
	"height": "1em"
});
add(`#${panelContainerID}>div`, {
	"height": "calc(100vh - 30px)",
	"overflow": "auto"
});
add(`input[type="number"]`, {
	"width": "5em"
});
add("windows-desktop", {
	"background-color": "#000"
});
add(`#${tabLabelsID} img`, {
	"padding-top": "5px",
	"width": "1.5em",
	"height": "1.5em",
	"display": "none",
	"pointer-events": "none"
});
add(`.${tabIconsID}`, {
	[` #${tabLabelsID}`]: {
		" img": {
			"display": "inline"
		},
		" span": {
			"display": "none"
		}
	},
	[` #${panelContainerID}}>div`]: {
		"height": "calc(100vh - 40px)"
	}
});
add("menu-menu", {
	"border": "2px outset #000",
	"padding": "0.25em 0",
	"box-sizing": "border-box",
	"column-gap": "1em",
	"background-color": "#aaa",
	"color": "#000"
});
add("menu-submenu[open]>menu-item,menu-item:focus", {
	"background-color": "#eee"
});
add("menu-submenu>menu-item:after", {
	"display": "block",
	"float": "right",
	"content": `"»"`
});
add("menu-item", {
	"outline": "none",
	"padding": "0 0.25em"
});
add("menu-item[disabled],menu-submenu[disabled]", {
	"color": "#444",
	"font-style": "italic"
});
add(`.${invertID}`, {
	"background-color": "#000",
	"color": "#fff",
	[` body, windows-window, #${panelsID}`]: {
		"background-color": "#000",
		"color": "#fff",
		"border-color": "#fff"
	},
	[` a, .${psuedoLink}`]: {
		"color": "#f00"
	},
	" windows-window::part(title)": {
		"color": "#000"
	},
	[` #${tabLabelsID}`]: {
		":after": {
			"border-color": "#fff"
		},
		">label": {
			"--c": "#000",
			"background": "linear-gradient(to bottom, #777 30%, #111 100%)",
			"box-shadow": "0 3px 3px rgba(255, 255, 255, 0.4), inset 0 1px 0 #000",
			"text-shadow": "0 1px #000",
			"border-color": "#fff",
			":hover,:focus": {
				"background": "linear-gradient(to bottom, #f22 5%, #a77 40%, #111 100%)"
			},
			":before,:after": {
				"border-color": "#fff"
			},
			":before": {
				"box-shadow": "2px 2px 0 #2e2e2e"
			},
			":after": {
				"box-shadow": "-2px 2px 0 #2e2e2e"
			}
		}
	},
	"menu-menu": {
		"background-color": "#222",
		"color": "#fff"
	},
	"menu-submenu[open]>menu-item, menu-item:focus": {
		"background-color": "#000"
	},
	"menu-item[disabled],menu-submenu[disabled]": {
		"color": "#888"
	}
});

amendNode(desktop, symbols);

clearNode(document.body, amendNode(shell, {"snap": 50}));

invert.wait(v => amendNode(document.documentElement, {"class": {[invertID]: v}}));
tabIcons.wait(b => amendNode(document.documentElement, {"class": {[tabIconsID]: b}}));
panelOnTop.wait(p => amendNode(document.documentElement, {"class": {[panelOnTopID]: p}}));

inited.then(() => {
	const mIs = [...mI].sort(([a], [b]) => a - b),
	      settings = isAdmin ? mIs.pop()![1] : null;
	mI.splice(0, mI.length);
	Object.freeze(mI);
	return pluginInit().then(() => {
		amendNode(document.body, {"oncontextmenu": (e: MouseEvent) => {
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
		tabs.css();
		amendNode(document.head, render());
		amendNode(desktop, tabs.html());
		setTimeout(() => tabs.setTab(lastTab.value));
		shell.realignWindows();
		amendNode(window, {"onresize": event(() => shell.realignWindows(), eventPassive)});
		rpc.ready();
	});
}).catch(handleError);
