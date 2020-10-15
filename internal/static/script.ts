import RPC from './rpc.js';
import {Int, Uint} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {div, h2, input, label, style} from './lib/html.js';
import {symbol, path} from './lib/svg.js';
import assets from './assets.js';
import mapList from './mapList.js';
import layerList from './layerList.js';
import characters from './characterList.js';
import loadMap from './adminMap.js';
import loadUserMap from './map.js';
import {shell, desktop, windows} from './windows.js';
import settings, {hideMenu, invert} from './settings.js';
import tools from './tools.js';
import characterStore from './characters.js';
import {respondWithShell, handleError} from './misc.js';
import symbols, {addSymbol} from './symbols.js';
import './tools_draw.js';
import './tools_light.js';
import './tools_mask.js';
import './tools_move.js';
import './tools_zoom.js';
import pluginInit from './plugins.js';
import lang from './language.js';
import {BoolSetting, IntSetting, StringSetting} from './settings_types.js';

type savedWindow = {
	out: boolean;
	x: Int;
	y: Int;
	width: Uint;
	height: Uint;
}

declare const pageLoad: Promise<void>;

const popout = addSymbol("popout", symbol({"viewBox": "0 0 15 15"}, path({"d": "M7,1 H1 V14 H14 V8 M9,1 h5 v5 m0,-5 l-6,6", "stroke-linejoin": "round", "fill": "none", "style": "stroke: currentColor"}))),
      tabs = (function() {
	let n = 0;
	const panelShow = new BoolSetting("panelShow"),
	      panelWidth = new IntSetting("panelWidth", "300"),
	      windowSettings = new StringSetting("windowData"),
	      lastTab = new IntSetting("lastTab"),
	      mousemove = function(e: MouseEvent) {
		if (e.clientX > 0) {
			const x = document.body.clientWidth - e.clientX;
			panelWidth.set(x);
			h.style.setProperty("--panel-width", `${x}px`);
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
	      m = label({"for": "panelHider", "class": hideMenu.value ? "menuHide" : undefined, "id": "panelGrabber", "onmousedown": (e: MouseEvent) => {
			if (e.button !== 0) {
				return;
			}
			if (!c.checked) {
				window.addEventListener("mousemove", mousemove);
				window.addEventListener("mouseup", mouseUp);
			}
	      }}),
	      h = div({"id": "panels", "--panel-width": `${panelWidth.value}px`}, [
		m,
		div({"id": "tabs"}, [t, p])
	      ]),
	      windowData: Record<string, savedWindow> = JSON.parse(windowSettings.value || "{}"),
	      updateWindowData = () => windowSettings.set(JSON.stringify(windowData)),
	      mo = new MutationObserver(list => {
		      list.forEach(m => {
			      if (m.target instanceof HTMLElement) {
				      windowData[m.target.getAttribute("window-title") || ""] = {
					"out": true,
					"x": parseInt(m.target.style.getPropertyValue("--window-left")),
					"y": parseInt(m.target.style.getPropertyValue("--window-top")),
					"width": parseInt(m.target.style.getPropertyValue("--window-width") || "0"),
					"height": parseInt(m.target.style.getPropertyValue("--window-height") || "0"),
				      };
			      }
		      });
		      updateWindowData();
	      }),
	      obsInit = {"attributeFilter": ["style"], "attributes": true},
	      tabs: HTMLLabelElement[] = [],
	      o = Object.freeze({
		"add": (title: string, contents: Node, pop = true) => {
			const base = p.appendChild(div(contents)),
			      pos = n++,
			      i = h.lastChild!.insertBefore(input({"id": `tabSelector_${n}`, "name": "tabSelector", "type": "radio", "checked": pos === lastTab.value}), t),
			      l = t.appendChild(label({"tabindex": "-1", "for": `tabSelector_${n}`, "onkeyup": (e: KeyboardEvent) => {
				let a = pos, tl = tabs.length;
				switch (e.key) {
				case "ArrowLeft":
					do {
						a = (((a - 1) % tl) + tl) % tl;
					} while (a !== pos && tabs[a].style.getPropertyValue("display") === "none");
					break;
				case "ArrowRight":
					do {
						a = (a + 1) % tl;
					} while (a !== pos && tabs[a].style.getPropertyValue("display") === "none");
					break;
				case "Enter":
					l.control!.click();
				default:
					return;
				}
				tabs[a].focus();
			      }, "onclick": () => lastTab.set(pos)}, [
				title,
				pop ? popout({"class": "popout", "title": `Popout ${title}`, "onclick": (e: Event) => {
					const replaced = div();
					p.replaceChild(replaced, base);
					if (windowData[title]) {
						windowData[title]["out"] = true;
					} else {
						windowData[title] = {"out": true, "x": 20, "y": 20, "width": 0, "height": 0};
					}
					updateWindowData();
					const {x, y, width, height} = windowData[title];
					mo.observe(s.appendChild(autoFocus(windows({"window-title": title, "resizable": "true", "--window-left": x + "px", "--window-top": y + "px", "--window-width": width === 0 ? null : width + "px", "--window-height": height === 0 ? null : height + "px", "onremove": () => {
						p.replaceChild(base, replaced);
						l.style.removeProperty("display");
						windowData[title]["out"] = false;
						updateWindowData();
					}}, base))), obsInit);
					e.preventDefault();
					l.style.setProperty("display", "none");
					if (i.checked) {
						o.selectFirst()
					}
				}}) : []
			      ]));
			tabs.push(l);
			if (pop && windowData[title] && windowData[title]["out"]) {
				(l.lastChild as SVGSVGElement).dispatchEvent(new MouseEvent("click"));
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
		get html() {return createHTML(null, [c , h]);},
		selectFirst() {
			tabs.some(e => {
				if (e.style.getPropertyValue("display") !== "none") {
					e.control!.click();
					return true;
				}
				return false;
			});
		}
	});
	hideMenu.wait((value: boolean) => m.classList.toggle("menuHide", value));
	return o;
      }()),
      spinner = (id: string) => h2({"id": id}, [lang["LOADING"], div({"class": "loadSpinner"})]),
      base = desktop(symbols),
      s = shell({"snap": 50}, base);

respondWithShell(s);
invert.wait((v: boolean) => document.documentElement.classList.toggle("invert", v));
if (invert.value) {
	document.documentElement.classList.add("invert");
}

pageLoad.then(() => RPC(`ws${window.location.protocol.slice(4)}//${window.location.host}/socket`).then(rpc => Promise.all([rpc.waitLogin(), pluginInit()]).then(([userLevel]) => {
	characterStore();
	document.body.classList.add(userLevel ? "isAdmin" : "isUser");
	if (userLevel === 1) {
		assets(tabs.add(lang["TAB_IMAGES"], spinner("imagesLoading")), "IMAGES");
		assets(tabs.add(lang["TAB_AUDIO"], spinner("audioLoading")), "AUDIO");
		characters(tabs.add(lang["TAB_CHARACTERS"], spinner("charactersLoading")));
		mapList(tabs.add(lang["TAB_MAPS"], spinner("maps")));
		layerList(tabs.add(lang["TAB_LAYERS"], div()));
		tools(tabs.add(lang["TAB_TOOLS"], div()));
		settings(tabs.add(lang["TAB_SETTINGS"], div(), false), true);
		loadMap(base.appendChild(div()));
		document.head.appendChild(style({"type": "text/css"}, tabs.css));
		base.appendChild(tabs.html);
		clearElement(document.body).appendChild(s);
	} else {
		settings(tabs.add(lang["TAB_SETTINGS"], div()), false);
		loadUserMap(base.appendChild(div({"style": "height: 100%"})));
		document.head.appendChild(style({"type": "text/css"}, tabs.css));
		base.appendChild(tabs.html);
		clearElement(document.body).appendChild(s);
	}
	s.realignWindows();
	window.addEventListener("resize", () => s.realignWindows(), {"passive": true});
}))).catch(handleError);
