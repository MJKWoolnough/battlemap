import {add, id} from './lib/css.js';
import {amendNode, clearNode} from './lib/dom.js';
import {br, button, details, div, form, h1, input, li, option, select, span, summary, ul} from './lib/html.js';
import {BoolSetting, IntSetting} from './lib/settings.js';
import {ns as svgNS} from './lib/svg.js';
import help from './help.js';
import {getKey, getKeyIDs, getKeyName, setKey} from './keys.js';
import lang, {language, languages} from './language.js';
import {settings as pluginSettings} from './plugins.js';
import {isAdmin} from './rpc.js';
import {labels, menuItems} from './shared.js';
import {removeStr} from './symbols.js';
import {shell, windows} from './windows.js';

export const [autosnap, hideMenu, invert, miniTools, tabIcons, zoomSlider, panelOnTop, measureTokenMove, enableAnimation, musicSort] = ["autosnap", "menuHide", "invert", "miniTools", "tabIcons", "zoomSlider", "panelOnTop", "measureTokenMove", "enableAnimation", "musicSort"].map(n => new BoolSetting(n)),
scrollAmount = new IntSetting("scrollAmount"),
undoLimit = new IntSetting("undoLimit", 100, -1),
[hiddenLayerOpacity, hiddenLayerSelectedOpacity] = ["hiddenLayerOpacity", "hiddenLayerSelectedOpacity"].map(n => new IntSetting(n, 128, 0, 255)),
settingsTicker = id();

const settings = id();

add(`.${settingsTicker}`, {
	"display": "none",
	"[disabled]+label": {
		"color": "#888",
		":after": {
			"background-image": "none !important"
		}
	},
	"+label:after": {
		"width": "1.2em",
		"height": "1em",
		"display": "inline-block",
		"content": `""`,
		"background-repeat": "no-repeat",
		"background-size": "1em",
		"background-position": "bottom center",
		"background-image": `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 10"%3E%3Cpath d="M2,1 q5,6 8,8 M2,9 q5,-3 8,-8" stroke="%23f00" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="2" /%3E%3C/svg%3E')`
	},
	":checked+label:after": {
		"background-image": `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 10"%3E%3Cpath d="M1,6 l3,3 7,-8" stroke="%230f0" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="2" /%3E%3C/svg%3E')`
	},
	"[type=radio]:checked+label:after": {
		"background-image": `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 10"%3E%3Cpath d="M1,6 l3,3 7,-8" stroke="%2300f" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="2" /%3E%3C/svg%3E')`
	}
});
add(`#${settings}`, {
	" h1": {
		"display": "inline-block"
	},
	" ul": {
		"list-style": "none",
		"padding": 0
	}
});

