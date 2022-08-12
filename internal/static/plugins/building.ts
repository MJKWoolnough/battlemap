import type {PluginType, SVGDrawingConstructor, SVGShapeConstructor} from '../plugins.js';
import {div} from '../lib/html.js';
import {addPlugin} from '../plugins.js'; 
import {isAdmin} from '../rpc.js';

let shapeClass: SVGShapeConstructor,
    drawingClass: SVGDrawingConstructor;

const upgradeClass = <T extends SVGShapeConstructor | SVGDrawingConstructor>(s: T) => class extends s {
      },
      plugin: PluginType = {
	"shapeClass": {
		"fn": (s: SVGShapeConstructor) => shapeClass = upgradeClass(s)
	},
	"drawingClass": {
		"fn": (s: SVGDrawingConstructor) => drawingClass = upgradeClass(s)
	}
      };

if (isAdmin) {
	const icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 61 64'%3E%3Cg transform='translate(20, 0) rotate(45, 28, 28)'%3E%3Cpath d='M20,50 v25 h10 s3,0 4,-3 l5,-25 s1,-3 -3,-3 h-10 z' fill='%23aac' /%3E%3Cpath d='M20,50 v25 h-10 s-3,0 -4,-3 l-5,-25 s-1,-3 3,-3 h10 z' fill='%2388a' /%3E%3Cpath d='M20,50 v-6 h6 z' fill='%23446' /%3E%3Cpath d='M20,50 v-6 h-6 z' fill='%23668' /%3E%3Cpath d='M21,45 v-1 c0,-5 -3,-5 -3,-10' stroke='%23446' stroke-width='2' /%3E%3Cpath d='M19,45 v-1 c0,-5 -3,-5 -3,-10' stroke='%23668' stroke-width='2' /%3E%3Cpath d='M17,35 s5,0 5,-3 v-25 s0,-5 -5,-5 z' fill='%23f80' /%3E%3Cpath d='M17,35 s-5,0 -5,-3 v-25 s0,-5 5,-5 z' fill='%23d60' /%3E%3C/g%3E%3C/svg%3E";
	plugin["menuItem"] = {
		"fn": ["", div(), true, icon]
	};
}

addPlugin("building", plugin);
