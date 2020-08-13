import {br, div, input, label} from './lib/html.js';
import {requestSVGRoot} from './comms.js';

const draw = (root: SVGElement, e: MouseEvent) => {

      },
      rectangle = input({"id": "drawRectangle", "name": "drawShape", "type": "radio", "checked": true}),
      ellipse = input({"id": "drawEllipse", "type": "radio", "name": "drawShape"}),
      polygon = input({"id": "drawPoly", "type": "radio", "name": "drawShape"}),
      snap = input({"id": "drawSnap", "type": "checkbox"});

export default Object.freeze({
	"name": "Draw",
	"icon": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAADI0lEQVR4Ae3dAUScYRzH8W2LsLiYQZZBZ4aMNoJhoZmgEBqczXBmmcKGZdYY1hAEIYiWETSEIBJkBCG4zUp3SWNXsonKuy9e8NK15zzv+/zZ78eXgcPzWe/1hLsLtqZdJK3+5Wgg/vdnOiAtIMZ3iuK2KE9aIIwZihKVhZL98rSVgAiIIoxyEkEoBjDComgdtH/GwVdoRyjZrZVOah14XDkbFO3LGQd9kDjoDFC0PP0+H0QoVt7Ey+FRhCEUQxgnnlCq9IZypNWJUaZuKvtAifuRRNHcHzN5zyhFcpgwfLxHdNOJbxBh+P+J2q7vkSWMMRr1/J6zQ3nSHDEm6FWKv5VpDhhTNJjivUVzwJilp46vu5sOhjDm6RExNxD/GMJYpF6qtbc0mnxt/xjCWKEHnjG268MQxhrd84Dh4e9VwtigDg8YHh5RwtikWzYwhLFHN2xgCOOQroXHEEYjnVKTMMJjNNMRXRJGeIwWqhITRmiMNqoIwwZGO5WEYQOjk9aFYQOji1aFYQOjh5aEYQOjnxaEYQOjQHPCsIFRpGlh2MAYpklh2MAYoXFh2MB4HycMAxjjNCIMGxiTNCwMGxjTVBSGDYw5KgjDBsYC9QvDBsYS9QjDBsYqdQnDBsY6dQrDBkaJ2oVhA6NCbcKwgVGlFmGEx7hJR9QsjPAYt+mUGoURHqOTDokJIzTGfdoThg2Mh7QpDBsYfbQhDBsYA7QmDBsYT2hFGDYwntGiMGxgDNO8MGxgvKbZbDC0HG3VOLB3NJUdhjZU48A+0kR2GFqOftY4sLFsMbTiGZ+g1k0sLIZAEgcnjOyXoz2HAxRGBvvq/qFdwkhrdymifao4HKgwUtoniuiD+8EKw/da6TjuuvsBC8P3xiiiGff/9cLwvSaqUkR3HB9Fu3HC8LhBimhZ3/kXfpfpG0XUq2/FDL8+iqgU49RaA72kY2Gkt2WK6Pk5EIUYLYpLoPj8umtdBH/RlX+EKFGBrlKRhuKKlCMf00XQAaKBUp4ugpERCF0EE4WH0EUwThBB94Ii+iMIGxOEsVVjlMeC+L+maZqmaZqmaZqmadpf0F8jNPUbt/EAAAAASUVORK5CYII=",
	"reset": () => {},
	"options": div([
		label({"for": "drawRectangle"}, "Rectangle: "),
		rectangle,
		br(),
		label({"for": "drawEllipse"}, "Ellipse: "),
		ellipse,
		br(),
		label({"for": "drawPoly"}, "Polygon: "),
		polygon,
		br(),
		label({"for": "drawSnap"}, "Snap to Grid: "),
		snap
	]),
	"mapMouseDown": function(this: SVGElement, e: MouseEvent) {
		draw(this, e);
	},
	"tokenMouseDown": (e: MouseEvent) => draw(requestSVGRoot(), e)
});
