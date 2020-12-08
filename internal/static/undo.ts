import {Int} from './types.js';
import {undoLimit} from './settings.js';
import {SortNode} from './lib/ordered.js';
import {ul, li} from './lib/html.js';

type Fn = () => Fn;

type FnDesc = {
	fn: Fn
	node: HTMLLIElement;
};

type undoData = {
	undos: Fn[];
	redos: Fn[];
	limit: Int;
}

const undos = new SortNode<FnDesc>(ul()),
      redos = new SortNode<FnDesc>(ul());

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
