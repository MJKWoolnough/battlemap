import {Int, KeystoreData, RPC} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1,  img, input, label} from './lib/html.js';
import {ShellElement, loadingWindow, windows} from './windows.js';
import {handleError} from './misc.js';
import {characterData} from './characters.js';

let n = 0;

export default function (shell: ShellElement, rpc: RPC, id: Int, name: string, d: Record<string, KeystoreData>, character: boolean) {
		n++;
		let changed = false, row = 0;
		const changes: Record<string, KeystoreData> = {},
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
		      inputs = div(Object.keys(d).filter(k => (k !== "store-image-icon") === character && (k !== "store-character-id") !== character).sort().map(adder)),
		      w = createHTML(autoFocus(shell.appendChild(windows({"window-title": name, "class": "showCharacter", "--window-width": "auto", "ondragover": () => w.focus(), "onclose": (e: Event) => {
			if (removes.size > 0 || Object.keys(changes).length > 0) {
				e.preventDefault();
				w.confirm("Are you sure?", "There are unsaved changes, are you sure you wish to close?").then(t => {
					if (t) {
						w.remove();
					}
				});
			}
		      }}, [
			h1(name),
			label(`Character${character ? " Image" : ""}: `),
			div({"style": "overflow: hidden; display: inline-block; user-select: none; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
				if (e.dataTransfer && (character ? e.dataTransfer.getData("imageAsset") : e.dataTransfer.getData("character"))) {
					e.preventDefault();
					e.dataTransfer.dropEffect = "link";
				}
			}, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
				const tokenData = JSON.parse(e.dataTransfer!.getData(character ? "imageAsset" : "character"));
				if (character) {
					changes["store-image-icon"] = {"user": d["store-image-icon"].user, "data": tokenData.id};
					clearElement(this).appendChild(img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
				} else {
					changes["store-character-id"] = {"user": false, "data": tokenData.id};
					clearElement(this).appendChild(img({"src": `/images/${characterData.get(tokenData.id)!["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%"}));
				}
			}}, character ? img({"src": `/images/${d["store-image-icon"]}`, "style": "max-width: 100%; max-height: 100%"}) : d["store-character-id"] ? img({"src": `/images/${characterData.get(id)!["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%"}) : []),
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
					ps.push((character ? rpc.characterSet : rpc.tokenSet)(id, changes).then(() => {
						Object.assign(d, changes);
						keys.forEach(k => delete changes[k]);
					}));
				}
				if (removes.size > 0) {
					ps.push((character ? rpc.characterRemoveKeys : rpc.tokenRemoveKeys)(id, rms).then(() => {
						removes.forEach(k => delete d[k]);
						removes.clear();
					}));
				}
				loadingWindow(Promise.all(ps), w)
				.then(() => {
					changed = false;
				})
				.catch(handleError)
				.finally(() => this.removeAttribute("disabled"));
			}})
		      ]))));
}
