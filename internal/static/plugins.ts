import type {KeystoreData, Plugin, TokenDrawing, TokenShape, TokenImage, Uint} from './types.js';
import type {List} from './lib/context.js';
import type {Children} from './lib/dom.js';
import type {WaitGroup} from './lib/inter.js';
import type {WindowElement} from './windows.js';
import {amendNode} from './lib/dom.js';
import {br, button, h1, input, label, option, select} from './lib/html.js';
import {stringSort} from './lib/nodes.js';
import lang from './language.js';
import {SVGDrawing, SVGShape, SVGToken} from './map_tokens.js';
import {handleError, isAdmin, rpc} from './rpc.js';
import {setAndReturn} from './shared.js';
import {shell} from './windows.js';

type owp<T> = {
	priority: Uint;
	fn: T;
}

export interface SVGTokenConstructor {
	new (token: TokenImage, wg?: WaitGroup): SVGToken;
}

export interface SVGShapeConstructor {
	new (token: TokenShape): SVGShape;
}

export interface SVGDrawingConstructor {
	new (token: TokenDrawing): SVGDrawing;
}

export type PluginType = {
	settings?: owp<HTMLElement>;
	characterEdit?: owp<(w: WindowElement, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => Children | null>;
	tokenContext?: owp<() => List>;
	tokenClass?: owp<(c: SVGTokenConstructor) => SVGTokenConstructor>;
	shapeClass?: owp<(c: SVGShapeConstructor) => SVGShapeConstructor>;
	drawingClass?: owp<(c: SVGDrawingConstructor) => SVGDrawingConstructor>;
	menuItem?: owp<[string, HTMLDivElement, boolean, string]>;
	tokenDataFilter?: owp<string[]>;
}

const plugins = new Map<string, PluginType>(),
      pluginList = new Map<string, Plugin>(),
      filterSortPlugins = <K extends keyof PluginType>(key: K) => Array.from(plugins.entries()).filter(p => p[1][key]).sort((a: [string, PluginType], b: [string, PluginType]) => a[1][key]!.priority === b[1][key]!.priority ? stringSort(a[0], b[0]) : a[1][key]!.priority - b[1][key]!.priority) as [string, Required<Pick<PluginType, K>> & Omit<PluginType, K>][];

export const pluginName = ({url}: {url: string}) => url.split("/").pop() ?? "",
settings = () => {
	if (pluginList.size === 0) {
		return [];
	}
	let selected = "";
	const check = input({"type": "checkbox", "id": "plugins_ticker", "class": "settings_ticker", "disabled": true}),
	      save = button({"disabled": true, "onclick": () => {
		if (selected === "") {
			return;
		}
		const plugin = pluginList.get(selected)!;
		if (check.checked !== plugin.enabled) {
			((plugin.enabled = check.checked) ? rpc.enablePlugin : rpc.disablePlugin)(selected).then(askReload).catch(handleError);
		}
	      }}, lang["SAVE"]);
	return [
		isAdmin ? [
			h1(lang["PLUGINS"]),
			label({"for": "pluginList"}, `${lang["PLUGINS"]} :`),
			select({"id": "pluginList", "onchange": function(this: HTMLSelectElement) {
				if (this.value === "") {
					amendNode(check, {"disabled": true}).checked = false;
					amendNode(save, {"disabled": true});
					selected = "";
					return;
				}
				const plugin = pluginList.get(this.value);
				if (plugin) {
					amendNode(check, {"disabled": false}).checked = pluginList.get(this.value)!.enabled;
					amendNode(save, {"disabled": false});
					selected = this.value;
				}
			}}, [option({"value": ""}), Array.from(pluginList.keys()).map(name => option({"value": name}, name))]),
			check,
			label({"for": "plugins_ticker"}),
			br(),
			save,
		] : [],
		filterSortPlugins("settings").map(([name, {"settings": {fn}}]) => [h1(name.charAt(0).toUpperCase() + name.slice(1)), fn])
	];
},
characterEdit = (w: WindowElement, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => {
	for (const [, {"characterEdit": {fn}}] of filterSortPlugins("characterEdit")) {
		const h = fn(w, id, data, isCharacter, changes, removes, save);
		if (h) {
			return h;
		}
	}
	return null;
},
addPlugin = (name: string, p: PluginType) => plugins.set(name, p),
getSettings = (name: string) => pluginList.get(name)?.data,
askReload = () => {
	if (!isAdmin) {
		window.location.reload();
		return;
	}
	shell.confirm(lang["PLUGIN_REFRESH"], lang["PLUGIN_REFRESH_REQUEST"]).then(r => r && window.location.reload());
},
tokenContext = () => {
	const ret: List[] = [];
	for (const [, {"tokenContext": {fn}}] of filterSortPlugins("tokenContext")) {
		const r = fn();
		if (r) {
			ret.push(r);
		}
	}
	return ret;
},
tokenDataFilter = () => {
	const tdf: string[] = [];
	for (const [, {"tokenDataFilter": {fn}}] of filterSortPlugins("tokenDataFilter")) {
		tdf.push(...fn);
	}
	return tdf;
},
menuItems = () => filterSortPlugins("menuItem").map(p => p[1]["menuItem"].fn);

export let tokenClass: SVGTokenConstructor = SVGToken,
shapeClass: SVGShapeConstructor = SVGShape,
drawingClass: SVGDrawingConstructor = SVGDrawing;

export default () => {
	rpc.waitPluginChange().then(askReload);
	return rpc.listPlugins().then(plugins => {
		const ls: Promise<void>[] = [];
		for (const p in plugins) {
			if (setAndReturn(pluginList, p, plugins[p]).enabled) {
				ls.push(import(`/plugins/${p}`));
			}
		}
		return Promise.all(ls);
	}).then(() => {
		for (const [, {"tokenClass": {fn}}] of filterSortPlugins("tokenClass")) {
			const ntc = fn(tokenClass);
			if (ntc.prototype instanceof tokenClass) {
				tokenClass = ntc;
			}
		}
		for (const [, {"shapeClass": {fn}}] of filterSortPlugins("shapeClass")) {
			const nsc = fn(shapeClass);
			if (nsc.prototype instanceof shapeClass) {
				shapeClass = nsc;
			}
		}
		for (const [, {"drawingClass": {fn}}] of filterSortPlugins("drawingClass")) {
			const ndc = fn(drawingClass);
			if (ndc.prototype instanceof drawingClass) {
				drawingClass = ndc;
			}
		}
	});
};
