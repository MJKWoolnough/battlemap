import type {Uint} from './types.js';
import type {Bind} from './lib/dom.js';
import {add, ids} from './lib/css.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {keyEvent} from './lib/events.js';
import {div, h2, li, span, ul} from './lib/html.js';
import {mod} from './lib/misc.js';
import {stringSort} from './lib/nodes.js';
import {g, ns as svgNS, path, polygon, svg, title} from './lib/svg.js';
import {registerKey} from './keys.js';
import lang from './language.js';
import {isAdmin} from './rpc.js';
import {miniTools} from './settings.js';
import {mapLoadedReceive, menuItems} from './shared.js';
import {shell, windows} from './windows.js';

type TokenMouseFn = (this: SVGElement, e: MouseEvent, n: Uint) => void;
type MouseFn = (this: SVGElement, e: MouseEvent) => boolean;
type WheelFn = (this: SVGElement, e: WheelEvent) => boolean;

type Tool = {
	name: string | Bind;
	icon: SVGElement;
	set?: () => void;
	unset?: () => void;
	options?: HTMLDivElement;
	tokenMouse0?: TokenMouseFn;
	tokenMouse1?: TokenMouseFn;
	tokenMouse2?: TokenMouseFn;
	tokenMouseWheel?: WheelFn;
	tokenMouseOver?: MouseFn;
	mapMouse0?: MouseFn;
	mapMouse1?: MouseFn;
	mapMouse2?: MouseFn;
	mapMouseWheel?: WheelFn;
	mapMouseOver?: MouseFn;
};

