import {br, div, input, label} from './lib/html.js';
import {createSVG, rect, circle, g, polyline, polygon} from './lib/svg.js';
import {requestSVGRoot, requestMapData, requestSelected} from './comms.js';
import {autosnap} from './settings.js';
import {panZoom} from './tools_default.js';

let over = false;
const draw = (root: SVGElement, e: MouseEvent) => {
	e.stopPropagation();
      },
      marker = g({"id": "MARKER"}, [
	      polygon({"points": "5,0 16,0 11,5", "fill": "#000"}),
	      polygon({"points": "0,5 0,16 5,11", "fill": "#000"}),
	      polygon({"points": "5,21 16,21 11,16", "fill": "#000"}),
	      polygon({"points": "21,16 21,5 16,11", "fill": "#000"})
      ]),
      showMarker = (root: SVGElement) => {
	if (over) {
		return;
	}
	over = true;
	createSVG(root, {"style": {"cursor": "none"}}, marker);
	const {deselectToken} = requestSelected(),
	      onmousemove = (e: MouseEvent) => {
		const mapData = requestMapData();
		let x = Math.round((e.clientX + ((panZoom.zoom - 1) * mapData.width / 2) - panZoom.x) / panZoom.zoom),
		    y = Math.round((e.clientY + ((panZoom.zoom - 1) * mapData.height / 2) - panZoom.y) / panZoom.zoom);
		if (snap.checked) {
			x = Math.round(x / mapData.gridSize) * mapData.gridSize;
			y = Math.round(y / mapData.gridSize) * mapData.gridSize;
		}
		createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
	};
	deselectToken();
	createSVG(root, {onmousemove, "1onmouseleave": (e: MouseEvent) => {
		over = false;
		root.removeEventListener("mousemove", onmousemove);
		root.style.removeProperty("cursor");
		marker.remove();
	}});
      },
      rectangle = input({"id": "drawRectangle", "name": "drawShape", "type": "radio", "checked": true}),
      ellipse = input({"id": "drawEllipse", "type": "radio", "name": "drawShape"}),
      poly = input({"id": "drawPoly", "type": "radio", "name": "drawShape"}),
      snap = input({"id": "drawSnap", "type": "checkbox", "checked": autosnap.value}),
      shiftSnap = (e: KeyboardEvent) => {
	if (e.key === "Shift") {
		snap.click();
	}
      };

window.addEventListener("keydown", shiftSnap);
window.addEventListener("keyup", shiftSnap);

export default Object.freeze({
	"name": "Draw",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAADI0lEQVR4Ae3dAUScYRzH8W2LsLiYQZZBZ4aMNoJhoZmgEBqczXBmmcKGZdYY1hAEIYiWETSEIBJkBCG4zUp3SWNXsonKuy9e8NK15zzv+/zZ78eXgcPzWe/1hLsLtqZdJK3+5Wgg/vdnOiAtIMZ3iuK2KE9aIIwZihKVhZL98rSVgAiIIoxyEkEoBjDComgdtH/GwVdoRyjZrZVOah14XDkbFO3LGQd9kDjoDFC0PP0+H0QoVt7Ey+FRhCEUQxgnnlCq9IZypNWJUaZuKvtAifuRRNHcHzN5zyhFcpgwfLxHdNOJbxBh+P+J2q7vkSWMMRr1/J6zQ3nSHDEm6FWKv5VpDhhTNJjivUVzwJilp46vu5sOhjDm6RExNxD/GMJYpF6qtbc0mnxt/xjCWKEHnjG268MQxhrd84Dh4e9VwtigDg8YHh5RwtikWzYwhLFHN2xgCOOQroXHEEYjnVKTMMJjNNMRXRJGeIwWqhITRmiMNqoIwwZGO5WEYQOjk9aFYQOji1aFYQOjh5aEYQOjnxaEYQOjQHPCsIFRpGlh2MAYpklh2MAYoXFh2MB4HycMAxjjNCIMGxiTNCwMGxjTVBSGDYw5KgjDBsYC9QvDBsYS9QjDBsYqdQnDBsY6dQrDBkaJ2oVhA6NCbcKwgVGlFmGEx7hJR9QsjPAYt+mUGoURHqOTDokJIzTGfdoThg2Mh7QpDBsYfbQhDBsYA7QmDBsYT2hFGDYwntGiMGxgDNO8MGxgvKbZbDC0HG3VOLB3NJUdhjZU48A+0kR2GFqOftY4sLFsMbTiGZ+g1k0sLIZAEgcnjOyXoz2HAxRGBvvq/qFdwkhrdymifao4HKgwUtoniuiD+8EKw/da6TjuuvsBC8P3xiiiGff/9cLwvSaqUkR3HB9Fu3HC8LhBimhZ3/kXfpfpG0XUq2/FDL8+iqgU49RaA72kY2Gkt2WK6Pk5EIUYLYpLoPj8umtdBH/RlX+EKFGBrlKRhuKKlCMf00XQAaKBUp4ugpERCF0EE4WH0EUwThBB94Ii+iMIGxOEsVVjlMeC+L+maZqmaZqmaZqmadpf0F8jNPUbt/EAAAAASUVORK5CYII=",
	"options": div([
		label({"for": "drawRectangle"}, "Rectangle: "),
		rectangle,
		br(),
		label({"for": "drawEllipse"}, "Ellipse: "),
		ellipse,
		br(),
		label({"for": "drawPoly"}, "Polygon: "),
		poly,
		br(),
		label({"for": "drawSnap"}, "Snap to Grid: "),
		snap
	]),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		draw(this, e);
	},
	"mapMouseOver": function(this: SVGElement) {
		showMarker(this);
	},
	"tokenMouseDown": (e: MouseEvent) => draw(requestSVGRoot(), e),
	"tokenMouseOver": () => showMarker(requestSVGRoot())
});
