import {createHTML, clearElement} from './lib/dom.js';
import {div, h2, ul, li, span} from './lib/html.js';
import {SVGToken} from './map.js';
import {mapLoadedReceive} from './misc.js';
import {stringSort} from './lib/ordered.js';
import lang from './language.js';
import defaultTool from './tools_default.js';

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

export const addTool = (t: Tool) => tools.push(t);

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
toolTokenWheel = function(this: SVGElement, e: WheelEvent, token: SVGToken) {
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
	const options = div(),
	      toolOptions = div([h2(lang["TOOL_OPTIONS"]), options]),
	      list = ul(tools.map(t => li({"onclick": function(this: HTMLLIElement) {
		if (selectedTool?.unset) {
			selectedTool.unset();
		}
		if (t.set) {
			t.set();
		}
		selectedTool = t;
		if (t.options) {
			clearElement(options).appendChild(t.options);
			toolOptions.style.removeProperty("display");
		} else {
			toolOptions.style.setProperty("display", "none");
		}
		for (const c of list.childNodes as NodeListOf<HTMLElement>) {
			c.classList.remove("selected")
		}
		this.classList.add("selected");
	      }}, [
		t.icon,
		span(t.name)
	      ]))),
	      fc = list.firstChild as HTMLLIElement;
	createHTML(clearElement(base), {"id": "toolList"}, [list, toolOptions]);
	fc.click();
	mapLoadedReceive(() => {
		for (const c of list.childNodes as NodeListOf<HTMLElement>) {
			c.classList.remove("selected");
		}
		fc.classList.add("selected");
	});
}
