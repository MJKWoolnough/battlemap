import type {Int, Uint, SVGAnimateBeginElement} from './types.js';
import type {SVGLayer, SVGFolder} from './map.js';
import type {NodeArray} from './lib/nodes.js';
import place, {item, menu, List} from './lib/context.js';
import {createDocumentFragment} from './lib/dom.js';
import {br, button, input, h1} from './lib/html.js';
import {createSVG, svg, animate, circle, g, path, rect, title} from './lib/svg.js';
import {scrollAmount, zoomSlider} from './settings.js';
import {SVGToken, isSVGFolder, isTokenImage} from './map.js';
import {edit as tokenEdit} from './characters.js';
import {doTokenMoveLayerPos, doTokenSet, doTokenRemove, doTokenLightChange, snapTokenToGrid} from './map_fns.js';
import {checkInt, deselectToken, globals, labels, mapLoadedReceive, SQRT3, isAdmin} from './shared.js';
import {makeColourPicker} from './colours.js';
import {tokenContext} from './plugins.js';
import lang from './language.js';
import {rpc, inited} from './rpc.js';
import {windows, shell} from './windows.js';

export const panZoom = {"x": 0, "y": 0, "zoom": 1},
screen2Grid = (() => {
	const points: readonly [number, number][] = [
		[0, 1/6],
		[0, 2/6],
		[0, 3/6],
		[0, 5/6],
		[1/4, 1/12],
		[1/4, 7/12],
		[1/2, 0],
		[1/2, 1/3],
		[1/2, 2/3],
		[1/2, 5/6],
		[1/2, 1],
		[3/4, 1/12],
		[3/4, 7/12],
		[1, 1/6],
		[1, 2/6],
		[1, 3/6],
		[1, 5/6]
	      ];
	return (x: Uint, y: Uint, snap = false): [Int, Int] => {
		const {mapData} = globals,
		      sx = (x + ((panZoom.zoom - 1) * mapData.width / 2) - panZoom.x) / panZoom.zoom,
		      sy = (y + ((panZoom.zoom - 1) * mapData.height / 2) - panZoom.y) / panZoom.zoom;
		if (snap) {
			const gridType = globals.mapData.gridType;
			switch (gridType) {
			case 1:
			case 2: {
				const size = globals.mapData.gridSize,
				      o = 2 * Math.round(1.5 * size / SQRT3),
				      w = gridType === 1 ? size : o,
				      h = gridType === 2 ? size : o,
				      px = sx / w,
				      py = sy / h,
				      dx = px % 1,
				      dy = py % 1,
				      first = gridType - 1 as 0 | 1,
				      second = 1 - first as 0 | 1;
				let nearestPoint: [number, number] = [0, 0],
				    nearest = Infinity;
				for (const point of points) {
					const d = Math.hypot(point[first] - dx, point[second] - dy);
					if (d < nearest) {
						nearest = d;
						nearestPoint = point;
					}
				}
				return [Math.round((Math.floor(px) + nearestPoint[first]) * w), Math.round((Math.floor(py) + nearestPoint[second]) * h)];
			}
			default:
				const size = mapData.gridSize >> 1;
				return [size * Math.round(sx / size), size * Math.round(sy / size)];
			}
		}
		return [Math.round(sx), Math.round(sy)];
	};
})(),
zoom = (delta: number, x: number, y: number, moveControl = true) => {
	const {root, outline} = globals,
	      width = checkInt(parseInt(root.getAttribute("width") || "0"), 0) / 2,
	      height = checkInt(parseInt(root.getAttribute("height") || "0"), 0) / 2,
	      oldZoom = panZoom.zoom;
	if (delta < 0) {
		panZoom.zoom /= -delta;
	} else if (delta > 0) {
		panZoom.zoom *= delta;
	}
	panZoom.x += x - (panZoom.zoom * ((x + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
	panZoom.y += y - (panZoom.zoom * ((y + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
	createSVG(outline, {"style": {"--zoom": panZoom.zoom}});
	createSVG(root, {"transform": `scale(${panZoom.zoom})`,"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}});
	if (moveControl) {
		zoomerControl.setAttribute("cy", Math.max(10, 120 - Math.min(110, 60 + 10 * Math.log(panZoom.zoom) / l4)) + "");
	}
},
centreOnGrid = (x: Uint, y: Uint) => {
	const {mapData: {width, height}} = globals,
	      iw = window.innerWidth,
	      ih = window.innerHeight,
	      {zoom} = panZoom;
	panZoom.x = Math.min(Math.max((iw - width) / 2 - (x - width / 2) * zoom, iw - width * (zoom + 1) / 2), width * (zoom - 1) / 2);
	panZoom.y = Math.min(Math.max((ih - height) / 2 - (y - height / 2) * zoom, ih - height * (zoom + 1) / 2), height * (zoom - 1) / 2);
	createSVG(globals.root, {"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}})
},
defaultMouseWheel = function(this: SVGElement, e: WheelEvent) {
	e.preventDefault();
	if (e.ctrlKey) {
		zoom(Math.sign(e.deltaY) * 0.95, e.clientX, e.clientY);
	} else {
		const amount = scrollAmount.value || 100;
		createSVG(this, {"style": {"left": (panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount) + "px", "top": (panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount) + "px"}});
	}
};

mapLoadedReceive(() => {
	const {mapData: {startX, startY}} = globals;
	panZoom.zoom = 1;
	centreOnGrid(startX, startY);
	zoomerControl.setAttribute("cy", "60");
});

export default Object.freeze({
	"name": lang["TOOL_DEFAULT"],
	"icon": svg({"viewBox": "0 0 20 20"}, [title(lang["TOOL_DEFAULT"]), path({"d": "M1,1 L20,20 M1,10 V1 H10", "fill": "none", "style": "stroke: currentColor", "stroke-width": 2})]),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		if (e.button !== 0 && e.button !== 1 || e.shiftKey) {
			return;
		}
		const {outline} = globals;
		if (!e.ctrlKey && e.button !== 1) {
			if (document.body.style.getPropertyValue("--outline-cursor") === "pointer") {
				document.body.style.removeProperty("--outline-cursor");
				return;
			} else if (e.target && (e.target as ChildNode).parentNode === outline) {
				return;
			}
		}
		if (!isAdmin) {
			document.body.classList.toggle("dragging", true);
		}
		this.style.setProperty("--outline-cursor", "grabbing");
		let mX = e.clientX,
		    mY = e.clientY,
		    moved = false;
		const viewDrag = (e: MouseEvent) => {
			moved = true;
			panZoom.x += e.clientX - mX;
			panZoom.y += e.clientY - mY;
			createSVG(this, {"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}});
			mX = e.clientX;
			mY = e.clientY;
		      },
		      stop = () => {
			if (!moved) {
				deselectToken();
			}
			if (!isAdmin) {
				document.body.classList.remove("dragging");
			}
			this.style.removeProperty("--outline-cursor");
			this.removeEventListener("mousemove", viewDrag);
			this.removeEventListener("mouseup", stop);
			this.removeEventListener("mouseleave", stop);
		      };
		this.addEventListener("mousemove", viewDrag);
		this.addEventListener("mouseup", stop);
		this.addEventListener("mouseleave", stop)
		e.preventDefault();
	},
	"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
		const {selected: {layer: selectedLayer}, outline} = globals,
		      overOutline = e.target && (e.target as ChildNode).parentNode === outline,
		      currentlyOverToken = overOutline || selectedLayer && (selectedLayer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY));
		let ctrl = e.ctrlKey;
		if (ctrl && !e.shiftKey) {
			document.body.style.setProperty("--outline-cursor", "grab");
		} else if (!overOutline) {
			if (currentlyOverToken) {
				document.body.style.setProperty("--outline-cursor", "pointer");
			} else {
				document.body.style.setProperty("--outline-cursor", "grab");
			}
		}
		if (!overOutline) {
			if (selectedLayer) {
				let overToken = currentlyOverToken;
				const keyUp = (e: KeyboardEvent) => {
					if (e.key === "Control" && overToken) {
						document.body.style.setProperty("--outline-cursor", "pointer");
						window.removeEventListener("keyup", keyUp);
					}
				      },
				      keyDown = (e: KeyboardEvent) => {
					if (e.key === "Control" && overToken) {
						document.body.style.setProperty("--outline-cursor", "grab");
						window.addEventListener("keyup", keyUp);
					}
				      },
				      mouseMove = (e: MouseEvent) => {
					if (!ctrl && (selectedLayer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY))) {
						if (!overToken) {
							overToken = true;
							document.body.style.setProperty("--outline-cursor", "pointer");
						}
					} else if (overToken) {
						document.body.style.setProperty("--outline-cursor", "grab");
						overToken = false;
					}
				};
				this.addEventListener("mousemove", mouseMove);
				window.addEventListener("keydown", keyDown);
				if (currentlyOverToken) {
					window.addEventListener("keyup", keyUp);
				}
				this.addEventListener("mouseout", () => {
					document.body.style.removeProperty("--outline-cursor");
					window.removeEventListener("keydown", keyDown);
					window.removeEventListener("keyup", keyUp);
					this.removeEventListener("mousemove", mouseMove);
				}, {"once": true})
			} else {
				this.addEventListener("mouseout", () => document.body.style.removeProperty("--outline-cursor"), {"once": true})
			}
		} else {
			const keyUp = (e: KeyboardEvent) => {
				if (e.key === "Control") {
					document.body.style.removeProperty("--outline-cursor");
					window.removeEventListener("keyup", keyUp);
					ctrl = false;
				} else if (ctrl && e.key === "Shift") {
					document.body.style.setProperty("--outline-cursor", "grab");
				}
			      },
			      keyDown = (e: KeyboardEvent) => {
				if (e.key === "Control" && !e.shiftKey) {
					document.body.style.setProperty("--outline-cursor", "grab");
					window.addEventListener("keyup", keyUp);
					ctrl = true;
				} else if (ctrl && e.key === "Shift") {
					document.body.style.removeProperty("--outline-cursor");
				}
			      };
			window.addEventListener("keydown", keyDown);
			if (ctrl || e.shiftKey) {
				window.addEventListener("keyup", keyUp);
			}
			this.addEventListener("mouseout", () => {
				document.body.style.removeProperty("--outline-cursor");
				window.removeEventListener("keydown", keyDown);
				window.removeEventListener("keyup", keyUp);
			}, {"once": true})
		}
	},
	"mapMouseWheel": defaultMouseWheel,
	"mapMouseContext": function(this: SVGElement, e: MouseEvent) {
		const pos = screen2Grid(e.clientX, e.clientY);
		showSignal(pos);
		if (e.ctrlKey && isAdmin) {
			if (e.altKey) {
				rpc.setMapStart(pos[0], pos[1]);
			}
			rpc.signalMovePosition(pos);
		} else {
			rpc.signalPosition(pos);
		}
		e.preventDefault();
	},
	"tokenMouseContext": (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const {layer: currLayer, token: currToken} = globals.selected;
		if (!currLayer || !currToken) {
			return;
		}
		const tokenPos = currLayer.tokens.findIndex(t => t === currToken);
		place(document.body, [e.clientX, e.clientY], [
			tokenContext(),
			isTokenImage(currToken) ? [
				item(lang["CONTEXT_EDIT_TOKEN"], () => currToken instanceof SVGToken && tokenEdit(currToken.id, lang["CONTEXT_EDIT_TOKEN"], currToken.tokenData, false)),
				item(lang["CONTEXT_FLIP"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					doTokenSet({"id": currToken.id, "flip": !currToken.flip});
					globals.outline.focus();
				}),
				item(lang["CONTEXT_FLOP"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					doTokenSet({"id": currToken.id, "flop": !currToken.flop});
					globals.outline.focus();
				}),
				item(currToken.isPattern ? lang["CONTEXT_SET_IMAGE"] : lang["CONTEXT_SET_PATTERN"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					if (!currToken.isPattern) {
						doTokenSet({"id": currToken.id, "patternWidth": currToken.width, "patternHeight": currToken.height});
					} else {
						doTokenSet({"id": currToken.id, "patternWidth": 0, "patternHeight": 0});
					}
					globals.outline.focus();
				}),
			] : [],
			item(currToken.snap ? lang["CONTEXT_UNSNAP"] : lang["CONTEXT_SNAP"], () => {
				const snap = currToken.snap,
				      {x, y, width, height, rotation} = currToken;
				if (!snap) {
					const [newX, newY] = snapTokenToGrid(x, y, width, height),
					      newRotation = Math.round(rotation / 32) * 32 % 256;
					if (x !== newX || y !== newY || rotation !== newRotation) {
						doTokenSet({"id": currToken.id, "x": newX, "y": newY, "rotation": newRotation, "snap": !snap});
					}
				} else {
					doTokenSet({"id": currToken.id, "snap": !snap});
				}
				globals.outline.focus();
			}),
			item(lang["CONTEXT_SET_LIGHTING"], () => {
				let c = currToken.lightColour;
				const w = shell.appendChild(windows({"window-title": lang["CONTEXT_SET_LIGHTING"], "onremove": () => globals.outline.focus()})),
				      i = input({"type": "number", "value": currToken.lightIntensity, "min": 0, "step": 1});
				w.appendChild(createDocumentFragment([
					h1(lang["CONTEXT_SET_LIGHTING"]),
					labels(`${lang["LIGHTING_COLOUR"]}: `, makeColourPicker(w, lang["LIGHTING_PICK_COLOUR"], () => c, d => c = d)),
					br(),
					labels(`${lang["LIGHTING_INTENSITY"]}: `, i),
					br(),
					button({"onclick": () => {
						if (globals.selected.token === currToken) {
							doTokenLightChange(currToken.id, c, checkInt(parseInt(i.value), 0));
						}
						w.close();
					}}, lang["SAVE"])
				]));
			}),
			tokenPos < currLayer.tokens.length - 1 ? [
				item(lang["CONTEXT_MOVE_TOP"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer;
					doTokenMoveLayerPos(currToken.id, currLayer.path, currLayer.tokens.length - 1);
					globals.outline.focus();
				}),
				item(lang["CONTEXT_MOVE_UP"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer,
					      newPos = currLayer.tokens.findIndex(t => t === currToken) + 1;
					doTokenMoveLayerPos(currToken.id, currLayer.path, newPos);
					globals.outline.focus();
				})
			] : [],
			tokenPos > 0 ? [
				item(lang["CONTEXT_MOVE_DOWN"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer,
					      newPos = currLayer.tokens.findIndex(t => t === currToken) - 1;
					doTokenMoveLayerPos(currToken.id, currLayer.path, newPos);
				}),
				item(lang["CONTEXT_MOVE_BOTTOM"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer;
					doTokenMoveLayerPos(currToken.id, currLayer.path, 0);
					globals.outline.focus();
				})
			] : [],
			menu(lang["CONTEXT_MOVE_LAYER"], makeLayerContext(globals.layerList, (sl: SVGLayer) => {
				if (!globals.tokens.has(currToken.id)) {
					return;
				}
				doTokenMoveLayerPos(currToken.id, sl.path, sl.tokens.length);
				globals.outline.focus();
			}, currLayer.name)),
			item(lang["CONTEXT_DELETE"], () => doTokenRemove(currToken.id))
		]);
	}
});

const makeLayerContext = (folder: SVGFolder, fn: (sl: SVGLayer) => void, disabled = ""): List => (folder.children as NodeArray<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] : isSVGFolder(e) ? menu(e.name, makeLayerContext(e, fn, disabled)) : item(e.name, () => fn(e), {"disabled": e.name === disabled})),
      signalAnim1 = animate({"attributeName": "r", "values": "4;46", "dur": "1s"}) as SVGAnimateBeginElement,
      signalAnim2 = animate({"attributeName": "r", "values": "4;46", "dur": "1s"}) as SVGAnimateBeginElement,
      signal = g([
	circle({"cx": 50, "cy": 50, "stroke": "#f00", "stroke-width": 8, "fill": "none"}, signalAnim1),
	circle({"cx": 50, "cy": 50, "stroke": "#00f", "stroke-width": 4, "fill": "none"}, signalAnim2)
      ]),
      showSignal = (pos: [Uint, Uint]) => {
	signal.setAttribute("transform", `translate(${pos[0] - 50}, ${pos[1] - 50})`);
	globals.root.appendChild(signal);
	signalAnim1.beginElement();
	signalAnim2.beginElement();
      },
      zoomMove = (e: MouseEvent) => {
	const v = Math.max(10, Math.min(110, e.clientY)),
	      z = Math.pow(1.4, (60 - v) / 10);
	zoomerControl.setAttribute("cy", v + "");
	zoom(z / panZoom.zoom, window.innerWidth >> 1, window.innerHeight >> 1, false);
      },
      zoomWheel = (e: WheelEvent) => zoom(Math.sign(e.deltaY) * 0.95, window.innerWidth >> 1, window.innerHeight >> 1),
      zoomMouseUp = (e: MouseEvent) => {
	if (e.button !== 0) {
		return;
	}
	window.removeEventListener("mousemove", zoomMove);
	window.removeEventListener("mouseup", zoomMouseUp);
	document.body.classList.remove("zooming");
      },
      zoomerControl = circle({"cx": 10, "cy": 60, "r": 10, "stroke": "#000", "onmousedown": (e: MouseEvent) => {
	if (e.button !== 0) {
		return;
	}
	window.addEventListener("mousemove", zoomMove);
	window.addEventListener("mouseup", zoomMouseUp);
	document.body.classList.add("zooming");
      }, "onwheel": zoomWheel}),
      zoomer = svg({"id": "zoomSlider", "viewBox": "0 0 20 120"}, [
	rect({"width": 20, "height": 120, "rx": 10, "stroke": "#000", "onclick": (e: MouseEvent) => {
		if (e.button === 0) {
			zoomMove(e);
		}
	}, "onwheel": zoomWheel}),
	zoomerControl
      ]),
      l4 = Math.log(1.4);

inited.then(() => {
	shell.appendChild(zoomer);
	if (!isAdmin) {
		let sliding = -1;
		rpc.waitSignalMovePosition().then(pos => {
			if (sliding === -1) {
				document.body.classList.toggle("sliding", true);
			} else {
				window.clearTimeout(sliding);
			}
			sliding = window.setTimeout(() => {
				document.body.classList.remove("sliding")
				sliding = -1;
			}, 1000);
			centreOnGrid(pos[0], pos[1]);
			showSignal(pos);
		});
	}
	rpc.waitSignalPosition().then(showSignal);
});

zoomSlider.wait(enabled => document.body.classList.toggle("hideZoomSlider", enabled));
