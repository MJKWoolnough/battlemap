import {Int, RPC, GridDetails, MapData} from './types.js';
import {Subscription} from './lib/inter.js';
import {HTTPRequest} from './lib/conn.js';
import {clearElement, removeEventListeners} from './lib/dom.js';
import {div} from './lib/html.js';
import {g, image, rect, path, pattern, svg} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import {Defs, SVGFolder, SVGLayer, SVGShape, SVGToken, processLayers, getLayer, getParentLayer, getParentToken, isSVGLayer, setLayerVisibility, setTokenType, addLayer, addLayerFolder, setMapDetails, moveLayer, renameLayer, removeLayer, setLightColour, globals} from './map_shared.js';
import {scrollAmount} from './settings.js';
import {colour2RGBA, noColour} from './misc.js';

export function mapView(rpc: RPC, oldBase: HTMLElement, mapID: Int) {
	return (HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "json"}) as Promise<MapData>).then(mapData => {
		const layerList = processLayers(mapData) as SVGFolder,
		      root = svg({"style": "position: absolute", "width": mapData.width, "height": mapData.height}),
		      base = div({"style": "height: 100%", "onmousedown": (e: MouseEvent) => {
			viewPos.mouseX = e.clientX;
			viewPos.mouseY = e.clientY;
			base.addEventListener("mousemove", viewDrag);
			base.addEventListener("mouseup", () => base.removeEventListener("mousemove", viewDrag), {"once": true});
		}, "onwheel": (e: WheelEvent) => {
			e.preventDefault();
			if (e.ctrlKey) {
				const width = parseInt(root.getAttribute("width") || "0") / 2,
				      height = parseInt(root.getAttribute("height") || "0") / 2,
				      oldZoom = panZoom.zoom;
				if (e.deltaY < 0) {
					panZoom.zoom /= 0.95;
				} else if (e.deltaY > 0) {
					panZoom.zoom *= 0.95;
				}
				panZoom.x += e.clientX - (panZoom.zoom * ((e.clientX + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
				panZoom.y += e.clientY - (panZoom.zoom * ((e.clientY + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
				root.setAttribute("transform", `scale(${panZoom.zoom})`);
				outline.style.setProperty("--zoom", panZoom.zoom.toString());
			} else {
				const deltaY = e.shiftKey ? 0 : -e.deltaY,
				      deltaX = e.shiftKey ? -e.deltaY : -e.deltaX,
				      amount = scrollAmount.value || mapData.gridSize;
				panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount;
				panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount;
			}
			root.style.setProperty("left", panZoom.x + "px");
			root.style.setProperty("top", panZoom.y + "px");
		      }}, root),
		      panZoom = {x: 0, y: 0, zoom: 1},
		      outline = g(),
		      viewPos = {mouseX: 0, mouseY: 0},
		      viewDrag = (e: MouseEvent) => {
			panZoom.x += e.clientX - viewPos.mouseX;
			panZoom.y += e.clientY - viewPos.mouseY;
			root.style.setProperty("left", panZoom.x + "px");
			root.style.setProperty("top", panZoom.y + "px");
			viewPos.mouseX = e.clientX;
			viewPos.mouseY = e.clientY;
		      },
		      definitions = new Defs(root);
		Object.assign(globals, {definitions, root, layerList});
		definitions.setGrid(mapData);
		(getLayer(layerList, "/Grid") as SVGLayer).tokens.node.appendChild(rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)"}));
		(getLayer(layerList, "/Light") as SVGLayer).tokens.node.appendChild(rect({"width": "100%", "height": "100%", "fill": colour2RGBA(mapData.lightColour)}));
		oldBase.replaceWith(base);
		return [
			base,
			Subscription.canceller(
				rpc.waitMapChange().then(mc => setMapDetails(root, definitions, mc)),
				rpc.waitMapLightChange().then(c => setLightColour(layerList, c)),
				rpc.waitLayerShow().then(path => setLayerVisibility(layerList, path, true)),
				rpc.waitLayerHide().then(path => setLayerVisibility(layerList, path, false)),
				rpc.waitLayerAdd().then(name => addLayer(layerList, name)),
				rpc.waitLayerFolderAdd().then(path => addLayerFolder(layerList, path)),
				rpc.waitLayerMove().then(lm => moveLayer(layerList, lm.from, lm.to, lm.position)),
				rpc.waitLayerRename().then(lr => renameLayer(layerList, lr.path, lr.name)),
				rpc.waitLayerRemove().then(path => removeLayer(layerList, path)),
				rpc.waitTokenAdd().then(tk => {
					const layer = getLayer(layerList, tk.path);
					if (!layer || !isSVGLayer(layer)) {
						// error
						return;
					}
					layer.tokens.push(new SVGToken(Object.assign(tk, {"rotation": 0, "patternWidth": 0, "patternHeight": 0, "flip": false, "flop": false, "tokenData": 0, "stroke": noColour, "strokeWidth": 0, "snap": false, "tokenType": 0})))
				}),
				rpc.waitTokenMoveLayer().then(tm => {
					const [parent, token] = getParentToken(layerList, tm.from, tm.pos);
					if (token instanceof SVGToken && parent) {
						const newParent = getLayer(layerList, tm.to);
						if (newParent && isSVGLayer(newParent)) {
							newParent.tokens.push(parent.tokens.splice(tm.pos, 1)[0]);
						}
					}
				}),
				rpc.waitTokenSnap().then(ts => {
					const [, token] = getParentToken(layerList, ts.path, ts.pos);
					if (token instanceof SVGToken) {
						token.snap = true;
					}
				}),
				rpc.waitTokenRemove().then(tk => {
					const layer = getLayer(layerList, tk.path);
					if (!layer || !isSVGLayer(layer)) {
						// error
						return;
					}
					layer.tokens.splice(tk.pos, 1);
				}),
				rpc.waitTokenChange().then(st => {
					const [, token] = getParentToken(layerList, st.path, st.pos);
					if (token instanceof SVGToken) {
						token.transform.x = st.x;
						token.transform.y = st.y;
						token.transform.width = st.width;
						token.transform.height = st.height;
						token.transform.rotation = st.rotation;
						token.node.setAttribute("width", st.width + "px");
						token.node.setAttribute("height", st.height + "px");
						token.node.setAttribute("transform", token.transform.toString());
					}
				}),
				rpc.waitTokenFlip().then(tf => {
					const [, token] = getParentToken(layerList, tf.path, tf.pos);
					if (token instanceof SVGToken) {
						token.transform.flip = tf.flip;
						token.node.setAttribute("transform", token.transform.toString());
					}
				}),
				rpc.waitTokenFlop().then(tf => {
					const [, token] = getParentToken(layerList, tf.path, tf.pos);
					if (token instanceof SVGToken) {
						token.transform.flop = tf.flop;
						token.node.setAttribute("transform", token.transform.toString());
					}
				}),
				rpc.waitTokenSetImage().then(ti => setTokenType(layerList, definitions, ti.path, ti.pos, true)),
				rpc.waitTokenSetPattern().then(ti => setTokenType(layerList, definitions, ti.path, ti.pos, false)),
				rpc.waitTokenMovePos().then(to => {
					const [layer, token] = getParentToken(layerList, to.path, to.pos);
					if (layer && token) {
						layer.tokens.splice(to.newPos, 0, layer.tokens.splice(to.pos, 1)[0])
					}
				})
			),
			panZoom,
			outline,
			mapData
		] as [
			HTMLDivElement,
			() => void,
			{ x: Int; y: Int; zoom: Int},
			SVGGElement,
			MapData
		];
	});
}

export default function(rpc: RPC, base: HTMLElement) {
	let canceller = () => {}
	rpc.waitCurrentUserMap().then(mapID => mapView(rpc, base, mapID).then(([newBase, cancel]) => {
		canceller();
		base = newBase;
		canceller = cancel;
	}));
}
