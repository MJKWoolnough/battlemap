import {createHTML, clearElement} from './lib/dom.js';
import {div, h2, ul, li, span} from './lib/html.js';
import {mapLoadedReceive} from './misc.js';
import {stringSort} from './lib/ordered.js';
import lang from './language.js';
import defaultTool from './tools_default.js';
import {shell, windows} from './windows.js';
import {miniTools} from './settings.js';

type MouseFn = (this: SVGElement, e: MouseEvent) => void;
type WheelFn = (this: SVGElement, e: WheelEvent) => void;

type Tool = {
	name: string;
	icon: SVGElement;
	set?: () => void;
	unset?: () => void;
	options?: HTMLDivElement;
	tokenMouseDown?: MouseFn;
	mapMouseDown?: MouseFn;
	tokenMouseContext?: MouseFn;
	mapMouseContext?: MouseFn;
	tokenMouseWheel?: WheelFn;
	mapMouseWheel?: WheelFn;
	tokenMouseOver?: MouseFn;
	mapMouseOver?: MouseFn;
};

const tools: Tool[] = [];

export const addTool = (t: Tool) => tools.push(t),
toolsIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Cg stroke-width="3"%3E%3Cpath d="M45,1 a2,3 0,0,0 0,30 v38 a2,3 0,0,0 0,30 v-15 a1,1 0,0,1 10,0 v15 a2,3 0,0,0 0,-30 v-38 a2,3 0,0,0 0,-30 v15 a1,1 0,0,1 -10,0 z" fill="%23dde" stroke="%23000" transform="rotate(45, 50, 50)" /%3E%3Cg transform="rotate(315, 50, 50)"%3E%3Cpath d="M47.5,50 v-35 q-2,-3 -2,-5 l2,-8 h5 l2,8 q0,2 -2,5 v35 z" fill="%23eee" stroke="%23000" /%3E%3Cpath d="M40,90 a1,1 0,0,0 20,0 v-25 a1,2 0,0,1 0,-10 a1,1 0,0,0 0,-5 h-20 a1,1 0,0,0 0,5 a1,2 0,0,1 0,10 z" fill="%23dd0" stroke="%23000" stroke-linejoin="round" /%3E%3C/g%3E%3C/g%3E%3C/svg%3E';

let selectedTool: Tool = defaultTool;

export const toolTokenMouseDown = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.tokenMouseDown;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapMouseDown = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseDown;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenContext = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.tokenMouseContext;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapContext = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseContext;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenWheel = function(this: SVGElement, e: WheelEvent) {
	const fn = selectedTool.tokenMouseWheel;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapWheel = function(this: SVGElement, e: WheelEvent) {
	const fn = selectedTool.mapMouseWheel;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenMouseOver = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.tokenMouseOver;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapMouseOver = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseOver;
	if (fn) {
		fn.call(this, e);
	}
};

export default function (base: HTMLElement) {
	tools.sort((a, b) => stringSort(a.name, b.name));
	tools.unshift(defaultTool);
	let windowed = false;
	const options = div(),
	      toolOptions = div([h2(lang["TOOL_OPTIONS"]), options]),
	      list = ul(tools.map(t => li({"onclick": function(this: HTMLLIElement) {
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
		for (const c of list.childNodes as NodeListOf<HTMLElement>) {
			c.classList.remove("selected")
		}
		this.classList.add("selected");
	      }}, [
		t.icon,
		span(t.name)
	      ]))),
	      fc = list.firstChild as HTMLLIElement,
	      optionsWindow = windows({"window-title": lang["TOOL_OPTIONS"]});
	createHTML(clearElement(base), {"id": "toolList"}, [list, toolOptions]);
	fc.click();
	mapLoadedReceive(() => {
		if (selectedTool !== defaultTool) {
			for (const c of list.childNodes as NodeListOf<HTMLElement>) {
				c.classList.remove("selected");
			}
			fc.classList.add("selected");
			if (selectedTool.unset) {
				selectedTool.unset();
			}
			selectedTool = defaultTool;
		}
	});
	new MutationObserver(records => {
		for (const r of records) {
			for (const node of r.removedNodes) {
				if (node === base) {
					windowed = true;
					if (miniTools.value) {
						optionsWindow.appendChild(options);
						if (selectedTool.options) {
							toolOptions.style.setProperty("display", "none");
							shell.appendChild(optionsWindow);
						}
					}
					return;
				}
			}
			for (const node of r.addedNodes) {
				if (node === base) {
					windowed = false;
					if (miniTools.value) {
						toolOptions.appendChild(options);
						if (selectedTool.options) {
							toolOptions.style.removeProperty("display");
							optionsWindow.remove();
						}
					}
					return;
				}
			}
		}
	}).observe(base.parentNode!, {"childList": true});
	miniTools.wait(on => {
		document.body.classList.toggle("miniTools", on)
		if (on) {
			optionsWindow.appendChild(options);
			if (selectedTool.options) {
				toolOptions.style.setProperty("display", "none");
				shell.appendChild(optionsWindow);
			}
		} else {
			toolOptions.appendChild(options);
			if (selectedTool.options) {
				toolOptions.style.removeProperty("display");
				optionsWindow.remove();
			}
		}
		windowed = on;
	});
	if (miniTools.value) {
		document.body.classList.add("miniTools");
	}
}
