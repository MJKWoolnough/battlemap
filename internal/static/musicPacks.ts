import {MusicPack} from './types.js';
import {clearElement} from './lib/dom.js';
import {createHTML, button, li, ul} from './lib/html.js';
import lang from './language.js';
import {SortNode, stringSort} from './lib/ordered.js';
import {rpc} from './rpc.js';

type MusicPackNode = MusicPack & {
	name: string;
	node: HTMLLIElement;
}

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
			musicList.push(Object.assign(list[name], {name, "node": li(name)}));
		}
		createHTML(clearElement(base), {"id": "musicPacks"}, [
			button(lang["MUSIC_ADD"], {"onclick": () => {}}),
			musicList.node
		]);
	});
}
