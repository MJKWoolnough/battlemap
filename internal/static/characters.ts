import {Uint, KeystoreData} from './types.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createHTML, br, button, div, h1, img, input, label} from './lib/html.js';
import {symbol, g, path} from './lib/svg.js';
import {WindowElement, loadingWindow, windows} from './windows.js';
import {mapLoadedReceive, requestShell} from './misc.js';
import {getToken} from './adminMap.js';
import {addSymbol, getSymbol} from './symbols.js';
import {characterEdit} from './plugins.js';
import lang from './language.js';
import {rpc} from './rpc.js';

let n = 0,
    lastMapChanged = 0;

const allowedKey = (key: string, character: boolean) => {
	switch (key) {
	case "store-character-id":
		return character;
	case "store-image-icon":
	case "store-token-id":
	case "store-image-data":
		return !character;
	}
	return true;
      },
      userVisible = addSymbol("userVisibility", symbol({"viewBox": "0 0 47 47"}, [
	      path({"d": "M3,17 H11 V27 H35 V17 H43 V40 H3 M14,6 H32 V24 H14", "style": "fill: currentColor"}),
	      g({"stroke-width": 6}, [
		      path({"d": "M10,30 L20,47 L47,0", "stroke": "#0f0", "fill": "none", "style": "display: var(--check-on, block)"}),
		      path({"d": "M10,47 L47,0 M10,0 L47,47", "stroke": "#f00", "fill": "none", "style": "display: var(--check-off, none)"})
	      ])
      ]));

