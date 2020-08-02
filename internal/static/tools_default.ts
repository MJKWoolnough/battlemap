export const panZoom = {"x": 0, "y": 0, "zoom": 1};

const viewPos = {"mouseX": 0, "mouseY": 0};

export default Object.freeze({
	"name": "Default",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAABHPGVmAAAANlBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC3dmhyAAAAEnRSTlMAKsjRjoBmD/7/3dLykuQl4WerplB3AAAAzElEQVR4Ae3YtWFEURDF0M+M/RdrVmqWvXDVwHkQzRQppXTNlVXdtB/V9T8zhvEzTT9SqvFzdT9BZhOhZhSfi9rxtWUVPx5k3PZCCQTFRRYUE1k3FBFpdxQTKVQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFQFRFVAVAVEVUBUBURVQFylY8IxlX5iwlGVrsOQFLpnJUqUKFGiRIkSJUqUKFGiHP1fKGchKyqCcrAQMOvPE+PCSik9ArbiKbD2Zy9fAAAAAElFTkSuQmCC",
	"reset": () => {
		panZoom.x = 0;
		panZoom.y = 0;
		panZoom.zoom = 1;
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
	}
});
