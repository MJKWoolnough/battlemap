import {RPC} from './types.js';
import {createHTML, clearElement} from './lib/dom.js';
import {div, h2, ul, li, img, span} from './lib/html.js';
import {svg, defs, g, mask, path, rect, use} from './lib/svg.js';
import {SVGToken} from './map.js';
import {ShellElement} from './windows.js';
import {mapLayersReceive} from './comms.js';
import {stringSort} from './lib/ordered.js';
import defaultTool from './tools_default.js';
import zoomTool from './tools_zoom.js';
import drawTool from './tools_draw.js';
import moveTool from './tools_move.js';
import maskTool from './tools_mask.js';
import lightTool from './tools_light.js';

type MouseFn = (this: SVGElement, e: MouseEvent, rpc: RPC) => void;
type WheelFn = (this: SVGElement, e: WheelEvent, rpc: RPC) => void;

type Tool = {
	name: string;
	icon: SVGElement;
	reset?: Function;
	unset?: Function;
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

const tools: Tool[] = [
	defaultTool,
	zoomTool,
	drawTool,
	moveTool,
	maskTool,
	lightTool
];

let selectedTool: Tool = tools[0], rpc: RPC;

export const toolTokenMouseDown = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.tokenMouseDown;
	if (fn) {
		fn.call(this, e, rpc);
	}
},
toolMapMouseDown = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseDown;
	if (fn) {
		fn.call(this, e, rpc);
	}
},
toolTokenContext = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.tokenMouseContext;
	if (fn) {
		fn.call(this, e, rpc);
	}
},
toolMapContext = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseContext;
	if (fn) {
		fn.call(this, e, rpc);
	}
},
toolTokenWheel = function(this: SVGElement, e: WheelEvent, token: SVGToken) {
	const fn = selectedTool.tokenMouseWheel;
	if (fn) {
		fn.call(this, e, rpc);
	}
},
toolMapWheel = function(this: SVGElement, e: WheelEvent) {
	const fn = selectedTool.mapMouseWheel;
	if (fn) {
		fn.call(this, e, rpc);
	}
},
toolTokenMouseOver = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.tokenMouseOver;
	if (fn) {
		fn.call(this, e, rpc);
	}
},
toolMapMouseOver = function(this: SVGElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseOver;
	if (fn) {
		fn.call(this, e, rpc);
	}
};

export default function (arpc: RPC, shell: ShellElement, base: HTMLElement) {
	rpc = arpc;
	tools.sort((a, b) => a.name === "Default" ? -1 : b.name === "Default" ? 1 : stringSort(a.name, b.name));
	const options = div(),
	      toolOptions = div([h2("Tool Options"), options]),
	      list = ul(tools.map(t => li({"onclick": function(this: HTMLLIElement) {
		if (selectedTool.unset) {
			selectedTool.unset();
		}
		selectedTool = t;
		if (t.options) {
			clearElement(options).appendChild(t.options);
			toolOptions.style.removeProperty("display");
		} else {
			toolOptions.style.setProperty("display", "none");
		}
		(Array.from(list.childNodes) as HTMLElement[]).forEach(c => c.classList.remove("selected"));
		this.classList.add("selected");
	      }}, [
		t.icon,
		span(t.name)
	      ]))),
	      fc = list.firstChild as HTMLLIElement;
	createHTML(clearElement(base), {"id": "toolList"}, [list, toolOptions]);
	fc.click();
	mapLayersReceive(() => {
		(Array.from(list.childNodes) as HTMLElement[]).forEach(c => c.classList.remove("selected"));
		fc.classList.add("selected");
		tools.forEach(t => t.reset && t.reset());
	});
}
