import {RPC} from './types.js';
import {SVGToken} from './map.js';
import {ShellElement} from './windows.js';

type MouseFn = (e: MouseEvent) => void;
type WheelFn = (e: WheelEvent) => void;

type Tool = {
	name: string;
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

export const toolTokenMouseDown = function(this: SVGToken, e: MouseEvent) {
	const fn = tools[selectedTool].tokenMouseDown;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapMouseDown = function(e: MouseEvent) {
	const fn = tools[selectedTool].mapMouseDown;
	if (fn) {
		fn(e);
	}
},
toolTokenContext = function(this: SVGToken, e: MouseEvent) {
	const fn = tools[selectedTool].tokenMouseContext;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapContext = function(e: MouseEvent) {
	const fn = tools[selectedTool].mapMouseContext;
	if (fn) {
		fn(e);
	}
},
toolTokenWheel = function(this: SVGToken, e: WheelEvent) {
	const fn = tools[selectedTool].tokenMouseWheel;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapWheel = function(e: WheelEvent) {
	const fn = tools[selectedTool].mapMouseWheel;
	if (fn) {
		fn(e);
	}
},
toolTokenMouseOver = function(this: SVGToken, e: MouseEvent) {
	const fn = tools[selectedTool].tokenMouseOver;
	if (fn) {
		fn.call(this, e);
	}
},
toolMapMouseOver = function(e: MouseEvent) {
	const fn = tools[selectedTool].mapMouseOver;
	if (fn) {
		fn(e);
	}
};

export default function (rpc: RPC, shell: ShellElement, base: HTMLElement) {
	
}
