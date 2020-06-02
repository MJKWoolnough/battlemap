import {Int, RPC} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {audio, button, div, form, h1, img, input, label, progress} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {ShellElement, loadingWindow, windows} from './windows.js';
import {showError} from './misc.js';
import {Root, Folder, Item} from './folders.js';

class Character extends Item {
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
	}
}

export default function (rpc: RPC, shell: ShellElement, base: Node) {
	const rpcFuncs = rpc["characters"];
	rpcFuncs.list().then(folderList => {
		const root = new Root(folderList, "Characters", rpcFuncs, shell, Character);
		createHTML(clearElement(base), {"id": "characters", "class": "folders"}, [
			button(`New Character`, {"onclick": () => shell.prompt("New Character", "Please enter the character name: ").then(name => {
				if (name) {
					rpc.characterCreate(name).then(({id, name}) => root.addItem(id, name));
				}
			})}),
			root.node
		]);
	});
};
