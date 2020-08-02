import {g} from './lib/svg.js';
import {scrollAmount} from './settings.js';

export const panZoom = {"x": 0, "y": 0, "zoom": 1};

const viewPos = {"mouseX": 0, "mouseY": 0},
      outline = g();

export default Object.freeze({
	"name": "Default",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAABHPGVmAAAANlBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC3dmhyAAAAEnRSTlMAKsjRjoBmD/7/3dLykuQl4WerplB3AAAAzElEQVR4Ae3YtWFEURDF0M+M/RdrVmqWvXDVwHkQzRQppXTNlVXdtB/V9T8zhvEzTT9SqvFzdT9BZhOhZhSfi9rxtWUVPx5k3PZCCQTFRRYUE1k3FBFpdxQTKVQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFylY8IxlX5iwlGVrsOQFLpnJUqUKFGiRIkSJUqUKFGiHP1fKGchKyqCcrAQMOvPE+PCSik9ArbiKbD2Zy9fAAAAAElFTkSuQmCC",
	"reset": () => {
		panZoom.x = 0;
		panZoom.y = 0;
		panZoom.zoom = 1;
		outline.remove();
	},
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		if (e.currentTarget instanceof HTMLDivElement) {
			let mX = e.clientX,
			    mY = e.clientY;
			const base: HTMLDivElement = e.currentTarget,
			      viewDrag = (e: MouseEvent) => {
				panZoom.x += e.clientX - viewPos.mouseX;
				panZoom.y += e.clientY - viewPos.mouseY;
				this.style.setProperty("left", panZoom.x + "px");
				this.style.setProperty("top", panZoom.y + "px");
				mX = e.clientX;
				mY = e.clientX;
			      };
			e.currentTarget!.addEventListener("mousemove", viewDrag);
			e.currentTarget!.addEventListener("mouseup", () => base.removeEventListener("mousemove", viewDrag), {"once": true});
		}
	},
	"mapMouseWheel": function(this: SVGElement, e: WheelEvent) {
		e.preventDefault();
		if (e.ctrlKey) {
			const width = parseInt(this.getAttribute("width") || "0") / 2,
			      height = parseInt(this.getAttribute("height") || "0") / 2,
			      oldZoom = panZoom.zoom;
			if (e.deltaY < 0) {
				panZoom.zoom /= 0.95;
			} else if (e.deltaY > 0) {
				panZoom.zoom *= 0.95;
			}
			panZoom.x += e.clientX - (panZoom.zoom * ((e.clientX + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
			panZoom.y += e.clientY - (panZoom.zoom * ((e.clientY + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
			this.setAttribute("transform", `scale(${panZoom.zoom})`);
			outline.style.setProperty("--zoom", panZoom.zoom.toString());
		} else {
			const deltaY = e.shiftKey ? 0 : -e.deltaY,
			      deltaX = e.shiftKey ? -e.deltaY : -e.deltaX,
			      amount = scrollAmount.value || 100;
			panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount;
			panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount;
		}
		this.style.setProperty("left", panZoom.x + "px");
		this.style.setProperty("top", panZoom.y + "px");
	}
});
