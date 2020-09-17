import {Colour, Int, Uint, RPC, LayerRPC, Wall} from './types.js';
import {Subscription} from './lib/inter.js';
import {clearElement} from './lib/dom.js';
import {br, button, div, input, label, span} from './lib/html.js';
import {createSVG, circle, defs, g, line, path, polygon, radialGradient, stop, svg, title,  use} from './lib/svg.js';
import {mapLayersReceive, handleError, screen2Grid, colour2RGBA, makeColourPicker, requestShell, point2Line} from './misc.js';
import {normaliseWall, updateLight, globals, SVGLayer, walkVisibleLayers} from './map.js';
import {addTool} from './tools.js';
import {defaultMouseWheel} from './tools_default.js';

const sunTool = input({"type": "radio", "name": "lightTool", "id": "sunTool", "checked": true}),
      wallTool = input({"type": "radio", "name": "lightTool", "id": "wallTool"}),
      lightMarker = g([
	      defs(radialGradient({"id": "lightMGrad"}, [
		      stop({"offset": "30%", "style": "stop-color: currentColor"}),
		      stop({"offset": "100%", "style": "stop-color: currentColor; stop-opacity: 0"})
	      ])),
	      circle({"cx": 20, "cy": 20, "r": 20, "fill": "url(#lightMGrad)", "stroke": "#888"})
      ]),
      wallMarker = g({"stroke": "#000"}, [
	      polygon({"points": "5,0 16,0 10.5,5"}),
	      polygon({"points": "0,5 0,16 5,10.5"}),
	      polygon({"points": "5,21 16,21 10.5,16"}),
	      polygon({"points": "21,16 21,5 16,10.5"})
      ]),
      over = (x: Int, y: Int, w: Wall) => point2Line(x, y, w.x1, w.y1, w.x2, w.y2) < 5,
      mouseOver = function(this: SVGElement, e: MouseEvent) {
	e.preventDefault();
	if (sunTool.checked || wallTool.checked) {
		const sun = sunTool.checked,
		      marker = sun ? lightMarker : wallMarker,
		      offset = sun ? 20 : 10,
		      onmousemove = (e: MouseEvent) => {
			const [x, y] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
			createSVG(marker, {"transform": `translate(${x - offset}, ${y - offset})`, "style": `color: ${colour2RGBA(sun ? globals.mapData.lightColour : wallColour)}`});
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
      },
      mouseDown = function(this: SVGElement, e: MouseEvent, rpc: RPC) {
	e.preventDefault();
	if (e.button !== 0) {
		return;
	}
	if (sunTool.checked) {
		const [x, y] = screen2Grid(e.clientX, e.clientY, e.shiftKey),
		      {lightX, lightY} = globals.mapData,
		      doIt = () => {
			rpc.shiftLight(globals.mapData.lightX = x, globals.mapData.lightY = y);
			updateLight();
			return () => {
				rpc.shiftLight(globals.mapData.lightX = lightX, globals.mapData.lightY = lightY);
				return doIt;
			};
		      };
		globals.undo.add(doIt);
	} else if (wallTool.checked) {
		const [x1, y1] = screen2Grid(e.clientX, e.clientY, e.shiftKey),
		      l = line({x1, y1, "x2": x1, "y2": y1, "stroke": colour2RGBA(wallColour), "stroke-width": 5}),
		      onmousemove = (e: MouseEvent) => {
			const [x2, y2] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
			createSVG(l, {x2, y2});
		      },
		      reset = () => {
			this.removeEventListener("mousemove", onmousemove);
			this.removeEventListener("mouseup", onmouseup);
			window.removeEventListener("keydown", onkeydown);
			l.remove();
		      },
		      onmouseup = (e: MouseEvent) => {
			if (e.button !== 0) {
				return;
			}
			reset();
			const [x2, y2] = screen2Grid(e.clientX, e.clientY, e.shiftKey),
			      w = normaliseWall({"id": 0, x1, y1, x2, y2, "colour": wallColour});
			if (x2 === x1 && y2 === y1) {
				return;
			}
			if (globals.selectedLayer) {
				const wall = {
					"wall": w,
					"element": line({x1, y1, x2, y2, "stroke": colour2RGBA(wallColour)}, title(globals.selectedLayerPath)),
					"layer": globals.selectedLayer,
					"layerName": globals.selectedLayerPath,
					"pos": globals.selectedLayer.walls.length
				      },
				      doIt = () => {
					walls.push(wall);
					wallLayer.appendChild(wall.element);
					wall.layer.walls.push(w);
					rpc.addWall(wall.layerName, w.x1, w.y1, w.x2, w.y2, w.colour).catch(handleError);
					updateLight();
					return () => {
						walls.pop();
						wall.element.remove();
						wall.layer.walls.pop();
						rpc.removeWall(wall.wall.id).catch(handleError);
						updateLight();
						return doIt;
					};
				      };
				globals.undo.add(doIt);
			}
		      },
		      onkeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				reset();
			}
		      };
		createSVG(this, {onmousemove, onmouseup}, l)
		window.addEventListener("keydown", onkeydown);
	} else if (lastWall !== null) {
		const wall = lastWall,
		      doIt = () => {
			wall.element.remove();
			wall.layer.walls.splice(wall.pos, 1);
			rpc.removeWall(wall.wall.id);
			if (lastWall === wall) {
				lastWall = null;
			}
			updateLight();
			return () => {
				walls.push(wall);
				wallLayer.appendChild(wall.element);
				wall.layer.walls.push(wall.wall);
				rpc.addWall(wall.layerName, wall.wall.x1, wall.wall.y1, wall.wall.x2, wall.wall.y2, wall.wall.colour).catch(handleError);
				updateLight();
				return doIt;
			};
		      };
		globals.undo.add(doIt);
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
	walls.splice(0, walls.length)
	walkVisibleLayers(globals.layerList, (layer: SVGLayer, layerName: string) => {
		layer.walls.forEach((wall, pos) => walls.push({
		      wall,
		      "element": wallLayer.appendChild(line({"x1": wall.x1, "y1": wall.y1, "x2": wall.x2, "y2": wall.y2, "stroke": colour2RGBA(wall.colour)}, title(layerName))),
		      layer,
		      layerName,
		      pos
		}));
		return [];
	});
      }

type WallData = {
	wall: Wall;
	element: SVGElement;
	layer: SVGLayer;
	layerName: string;
	pos: Uint;
}

let wallColour: Colour = {"r": 0, "g": 0, "b": 0, "a": 255},
    lastWall: WallData | null = null,
    wallWaiter = () => {},
    on = false;

mapLayersReceive(l => {
	([
		l.waitMoved,
		l.waitFolderMoved,
		l.waitRemoved,
		l.waitFolderRemoved,
		l.waitLayerSetVisible,
		l.waitLayerSetInvisible,
		l.waitLayerPositionChange
	] as (() => Subscription<any>)[]).map(fn => fn().then(genWalls));
	genWalls();
});

addTool({
	"name": "Light Layer",
	"icon": svg({"viewBox": "0 0 44 75"}, [
		defs(path({"id": "c", "d": "M12,61 q-2,2 0,4 q10,3 20,0 q2,-2 0,-4", "stroke-width": 1})),
		g({"style": "stroke: currentColor", "fill": "none", "stroke-linejoin": "round"}, [
			path({"d": "M12,61 c0,-20 -30,-58 10,-60 c40,2 10,40 10,60 q-10,3 -20,0 Z", "stroke-width": 2}),
			use({"href": "#c"}),
			use({"href": "#c", "y": 4}),
			use({"href": "#c", "y": 8}),
		])
	]),
	"options": div([
		label({"for": "sunTool"}, "Position Sun/Moon: "),
		sunTool,
		br(),
		label({"for": "wallTool"}, "Wall Tool: "),
		wallTool,
		br(),
		label({"for": "deleteWallTool"}, "Remove Wall: "),
		input({"id": "deleteWallTool", "name": "lightTool", "type": "radio"}),
		div({"id": "wallToolOptions"}, [
			label("Wall Colour: "),
			span({"class": "checkboard colourButton"}, makeColourPicker(null, "Set Stroke Colour", () => wallColour, (c: Colour) => wallColour = c, "wallColour")),
		])
	]),
	"mapMouseOver": mouseOver,
	"mapMouseDown": mouseDown,
	"mapMouseWheel": defaultMouseWheel,
	"set": (rpc: RPC) => {
		wallWaiter = Subscription.canceller(...([
			rpc.waitWallAdded,
			rpc.waitWallRemoved,
			rpc.waitLayerMove,
			rpc.waitLayerRemove,
			rpc.waitLayerShow,
			rpc.waitLayerHide,
			rpc.waitLayerShift
		] as (() => Subscription<any>)[]).map(fn => fn().then(genWalls)));
		on = true;
		genWalls();
		globals.root.appendChild(wallLayer);
		globals.deselectToken();
	},
	"unset": () => {
		wallWaiter();
		wallLayer.remove();
		walls.splice(0, walls.length);
		on = false;
	},
});
