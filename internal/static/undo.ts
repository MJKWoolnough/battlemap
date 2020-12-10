import {Int, Uint} from './types.js';
import {undoLimit} from './settings.js';
import {SortNode} from './lib/ordered.js';
import {ul, li, h1} from './lib/html.js';
import {BoolSetting, JSONSetting} from './settings_types.js';
import {isInt, isUint, requestShell} from './misc.js';
import {WindowElement, windows} from './windows.js';
import lang from './language.js';

type Fn = () => Fn;

type FnDesc = {
	fn: Fn
	node: HTMLLIElement;
};

type WindowData = [Int, Int, Uint, Uint];

const undos = new SortNode<FnDesc>(ul()),
      redos = new SortNode<FnDesc>(ul()),
      undoWindowSettings = new JSONSetting<WindowData>("undo-window-settings", [0, 0, 200, 600], (v: any): v is WindowData => v instanceof Array && v.length === 4 && isInt(v[0]) && isInt(v[1]) && isUint(v[2]) && isUint(v[3])),
      showWindow = new BoolSetting("undo-window-show"),
      saveWindowData = function (this: WindowElement) {
	undoWindowSettings.set([parseInt(this.style.getPropertyValue("--window-left") || "0"), parseInt(this.style.getPropertyValue("--window-top") || "0"), parseInt(this.style.getPropertyValue("--window-width") || "200"), parseInt(this.style.getPropertyValue("--window-height") || "600")]);
      },
      w = windows({"window-title": lang["UNDO_WINDOW_TITLE"], "--window-left": undoWindowSettings.value[0] + "px", "--window-top": undoWindowSettings.value[1] + "px", "--window-width": undoWindowSettings.value[2] + "px", "--window-height": undoWindowSettings.value[3] + "px", "resizable": true, "onmoved": saveWindowData, "onresized": saveWindowData, "onexit": () => showWindow.set(false)}, [
	h1(lang["UNDO_WINDOW_UNDOS"]),
	undos.node,
	h1(lang["UNDO_WINDOW_REDOS"]),
	redos.node
      ]);

if (showWindow.value) {
	setTimeout(() => requestShell().appendChild(w), 0);
}

Object.defineProperty(window, "showUndoWindow", {
	"value": () => {
		showWindow.set(true);
		requestShell().appendChild(w);
	}
});

export default {
	"add": (fn: Fn, description: string) => {
		redos.splice(0, redos.length);
		if (undoLimit.value === 0) {
			undos.splice(0, undos.length);
			return;
		}
		while (undoLimit.value !== -1 && undos.length >= undoLimit.value) {
			undos.shift();
		}
		undos.push({
			fn,
			"node": li(description),
		});
	},
	"clear": () => {
		undos.splice(0, undos.length);
		redos.splice(0, redos.length);
	},
	"undo": () => {
		const fnDesc = undos.pop();
		if (fnDesc) {
			fnDesc.fn = fnDesc.fn();
			redos.unshift(fnDesc);
		}
	},
	"redo": () => {
		const fnDesc = redos.shift();
		if (fnDesc) {
			fnDesc.fn = fnDesc.fn();
			undos.push(fnDesc);
		}
	}
}
