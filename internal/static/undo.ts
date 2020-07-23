import {undoLimit} from './settings.js';

type Fn = () => Fn;

const undoList: Fn[] = [],
      redoList: Fn[] = [];

export const clearUndo = () => {
	undoList.splice(0, undoList.length);
	redoList.splice(0, redoList.length);
},
addUndo = (fn: Fn) => {
	const undo = fn();
	redoList.splice(0, redoList.length);
	if (undoLimit.value === 0) {
		undoList.splice(0, undoList.length);
		return;
	}
	while (undoLimit.value !== -1 && undoList.length >= undoLimit.value) {
		undoList.shift();
	}
	undoList.push(undo);
},
undo = () => {
	const fn = undoList.pop();
	if (fn) {
		redoList.push(fn());
	}
},
redo = () => {
	const fn = redoList.pop();
	if (fn) {
		undoList.push(fn());
	}
};
