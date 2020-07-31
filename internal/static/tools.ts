import {RPC} from './types.js';
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

let selectedTool = 0;

export const toolTokenMouseDown = function(this: SVGElement, e: MouseEvent, token: SVGToken) {
	const fn = tools[selectedTool].tokenMouseDown;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapMouseDown = function(this: HTMLDivElement, e: MouseEvent) {
	const fn = tools[selectedTool].mapMouseDown;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenContext = function(this: SVGElement, e: MouseEvent, token: SVGToken) {
	const fn = tools[selectedTool].tokenMouseContext;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapContext = function(this: HTMLDivElement, e: MouseEvent) {
	const fn = tools[selectedTool].mapMouseContext;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenWheel = function(this: SVGElement, e: WheelEvent, token: SVGToken) {
	const fn = tools[selectedTool].tokenMouseWheel;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapWheel = function(this: HTMLDivElement, e: WheelEvent) {
	const fn = tools[selectedTool].mapMouseWheel;
	if (fn) {
		fn.call(this, e);
	}
},
toolTokenMouseOver = function(this: SVGElement, e: MouseEvent, token: SVGToken) {
	const fn = tools[selectedTool].tokenMouseOver;
	if (fn) {
		fn.call(this, e, token);
	}
},
toolMapMouseOver = function(this: HTMLDivElement, e: MouseEvent) {
	const fn = tools[selectedTool].mapMouseOver;
	if (fn) {
		fn.call(this, e);
	}
};

export default function (rpc: RPC, shell: ShellElement, base: HTMLElement) {
	
}
