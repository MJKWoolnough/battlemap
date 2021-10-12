import type {Uint} from './types.js';
import {createHTML, clearElement, svgNS} from './lib/dom.js';
import {div, h2, ul, li, span} from './lib/html.js';
import {path, svg, title} from './lib/svg.js';
import {mapLoadedReceive, mod} from './shared.js';
import {stringSort} from './lib/nodes.js';
import lang from './language.js';
import {shell, windows} from './windows.js';
import {miniTools} from './settings.js';
import {keyEvent} from './events.js';

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

const tools: Tool[] = [];

export const defaultTool: Tool = {
	"name": lang["TOOL_DEFAULT"],
	"icon": svg({"viewBox": "0 0 20 20"}, [title(lang["TOOL_DEFAULT"]), path({"d": "M1,1 L20,20 M1,10 V1 H10", "fill": "none", "stroke": "currentColor", "stroke-width": 2})]),
},
addTool = (t: Tool) => tools.push(t),
toolsIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cg stroke-width="3"%3E%3Cpath d="M45,1 a2,3 0,0,0 0,30 v38 a2,3 0,0,0 0,30 v-15 a1,1 0,0,1 10,0 v15 a2,3 0,0,0 0,-30 v-38 a2,3 0,0,0 0,-30 v15 a1,1 0,0,1 -10,0 z" fill="%23dde" stroke="%23000" transform="rotate(45, 50, 50)" /%3E%3Cg transform="rotate(315, 50, 50)"%3E%3Cpath d="M47.5,50 v-35 q-2,-3 -2,-5 l2,-8 h5 l2,8 q0,2 -2,5 v35 z" fill="%23eee" stroke="%23000" /%3E%3Cpath d="M40,90 a1,1 0,0,0 20,0 v-25 a1,2 0,0,1 0,-10 a1,1 0,0,0 0,-5 h-20 a1,1 0,0,0 0,5 a1,2 0,0,1 0,10 z" fill="%23dd0" stroke="%23000" stroke-linejoin="round" /%3E%3C/g%3E%3C/g%3E%3C/svg%3E`,
ignore = () => false,
disable = (e: Event) => {
	e.stopPropagation();
	return false;
};

let selectedTool = defaultTool;

export const toolTokenMouseDown = function(this: SVGElement, e: MouseEvent, n: Uint = 0) {
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
};

export default (base: HTMLElement) => {
	tools.sort((a, b) => stringSort(a.name, b.name));
	tools.unshift(defaultTool);
	let windowed = false,
	    selected: HTMLLIElement | null = null;
	const options = div(),
	      toolOptions = div([h2(lang["TOOL_OPTIONS"]), options]),
	      list: HTMLLIElement[] = tools.map(t => li({"onclick": function(this: HTMLLIElement) {
		if (selectedTool.unset) {
			selectedTool.unset();
		}
		if (t.set) {
			t.set();
		}
		selectedTool = t;
		if (t.options) {
			clearElement(options).appendChild(t.options);
			if (windowed && miniTools.value) {
				shell.appendChild(optionsWindow);
				optionsWindow.focus();
			} else {
				toolOptions.style.removeProperty("display");
			}
		} else {
			if (windowed && miniTools.value) {
				optionsWindow.remove();
			} else {
				toolOptions.style.setProperty("display", "none");
			}
		}
		selected?.classList.remove("selected")
		this.classList.add("selected");
		selected = this;
	      }}, [
		t.icon,
		span(t.name)
	      ])),
	      fc = list[0],
	      optionsWindow = windows({"window-title": lang["TOOL_OPTIONS"], "window-icon": toolsIcon});
	createHTML(clearElement(base), {"id": "toolList", "onpopout": () => {
		windowed = true;
		if (miniTools.value) {
			optionsWindow.appendChild(options);
			if (selectedTool.options) {
				toolOptions.style.setProperty("display", "none");
				shell.appendChild(optionsWindow);
				window.setTimeout(() => optionsWindow.focus());
			}
		}
	}, "onpopin": () => {
		windowed = false;
		if (miniTools.value) {
			toolOptions.appendChild(options);
			if (selectedTool.options) {
				toolOptions.style.removeProperty("display");
				optionsWindow.remove();
			}
		}
	}}, [ul(list), toolOptions]);
	fc.click();
	mapLoadedReceive(() => {
		if (selectedTool !== defaultTool) {
			fc.click();
		}
	});
	miniTools.wait(on => {
		document.body.classList.toggle("miniTools", on)
		if (!windowed) {
			return;
		}
		if (on) {
			optionsWindow.appendChild(options);
			if (selectedTool.options) {
				toolOptions.style.setProperty("display", "none");
				shell.appendChild(optionsWindow);
				optionsWindow.focus();
			}
		} else {
			toolOptions.appendChild(options);
			if (selectedTool.options) {
				toolOptions.style.removeProperty("display");
				optionsWindow.remove();
			}
		}
	});
	keyEvent("(", () => {
		for (let i = 0; i < tools.length; i++) {
			if (tools[i] === selectedTool) {
				list[mod(i - 1, tools.length)].click();
				return;
			}
		}
	});
	keyEvent(")", () => {
		for (let i = 0; i < tools.length; i++) {
			if (tools[i] === selectedTool) {
				list[mod(i + 1, tools.length)].click();
				return;
			}
		}
	});
};
