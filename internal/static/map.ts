import {Colour, FromTo, IDName, Int, RPC, GridDetails,  LayerFolder, LayerRPC, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createSVG, g, image, path, pattern, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import place, {item, menu, List} from './lib/context.js';
import {ShellElement} from './windows.js';
import {SVGLayer, SVGFolder, SVGGrid, SVGImage, Defs, SVGToken, SVGShape} from './map_types.js';
import {ratio, processLayers, subFn, getLayer, getParentLayer, isSVGLayer, isSVGFolder, walkFolders, splitAfterLastSlash, makeLayerContext} from './map_fns.js';

export default function(rpc: RPC, shell: ShellElement, base: Element,  mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	mapSelect(mapID => HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		let selectedLayer: SVGLayer | null = null, selectedLayerPath = "", selectedToken: SVGToken | SVGShape | null = null, tokenDragX = 0, tokenDragY = 0, tokenDragMode = 0;
		const root = createSVG((mapData as Document).getElementsByTagName("svg")[0], {"data-is-folder": "true", "data-name": "", "ondragover": (e: DragEvent) => {
			e.preventDefault();
			e.dataTransfer!.dropEffect = "link";
		      }, "ondrop": (e: DragEvent) => {
			if (selectedLayer === null) {
				return;
			}
			const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset")),
			      src = `/images/${tokenData.id}`;
			selectedLayer.tokens.push(new SVGToken(image({"href": src, "preserveAspectRatio": "none", "width": tokenData.width, "height": tokenData.height, "transform": `translate(${e.clientX}, ${e.clientY})`})));
			rpc.addToken(selectedLayerPath, {"source": src, "x": e.clientX, "y": e.clientY, "width": tokenData.width, "height": tokenData.height, tokenType: 1} as Token).catch(alert);
		      }, "onmousedown": (e: MouseEvent) => {
			if (!selectedLayer || e.button !== 0) {
				return;
			}
			unselectToken();
			selectedToken = selectedLayer.tokens.reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | SVGShape | null);
			if (!selectedToken) {
				return;
			}
			root.appendChild(autoFocus(createSVG(outline, {"transform": selectedToken.transform.toString(false), "--outline-width": selectedToken.transform.width + "px", "--outline-height": selectedToken.transform.height + "px", "class": `cursor_${((selectedToken.transform.rotation + 143) >> 5) % 4}`})));
			tokenMousePos.x = selectedToken.transform.x;
			tokenMousePos.y = selectedToken.transform.y;
			tokenMousePos.width = selectedToken.transform.width;
			tokenMousePos.height = selectedToken.transform.height;
			tokenMousePos.rotation = selectedToken.transform.rotation;
		      }}),
		      tokenDrag = (e: MouseEvent) => {
			let {x, y, width, height, rotation} = tokenMousePos;
			const dx = e.clientX - tokenMousePos.mouseX,
			      dy = e.clientY - tokenMousePos.mouseY;
			switch (tokenDragMode) {
			case 0:
				x += dx;
				y += dy;
				break;
			case 1:
				rotation = Math.round(-128 * Math.atan2((x + width / 2) - e.clientX, (y + height / 2) - e.clientY) / Math.PI);
				while (rotation < 0) {
					rotation += 256;
				}
				outline.setAttribute("class", `cursor_${((rotation + 143) >> 5) % 4}`);
				break;
			default: {
				const r = -360 * rotation / 256,
				      {x: aDx, y: aDy} = new DOMPoint(dx, dy).matrixTransform(new DOMMatrix().rotateSelf(r)),
				      fr = new DOMMatrix().translateSelf(x + width / 2, y + height / 2).rotateSelf(-r).translateSelf(-(x + width / 2), -(y + height / 2)),
				      dirX = [2, 5, 7].includes(tokenDragMode) ? -1 : [4, 6, 9].includes(tokenDragMode) ? 1 : 0,
				      dirY = [2, 3, 4].includes(tokenDragMode) ? -1 : [7, 8, 9].includes(tokenDragMode) ? 1 : 0,
				      [mDx, mDy] = ratio(aDx, aDy, width, height, dirX, dirY);
				if (dirX === -1) {
					x += mDx;
					width -= mDx;
				} else if (dirX === 1) {
					width += mDx;
				}
				if (dirY === -1) {
					y += mDy;
					height -= mDy;
				} else if (dirY === 1) {
					height += mDy;
				}
				const {x: cx, y: cy} = new DOMPoint(x + width/2, y + height/2).matrixTransform(fr),
				      {x: nx, y: ny} = new DOMPoint(x, y).matrixTransform(fr).matrixTransform(new DOMMatrix().translateSelf(cx, cy).rotateSelf(r).translateSelf(-cx, -cy));
				x = nx;
				y = ny;
			}}
			selectedToken!.transform.x = x;
			selectedToken!.transform.y = y;
			selectedToken!.transform.width = width;
			selectedToken!.transform.rotation = rotation;
			selectedToken!.node.setAttribute("width", width.toString());
			outline.style.setProperty("--outline-width", width + "px");
			selectedToken!.transform.height = height;
			selectedToken!.node.setAttribute("height", height.toString());
			outline.style.setProperty("--outline-height", height + "px");
			selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
			outline.setAttribute("transform", selectedToken!.transform.toString(false));
		      },
		      tokenMouseDown = function(this: SVGRectElement, e: MouseEvent) {
			if (e.button !== 0) {
				return;
			}
			e.stopImmediatePropagation();
			root.addEventListener("mousemove", tokenDrag);
			root.addEventListener("mouseup", tokenMouseUp);
			tokenDragMode = parseInt(this.getAttribute("data-outline")!);
			root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((selectedToken!.transform.rotation + 143) >> 5)) % 4 + 2]);
			tokenMousePos.mouseX = e.clientX;
			tokenMousePos.mouseY = e.clientY;
		      },
		      tokenMouseUp = () => {
			if (!selectedToken) {
				return;
			}
			const {x, y, width, height, rotation} = tokenMousePos;
			root.removeEventListener("mousemove", tokenDrag);
			root.removeEventListener("mouseup", tokenMouseUp);
			root.style.removeProperty("--outline-cursor");
			if (selectedToken!.snap) {
				selectedToken!.transform.snap((definitions.list["gridPattern"] as SVGGrid).width);
			}
			tokenMousePos.x = selectedToken!.transform.x = Math.round(selectedToken!.transform.x);
			tokenMousePos.y = selectedToken!.transform.y = Math.round(selectedToken!.transform.y);
			tokenMousePos.rotation = selectedToken!.transform.rotation = Math.round(selectedToken!.transform.rotation);
			tokenMousePos.width = selectedToken!.transform.width = Math.round(selectedToken!.transform.width);
			tokenMousePos.height = selectedToken!.transform.height = Math.round(selectedToken!.transform.height);
			selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
			outline.setAttribute("transform", selectedToken!.transform.toString(false));
			outline.focus();
			if (tokenMousePos.x !== x || tokenMousePos.y !== y || tokenMousePos.width !== width || tokenMousePos.height !== height || tokenMousePos.rotation !== rotation) {
				rpc.setToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.x, selectedToken!.transform.y, selectedToken!.transform.width, selectedToken!.transform.height, selectedToken!.transform.rotation).catch(alert);
			}
		      },
		      tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
		      deleteToken = () => {
				const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
				selectedLayer!.tokens.splice(pos, 1);
				unselectToken();
				rpc.removeToken(selectedLayerPath, pos).catch(alert);
		      },
		      outline = g({"id": "outline", "tabindex": "-1", "onkeyup": (e: KeyboardEvent) => {
			if (e.key === "Delete") {
				deleteToken();
				return;
			}
			if (selectedToken!.snap) {
				const sq = (definitions.list["gridPattern"] as SVGGrid).width;
				switch (e.key) {
				case "ArrowUp":
					selectedToken!.transform.y -= sq;
					break;
				case "ArrowDown":
					selectedToken!.transform.y += sq;
					break;
				case "ArrowLeft":
					selectedToken!.transform.x -= sq;
					break;
				case "ArrowRight":
					selectedToken!.transform.x += sq;
					break;
				default:
					return;
				}
				selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
				outline.setAttribute("transform", selectedToken!.transform.toString(false));
			} else {
				switch (e.key) {
				case "ArrowUp":
				case "ArrowDown":
				case "ArrowLeft":
				case "ArrowRight":
					break;
				default:
					return;
				}
			}
			tokenMousePos.x = selectedToken!.transform.x;
			tokenMousePos.y = selectedToken!.transform.y;
			rpc.setToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.x, selectedToken!.transform.y, selectedToken!.transform.width, selectedToken!.transform.height, selectedToken!.transform.rotation).catch(alert);
		      }, "onkeydown": (e: KeyboardEvent) => {
			if (selectedToken!.snap) {
				return;
			}
			switch (e.key) {
			case "ArrowUp":
				selectedToken!.transform.y--;
				break;
			case "ArrowDown":
				selectedToken!.transform.y++;
				break;
			case "ArrowLeft":
				selectedToken!.transform.x--;
				break;
			case "ArrowRight":
				selectedToken!.transform.x++;
				break;
			default:
				return;
			}
			selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
			outline.setAttribute("transform", selectedToken!.transform.toString(false));
		      }, "oncontextmenu": (e: MouseEvent) => {
			e.preventDefault();
			const tokenPos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
			place(base, [e.clientX, e.clientY], [
				item("Flip", () => {
					selectedToken!.transform.flip = !selectedToken!.transform.flip;
					selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
					outline.focus();
					rpc.flipToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.flip).catch(alert);
				}),
				item("Flop", () => {
					selectedToken!.transform.flop = !selectedToken!.transform.flop;
					selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
					outline.focus();
					rpc.flopToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.flop).catch(alert);
				}),
				item(`Set as ${selectedToken instanceof SVGShape && selectedToken.isPattern ? "Image" : "Pattern"}`, () => {
					const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
					let newToken: SVGToken | SVGShape;
					if (selectedToken instanceof SVGToken) {
						newToken = new SVGShape(rect({"width": selectedToken.transform.width, "height": selectedToken.transform.height, "transform": selectedToken.transform.toString(), "fill": `url(#${definitions.add(pattern({"width": selectedToken.transform.width, "height": selectedToken.transform.height, "patternUnits": "userSpaceOnUse"}, image({"preserveAspectRatio": "none", "width": selectedToken.transform.width, "height": selectedToken.transform.height, "href": selectedToken.node.getAttribute("href")!})))})`}));
						rpc.setTokenPattern(selectedLayerPath, pos).catch(alert);
					} else if (selectedToken instanceof SVGShape && selectedToken.isPattern) {
						newToken = new SVGToken(image({"preserveAspectRatio": "none", "width": selectedToken.transform.width, "height": selectedToken.transform.height, "transform": selectedToken.transform.toString(), "href": (definitions.list[selectedToken.fillSrc] as SVGImage).source}));
						rpc.setTokenImage(selectedLayerPath, pos).catch(alert);
					} else {
						return;
					}
					selectedLayer!.tokens.splice(pos, 1, newToken);
					selectedToken = newToken;
				}),
				item(selectedToken!.snap ? "Unsnap" : "Snap", () => {
					rpc.setTokenSnap(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.snap = !selectedToken!.snap);
					if (selectedToken!.snap && selectedToken!.transform.snap((definitions.list["gridPattern"] as SVGGrid).width)) {
						selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
						outline.setAttribute("transform", selectedToken!.transform.toString(false));
						rpc.setToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.x, selectedToken!.transform.y, selectedToken!.transform.width, selectedToken!.transform.height, selectedToken!.transform.rotation).catch(alert);
					}
				}),
				tokenPos > 0 ? [
					item(`Move to Top`, () => {
						const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
						selectedLayer!.tokens.push(selectedLayer!.tokens.splice(pos, 1)[0]);
						rpc.setTokenPos(selectedLayerPath, pos, selectedLayer!.tokens.length-1);
					}),
					item(`Move Up`, () => {
						const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
						if (pos >= selectedLayer!.tokens.length - 1) {
							selectedLayer!.tokens.splice(pos + 1, 0, selectedLayer!.tokens.splice(pos, 1)[0]);
							rpc.setTokenPos(selectedLayerPath, pos, pos + 1);
						}
					})
				] : [],
				tokenPos < selectedLayer!.tokens.length - 1 ? [
					item(`Move Down`, () => {
						const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
						if (pos > 0) {
							selectedLayer!.tokens.splice(pos - 1, 0, selectedLayer!.tokens.splice(pos, 1)[0]);
							rpc.setTokenPos(selectedLayerPath, pos, pos - 1);
						}
					}),
					item(`Move to Bottom`, () => {
						const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
						selectedLayer!.tokens.unshift(selectedLayer!.tokens.splice(pos, 1)[0]);
						rpc.setTokenPos(selectedLayerPath, pos, 0);
					})
				] : [],
				menu("Move To Layer", makeLayerContext(layerList, function(this: SVGLayer, path: string) {
					unselectToken();
					const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
					rpc.setTokenLayer(selectedLayerPath, pos, path, this.tokens.length).catch(alert)
				}, selectedLayer!.name)),
				item("Delete", deleteToken)
			]);
		      }}, Array.from({length: 10}, (_, n) => rect({"data-outline": n, "onmousedown": tokenMouseDown}))),
		      definitions = new Defs(root),
		      layerList = processLayers(root) as SVGFolder,
		      waitAdded = subFn<IDName[]>(),
		      waitMoved = subFn<FromTo>(),
		      waitRemoved = subFn<string>(),
		      waitFolderAdded = subFn<string>(),
		      waitFolderMoved = subFn<FromTo>(),
		      waitFolderRemoved = subFn<string>(),
		      waitLayerSetVisible = subFn<Int>(),
		      waitLayerSetInvisible = subFn<Int>(),
		      waitLayerAddMask = subFn<Int>(),
		      waitLayerRemoveMask = subFn<Int>(),
		      remove = (path: string) => {
			const [fromParent, layer] = getParentLayer(layerList, path);
			(fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer)).forEach(e => {
				if (selectedLayer === e) {
					selectedLayer = null;
				} else if (isSVGFolder(e)) {
					if (walkFolders(e, (e: SVGFolder | SVGLayer) => Object.is(e, selectedLayer))) {
						selectedLayer  = null;
					}
				}
			});
		      },
		      unselectToken = () => {
			selectedToken = null;
			if (outline.parentNode) {
				outline.parentNode.removeChild(outline);
			}
		      };
		if (!definitions.list["gridPattern"]) {
			definitions.add(pattern({"id": "gridPattern"}, path()));
		}
		{
			const gridRect = rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)" }),
			      grid = getLayer(layerList, "/Grid");
			if (grid && isSVGLayer(grid)) {
				grid.tokens.filterRemove(() => true);
				grid.tokens.push(new SVGShape(gridRect));
			} else {
				layerList.children.push(processLayers(g({"data-name": "Grid"}, gridRect)));
			}
		}
		{
			const lightRect = rect({"width": "100%", "height": "100%", "fill": "transparent" }),
			      light = getLayer(layerList, "/Light");
			if (light && isSVGLayer(light)) {
				if (light.tokens.length !== 1) {
					light.tokens.filterRemove(() => true);
					light.tokens.push(new SVGShape(lightRect));
				} else {
					const rect = light.tokens[0];
					if (!(rect instanceof SVGShape) || rect.node.getAttribute("width") !== "100%" || rect.node.getAttribute("height") !== "100%") {
						light.tokens.filterRemove(() => true);
						light.tokens.push(new SVGShape(lightRect));
					}
				}
			} else {
				layerList.children.push(processLayers(g({"data-name": "Light"}, lightRect)));
			}
		}
		setLayers({
			"waitAdded": () => waitAdded[1],
			"waitMoved": () => waitMoved[1],
			"waitRemoved": () => waitRemoved[1],
			"waitLinked": () => new Subscription<IDName>(() => {}),
			"waitFolderAdded": () => waitFolderAdded[1],
			"waitFolderMoved": () => waitFolderMoved[1],
			"waitFolderRemoved": () => waitFolderRemoved[1],
			"waitLayerSetVisible": () => waitLayerSetVisible[1],
			"waitLayerSetInvisible": () => waitLayerSetInvisible[1],
			"waitLayerAddMask": () => waitLayerAddMask[1],
			"waitLayerRemoveMask": () => waitLayerRemoveMask[1],
			"list": () => Promise.resolve(layerList as LayerFolder),
			"createFolder": (path: string) => rpc.addLayerFolder(path).then(name => {
				const [parentStr] = splitAfterLastSlash(path);
				(getLayer(layerList, parentStr) as SVGFolder).children.push(processLayers(g({"data-name": name, "data-is-folder": "true"})));
				return parentStr + "/" + name;
			}),
			"move": (from: string, to: string) => Promise.reject("invalid"),
			"moveFolder": (from: string, to: string) => Promise.reject("invalid"),
			"renameLayer": (path: string, name: string) => {
				getLayer(layerList, path)!.name = name;
				if (selectedLayerPath === path) {
					selectedLayerPath = splitAfterLastSlash(path)[0] + "/" + name;
				}
				return rpc.renameLayer(path, name)
			},
			"remove": (path: string) => {
				remove(path);
				return rpc.removeLayer(path);
			},
			"removeFolder": (path: string) => {
				remove(path);
				return rpc.removeLayer(path);
			},
			"link": (id: Int, path: string) => Promise.reject("invalid"),
			"newLayer": (name: string) => rpc.addLayer(name).then(name => {
				layerList.children.push(processLayers(g({"data-name": name})));
				return name;
			}),
			"setVisibility": (path: string, visibility: boolean) => {
				const layer = getLayer(layerList, path)!;
				if (layer === selectedLayer) {
					unselectToken();
				}
				if (visibility) {
					layer.node.removeAttribute("visibility");
					return rpc.showLayer(path);
				} else {
					layer.node.setAttribute("visibility", "hidden");
					return rpc.hideLayer(path);
				}
			},
			"setLayer": (path: string) => {
				selectedLayer = getLayer(layerList, path) as SVGLayer;
				selectedLayerPath = path;
				unselectToken();
			},
			"setLayerMask": (path: string) => {},
			"moveLayer": (from: string, to: string, pos: Int) => {
				const [parentStr, nameStr] = splitAfterLastSlash(from),
				      fromParent = getLayer(layerList, parentStr)!,
				      toParent = getLayer(layerList, to) as SVGFolder;
				if (isSVGFolder(fromParent)) {
					toParent.children.splice(pos, 0, (fromParent.children as SortNode<any>).filterRemove(e => e.name === nameStr).pop());
				}
				unselectToken();
				return rpc.moveLayer(from, to, pos);
			},
			"getMapDetails": () => {
				const grid = definitions.list["gridPattern"] as SVGGrid;
				return {
					"width": parseInt(root.getAttribute("width")!),
					"height": parseInt(root.getAttribute("height")!),
					"square": grid.width,
					"colour": grid.stroke,
					"stroke": grid.strokeWidth
				}
			},
			"setMapDetails": (details: GridDetails) => {
				const grid = definitions.list["gridPattern"] as SVGGrid;
				root.setAttribute("width", details["width"].toString());
				root.setAttribute("height", details["height"].toString());
				grid.width = details["square"];
				grid.stroke = details["colour"];
				grid.strokeWidth = details["stroke"];
				return rpc.setMapDetails(details);
			},
			"getLightColour": () => {
				return ((getLayer(layerList, "/Light") as SVGLayer).tokens[0] as SVGShape).fill
			},
			"setLightColour": (c: Colour) => {
				((getLayer(layerList, "/Light") as SVGLayer).tokens[0] as SVGShape).fill = c;
				return rpc.setLightColour(c);
			}
		});
		clearElement(base).appendChild(root);
	}));
}
