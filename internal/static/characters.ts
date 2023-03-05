import type {KeystoreData, Uint} from './types.js';
import type {Binding} from './lib/bind.js';
import type {Character} from './characterList.js';
import {add, ids} from './lib/css.js';
import {amendNode, clearNode} from './lib/dom.js';
import {DragTransfer, setDragEffect} from './lib/drag.js';
import {br, button, div, img, input, label, li, ul} from './lib/html.js';
import {autoFocus, queue} from './lib/misc.js';
import {NodeMap, node, noSort} from './lib/nodes.js';
import {ns as svgNS} from './lib/svg.js';
import {dragImage, imageIDtoURL} from './assets.js';
import {settingsTicker, tokenSelector} from './ids.js';
import lang from './language.js';
import {doTokenSet, getToken} from './map_fns.js';
import {characterEdit} from './plugins.js';
import {inited, rpc} from './rpc.js';
import {characterData, cloneObject, labels, mapLoadedReceive, resetCharacterTokens} from './shared.js';
import {remove as removeSymbol, userVisible} from './symbols.js';
import undo from './undo.js';
import {loadingWindow, shell, windows} from './windows.js';

let lastMapChanged = 0,
    n = 0;

export const dragCharacter = new DragTransfer<Character>("character"),
characterIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cg stroke-width="2" stroke="%23000" fill="%23fff"%3E%3Cpath d="M99,89 A1,1 0,0,0 1,89 v10 H99 z" /%3E%3Ccircle cx="50" cy="31" r="30" /%3E%3C/g%3E%3C/svg%3E`,
edit = (id: Uint, title: string | Binding, d: Record<string, KeystoreData>, character: boolean) => {
	const mapChanged = lastMapChanged,
	      changes: Record<string, KeystoreData> = {},
	      removes = new Set<string>(),
	      w = windows({"window-icon": characterIcon, "window-title": title, "hide-minimise": false, "class": showCharacter, "style": {"--window-width": "auto"}, "ondragover": () => w.focus(), "onclose": (e: Event) => {
		if (removes.size > 0 || Object.keys(changes).length > 0) {
			e.preventDefault();
			w.confirm(lang["ARE_YOU_SURE"], lang["UNSAVED_CHANGES"]).then(t => {
				if (t) {
					w.remove();
				}
			});
		}
	      }}),
	      nameUpdate = () => changes["name"] = {"user": nameVisibility.checked, "data": nameInput.value},
	      nameInput = input({"type": "text", "value": d["name"]?.["data"] ?? "", "onchange": nameUpdate}),
	      nameVisibility = input({"type": "checkbox", "class": userVisibility, "checked": d["name"]?.["user"] !== false, "onchange": nameUpdate}),
	      makeToken = (n: Uint, tk: {src: Uint}) => Object.assign({[node]: li({"class": tokenSelector}, (() => {
		return [
			button({"style": `background-image: url(${imageIDtoURL(tk["src"])})`, "onclick": function(this: HTMLButtonElement) {
				w.confirm(lang["TOKEN_REPLACE"], lang["TOKEN_REPLACE_CONFIRM"]).then(proceed => {
					if (proceed) {
						const data = getToken();
						if (!data) {
							w.alert(lang["TOKEN_SELECT"], lang["TOKEN_NONE_SELECTED"]);
							return;
						}
						changes["store-image-data"] = {"user": false, "data": cloneObject(Array.from(tokens.values()))};
						amendNode(this, {"style": `background-image: url(${imageIDtoURL(data["src"])})`});
					}
				});
			}}, lang["TOKEN_USE_SELECTED"]),
			removeSymbol({"onclick": () => w.confirm(lang["TOKEN_REMOVE"], lang["TOKEN_REMOVE_CONFIRM"]).then(proceed => {
				if (proceed) {
					tokens.delete(n);
					changes["store-image-data"] = {"user": false, "data": cloneObject(Array.from(tokens.values()))};
				}
			})})
		];
	      })())}, tk),
	      tokens = new NodeMap(ul({"class": tokenSelectors}), noSort, (d["store-image-data"] ? d["store-image-data"].data instanceof Array ? d["store-image-data"].data : [d["store-image-data"].data] : []).map((tk, n) => [n, makeToken(n, tk)])),
	      base = div([
		labels([lang["NAME"], ": "], nameInput),
		labels(nameVisibility, userVisible()),
		br(),
		character ? [
			label([lang["CHARACTER_IMAGE"], ": "]),
			div({"style": "overflow: hidden; display: inline-block; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": imageDragEffect, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
				const {id} = dragImage.get(e)!;
				changes["store-image-icon"] = {"user": d["store-image-icon"].user, "data": id};
				clearNode(this, img({"src": imageIDtoURL(id), "style": "max-width: 100%; max-height: 100%"}));
			}}, img({"src": imageIDtoURL(d["store-image-icon"].data), "style": "max-width: 100%; max-height: 100%"})),
			br(),
			label([lang["TOKEN"], ": "]),
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
			label([lang["TOKEN_ORDER"], ": "]),
			labels(input({"type": "radio", "name": `tokens_ordered_${n}`, "class": settingsTicker, "checked": !d["tokens_order"]?.data, "onclick": () => changes["tokens_order"] = {"user": false, "data": false}}), [lang["TOKEN_ORDER_NORMAL"], ": "]),
			labels(input({"type": "radio", "name": `tokens_ordered_${n++}`, "class": settingsTicker, "checked": d["tokens_order"]?.data, "onclick": () => changes["tokens_order"] = {"user": false, "data": true}}), [lang["TOKEN_ORDER_SHUFFLE"], ": "])
		] : [
			label([lang["CHARACTER"], ": "]),
			div({"style": "overflow: hidden; display: inline-block; width: 200px; height: 200px; border: 1px solid #888; text-align: center", "ondragover": characterDragEffect, "ondrop": function(this: HTMLDivElement, e: DragEvent) {
				const {id} = dragCharacter.get(e)!,
				      charData = characterData.get(id)!;
				changes["store-character-id"] = {"user": true, "data": id};
				clearNode(this, img({"src": imageIDtoURL(charData["store-image-icon"].data), "style": "max-width: 100%; max-height: 100%; cursor: pointer", "onclick": () => edit(id, lang["CHARACTER_EDIT"], charData, true)}));
			}}, d["store-character-id"] ? img({"src": imageIDtoURL(characterData.get(d["store-character-id"].data)!["store-image-icon"].data), "style": "max-width: 100%; max-height: 100%; cursor: pointer", "onclick": () => edit(d["store-character-id"].data, lang["CHARACTER_EDIT"], characterData.get(d["store-character-id"].data)!, true)}) : [])
		]
	      ]),
	      onEnd = characterEdit(base, id, d, character, changes, removes, w);
	let nextID = tokens.size;
	amendNode(shell, autoFocus(amendNode(w, amendNode(base, button({"onclick": function(this: HTMLButtonElement) {
		amendNode(this, {"disabled": true});
		if (lastMapChanged !== mapChanged && !character) {
			w.remove();
			shell.alert(lang["MAP_CHANGED"], lang["MAP_CHANGED_LONG"]);
			throw new Error("map changed");
		}
		const rms = Array.from(removes.values()).filter(k => {
			delete changes[k];
			return d[k] !== undefined;
		      }),
		      cs: Record<string, KeystoreData> = {},
		      keys = Object.keys(changes).filter(k => {
			const old = d[k];
			if (old && old.user === changes[k].user && old.data === changes[k].data) {
				delete changes[k];
				return false;
			}
			cs[k] = changes[k];
			return true;
		      });
		loadingWindow((character ? (doCharacterModify(id, cs, rms), rpc.characterModify(id, cs, rms)) : doTokenModify(id, cs, rms)).then(() => {
			onEnd();
			for (const k of keys) {
				delete changes[k];
			}
			removes.clear();
			amendNode(this, {"disabled": false});
		}), w);
	}}, lang["SAVE"])))));
};

const doCharacterModify = (id: Uint, changes: Record<string, KeystoreData>, removes: string[]) => {
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
      },
      characterDragEffect = setDragEffect({"link": [dragCharacter]}),
      imageDragEffect = setDragEffect({"link": [dragImage]}),
      [userVisibility, tokenSelectors, showCharacter] = ids(3);

inited.then(() => {
	rpc.waitCharacterDataChange().when(({id, setting, removing}) => doCharacterModify(id, setting, removing));
	mapLoadedReceive(() => lastMapChanged = Date.now());
	add({
		[`.${userVisibility}`]: {
			"display": "none",
			"+label>svg": {
				"display": "inline-block",
				"width": "1em",
				"height": "1em"
			},
			":not(:checked)+label>svg": {
				"--check-on": "none",
				"--check-off": "block"
			}
		},
		[`.${tokenSelectors}`]: {
			"margin": 0,
			"list-style": "none"
		},
		[`.${tokenSelector}`]: {
			"overflow": "hidden",
			">button": {
				"background-color": "transparent",
				"background-size": "cover",
				"background-repeat": "no-repeat",
				"width": "200px",
				"height": "200px",
				"color": "#000",
				"text-shadow": "#fff 0 0 5px"
			},
			">img": {
				"max-width": "200px",
				"max-height": "200px"
			},
			">svg": {
				"width": "2em",
				"height": "2em",
				"cursor": "pointer"
			}
		},
		[`.${showCharacter}>div`]: {
			"max-height": "90vh",
			"overflow-y": "scroll"
		}
	});
});