export const characterData = new Map<Uint, Record<string, KeystoreData>>(),
tokenSelector = (w: WindowElement, d: Record<string, KeystoreData>, changes: Record<string, KeystoreData>, removes: Set<string>) => {
	const i = img({"src": d["store-image-data"] ? `/images/${d["store-image-data"].data["src"]}` : undefined, "style": "max-width: 100%; max-height: 100%"});
	return div({"class": "tokenSelector"}, [
		button({"onclick":() => (d["store-image-data"] || changes["store-image-data"] ? w.confirm(lang["TOKEN_REPLACE"], lang["TOKEN_REPLACE_CONFIRM"]) : Promise.resolve(true)).then(proceed => {
			if (!proceed) {
				return;
			}
			const data = getToken();
			if (!data) {
				w.alert(lang["TOKEN_SELECT"], lang["TOKEN_NONE_SELECTED"]);
				return;
			}
			changes["store-image-data"] = {"user": false, data};
			i.setAttribute("src", `/images/${data["src"]}`);
		})}, lang["TOKEN_USE_SELECTED"]),
		i
	]);
},
characterSelector = (d: Record<string, KeystoreData>, changes: Record<string, KeystoreData>) => div({"style": "overflow: hidden; display: inline-block; user-select: none; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
		if (e.dataTransfer && e.dataTransfer.getData("character")) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "link";
		}
	}, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
		const tokenData = JSON.parse(e.dataTransfer!.getData("character")),
		      charData = characterData.get(tokenData.id)!;
		changes["store-character-id"] = {"user": false, "data": tokenData.id};
		clearElement(this).appendChild(img({"src": `/images/${charData["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%; cursor: pointer", "onclick": () => edit(tokenData.id, lang["CHARACTED_EDIT"], charData, true)}));
		}
	}, d["store-character-id"] ? img({"src": `/images/${characterData.get(d["store-character-id"].data)!["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%; cursor: pointer", "onclick": () => edit(d["store-character-id"].data, lang["CHARACTER_EDIT"], characterData.get(d["store-character-id"].data)!, true)}) : []),
iconSelector = (d: Record<string, KeystoreData>, changes: Record<string, KeystoreData>) => div({"style": "overflow: hidden; display: inline-block; user-select: none; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": (e: DragEvent) => {
		if (e.dataTransfer && e.dataTransfer.getData("imageAsset")){
			e.preventDefault();
			e.dataTransfer.dropEffect = "link";
		}
	}, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
		const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset"));
		changes["store-image-icon"] = {"user": d["store-image-icon"].user, "data": tokenData.id};
		clearElement(this).appendChild(img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
	}}, img({"src": `/images/${d["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%"})),
edit = function (id: Uint, name: string, d: Record<string, KeystoreData>, character: boolean) {
	n++;
	let row = 0;
	const mapChanged = lastMapChanged,
	      removeSymbol = getSymbol("remove")!,
	      changes: Record<string, KeystoreData> = {},
	      removes = new Set<string>(),
	      adder = (k: string) => {
		const data = input({"id": `character_${n}_${row}`, "value": d[k]?.data ?? "", "onchange": function(this: HTMLInputElement) {
			changes[k] = Object.assign(changes[k] || {"user": d[k]?.user ?? false}, {"data": this.value});
		      }}),
		      visibility = input({"type": "checkbox", "class": "userVisibility", "id": `character_${n}_${row}_user`, "checked": d[k]?.user, "onchange": function(this: HTMLInputElement) {
			changes[k] = Object.assign(changes[k] || {"data": d[k]?.data ?? ""}, {"user": this.checked});
		      }});
		return [
			label({"for": `character_${n}_${row}`}, k),
			data,
			visibility,
			label({"for": `character_${n}_${row}_user`}, userVisible()),
			input({"type": "checkbox", "class": "characterDataRemove", "id": `character_${n}_${row}_remove`, "onchange": function(this: HTMLInputElement) {
				if (this.checked) {
					removes.add(k);
					data.toggleAttribute("disabled", true);
				} else {
					removes.delete(k);
					data.removeAttribute("disabled");
				}
			}}),
			label({"for": `character_${n}_${row++}_remove`, "class": "itemRemove"}, removeSymbol()),
			br()
		]
	      },
	      inputs = div(Object.keys(d).filter(k => allowedKey(k, character)).sort().map(adder)),
	      save = (): Promise<void> => {
		if (lastMapChanged !== mapChanged && !character) {
			w.remove();
			requestShell().alert(lang["MAP_CHANGED"], lang["MAP_CHANGED_LONG"]);
			throw new Error("map changed");
		}
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
		      });
		return loadingWindow((character ? rpc.characterModify : rpc.tokenModify)(id, changes, rms).then(() => {
			Object.assign(d, changes);
			keys.forEach(k => delete changes[k]);
			removes.forEach(k => delete d[k]);
			removes.clear();
		}), w);
	      },
	      w = windows();
	requestShell().appendChild(autoFocus(createHTML(w, {"window-title": name, "class": "showCharacter", "--window-width": "auto", "ondragover": () => w.focus(), "onclose": (e: Event) => {
		if (removes.size > 0 || Object.keys(changes).length > 0) {
			e.preventDefault();
			w.confirm(lang["ARE_YOU_SURE"], lang["UNSAVED_CHANGES"]).then(t => {
				if (t) {
					w.remove();
				}
			});
		}
	      }}, characterEdit(w, id, d, character, changes, removes, save) || [
		h1(name),
		character ? [
			label(lang["CHARACTER_IMAGE"]),
			iconSelector(d, changes),
			br(),
			label(`${lang["TOKEN"]}: `),
			tokenSelector(w, d, changes, removes)
		] : [
			label(lang["CHARACTER"]),
			characterSelector(d, changes)
		],
		br(),
		inputs,
		button({"onclick": () => w.prompt(lang["ROW_NEW"], lang["ROW_NAME_ENTER"]).then(key => {
			if (key) {
				if (!allowedKey(key, character)) {
					w.alert(lang["ROW_NAME_RESERVED"], lang["ROW_NAME_RESERVED_LONG"]);
					return;
				}
				if (d[key] !== undefined || changes[key] !== undefined) {
					w.alert(lang["ROW_NAME_EXISTS"], lang["ROW_NAME_EXISTS_LONG"]);
					return;
				}
				changes[key] = {"user": false, "data": ""};
				createHTML(inputs, adder(key));
			}
		})}, lang["ROW_ADD"]),
		button({"onclick": function(this: HTMLButtonElement) {
			this.toggleAttribute("disabled", true);
			save().finally(() => this.removeAttribute("disabled"));
		}}, lang["SAVE"])
	      ])));
}

export default function () {
	rpc.waitCharacterDataChange().then(d => {
		const char = characterData.get(d.id);
		if (char) {
			Object.assign(char, d.setting);
			for (const r of d.removing) {
				delete char[r];
			}
		}
	});
	mapLoadedReceive(() => lastMapChanged = Date.now());

};
