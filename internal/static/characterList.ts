import type {FolderItems, Uint} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
import {node} from './lib/nodes.js';
import {Pipe} from './lib/inter.js';
import {loadingWindow, windows, shell} from './windows.js';
import {Root, Folder, DraggableItem} from './folders.js';
import {edit as characterEdit, characterIcon} from './characters.js';
import {characterData, enterKey, labels, setAndReturn} from './shared.js';
import lang from './language.js';
import {rpc} from './rpc.js';

class Character extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		if (!characterData.has(id)) {
			rpc.characterGet(id).then(d => {
				characterData.set(id, d);
				if (d["store-image-icon"]) {
					this.setIcon(d["store-image-icon"].data);
				}
			});
		} else {
			const d = characterData.get(id)!;
			if (d["store-image-icon"]) {
				this.setIcon(d["store-image-icon"].data);
			}
		}
		characters.set(id, this);
	}
	get showOnMouseOver() { return true; }
	dragName() { return "character"; }
	setIcon(id: Uint) {
		createHTML(this.image, {"src": `/images/${id}`});
	}
	show() {
		characterEdit(this.id, this.name, characterData.get(this.id)!, true);
	}
}

class CharacterFolder extends Folder {
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, children);
		for (const name in children.items) {
			this.registerItem(children.items[name], name);
		}
	}
	registerItem(id: Uint, name: string) {
		const v = characterNames.get(id);
		if (v) {
			v[0].send(v[1] = name);
		} else {
			characterNames.set(id, [new Pipe(), name]);
		}
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
	copyItem(oldID: Uint, newID: Uint, name: string) {
		const c = characterData.get(oldID);
		if (c) {
			characterData.set(newID, JSON.parse(JSON.stringify(c)));
			super.copyItem(oldID, newID, name);
		}
	}
}

const characters = new Map<Uint, Character>(),
      characterNames = new Map<Uint, [Pipe<string>, string]>();

export const getCharacterName = (id: Uint, fn: (name: string) => void) => {
	const character = characterNames.get(id) ?? setAndReturn(characterNames, id, [new Pipe(), ""]);
	fn(character[1]);
	character[0].receive(fn);
	return () => character[0].remove(fn);
};

export default (base: Node) => {
	const rpcFuncs = rpc["characters"];
	rpcFuncs.list().then(folderList => {
		const root = new CharacterRoot(folderList, lang["CHARACTERS"], rpcFuncs, Character, CharacterFolder);
		root.windowIcon = characterIcon;
		createHTML(clearElement(base), {"id": "characters", "class": "folders"}, [
			button(lang["CHARACTER_NEW"], {"onclick": () => {
				let icon = 0;
				const w = windows({"window-icon": characterIcon, "window-title": lang["CHARACTER_NEW"], "ondragover": () => w.focus()}),
				      name = autoFocus(input({"onkeypress": enterKey}));
				createHTML(shell, createHTML(w, [
					h1(lang["CHARACTER_NEW"]),
					labels(`${lang["CHARACTER_NAME"]}: `, name),
					br(),
					label(`${lang["CHARACTER_IMAGE"]}: `),
					div({"style": "overflow: hidden; display: inline-block; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
						e.preventDefault();
						if (e.dataTransfer && e.dataTransfer.getData("imageAsset")) {
							e.dataTransfer.dropEffect = "link";
						}
					}, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
						const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset"));
						icon = tokenData.id;
						createHTML(clearElement(this), img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
					}}, lang["CHARACTER_DRAG_ICON"]),
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
						loadingWindow(rpc.characterCreate(name.value, {"name": {"user": false, "data": name.value}, "store-image-icon": {"user": false, "data": icon}}).then(({id, path}) => root.addItem(id, path)), w)
						.then(() => w.remove())
						.finally(() => this.removeAttribute("disabled"));
					}})
				]));
			}}),
			root[node]
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
