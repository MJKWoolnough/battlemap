import type {KeystoreData, Uint} from './types.js';
import type {WindowElement} from './windows.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {br, button, div, h1, img, input, label, li, ul} from './lib/html.js';
import {NodeMap, node, noSort} from './lib/nodes.js';
import {ns as svgNS} from './lib/svg.js';
import {character, imageAsset, setDragEffect} from './dragTransfer.js';
import lang from './language.js';
import {doTokenSet, getToken} from './map_fns.js';
import {characterEdit} from './plugins.js';
import {inited, rpc} from './rpc.js';
import {characterData, labels, mapLoadedReceive, queue, resetCharacterTokens} from './shared.js';
import {remove as removeSymbol, userVisible} from './symbols.js';
import undo from './undo.js';
import {loadingWindow, shell, windows} from './windows.js';

let lastMapChanged = 0, n = 0;

const allowedKey = (key: string, character: boolean) => {
	switch (key) {
	case "store-character-id":
		return character;
	case "store-image-icon":
	case "store-token-id":
	case "store-image-data":
	case "tokens_order":
		return !character;
	}
	return true;
      },
      doCharacterModify = (id: Uint, changes: Record<string, KeystoreData>, removes: string[]) => {
	let oldChanges: Record<string, KeystoreData> = {},
	    oldRemoves: string[] = [];
	const char = characterData.get(id)!,
	      doIt = (sendRPC = true) => {
		Object.assign(char, changes);
		if (changes["store-image-data"] || changes["tokens_order"]) {
			resetCharacterTokens(char);
		}
		for (const r of removes) {
			delete char[r];
		}
		if (sendRPC) {
			queue(() => rpc.characterModify(id, changes, removes));
		}
		[changes, oldChanges] = [oldChanges, changes];
		[removes, oldRemoves] = [oldRemoves, removes];
		return doIt;
	      };
	for (const k in changes) {
		if (char[k]) {
			oldChanges[k] = char[k];
		} else {
			oldRemoves.push(k);
		}
	}
	for (const r of removes) {
		if (char[r]) {
			oldChanges[r] = char[r];
		}
	}
	undo.add(doIt(false), lang["UNDO_CHARACTER"]);
      },
      doTokenModify = (id: Uint, tokenData: Record<string, KeystoreData>, removeTokenData: string[]) => {
	const t = {id, tokenData, removeTokenData};
	doTokenSet(t, false);
	return rpc.setToken(t);
      };

