import {Colour, Int, RPC, Wall} from './types.js';
import {clearElement} from './lib/dom.js';
import {br, button, div, input, label, span} from './lib/html.js';
import {createSVG, circle, defs, g, line, path, polygon, radialGradient, stop, svg, use} from './lib/svg.js';
import {handleError, screen2Grid, colour2RGBA, colourPicker, requestShell, point2Line} from './misc.js';
import {normaliseWall, updateLight, globals} from './map.js';
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
			let i = 0;
			for (const w of globals.mapData.walls) {
				if (over(x, y, w)) {
					const element = (wallLayer.childNodes[i] as SVGGElement);
					element.setAttribute("stroke-width", "5");
					lastWall = {"wall": w, element};
					break;
				}
				i++;
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
	if (e.button !== 0) {
		return;
	}
	if (sunTool.checked) {
		const [x, y] = screen2Grid(e.clientX, e.clientY, e.shiftKey);
		rpc.shiftLight(globals.mapData.lightX = x, globals.mapData.lightY = y);
		updateLight();
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
			      w = normaliseWall({x1, y1, x2, y2, "colour": wallColour});
			if (x2 === x1 && y2 === y1) {
				return;
			}
			rpc.addWall(w.x1, w.y1, w.x2, w.y2, wallColour).catch(handleError);
			globals.mapData.walls.push(w);
			wallLayer.appendChild(line({x1, y1, x2, y2, "stroke": colour2RGBA(wallColour)}));
			updateLight();
		      },
		      onkeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				reset();
			}
		      };
		createSVG(this, {onmousemove, onmouseup}, l)
		window.addEventListener("keydown", onkeydown);
	} else {
		// delete Wall Tool
	}
      },
      setColour = (title: string, getColour: () => Colour, setColour: (c: Colour) => void) => function(this: HTMLButtonElement) {
        colourPicker(requestShell(), title, getColour()).then(c => {
                setColour(c);
                if (c.a === 0) {
                        this.style.setProperty("background-color", "#fff");
                        this.innerText = "None";
                } else {
                        this.style.setProperty("background-color", colour2RGBA(c));
                        this.innerText = "";
                }
	});
      },
      wallLayer = g({"stroke-width": 2});


let wallColour: Colour = {"r": 0, "g": 0, "b": 0, "a": 255},
    lastWall: {wall: Wall; element: SVGGElement} | null = null;

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
		div({"id": "sunToolOptions"}, [
			label("Light Colour"),
			br(),
			label("Height")
		]),
		div({"id": "wallToolOptions"}, [
			label("Wall Colour: "),
			span({"class": "checkboard colourButton"}, button({"id": "wallColour", "style": "background-color: #000; width: 50px; height: 50px", "onclick": setColour("Set Stroke Colour", () => wallColour, (c: Colour) => wallColour = c)})),
		])
	]),
	"mapMouseOver": mouseOver,
	"mapMouseDown": mouseDown,
	"mapMouseWheel": defaultMouseWheel,
	"set": () => globals.root.appendChild(createSVG(clearElement(wallLayer), globals.mapData.walls.map(({x1, y1, x2, y2, colour}) => line({x1, y1, x2, y2, "stroke": colour2RGBA(colour)})))),
	"unset": () => wallLayer.remove(),
});
