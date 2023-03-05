import type {FolderItems, Uint} from './types.js';
import {add, id} from './lib/css.js';
import {amendNode, clearNode} from './lib/dom.js';
import {DragTransfer, setDragEffect} from './lib/drag.js';
import {br, button, div, h1, img, input, label} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import {autoFocus, setAndReturn} from './lib/misc.js';
import {node} from './lib/nodes.js';
import {dragImage, imageIDtoURL} from './assets.js';
import {characterIcon, dragCharacter, edit as characterEdit} from './characters.js';
import {DragFolder, DraggableItem, Folder, Root} from './folders.js';
import lang from './language.js';
import {isAdmin, rpc} from './rpc.js';
import {characterData, cloneObject, enterKey, labels, loading, menuItems} from './shared.js';
import {loadingWindow, shell, windows} from './windows.js';

export class Character extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name, dragCharacter, true);
		if (!characterData.has(id)) {
			rpc.characterGet(id).then(d => {
				characterData.set(id, d);
				if (d["store-image-icon"]) {
					this.setIcon(d["store-image-icon"].data);
				}
			});
		} else {
			const d = characterData.get(id)?.["store-image-icon"];
			if (d) {
				this.setIcon(d.data);
			}
		}
		characters.set(id, this);
	}
	setIcon(id: Uint) {
		amendNode(this.image, {"src": imageIDtoURL(id)});
	}
	show() {
		characterEdit(this.id, this.name, characterData.get(this.id)!, true);
	}
}

class CharacterFolder extends DragFolder<Character> {
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, children, dragCharacter, dragCharacterFolder);
		for (const name in children.items) {
			this.#registerItem(children.items[name], name);
		}
	}
	#registerItem(id: Uint, name: string) {
		const v = characterNames.get(id);
		if (v) {
			v[0].send(v[1] = name);
		} else {
			characterNames.set(id, [new Pipe(), name]);
		}
	}
	addItem(id: Uint, name: string) {
		this.#registerItem(id, name);
		return super.addItem(id, name);
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
			characterData.set(newID, cloneObject(c));
			super.copyItem(oldID, newID, name);
		}
	}
}

const characters = new Map<Uint, Character>(),
      characterNames = new Map<Uint, [Pipe<string>, string]>(),
      dragCharacterFolder = new DragTransfer<CharacterFolder>("characterfolder");

export const getCharacterName = (id: Uint, fn: (name: string) => void) => {
	const character = characterNames.get(id) ?? setAndReturn(characterNames, id, [new Pipe(), ""]);
	fn(character[1]);
	character[0].receive(fn);
	return () => character[0].remove(fn);
};

menuItems.push([2, () => isAdmin ? [
	lang["TAB_CHARACTERS"],
	(() => {
		const rpcFuncs = rpc["characters"],
		      base = div(loading()),
		      dragEffect = setDragEffect({"link": [dragImage]}),
		      charactersID = id();
		add(`#${charactersID}`, {
			" ul": {
				"margin": 0,
				"padding-left": "calc(1em + 4px)",
				"list-style": "none"
			},
			">div>ul": {
				"padding-left": 0
			}
		});
		rpcFuncs.list().then(folderList => {
			const root = new CharacterRoot(folderList, lang["CHARACTERS"], rpcFuncs, Character, CharacterFolder);
			root.windowIcon = characterIcon;
			clearNode(base, {"id": charactersID}, [
				button({"onclick": () => {
					let icon = 0;
					const name = input({"onkeypress": enterKey}),
					      w = windows({"window-icon": characterIcon, "window-title": lang["CHARACTER_NEW"], "ondragover": () => w.focus()}, [
						h1(lang["CHARACTER_NEW"]),
						labels([lang["CHARACTER_NAME"], ": "], name),
						br(),
						label([lang["CHARACTER_IMAGE"], ": "]),
						div({"style": "overflow: hidden; display: inline-block; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": dragEffect, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
							clearNode(this, img({"src": imageIDtoURL(icon = dragImage.get(e)!.id), "style": "max-width: 100%; max-height: 100%"}));
						}}, lang["CHARACTER_DRAG_ICON"]),
						br(),
						button({"onclick": function(this: HTMLButtonElement) {
							if (!name.value) {
								w.alert(lang["ERROR"], lang["CHARACTER_NEED_NAME"]);
							} else if (!icon) {
								w.alert(lang["ERROR"], lang["CHARACTER_NEED_ICON"]);
							} else {
								loadingWindow(rpc.characterCreate(name.value, {"name": {"user": false, "data": name.value}, "store-image-icon": {"user": false, "data": icon}}).then(({id, path}) => root.addItem(id, path)), w)
								.then(() => w.remove())
								.finally(() => amendNode(this, {"disabled": false}));
								amendNode(this, {"disabled": true});
							}
						}}, lang["CHARACTER_CREATE"])
					      ]);
					amendNode(shell, w);
					autoFocus(name);
				}}, lang["CHARACTER_NEW"]),
				root[node]
			]);
			rpc.waitCharacterDataChange().when(d => {
				const icon = d.setting["store-image-icon"];
				if (icon) {
					characters.get(d.id)?.setIcon(parseInt(icon.data));
				}
			});
		});
		return base;
	})(),
	true,
	characterIcon
] : null]);
