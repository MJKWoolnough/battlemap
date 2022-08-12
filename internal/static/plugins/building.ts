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
	plugin["menuItem"] = {
		"fn": ["", div(), true, ""]
	};
}

addPlugin("building", plugin);
