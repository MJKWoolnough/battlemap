import {Int} from './types.js';
import {undoLimit} from './settings.js';

type Fn = () => Fn;

type FnDesc = [Fn, string];

type undoData = {
	undos: Fn[];
	redos: Fn[];
	limit: Int;
}

const undos: FnDesc[] = [],
      redos: FnDesc[] = [];

export default {
	"add": (undo: Fn, description = "") => {
		redos.splice(0, redos.length);
		if (undoLimit.value === 0) {
			undos.splice(0, undos.length);
			return;
		}
		while (undoLimit.value !== -1 && undos.length >= undoLimit.value) {
			undos.shift();
		}
		undos.push([undo, description]);
	},
	"clear": () => {
		undos.splice(0, undos.length);
		redos.splice(0, redos.length);
	},
	"undo": () => {
		const fnDesc = undos.pop();
		if (fnDesc) {
			fnDesc[0] = fnDesc[0]();
			redos.push(fnDesc);
		}
	},
	"redo": () => {
		const fnDesc = redos.pop();
		if (fnDesc) {
			fnDesc[0] = fnDesc[0]();
			undos.push(fnDesc);
		}
	}
}
