import type {KeystoreData, Plugin, TokenDrawing, TokenImage, TokenShape, Uint, Wall} from './types.js';
import type {Binding} from './lib/dom.js';
import type {WaitGroup} from './lib/inter.js';
import type {MenuItems} from './lib/menu.js';
import type {LightWall} from './map_lighting.js';
import type {Lighting} from './map_tokens.js';
import type {WindowElement} from './windows.js';
import {amendNode, createDocumentFragment} from './lib/dom.js';
import {br, button, details, fieldset, h1, input, legend, option, select, summary} from './lib/html.js';
import {setAndReturn} from './lib/misc.js';
import {stringSort} from './lib/nodes.js';
import {settingsTicker} from './ids.js';
import lang from './language.js';
import {SVGDrawing, SVGShape, SVGToken} from './map_tokens.js';
import {handleError, isAdmin, rpc} from './rpc.js';
import {labels} from './shared.js';
import {shell} from './windows.js';

type owp<T> = {
	priority?: Uint;
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
	characterEdit?: owp<(node: Node, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, w: WindowElement) => (() => void) | null>;
	tokenContext?: owp<() => MenuItems>;
	tokenClass?: owp<(c: SVGTokenConstructor) => SVGTokenConstructor>;
	shapeClass?: owp<(c: SVGShapeConstructor) => SVGShapeConstructor>;
	drawingClass?: owp<(c: SVGDrawingConstructor) => SVGDrawingConstructor>;
	menuItem?: owp<[string | Binding, HTMLDivElement, boolean, string]>;
	tokenDataFilter?: owp<string[]>;
	addWalls?: owp<(layer: string) => Omit<Wall, "id">[]>;
	addLights?: owp<(layer: string) => Lighting[]>;
	handleWalls?: owp<(walls: LightWall[]) => void>;
}

const plugins = new Map<string, PluginType>(),
      pluginList = new Map<string, Plugin>(),
      filterSortPlugins = <K extends keyof PluginType>(key: K) => Array.from(plugins.entries()).filter(p => p[1][key]).sort((a: [string, PluginType], b: [string, PluginType]) => a[1][key]!.priority === b[1][key]!.priority ? stringSort(a[0], b[0]) : (a[1][key]!.priority ?? 0) - (b[1][key]!.priority ?? 0)) as [string, Required<Pick<PluginType, K>> & Omit<PluginType, K>][];

export const pluginName = ({url}: {url: string}) => url.split("/").pop() ?? "",
settings = () => {
	if (pluginList.size === 0) {
		return [];
	}
	const check = input({"type": "checkbox", "class": settingsTicker, "disabled": true}),
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
		isAdmin ? details([
			summary(h1(lang["PLUGINS"])),
			labels([lang["PLUGINS"], ": "], selected),
			labels(check, ""),
			br(),
			save
		]) : [],
		filterSortPlugins("settings").map(([name, {"settings": {fn}}]) => details([
			summary(h1(name.charAt(0).toUpperCase() + name.slice(1))),
			fn
		]))
	];
},
characterEdit = (n: Node, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, w: WindowElement) => {
	const fns: (() => void)[] = [];
	for (const [name, {"characterEdit": {fn}}] of filterSortPlugins("characterEdit")) {
		const df = createDocumentFragment(),
		      cfn = fn(df, id, data, isCharacter, changes, removes, w);
		if (cfn) {
			fns.push(cfn);
		}
		amendNode(n, fieldset([
			legend(name.charAt(0).toUpperCase() + name.slice(1)),
			df
		]));
	}
	return () => {
		for (const fn of fns) {
			fn();
		}
	};
},
addPlugin = (name: string, p: PluginType) => {plugins.set(name, p)},
getSettings = (name: string) => pluginList.get(name)?.data,
askReload = () => isAdmin ? shell.confirm(lang["PLUGIN_REFRESH"], lang["PLUGIN_REFRESH_REQUEST"]).then(r => r && window.location.reload()) : window.location.reload(),
tokenContext = () => {
	const ret: MenuItems[] = [];
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
addLights = (layer: string) => filterSortPlugins("addLights").reduce((lights, [, {addLights: {fn}}]) => lights.concat(fn(layer)), [] as Lighting[]),
handleWalls = (walls: LightWall[]) => {
	for (const [, {handleWalls: {fn}}] of filterSortPlugins("handleWalls")) {
		fn(walls);
	}
};

export let tokenClass: SVGTokenConstructor = SVGToken,
shapeClass: SVGShapeConstructor = SVGShape,
drawingClass: SVGDrawingConstructor = SVGDrawing;

export default () => {
	rpc.waitPluginChange().when(askReload);
	return rpc.listPlugins().then(plugins => {
		let ls: Promise<void> = Promise.resolve();
		for (const p of Object.keys(plugins).sort(stringSort)) {
			if (setAndReturn(pluginList, p, plugins[p]).enabled) {
				ls = ls.finally(() => import(`/plugins/${p}`));
			}
		}
		return ls;
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