const tools: Tool[] = [],
      toolsIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cg stroke-width="3"%3E%3Cpath d="M45,1 a2,3 0,0,0 0,30 v38 a2,3 0,0,0 0,30 v-15 a1,1 0,0,1 10,0 v15 a2,3 0,0,0 0,-30 v-38 a2,3 0,0,0 0,-30 v15 a1,1 0,0,1 -10,0 z" fill="%23dde" stroke="%23000" transform="rotate(45, 50, 50)" /%3E%3Cg transform="rotate(315, 50, 50)"%3E%3Cpath d="M47.5,50 v-35 q-2,-3 -2,-5 l2,-8 h5 l2,8 q0,2 -2,5 v35 z" fill="%23eee" stroke="%23000" /%3E%3Cpath d="M40,90 a1,1 0,0,0 20,0 v-25 a1,2 0,0,1 0,-10 a1,1 0,0,0 0,-5 h-20 a1,1 0,0,0 0,5 a1,2 0,0,1 0,10 z" fill="%23dd0" stroke="%23000" stroke-linejoin="round" /%3E%3C/g%3E%3C/g%3E%3C/svg%3E`;

export const defaultTool: Tool = {
	"name": lang["TOOL_DEFAULT"],
	"icon": svg({"viewBox": "0 0 20 20"}, [title(lang["TOOL_DEFAULT"]), path({"d": "M1,1 L20,20 M1,10 V1 H10", "fill": "none", "stroke": "currentColor", "stroke-width": 2})])
},
addTool = (t: Tool) => tools.push(t),
ignore = () => false,
disable = (e: Event) => {
	e.stopPropagation();
	return false;
},
marker = g({"fill": "#000", "stroke": "#fff", "stroke-width": 0.5}, ["5,0 16,0 10.5,5", "0,5 0,16 5,10.5", "5,21 16,21 10.5,16", "21,16 21,5 16,10.5"].map(points => polygon({points}))),
toolTokenMouseDown = function(this: SVGElement, e: MouseEvent, n: Uint = 0) {
	e.preventDefault();
	const fn = "tokenMouse" + e.button as "tokenMouse0" | "tokenMouse1" | "tokenMouse2";
	if (selectedTool[fn]?.call(this, e, n) ?? true) {
		defaultTool[fn]?.call(this, e, n);
	}
},
toolTokenWheel = function(this: SVGElement, e: WheelEvent) {
	e.preventDefault();
	if (selectedTool.tokenMouseWheel?.call(this, e) ?? true) {
		defaultTool.tokenMouseWheel?.call(this, e);
	}
},
toolTokenMouseOver = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	if (selectedTool.tokenMouseOver?.call(this, e) ?? true) {
		defaultTool.tokenMouseOver?.call(this, e);
	}
},
toolMapMouseDown = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	const fn = "mapMouse" + e.button as "mapMouse0" | "mapMouse1" | "mapMouse2";
	if (selectedTool[fn]?.call(this, e) ?? true) {
		defaultTool[fn]?.call(this, e);
	}
},
toolMapWheel = function(this: SVGElement, e: WheelEvent) {
	e.preventDefault();
	if (selectedTool.mapMouseWheel?.call(this, e) ?? true) {
		defaultTool.mapMouseWheel?.call(this, e);
	}
},
toolMapMouseOver = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	if (selectedTool.mapMouseOver?.call(this, e) ?? true) {
		defaultTool.mapMouseOver?.call(this, e);
	}
},
optionsWindow = windows({"window-title": lang["TOOL_OPTIONS"], "window-icon": toolsIcon}),
isDefaultTool = () => selectedTool === defaultTool;

let selectedTool = defaultTool;

menuItems.push([6, () => isAdmin ? [
	lang["TAB_TOOLS"],
	(() => {
		tools.sort((a, b) => stringSort(a.name+"", b.name+""));
		tools.unshift(defaultTool);
		let windowed = false,
		    selected: HTMLLIElement | null = null,
		    toolNum = 0;
		const base = div(),
		      options = div(),
		      toolOptions = div([h2(lang["TOOL_OPTIONS"]), options]),
		      list: HTMLLIElement[] = tools.map((t, n) => li({"onclick": function(this: HTMLLIElement) {
			selectedTool.unset?.();
			t.set?.();
			selectedTool = t;
			toolNum = n;
			if (t.options) {
				clearNode(options, t.options);
				if (windowed && miniTools.value) {
					amendNode(shell, autoFocus(optionsWindow));
				} else {
					amendNode(toolOptions, {"style": {"display": undefined}});
				}
			} else if (windowed && miniTools.value) {
				optionsWindow.remove();
			} else {
				amendNode(toolOptions, {"style": {"display": "none"}});
			}
			amendNode(selected, {"class": {[selectedID]: false}});
			amendNode(selected = this, {"class": [selectedID]});
		      }}, [
			t.icon,
			span(t.name)
		      ])),
		      fc = list[0],
		      toolPrev = registerKey("toolPrev", lang["KEY_TOOL_PREV"], 'Shift+('),
		      toolNext = registerKey("toolNext", lang["KEY_TOOL_NEXT"], 'Shift+)'),
		      [toolList, selectedID, miniToolsID] = ids(3);
		add({
			[`#${toolList}`]: {
				">ul": {
					"list-style": "none",
					"padding": 0,
					"margin-top": 0,
					">li": {
						"cursor": "pointer",
						"padding": "0.4em",
						" :is(img, svg)": {
							"width": "2em",
							"height": "2em",
							"padding-right": "3px",
							"background-color": "transparent"
						}
					}
				},
				[` li.${selectedID}`]: {
					"background-color": "#888"
				}
			},
			[`.${miniToolsID} #${toolList}>ul`]: {
				"margin-bottom": 0,
				"padding-bottom": 0,
				" svg + span": {
					"display": "none"
				}
			}
		});

		amendNode(base, {"id": toolList, "onpopout": () => {
			windowed = true;
			if (miniTools.value) {
				amendNode(optionsWindow, options);
				if (selectedTool.options) {
					amendNode(toolOptions, {"style": {"display": "none"}});
					amendNode(shell, autoFocus(optionsWindow));
				}
			}
		}, "onpopin": () => {
			windowed = false;
			if (miniTools.value) {
				amendNode(toolOptions, options);
				if (selectedTool.options) {
					amendNode(toolOptions, {"style": {"display": undefined}});
					optionsWindow.remove();
				}
			}
		}}, [ul(list), toolOptions]);
		fc.click();
		mapLoadedReceive(() => fc.click());
		miniTools.wait(on => {
			amendNode(document.body, {"class": {[miniToolsID]: on}});
			if (windowed) {
				if (on) {
					amendNode(optionsWindow, options);
					if (selectedTool.options) {
						amendNode(toolOptions, {"style": {"display": "none"}});
						amendNode(shell, autoFocus(optionsWindow));
					}
				} else {
					amendNode(toolOptions, options);
					if (selectedTool.options) {
						amendNode(toolOptions, {"style": {"display": undefined}});
						optionsWindow.remove();
					}
				}
			}
		});
		keyEvent(toolPrev, () => list[mod(toolNum - 1, tools.length)].click())[0]();
		keyEvent(toolNext, () => list[mod(toolNum + 1, tools.length)].click())[0]();
		return base;
	})(),
	true,
	toolsIcon
] : null]);
