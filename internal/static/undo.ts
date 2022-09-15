import {amendNode} from './lib/dom.js';
import {button, h1, li, ul} from './lib/html.js';
import {NodeArray, node} from './lib/nodes.js';
import {BoolSetting} from './lib/settings.js';
import lang from './language.js';
import {inited, isAdmin} from './rpc.js';
import {undoLimit} from './settings.js';
import {queue} from './shared.js';
import {shell, windows} from './windows.js';

type Fn = () => Fn;

type FnDesc = {
	fn: Fn;
	[node]: HTMLLIElement;
}

const undos = new NodeArray<FnDesc>(ul()),
      redos = new NodeArray<FnDesc>(ul()),
      undoObj = {
	"add": (fn: Fn, description: string) => {
		queue(async () => {
			redos.splice(0, redos.length);
			if (undoLimit.value === 0) {
				undos.splice(0, undos.length);
				return;
			}
			if (undoLimit.value !== -1 && undos.length >= undoLimit.value) {
				undos.splice(0, undos.length - undoLimit.value);
			}
			undos.push({
				fn,
				[node]: li(description)
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
      };

inited.then(() => {
	if (!isAdmin) {
		return;
	}
	const showWindow = new BoolSetting("undo-window-show").wait(v => {
			if (v) {
				amendNode(shell, w);
			}
	      }),
	      w = windows({"window-title": lang["UNDO_WINDOW_TITLE"], "style": "--window-left: 0px; --window-top: 0px; --window-width: 200px; --window-height: 600px", "window-data": "undo-window-settings", "resizable": true, "onremove": () => showWindow.set(false)}, [
		button({"onclick": undoObj.undo}, lang["UNDO_UNDO"]),
		button({"onclick": undoObj.redo}, lang["UNDO_REDO"]),
		h1(lang["UNDO_WINDOW_UNDOS"]),
		undos[node],
		h1(lang["UNDO_WINDOW_REDOS"]),
		redos[node]
	      ]);


	Object.defineProperty(window, "showUndoWindow", {"value": () => showWindow.set(true)});
});

export default undoObj;
