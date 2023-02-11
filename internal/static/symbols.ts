import type {PropsObject} from './lib/dom.js';
import {Binding} from './lib/bind.js';
import {id} from './lib/css.js';
import {amendNode} from './lib/dom.js';
import {animateTransform, circle, ellipse, g, path, rect, svg, svgData, symbol, title, use} from './lib/svg.js';

const lightCoil = id();

export const symbols = svg({"style": "width: 0"}),
addSymbol = (s: SVGSymbolElement): [(props?: PropsObject) => SVGSVGElement, string] => {
	const i = id();
	amendNode(symbols, amendNode(s, {"id": i}));
	return [
		(props: PropsObject = {}) => svg(props, [
			props["title"] instanceof Binding ? title(props["title"]) : [],
			use({"href": `#${i}`})
		]),
		svgData(s)
	];
},
[copy, copyStr] = addSymbol(symbol({"viewBox": "0 0 34 37"}, path({"d": "M14,6 h-13 v30 h21 v-22 z v8 h8 M12,6 v-5 h13 l8,8 v22 h-11 m11,-22 h-8 v-8 M6,20 h11 m-11,5 h11 m-11,5 h11", "stroke": "currentColor", "fill": "none"}))),
[folder, folderStr] = addSymbol(symbol({"viewBox": "0 0 37 28"}, g({"stroke-width": 2, "stroke": "currentColor", "fill": "none", "stroke-linejoin": "round"}, [
	path({"d": "M32,27 h-30 v-20 h2 l5,-5 h5 l5,5 h13 v3"}),
	path({"d": "M31,27 h1 v-20 h-30", "style": "display: var(--folder-closed, block)"}),
	path({"d": "M31,27 h1 l5,-16 h-30 l-5,16", "style": "display: var(--folder-open, none)"})
]))),
[newFolder, newFolderStr] = addSymbol(symbol({"viewBox": "0 0 24 20"}, path({"d": "M1,4 h22 v15 h-22 Z m2,0 l3,-3 h5 l3,3 m3,2 v12 m-6,-6 h12", "stroke": "currentColor", "fill": "none", "stroke-linejoin": "round"}))),
[playStatus, playStatusStr] = addSymbol(symbol({"viewBox": "0 0 10 10"}, path({"d": "M1,1 v8 l8,-4 z", "fill": "currentColor"}))),
[popout, popoutStr] = addSymbol(symbol({"viewBox": "0 0 15 15"}, path({"d": "M7,1 H1 V14 H14 V8 M9,1 h5 v5 m0,-5 l-6,6", "stroke-linejoin": "round", "fill": "none", "stroke": "currentColor"}))),
[remove, removeStr] = addSymbol(symbol({"viewBox": "0 0 32 34"}, path({"d": "M10,5 v-3 q0,-1 1,-1 h10 q1,0 1,1 v3 m8,0 h-28 q-1,0 -1,1 v2 q0,1 1,1 h28 q1,0 1,-1 v-2 q0,-1 -1,-1 m-2,4 v22 q0,2 -2,2 h-20 q-2,0 -2,-2 v-22 m2,3 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1 m7.5,0 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1 m7.5,0 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1", "stroke": "currentColor", "fill": "none"}))),
[rename, renameStr] = addSymbol(symbol({"viewBox": "0 0 30 20"}, path({"d": "M1,5 v10 h28 v-10 Z M17,1 h10 m-5,0 V19 m-5,0 h10", "stroke": "currentColor", "stroke-linejoin": "round", "fill": "none"}))),
[spinner, spinnerStr] = addSymbol(symbol({"viewBox": "0 0 10 10"}, circle({"cx": 5, "cy": 5, "r": 4, "stroke-width": 2, "stroke": "currentColor", "fill": "none", "stroke-linecap": "round", "stroke-dasharray": "12 12"}, animateTransform({"attributeName": "transform", "type": "rotate", "from": "0 5 5", "to": "360 5 5", "dur": "2s", "repeatCount": "indefinite"})))),
[stop, stopStr] = addSymbol(symbol({"viewBox": "0 0 90 90"}, path({"d": "M75,15 c-15,-15 -45,-15 -60,0 c-15,15 -15,45 0,60 c15,15 45,15 60,0 c15,-15 15,-45 0,-60 z M25,25 v40 h40 v-40 z", "fill": "currentColor", "stroke": "none", "fill-rule": "evenodd"}))),
[userSelected, userSelectedStr] = addSymbol(symbol({"viewBox": "0 0 47 47"}, [
	rect({"width": 47, height: 47, "fill": "#eee"}),
	g({"style": "display: var(--map-selected, none)"}, [
		rect({"width": 47, height: 47, "fill": "#cfc"}),
		path({"d": "M3,17 H11 V27 H35 V17 H43 V40 H3 M14,6 H32 V24 H14"})
	])
])),
[userVisible, userVisibleStr] = addSymbol(symbol({"viewBox": "0 0 47 47"}, [
	path({"d": "M3,17 H11 V27 H35 V17 H43 V40 H3 M14,6 H32 V24 H14", "fill": "currentColor"}),
	g({"stroke-width": 6}, [
		path({"d": "M10,30 L20,47 L47,0", "stroke": "#0f0", "fill": "none", "style": "display: var(--check-on, block)"}),
		path({"d": "M10,47 L47,0 M10,0 L47,47", "stroke": "#f00", "fill": "none", "style": "display: var(--check-off, none)"})
	])
])),
[visibility, visibilityStr] = addSymbol(symbol({"viewBox": "0 0 100 70"}, [
	ellipse({"cx": 50, "cy": 35, "rx": 49, "ry": 34, "stroke-width": 2, "stroke": "#000", "fill": "#fff"}),
	g({"style": "display: var(--invisible, block)"}, [
		circle({"cx": 50, "cy": 35, "r": 27, "stroke": "#888", "stroke-width": 10}),
		circle({"cx": 59, "cy": 27, "r": 10, "fill": "#fff"})
	])
])),
[lightOnOff, lightOnOffStr] = addSymbol(symbol({"viewBox": "0 0 44 75", "stroke": "currentColor", "fill": "none", "stroke-linejoin": "round", "stroke-linecap": "round"}, [
	path({"d": "M12,61 c0,-20 -30,-58 10,-60 c40,2 10,40 10,60 q-10,3 -20,0 Z", "stroke-width": 2, "style": "fill: var(--off, #fff)"}),
	path({"id": lightCoil, "d": "M12,61 q-2,2 0,4 q10,3 20,0 q2,-2 0,-4"}),
	use({"href": `#${lightCoil}`, "y": 4}),
	use({"href": `#${lightCoil}`, "y": 8})
])),
[lightGrid, lightGridStr] = addSymbol(symbol({"viewBox": "0 0 33 33"}, [
	path({"d": "M11,0 V33 M22,0 V33 M0,11 H33 M0,22 H33", "stroke": "#000"}),
	["#800", "#880", "#808", "#880", "#080", "#088", "#088", "#808", "#008"].map((fill, n) => rect({"x": (n / 3 | 0) * 11 + 2, "y": (n % 3) * 11 + 2, "width": 7, "height": 7, fill}))
])),
[share, shareStr] = addSymbol(symbol({"viewBox": "0 0 20 20"}, [
	circle({"cx": 3, "cy": 10, "r": 3}),
	circle({"cx": 17, "cy": 3, "r": 3}),
	circle({"cx": 17, "cy": 17, "r": 3}),
	path({"d": "M17,3 L3,10 17,17", "stroke": "#000", "fill": "none"})
])),
[lock, lockStr] = addSymbol(symbol({"viewBox": "0 0 70 100", "style": "stroke: currentColor", "stroke-width": 2, "stroke-linejoin": "round"}, [
	path({"d": "M15,45 v-20 a1,1 0,0,1 40,0 a1,1 0,0,1 -10,0 a1,1 0,0,0 -20,0 v20 z", "fill": "#ccc", "style": "display: var(--unlocked, block)"}),
	path({"d": "M15,45 v-20 a1,1 0,0,1 40,0 v20 h-10 v-20 a1,1 0,0,0 -20,0 v20 z", "fill": "#ccc", "style": "display: var(--locked, none)"}),
	rect({"x": 5, "y": 45, "width": 60, "height": 50, "fill": "#aaa", "stroke-width": 4, "rx": 10}),
	path({"d": "M30,78 l2,-8 c-7,-12 13,-12 6,0 l2,8 z", "fill": "#666", "stroke": "#000", "stroke-linejoin": "round"})
]));
