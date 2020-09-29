import {Uint, KeystoreData, RPC, Plugin} from './types.js';
import {h1, label, select, option, button, br, input} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {handleError, requestShell} from './misc.js';

type owp<T extends Function = () => void> = {
	priority: Uint;
	fn: T;
}

type plugin = {
	settings?: owp<() => HTMLElement>;
	characterEdit?: owp<(id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => HTMLElement[] | null>;
}


const plugins = new Map<string, plugin>(),
      pluginList = new Map<string, Plugin>(),
      filterSortPlugins = <K extends keyof plugin>(key: K) => Array.from(plugins.entries()).filter(p => p[1][key]).sort((a: [string, plugin], b: [string, plugin]) => a[1][key]!.priority - b[1][key]!.priority) as [string, Required<Pick<plugin, K>> & Omit<plugin, K>][];

export const settings = () => {
	if (pluginList.size === 0) {
		return [];
	}
	let selected = "";
	const check = input({"type": "checkbox", "disabled": true}),
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
	      }}, "Save");
	return [
		h1("Plugins"),
		label({"for": "pluginList"}, "Plugins: "),
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
		br(),
		save,
		filterSortPlugins("settings").map(([name, plugin]) => [h1(name), plugin["settings"].fn()])
	];
},
       characterEdit = (id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => {
	for (const p of filterSortPlugins("characterEdit")) {
		const h = p[1]["characterEdit"].fn(id, data, isCharacter, changes, removes, save);
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
	requestShell().confirm("Refresh Page?", "Plugin settings have change and a page refresh is required to load changes. Refresh the page now?").then(r => r && window.location.reload());
       };

export let userLevel: Uint,
       rpc: RPC;

export default function(arpc: RPC) {
	rpc = arpc;
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
