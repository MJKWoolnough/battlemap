import type {Uint} from './types.js';
import type {Parsers, TagFn} from './lib/bbcode.js';
import bbcode from './lib/bbcode.js';
import {all} from './lib/bbcode_tags.js';
import {createHTML, svgNS} from './lib/dom.js';
import {inited, rpc} from './rpc.js';
import {shell, windows} from './windows.js';

const modules = new Map<string, [string, string] | ((id: Uint) => [string, string])>(),
      tags: Parsers = Object.assign({}, all);

export const register = (module: string, fn: [string, string] | ((id: Uint) => [string, string])) => modules.set(module, fn),
registerTag = (tagName: string, fn: TagFn) => {
	if (tags[tagName]) {
		return false;
	}
	tags[tagName] = fn;
	return true;
},
shareIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 20 20"%3E%3Ccircle cx="3" cy="10" r="3" /%3E%3Ccircle cx="17" cy="3" r="3" /%3E%3Ccircle cx="17" cy="17" r="3" /%3E%3Cpath d="M17,3 L3,10 17,17" stroke="%23000" fill="none" /%3E%3C/svg%3E`;

inited.then(() => {
	rpc.waitBroadcastWindow().then(d => {
		const fn = modules.get(d.module);
		if (fn) {
			const [icon, title] = fn instanceof Array ? fn : fn(d.id);
			createHTML(shell, bbcode(windows({"window-title": title, "window-icon": icon, "resizable": true, "style": {"--window-width": "50%", "--window-height": "50%"}}), tags, d.contents));
		}
	});
});
