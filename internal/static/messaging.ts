import type {Uint} from './types.js';
import {svgNS} from './lib/dom.js';
import type {Parsers, TagFn} from './lib/bbcode.js';
import bbcode from './lib/bbcode.js';
import {all} from './lib/bbcode_tags.js';
import {shell, windows} from './windows.js';
import {rpc, inited} from './rpc.js';

const modules = new Map<string, [string, string] | ((id: Uint) => [string, string])>(),
      tags: Parsers = Object.assign({}, all);

export const register = (module: string, fn: [string, string] | ((id: Uint) => [string, string])) => modules.set(module, fn),
registerTag = (tagName: string, fn: TagFn) => tags[tagName] = fn,
shareIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 20 20"%3E%3Ccircle cx="3" cy="10" r="3" /%3E%3Ccircle cx="17" cy="3" r="3" /%3E%3Ccircle cx="17" cy="17" r="3" /%3E%3Cpath d="M17,3 L3,10 17,17" stroke="%23000" fill="none" /%3E%3C/svg%3E`;

inited.then(() => {
	rpc.waitBroadcastWindow().then(d => {
		if (!modules.has(d.module)) {
			return;
		}
		const fn = modules.get(d.module)!,
		      [icon, title] = fn instanceof Array ? fn : fn(d.id);
		shell.appendChild(bbcode(windows({"window-title": title, "window-icon": icon, "resizable": true, "style": {"--window-width": "50%", "--window-height": "50%"}}), tags, d.contents));
	});
});
