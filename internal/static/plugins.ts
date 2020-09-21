import {Uint, KeystoreData} from './types.js';
import {h1} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {handleError} from './misc.js';

type owp<T extends Function = () => void> = {
	priority: Uint;
	fn: T;
}

type plugin = {
	settings?: owp<() => HTMLElement>;
	characterEdit?: owp<(id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => HTMLElement[] | null>;
}


const plugins = new Map<string, plugin>(),
      filterSortPlugins = <K extends keyof plugin>(key: K) => Array.from(plugins.entries()).filter(p => p[1][key]).sort((a: [string, plugin], b: [string, plugin]) => a[1][key]!.priority - b[1][key]!.priority) as [string, Required<Pick<plugin, K>> & Omit<plugin, K>][];

export const settings = () => filterSortPlugins("settings").map(([name, plugin]) => [h1(name), plugin["settings"].fn()]),
       characterEdit = (id: Uint, data: Record<string, KeystoreData>, isCharacter: boolean, changes: Record<string, KeystoreData>, removes: Set<string>, save: () => Promise<void>) => {
	for (const p of filterSortPlugins("characterEdit")) {
		const h = p[1]["characterEdit"].fn(id, data, isCharacter, changes, removes, save);
		if (h) {
			return h;
		}
	}
	return null;
       },
       addPlugin = (name: string, p: plugin) => plugins.set(name, p);

export let userLevel: Uint;

export default function(u: Uint) {
	return (HTTPRequest("/plugins/", {"response": "json"}) as Promise<string[]>).then(plugins => Promise.all(plugins.map(plugin => import("/plugins/" + plugin)))).catch(handleError).then(() => u);
}
