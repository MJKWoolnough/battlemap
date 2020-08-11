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
	      {outline} = requestSelected();
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
		const {outline} = requestSelected();
		if (e.target && (e.target as ChildNode).parentNode === outline && !e.ctrlKey) {
			return;
		}
		this.style.setProperty("--outline-cursor", "grabbing");
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
		this.addEventListener("mousemove", viewDrag);
		this.addEventListener("mouseup", () => {
			this.style.removeProperty("--outline-cursor");
			this.removeEventListener("mousemove", viewDrag);
		}, {"once": true});
		e.preventDefault();
	},
	"mapMouseOver": function(this: SVGElement, e: MouseEvent) {
		const {layer, outline} = requestSelected(),
		      overOutline = e.target && (e.target as ChildNode).parentNode === outline,
		      currentlyOverToken = overOutline || layer && (layer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY));
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
			if (layer) {
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
					if (!e.ctrlKey && (layer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY))) {
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
