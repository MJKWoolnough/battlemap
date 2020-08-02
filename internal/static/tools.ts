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
	reset: Function;
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
		"reset": () => {}
	},
	{
		"name": "Draw",
		"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAADI0lEQVR4Ae3dAUScYRzH8W2LsLiYQZZBZ4aMNoJhoZmgEBqczXBmmcKGZdYY1hAEIYiWETSEIBJkBCG4zUp3SWNXsonKuy9e8NK15zzv+/zZ78eXgcPzWe/1hLsLtqZdJK3+5Wgg/vdnOiAtIMZ3iuK2KE9aIIwZihKVhZL98rSVgAiIIoxyEkEoBjDComgdtH/GwVdoRyjZrZVOah14XDkbFO3LGQd9kDjoDFC0PP0+H0QoVt7Ey+FRhCEUQxgnnlCq9IZypNWJUaZuKvtAifuRRNHcHzN5zyhFcpgwfLxHdNOJbxBh+P+J2q7vkSWMMRr1/J6zQ3nSHDEm6FWKv5VpDhhTNJjivUVzwJilp46vu5sOhjDm6RExNxD/GMJYpF6qtbc0mnxt/xjCWKEHnjG268MQxhrd84Dh4e9VwtigDg8YHh5RwtikWzYwhLFHN2xgCOOQroXHEEYjnVKTMMJjNNMRXRJGeIwWqhITRmiMNqoIwwZGO5WEYQOjk9aFYQOji1aFYQOjh5aEYQOjnxaEYQOjQHPCsIFRpGlh2MAYpklh2MAYoXFh2MB4HycMAxjjNCIMGxiTNCwMGxjTVBSGDYw5KgjDBsYC9QvDBsYS9QjDBsYqdQnDBsY6dQrDBkaJ2oVhA6NCbcKwgVGlFmGEx7hJR9QsjPAYt+mUGoURHqOTDokJIzTGfdoThg2Mh7QpDBsYfbQhDBsYA7QmDBsYT2hFGDYwntGiMGxgDNO8MGxgvKbZbDC0HG3VOLB3NJUdhjZU48A+0kR2GFqOftY4sLFsMbTiGZ+g1k0sLIZAEgcnjOyXoz2HAxRGBvvq/qFdwkhrdymifao4HKgwUtoniuiD+8EKw/da6TjuuvsBC8P3xiiiGff/9cLwvSaqUkR3HB9Fu3HC8LhBimhZ3/kXfpfpG0XUq2/FDL8+iqgU49RaA72kY2Gkt2WK6Pk5EIUYLYpLoPj8umtdBH/RlX+EKFGBrlKRhuKKlCMf00XQAaKBUp4ugpERCF0EE4WH0EUwThBB94Ii+iMIGxOEsVVjlMeC+L+maZqmaZqmaZqmadpf0F8jNPUbt/EAAAAASUVORK5CYII=",
		"reset": () => {}
	},
	{
		"name": "Move All",
		"icon": "iVBORw0KGgoAAAANSUhEUgAAAFYAAABVCAMAAADkHONrAAAAS1BMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADmYDp0AAAAGXRSTlMAAk2Bnv/t5uLo7PH0/vf6/PL1/UyAS8AEV9+5ZgAAAe5JREFUeAHN2Y2KqzAUBGCjnWq1qVVjet//SS8gA7thgIQBusN/gK+HpJBzTFeb0A996LwI9QbgJlxbla6v3oXrq6Oo11cnQLiu+gBcV6gz4LpCXQDXFeoTTHTcQn0BkabvUl2JefUW6pug71KlIqLdOpVZt2U/bJeqiOtS3X23pVa6vuq7PeqS2tihkj3/RLUhnzXJof5CDulM1UeReXBVf4Ksfk392AnpalUdRQKyZrUrVJwS0KvSFWo7K1yhtrPCFWo7S1erBktXqAZbuEJtZ3cg0lWqUe2brlANFitdoRosXnQLNXosnnSl2s6y9VnoarWd3S5gpivVdpat6oMuTwsWy3YC0+VSLdmQzt/5AJ9iKQWyOMCMAPrrMhR7m1CRTPZn7sDQDcAdjMeyLlY7gjnIFnev3oTMTSjCvZ24sLcfmVLLsWux2AiqdOdrcXNYqsXoFYHVYKnq4aud1Srdl8dSFQOYwQqV7ttkqYohbP/+zev3CX5X880ezO8Yv9Df+t24bvLt2SHkHOxJp3Yw+8dpq+6TakJd+q4pZyU7tLF+tf4HBds11Ap316rrGqpwj33ZVkulqxMdVXfUelYyXfYoVE2XdhRzkunKKcl0mcVXhTv7qnAfvircyVeFO/qq/wTlP5iZrq96j5H/AbtSR3ts3avHAAAAAElFTkSuQmCC",
		"reset": () => {}
	},
	{
		"name": "Layer Mask",
		"icon": "iVBORw0KGgoAAAANSUhEUgAAAFYAAABLCAYAAADqHnCyAAAC1ElEQVR4AezcAUQdcRzA8XcJdkOP0KIHIKhFKIKBZkVgYFtrA01jSLOlCeANCIQgAKABG00DNQSEAlAT0IqKSr3Sb1/hsdrbuXe/e3f3v9+XDwC/zsm9u///X6izYVjKDeMSiln9OIXAUqoTBxAgdx2gE6oVsQ25JU8JtlGESh6+QOzC3liCh8i9hdSQl+SWCUSqGxeQWnJ6Yc/Rhbry8BMSzOmkhjV4CN0rSAguJgHGEKoifuf8wkoQ7IV9SihD6pT1JKRymLv1GBJR1pI6HaMFgX2CKMpCEtEM/puPfYi6dCZK9uGjZi8hsUlPEoNR1OwHpCGSSWK0gn9WwjWkoeJPGuQaHbjTNCQSM407rUEiMav4q/uoQCIxFfio9hiiwgyi2meIClNGte8QFWYZ1X5BVJgd3ORD8iM4hefZeyj0pGxwfdGSOjxEYSRVg+vTSEIaQeF5agbXp5mE8AyFN6kZXB8lMuM4Cu8zOHja55tCYdbRC0uJzTcb5Y4NyO5Y/f+xdmHHoz4VqOXiU8FI0sO7+hzbk+TwLv/y8hP4I9x/V6D+dsvsxPM+1izH8wXBlOP55mUG9b/Smgp8/XUFZjWelTBmWn/tlrlGh/5qQ7MSz/pYM6q/otvsw9ffg2Bm9HfNmGO06O/zMmX9nYlmD0X9vbRmDKHzsAYxmru/ibpwDjEq5xUEnLBhJhA5D0sQc2MJnv4pRvm2jWLc527lzQE64z8pLl9O0Y9YG8IlJCcuMYSGNIQziOPO8AQNbQCHEEcdYgCJ1I1diGN20Y1Ea8U3iCO+ohWpqAkfcQXJqCt8QBNSVx82IBmzgT6kumZM4gSScieYRDMyUwkLqEBSpoIFdCCzlTCPC0jCzjGPEpypDVPYhDTYJqbQBmfz0Is5bEFisoU59MJD7mrHKBaxjiNISEdYxyJeoB23sjw8wCM8xWu8wwz+DIRzoWLBUDUSgzFFAgCMRWc0sIdMEwAAAABJRU5ErkJggg==",
		"reset": () => {}
	},
	{
		"name": "Light Layer",
		"icon": "iVBORw0KGgoAAAANSUhEUgAAAEUAAABaCAYAAADuDZtnAAAEz0lEQVR4Ae3cA4wlSxuA4elB+P/Xtm3bXNu2bSNY27Zt27Zt42p0st99k3xJOtmec8+4UW/ypNacaVZVVDb1f3yGoqiMhmitY2UUxWf4P3zb06iM6TgFSYVTmI7KeBqe7n7UxW5IBtqNurgfnukljEQ8JAXx2IGpGIru6KjjUP32HRH8GiPxIlzb4xiAZIgdrmICyuMlxCCSYvASymMCrkLskIz+eByuyUJV/AmxCWEmfkcMMqIY/I6ZCEFs/kRVWMjWnsUyiE0yBuApZGZPpfCRuQzPIlv6CTcgNpPxArKyFzAZYnMdPyLLslAXIYi6iLzIzvLiIkSFUAcWMjULXSA2C/AA3NADWAix6QILmZKFHhCbroiBm4pBN4hNd1jI8DpDbKrDzdWA2HRGhlYJYlMZXqgKxKYiMqRvkQxRNeClakBUEr5BunoYlyGqL7xYP4i6jIfTc2CdAVHLEQsvFoflEDUDFlJdGYi6gSfg5Z7ETYgqg1R1H65BVHH4oRIQdQ33IeK6QtRsWPBDFmZDVBdE1PNIhCCEV+GnXkUIgkQ8j/9sMET1hx8bAFGDELaHEQ9BEh6HH3scSRDE4yGkWGuIGg0/NwaiWsGxaJyDqA/g5z6EqHOIxl19A1HbEIS2QdTXuKv+ENUUQagZRPVz+tS5DFEvIgi9BFGXEQ0iegui9iNIHYCoN1O6vR6MIDUkpQdnEyGqLIJUOYiaACI6ClGvIki9CgH4d9DiEIIgGbEIUva/PyNfp1cg6hiC2HGIehlROSBqMYLYEojKgajSEDUGQWwsRJVCVHWIGoggNgiiqiGqMUR1RRDrBlGNENUGojoiiHWEqNbmI8XhI8UcUxyOKebs43D2MdcpDtcp5orW4YrW6d4nztz7ON4lm7tkMs9T1ITwT97MkzfzjFa9Ge5pvnmar5n3Pg6ZN4QOmXfJzplZB06Z+SmamckUQWbOm5kdGVlmHq2ZcZ3+uflx8GJxWAFR02EhXGYVh1nvk0FVhNhUCe7KsPBrCGsEeg2hZqE7xKabS1ebOv05raxcl7zQ5euSO2fVgu06LlzBns9hBXttWMiyfjR7HTj3LJZCbJIxMIt2xRiIZIjNUjzr5v1TZiFHBu+fkgOz3Lx/ir3H0T/MTjsTUSGNO+1UwMQwO+30w2NwbS9iBOIhKUjESWzFeqzBYh3XYytOIhGSgniMwIvwTK9gEq5BMtA1TMQr8EzRWIZLGIw8+B21MQ0nIalwEtNQGzmQF0NwGYthwdXFIQnvIlz/x6coikpogNY6VkJRfIr/I1zvIoQYuLYYhPABsqIPcAcWXJ2FRbiG4ciPT/Ag0tOD+BQFMQLXMR+e6kFUQF9sxjXcwnpsxyaswxqswnQw6hmI78d2bMBtXNNv643yeACe61FUwQBsxy1cw2pssZ2KV2MlZui42vYPswVrcR23sA39UBmPeP3s8wHuRXq6Fx/6+ewTeebsE8yzz0P4BDlQGOVQA41RR8caKIfCyAH9uf44+7yG0diLv3BHXcYVnMMx7MUWzNBxL47hHK6oO+ov7MYovOKXA+19+AC/ogDKoDoaoa6O1VEafD8/Tn+uOdCaA6050DpkLvNvYgEWYTpGYwC6oq6OAzAG07EIC3HL+TLfB6XzQJtl/QsDh+2E4VRpogAAAABJRU5ErkJggg==",
		"reset": () => {}
	}
];

let selectedTool: Tool;

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
	const list = ul(tools.map(t => li({"onclick": function(this: HTMLLIElement) {
		selectedTool = t;
		(Array.from(list.childNodes) as HTMLElement[]).forEach(c => c.classList.remove("selected"));
		this.classList.add("selected");
	}}, [
		img({"src": `data:image/png;base64,${t.icon}`}),
		span(t.name)
	])));
	createHTML(clearElement(base), {"id": "toolList"}, list);
	rpc.waitCurrentUserMapData().then(() => {
		selectedTool = tools[0];
		(Array.from(list.childNodes) as HTMLElement[]).forEach(c => c.classList.remove("selected"));
		(list.firstChild as HTMLElement).classList.add("selected");
		tools.forEach(t => t.reset());
	});
}
