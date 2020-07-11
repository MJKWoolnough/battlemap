import {Int, KeystoreData, RPC} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
import {ShellElement, WindowElement, loadingWindow, windows} from './windows.js';
import {handleError} from './misc.js';
import {Root, Folder, DraggableItem} from './folders.js';
import {characterData, tokenData} from './characters.js';
import characterEdit from './keystoreEdit.js';

let rpc: RPC;

class Character extends DraggableItem {
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
		rpc.characterGetAll(id).then(d => {
			characterData.set(id, d);
			if (d["store-image-icon"]) {
				this.setIcon(parseInt(d["store-image-icon"].data));
			}
			if (d["store-token-id"]) {
				const id = d["store-token-id"].data;
				rpc.tokenGetAll(id).then(d => tokenData.set(id, d));
			}
		}).catch(handleError);
		characters.set(id, this);
	}
	setIcon(id: Int) {
		(this.icon.firstChild as HTMLImageElement).setAttribute("src", `/images/${id}`);
	}
	dragName() {
		return "character";
	}
	show() {
		characterEdit(this.parent.root.shell, rpc, this.id, this.name, characterData.get(this.id)!, true);
	}
}

class CharacterRoot extends Root {
	removeItem(name: string) {
		const id = super.removeItem(name);
		if (id > 0) {
			characters.delete(id);
		}
		return id;
	}
}

const characters = new Map<Int, Character>();

export default function (arpc: RPC, shell: ShellElement, base: Node) {
	const rpcFuncs = arpc["characters"];
	rpc = arpc;
	rpcFuncs.list().then(folderList => {
		const root = new CharacterRoot(folderList, "Characters", rpcFuncs, shell, Character);
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
						if (!name.value) {
							w.alert("Error", "A character needs a name");
							return;
						}
						if (!icon) {
							w.alert("Error", "A character needs an icon");
							return;
						}
						this.setAttribute("disabled", "disabled");
						loadingWindow(rpc.characterCreate(name.value).then(({id, name}) => {
							(root.addItem(id, name) as Character).setIcon(icon);
							return rpc.characterSet(id, {"store-image-icon": {"user": false, "data": icon}});
						}), w)
						.then(() => w.remove())
						.catch(handleError)
						.finally(() => this.removeAttribute("disabled"));
					}})
				      ]));
			}}),
			root.node
		]);
		rpc.waitCharacterDataChange().then(d => {
			const icon = d.data["store-image-icon"];
			if (icon) {
				const char = characters.get(d.id);
				if (char) {
					char.setIcon(parseInt(icon.data));
				}
			}
		});
	});
};
