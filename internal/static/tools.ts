import {RPC} from './types.js';
import {createHTML, clearElement} from './lib/dom.js';
import {ul, li, img, span} from './lib/html.js';
import {SVGToken} from './map.js';
import {ShellElement} from './windows.js';

type TokenMouseFn = (this: SVGElement, e: MouseEvent, token: SVGToken) => void;
type TokenWheelFn = (this: SVGElement, e: WheelEvent, token: SVGToken) => void;
type MapMouseFn = (e: MouseEvent) => void;
type MapWheelFn = (e: WheelEvent) => void;

type Tool = {
	name: string;
	icon: string;
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
		"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAABHPGVmAAAANlBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC3dmhyAAAAEnRSTlMAKsjRjoBmD/7/3dLykuQl4WerplB3AAAAzElEQVR4Ae3YtWFEURDF0M+M/RdrVmqWvXDVwHkQzRQppXTNlVXdtB/V9T8zhvEzTT9SqvFzdT9BZhOhZhSfi9rxtWUVPx5k3PZCCQTFRRYUE1k3FBFpdxQTKVQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFylY8IxlX5iwlGVrsOQFLpnJUqUKFGiRIkSJUqUKFGiHP1fKGchKyqCcrAQMOvPE+PCSik9ArbiKbD2Zy9fAAAAAElFTkSuQmCC",
	},
	{
		"name": "Draw",
		"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAADI0lEQVR4Ae3dAUScYRzH8W2LsLiYQZZBZ4aMNoJhoZmgEBqczXBmmcKGZdYY1hAEIYiWETSEIBJkBCG4zUp3SWNXsonKuy9e8NK15zzv+/zZ78eXgcPzWe/1hLsLtqZdJK3+5Wgg/vdnOiAtIMZ3iuK2KE9aIIwZihKVhZL98rSVgAiIIoxyEkEoBjDComgdtH/GwVdoRyjZrZVOah14XDkbFO3LGQd9kDjoDFC0PP0+H0QoVt7Ey+FRhCEUQxgnnlCq9IZypNWJUaZuKvtAifuRRNHcHzN5zyhFcpgwfLxHdNOJbxBh+P+J2q7vkSWMMRr1/J6zQ3nSHDEm6FWKv5VpDhhTNJjivUVzwJilp46vu5sOhjDm6RExNxD/GMJYpF6qtbc0mnxt/xjCWKEHnjG268MQxhrd84Dh4e9VwtigDg8YHh5RwtikWzYwhLFHN2xgCOOQroXHEEYjnVKTMMJjNNMRXRJGeIwWqhITRmiMNqoIwwZGO5WEYQOjk9aFYQOji1aFYQOjh5aEYQOjnxaEYQOjQHPCsIFRpGlh2MAYpklh2MAYoXFh2MB4HycMAxjjNCIMGxiTNCwMGxjTVBSGDYw5KgjDBsYC9QvDBsYS9QjDBsYqdQnDBsY6dQrDBkaJ2oVhA6NCbcKwgVGlFmGEx7hJR9QsjPAYt+mUGoURHqOTDokJIzTGfdoThg2Mh7QpDBsYfbQhDBsYA7QmDBsYT2hFGDYwntGiMGxgDNO8MGxgvKbZbDC0HG3VOLB3NJUdhjZU48A+0kR2GFqOftY4sLFsMbTiGZ+g1k0sLIZAEgcnjOyXoz2HAxRGBvvq/qFdwkhrdymifao4HKgwUtoniuiD+8EKw/da6TjuuvsBC8P3xiiiGff/9cLwvSaqUkR3HB9Fu3HC8LhBimhZ3/kXfpfpG0XUq2/FDL8+iqgU49RaA72kY2Gkt2WK6Pk5EIUYLYpLoPj8umtdBH/RlX+EKFGBrlKRhuKKlCMf00XQAaKBUp4ugpERCF0EE4WH0EUwThBB94Ii+iMIGxOEsVVjlMeC+L+maZqmaZqmaZqmadpf0F8jNPUbt/EAAAAASUVORK5CYII=",
	},
	{
		"name": "Move All",
		"icon": "",
	},
	{
		"name": "Layer Mask",
		"icon": "",
	},
	{
		"name": "Light Layer",
		"icon": "",
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
	}}, [
		img({"src": `data:image/png;base64,${t.icon}`}),
		span(t.name)
	]))));
}
