import {g} from './lib/svg.js';
import {scrollAmount} from './settings.js';

export const panZoom = {"x": 0, "y": 0, "zoom": 1},
zoom = function(this: SVGElement, delta: number, x: number, y: number) {
	const width = parseInt(this.getAttribute("width") || "0") / 2,
	      height = parseInt(this.getAttribute("height") || "0") / 2,
	      oldZoom = panZoom.zoom,
	      outline = document.getElementById("outline");
	if (delta < 0) {
		panZoom.zoom /= 0.95;
	} else if (delta > 0) {
		panZoom.zoom *= 0.95;
	}
	panZoom.x += x - (panZoom.zoom * ((x + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
	panZoom.y += y - (panZoom.zoom * ((y + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
	this.setAttribute("transform", `scale(${panZoom.zoom})`);
	if (outline instanceof SVGGElement) {
		outline.style.setProperty("--zoom", panZoom.zoom.toString());
	}
	this.style.setProperty("left", panZoom.x + "px");
	this.style.setProperty("top", panZoom.y + "px");
};

export default Object.freeze({
	"name": "Default",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAABHPGVmAAAANlBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC3dmhyAAAAEnRSTlMAKsjRjoBmD/7/3dLykuQl4WerplB3AAAAzElEQVR4Ae3YtWFEURDF0M+M/RdrVmqWvXDVwHkQzRQppXTNlVXdtB/V9T8zhvEzTT9SqvFzdT9BZhOhZhSfi9rxtWUVPx5k3PZCCQTFRRYUE1k3FBFpdxQTKVQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFylY8IxlX5iwlGVrsOQFLpnJUqUKFGiRIkSJUqUKFGiHP1fKGchKyqCcrAQMOvPE+PCSik9ArbiKbD2Zy9fAAAAAElFTkSuQmCC",
	"reset": () => {
		panZoom.x = 0;
		panZoom.y = 0;
		panZoom.zoom = 1;
	},
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		const base = e.currentTarget;
		if (base instanceof HTMLDivElement) {
			let mX = e.clientX,
			    mY = e.clientY;
			const viewDrag = (e: MouseEvent) => {
				panZoom.x += e.clientX - mX;
				panZoom.y += e.clientY - mY;
				this.style.setProperty("left", panZoom.x + "px");
				this.style.setProperty("top", panZoom.y + "px");
				mX = e.clientX;
				mY = e.clientX;
			      };
			base.addEventListener("mousemove", viewDrag);
			base.addEventListener("mouseup", () => base.removeEventListener("mousemove", viewDrag), {"once": true});
			e.preventDefault();
		}
	},
	"mapMouseWheel": function(this: SVGElement, e: WheelEvent) {
		e.preventDefault();
		if (e.ctrlKey) {
			zoom.call(this, e.deltaY, e.clientX, e.clientY);
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
