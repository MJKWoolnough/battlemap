import type {Int, Uint, Wall} from './types.js';
import {Subscription} from './lib/inter.js';
import {clearElement} from './lib/dom.js';
import {br, div, input, label, span} from './lib/html.js';
import {createSVG, circle, defs, g, line, path, radialGradient, stop, svg, title, use} from './lib/svg.js';
import {deselectToken, labels, mapLoadedReceive, selected} from './shared.js';
import {Colour, makeColourPicker} from './colours.js';
import {SVGLayer, mapData, point2Line, root, screen2Grid, walkLayers} from './map.js';
import {doLightShift, doWallAdd, doWallRemove} from './map_fns.js';
import {addTool, marker as wallMarker} from './tools.js';
import {keyEvent} from './lib/events.js';
import {rpc, combined as combinedRPC} from './rpc.js';
import lang from './language.js';

let x1 = 0,
    y1 = 0,
    l: SVGLineElement;

const sunTool = input({"type": "radio", "name": "lightTool", "checked": true, "class": "settings_ticker"}),
      wallTool = input({"type": "radio", "name": "lightTool", "class": "settings_ticker"}),
      lightMarker = g([
	      defs(radialGradient({"id": "lightMGrad"}, [
		      stop({"offset": "30%", "stop-color": "currentColor"}),
		      stop({"offset": "100%", "stop-color": "currentColor", "stop-opacity": 0})
	      ])),
	      circle({"cx": 20, "cy": 20, "r": 20, "fill": "url(#lightMGrad)", "stroke": "#888", "stroke-width": 3})
      ]),
      over = (x: Int, y: Int, w: Wall) => point2Line(x, y, w.x1, w.y1, w.x2, w.y2) < 5,
      onmousemove = (e: MouseEvent) => {
	const [x2, y2] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
	createSVG(l, {x2, y2});
      },
      reset = () => {
	root.removeEventListener("mousemove", onmousemove);
	root.removeEventListener("mouseup", onmouseup);
	cancelKey();
	l.remove();
      },
      onmouseup = (e: MouseEvent) => {
	if (e.button !== 0) {
		return;
	}
	reset();
	const [x2, y2] = screen2Grid(e.clientX, e.clientY, e.shiftKey),
	      {layer} = selected;
	if (x2 === x1 && y2 === y1) {
		return;
	}
	if (layer) {
		doWallAdd({
			"path": layer.path,
			"id": 0,
			x1,
			y1,
			x2,
			y2,
			"colour": wallColour
		});
		genWalls();
	}
      },
      wallLayer = g({"stroke-width": 2}),
      walls: WallData[] = [],
      genWalls = () => {
	if (!on) {
		return;
	}
	lastWall = null;
	clearElement(wallLayer);
	walls.splice(0, walls.length);
	walkLayers((layer: SVGLayer, hidden: boolean) => {
		if (hidden) {
			return;
		}
		let pos = 0;
		for (const wall of layer.walls) {
			walls.push({
			      wall,
			      "element": wallLayer.appendChild(line({"x1": wall.x1, "y1": wall.y1, "x2": wall.x2, "y2": wall.y2, "stroke": wall.colour}, title(layer.path))),
			      layer,
			      "pos": pos++
			});
		}
	});
      },
      [setupKey, cancelKey] = keyEvent("Escape", reset);

type WallData = {
	wall: Wall;
	element: SVGElement;
	layer: SVGLayer;
	pos: Uint;
}

let wallColour = Colour.from({"r": 0, "g": 0, "b": 0, "a": 255}),
    lastWall: WallData | null = null,
    wallWaiter = () => {},
    on = false;

mapLoadedReceive(a => {
	if (a) {
		genWalls();
	}
});

