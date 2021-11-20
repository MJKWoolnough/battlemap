import type {Props} from './lib/dom.js';
import {createSVG, animateTransform, circle, ellipse, g, path, rect, svg, symbol, title, use} from './lib/svg.js';

const symbols = svg({"style": "width: 0"})

export const addSymbol = (id: string, s: SVGSymbolElement) => {
	createSVG(symbols, createSVG(s, {id}));
	return (props: Props = {}) => svg(props, [
		typeof props["title"] === "string" ? title(props["title"]) : [],
		use({"href": `#${id}`})
	]);
},
addFilter = (f: SVGFilterElement) => symbols.appendChild(f),
copy = addSymbol("copy", symbol({"viewBox": "0 0 34, 37"}, path({"d": "M14,6 h-13 v30 h21 v-22 z v8 h8 M12,6 v-5 h13 l8,8 v22 h-11 m11,-22 h-8 v-8 M6,20 h11 m-11,5 h11 m-11,5 h11", "stroke": "currentColor", "fill": "none"}))),
folder = addSymbol("folder", symbol({"viewBox": "0 0 37 28"}, g({"stroke-width": 2, "stroke": "currentColor", "fill": "none", "stroke-linejoin": "round"}, [
	path({"d": "M32,27 h-30 v-20 h2 l5,-5 h5 l5,5 h13 v2"}),
	path({"d": "M31,27 h1 v-20 h-30", "style": "display: var(--folder-closed, block)"}),
	path({"d": "M31,27 h1 l5,-16 h-30 l-5,16", "style": "display: var(--folder-open, none)"})
]))),
newFolder = addSymbol("newFolder", symbol({"viewBox": "0 0 24 20"}, path({"d": "M1,4 h22 v15 h-22 Z m2,0 l3,-3 h5 l3,3 m3,2 v12 m-6,-6 h12", "stroke": "currentColor", "fill": "none", "stroke-linejoin": "round"}))),
playStatus = addSymbol("playStatus", symbol({"viewBox": "0 0 10 10"}, path({"d": "M1,1 v8 l8,-4 z", "fill": "currentColor"}))),
popout = addSymbol("popout", symbol({"viewBox": "0 0 15 15"}, path({"d": "M7,1 H1 V14 H14 V8 M9,1 h5 v5 m0,-5 l-6,6", "stroke-linejoin": "round", "fill": "none", "stroke": "currentColor"}))),
remove = addSymbol("remove", symbol({"viewBox": "0 0 32 34"}, path({"d": "M10,5 v-3 q0,-1 1,-1 h10 q1,0 1,1 v3 m8,0 h-28 q-1,0 -1,1 v2 q0,1 1,1 h28 q1,0 1,-1 v-2 q0,-1 -1,-1 m-2,4 v22 q0,2 -2,2 h-20 q-2,0 -2,-2 v-22 m2,3 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1 m7.5,0 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1 m7.5,0 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1", "stroke": "currentColor", "fill": "none"}))),
rename = addSymbol("rename", symbol({"viewBox": "0 0 30 20"}, path({"d": "M1,5 v10 h28 v-10 Z M17,1 h10 m-5,0 V19 m-5,0 h10", "stroke": "currentColor", "stroke-linejoin": "round", "fill": "none"}))),
spinner = addSymbol("spinner", symbol({"viewBox": "0 0 10 10"}, circle({"cx": 5, "cy": 5, "r": 4, "stroke-width": 2, "stroke": "currentColor", "fill": "none", "stroke-linecap": "round", "stroke-dasharray": "12 12"}, animateTransform({"attributeName": "transform", "type": "rotate", "from": "0 5 5", "to": "360 5 5", "dur": "2s", "repeatCount": "indefinite"})))),
stop = addSymbol("stop", svg({"viewBox": "0 0 90 90"}, path({"d": "M75,15 c-15,-15 -45,-15 -60,0 c-15,15 -15,45 0,60 c15,15 45,15 60,0 c15,-15 15,-45 0,-60 z M25,25 v40 h40 v-40 z", "fill": "currentColor", "stroke": "none", "fill-rule": "evenodd"}))),
userSelected = addSymbol("userSelected", symbol({"viewBox": "0 0 47 47"}, [
	rect({"width": 47, height: 47, "fill": "#eee"}),
	g({"style": "display: var(--map-selected, none)"}, [
		rect({"width": 47, height: 47, "fill": "#cfc"}),
		path({"d": "M3,17 H11 V27 H35 V17 H43 V40 H3 M14,6 H32 V24 H14"})
	])
])),
userVisible = addSymbol("userVisible", symbol({"viewBox": "0 0 47 47"}, [
	path({"d": "M3,17 H11 V27 H35 V17 H43 V40 H3 M14,6 H32 V24 H14", "fill": "currentColor"}),
	g({"stroke-width": 6}, [
		path({"d": "M10,30 L20,47 L47,0", "stroke": "#0f0", "fill": "none", "style": "display: var(--check-on, block)"}),
		path({"d": "M10,47 L47,0 M10,0 L47,47", "stroke": "#f00", "fill": "none", "style": "display: var(--check-off, none)"})
	])
])),
visibility = addSymbol("visibility", symbol({"viewBox": "0 0 100 70"}, [
	ellipse({"cx": 50, "cy": 35, "rx": 49, "ry": 34, "stroke-width": 2, "stroke": "#000", "fill": "#fff"}),
	g({"style": "display: var(--invisible, block)"}, [
		circle({"cx": 50, "cy": 35, "r": 27, "stroke": "#888", "stroke-width": 10}),
		circle({"cx": 59, "cy": 27, "r": 10, "fill": "#fff"})
	])
]));

export default symbols;
