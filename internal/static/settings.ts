import {HTTPRequest} from './lib/conn.js';
import {Pipe} from './lib/inter.js';
import {createHTML, button, br, h1, input, label, select, option} from './lib/html.js';
import {Int, RPC} from './types.js';
import {ShellElement} from './windows.js';
import {BoolSetting, IntSetting} from './settings_types.js';
import {settings as pluginSettings} from './plugins.js';
import {language, languages} from './language.js';

export const autosnap = new BoolSetting("autosnap"),
hideMenu = new BoolSetting("menuHide"),
scrollAmount = new IntSetting("scrollAmount"),
undoLimit = new IntSetting("undoLimit", "100"),
invert = new BoolSetting("invert");

export default function (rpc: RPC, shell: ShellElement, base: HTMLElement, loggedIn: boolean) {
	createHTML(base, [
		h1("Authentication"),
		loggedIn ? button({"onclick": () => HTTPRequest("login/logout").then(() => window.location.reload())}, "Logout") : button({"onclick": () => HTTPRequest("login/login").then(() => window.location.reload())}, "Login"),
		br(),
		h1("Language"),
		label({"for": "language_select"}, "Select Language: "),
		select({"id": "language_select", "onchange": function(this: HTMLSelectElement) {
			language.set(this.value);
		}}, languages.map(l => option({"selected": l === language.value}, l))),
		h1("Theme"),
		button({"onclick": function(this: HTMLButtonElement) {
			this.innerText = invert.set(!invert.value) ? "Light Mode" : "Dark Mode"
		}}, invert.value ? "Light Mode" : "Dark Mode"),
		h1("Map Settings"),
		loggedIn ? [
			input({"type": "checkbox", "id": "autosnap", "class": "settings_ticker", "checked": autosnap.value, "onchange": function(this: HTMLInputElement) {
				autosnap.set(this.checked);
			}}),
			label({"for": "autosnap"}, "Autosnap: "),
			br()
		] : [],
		label({"for": "scrollAmount"}, "Scroll (zero is square width): "),
		input({"id": "scrollAmount", "type": "number", "value": scrollAmount.value, "step": 1, "onchange": function(this: HTMLInputElement) {
			scrollAmount.set(parseInt(this.value));
		}}),
		br(),
		label({"for": "undoLimit"}, "Undo Limit (-1 for infinite, 0 to disable): "),
		input({"id": "undoLimit", "type": "number", "value": undoLimit.value, "step": 1, "min": "-1", "onchange": function(this: HTMLInputElement) {
			undoLimit.set(parseInt(this.value));
		}}),
		br(),
		input({"type": "checkbox", "id": "menuHide", "class": "settings_ticker", "checked": hideMenu.value, "onchange": function(this: HTMLInputElement) {
			hideMenu.set(this.checked);
		}}),
		label({"for": "menuHide"}, "Hide Menu Button?: "),
		pluginSettings(),
		h1("Reset"),
		button({"onclick": () => shell.confirm("Are you sure?", "Are you sure that you wish to clear all settings? This cannot be undone").then(v => {
			if (!v) {
				return;
			}
			window.localStorage.clear();
			window.location.reload();
		})}, "Clear All Settings")
	]);
};
