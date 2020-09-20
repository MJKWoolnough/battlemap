import {HTTPRequest} from './lib/conn.js';

type plugin = {
}

const plugins = new Map<string, plugin>();

export default function (name: string, p: plugin) {
	plugins.set(name, p);
}

(HTTPRequest("/plugins/", {"response": "json"}) as Promise<string[]>).then(plugins => plugins.forEach(plugin => import("/plugins/" + plugin)));