export const characterIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cg stroke-width="2" stroke="%23000" fill="%23fff"%3E%3Cpath d="M99,89 A1,1 0,0,0 1,89 v10 H99 z" /%3E%3Ccircle cx="50" cy="31" r="30" /%3E%3C/g%3E%3C/svg%3E`,
tokenSelector = (w: WindowElement, d: Record<string, KeystoreData>, changes: Record<string, KeystoreData>) => {
	const makeToken = (n: Uint, tk: {src: Uint}) => Object.assign({[node]: li({"class": "tokenSelector"}, (() => {
		const i = img({"src": `/images/${tk["src"]}`});
		return [
			button({"onclick": () => w.confirm(lang["TOKEN_REPLACE"], lang["TOKEN_REPLACE_CONFIRM"]).then(proceed => {
				if (proceed) {
					const data = getToken();
					if (!data) {
						w.alert(lang["TOKEN_SELECT"], lang["TOKEN_NONE_SELECTED"]);
						return;
					}
					changes["store-image-data"] = {"user": false, "data": Array.from(tokens.values())};
					amendNode(i, {"src": `/images/${data["src"]}`});
				}
			})}, lang["TOKEN_USE_SELECTED"]),
			i,
			removeSymbol({"onclick": () => w.confirm(lang["TOKEN_REMOVE"], lang["TOKEN_REMOVE_CONFIRM"]).then(proceed => {
				if (proceed) {
					tokens.delete(n);
					changes["store-image-data"] = {"user": false, "data": Array.from(tokens.values())};
				}
			})})
		];
	      })())}, tk),
	      tokens = new NodeMap(ul({"class": "tokenSelectors"}), noSort, (d["store-image-data"] ? d["store-image-data"].data instanceof Array ? d["store-image-data"].data : [d["store-image-data"].data] : []).map((tk, n) => [n, makeToken(n, tk)]));
	let nextID = tokens.size;
	return [
		tokens[node],
		button({"onclick": () => {
			const data = getToken();
			if (!data) {
				w.alert(lang["TOKEN_SELECT"], lang["TOKEN_NONE_SELECTED"]);
				return;
			}
			tokens.set(nextID, makeToken(nextID, data));
			nextID++;
			changes["store-image-data"] = {"user": false, "data": Array.from(tokens.values())};
		}}, lang["TOKEN_ADD"]),
		br(),
		label(`${lang["TOKEN_ORDER"]}: `),
		labels(`${lang["TOKEN_ORDER_NORMAL"]}: `, input({"type": "radio", "name": `tokens_ordered_${n}`, "class": "settings_ticker", "checked": !d["tokens_order"]?.data, "onclick": () => changes["tokens_order"] = {"user": false, "data": false}}), false),
		labels(`${lang["TOKEN_ORDER_SHUFFLE"]}: `, input({"type": "radio", "name": `tokens_ordered_${n++}`, "class": "settings_ticker", "checked": d["tokens_order"]?.data, "onclick": () => changes["tokens_order"] = {"user": false, "data": true}}), false),
	];
},
characterSelector = (d: Record<string, KeystoreData>, changes: Record<string, KeystoreData>) => div({"style": "overflow: hidden; display: inline-block; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": setDragEffect({"link": [character]}), "ondrop": function(this: HTMLDivElement, e: DragEvent) {
		const tokenData = character.get(e)!,
		      charData = characterData.get(tokenData.id)!;
		changes["store-character-id"] = {"user": true, "data": tokenData.id};
		clearNode(this, img({"src": `/images/${charData["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%; cursor: pointer", "onclick": () => edit(tokenData.id, lang["CHARACTER_EDIT"], charData, true)}));
	}}, d["store-character-id"] ? img({"src": `/images/${characterData.get(d["store-character-id"].data)!["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%; cursor: pointer", "onclick": () => edit(d["store-character-id"].data, lang["CHARACTER_EDIT"], characterData.get(d["store-character-id"].data)!, true)}) : []),
iconSelector = (d: Record<string, KeystoreData>, changes: Record<string, KeystoreData>) => div({"style": "overflow: hidden; display: inline-block; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": setDragEffect({"link": [imageAsset]}), "ondrop": function(this: HTMLDivElement, e: DragEvent) {
		const tokenData = imageAsset.get(e)!;
		changes["store-image-icon"] = {"user": d["store-image-icon"].user, "data": tokenData.id};
		clearNode(this, img({"src": `/images/${tokenData.id}`, "style": "max-width: 100%; max-height: 100%"}));
	}}, img({"src": `/images/${d["store-image-icon"].data}`, "style": "max-width: 100%; max-height: 100%"})),
edit = (id: Uint, name: string, d: Record<string, KeystoreData>, character: boolean) => {
	const mapChanged = lastMapChanged,
	      changes: Record<string, KeystoreData> = {},
	      removes = new Set<string>(),
	      adder = (k: string) => {
		const data = input({"value": d[k]?.data ?? "", "onchange": function(this: HTMLInputElement) {
			changes[k] = Object.assign(changes[k] || {"user": d[k]?.user ?? false}, {"data": this.value});
		      }}),
		      visibility = input({"type": "checkbox", "class": "userVisibility", "checked": d[k]?.user, "onchange": function(this: HTMLInputElement) {
			changes[k] = Object.assign(changes[k] || {"data": d[k]?.data ?? ""}, {"user": this.checked});
		      }});
		return [
			labels(k, data),
			labels(userVisible(), visibility, false),
			labels(removeSymbol(), input({"type": "checkbox", "class": "characterDataRemove", "onchange": function(this: HTMLInputElement) {
				amendNode(data, {"disabled": this.checked});
				removes[this.checked ? "add" : "delete"](k);
			}}), false, {"class": "itemRemove"}),
			br()
		]
	      },
	      inputs = div(Object.keys(d).filter(k => allowedKey(k, character)).sort().map(adder)),
	      save = (): Promise<void> => {
		if (lastMapChanged !== mapChanged && !character) {
			w.remove();
			shell.alert(lang["MAP_CHANGED"], lang["MAP_CHANGED_LONG"]);
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
		return loadingWindow((character ? (doCharacterModify(id, changes, rms), rpc.characterModify(id, changes, rms)) : doTokenModify(id, changes, rms)).then(() => {
			for (const k of keys) {
				delete changes[k];
			}
			removes.clear();
		}), w);
	      },
	      w = windows( {"window-icon": characterIcon, "window-title": name, "class": "showCharacter", "style": {"--window-width": "auto"}, "ondragover": () => w.focus(), "onclose": (e: Event) => {
		if (removes.size > 0 || Object.keys(changes).length > 0) {
			e.preventDefault();
			w.confirm(lang["ARE_YOU_SURE"], lang["UNSAVED_CHANGES"]).then(t => {
				if (t) {
					w.remove();
				}
			});
		}
	      }});
	amendNode(shell, autoFocus(amendNode(w, div(characterEdit(w, id, d, character, changes, removes, save) || [
		h1(name),
		character ? [
			label(lang["CHARACTER_IMAGE"]),
			iconSelector(d, changes),
			br(),
			label(`${lang["TOKEN"]}: `),
			tokenSelector(w, d, changes)
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
				} else if (d[key] !== undefined || changes[key] !== undefined) {
					w.alert(lang["ROW_NAME_EXISTS"], lang["ROW_NAME_EXISTS_LONG"]);
				} else {
					changes[key] = {"user": false, "data": ""};
					amendNode(inputs, adder(key));
				}
			}
		})}, lang["ROW_ADD"]),
		button({"onclick": function(this: HTMLButtonElement) {
			amendNode(this, {"disabled": true});
			save().finally(() => amendNode(this, {"disabled": false}));
		}}, lang["SAVE"])
	]))));
}

inited.then(() => {
	rpc.waitCharacterDataChange().then(({id, setting, removing}) => doCharacterModify(id, setting, removing));
	mapLoadedReceive(() => lastMapChanged = Date.now());
});
