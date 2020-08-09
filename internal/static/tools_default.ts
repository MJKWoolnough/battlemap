import {SVGToken} from './map.js';
import {g} from './lib/svg.js';
import {div} from './lib/html.js';
import {scrollAmount} from './settings.js';
import {requestSelected} from './comms.js';

export const panZoom = {"x": 0, "y": 0, "zoom": 1},
zoom = (root: SVGElement, delta: number, x: number, y: number) => {
	const width = parseInt(root.getAttribute("width") || "0") / 2,
	      height = parseInt(root.getAttribute("height") || "0") / 2,
	      oldZoom = panZoom.zoom,
	      outline = document.getElementById("outline");
	if (delta < 0) {
		panZoom.zoom /= -delta;
	} else if (delta > 0) {
		panZoom.zoom *= delta;
	}
	panZoom.x += x - (panZoom.zoom * ((x + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
	panZoom.y += y - (panZoom.zoom * ((y + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
	root.setAttribute("transform", `scale(${panZoom.zoom})`);
	if (outline instanceof SVGGElement) {
		outline.style.setProperty("--zoom", panZoom.zoom.toString());
	}
	root.style.setProperty("left", panZoom.x + "px");
	root.style.setProperty("top", panZoom.y + "px");
};

export default Object.freeze({
	"name": "Default",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAABHPGVmAAAANlBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC3dmhyAAAAEnRSTlMAKsjRjoBmD/7/3dLykuQl4WerplB3AAAAzElEQVR4Ae3YtWFEURDF0M+M/RdrVmqWvXDVwHkQzRQppXTNlVXdtB/V9T8zhvEzTT9SqvFzdT9BZhOhZhSfi9rxtWUVPx5k3PZCCQTFRRYUE1k3FBFpdxQTKVQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFylY8IxlX5iwlGVrsOQFLpnJUqUKFGiRIkSJUqUKFGiHP1fKGchKyqCcrAQMOvPE+PCSik9ArbiKbD2Zy9fAAAAAElFTkSuQmCC",
	"reset": () => {
		panZoom.x = 0;
		panZoom.y = 0;
		panZoom.zoom = 1;
	},
	"options": div("There are no options for this tool"),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		const base = e.currentTarget,
		      outline = document.getElementById("outline");
		if (e.target && (e.target as ChildNode).parentNode === outline && !e.ctrlKey) {
			return;
		}
		if (base instanceof HTMLDivElement) {
			base.classList.add("grabbed");
			let mX = e.clientX,
			    mY = e.clientY;
			const viewDrag = (e: MouseEvent) => {
				panZoom.x += e.clientX - mX;
				panZoom.y += e.clientY - mY;
				this.style.setProperty("left", panZoom.x + "px");
				this.style.setProperty("top", panZoom.y + "px");
				mX = e.clientX;
				mY = e.clientY;
			      };
			base.addEventListener("mousemove", viewDrag);
			base.addEventListener("mouseup", () => {
				base.classList.remove("grabbed");
				base.removeEventListener("mousemove", viewDrag);
			}, {"once": true});
			e.preventDefault();
		}
	},
	"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
		const base = e.currentTarget,
		      outline = document.getElementById("outline");
		if (e.target && (e.target as ChildNode).parentNode === outline) {
			return;
		}
		if (base instanceof HTMLDivElement) {
			const {layer} = requestSelected();
			base.classList.add("toGrab");
			if (layer) {
				const mouse = {"x": 0, "y": 0},
				      keyUp = (e: KeyboardEvent) => {
					if (e.key === "Control" && (layer.tokens as SVGToken[]).some(t => t.at(mouse.x, mouse.y))) {
						base.classList.add("overToken");
					}
				      }, keyDown = (e: KeyboardEvent) => {
					if (e.key === "Control") {
						base.classList.remove("overToken");
						window.addEventListener("keyup", keyUp, {"once": true});
					}
				      },
				      mouseMove = (e: MouseEvent) => {
					base.classList.remove("overToken");
					if (!e.ctrlKey && (layer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY))) {
						base.classList.add("overToken");
					}
					mouse.x = e.clientX;
					mouse.y = e.clientY;
				      };
				if (e.ctrlKey) {
					window.addEventListener("keyup", keyUp, {"once": true});
					mouseMove(e);
				}
				window.addEventListener("keydown", keyDown);
				base.addEventListener("mousemove", mouseMove);
				base.addEventListener("mouseout", () => {
					window.removeEventListener("keydown", keyDown);
					window.removeEventListener("keyup", keyUp);
					base.removeEventListener("mousemove", mouseMove);
					base.classList.remove("toGrab", "overToken");
				}, {"once": true});
			} else {
				base.addEventListener("mouseout", () => base.classList.remove("toGrab", "overToken"), {"once": true});
			}
		}
	},
	"mapMouseWheel": function(this: SVGElement, e: WheelEvent) {
		e.preventDefault();
		if (e.ctrlKey) {
			zoom(this, Math.sign(e.deltaY) * 0.95, e.clientX, e.clientY);
		} else {
			const deltaY = e.shiftKey ? 0 : -e.deltaY,
			      deltaX = e.shiftKey ? -e.deltaY : -e.deltaX,
			      amount = scrollAmount.value || 100;
			panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount;
			panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount;
			this.style.setProperty("left", panZoom.x + "px");
			this.style.setProperty("top", panZoom.y + "px");
		}
	}
});
