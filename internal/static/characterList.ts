import {Int, KeystoreData, RPC} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
import {ShellElement, WindowElement, loadingWindow, windows} from './windows.js';
import {showError} from './misc.js';
import {Root, Folder, DraggableItem} from './folders.js';
import {characterData} from './characters.js';

let rpc: RPC, n = 0;

class Character extends DraggableItem {
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
		rpc.characterGet(id, []).then(d => {
			characterData.set(id, d);
			if (d["store-image-icon"]) {
				this.setIcon(parseInt(d["store-image-icon"].data));
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
		let changed = false, row = 0;
		const d = characterData.get(this.id)!,
		      id = this.id,
		      root = this.parent.root,
		      changes: Record<string, KeystoreData> = {},
		      removes = new Set<string>(),
		      adder = (k: string) => [
				label({"for": `character_${n}_${row}`}, k),
				input({"id": `character_${n}_${row}`, "value": d[k]?.data || "", "onchange": function(this: HTMLInputElement) {
					changes[k] = Object.assign(changes[k] || {"user": d[k]?.user ?? false}, {"data": this.value});
				}}),
				input({"type": "checkbox", "class": "userVisibility", "id": `character_${n}_${row}_user`, "checked": d[k]?.user ? "checked" : undefined, "onchange": function(this: HTMLInputElement) {
					changes[k] = Object.assign(changes[k] || {"data": d[k]?.data ?? ""}, {"user": this.checked});
				}}),
				label({"for": `character_${n}_${row}_user`}),
				input({"type": "checkbox", "class": "characterDataRemove", "id": `character_${n}_${row}_remove`, "onchange": function(this: HTMLInputElement) {
					if (this.checked) {
						removes.add(k);
						document.getElementById(this.getAttribute("id")?.slice(0, -7) ?? "")?.setAttribute("disabled", "disabled");
					} else {
						removes.delete(k);
						document.getElementById(this.getAttribute("id")?.slice(0, -7) ?? "")?.removeAttribute("disabled");
					}
				}}),
				label({"for": `character_${n}_${row++}_remove`, "class": "itemRemove"}),
				br()
		      ],
		      inputs = div(Object.keys(d).filter(k => k !== "store-image-icon").sort().map(adder)),
		      w = createHTML(autoFocus(root.shell.appendChild(windows({"window-title": this.name, "class": "showCharacter", "onclose": (e: Event) => {
			if (removes.size > 0 || Object.keys(changes).length > 0) {
				e.preventDefault();
				w.confirm("Are you sure?", "There are unsaved changes, are you sure you wish to close?").then(t => {
					if (t) {
						w.remove();
					}
				});
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
				changes["store-image-icon"] = {"user": d["store-image-icon"].user, "data": tokenData.id.toString()};
				clearElement(this).appendChild(img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
			}}, img({"src": (this.icon.firstChild as HTMLImageElement).getAttribute("src"), "style": "max-width: 100%; max-height: 100%"})),
			br(),
			inputs,
			button("Add Row", {"onclick": () => w.prompt("New Row", "Please enter a new row name").then(key => {
				if (key) {
					createHTML(inputs, adder(key));
				}
			})}),
			button("Save", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				const rms = Array.from(removes.values()).filter(k => {
					delete changes[k];
					return d[k] !== undefined;
				      }),
				      keys = Object.keys(changes).filter(k => {
					const old = d[k];
					if (old && old.user === changes[k].user && old.data === changes[k].data) {
						delete changes[k];
						return false;
					}
					return true;
				      }),
				      ps: Promise<void>[] = [];
				if (keys.length > 0) {
					ps.push(rpc.characterSet(id, changes).then(() => {
						keys.forEach(k => delete changes[k]);
						Object.assign(d, changes);
					}));
				}
				if (removes.size > 0) {
					ps.push(rpc.characterRemoveKeys(id, rms).then(() => {
						removes.clear();
						removes.forEach(k => delete d[k]);
					}));
				}
				Promise.all(ps)
				.then(() => changed = false)
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
							return rpc.characterSet(id, {"store-image-icon": {"user": false, "data": icon.toString()}});
						}), w)
						.then(() => w.remove())
						.catch(e => {
							showError(name, e);
							this.removeAttribute("disabled");
						});
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
