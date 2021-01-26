import {SVGAnimateBeginElement} from './types.js';
import {clearElement} from './lib/dom.js';
import {createHTML, div, h1, input, label, span} from './lib/html.js';
import {svg, animate, animateMotion, animateTransform, circle, defs, g, path, pattern, rect, text} from './lib/svg.js';
import {shell, windows} from './windows.js';
import lang from './language.js';

const settingsOutline = path({"style": "stroke: currentColor", "fill": "none"}),
      settingsText = text({"x": 22, "y": 17, "style": "fill: currentColor"}, lang["TAB_SETTINGS"]),
      mapDrag = input({"id": "helpMapDrag", "type": "radio", "name": "helpInstruction", "checked": true}),
      mapZoom = input({"id": "helpMapZoom", "type": "radio", "name": "helpInstruction"}),
      mapScroll = input({"id": "helpMapScroll", "type": "radio", "name": "helpInstruction"}),
      mapSignal = input({"id": "helpMapSignal", "type": "radio", "name": "helpInstruction"}),
      panelOpen = input({"id": "helpPanelOpen", "type": "radio", "name": "helpInstruction"}),
      panelResize = input({"id": "helpPanelResize", "type": "radio", "name": "helpInstruction"}),
      createDemo = () => {
	const mouseInit = animateMotion({"id": "helpMouseInit", "dur": "1s", "fill": "freeze", "path": "M0,0 L250,150"}) as SVGAnimateBeginElement,
	      startMapDragDemo = animate({"id": "helpMapDragClick1", "attributeName": "fill", "values": "#000", "fill": "freeze", "dur": "0.2s", "begin": "helpMouseInit.end 0.5s"}) as SVGAnimateBeginElement,
	      startPanelOpenDemo = animateMotion({"id": "helpPanelOpenInit", "dur": "1s", "fill": "freeze", "path": "M250,150 L495,13", "begin": "indefinite"}) as SVGAnimateBeginElement,
	      restartPanelOpenDemo = animateMotion({"id": "helpPanelOpenRestart", "dur": "1s", "fill": "freeze", "path": "M253,13 C300,20 300,0 495,13", "begin": "indefinite"}) as SVGAnimateBeginElement,
	      startNextDemo = () => {
		if (mapDrag.checked) {
			startMapDragDemo.beginElement();
		} else if (panelOpen.checked) {
			startPanelOpenDemo.beginElement();
		}
	      },
	      endPanelDemo = animateMotion({"dur": "0.5s", "fill": "freeze", "path": "M253,13 L250,150", "begin": "indefinite", "onendEvent": startNextDemo}) as SVGAnimateBeginElement;
	return svg({"viewBox": "0 0 500 300"}, [
		defs(pattern({"id": "helpGrid", "patternUnits": "userSpaceOnUse", "width": 100, "height": 100}, path({"d": "M0,100 V0 H100", "stroke": "#000", "fill": "none"}))),
		g([
			rect({"width": 1000, "height": 600, "fill": "#00f"}),
			path({"d": "M50,150 C200,0 400,300 500,250 S 600,300 900,200 S950,400 850,500 S400,600 300,550 S0,300 50,150 Z", "fill": "#0f0"}),
			rect({"width": 1000, "height": 600, "fill": "url(#helpGrid)"}),
			animateMotion({"dur": "5s", "path": "M0,0 C-50,150 -150,-150 -250,-150 C-150,150 250,150 0,0", "begin": "helpMapDragClick1.end"})
		]),
		g({"transform": "translate(500, 0)"}, [
			rect({"id": "helpBack", "width": 500, "height": 301}),
			settingsOutline,
			circle({"cy": 11, "r": 10, "stroke": "#f00", "stroke-width": 2, "fill": "#000"}, [
				animate({"attributeName": "fill", "dur": "1s", "values": "#000;#fff", "fill": "freeze", "begin": "helpPanelOpenClick1.end 0.1s"}),
				animate({"attributeName": "fill", "dur": "1s", "values": "#fff;#000", "fill": "freeze", "begin": "helpPanelOpenClick2.end 0.1s"}),
			]),
			settingsText,
			animateTransform({"id": "helpPanelOpenOpen", "attributeName": "transform", "type": "translate", "from": "500 0", "to": "250 0", "dur": "1s", "fill": "freeze", "begin": "helpPanelOpenClick1.end 0.1s"}),
			animateTransform({"attributeName": "transform", "type": "translate", "from": "250 0", "to": "500 0", "dur": "1s", "fill": "freeze", "begin": "helpPanelOpenClick2.end 0.1s", "onendEvent": () => {
				if (panelOpen.checked) {
					restartPanelOpenDemo.beginElement();
				} else {
					endPanelDemo.beginElement();
				}
			}}),
		]),
		g([
			path({"d": "M0,0 v12 l3,-1 l2,5 l2,-0.75 l-2,-5 l3,-1 z", "stroke": "#000", "fill": "#fff"}, [
				startMapDragDemo,
				animate({"id": "helpMapDragClick2", "attributeName": "fill", "values": "#fff", "fill": "freeze", "dur": "1s", "begin": "helpMapDragMouse.end", "onendEvent": startNextDemo}),
				animate({"id": "helpPanelOpenClick1", "attributeName": "fill", "values": "#000", "dur": "0.2s", "begin": "helpPanelOpenInit.end 0.5s;helpPanelOpenRestart.end 0.5s"}),
				animate({"id": "helpPanelOpenClick2", "attributeName": "fill", "values": "#000", "dur": "0.2s", "begin": "helpPanelOpenMouse1.end 0.5s"}),
			]),
			mouseInit,
			animateMotion({"id": "helpMapDragMouse", "dur": "5s", "path": "M250,150 C200,300 100,0 0,0 C100,300 500,300 250,150", "begin": "helpMapDragClick1.end"}),

			startPanelOpenDemo,
			animateMotion({"id": "helpPanelOpenMouse1", "dur": "2.5s", "path": "M495,13 C200,400 0,100 253,13", "fill": "freeze", "begin": "helpPanelOpenClick1.end 0.5s"}),
			restartPanelOpenDemo,
			endPanelDemo
		])
	      ]);
      },
      help = windows({"window-title": lang["HELP"], "maximised": true});

export default function () {
	if (!help.parentNode) {
		shell.appendChild(createHTML(clearElement(help), div({"id": "help"}, [
			h1(lang["HELP"]),
			createDemo(),
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
		])));
		window.setTimeout(() => {
			const w = settingsText.getComputedTextLength() + 5;
			settingsOutline.setAttribute("d", `M0,0 v300 M0,23 h10 q5,0 5,-5 v-10 q0,-5 5,-5 h${w} q5,0 5,5 v10 q0,5 5,5 h${470 - w}`);
			mapDrag.click();
		}, 0);
	} else {
		help.remove();
	}
}
