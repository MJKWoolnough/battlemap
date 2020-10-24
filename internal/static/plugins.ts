import {Uint, KeystoreData, Plugin, TokenImage} from './types.js';
import {SVGToken} from './map.js';
import {Children} from './lib/dom.js';
import {List} from './lib/context.js';
import {h1, label, select, option, button, br, input} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {handleError, requestShell} from './misc.js';
import lang from './language.js';
import {WindowElement} from './windows.js';
import {rpc} from './rpc.js';

type owp<T> = {
	priority: Uint;
	fn: T;
}

interface SVGTokenConstructor {
	new (token: TokenImage): SVGToken;
}

type plugin = {
	settings?: owp<() => HTMLElement>;
	characterEdit?: owp<(w: WindowElement, id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => Children | null>;
	tokenContext?: owp<() => List>;
	tokenClass?: owp<SVGTokenConstructor>;
}

const plugins = new Map<string, plugin>(),
      pluginList = new Map<string, Plugin>(),
      filterSortPlugins = <K extends keyof plugin>(key: K) => Array.from(plugins.entries()).filter(p => p[1][key]).sort((a: [string, plugin], b: [string, plugin]) => a[1][key]!.priority - b[1][key]!.priority) as [string, Required<Pick<plugin, K>> & Omit<plugin, K>][];

export const settings = () => {
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
		filterSortPlugins("settings").map(([name, plugin]) => [h1(name), plugin["settings"].fn()])
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
       addPlugin = (name: string, p: plugin) => plugins.set(name, p),
       getSettings = (name: string) => pluginList.get(name)?.data,
       askReload = () => {
	if (userLevel === 0) {
		window.location.reload();
		return;
	}
	requestShell().confirm(lang["PLUGIN_REFRESH"], lang["PLUGIN_REFRESH_REQUEST"]).then(r => r && window.location.reload());
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
       };

export let userLevel: Uint;

export default function() {
	rpc.waitPluginChange().then(askReload);
	return rpc.waitLogin().then(u => {
		userLevel = u;
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
	});
}
