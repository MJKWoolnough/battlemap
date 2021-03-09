import type {Uint} from './types.js';
import type {Parsers, TagFn} from './lib/bbcode.js';
import bbcode from './lib/bbcode.js';
import {all} from './lib/bbcode_tags.js';
import {createHTML} from './lib/dom.js';
import {shell, windows} from './windows.js';
import {rpc, inited} from './rpc.js';

const modules = new Map<string, (id: Uint) => [string, string]>(),
      tags: Parsers = Object.assign({}, all);

export const register = (module: string, fn: (id: Uint) => [string, string]) => modules.set(module, fn),
registerTag = (tagName: string, fn: TagFn) => tags[tagName] = fn;

inited.then(() => {
	rpc.waitBroadcastWindow().then(d => {
		if (!modules.has(d.module)) {
			return;
		}
		const [icon, title] = modules.get(d.module)!(d.id);
		shell.appendChild(windows({"window-title": title, "window-icon": icon, "resizable": true, "style": {"--window-width": "50%", "--window-height": "50%"}}, bbcode(createHTML(null), tags, d.contents)));
	}
)});
