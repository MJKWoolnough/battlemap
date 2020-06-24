import {Int, RPC} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
import {ShellElement, loadingWindow, windows} from './windows.js';
import {showError} from './misc.js';
import {Root, Folder, Item} from './folders.js';

let rpc: RPC;

class Character extends Item {
	icon = div(img({"class": "imageIcon"}));
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
	}
	setIcon(id: Int) {
		(this.icon.firstChild as HTMLImageElement).setAttribute("src", `/images/${id}`);
	}
}

export default function (arpc: RPC, shell: ShellElement, base: Node) {
	const rpcFuncs = arpc["characters"];
	rpc = arpc;
	rpcFuncs.list().then(folderList => {
		const root = new Root(folderList, "Characters", rpcFuncs, shell, Character);
		createHTML(clearElement(base), {"id": "characters", "class": "folders"}, [
			button(`New Character`, {"onclick": () => {
				let icon = 0;
				const name = autoFocus(input({"id": "characterName"})),
				      w = shell.appendChild(windows({"window-title": "New Character", "ondragover": () => w.focus()}, [
					h1("New Character"),
					label({"for": "characterName"}, "Character Name: "),
					name,
					br(),
					label("Character Image: "),
					div({"style": "overflow: hidden; display: inline-block; user-select: none; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
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
							(root.addItem(id, name) as Character).setIcon(icon);
							return rpc.characterSet(id, {"store-image-icon": {"user": false, "data": icon.toString()}});
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
