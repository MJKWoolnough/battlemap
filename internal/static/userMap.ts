import {Int, RPC} from './types.js';
import {HTTPRequest} from './lib/conn.js';
import {clearElement, removeEventListeners} from './lib/dom.js';
import {div} from './lib/html.js';
import {createSVG, g, image, rect, path, pattern} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import {Defs, SVGFolder, SVGGrid, SVGImage, SVGLayer, SVGShape, SVGToken} from './map_types.js';
import {processLayers, getLayer, getParentLayer, getParentToken, isSVGLayer} from './map_fns.js';
import {scrollAmount} from './settings.js';

export function mapView(rpc: RPC, oldBase: HTMLElement, mapID: Int) {
	return HTTPRequest(`/maps/${mapID}?d=${Date.now()}`, {"response": "document"}).then(mapData => {
		const root = createSVG((mapData as Document).getElementsByTagName("svg")[0], {"style": "position: absolute", "data-is-folder": "true", "data-name": ""}),
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
				      amount = scrollAmount.value || (definitions.list["gridPattern"] as SVGGrid).width;
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
		      definitions = new Defs(root),
		      layerList = processLayers(root) as SVGFolder,
		      remove = (path: string) => {
			const [fromParent, layer] = getParentLayer(layerList, path);
			return (fromParent!.children as SortNode<any>).filterRemove(e => Object.is(e, layer));
		      },
		      setLayerVisibility = (path: string, visibility: boolean) => {
			const layer = getLayer(layerList, path)!;
			if (visibility) {
				layer.node.removeAttribute("visibility");
			} else {
				layer.node.setAttribute("visibility", "hidden");
			}
		      },
		      setTokenType = (path: string, pos: Int, imagePattern: boolean) => {
			const [layer, token] = getParentToken(layerList, path, pos),
			      newToken = imagePattern && token instanceof SVGToken ? new SVGShape(rect({"width": token.transform.width, "height": token.transform.height, "transform": token.transform.toString(), "fill": `url(#${definitions.add(pattern({"width": token.transform.width, "height": token.transform.height, "patternUnits": "userSpaceOnUse"}, image({"preserveAspectRatio": "none", "width": token.transform.width, "height": token.transform.height, "href": token.node.getAttribute("href")!})))})`})) : token instanceof SVGShape ? new SVGToken(image({"preserveAspectRatio": "none", "width": token.transform.width, "height": token.transform.height, "transform": token.transform.toString(), "href": (definitions.list[token.fillSrc] as SVGImage).source})) : null;
			if (layer && newToken && token) {
				newToken.snap = token.snap;
				layer.tokens.splice(pos, 1, newToken);
			}
			return newToken;
		      };
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
		oldBase.replaceWith(base);
		rpc.waitMapLightChange().then(c => ((getLayer(layerList, "/Light") as SVGLayer).tokens[0] as SVGShape).fill = c);
		rpc.waitLayerShow().then(path => setLayerVisibility(path, true));
		rpc.waitLayerHide().then(path => setLayerVisibility(path, false));
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
		});
		rpc.waitTokenFlip().then(tf => {
			const [, token] = getParentToken(layerList, tf.path, tf.pos);
			if (token instanceof SVGToken) {
				token.transform.flip = tf.flip;
				token.node.setAttribute("transform", token.transform.toString());
			}
		});
		rpc.waitTokenFlop().then(tf => {
			const [, token] = getParentToken(layerList, tf.path, tf.pos);
			if (token instanceof SVGToken) {
				token.transform.flop = tf.flop;
				token.node.setAttribute("transform", token.transform.toString());
			}
		});
		rpc.waitTokenSetImage().then(ti => setTokenType(ti.path, ti.pos, true));
		rpc.waitTokenSetPattern().then(ti => setTokenType(ti.path, ti.pos, false));
		return [
			base,
			root,
			panZoom,
			outline,
			definitions,
			layerList,
			remove,
			setLayerVisibility,
			setTokenType
		] as [
			HTMLDivElement,
			SVGSVGElement,
			{ x: Int; y: Int; zoom: Int},
			SVGGElement,
			Defs,
			SVGFolder,
			(path: string) => [],
			(path: string, visibility: boolean) => void,
			(path: string, pos: Int, imagePattern: boolean) => SVGToken | SVGShape | null
		];
	});
}

export default function(rpc: RPC, base: HTMLElement) {
	rpc.waitCurrentUserMap().then(mapID => mapView(rpc, base, mapID).then(([newBase]) => base = newBase));
}
