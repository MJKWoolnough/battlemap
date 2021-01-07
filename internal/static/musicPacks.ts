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

const newPack = () => ({"tracks": [], "volume": 255, "playTime": 0, "playing": false});

export const userMusic = () => {
	rpc.musicPackList().then(list => {
		rpc.waitMusicPackAdd().then(name => list[name] = newPack());
		rpc.waitMusicPackRename().then(ft => {
			const p = list[ft.from];
			if (p) {
				delete list[ft.from];
				list[ft.to] = p;
			}
		});
		rpc.waitMusicPackRemove().then(name => delete list[name]);
		rpc.waitMusicPackCopy().then(ft => {
			const p = list[ft.from];
			if (p) {
				list[ft.to] = {"tracks": JSON.parse(JSON.stringify(p.tracks)), "volume": p.volume, "playTime": 0, "playing": false};
			}
		});
	});
};

export default function(base: Node) {
	queue(() => rpc.musicPackList().then(list => {
		const rename = getSymbol("rename")!,
		      copy = getSymbol("copy")!,
		      remove = getSymbol("remove")!,
		      addPackToList = (musicList: SortNode<MusicPackNode>, name: string, pack: MusicPack) => {
			const nameSpan = span(name),
			      musicPack = Object.defineProperty(Object.assign(pack, {"node": li([
				nameSpan,
				rename({"title": lang["MUSIC_RENAME"], "class": "itemRename", "onclick": () => requestShell().prompt(lang["MUSIC_RENAME"], lang["MUSIC_RENAME_LONG"], musicPack.name).then(name => {
					if (name && name !== musicPack.name) {
						rpc.musicPackRename(musicPack.name, name).then(name => {
							if (name !== musicPack.name) {
								musicPack.name = name;
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
								"volume": musicPack.volume,
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
			      ])}), "name", {
				"get": () => name,
				"set": (n: string) => nameSpan.innerText = name = n
			      });
			musicList.push(musicPack);
		      },
		      musicList = new SortNode<MusicPackNode>(ul({"id": "musicPackList"}), (a: MusicPackNode, b: MusicPackNode) => {
			const dt = b.playTime - a.playTime;
			if (dt === 0) {
				return stringSort(a.name, b.name);
			}
			return dt;
		      }),
		      findPack = (name: string) => {
			for (const p of musicList) {
				if (p.name === name) {
					return p;
				}
			}
			return null;
		      };
		for (const name in list) {
			addPackToList(musicList, name, list[name]);
		}
		createHTML(clearElement(base), {"id": "musicPacks"}, [
			button(lang["MUSIC_ADD"], {"onclick": () => requestShell().prompt(lang["MUSIC_ADD"], lang["MUSIC_ADD_NAME"]).then(name => {
				if (name) {
					rpc.musicPackAdd(name).then(name => addPackToList(musicList, name, newPack()));
				}
			})}),
			musicList.node
		]);
		rpc.waitMusicPackAdd().then(name => addPackToList(musicList, name, newPack()));
		rpc.waitMusicPackRename().then(ft => {
			const pack = findPack(ft.from);
			if (pack) {
				pack.name = ft.to;
				musicList.sort();
			}
		});
		rpc.waitMusicPackRemove().then(name => musicList.filterRemove(p => p.name === name));
		rpc.waitMusicPackCopy().then(ft => {
			const pack = findPack(ft.from);
			if (pack) {
				addPackToList(musicList, ft.to, {"tracks": JSON.parse(JSON.stringify(pack.tracks)), "volume": pack.volume, "playTime": 0, "playing": false});
			}
		});
	}));
}
