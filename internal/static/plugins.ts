import {Uint} from './types.js';
import {h1} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';

type owp<T extends Function = () => void> = {
	priority: Uint;
	fn: T;
}

type plugin = {
	settings?: owp<() => HTMLElement>;
}


const plugins = new Map<string, plugin>(),
      owpSort = (key: keyof plugin) => (a: [string, plugin], b: [string, plugin]) => a[1][key]!.priority - b[1][key]!.priority;

export const settings = () => Array.from(plugins.entries()).filter(p => p[1].settings).sort(owpSort("settings")).map(([name, plugin]) => [h1(name), plugin["settings"]!["fn"]()]);

export default function (name: string, p: plugin) {
	plugins.set(name, p);
}

(HTTPRequest("/plugins/", {"response": "json"}) as Promise<string[]>).then(plugins => plugins.forEach(plugin => import("/plugins/" + plugin)));
