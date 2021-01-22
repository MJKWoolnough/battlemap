import {Uint, SVGAnimateBeginElement} from './types.js';
import {SVGToken} from './map.js';
import {createSVG, svg, animate, circle, g, path} from './lib/svg.js';
import {scrollAmount} from './settings.js';
import {globals, screen2Grid} from './map.js';
import {deselectToken} from './adminMap.js';
import {mapLoadedReceive} from './misc.js';
import lang from './language.js';
import {rpc, inited} from './rpc.js';

export const panZoom = {"x": 0, "y": 0, "zoom": 1},
zoom = (root: SVGElement, delta: number, x: number, y: number) => {
	const width = parseInt(root.getAttribute("width") || "0") / 2,
	      height = parseInt(root.getAttribute("height") || "0") / 2,
	      oldZoom = panZoom.zoom;
	if (delta < 0) {
		panZoom.zoom /= -delta;
	} else if (delta > 0) {
		panZoom.zoom *= delta;
	}
	panZoom.x += x - (panZoom.zoom * ((x + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
	panZoom.y += y - (panZoom.zoom * ((y + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
	createSVG(globals.outline, {"--zoom": panZoom.zoom});
	createSVG(root, {"transform": `scale(${panZoom.zoom})`,"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}});
},
defaultMouseWheel = function(this: SVGElement, e: WheelEvent) {
	e.preventDefault();
	if (e.ctrlKey) {
		zoom(this, Math.sign(e.deltaY) * 0.95, e.clientX, e.clientY);
	} else {
		const deltaY = e.shiftKey ? 0 : -e.deltaY,
		      deltaX = e.shiftKey ? -e.deltaY : -e.deltaX,
		      amount = scrollAmount.value || 100;
		createSVG(this, {"style": {"left": (panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount) + "px", "top": (panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount) + "px"}});
	}
};

mapLoadedReceive(() => {
	panZoom.x = 0;
	panZoom.y = 0;
	panZoom.zoom = 1;
});

export default Object.freeze({
	"name": lang["TOOL_DEFAULT"],
	"icon": svg({"viewBox": "0 0 20 20"}, path({"d": "M1,1 L20,20 M1,10 V1 H10", "fill": "none", "style": "stroke: currentColor", "stroke-width": 2})),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		if (e.button !== 0 && e.button !== 1) {
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
		if (e.ctrlKey) {
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
					if (!e.ctrlKey && (selectedLayer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY))) {
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
				}
			      },
			      keyDown = (e: KeyboardEvent) => {
				if (e.key === "Control") {
					document.body.style.setProperty("--outline-cursor", "grab");
					window.addEventListener("keyup", keyUp);
				}
			      };
			window.addEventListener("keydown", keyDown);
			if (e.ctrlKey) {
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
			rpc.signalMovePosition(pos);
		} else {
			rpc.signalPosition(pos);
		}
		e.preventDefault();
	},
	"tokenMouseContext": (e: MouseEvent) => e.stopPropagation()
});

const signalAnim1 = animate({"attributeName": "r", "values": "4;46", "dur": "1s"}) as SVGAnimateBeginElement,
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
      };

let isAdmin = false;

inited.then(() => {
	rpc.waitLogin().then(level => {
		isAdmin = level === 1;
		if (!isAdmin) {
			rpc.waitSignalMovePosition().then(pos => {
				const {mapData: {width, height}} = globals;
				panZoom.x = (window.innerWidth - width) / 2 - (pos[0] - width / 2) * panZoom.zoom;
				panZoom.y = (window.innerHeight - height) / 2 - (pos[1] - height / 2) * panZoom.zoom;
				createSVG(globals.root, {"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}})
				showSignal(pos);
			});
		}
	});
	rpc.waitSignalPosition().then(showSignal);
});
