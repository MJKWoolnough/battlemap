import type {Uint} from './types.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {keyEvent} from './lib/events.js';
import {div, h2, li, span, ul} from './lib/html.js';
import {stringSort} from './lib/nodes.js';
import {ns as svgNS, g, path, polygon, svg, title} from './lib/svg.js';
import lang from './language.js';
import {isAdmin} from './rpc.js';
import {miniTools} from './settings.js';
import {mapLoadedReceive, menuItems, mod} from './shared.js';
import {shell, windows} from './windows.js';

type TokenMouseFn = (this: SVGElement, e: MouseEvent, n: Uint) => void;
type MouseFn = (this: SVGElement, e: MouseEvent) => boolean;
type WheelFn = (this: SVGElement, e: WheelEvent) => boolean;

type Tool = {
	name: string;
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
	"icon": svg({"viewBox": "0 0 20 20"}, [title(lang["TOOL_DEFAULT"]), path({"d": "M1,1 L20,20 M1,10 V1 H10", "fill": "none", "stroke": "currentColor", "stroke-width": 2})]),
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
	if (e.button === 0 && (selectedTool.tokenMouse0 === undefined || selectedTool.tokenMouse0.call(this, e, n))) {
		defaultTool.tokenMouse0?.call(this, e, n);
	} else if (e.button === 1 && (selectedTool.tokenMouse1 === undefined || selectedTool.tokenMouse1.call(this, e, n))) {
		defaultTool.tokenMouse1?.call(this, e, n);
	} else if (e.button === 2 && (selectedTool.tokenMouse2 === undefined || selectedTool.tokenMouse2.call(this, e, n))) {
		defaultTool.tokenMouse2?.call(this, e, n);
	}
},
toolTokenWheel = function(this: SVGElement, e: WheelEvent) {
	e.preventDefault();
	if (selectedTool.tokenMouseWheel === undefined || selectedTool.tokenMouseWheel.call(this, e)) {
		defaultTool.tokenMouseWheel?.call(this, e);
	}
},
toolTokenMouseOver = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	if (selectedTool.tokenMouseOver === undefined || selectedTool.tokenMouseOver.call(this, e)) {
		defaultTool.tokenMouseOver?.call(this, e);
	}
},
toolMapMouseDown = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	if (e.button === 0 && (selectedTool.mapMouse0 === undefined || selectedTool.mapMouse0.call(this, e))) {
		defaultTool.mapMouse0?.call(this, e);
	} else if (e.button === 1 && (selectedTool.mapMouse1 === undefined || selectedTool.mapMouse1.call(this, e))) {
		defaultTool.mapMouse1?.call(this, e);
	} else if (e.button === 2 && (selectedTool.mapMouse2 === undefined || selectedTool.mapMouse2.call(this, e))) {
		defaultTool.mapMouse2?.call(this, e);
	}
},
toolMapWheel = function(this: SVGElement, e: WheelEvent) {
	e.preventDefault();
	if (selectedTool.mapMouseWheel === undefined || selectedTool.mapMouseWheel.call(this, e)) {
		defaultTool.mapMouseWheel?.call(this, e);
	}
},
toolMapMouseOver = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	if (selectedTool.mapMouseOver === undefined || selectedTool.mapMouseOver.call(this, e)) {
		defaultTool.mapMouseOver?.call(this, e);
	}
},
optionsWindow = windows({"window-title": lang["TOOL_OPTIONS"], "window-icon": toolsIcon});

let selectedTool = defaultTool;

menuItems.push([6, () => isAdmin ? [
	lang["TAB_TOOLS"],
	(() => {
		tools.sort((a, b) => stringSort(a.name, b.name));
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
			} else {
				if (windowed && miniTools.value) {
					optionsWindow.remove();
				} else {
					amendNode(toolOptions, {"style": {"display": "none"}});
				}
			}
			selected?.classList.remove("selected")
			this.classList.add("selected");
			selected = this;
		      }}, [
			t.icon,
			span(t.name)
		      ])),
		      fc = list[0];
		amendNode(base, {"id": "toolList", "onpopout": () => {
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
			document.body.classList.toggle("miniTools", on)
			if (!windowed) {
				return;
			}
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
		});
		keyEvent(["(", ")"], (e: KeyboardEvent) => list[mod(toolNum + (e.key === "(" ? -1 : 1), tools.length)].click())[0]();
		return base;
	})(),
	true,
	toolsIcon
] : null]);
