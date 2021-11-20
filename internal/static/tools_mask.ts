import type {Mask, Uint} from './types.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {createHTML, br, button, div, fieldset, legend, input} from './lib/html.js';
import {node} from './lib/nodes.js';
import {createSVG, ellipse, path, polygon, rect, svg, title} from './lib/svg.js';
import lang from './language.js';
import {masks, root, screen2Grid} from './map.js';
import {doMaskAdd, doMaskRemove, doMaskSet} from './map_fns.js';
import {autosnap} from './settings.js';
import {JSONSetting} from './settings_types.js';
import {deselectToken, labels} from './shared.js';
import {addTool, marker} from './tools.js';
import {shell} from './windows.js';

const opaque = input({"name": "maskColour", "type": "radio", "class": "settings_ticker", "checked": true}),
      rectangle = input({"name": "maskShape", "type": "radio", "class": "settings_ticker", "checked": true}),
      circle = input({"type": "radio", "name": "maskShape", "class": "settings_ticker"}),
      poly = input({"type": "radio", "name": "maskShape", "class": "settings_ticker"}),
      remove = input({"type": "radio", "name": "maskShape", "class": "settings_ticker"}),
      snap = input({"type": "checkbox", "class": "settings_ticker", "checked": autosnap.value}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      [rectDrag, cancelRectDrag] = mouseDragEvent(0, (e: MouseEvent) => {
	if (!maskElement) {
		cancelRectDrag();
		return;
	}
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(maskElement, {"x": Math.min(coords[0], x), "y": Math.min(coords[1], y), "width": Math.abs(coords[0] - x), "height": Math.abs(coords[1] - y)});
      }, (e: MouseEvent) => {
	if (e.isTrusted) {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		doMaskAdd([addOpaque ? 0 : 1, Math.min(coords[0], x), Math.min(coords[1], y), Math.abs(coords[0] - x), Math.abs(coords[1] - y)]);
	}
	maskElement?.remove();
	maskElement = null;
	cancelEscape();
      }),
      [ellipseDrag, cancelEllipseDrag] = mouseDragEvent(0, (e: MouseEvent) => {
	if (!maskElement) {
		cancelEllipseDrag();
		return;
	}
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(maskElement, {"rx": Math.abs(coords[0] - x), "ry": Math.abs(coords[1] - y)});
      }, (e: MouseEvent) => {
	if (e.isTrusted) {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		doMaskAdd([addOpaque ? 2 : 3, coords[0], coords[1], Math.abs(coords[0] - x), Math.abs(coords[1] - y)]);
	}
	maskElement?.remove();
	maskElement = null;
	cancelEscape();
      }),
      [polyMove, cancelPolyMove] = mouseMoveEvent((e: MouseEvent) => {
	if (!maskElement) {
		cancelPolyMove();
		return;
	}
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(maskElement, {"points": coords.reduce((res, _, i) => i % 2 === 0 ? `${res} ${coords[i]},${coords[i+1]}` : res, "") + ` ${x},${y}`});
      }),
      [setEscape, cancelEscape] = keyEvent("Escape", () => {
	cancelRectDrag();
	cancelEllipseDrag();
      }),
      [setPolyEscape, cancelPolyEscape] = keyEvent("Escape", () => {
	if (!maskElement) {
		return;
	}
	if (coords.length === 2) {
		maskElement.remove();
		maskElement = null;
		cancelPolyMove();
		return;
	} else {
		coords.pop();
		coords.pop();
		createSVG(maskElement, {"points": coords.reduce((res, _, i) => i % 2 === 0 ? `${res} ${coords[i]},${coords[i+1]}` : res, ""), "stroke": coords.length === 2 ? addOpaque ? "#fff" : "#000" : undefined});
	}
      }),
      highlightMask = (x: Uint, y: Uint) => {
	const [mask] = masks.at(x, y);
	if (mask !== overMask) {
		maskHighlight?.remove();
		if (mask) {
			overMask = mask;
			switch (mask[0]) {
			case 0:
			case 1:
				maskHighlight = rect({"x": mask[1], "y": mask[2], "width": mask[3], "height": mask[4]});
				break;
			case 2:
			case 3:
				maskHighlight = ellipse({"cx": mask[1], "cy": mask[2], "rx": mask[3], "ry": mask[4]});
				break;
			case 4:
			case 5:
				maskHighlight = polygon({"points": mask.reduce((res, _, i) => i % 2 === 1 ? `${res} ${mask[i]},${mask[i+1]}` : res, "")});
			}
			createSVG(root, createSVG(maskHighlight, {"fill": "none", "stroke": "#f00"}));
		} else {
			maskHighlight = overMask = null;
		}
	}
      },
      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
	if (remove.checked) {
		highlightMask(x, y);
	} else {
		maskHighlight?.remove();
		overMask = null;
	}
      }),
      coords: [Uint, Uint, ...Uint[]] = [0, 0],
      maskOpacity = new JSONSetting<number>("maskOpacity", 1, (v: any): v is number => typeof v === "number" && v >= 0 && v <= 1);

