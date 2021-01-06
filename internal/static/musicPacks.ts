import {MusicPack} from './types.js';
import {clearElement} from './lib/dom.js';
import {createHTML, button, li, span, ul} from './lib/html.js';
import lang from './language.js';
import {SortNode, stringSort} from './lib/ordered.js';
import {getSymbol} from './symbols.js';
import {rpc} from './rpc.js';
import {windows, loadingWindow} from './windows.js';
import {requestShell, queue} from './misc.js';

type MusicPackNode = MusicPack & {
	name: string;
	node: HTMLLIElement;
}

const rename = getSymbol("rename")!,
      copy = getSymbol("copy")!,
      remove = getSymbol("remove")!,
      addPackToList = (musicList: SortNode<MusicPackNode>, name: string, pack: MusicPack) => {
	const nameSpan = span(name),
	      musicPack = Object.assign(pack, {name, "node": li([
		nameSpan,
		rename({"title": lang["MUSIC_RENAME"], "class": "itemRename", "onclick": () => requestShell().prompt(lang["MUSIC_RENAME"], lang["MUSIC_RENAME_LONG"], musicPack.name).then(name => {
			if (name && name !== musicPack.name) {
				rpc.musicPackRename(musicPack.name, name).then(name => {
					if (name !== musicPack.name) {
						nameSpan.innerText = musicPack.name = name;
						musicList.sort();
					}
				});
			}
		})}),
		copy({"title": lang["MUSIC_COPY"], "class": "itemLink", "onclick": () => requestShell().prompt(lang["MUSIC_COPY"], lang["MUSIC_COPY_LONG"], musicPack.name).then(name => {
			if (name) {
				rpc.musicPackCopy(musicPack.name, name).then(name => {
					addPackToList(musicList, name, {
						"tracks": JSON.parse(JSON.stringify(musicPack.tracks)),
						"repeat": musicPack.repeat,
						"playTime": 0,
						"playing": false
					});
				});
			}
		})}),
		remove({"title": lang["MUSIC_REMOVE"], "class": "itemRemove", "onclick": () => requestShell().confirm(lang["MUSIC_REMOVE"], lang["MUSIC_REMOVE_LONG"]).then(remove => {
			if (remove) {
				musicList.filterRemove(p => Object.is(p, musicPack));
				rpc.musicPackRemove(musicPack.name);
			}
		})})
	      ])});
	musicList.push(musicPack);
      };

export const userMusic = () => {};

export default function(base: Node) {
	queue(() => rpc.musicPackList().then(list => {
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
					rpc.musicPackAdd(name).then(name => addPackToList(musicList, name, {"tracks": [], "repeat": 0, "playTime": 0, "playing": false}));
				}
			})}),
			musicList.node
		]);
	}));
}
