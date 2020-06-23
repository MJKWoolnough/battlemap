import {Int, RPC} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
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
			button(`New Character`, {"onclick": () => {
				const name = autoFocus(input({"id": "characterName"}));
				let icon = 0,
				      w = shell.appendChild(windows({"window-title": "New Character"}, [
					h1("New Character"),
					label({"for": "characterName"}, "Character Name: "),
					name,
					br(),
					label("Character Image: "),
					div({"style": "display: inline-block; user-select: none; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
						e.preventDefault();
						if (e.dataTransfer && e.dataTransfer.getData("imageAsset")) {
							e.dataTransfer.dropEffect = "link";
						}
					}, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
						const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset"));
						icon = tokenData.id;
						clearElement(this).appendChild(img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
					}}, "Drag icon here"),
					br(),
					button("Create", {"onclick": function(this: HTMLButtonElement) {
						this.setAttribute("disabled", "disabled");
						loadingWindow(rpc.characterCreate(name.value).then(({id, name}) => {
							root.addItem(id, name);
							return rpc.characterSet(id, {"store-image-icon": icon.toString()});
						}), w).catch(e => {
							showError(name, e);
							this.removeAttribute("disabled");
						});
					}})
				      ]));
			}}),
			root.node
		]);
	});
};
