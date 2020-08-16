import {RPC} from './types.js';
import {createHTML, clearElement} from './lib/dom.js';
import {div, h2, ul, li, img, span} from './lib/html.js';
import {svg, defs, g, mask, path, rect, use} from './lib/svg.js';
import {SVGToken} from './map.js';
import {ShellElement} from './windows.js';
import {mapLayersReceive} from './comms.js';
import defaultTool from './tools_default.js';
import zoomTool from './tools_zoom.js';
import drawTool from './tools_draw.js';
import moveTool from './tools_move.js';

type MouseFn = (this: SVGElement, e: MouseEvent, rpc: RPC) => void;
type WheelFn = (this: SVGElement, e: WheelEvent, rpc: RPC) => void;

type Tool = {
	name: string;
	icon: string | SVGElement;
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
	{
		"name": "Layer Mask",
		"icon": svg({"viewBox": "0 0 60 50"}, [
			defs(path({"id": "e", "d": "M32,20 q9,-10 18,0 q-9,-3 -18,0"})),
			mask({"id": "m"}, [
				rect({"width": 100, "height": 100, "fill": "#fff"}),
				path({"d": "M10,20 q9,-10 18,0 q-9,-3 -18,0"}),
				use({"href": "#e"}),
				use({"x": 22, "href": "#e"}),
				path({"d": "M20,35 q10,5 20,0 q-10,10 -20,0"}),
			]),
			path({"d": "M0,0 Q30,15 60,0 Q30,100 0,0", "stroke": "none", "mask": "url(#m)"})
		])
	},
	{
		"name": "Light Layer",
		"icon": svg({"viewBox": "0 0 44 75"}, [
			defs(path({"id": "c", "d": "M12,61 q-2,2 0,4 q10,3 20,0 q2,-2 0,-4", "stroke-width": 1})),
			g({"stroke": "#000", "fill": "none", "stroke-linejoin": "round"}, [
				path({"d": "M12,61 c0,-20 -30,-58 10,-60 c40,2 10,40 10,60 q-10,3 -20,0 Z", "stroke-width": 2}),
				use({"href": "#c"}),
				use({"href": "#c", "y": 4}),
				use({"href": "#c", "y": 8}),
			])
		])
	}
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
		t.icon instanceof SVGElement ? t.icon : img({"src": `data:image/png;base64,${t.icon}`}),
		span(t.name)
	])));
	createHTML(clearElement(base), {"id": "toolList"}, [list, toolOptions]);
	(list.firstChild as HTMLLIElement).click();
	mapLayersReceive(() => {
		(Array.from(list.childNodes) as HTMLElement[]).forEach(c => c.classList.remove("selected"));
		(list.firstChild as HTMLElement).classList.add("selected");
		tools.forEach(t => t.reset && t.reset());
	});
}
