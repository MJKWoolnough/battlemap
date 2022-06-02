import type {KeystoreData, Plugin, TokenDrawing, TokenImage, TokenShape, Wall, Uint} from './types.js';
import type {List} from './lib/context.js';
import type {Children} from './lib/dom.js';
import type {WaitGroup} from './lib/inter.js';
import type {LightSource, LightWall} from './map_lighting.js';
import type {WindowElement} from './windows.js';
import {amendNode} from './lib/dom.js';
import {br, button, h1, input, option, select} from './lib/html.js';
import {stringSort} from './lib/nodes.js';
import lang from './language.js';
import {SVGDrawing, SVGShape, SVGToken} from './map_tokens.js';
import {handleError, isAdmin, rpc} from './rpc.js';
import {labels, setAndReturn} from './shared.js';
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
	addWalls?: owp<(layer: string) => Omit<Wall, "id">[]>;
	addLights?: owp<(layer: string) => LightSource[]>;
	handleWalls?: owp<(walls: LightWall[]) => void>;
}

const plugins = new Map<string, PluginType>(),
      pluginList = new Map<string, Plugin>(),
      filterSortPlugins = <K extends keyof PluginType>(key: K) => Array.from(plugins.entries()).filter(p => p[1][key]).sort((a: [string, PluginType], b: [string, PluginType]) => a[1][key]!.priority === b[1][key]!.priority ? stringSort(a[0], b[0]) : a[1][key]!.priority - b[1][key]!.priority) as [string, Required<Pick<PluginType, K>> & Omit<PluginType, K>][];

export const pluginName = ({url}: {url: string}) => url.split("/").pop() ?? "",
settings = () => {
	if (pluginList.size === 0) {
		return [];
	}
	const check = input({"type": "checkbox", "class": "settings_ticker", "disabled": true}),
	      selected = select({"onchange": function(this: HTMLSelectElement) {
		const plugin = pluginList.get(this.value),
		      disabled = {"disabled": !plugin};
		amendNode(check, disabled);
		amendNode(save, disabled);
		check.checked = plugin?.enabled ?? false;
	      }}, [option({"value": ""}), Array.from(pluginList.keys()).sort().map(name => option({"value": name}, name))]),
	      save = button({"disabled": true, "onclick": () => {
		const s = selected.value,
		      plugin = pluginList.get(s);
		if (plugin && check.checked !== plugin.enabled) {
			((plugin.enabled = check.checked) ? rpc.enablePlugin : rpc.disablePlugin)(s).then(askReload).catch(handleError);
		}
	      }}, lang["SAVE"]);
	return [
		isAdmin ? [
			h1(lang["PLUGINS"]),
			labels(`${lang["PLUGINS"]}: `, selected),
			labels(check, ""),
			br(),
			save
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
addPlugin = (name: string, p: PluginType) => {plugins.set(name, p)},
getSettings = (name: string) => pluginList.get(name)?.data,
askReload = () => isAdmin ? shell.confirm(lang["PLUGIN_REFRESH"], lang["PLUGIN_REFRESH_REQUEST"]).then(r => r && window.location.reload()) : window.location.reload(),
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
menuItems = () => filterSortPlugins("menuItem").map(p => p[1]["menuItem"].fn),
addWalls = (layer: string) => filterSortPlugins("addWalls").reduce((walls, [, {addWalls: {fn}}]) => walls.concat(fn(layer)), [] as Omit<Wall, "id">[]),
addLights = (layer: string) => filterSortPlugins("addLights").reduce((lights, [, {addLights: {fn}}]) => lights.concat(fn(layer)), [] as LightSource[]),
handleWalls = (walls: LightWall[]) => filterSortPlugins("handleWalls").forEach(([, {handleWalls: {fn}}]) => fn(walls));

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
