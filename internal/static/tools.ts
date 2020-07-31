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

},
toolMapMouseDown = function(e: MouseEvent) {

},
toolTokenContext = function(this: SVGToken, e: MouseEvent) {

},
toolMapContext = function(e: MouseEvent) {

},
toolTokenWheel = function(this: SVGToken, e: WheelEvent) {

},
toolMapWheel = function(e: WheelEvent) {

};

export default function (rpc: RPC, shell: ShellElement, base: HTMLElement) {

}
