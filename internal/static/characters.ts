import {Int, KeystoreData, RPC} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
import {ShellElement, WindowElement, loadingWindow, windows} from './windows.js';
import {showError} from './misc.js';
import {Root, Folder, DraggableItem} from './folders.js';

let rpc: RPC, n = 0;

class Character extends DraggableItem {
	data: Record<string, KeystoreData> = {};
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
		rpc.characterGet(id, []).then(data => {
			this.data = data;
			if (data["store-image-icon"]) {
				this.setIcon(parseInt(data["store-image-icon"].data));
			}
		});
		characters.set(id, this);
	}
	setIcon(id: Int) {
		(this.icon.firstChild as HTMLImageElement).setAttribute("src", `/images/${id}`);
	}
	dragName() {
		return "character";
	}
	show() {
		n++;
		const self = this,
		      root = self.parent.root,
		      changes: Record<string, KeystoreData> = {},
		      removes: string[] = [];
		let changed = false;
		return createHTML(autoFocus(root.shell.appendChild(windows({"window-title": this.name, "class": "showCharacter", "onclose": function(this: WindowElement, e: Event) {
			if (changed) {
				e.preventDefault();
				this.confirm("Are you sure?", "There are unsaved changes, are you sure you wish to close?").then(() => this.remove());
			}
		}}, [
			h1(this.name),
			label("Character Image: "),
			div({"style": "overflow: hidden; display: inline-block; user-select: none; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
				if (e.dataTransfer && e.dataTransfer.getData("imageAsset")) {
					e.preventDefault();
					e.dataTransfer.dropEffect = "link";
				}
			}, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
				const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset"));
				changed = true;
				changes["store-image-icon"] = tokenData.id.toString();
				clearElement(this).appendChild(img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
			}}, img({"src": (this.icon.firstChild as HTMLImageElement).getAttribute("src"), "style": "max-width: 100%; max-height: 100%"})),
			br(),
			Object.keys(self.data).filter(k => k !== "store-image-icon").map((k, m) => [
				label({"for": `character_${n}_${m}`}, k),
				input({"id": `character_${n}_${m}`, "value": self.data[k].data, "onchange": function(this: HTMLInputElement) {
					if (!self.data[k] || self.data[k].data !== this.value) {
						changes[k] = {"user": false, "data": this.value};
						changed = true;
					}
				}}),
				br()
			]),
			button("Save", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				const keys = Object.keys(changes);
				let p = Promise.resolve();
				if (keys.length > 0) {
					p = p.then(() => rpc.characterSet(self.id, changes)).then(() => {
						keys.forEach(k => delete changes[k]);
						Object.assign(self.data, changes);
					});
				}
				if (removes.length > 0) {
					p = p.then(() => rpc.characterRemoveKeys(self.id, removes)).then(() => {
						removes.splice(0, removes.length);
					});
				}
				p.then(() => changed = false)
				.catch(console.log)
				.finally(() => this.removeAttribute("disabled"));
			}})
		]))));
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

export const characters = new Map<Int, Character>();

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
		rpc.waitCharacterDataChange().then(data => {
			const char = characters.get(data.id);
			if (char) {
				Object.assign(char.data, data.data);
				const icon = data.data["store-image-icon"];
				if (icon) {
					char.setIcon(parseInt(icon.data));
				}
			}
		});
		rpc.waitCharacterDataRemove().then(data => {
			const char = characters.get(data.id);
			if (char) {
				data.keys.forEach(k => delete char.data[k]);
			}
		});
	});
};
