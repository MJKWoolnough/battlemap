import {Colour, FromTo, IDName, Int, RPC, MapDetails, LayerFolder, LayerRPC, LayerMove, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {autoFocus} from './lib/dom.js';
import {createSVG, g, image, path, pattern, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import place, {item, menu, List} from './lib/context.js';
import {ShellElement} from './windows.js';
import {SVGLayer, SVGFolder, Defs, SVGToken, SVGShape, addLayer, addLayerFolder, processLayers, getLayer, getParentLayer, isSVGLayer, isSVGFolder, removeLayer, renameLayer, setLayerVisibility, setTokenType, moveLayer, setMapDetails, setLightColour, globals, mapView} from './userMap.js';
import {autosnap} from './settings.js';
import {noColour} from './misc.js';

const makeLayerContext = (folder: SVGFolder, fn: (path: string) => void, disabled = "", path = "/"): List => (folder.children as SortNode<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] : isSVGFolder(e) ? menu(e.name, makeLayerContext(e, fn, disabled, path + e.name + "/")) : item(e.name, fn.bind(e, path + e.name), {"disabled": e.name === disabled})),
      ratio = (mDx: Int, mDy: Int, width: Int, height: Int, dX: (-1 | 0 | 1), dY: (-1 | 0 | 1), min = 10) => {
	mDx *= dX;
	mDy *= dY;
	if (dX !== 0 && mDy < mDx * height / width || dY === 0) {
		mDy = mDx * height / width;
	} else {
		mDx = mDy * width / height;
	}
	if (dX !== 0 && width + mDx < min) {
		mDx = min - width;
		mDy = min * height / width - height;
	}
	if (dY !== 0 && height + mDy < min) {
		mDx = min * width / height - width;
		mDy = min - height;
	}
	return [mDx * dX, mDy * dY];
      },
      walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as SortNode<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn))),
      subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
};