addTool({
	"name": lang["TOOL_LIGHT"],
	"icon": svg({"viewBox": "0 0 44 75"}, [
		title(lang["TOOL_LIGHT"]),
		g({"stroke": "currentColor", "fill": "none", "stroke-linejoin": "round"}, [
			path({"d": "M12,61 c0,-20 -30,-58 10,-60 c40,2 10,40 10,60 q-10,3 -20,0 Z", "stroke-width": 2}),
			path({"id": "c", "d": "M12,61 q-2,2 0,4 q10,3 20,0 q2,-2 0,-4", "stroke-width": 1}),
			use({"href": "#c", "y": 4}),
			use({"href": "#c", "y": 8}),
		])
	]),
	"options": div([
		labels(`${lang["TOOL_LIGHT_SUN"]}: `, sunTool, false),
		br(),
		labels(`${lang["TOOL_LIGHT_WALL"]}: `, wallTool, false),
		br(),
		labels(`${lang["TOOL_LIGHT_REMOVE"]}: `, input({"name": "lightTool", "type": "radio", "class": "settings_ticker"}), false),
		div({"id": "wallToolOptions"}, [
			label(`${lang["TOOL_LIGHT_COLOUR"]}: `),
			span({"class": "checkboard colourButton"}, makeColourPicker(null, lang["TOOL_LIGHT_COLOUR"], () => wallColour, (c: Colour) => wallColour = c, "wallColour")),
		])
	]),
	"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
		e.preventDefault();
		if (sunTool.checked || wallTool.checked) {
			const sun = sunTool.checked,
			      marker = sun ? lightMarker : wallMarker,
			      offset = sun ? 20 : 10,
			      onmousemove = (e: MouseEvent) => {
				const [x, y] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
				createSVG(marker, {"transform": `translate(${x - offset}, ${y - offset})`, "style": `color: ${sun ? mapData.lightColour : wallColour}`});
			      };
			createSVG(this, {"style": {"cursor": "none"}, "1onmouseleave": () => {
				this.removeEventListener("mousemove", onmousemove);
				this.style.removeProperty("cursor");
				marker.remove();
			}, onmousemove}, marker);
		} else {
			const onmousemove = (e: MouseEvent) => {
				const [x, y] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
				if (lastWall !== null) {
					if (over(x, y, lastWall.wall)) {
						return;
					}
					lastWall.element.setAttribute("stroke-width", "1");
					lastWall = null;
				}
				let pos = 0;
				for (const w of walls) {
					if (over(x, y, w.wall)) {
						const element = (wallLayer.childNodes[pos] as SVGGElement);
						element.setAttribute("stroke-width", "5");
						lastWall = w;
						break;
					}
					pos++;
				}
			      };
			createSVG(this, {onmousemove, "1onmouseout": () => {
				if (lastWall !== null) {
					lastWall.element.setAttribute("stroke-width", "1");
					lastWall = null;
				}
				this.removeEventListener("mousemove", onmousemove);
			}});
		}
		return false;
	},
	"mapMouse0": function(this: SVGElement, e: MouseEvent) {
		if (sunTool.checked) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
			doLightShift(x, y);
		} else if (wallTool.checked) {
			[x1, y1] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
			l = line({x1, y1, "x2": x1, "y2": y1, "stroke": wallColour, "stroke-width": 5});
			setupKey();
			createSVG(this, {onmousemove, onmouseup}, l)
		} else if (lastWall !== null) {
			doWallRemove(lastWall.wall.id);
			genWalls();
		}
		return false;
	},
	"set": () => {
		wallWaiter = Subscription.canceller(...([
			rpc.waitWallAdded,
			rpc.waitWallRemoved,
			combinedRPC.waitLayerMove,
			combinedRPC.waitLayerRemove,
			combinedRPC.waitLayerShow,
			combinedRPC.waitLayerHide,
			rpc.waitLayerShift
		] as (() => Subscription<any>)[]).map(fn => fn().then(() => window.setTimeout(genWalls))));
		on = true;
		genWalls();
		root.appendChild(wallLayer);
		deselectToken();
	},
	"unset": () => {
		cancelKey();
		wallWaiter();
		wallLayer.remove();
		walls.splice(0, walls.length);
		on = false;
	},
});
