import {RPC} from './types.js';
import {createHTML, clearElement} from './lib/dom.js';
import {div, h2, ul, li, img, span} from './lib/html.js';
import {svg, defs, mask, path, rect, use} from './lib/svg.js';
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
		"icon": "iVBORw0KGgoAAAANSUhEUgAAAEUAAABaCAYAAADuDZtnAAAEz0lEQVR4Ae3cA4wlSxuA4elB+P/Xtm3bXNu2bSNY27Zt27Zt42p0st99k3xJOtmec8+4UW/ypNacaVZVVDb1f3yGoqiMhmitY2UUxWf4P3zb06iM6TgFSYVTmI7KeBqe7n7UxW5IBtqNurgfnukljEQ8JAXx2IGpGIru6KjjUP32HRH8GiPxIlzb4xiAZIgdrmICyuMlxCCSYvASymMCrkLskIz+eByuyUJV/AmxCWEmfkcMMqIY/I6ZCEFs/kRVWMjWnsUyiE0yBuApZGZPpfCRuQzPIlv6CTcgNpPxArKyFzAZYnMdPyLLslAXIYi6iLzIzvLiIkSFUAcWMjULXSA2C/AA3NADWAix6QILmZKFHhCbroiBm4pBN4hNd1jI8DpDbKrDzdWA2HRGhlYJYlMZXqgKxKYiMqRvkQxRNeClakBUEr5BunoYlyGqL7xYP4i6jIfTc2CdAVHLEQsvFoflEDUDFlJdGYi6gSfg5Z7ETYgqg1R1H65BVHH4oRIQdQ33IeK6QtRsWPBDFmZDVBdE1PNIhCCEV+GnXkUIgkQ8j/9sMET1hx8bAFGDELaHEQ9BEh6HH3scSRDE4yGkWGuIGg0/NwaiWsGxaJyDqA/g5z6EqHOIxl19A1HbEIS2QdTXuKv+ENUUQagZRPVz+tS5DFEvIgi9BFGXEQ0iegui9iNIHYCoN1O6vR6MIDUkpQdnEyGqLIJUOYiaACI6ClGvIki9CgH4d9DiEIIgGbEIUva/PyNfp1cg6hiC2HGIehlROSBqMYLYEojKgajSEDUGQWwsRJVCVHWIGoggNgiiqiGqMUR1RRDrBlGNENUGojoiiHWEqNbmI8XhI8UcUxyOKebs43D2MdcpDtcp5orW4YrW6d4nztz7ON4lm7tkMs9T1ITwT97MkzfzjFa9Ge5pvnmar5n3Pg6ZN4QOmXfJzplZB06Z+SmamckUQWbOm5kdGVlmHq2ZcZ3+uflx8GJxWAFR02EhXGYVh1nvk0FVhNhUCe7KsPBrCGsEeg2hZqE7xKabS1ebOv05raxcl7zQ5euSO2fVgu06LlzBns9hBXttWMiyfjR7HTj3LJZCbJIxMIt2xRiIZIjNUjzr5v1TZiFHBu+fkgOz3Lx/ir3H0T/MTjsTUSGNO+1UwMQwO+30w2NwbS9iBOIhKUjESWzFeqzBYh3XYytOIhGSgniMwIvwTK9gEq5BMtA1TMQr8EzRWIZLGIw8+B21MQ0nIalwEtNQGzmQF0NwGYthwdXFIQnvIlz/x6coikpogNY6VkJRfIr/I1zvIoQYuLYYhPABsqIPcAcWXJ2FRbiG4ciPT/Ag0tOD+BQFMQLXMR+e6kFUQF9sxjXcwnpsxyaswxqswnQw6hmI78d2bMBtXNNv643yeACe61FUwQBsxy1cw2pssZ2KV2MlZui42vYPswVrcR23sA39UBmPeP3s8wHuRXq6Fx/6+ewTeebsE8yzz0P4BDlQGOVQA41RR8caKIfCyAH9uf44+7yG0diLv3BHXcYVnMMx7MUWzNBxL47hHK6oO+ov7MYovOKXA+19+AC/ogDKoDoaoa6O1VEafD8/Tn+uOdCaA6050DpkLvNvYgEWYTpGYwC6oq6OAzAG07EIC3HL+TLfB6XzQJtl/QsDh+2E4VRpogAAAABJRU5ErkJggg==",
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
