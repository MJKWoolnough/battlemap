import type {Uint} from './types.js';
import type {Parsers, TagFn} from './lib/bbcode.js';
import type {Bind} from './lib/dom.js';
import bbcode from './lib/bbcode.js';
import {all} from './lib/bbcode_tags.js';
import {id} from './lib/css.js';
import {amendNode} from './lib/dom.js';
import {DragTransfer} from './lib/drag.js';
import {inited, rpc} from './rpc.js';
import {shell, windows} from './windows.js';

const modules = new Map<string, [string, string | Bind] | ((id: Uint) => [string, string | Bind])>(),
      tags: Parsers = Object.assign({}, all);

export const register = (module: string, fn: [string, string | Bind] | ((id: Uint) => [string, string | Bind])) => modules.set(module, fn),
registerTag = (tagName: string, fn: TagFn) => (tags[tagName] ??= fn) === fn,
parseBBCode = (text: string) => bbcode(tags, text),
bbcodeDrag = new DragTransfer<(t: string) => string>("bbcode"),
psuedoLink = id();

inited.then(() => {
	rpc.waitBroadcastWindow().when(d => {
		const fn = modules.get(d.module);
		if (fn) {
			const [icon, title] = fn instanceof Array ? fn : fn(d.id);
			amendNode(shell, windows({"window-title": title, "window-icon": icon, "resizable": true, "style": "--window-width: 50%; --window-height: 50%"}, parseBBCode(d.contents)));
		}
	});
});
