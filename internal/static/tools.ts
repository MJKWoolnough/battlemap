import {RPC} from './types.js';
import {createHTML, clearElement} from './lib/dom.js';
import {ul, li} from './lib/html.js';
import {SVGToken} from './map.js';
import {ShellElement} from './windows.js';

type TokenMouseFn = (this: SVGElement, e: MouseEvent, token: SVGToken) => void;
type TokenWheelFn = (this: SVGElement, e: WheelEvent, token: SVGToken) => void;
type MapMouseFn = (e: MouseEvent) => void;
type MapWheelFn = (e: WheelEvent) => void;

type Tool = {
	name: string;
	tokenMouseDown?: TokenMouseFn;
	mapMouseDown?: MapMouseFn;
	tokenMouseContext?: TokenMouseFn;
	mapMouseContext?: MapMouseFn;
	tokenMouseWheel?: TokenWheelFn;
	mapMouseWheel?: MapWheelFn;
	tokenMouseOver?: TokenMouseFn;
	mapMouseOver?: MapMouseFn;
};

const tools: Tool[] = [
	{
		"name": "Default",
	},
	{
		"name": "Draw",
	},
	{
		"name": "Move All",
	},
	{
		"name": "Layer Mask",
	},
	{
		"name": "Light Layer",
	}
];

let selectedTool = tools[0];

export const toolTokenMouseDown = function(this: SVGElement, e: MouseEvent, token: SVGToken) {
	const fn = selectedTool.tokenMouseDown;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapMouseDown = function(this: HTMLDivElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseDown;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenContext = function(this: SVGElement, e: MouseEvent, token: SVGToken) {
	const fn = selectedTool.tokenMouseContext;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapContext = function(this: HTMLDivElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseContext;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenWheel = function(this: SVGElement, e: WheelEvent, token: SVGToken) {
	const fn = selectedTool.tokenMouseWheel;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapWheel = function(this: HTMLDivElement, e: WheelEvent) {
	const fn = selectedTool.mapMouseWheel;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenMouseOver = function(this: SVGElement, e: MouseEvent, token: SVGToken) {
	const fn = selectedTool.tokenMouseOver;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapMouseOver = function(this: HTMLDivElement, e: MouseEvent) {
	const fn = selectedTool.mapMouseOver;
	if (fn) {
		fn.call(this, e);
	}
};

export default function (rpc: RPC, shell: ShellElement, base: HTMLElement) {
	createHTML(clearElement(base), {"id": "toolList"}, ul(tools.map((t, n) => li({"class": n === 0 ? "selected" : undefined, "onclick": function(this: HTMLLIElement) {
		selectedTool = t;
		(Array.from(this.parentNode!.childNodes) as HTMLElement[]).forEach(c => c.classList.remove("selected"));
		this.classList.add("selected");
	}}, t.name))));
}
