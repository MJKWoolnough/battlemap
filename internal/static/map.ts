import {Colour, FromTo, IDName, Int, RPC, GridDetails, LayerFolder, LayerRPC, LayerMove, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {autoFocus} from './lib/dom.js';
import {createSVG, g, image, path, pattern, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import place, {item, menu, List} from './lib/context.js';
import {ShellElement} from './windows.js';
import {SVGLayer, SVGFolder, SVGGrid, SVGImage, Defs, SVGToken, SVGShape} from './map_types.js';
import {addLayer, addLayerFolder, ratio, processLayers, subFn, getLayer, getParentLayer, isSVGLayer, isSVGFolder, walkFolders, splitAfterLastSlash, makeLayerContext, removeLayer, renameLayer, setLayerVisibility, setTokenType, moveLayer, setMapDetails, setLightColour} from './map_fns.js';
import {autosnap} from './settings.js';
import {mapView} from './userMap.js';

export default function(rpc: RPC, shell: ShellElement, oldBase: HTMLElement, mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	let canceller = () => {};
	mapSelect(mapID => mapView(rpc, oldBase, mapID).then(passed => {
		canceller();
		let selectedLayer: SVGLayer | null = null, selectedLayerPath = "", selectedToken: SVGToken | SVGShape | null = null, tokenDragX = 0, tokenDragY = 0, tokenDragMode = 0;
		const [base, cancel, root, panZoom, outline, definitions, layerList] = passed,
		      tokenDrag = (e: MouseEvent) => {
			let {x, y, width, height, rotation} = tokenMousePos;
			const dx = (e.clientX - tokenMousePos.mouseX) / panZoom.zoom,
			      dy = (e.clientY - tokenMousePos.mouseY) / panZoom.zoom,
			      sq = (definitions.list["gridPattern"] as SVGGrid).width;
			switch (tokenDragMode) {
			case 0:
				x += dx;
				y += dy;
				if (selectedToken!.snap) {
					x = Math.round(x / sq) * sq;
					y = Math.round(y / sq) * sq;
				}
				break;
			case 1: {
				const sw = parseInt(root.getAttribute("width") || "0"),
				      sh = parseInt(root.getAttribute("height") || "0");
				rotation = Math.round(-128 * Math.atan2(panZoom.zoom * (x + width / 2) + panZoom.x - (panZoom.zoom - 1) * sw / 2 - e.clientX, panZoom.zoom * (y + height / 2) + panZoom.y - (panZoom.zoom - 1) * sh / 2 - e.clientY) / Math.PI);
				while (rotation < 0) {
					rotation += 256;
				}
				if (selectedToken!.snap) {
					rotation = Math.round(rotation / 32) * 32 % 256;
				}
				outline.setAttribute("class", `cursor_${((rotation + 143) >> 5) % 4}`);
			}
			break;
			default: {
				const r = -360 * rotation / 256,
				      {x: aDx, y: aDy} = new DOMPoint(dx, dy).matrixTransform(new DOMMatrix().rotateSelf(r)),
				      fr = new DOMMatrix().translateSelf(x + width / 2, y + height / 2).rotateSelf(-r).translateSelf(-(x + width / 2), -(y + height / 2)),
				      dirX = [2, 5, 7].includes(tokenDragMode) ? -1 : [4, 6, 9].includes(tokenDragMode) ? 1 : 0,
				      dirY = [2, 3, 4].includes(tokenDragMode) ? -1 : [7, 8, 9].includes(tokenDragMode) ? 1 : 0,
				      [mDx, mDy] = ratio(aDx, aDy, width, height, dirX, dirY, selectedToken!.snap ? sq : 10);
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
				if (selectedToken!.snap) {
					width = Math.round(width / sq) * sq;
					height = Math.round(height / sq) * sq;
				}
				const {x: cx, y: cy} = new DOMPoint(x + width/2, y + height/2).matrixTransform(fr),
				      {x: nx, y: ny} = new DOMPoint(x, y).matrixTransform(fr).matrixTransform(new DOMMatrix().translateSelf(cx, cy).rotateSelf(r).translateSelf(-cx, -cy));
				x = nx;
				y = ny;
				if (selectedToken!.snap) {
					x = Math.round(x / sq) * sq;
					y = Math.round(y / sq) * sq;
				}
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
			if (e.button !== 0 || e.ctrlKey) {
				return;
			}
			e.stopImmediatePropagation();
			document.body.addEventListener("mousemove", tokenDrag);
			document.body.addEventListener("mouseup", tokenMouseUp, {"once": true});
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
			document.body.removeEventListener("mousemove", tokenDrag);
			root.style.removeProperty("--outline-cursor");
			tokenMousePos.x = selectedToken!.transform.x = Math.round(selectedToken!.transform.x);
			tokenMousePos.y = selectedToken!.transform.y = Math.round(selectedToken!.transform.y);
			tokenMousePos.rotation = selectedToken!.transform.rotation = Math.round(selectedToken!.transform.rotation);
			tokenMousePos.width = selectedToken!.transform.width = Math.round(selectedToken!.transform.width);
			tokenMousePos.height = selectedToken!.transform.height = Math.round(selectedToken!.transform.height);
			selectedToken!.node.setAttribute("width", tokenMousePos.width.toString());
			outline.style.setProperty("--outline-width", tokenMousePos.width + "px");
			selectedToken!.node.setAttribute("height", tokenMousePos.height.toString());
			outline.style.setProperty("--outline-height", tokenMousePos.height + "px");
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
		      waitAdded = subFn<IDName[]>(),
		      waitMoved = subFn<FromTo>(),
		      waitRemoved = subFn<string>(),
		      waitFolderAdded = subFn<string>(),
		      waitFolderMoved = subFn<FromTo>(),
		      waitFolderRemoved = subFn<string>(),
		      waitLayerPositionChange = subFn<LayerMove>(),
		      waitLayerSetVisible = subFn<string>(),
		      waitLayerSetInvisible = subFn<string>(),
		      unselectToken = () => {
			selectedToken = null;
			outline.style.setProperty("display", "none");
		      },
		      removeS = (path: string) => {
			removeLayer(layerList, path).forEach(e => {
				if (selectedLayer === e) {
					selectedLayer = null;
				} else if (isSVGFolder(e) && walkFolders(e, (e: SVGFolder | SVGLayer) => Object.is(e, selectedLayer))) {
				       selectedLayer  = null;
				}
			});
			return rpc.removeLayer(path);
		      },
		      checkLayer = (path: string) => {
			if (selectedLayerPath.startsWith(path)) {
				unselectToken();
				// select new layer???
			}
		      },
		      invalidRPC = () => Promise.reject("invalid");
		createSVG(root, {"ondragover": (e: DragEvent) => {
			e.preventDefault();
			e.dataTransfer!.dropEffect = "link";
		      }, "ondrop": (e: DragEvent) => {
			if (selectedLayer === null) {
				return;
			}
			const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset")),
			      src = `/images/${tokenData.id}`,
			      width = parseInt(root.getAttribute("width") || "0"),
			      height = parseInt(root.getAttribute("height") || "0");
			let x = Math.round((e.clientX + ((panZoom.zoom - 1) * width / 2) - panZoom.x) / panZoom.zoom),
			    y = Math.round((e.clientY + ((panZoom.zoom - 1) * height / 2) - panZoom.y) / panZoom.zoom),
			    tw = tokenData.width,
			    th = tokenData.height;
			if (autosnap.value) {
				const sq = (definitions.list["gridPattern"] as SVGGrid).width;
				x = Math.round(x / sq) * sq;
				y = Math.round(y / sq) * sq;
				tw = Math.max(Math.round(tokenData.width / sq) * sq, sq);
				th = Math.max(Math.round(tokenData.height / sq) * sq, sq);
			}
			const pos = selectedLayer.tokens.push(new SVGToken(image({"href": src, "preserveAspectRatio": "none", "width": tw, "height": th, "transform": `translate(${x}, ${y})`, "data-snap" : autosnap.value ? "true" : "undefined"}))) - 1;
			rpc.addToken(selectedLayerPath, {"source": src, x, y, "width": tw, "height": th, tokenType: 1} as Token).then(() => {
				if (autosnap.value) {
					return rpc.setTokenSnap(selectedLayerPath, pos, true).catch(alert);
				}
			}).catch(alert);
		      }, "onmousedown": (e: MouseEvent) => {
			if (!selectedLayer || e.button !== 0) {
				return;
			}
			const newToken = selectedLayer.tokens.reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | SVGShape | null);
			if (!e.ctrlKey) {
				unselectToken();
			}
			if (!newToken || e.ctrlKey) {
				return;
			}
			selectedToken = newToken;
			autoFocus(createSVG(outline, {"transform": selectedToken.transform.toString(false), "style": `--outline-width: ${selectedToken.transform.width}px; --outline-height: ${selectedToken.transform.height}px`, "class": `cursor_${((selectedToken.transform.rotation + 143) >> 5) % 4}`}));
			tokenMousePos.x = selectedToken.transform.x;
			tokenMousePos.y = selectedToken.transform.y;
			tokenMousePos.width = selectedToken.transform.width;
			tokenMousePos.height = selectedToken.transform.height;
			tokenMousePos.rotation = selectedToken.transform.rotation;
		}}, createSVG(outline, {"id": "outline", "tabindex": "-1", "style": "display: none", "onkeyup": (e: KeyboardEvent) => {
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
					let typ = false;
					if (selectedToken instanceof SVGToken) {
						typ = true;
						rpc.setTokenPattern(selectedLayerPath, pos).catch(alert);
					} else if (selectedToken instanceof SVGShape && selectedToken.isPattern) {
						rpc.setTokenImage(selectedLayerPath, pos).catch(alert);
					} else {
						return;
					}
					selectedToken = setTokenType(layerList, definitions, selectedLayerPath, pos, typ);
				}),
				item(selectedToken!.snap ? "Unsnap" : "Snap", () => {
					rpc.setTokenSnap(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.snap = !selectedToken!.snap);
					if (selectedToken!.snap) {
						const sq = (definitions.list["gridPattern"] as SVGGrid).width,
						      transform = selectedToken!.transform,
						      {x, y, width, height, rotation} = transform;
						tokenMousePos.x = transform.x = Math.round(x / sq) * sq;
						tokenMousePos.y = transform.y = Math.round(y / sq) * sq;
						tokenMousePos.width = transform.width = Math.max(Math.round(width / sq) * sq, sq);
						tokenMousePos.height = transform.height = Math.max(Math.round(height / sq) * sq, sq);
						tokenMousePos.rotation = transform.rotation = Math.round(rotation / 32) * 32 % 256;
						if (x !== transform.width || y !== transform.y || width !== transform.width || height !== transform.height || rotation !== transform.rotation) {
							selectedToken!.node.setAttribute("width", tokenMousePos.width.toString());
							outline.style.setProperty("--outline-width", tokenMousePos.width + "px");
							selectedToken!.node.setAttribute("height", tokenMousePos.height.toString());
							outline.style.setProperty("--outline-height", tokenMousePos.height + "px");
							selectedToken!.node.setAttribute("transform", selectedToken!.transform.toString());
							outline.setAttribute("transform", selectedToken!.transform.toString(false));
							rpc.setToken(selectedLayerPath, selectedLayer!.tokens.findIndex(e => e === selectedToken), selectedToken!.transform.x, selectedToken!.transform.y, selectedToken!.transform.width, selectedToken!.transform.height, selectedToken!.transform.rotation).catch(alert);
						}
					}
				}),
				tokenPos < selectedLayer!.tokens.length - 1 ? [
					item(`Move to Top`, () => {
						const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
						selectedLayer!.tokens.push(selectedLayer!.tokens.splice(pos, 1)[0]);
						rpc.setTokenPos(selectedLayerPath, pos, selectedLayer!.tokens.length-1);
					}),
					item(`Move Up`, () => {
						const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
						if (pos < selectedLayer!.tokens.length - 1) {
							selectedLayer!.tokens.splice(pos + 1, 0, selectedLayer!.tokens.splice(pos, 1)[0]);
							rpc.setTokenPos(selectedLayerPath, pos, pos + 1);
						}
					})
				] : [],
				tokenPos > 0 ? [
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
					const pos = selectedLayer!.tokens.findIndex(e => e === selectedToken);
					unselectToken();
					rpc.setTokenLayer(selectedLayerPath, pos, path, this.tokens.push(selectedLayer!.tokens.splice(pos, 1)[0]) - 1).catch(alert)
				}, selectedLayer!.name)),
				item("Delete", deleteToken)
			]);
		}}, Array.from({length: 10}, (_, n) => rect({"data-outline": n, "onmousedown": tokenMouseDown}))));
		if (!definitions.list["gridPattern"]) {
			definitions.add(pattern({"id": "gridPattern"}, path()));
		}
		{
			const gridRect = rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)"}),
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
			"waitFolderAdded": rpc.waitLayerFolderAdd,
			"waitFolderMoved": () => waitFolderMoved[1],
			"waitFolderRemoved": () => waitFolderRemoved[1],
			"waitLayerSetVisible": () => waitLayerSetVisible[1],
			"waitLayerSetInvisible": () => waitLayerSetInvisible[1],
			"waitLayerPositionChange": () => waitLayerPositionChange[1],
			"waitLayerRename": rpc.waitLayerRename,
			"list": () => Promise.resolve(layerList as LayerFolder),
			"createFolder": (path: string) => rpc.addLayerFolder(path).then(path => addLayerFolder(layerList, path)),
			"move": invalidRPC,
			"moveFolder": invalidRPC,
			"renameLayer": (path: string, name: string) => rpc.renameLayer(path, name).then(name => renameLayer(layerList, path, name)),
			"remove": removeS,
			"removeFolder": removeS,
			"link": invalidRPC,
			"newLayer": (name: string) => rpc.addLayer(name).then(name => addLayer(layerList, name)),
			"setVisibility": (path: string, visibility: boolean) => {
				setLayerVisibility(layerList, path, visibility);
				checkLayer(path);
				if (visibility) {
					return rpc.showLayer(path);
				} else {
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
				moveLayer(layerList, from, to, pos);
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
			"setMapDetails": (details: GridDetails) => rpc.setMapDetails(setMapDetails(root, definitions, details)),
			"getLightColour": () => {
				return ((getLayer(layerList, "/Light") as SVGLayer).tokens[0] as SVGShape).fill
			},
			"setLightColour": (c: Colour) => rpc.setLightColour(setLightColour(layerList, c)),
		});
		oldBase = base;
		canceller = Subscription.canceller(
			{cancel},
			rpc.waitTokenChange().then(st => {
				if (st.path === selectedLayerPath && selectedLayer!.tokens.findIndex(e => e === selectedToken) === st.pos) {
					tokenMouseUp();
				}
			}),
			rpc.waitLayerAdd().then(name => waitAdded[0]([{id: 1, name}])),
			rpc.waitLayerHide().then(checkLayer),
			rpc.waitLayerMove().then(ml => {
				const layer = getLayer(layerList, ml.to);
				if (!layer) {
					// error
					return;
				}
				if (isSVGFolder(layer)) {
					waitFolderMoved[0](ml);
				} else {
					waitMoved[0](ml);
				}
				waitLayerPositionChange[0](ml);
			}),
			rpc.waitLayerRemove().then(path => {
				checkLayer(path);
				const layer = getLayer(layerList, path);
				if (!layer) {
					// error
					return;
				}
				if (isSVGFolder(layer)) {
					waitFolderRemoved[0](path);
				} else {
					waitRemoved[0](path);
				}
			})
		);
	}));
}
