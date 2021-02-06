import {HTTPRequest} from './lib/conn.js';
import {createHTML, button, br, h1, input, label, select, option} from './lib/html.js';
import {BoolSetting, IntSetting} from './settings_types.js';
import {settings as pluginSettings} from './plugins.js';
import lang, {language, languages} from './language.js';
import help from './help.js';
import {shell} from './windows.js';

export const autosnap = new BoolSetting("autosnap"),
hideMenu = new BoolSetting("menuHide"),
scrollAmount = new IntSetting("scrollAmount"),
undoLimit = new IntSetting("undoLimit", "100"),
invert = new BoolSetting("invert"),
measureTokenMove = new BoolSetting("measureTokenMove"),
miniTools = new BoolSetting("miniTools"),
zoomSlider = new BoolSetting("zoomSlider");

export default function (base: HTMLElement, loggedIn: boolean) {
	createHTML(base, [
		button({"onclick": help}, lang["HELP_OPEN"]),
		h1(lang["AUTH"]),
		loggedIn ? button({"onclick": () => HTTPRequest("login/logout").then(() => window.location.reload())}, lang["LOGOUT"]) : button({"onclick": () => HTTPRequest("login/login").then(() => window.location.reload())}, lang["LOGIN"]),
		br(),
		h1(lang["LANGUAGE"]),
		label({"for": "language_select"}, `${lang["SELECT_LANGUAGE"]}: `),
		select({"id": "language_select", "onchange": function(this: HTMLSelectElement) {
			language.set(this.value);
		}}, languages.map(l => option({"selected": l === language.value}, l))),
		h1(lang["THEME"]),
		button({"onclick": function(this: HTMLButtonElement) {
			const v = !invert.value;
			invert.set(v);
			this.innerText = v ? lang["LIGHT_MODE"] : lang["DARK_MODE"];
		}}, invert.value ? lang["LIGHT_MODE"] : lang["DARK_MODE"]),
		h1(lang["MAP_SETTINGS"]),
		loggedIn ? [
			input({"type": "checkbox", "id": "autosnap", "class": "settings_ticker", "checked": autosnap.value, "onchange": function(this: HTMLInputElement) {
				autosnap.set(this.checked);
			}}),
			label({"for": "autosnap"}, `${lang["AUTOSNAP"]}: `),
			br(),
			input({"type": "checkbox", "id": "measureTokenMove", "class": "settings_ticker", "checked": measureTokenMove.value, "onchange": function(this: HTMLInputElement) {
				measureTokenMove.set(this.checked);
			}}),
			label({"for": "measureTokenMove"}, `${lang["MEASURE_TOKEN_MOVE"]}: `),
			br(),
			input({"type": "checkbox", "id": "miniTools", "class": "settings_ticker", "checked": miniTools.value, "onchange": function(this: HTMLInputElement) {
				miniTools.set(this.checked);
			}}),
			label({"for": "miniTools"}, `${lang["MINI_TOOLS"]}: `),
			br()
		] : [],
		input({"type": "checkbox", "id": "hideZoomSlider", "class": "settings_ticker", "checked": zoomSlider.value, "onchange": function(this: HTMLInputElement) {
			zoomSlider.set(this.checked);
		}}),
		label({"for": "hideZoomSlider"}, `${lang["ZOOM_SLIDER_HIDE"]}: `),
		br(),
		label({"for": "scrollAmount"}, `${lang["SCROLL_AMOUNT"]}: `),
		input({"id": "scrollAmount", "type": "number", "value": scrollAmount.value, "step": 1, "onchange": function(this: HTMLInputElement) {
			scrollAmount.set(parseInt(this.value));
		}}),
		br(),
		loggedIn ? [
			label({"for": "undoLimit"}, `${lang["UNDO_LIMIT"]}: `),
			input({"id": "undoLimit", "type": "number", "value": undoLimit.value, "step": 1, "min": "-1", "onchange": function(this: HTMLInputElement) {
				undoLimit.set(parseInt(this.value));
			}}),
			br()
		] : [],
		input({"type": "checkbox", "id": "menuHide", "class": "settings_ticker", "checked": hideMenu.value, "onchange": function(this: HTMLInputElement) {
			hideMenu.set(this.checked);
		}}),
		label({"for": "menuHide"}, `${lang["HIDE_MENU"]}: `),
		pluginSettings(),
		h1(lang["SETTINGS_RESET"]),
		button({"onclick": () => shell.confirm(lang["ARE_YOU_SURE"], lang["SETTINGS_RESET_CONFIRM"]).then(v => {
			if (!v) {
				return;
			}
			window.localStorage.clear();
			window.location.reload();
		})}, lang["SETTINGS_CLEAR"])
	]);
};
