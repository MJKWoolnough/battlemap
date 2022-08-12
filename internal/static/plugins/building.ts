import type {PluginType, SVGDrawingConstructor, SVGShapeConstructor} from '../plugins.js';
import {addPlugin} from '../plugins.js'; 

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

addPlugin("building", plugin);