export default function(rpc: RPC, shell: ShellElement, oldBase: HTMLElement, mapSelect: (fn: (mapID: Int) => void) => void, setLayers: (layerRPC: LayerRPC) => void) {
	let canceller = () => {};
	mapSelect(mapID => mapView(rpc, oldBase, mapID).then(passed => {
		canceller();
		let selectedLayer: SVGLayer | null = null, selectedLayerPath = "", selectedToken: SVGToken | SVGShape | null = null, tokenDragX = 0, tokenDragY = 0, tokenDragMode = 0;
		const [base, cancel, panZoom, outline, mapData] = passed,
		      {root, definitions, layerList} = globals,
		      getSelectedTokenPos = () => (selectedLayer!.tokens as SVGToken[]).findIndex(e => e === selectedToken),
		      tokenDrag = (e: MouseEvent) => {
			let {x, y, width, height, rotation} = tokenMousePos;
			const dx = (e.clientX - tokenMousePos.mouseX) / panZoom.zoom,
			      dy = (e.clientY - tokenMousePos.mouseY) / panZoom.zoom,
			      sq = mapData.gridSize;
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
			selectedToken!.x = x;
			selectedToken!.y = y;
			selectedToken!.width = width;
			selectedToken!.rotation = rotation;
			selectedToken!.node.setAttribute("width", width.toString());
			outline.style.setProperty("--outline-width", width + "px");
			selectedToken!.height = height;
			selectedToken!.node.setAttribute("height", height.toString());
			outline.style.setProperty("--outline-height", height + "px");
			selectedToken!.updateNode();
			outline.setAttribute("transform", selectedToken!.toString(false));
		      },
		      tokenMouseDown = function(this: SVGRectElement, e: MouseEvent) {
			if (e.button !== 0 || e.ctrlKey) {
				return;
			}
			e.stopImmediatePropagation();
			document.body.addEventListener("mousemove", tokenDrag);
			document.body.addEventListener("mouseup", tokenMouseUp, {"once": true});
			tokenDragMode = parseInt(this.getAttribute("data-outline")!);
			root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((selectedToken!.rotation + 143) >> 5)) % 4 + 2]);
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
			tokenMousePos.x = selectedToken!.x = Math.round(selectedToken!.x);
			tokenMousePos.y = selectedToken!.y = Math.round(selectedToken!.y);
			tokenMousePos.rotation = selectedToken!.rotation = Math.round(selectedToken!.rotation);
			tokenMousePos.width = selectedToken!.width = Math.round(selectedToken!.width);
			tokenMousePos.height = selectedToken!.height = Math.round(selectedToken!.height);
			selectedToken!.node.setAttribute("width", tokenMousePos.width.toString());
			outline.style.setProperty("--outline-width", tokenMousePos.width + "px");
			selectedToken!.node.setAttribute("height", tokenMousePos.height.toString());
			outline.style.setProperty("--outline-height", tokenMousePos.height + "px");
			selectedToken!.updateNode();
			outline.setAttribute("transform", selectedToken!.toString(false));
			outline.focus();
			if (tokenMousePos.x !== x || tokenMousePos.y !== y || tokenMousePos.width !== width || tokenMousePos.height !== height || tokenMousePos.rotation !== rotation) {
				rpc.setToken(selectedLayerPath, getSelectedTokenPos(), selectedToken!.x, selectedToken!.y, selectedToken!.width, selectedToken!.height, selectedToken!.rotation).catch(alert);
			}
		      },
		      tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
		      deleteToken = () => {
				const pos = getSelectedTokenPos();
				selectedLayer!.tokens.splice(pos, 1);
				unselectToken();
				rpc.removeToken(selectedLayerPath, pos).catch(alert);
		      },
		      waitAdded = subFn<IDName[]>(),
		      waitMoved = subFn<FromTo>(),
		      waitRemoved = subFn<string>(),
		      waitFolderMoved = subFn<FromTo>(),
		      waitFolderRemoved = subFn<string>(),
		      waitLayerPositionChange = subFn<LayerMove>(),
		      unselectToken = () => {
			selectedToken = null;
			outline.style.setProperty("display", "none");
		      },
		      removeS = (path: string) => {
			removeLayer(path).forEach(e => {
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
				const sq = mapData.gridSize;
				x = Math.round(x / sq) * sq;
				y = Math.round(y / sq) * sq;
				tw = Math.max(Math.round(tokenData.width / sq) * sq, sq);
				th = Math.max(Math.round(tokenData.height / sq) * sq, sq);
			}
			const token = {"source": tokenData.id, "x": x, "y": y, "width": tw, "height": th, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": 0, "tokenType": 0, "snap": autosnap.value};
			const pos = selectedLayer.tokens.push(new SVGToken(token)) - 1;
			rpc.addToken(selectedLayerPath, token).then(() => {
				if (autosnap.value) {
					return rpc.setTokenSnap(selectedLayerPath, pos, true).catch(alert);
				}
			}).catch(alert);
		      }, "onmousedown": (e: MouseEvent) => {
			if (!selectedLayer || e.button !== 0) {
				return;
			}
			const newToken = (selectedLayer.tokens as (SVGToken | SVGShape)[]).reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | SVGShape | null);
			if (!e.ctrlKey) {
				unselectToken();
			}
			if (!newToken || e.ctrlKey) {
				return;
			}
			selectedToken = newToken;
			autoFocus(createSVG(outline, {"transform": selectedToken.toString(false), "style": `--outline-width: ${selectedToken.width}px; --outline-height: ${selectedToken.height}px`, "class": `cursor_${((selectedToken.rotation + 143) >> 5) % 4}`}));
			tokenMousePos.x = selectedToken.x;
			tokenMousePos.y = selectedToken.y;
			tokenMousePos.width = selectedToken.width;
			tokenMousePos.height = selectedToken.height;
			tokenMousePos.rotation = selectedToken.rotation;
		}}, createSVG(outline, {"id": "outline", "tabindex": "-1", "style": "display: none", "onkeyup": (e: KeyboardEvent) => {
			if (e.key === "Delete") {
				deleteToken();
				return;
			}
			if (selectedToken && selectedToken!.snap) {
				const sq = mapData.gridSize;
				switch (e.key) {
				case "ArrowUp":
					selectedToken.y -= sq;
					break;
				case "ArrowDown":
					selectedToken.y += sq;
					break;
				case "ArrowLeft":
					selectedToken.x -= sq;
					break;
				case "ArrowRight":
					selectedToken.x += sq;
					break;
				default:
					return;
				}
				selectedToken.updateNode();
				outline.setAttribute("transform", selectedToken!.toString(false));
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
			tokenMousePos.x = selectedToken!.x;
			tokenMousePos.y = selectedToken!.y;
			rpc.setToken(selectedLayerPath, getSelectedTokenPos(), selectedToken!.x, selectedToken!.y, selectedToken!.width, selectedToken!.height, selectedToken!.rotation).catch(alert);
		      }, "onkeydown": (e: KeyboardEvent) => {
			if (!selectedToken || selectedToken.snap) {
				return;
			}
			switch (e.key) {
			case "ArrowUp":
				selectedToken.y--;
				break;
			case "ArrowDown":
				selectedToken.y++;
				break;
			case "ArrowLeft":
				selectedToken.x--;
				break;
			case "ArrowRight":
				selectedToken.x++;
				break;
			default:
				return;
			}
			selectedToken.updateNode();
			outline.setAttribute("transform", selectedToken!.toString(false));
		      }, "oncontextmenu": (e: MouseEvent) => {
			e.preventDefault();
			const tokenPos = getSelectedTokenPos();
			place(base, [e.clientX, e.clientY], [
				item("Flip", () => {
					selectedToken!.flip = !selectedToken!.flip;
					selectedToken!.updateNode();
					outline.focus();
					rpc.flipToken(selectedLayerPath, getSelectedTokenPos(), selectedToken!.flip).catch(alert);
				}),
				item("Flop", () => {
					selectedToken!.flop = !selectedToken!.flop;
					selectedToken!.updateNode();
					outline.focus();
					rpc.flopToken(selectedLayerPath, getSelectedTokenPos(), selectedToken!.flop).catch(alert);
				}),
				item(`Set as ${selectedToken instanceof SVGShape && selectedToken.isPattern ? "Image" : "Pattern"}`, () => {
					if (!(selectedToken instanceof SVGToken)) {
						return;
					}
					const pos = getSelectedTokenPos(),
					      isPattern = selectedToken!.isPattern;
					selectedToken.setPattern(!isPattern);
					(isPattern ? rpc.setTokenPattern : rpc.setTokenImage)(selectedLayerPath, pos).catch(alert);
				}),
				item(selectedToken!.snap ? "Unsnap" : "Snap", () => {
					rpc.setTokenSnap(selectedLayerPath, getSelectedTokenPos(), selectedToken!.snap = !selectedToken!.snap);
					if (selectedToken!.snap) {
						const sq = mapData.gridSize,
						      {x, y, width, height, rotation} = selectedToken!;
						tokenMousePos.x = selectedToken!.x = Math.round(x / sq) * sq;
						tokenMousePos.y = selectedToken!.y = Math.round(y / sq) * sq;
						tokenMousePos.width = selectedToken!.width = Math.max(Math.round(width / sq) * sq, sq);
						tokenMousePos.height = selectedToken!.height = Math.max(Math.round(height / sq) * sq, sq);
						tokenMousePos.rotation = selectedToken!.rotation = Math.round(rotation / 32) * 32 % 256;
						if (x !== selectedToken!.width || y !== selectedToken!.y || width !== selectedToken!.width || height !== selectedToken!.height || rotation !== selectedToken!.rotation) {
							selectedToken!.node.setAttribute("width", tokenMousePos.width.toString());
							outline.style.setProperty("--outline-width", tokenMousePos.width + "px");
							selectedToken!.node.setAttribute("height", tokenMousePos.height.toString());
							outline.style.setProperty("--outline-height", tokenMousePos.height + "px");
							selectedToken!.updateNode();
							outline.setAttribute("transform", selectedToken!.toString(false));
							rpc.setToken(selectedLayerPath, getSelectedTokenPos(), selectedToken!.x, selectedToken!.y, selectedToken!.width, selectedToken!.height, selectedToken!.rotation).catch(alert);
						}
					}
				}),
				tokenPos < selectedLayer!.tokens.length - 1 ? [
					item(`Move to Top`, () => {
						const pos = getSelectedTokenPos();
						selectedLayer!.tokens.push(selectedLayer!.tokens.splice(pos, 1)[0]);
						rpc.setTokenPos(selectedLayerPath, pos, selectedLayer!.tokens.length-1);
					}),
					item(`Move Up`, () => {
						const pos = getSelectedTokenPos();
						if (pos < selectedLayer!.tokens.length - 1) {
							selectedLayer!.tokens.splice(pos + 1, 0, selectedLayer!.tokens.splice(pos, 1)[0]);
							rpc.setTokenPos(selectedLayerPath, pos, pos + 1);
						}
					})
				] : [],
				tokenPos > 0 ? [
					item(`Move Down`, () => {
						const pos = getSelectedTokenPos();
						if (pos > 0) {
							selectedLayer!.tokens.splice(pos - 1, 0, selectedLayer!.tokens.splice(pos, 1)[0]);
							rpc.setTokenPos(selectedLayerPath, pos, pos - 1);
						}
					}),
					item(`Move to Bottom`, () => {
						const pos = getSelectedTokenPos();
						selectedLayer!.tokens.unshift(selectedLayer!.tokens.splice(pos, 1)[0]);
						rpc.setTokenPos(selectedLayerPath, pos, 0);
					})
				] : [],
				menu("Move To Layer", makeLayerContext(layerList, function(this: SVGLayer, path: string) {
					const pos = getSelectedTokenPos();
					unselectToken();
					this.tokens.push(selectedLayer!.tokens.splice(pos, 1)[0])
					rpc.setTokenLayer(selectedLayerPath, pos, path).catch(alert)
				}, selectedLayer!.name)),
				item("Delete", deleteToken)
			]);
		}}, Array.from({length: 10}, (_, n) => rect({"data-outline": n, "onmousedown": tokenMouseDown}))));
		setLayers({
			"waitAdded": () => waitAdded[1],
			"waitMoved": () => waitMoved[1],
			"waitRemoved": () => waitRemoved[1],
			"waitLinked": () => new Subscription<IDName>(() => {}),
			"waitFolderAdded": rpc.waitLayerFolderAdd,
			"waitFolderMoved": () => waitFolderMoved[1],
			"waitFolderRemoved": () => waitFolderRemoved[1],
			"waitLayerSetVisible": rpc.waitLayerShow,
			"waitLayerSetInvisible": rpc.waitLayerHide,
			"waitLayerPositionChange": () => waitLayerPositionChange[1],
			"waitLayerRename": rpc.waitLayerRename,
			"list": () => Promise.resolve(layerList as LayerFolder),
			"createFolder": (path: string) => rpc.addLayerFolder(path).then(addLayerFolder),
			"move": invalidRPC,
			"moveFolder": invalidRPC,
			"renameLayer": (path: string, name: string) => rpc.renameLayer(path, name).then(name => renameLayer(path, name)),
			"remove": removeS,
			"removeFolder": removeS,
			"link": invalidRPC,
			"newLayer": (name: string) => rpc.addLayer(name).then(addLayer),
			"setVisibility": (path: string, visibility: boolean) => {
				setLayerVisibility(path, visibility);
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
				moveLayer(from, to, pos);
				unselectToken();
				return rpc.moveLayer(from, to, pos);
			},
			"getMapDetails": () => mapData,
			"setMapDetails": (details: MapDetails) => rpc.setMapDetails(setMapDetails(details)),
			"getLightColour": () => mapData.lightColour,
			"setLightColour": (c: Colour) => rpc.setLightColour(setLightColour(c)),
		});
		oldBase = base;
		canceller = Subscription.canceller(
			{cancel},
			rpc.waitTokenChange().then(st => {
				if (st.path === selectedLayerPath && getSelectedTokenPos() === st.pos) {
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