menuItems.push([7, () => [
	lang["TAB_SETTINGS"],
	div({"id": settings}, [
		button({"onclick": help}, lang["HELP_OPEN"]),
		br(),
		h1(lang["SETTINGS_AUTH"]),
		form({"action": isAdmin ? "login/logout" : "login/login"}, input({"type": "submit", "value": lang[isAdmin ? "LOGOUT" : "LOGIN"]})),
		br(),
		details([
			summary(h1(lang["SETTINGS_LANGUAGE"])),
			labels(`${lang["SETTINGS_LANGUAGE_SELECT"]}: `, select({"onchange": function(this: HTMLSelectElement) {
				language.set(this.value);
			}}, languages.map(l => option({"selected": l === language.value}, l))))
		]),
		details([
			summary(h1(lang["SETTINGS_THEME"])),
			labels(input({"type": "checkbox", "class": settingsTicker, "checked": invert.value, "onchange": function(this: HTMLInputElement) {
				invert.set(this.checked);
			}}), `${lang["SETTINGS_DARK_MODE"]}: `),
			br(),
			labels(input({"type": "checkbox", "class": settingsTicker, "checked": tabIcons.value, "onchange": function(this: HTMLInputElement) {
				tabIcons.set(this.checked);
			}}), `${lang["SETTINGS_TAB_ICONS"]}: `),
			br(),
			labels(input({"type": "checkbox", "class": settingsTicker, "checked": panelOnTop.value, "onchange": function(this: HTMLInputElement) {
				panelOnTop.set(this.checked);
			}}), `${lang["SETTINGS_PANEL_ON_TOP"]}: `),
			br(),
			labels(input({"type": "checkbox", "class": settingsTicker, "checked": hideMenu.value, "onchange": function(this: HTMLInputElement) {
				hideMenu.set(this.checked);
			}}), `${lang["SETTINGS_HIDE_MENU"]}: `),
			br(),
			labels(input({"type": "checkbox", "class": settingsTicker, "checked": zoomSlider.value, "onchange": function(this: HTMLInputElement) {
				zoomSlider.set(this.checked);
			}}), `${lang["SETTINGS_ZOOM_SLIDER_HIDE"]}: `),
			isAdmin ? [
				br(),
				labels(input({"type": "checkbox", "class": settingsTicker, "checked": miniTools.value, "onchange": function(this: HTMLInputElement) {
					miniTools.set(this.checked);
				}}), `${lang["SETTINGS_MINI_TOOLS"]}: `),
				br(),
				labels(input({"type": "checkbox", "class": settingsTicker, "checked": musicSort.value, "onchange": function(this: HTMLInputElement) {
					musicSort.set(this.checked);
				}}), `${lang["SETTINGS_MUSIC_SORT"]}: `)
			] : []
		]),
		details([
			summary(h1(lang["SETTINGS_MAP"])),
			isAdmin ? [
				labels(input({"type": "checkbox", "class": settingsTicker, "checked": autosnap.value, "onchange": function(this: HTMLInputElement) {
					autosnap.set(this.checked);
				}}), `${lang["SETTINGS_AUTOSNAP"]}: `),
				br(),
				labels(input({"type": "checkbox", "class": settingsTicker, "checked": measureTokenMove.value, "onchange": function(this: HTMLInputElement) {
					measureTokenMove.set(this.checked);
				}}), `${lang["SETTINGS_MEASURE_TOKEN_MOVE"]}: `),
				br()
			] : [],
			labels(`${lang["SETTINGS_SCROLL_AMOUNT"]}: `, input({"type": "number", "value": scrollAmount.value, "step": 1, "onchange": function(this: HTMLInputElement) {
				scrollAmount.set(parseInt(this.value));
			}})),
			br(),
			isAdmin ? [
				labels(`${lang["SETTINGS_UNDO_LIMIT"]}: `, input({"type": "number", "value": undoLimit.value, "step": 1, "min": -1, "onchange": function(this: HTMLInputElement) {
					undoLimit.set(parseInt(this.value));
				}})),
				br()
			] : [],
			labels(input({"type": "checkbox", "class": settingsTicker, "checked": enableAnimation.value, "onchange": function(this: HTMLInputElement) {
				enableAnimation.set(this.checked);
			}}), `${lang["SETTINGS_ENABLE_ANIMATION"]}: `),
			isAdmin ? [
				br(),
				labels(`${lang["SETTINGS_LAYER_HIDDEN_OPACITY"]}: `, input({"type": "range", "min": 0, "max": 255, "value": hiddenLayerOpacity.value, "oninput": function(this: HTMLInputElement) {
					hiddenLayerOpacity.set(parseInt(this.value));
				}})),
				br(),
				labels(`${lang["SETTINGS_LAYER_HIDDEN_SELECTED_OPACITY"]}: `, input({"type": "range", "min": 0, "max": 255, "value": hiddenLayerSelectedOpacity.value, "oninput": function(this: HTMLInputElement) {
					hiddenLayerSelectedOpacity.set(parseInt(this.value));
				}}))
			] : []
		]),
		pluginSettings(),
		details({"id": "settings_keys"}, [
			summary(h1(lang["SETTINGS_KEYS"])),
			div(lang["SETTINGS_KEYS_EXPLAIN"]),
			ul(getKeyIDs().map(id => li(labels(`${getKeyName(id)}: `, button({"onclick": function(this: HTMLButtonElement) {
				let mod = "";
				const mods = span(),
				      updateMods = (e: KeyboardEvent) => {
					clearNode(mods, mod = (e.ctrlKey ? "Ctrl+" : "") + (e.altKey ? "Alt+" : "") + (e.shiftKey ? "Shift+" : "") + (e.metaKey ? "Meta+" : ""));
				      },
				      w = windows({"window-title": lang["SETTINGS_KEYS_NEW"], "onkeydown": (e: KeyboardEvent) => {
					switch (e.key) {
					default:
						e.stopPropagation();
						setKey(id, mod + e.key);
						clearNode(this, mod + e.key);
						w.close();
					case "OS":
					case "Meta":
					case "Shift":
					case "Control":
					case "Alt":
						updateMods(e);
					}
				      }, "onkeyup": updateMods}, [lang["SETTINGS_KEYS_NEW"], br(), mods]);
				w.addControlButton(removeStr, () => {
					setKey(id);
					clearNode(this, "\u202f");
					w.close();
				}, lang["SETTINGS_KEYS_DELETE"]);
				amendNode(shell, w);
			}}, getKey(id) || "\u202f")))))
		]),
		details([
			summary(h1(lang["SETTINGS_RESET"])),
			button({"onclick": () => shell.confirm(lang["ARE_YOU_SURE"], lang["SETTINGS_RESET_CONFIRM"]).then(v => {
				if (v) {
					window.localStorage.clear();
					window.location.reload();
				}
			})}, lang["SETTINGS_CLEAR"])
		])
	]),
	false,
	`data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cg fill="none"%3E%3Ccircle cx="50" cy="50" r="35" stroke="%23ccc" stroke-width="10" fill="none" /%3E%3Ccircle cx="50" cy="50" r="5" stroke="%23ccc" stroke-width="2" fill="none" /%3E%3C/g%3E%3Cpath id="settings-spoke" d="M35,15 l5,-15 h20 l5,15" fill="%23ccc" /%3E%3Cuse href="%23settings-spoke" transform="rotate(60, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(120, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(180, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(240, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(300, 50, 50)" /%3E%3Cpath d="M21.5,33.5 L46,47.5 M50,81 L50,55 M78.5,33.5 L54,47.5" stroke="%23ccc" stroke-width="2" /%3E%3C/svg%3E`
]]);
