import {Int, Uint} from './types.js';
import {undoLimit} from './settings.js';
import {SortNode} from './lib/ordered.js';
import {ul, li, h1} from './lib/html.js';
import {BoolSetting} from './settings_types.js';
import {isInt, isUint, requestShell, queue} from './misc.js';
import {WindowElement, windows} from './windows.js';
import lang from './language.js';

type Fn = () => Fn;

type FnDesc = {
	fn: Fn
	node: HTMLLIElement;
};

const undos = new SortNode<FnDesc>(ul()),
      redos = new SortNode<FnDesc>(ul()),
      showWindow = new BoolSetting("undo-window-show"),
      w = windows({"window-title": lang["UNDO_WINDOW_TITLE"], "--window-left": "0px", "--window-top": "0px", "--window-width": "200px", "--window-height": "600px", "window-data": "undo-window-settings", "resizable": true, "onremove": () => showWindow.set(false)}, [
	h1(lang["UNDO_WINDOW_UNDOS"]),
	undos.node,
	h1(lang["UNDO_WINDOW_REDOS"]),
	redos.node
      ]);

if (showWindow.value) {
	window.setTimeout(() => requestShell().appendChild(w), 0);
}

Object.defineProperty(window, "showUndoWindow", {
	"value": () => {
		showWindow.set(true);
		requestShell().appendChild(w);
	}
});

export default {
	"add": (fn: Fn, description: string) => {
		queue(async () => {
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
		});
	},
	"clear": () => {
		queue(async () => {
			undos.splice(0, undos.length);
			redos.splice(0, redos.length);
		});
	},
	"undo": () => {
		queue(async () => {
			const fnDesc = undos.pop();
			if (fnDesc) {
				fnDesc.fn = fnDesc.fn();
				redos.unshift(fnDesc);
			}
		});
	},
	"redo": () => {
		queue(async () => {
			const fnDesc = redos.shift();
			if (fnDesc) {
				fnDesc.fn = fnDesc.fn();
				undos.push(fnDesc);
			}
		});
	}
}
