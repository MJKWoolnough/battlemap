import type {Uint, KeystoreData, Plugin, TokenImage} from './types.js';
import type {SVGToken} from './map.js';
import type {Children} from './lib/dom.js';
import type {List} from './lib/context.js';
import type {WindowElement} from './windows.js';
import {h1, label, select, option, button, br, input} from './lib/html.js';
import {stringSort} from './lib/nodes.js';
import {isAdmin} from './shared.js';
import lang from './language.js';
import {shell} from './windows.js';
import {rpc, handleError} from './rpc.js';

type owp<T> = {
	priority: Uint;
	fn: T;
}

interface SVGTokenConstructor {
	new (token: TokenImage): SVGToken;
}

export type PluginType = {
	settings?: owp<HTMLElement>;
	characterEdit?: owp<(w: WindowElement, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => Children | null>;
	tokenContext?: owp<() => List>;
	tokenClass?: owp<SVGTokenConstructor>;
	menuItem?: owp<[string, HTMLDivElement, boolean, string]>;
	tokenDataFilter?: owp<string[]>;
}

const plugins = new Map<string, PluginType>(),
      pluginList = new Map<string, Plugin>(),
      filterSortPlugins = <K extends keyof PluginType>(key: K) => Array.from(plugins.entries()).filter(p => p[1][key]).sort((a: [string, PluginType], b: [string, PluginType]) => {
	if (a[1][key]!.priority === b[1][key]!.priority) {
		return stringSort(a[0], b[0]);
	}
	return a[1][key]!.priority - b[1][key]!.priority
      }) as [string, Required<Pick<PluginType, K>> & Omit<PluginType, K>][];

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
		if (check.checked === plugin.enabled) {
			return;
		}
		plugin.enabled = check.checked;
		(check.checked ? rpc.enablePlugin : rpc.disablePlugin)(selected).then(askReload).catch(handleError);
	      }}, lang["SAVE"]);
	return [
		isAdmin ? [
			h1(lang["PLUGINS"]),
			label({"for": "pluginList"}, `${lang["PLUGINS"]} :`),
			select({"id": "pluginList", "onchange": function(this: HTMLSelectElement) {
				if (this.value === "") {
					check.toggleAttribute("disabled", true);
					check.checked = false;
					save.toggleAttribute("disabled", true);
					selected = "";
					return;
				}
				const plugin = pluginList.get(this.value);
				if (plugin) {
					check.removeAttribute("disabled");
					check.checked = pluginList.get(this.value)!.enabled;
					save.removeAttribute("disabled");
					selected = this.value;
				}
			}}, [option({"value": ""}), Array.from(pluginList.keys()).map(name => option({"value": name}, name))]),
			check,
			label({"for": "plugins_ticker"}),
			br(),
			save,
		] : [],
		filterSortPlugins("settings").map(([name, plugin]) => [h1(name.charAt(0).toUpperCase() + name.slice(1)), plugin["settings"].fn])
	];
},
       characterEdit = (w: WindowElement, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => {
	for (const p of filterSortPlugins("characterEdit")) {
		const h = p[1]["characterEdit"].fn(w, id, data, isCharacter, changes, removes, save);
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
	for (const p of filterSortPlugins("tokenContext")) {
		const r = p[1]["tokenContext"].fn();
		if (r) {
			ret.push(r);
		}
	}
	return ret;
       },
       tokenClass = (): SVGTokenConstructor | null => {
	for (const p of filterSortPlugins("tokenClass")) {
		const tc = p[1]["tokenClass"].fn;
		if (tc) {
			return tc;
		}
	}
	return null;
       },
       tokenDataFilter = () => {
	const tdf: string[] = [];
	for (const p of filterSortPlugins("tokenDataFilter")) {
		tdf.push(...p[1]["tokenDataFilter"].fn);
	}
	return tdf;
       },
       menuItems = () => filterSortPlugins("menuItem").map(p => p[1]["menuItem"].fn);

export default () => {
	rpc.waitPluginChange().then(askReload);
	return rpc.listPlugins().then(plugins => {
		const ls: Promise<void>[] = [];
		for (const p in plugins) {
			const plugin = plugins[p];
			pluginList.set(p, plugin);
			if (plugin.enabled) {
				ls.push(import(`/plugins/${p}`));
			}
		}
		return Promise.all(ls);
	});
};
