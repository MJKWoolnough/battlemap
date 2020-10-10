import {Uint, RPC} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
import {ShellElement, loadingWindow, windows} from './windows.js';
import {handleError} from './misc.js';
import {Root, Folder, DraggableItem} from './folders.js';
import {edit as characterEdit, characterData} from './characters.js';
import lang from './language.js';

let rpc: RPC;

class Character extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		rpc.characterGet(id).then(d => {
			characterData.set(id, d);
			if (d["store-image-icon"]) {
				this.setIcon(parseInt(d["store-image-icon"].data));
			}
		}).catch(handleError);
		characters.set(id, this);
	}
	setIcon(id: Uint) {
		this.image.setAttribute("src", `/images/${id}`);
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

const characters = new Map<Uint, Character>();

export default function (arpc: RPC, shell: ShellElement, base: Node) {
	const rpcFuncs = arpc["characters"];
	rpc = arpc;
	rpcFuncs.list().then(folderList => {
		const root = new CharacterRoot(folderList, lang["CHARACTERS"], rpcFuncs, shell, Character);
		createHTML(clearElement(base), {"id": "characters", "class": "folders"}, [
			button(lang["CHARACTER_NEW"], {"onclick": () => {
				let icon = 0;
				const name = autoFocus(input({"id": "characterName"})),
				      w = shell.appendChild(windows({"window-title": lang["CHARACTER_NEW"], "ondragover": () => w.focus()}, [
					h1(lang["CHARACTER_NEW"]),
					label({"for": "characterName"}, `${lang["CHARACTER_NAME"]}: `),
					name,
					br(),
					label(`${lang["CHARACTER_IMAGE"]}: `),
					div({"style": "overflow: hidden; display: inline-block; user-select: none; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
						e.preventDefault();
						if (e.dataTransfer && e.dataTransfer.getData("imageAsset")) {
							e.dataTransfer.dropEffect = "link";
						}
					}, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
						const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset"));
						icon = tokenData.id;
						clearElement(this).appendChild(img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
					}}, lang["CHARACTER_DROP_ICON"]),
					br(),
					button("Create", {"onclick": function(this: HTMLButtonElement) {
						if (!name.value) {
							w.alert(lang["ERROR"], lang["CHARACTER_NEED_NAME"]);
							return;
						}
						if (!icon) {
							w.alert(lang["ERROR"], lang["CHARACTER_NEED_ICON"]);
							return;
						}
						this.toggleAttribute("disabled", true);
						loadingWindow(rpc.characterCreate(name.value).then(({id, name}) => rpc.characterModify(id, {"store-image-icon": {"user": false, "data": icon}}, []).then(() => root.addItem(id, name))), w)
						.then(() => w.remove())
						.catch(handleError)
						.finally(() => this.removeAttribute("disabled"));
					}})
				      ]));
			}}),
			root.node
		]);
		rpc.waitCharacterDataChange().then(d => {
			const icon = d.setting["store-image-icon"];
			if (icon) {
				const char = characters.get(d.id);
				if (char) {
					char.setIcon(parseInt(icon.data));
				}
			}
		});
	});
};
