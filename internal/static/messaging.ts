import type {Uint} from './types.js';
import type {Parsers, TagFn} from './lib/bbcode.js';
import bbcode from './lib/bbcode.js';
import {all} from './lib/bbcode_tags.js';
import {amendNode} from './lib/dom.js';
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
};

inited.then(() => {
	rpc.waitBroadcastWindow().then(d => {
		const fn = modules.get(d.module);
		if (fn) {
			const [icon, title] = fn instanceof Array ? fn : fn(d.id);
			amendNode(shell, windows({"window-title": title, "window-icon": icon, "resizable": true, "style": "--window-width: 50%; --window-height: 50%"}, bbcode(tags, d.contents)));
		}
	});
});
