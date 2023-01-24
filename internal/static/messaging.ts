import type {Uint} from './types.js';
import type {Parsers, TagFn} from './lib/bbcode.js';
import type {Binding} from './lib/dom.js';
import bbcode from './lib/bbcode.js';
import {all} from './lib/bbcode_tags.js';
import {amendNode} from './lib/dom.js';
import {DragTransfer} from './lib/drag.js';
import {inited, rpc} from './rpc.js';
import {shell, windows} from './windows.js';

type IconTitle = [string, Binding];

const modules = new Map<string, IconTitle | ((id: Uint) => IconTitle)>(),
      tags: Parsers = Object.assign({}, all);

export const register = (module: string, fn: IconTitle | ((id: Uint) => IconTitle)) => modules.set(module, fn),
registerTag = (tagName: string, fn: TagFn) => (tags[tagName] ??= fn) === fn,
parseBBCode = (text: string) => bbcode(tags, text),
bbcodeDrag = new DragTransfer<(t: string) => string>("bbcode");

inited.then(() => rpc.waitBroadcastWindow().when(d => {
	const fn = modules.get(d.module);
	if (fn) {
		const [icon, title] = fn instanceof Array ? fn : fn(d.id);
		amendNode(shell, windows({"window-title": title, "window-icon": icon, "resizable": true, "style": "--window-width: 50%; --window-height: 50%"}, parseBBCode(d.contents)));
	}
}));