let addOpaque = false,
    maskElement: SVGRectElement | SVGEllipseElement | SVGPolygonElement | null = null,
    overMask: Mask | null = null,
    maskHighlight: SVGRectElement | SVGEllipseElement | SVGPolygonElement | null = null;

maskOpacity.wait(v => createHTML(document.body, {"style": {"--maskOpacity": v + ""}}));

addTool({
	"name": lang["TOOL_MASK"],
	"icon": svg({"viewBox": "0 0 60 50"}, [title(lang["TOOL_MASK"]), path({"d": "M0,0 Q30,15 60,0 Q30,100 0,0 M32,20 q9,-10 18,0 q-9,-3 -18,0 M10,20 q9,-10 18,0 q-9,-3 -18,0 M20,35 q10,5 20,0 q-10,10 -20,0", "stroke": "none", "fill": "currentColor", "fill-rule": "evenodd"})]),
	"options": div([
		labels(`${lang["TOOL_MASK_OPACITY"]}: `, input({"type": "range", "min": 0, "max": 1, "step": 0.05, "value": maskOpacity.value, "oninput": function(this: HTMLInputElement) {
			maskOpacity.set(parseFloat(this.value));
		}})),
		fieldset([
			legend(lang["TOOL_MASK_DRAW_TYPE"]),
			labels(`${lang["TOOL_MASK_OPAQUE"]}: `, opaque, false),
			br(),
			labels(`${lang["TOOL_MASK_TRANSPARENT"]}: `, input({"name": "maskColour", "type": "radio", "class": "settings_ticker"}), false),
		]),
		fieldset([
			legend(lang["TOOL_MASK_DRAW_SHAPE"]),
			labels(`${lang["TOOL_DRAW_RECT"]}: `, rectangle, false),
			br(),
			labels(`${lang["TOOL_DRAW_ELLIPSE"]}: `, circle, false),
			br(),
			labels(`${lang["TOOL_DRAW_POLYGON"]}: `, poly, false),
			br(),
		]),
		labels(`${lang["TOOL_MASK_REMOVE"]}: `, remove, false),
		br(),
		labels(`${lang["TOOL_DRAW_SNAP"]}: `, snap, false),
		br(),
		button({"onclick": () => shell.confirm(lang["ARE_YOU_SURE"], lang["TOOL_MASK_CLEAR_CONFIRM"]).then(c => {
			if (c) {
				doMaskSet({"baseOpaque": opaque.checked, "masks": []});
			}
		})}, lang["TOOL_MASK_CLEAR"])
	]),
	"mapMouseOver": () => {
		startCursorMove();
		return false;
	},
	"mapMouse0": (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		if (remove.checked) {
			const [, maskIndex] = masks.at(x, y);
			if (maskIndex !== -1) {
				doMaskRemove(maskIndex);
				highlightMask(x, y);
			}
		} else if (rectangle.checked) {
			coords[0] = x;
			coords[1] = y;
			maskElement?.remove();
			createHTML(masks[node], maskElement = rect({x, y, "fill": (addOpaque = opaque.checked) ? "#fff" : "#000"}));
			rectDrag();
			setEscape();
		} else if (circle.checked) {
			coords[0] = x;
			coords[1] = y;
			maskElement?.remove();
			createHTML(masks[node], maskElement = ellipse({"cx": x, "cy": y, "fill": (addOpaque = opaque.checked) ? "#fff" : "#000"}));
			ellipseDrag();
			setEscape();
		} else if (poly.checked) {
			if (maskElement instanceof SVGPolygonElement) {
				coords.push(x, y);
				createSVG(maskElement, {"points": coords.reduce((res, _, i) => i % 2 === 0 ? `${res} ${coords[i]},${coords[i+1]}` : res, ""), "stroke": undefined});
			} else {
				coords.splice(0, coords.length, x, y);
				maskElement?.remove();
				const fill = (addOpaque = opaque.checked) ? "#fff" : "#000";
				createHTML(masks[node], maskElement = polygon({fill, "stroke": fill}));
				polyMove();
				setPolyEscape();
			}
		}
		return false;
	},
	"mapMouse2": (e: MouseEvent) => {
		if (maskElement instanceof SVGPolygonElement && coords.length >= 4) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			coords.push(x, y);
			doMaskAdd([addOpaque ? 4 : 5, ...coords as [Uint, Uint, Uint, Uint, Uint, Uint, ...Uint[]]]);
			cancelPolyMove();
			cancelPolyEscape();
			maskElement.remove();
			maskElement = null;
		}
		return false;
	},
	"set": () => {
		deselectToken();
		setupShiftSnap();
		createSVG(root, {"style": {"cursor": "none"}}, marker);
	},
	"unset": () => {
		cancelShiftSnap();
		cancelRectDrag()
		cancelEllipseDrag();
		cancelPolyMove();
		cancelEscape();
		cancelPolyEscape();
		cancelCursorMove();
		marker.remove();
		createSVG(root, {"style": {"cursor": undefined}});
	}
});
