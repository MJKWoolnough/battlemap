import {div, h1, input, label, span} from './lib/html.js';
import {svg, animate, animateMotion, animateTransform, circle, defs, g, path, pattern, rect, text} from './lib/svg.js';
import {shell, windows} from './windows.js';
import lang from './language.js';

const settingsOutline = path({"style": "stroke: currentColor", "fill": "none"}),
      settingsText = text({"x": 22, "y": 17, "style": "fill: currentColor"}, lang["TAB_SETTINGS"]),
      mapDrag = input({"id": "helpMapDrag", "type": "radio", "name": "helpInstruction"}),
      mapZoom = input({"id": "helpMapZoom", "type": "radio", "name": "helpInstruction"}),
      mapScroll = input({"id": "helpMapScroll", "type": "radio", "name": "helpInstruction"}),
      mapSignal = input({"id": "helpMapSignal", "type": "radio", "name": "helpInstruction"}),
      panelOpen = input({"id": "helpPanelOpen", "type": "radio", "name": "helpInstruction"}),
      panelResize = input({"id": "helpPanelResize", "type": "radio", "name": "helpInstruction"}),
      help = windows({"title": lang["HELP"], "maximised": true}, div({"id": "help"}, [
	h1(lang["HELP"]),
	svg({"viewBox": "0 0 500 300"}, [
		defs(pattern({"id": "helpGrid", "patternUnits": "userSpaceOnUse", "width": 100, "height": 100}, path({"d": "M0,100 V0 H100", "stroke": "#000", "fill": "none"}))),
		g([
			rect({"width": "1000", "height": "600", "fill": "#00f"}),
			path({"d": "M50,150 C200,0 400,300 500,250 S 600,300 900,200 S950,400 850,500 S400,600 300,550 S0,300 50,150 Z", "fill": "#0f0"}),
			rect({"width": "1000", "height": "600", "fill": "url(#helpGrid)"}),
		]),
		g({"transform": "translate(500, 0)"}, [
			rect({"id": "helpBack", "width": "100%", "height": "100%"}),
			settingsOutline,
			circle({"cy": 11, "r": 10, "stroke": "#f00", "stroke-width": 2, "fill": "#000"}),
			settingsText
		]),
		g([
			path({"d": "M0,0 v12 l3,-1 l2,5 l2,-0.75 l-2,-5 l3,-1 z", "stroke": "#000", "fill": "#fff"})
		])
	]),
	mapDrag,
	label({"for": "helpMapDrag"}, lang["HELP_MAP_DRAG"]),
	mapZoom,
	label({"for": "helpMapZoom"}, lang["HELP_MAP_ZOOM"]),
	mapScroll,
	label({"for": "helpMapSignal"}, lang["HELP_MAP_SIGNAL"]),
	mapSignal,
	label({"for": "helpMapScroll"}, lang["HELP_MAP_SCROLL"]),
	panelOpen,
	label({"for": "helpPanelOpen"}, lang["HELP_PANEL_OPEN"]),
	panelResize,
	label({"for": "helpPanelResize"}, lang["HELP_PANEL_RESIZE"]),
]));

let first = true;

export default function () {
	if (!help.parentNode) {
		shell.appendChild(help);
		if (first) {
			window.setTimeout(() => {
				const w = settingsText.getComputedTextLength() + 5;
				settingsOutline.setAttribute("d", `M0,0 v300 M0,23 h10 q5,0 5,-5 v-10 q0,-5 5,-5 h${w} q5,0 5,5 v10 q0,5 5,5 h${775 - w}`);
			}, 0);
			first = false;
		}
	} else {
		help.remove();
	}
}
