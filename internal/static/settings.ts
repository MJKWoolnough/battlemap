import {svgNS} from './lib/dom.js';
import {button, br, div, form, h1, input, select, option} from './lib/html.js';
import {BoolSetting, IntSetting} from './settings_types.js';
import {settings as pluginSettings} from './plugins.js';
import lang, {language, languages} from './language.js';
import help from './help.js';
import {shell} from './windows.js';
import {checkInt, labels, menuItems} from './shared.js';
import {isAdmin} from './rpc.js';

export const [autosnap, hideMenu, invert, miniTools, tabIcons, zoomSlider, panelOnTop, measureTokenMove] = ["autosnap", "menuHide", "invert", "miniTools", "tabIcons", "zoomSlider", "panelOnTop", "measureTokenMove"].map(n => new BoolSetting(n)),
scrollAmount = new IntSetting("scrollAmount"),
undoLimit = new IntSetting("undoLimit", "100"),
hiddenLayerOpacity = new IntSetting("hiddenLayerOpacity", "128"),
hiddenLayerSelectedOpacity = new IntSetting("hiddenLayerSelectedOpacity", "128");

menuItems.push([7, () => [
	lang["TAB_SETTINGS"],
	div([
		button({"onclick": help}, lang["HELP_OPEN"]),
		h1(lang["AUTH"]),
		form({"action": isAdmin ? "login/logout" : "login/login"}, input({"type": "submit", "value": lang[isAdmin ? "LOGOUT" : "LOGIN"]})),
		br(),
		h1(lang["LANGUAGE"]),
		labels(`${lang["SELECT_LANGUAGE"]}: `, select({"onchange": function(this: HTMLSelectElement) {
			language.set(this.value);
		}}, languages.map(l => option({"selected": l === language.value}, l)))),
		h1(lang["THEME"]),
		labels(`${lang["DARK_MODE"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": invert.value, "onchange": function(this: HTMLInputElement) {
			invert.set(this.checked);
		}}), false),
		br(),
		labels(`${lang["TAB_ICONS"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": tabIcons.value, "onchange": function(this: HTMLInputElement) {
			tabIcons.set(this.checked);
		}}), false),
		br(),
		labels(`${lang["PANEL_ON_TOP"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": panelOnTop.value, "onchange": function(this: HTMLInputElement) {
			panelOnTop.set(this.checked);
		}}), false),
		isAdmin ? [
			br(),
			labels(`${lang["MINI_TOOLS"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": miniTools.value, "onchange": function(this: HTMLInputElement) {
				miniTools.set(this.checked);
			}}), false)
		] : [],
		h1(lang["MAP_SETTINGS"]),
		isAdmin ? [
			labels(`${lang["AUTOSNAP"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": autosnap.value, "onchange": function(this: HTMLInputElement) {
				autosnap.set(this.checked);
			}}), false),
			br(),
			labels(`${lang["MEASURE_TOKEN_MOVE"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": measureTokenMove.value, "onchange": function(this: HTMLInputElement) {
				measureTokenMove.set(this.checked);
			}}), false),
			br(),
		] : [],
		labels(`${lang["ZOOM_SLIDER_HIDE"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": zoomSlider.value, "onchange": function(this: HTMLInputElement) {
			zoomSlider.set(this.checked);
		}}), false),
		br(),
		labels(`${lang["SCROLL_AMOUNT"]}: `, input({"type": "number", "value": scrollAmount.value, "step": 1, "onchange": function(this: HTMLInputElement) {
			scrollAmount.set(checkInt(parseInt(this.value)) );
		}})),
		br(),
		isAdmin ? [
			labels(`${lang["UNDO_LIMIT"]}: `, input({"type": "number", "value": undoLimit.value, "step": 1, "min": "-1", "onchange": function(this: HTMLInputElement) {
				undoLimit.set(checkInt(parseInt(this.value), -1));
			}})),
			br()
		] : [],
		labels(`${lang["HIDE_MENU"]}: `, input({"type": "checkbox", "class": "settings_ticker", "checked": hideMenu.value, "onchange": function(this: HTMLInputElement) {
			hideMenu.set(this.checked);
		}}), false),
		isAdmin ? [
			br(),
			labels(`${lang["LAYER_HIDDEN_OPACITY"]}: `, input({"type": "range", "min": 0, "max": 255, "value": checkInt(hiddenLayerOpacity.value, 0, 255, 128), "oninput": function(this: HTMLInputElement) {
				hiddenLayerOpacity.set(checkInt(parseInt(this.value), 0, 255, 128));
			}})),
			br(),
			labels(`${lang["LAYER_HIDDEN_SELECTED_OPACITY"]}: `, input({"type": "range", "min": 0, "max": 255, "value": checkInt(hiddenLayerSelectedOpacity.value, 0, 255, 128), "oninput": function(this: HTMLInputElement) {
				console.log(this.value);
				hiddenLayerSelectedOpacity.set(checkInt(parseInt(this.value), 0, 255, 128));
			}})),
		] : [],
		pluginSettings(),
		h1(lang["SETTINGS_RESET"]),
		button({"onclick": () => shell.confirm(lang["ARE_YOU_SURE"], lang["SETTINGS_RESET_CONFIRM"]).then(v => {
			if (!v) {
				return;
			}
			window.localStorage.clear();
			window.location.reload();
		})}, lang["SETTINGS_CLEAR"])
	]),
	false,
	`data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cg fill="none"%3E%3Ccircle cx="50" cy="50" r="35" stroke="%23ccc" stroke-width="10" fill="none" /%3E%3Ccircle cx="50" cy="50" r="5" stroke="%23ccc" stroke-width="2" fill="none" /%3E%3C/g%3E%3Cpath id="settings-spoke" d="M35,15 l5,-15 h20 l5,15" fill="%23ccc" /%3E%3Cuse href="%23settings-spoke" transform="rotate(60, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(120, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(180, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(240, 50, 50)" /%3E%3Cuse href="%23settings-spoke" transform="rotate(300, 50, 50)" /%3E%3Cpath d="M21.5,33.5 L46,47.5 M50,81 L50,55 M78.5,33.5 L54,47.5" stroke="%23ccc" stroke-width="2" /%3E%3C/svg%3E`
]]);
