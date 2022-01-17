import bbcode from './lib/bbcode.js';
import {all} from './lib/bbcode_tags.js';
import {amendNode, clearNode} from './lib/dom.js';
import {div, h1, input} from './lib/html.js';
import {animate, animateMotion, animateTransform, circle, defs, g, path, pattern, rect, svg, text} from './lib/svg.js';
import lang from './language.js';
import {labels} from './shared.js';
import {shell, windows} from './windows.js';

const settingsOutline = path({"stroke": "currentColor", "fill": "none"}),
      settingsText = text({"x": 22, "y": 17, "fill": "currentColor"}, lang["TAB_SETTINGS"]),
      mapDrag = input({"type": "radio", "name": "helpInstruction", "checked": true}),
      mapZoom = input({"type": "radio", "name": "helpInstruction"}),
      mapScroll = input({"type": "radio", "name": "helpInstruction"}),
      mapSignal = input({"type": "radio", "name": "helpInstruction"}),
      panelOpen = input({"type": "radio", "name": "helpInstruction"}),
      panelResize = input({"type": "radio", "name": "helpInstruction"}),
      createDemo = () => {
	const startNextDemo = () => {
		if (mapDrag.checked) {
			startMapDragDemo.beginElement();
		} else if (mapZoom.checked) {
			startMapZoomDemo.beginElement();
		} else if (mapScroll.checked) {
			startMapScrollDemo.beginElement();
		} else if (mapSignal.checked) {
			helpSignalStart.beginElement();
		} else if (panelOpen.checked || panelResize.checked) {
			startPanelOpenDemo.beginElement();
		}
	      },
	      checkPanelOpenEnd = () => window.setTimeout(() => (panelResize.checked ? helpPanelResizeStart : helpPanelCloseClick).beginElement(), 500),
	      mouseInit = animateMotion({"dur": "1s", "fill": "freeze", "path": "M0,0 L250,150", "onendEvent": startNextDemo}),
	      startMapDragDemo = animate({"id": "helpMapDragClick1", "attributeName": "fill", "values": "#000", "fill": "freeze", "dur": "0.2s", "begin": "indefinite"}),
	      startMapZoomDemo = animateTransform({"id": "helpMapZoom1", "dur": "1s", "attributeName": "transform", "type": "scale", "from": "1 1", "to": "0.5 0.5", "begin": "indefinite"}),
	      startMapScrollDemo = animateMotion({"id": "helpMapScroll1", "dur": "6s", "path": "M0,0 h-300 v-300 h300 v300", "begin": "indefinite", "onendEvent": startNextDemo}),
	      startPanelOpenDemo = animateMotion({"id": "helpPanelOpenInit", "dur": "1s", "fill": "freeze", "path": "M250,150 L495,13", "begin": "indefinite"}),
	      restartPanelOpenDemo = animateMotion({"id": "helpPanelOpenRestart", "dur": "1s", "fill": "freeze", "path": "M253,13 C300,20 300,0 495,13", "begin": "indefinite"}),
	      endPanelDemo = animateMotion({"dur": "0.5s", "fill": "freeze", "path": "M253,13 L250,150", "begin": "indefinite", "onendEvent": startNextDemo}),
	      helpPanelCloseClick = animate({"id": "helpPanelOpenClick2", "attributeName": "fill", "values": "#000", "dur": "0.2s", "begin": "indefinite"}),
	      helpPanelResizeStart = animate({"id": "helpPanelResizeMouseDown", "attributeName": "fill", "values": "#000", "fill": "freeze", "dur": "0.5s", "begin": "indefinite"}),
	      helpSignalStart = animate({"id": "helpSignalClick1", "attributeName": "fill", "values": "#000", "dur": "0.2s", "begin": "indefinite"});
	return svg({"id": "helpDemo", "viewBox": "0 0 500 300"}, [
		defs(pattern({"id": "helpGrid", "patternUnits": "userSpaceOnUse", "width": 100, "height": 100}, path({"d": "M0,100 V0 H100", "stroke": "#000", "fill": "none"}))),
		g([
			rect({"width": 1000, "height": 600, "fill": "#00f"}),
			path({"d": "M50,150 C200,0 400,300 500,250 S600,300 700,200 S750,400 850,500 S400,600 300,550 S0,300 50,150 Z", "fill": "#0f0"}),
			rect({"width": 1000, "height": 600, "fill": "url(#helpGrid)"}),
			animateMotion({"dur": "4s", "path": "M0,0 C-50,150 -150,-150 -250,-150 C-150,150 250,150 0,0", "begin": "helpMapDragClick1.end"}),
			startMapZoomDemo,
			animateTransform({"id": "helpMapZoom2", "dur": "2s", "attributeName": "transform", "type": "scale", "from": "0.5 0.5", "to": "2 2", "begin": "helpMapZoom1.end"}),
			animateTransform({"id": "helpMapZoom3", "dur": "1s", "attributeName": "transform", "type": "scale", "from": "2 2", "to": "1 1", "begin": "helpMapZoom2.end", "onendEvent": startNextDemo}),
			animateMotion({"dur": "1s", "path": "M0,0 L125,75", "begin": "helpMapZoom1.begin"}),
			animateMotion({"dur": "2s", "path": "M125,75 L-250,-150", "begin": "helpMapZoom2.begin"}),
			animateMotion({"dur": "1s", "path": "M-250,-150 L0,0", "begin": "helpMapZoom3.begin"}),
			startMapScrollDemo
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
			animateTransform({"id": "helpPanelResize1", "attributeName": "transform", "type": "translate", "from": "250 0", "to": "100 0", "dur": "1s", "begin": "helpPanelResizeMouseDown.end"}),
			animateTransform({"id": "helpPanelResize2", "attributeName": "transform", "type": "translate", "from": "100 0", "to": "400 0", "dur": "2s", "begin": "helpPanelResize1.end"}),
			animateTransform({"id": "helpPanelResize3", "attributeName": "transform", "type": "translate", "from": "400 0", "to": "250 0", "dur": "1s", "begin": "helpPanelResize2.end"}),
		]),
		g([
			circle({"cx": 50, "cy": 50, "stroke": "#f00", "stroke-width": 8, "fill": "none"}, animate({"attributeName": "r", "values": "4;46", "dur": "1s", "begin": "helpSignalClick1.end; helpSignalClick2.end; helpSignalClick3.end"})),
			circle({"cx": 50, "cy": 50, "stroke": "#00f", "stroke-width": 4, "fill": "none"}, animate({"attributeName": "r", "values": "4;46", "dur": "1s", "begin": "helpSignalClick1.end; helpSignalClick2.end; helpSignalClick3.end"})),
			animateTransform({"attributeName": "transform", "type": "translate", "from": "200 100", "to": "200 100", "fill": "freeze", "dur": "0.1s", "begin": "helpSignalClick1.end"}),
			animateTransform({"attributeName": "transform", "type": "translate", "from": "50 150", "to": "50 150", "fill": "freeze", "dur": "0.1s", "begin": "helpSignalClick2.end"}),
			animateTransform({"attributeName": "transform", "type": "translate", "from": "300 200", "to": "300 200", "fill": "freeze", "dur": "0.1s", "begin": "helpSignalClick3.end"}),
		]),
		g({"stroke": "#000", "fill": "#fff"}, [
			path({"d": "M0,0 v12 l3,-1 l2,5 l2,-0.75 l-2,-5 l3,-1 z"}),
			rect({"y": 17, "width": 15, "height": 20, "rx": 2}),
			g({"stroke-width": 0.5}, [
				rect({"x": 1, "y": 18, "width": 3, "height": 10, "rx": 1}, [
					startMapDragDemo,
					animate({"id": "helpMapDragClick2", "attributeName": "fill", "values": "#fff", "fill": "freeze", "dur": "1s", "begin": "helpMapDragMouse.end", "onendEvent": startNextDemo}),
					animate({"id": "helpPanelOpenClick1", "attributeName": "fill", "values": "#000", "dur": "0.2s", "begin": "helpPanelOpenInit.end 0.5s;helpPanelOpenRestart.end 0.5s"}),
					helpPanelCloseClick,
					helpPanelResizeStart,
					animate({"attributeName": "fill", "values": "#fff", "dur": "0.2s", "fill": "freeze", "begin": "helpPanelResize3.end 0.5s", "onendEvent": checkPanelOpenEnd}),
				]),
				rect({"x": 11, "y": 18, "width": 3, "height": 10, "rx": 1}, [
					helpSignalStart,
					animate({"id": "helpSignalClick2", "attributeName": "fill", "values": "#000", "dur": "0.2s", "begin": "helpSignalMove1.end"}),
					animate({"id": "helpSignalClick3", "attributeName": "fill", "values": "#000", "dur": "0.2s", "begin": "helpSignalMove2.end"})
				]),
				path({"d": "M7.5,17.5 l-3,3 h2 v2 h2 v-2 h2 z"}, [
					animate({"attributeName": "fill", "values": "#000", "dur": "2s", "begin": "helpMapZoom2.begin"}),
					animate({"attributeName": "fill", "values": "#000", "dur": "3s", "begin": "helpMapScroll1.begin 3s"})
				]),
				path({"d": "M7.5,27.5 l-3,-3 h2 v-2 h2 v2 h2 z"}, [
					animate({"attributeName": "fill", "values": "#000", "dur": "1s", "begin": "helpMapZoom1.begin"}),
					animate({"attributeName": "fill", "values": "#000", "dur": "1s", "begin": "helpMapZoom3.begin"}),
					animate({"attributeName": "fill", "values": "#000", "dur": "3s", "begin": "helpMapScroll1.begin"})
				]),
			]),
			g([
				rect({"y": 37, "width": 15, "height": 7, "rx": 2}),
				text({"x": 2, "y": 42, "textLength": 11, "style": "font:arial;font-size:5px", "stroke-width": 0.3}, "Shift"),
				animate({"attributeName": "fill", "values": "#000", "dur": "1.5s", "begin": "helpMapScroll1.begin; helpMapScroll1.begin 3s"}),
				animate({"attributeName": "stroke", "values": "#fff", "dur": "1.5s", "begin": "helpMapScroll1.begin; helpMapScroll1.begin 3s"})
			]),
			g([
				rect({"y": 44, "width": 15, "height": 7, "rx": 2}),
				text({"x": 2, "y": 49, "style": "font:arial;font-size:5px", "stroke-width": 0.3}, "Ctrl"),
				animate({"attributeName": "fill", "values": "#000", "dur": "4s", "begin": "helpMapZoom1.begin"}),
				animate({"attributeName": "stroke", "values": "#fff", "dur": "4s", "begin": "helpMapZoom1.begin"}),
			]),
			mouseInit,
			animateMotion({"id": "helpMapDragMouse", "dur": "4s", "path": "M250,150 C200,300 100,0 0,0 C100,300 500,300 250,150", "begin": "helpMapDragClick1.end"}),

			startPanelOpenDemo,
			animateMotion({"dur": "1.5s", "path": "M495,13 C200,300 150,100 253,13", "fill": "freeze", "begin": "helpPanelOpenClick1.end 0.5s", "onendEvent": checkPanelOpenEnd}),
			restartPanelOpenDemo,
			endPanelDemo,
			animateMotion({"dur": "4s", "path": "M253,13 h-150 h300 h-150", "fill": "freeze", "begin": "helpPanelResizeMouseDown.end"}),
			animateMotion({"id": "helpSignalMove1", "dur": "1s", "path": "M250,150 L100,200", "fill": "freeze", "begin": "helpSignalClick1.end"}),
			animateMotion({"id": "helpSignalMove2", "dur": "1s", "path": "M100,200 L350,250", "fill": "freeze", "begin": "helpSignalClick2.end"}),
			animateMotion({"dur": "1s", "path": "M350,250 L250,150", "fill": "freeze", "begin": "helpSignalClick3.end", "onendEvent": startNextDemo})
		])
	      ]);
      },
      help = windows({"window-title": lang["HELP"], "maximised": true});

