import type {FolderItems, FolderRPC, TokenDrawing, TokenShape, Uint} from '../types.js';
import type {SVGShape} from '../map_tokens.js';
import type {PluginType, SVGDrawingConstructor, SVGShapeConstructor} from '../plugins.js';
import {amendNode, clearNode} from '../lib/dom.js';
import {div} from '../lib/html.js';
import {Subscription} from '../lib/inter.js';
import {node} from '../lib/nodes.js';
import {Folder, Item, Root} from '../folders.js';
import {language} from '../language.js';
import {selected} from '../map_tokens.js';
import {addPlugin} from '../plugins.js';
import {isAdmin} from '../rpc.js';
import {addCSS} from '../shared.js';

type BuildingType = SVGShape & {};

interface BuildingShapeConstructor {
	new (token: TokenShape): BuildingType;
}

interface BuildingDrawingConstructor {
	new (token: TokenDrawing): BuildingType;
}

let shapeClass: BuildingShapeConstructor,
    drawingClass: BuildingDrawingConstructor;

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
	class BuildingItem extends Item {
		constructor(parent: Folder, id: Uint, name: string) {
			super(parent, id, name);
			clearNode(this[node], amendNode(this.nameElem, {"onauxclick": (e: MouseEvent) => {
				if (e.button === 1) {
					this.#apply();
				}
			}}));
		}
		#apply() {
			const {token} = selected;
			if (token instanceof shapeClass || token instanceof drawingClass) {
				// apply texture
			}
		}
		show(){}
	}

	class BuildingFolder extends Folder {
		constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
			super(root, parent, name, children);
			this.renamer.remove();
			this.newer.remove();
			this.remover.remove();
		}
	}

	class BuildingRoot extends Root {
		constructor() {
			super ({"folders": {
				[lang["FLOOR"]]: {"folders": {}, "items": {
					[lang["FLOOR_DIRT"]]: 1
				}},
				[lang["OBSTACLES"]]: {"folders": {}, "items": {}},
				[lang["WALLS"]]: {"folders": {}, "items": {}}
			}, "items": {}}, lang["MENU_TITLE"], {
				"waitAdded": unusedWaitFn,
				"waitMoved": unusedWaitFn,
				"waitRemoved": unusedWaitFn,
				"waitCopied": unusedWaitFn,
				"waitFolderAdded": unusedWaitFn,
				"waitFolderMoved": unusedWaitFn,
				"waitFolderRemoved": unusedWaitFn
			} as FolderRPC, BuildingItem, BuildingFolder);
			this.folder.newer.remove();
		}
	}

	addCSS("#pluginBuilding ul{padding-left: 1em;list-style: none}#pluginBuilding>div>ul{padding:0}");

	const icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 61 64'%3E%3Cg transform='translate(20, 0) rotate(45, 28, 28)'%3E%3Cpath d='M20,50 v25 h10 s3,0 4,-3 l5,-25 s1,-3 -3,-3 h-10 z' fill='%23aac' /%3E%3Cpath d='M20,50 v25 h-10 s-3,0 -4,-3 l-5,-25 s-1,-3 3,-3 h10 z' fill='%2388a' /%3E%3Cpath d='M20,50 v-6 h6 z' fill='%23446' /%3E%3Cpath d='M20,50 v-6 h-6 z' fill='%23668' /%3E%3Cpath d='M21,45 v-1 c0,-5 -3,-5 -3,-10' stroke='%23446' stroke-width='2' /%3E%3Cpath d='M19,45 v-1 c0,-5 -3,-5 -3,-10' stroke='%23668' stroke-width='2' /%3E%3Cpath d='M17,35 s5,0 5,-3 v-25 s0,-5 -5,-5 z' fill='%23f80' /%3E%3Cpath d='M17,35 s-5,0 -5,-3 v-25 s0,-5 5,-5 z' fill='%23d60' /%3E%3C/g%3E%3C/svg%3E",
	      defaultLanguage = {
		"MENU_TITLE": "Building",
		"FLOOR": "Floor",
		"FLOOR_DIRT": "Dirt Floor",
		"OBSTACLES": "Obstacles",
		"WALLS": "Walls"
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      unusedWait = new Subscription<any>(() => {}),
	      unusedWaitFn = () => unusedWait;

	plugin["menuItem"] = {
		"fn": [lang["MENU_TITLE"], div({"id": "pluginBuilding"}, new BuildingRoot()[node]), true, icon]
	};
}

addPlugin("building", plugin);
