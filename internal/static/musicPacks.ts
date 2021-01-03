import {MusicPack} from './types.js';
import {clearElement} from './lib/dom.js';
import {createHTML, button, li, span, ul} from './lib/html.js';
import lang from './language.js';
import {SortNode, stringSort} from './lib/ordered.js';
import {getSymbol} from './symbols.js';
import {rpc} from './rpc.js';
import {windows, loadingWindow} from './windows.js';
import {requestShell} from './misc.js';

type MusicPackNode = MusicPack & {
	name: string;
	node: HTMLLIElement;
}

const rename = getSymbol("rename")!,
      copy = getSymbol("copy")!,
      remove = getSymbol("remove")!,
      addPackToList = (musicList: MusicPackNode[], name: string, pack: MusicPack) => musicList.push(Object.assign(pack, {name, "node": li([
	span(name),
	rename({"title": lang["ITEM_MOVE"], "class": "itemRename", "onclick": () => {}}),
	copy({"title": lang["ITEM_LINK_ADD"], "class": "itemLink", "onclick": () => {}}),
	remove({"title": lang["ITEM_REMOVE"], "class": "itemRemove", "onclick": () => {}})
      ])}));

export const userMusic = () => {};

export default function(base: Node) {
	rpc.musicList().then(list => {
		const musicList = new SortNode<MusicPackNode>(ul({"id": "musicPackList"}), (a: MusicPackNode, b: MusicPackNode) => {
			const dt = b.playTime - a.playTime;
			if (dt === 0) {
				return stringSort(a.name, b.name);
			}
			return dt;
		});
		for (const name in list) {
			addPackToList(musicList, name, list[name]);
		}
		createHTML(clearElement(base), {"id": "musicPacks"}, [
			button(lang["MUSIC_ADD"], {"onclick": () => requestShell().prompt(lang["MUSIC_ADD"], lang["MUSIC_ADD_NAME"]).then(name => {
				if (name) {
					rpc.newMusicPack(name).then(name => {
						addPackToList(musicList, name, {"tracks": [], "repeat": 0, "playTime": 0, "playing": false});
					})
				}
			})}),
			musicList.node
		]);
	});
}