export default () => {
	if (!help.parentNode) {
		amendNode(shell, clearNode(help, div({"id": "help"}, [
			h1(lang["HELP"]),
			createDemo(),
			div({"id": "helpDemos"}, [
				labels(lang["HELP_MAP_DRAG"], mapDrag, false),
				labels(lang["HELP_MAP_ZOOM"], mapZoom, false),
				labels(lang["HELP_MAP_SCROLL"], mapScroll, false),
				labels(lang["HELP_MAP_SIGNAL"], mapSignal, false),
				labels(lang["HELP_PANEL_OPEN"], panelOpen, false),
				labels(lang["HELP_PANEL_RESIZE"], panelResize, false),
				div(bbcode(all, lang["HELP_DEMO_DRAG"])),
				div(bbcode(all, lang["HELP_DEMO_ZOOM"])),
				div(bbcode(all, lang["HELP_DEMO_SCROLL"])),
				div(bbcode(all, lang["HELP_DEMO_SIGNAL"])),
				div(bbcode(all, lang["HELP_DEMO_SIDEPANEL_OPEN"])),
				div(bbcode(all, lang["HELP_DEMO_SIDEPANEL_RESIZE"]))
			])
		])));
		window.setTimeout(() => {
			const w = settingsText.getComputedTextLength() + 5;
			amendNode(settingsOutline, {"d": `M0,0 v300 M0,23 h10 q5,0 5,-5 v-10 q0,-5 5,-5 h${w} q5,0 5,5 v10 q0,5 5,5 h${470 - w}`});
			mapDrag.click();
		});
	} else {
		help.remove();
	}
};
