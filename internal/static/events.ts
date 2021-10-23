import type {Uint} from './types.js';

type KeyFn = (e: KeyboardEvent) => void;

type MouseFn = (e: MouseEvent) => void;

let nextKeyID = 0,
    nextMouseID = 0;

const held = new Set<string>(),
      downs = new Map<string, Map<Uint, [KeyFn, boolean]>>(),
      ups = new Map<string, Map<Uint, [KeyFn, boolean]>>(),
      ke = (event: "down" | "up", key: string) => new KeyboardEvent(`key${event}`, {
	key,
	"ctrlKey": held.has("Control"),
	"shiftKey": held.has("Shift"),
	"altKey": held.has("Alt"),
	"metaKey": held.has("OS")
      }),
      me = (button: 0 | 1 | 2) => new MouseEvent(`mouseup`, {
	button,
	"ctrlKey": held.has("Control"),
	"shiftKey": held.has("Shift"),
	"altKey": held.has("Alt"),
	"metaKey": held.has("OS")
      }),
      mouseMove = new Map<Uint, MouseFn>(),
      mouseUp = [
	      new Map<Uint, MouseFn>(),
	      new Map<Uint, MouseFn>(),
	      new Map<Uint, MouseFn>()
      ],
      keyEventFn = (down: boolean, e: KeyboardEvent) => {
	const {key, target} = e;
	if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || held.has(key) === down) {
		return;
	}
	const events = (down ? downs : ups).get(key);
	if (events) {
		for (const [id, [event, once]] of events) {
			event(e);
			if (once) {
				events.delete(id);
			}
		}
	}
	if (down) {
		held.add(key);
	} else {
		held.delete(key);
	}
      };

window.addEventListener("keydown", (e: KeyboardEvent) => keyEventFn(true, e));

window.addEventListener("keyup", (e: KeyboardEvent) => keyEventFn(false, e));

window.addEventListener("mousemove", (e: MouseEvent) => {
	for (const [, event] of mouseMove) {
		event(e);
	}
});

window.addEventListener("mouseup", (e: MouseEvent) => {
	const {button} = e;
	if (button !== 0 && button !== 1 && button !== 2) {
		return;
	}
	for (const [id, event] of mouseUp[button]) {
		event(e);
		mouseMove.delete(id);
	}
	mouseUp[button].clear();
});

window.addEventListener("blur", () => {
	for (const key of held) {
		const events = ups.get(key);
		if (events && events.size) {
			const e = ke("up", key);
			for (const [id, [event, once]] of events) {
				event(e);
				if (once) {
					events.delete(id);
				}
			}
		}
		held.delete(key);
	}
	for (let button = 0; button < 3; button++) {
		if (mouseUp[button].size) {
			const e = me(button as 0 | 1 | 2);
			for (const [, event] of mouseUp[button]) {
				event(e);
			}
			mouseUp[button].clear();
		}
	}
	mouseMove.clear();
});

export const keyEvent = (key: string, onkeydown?: KeyFn, onkeyup?: KeyFn, once = false) => {
	const id = nextKeyID++,
	      keydown: [KeyFn, boolean] = [onkeydown!, once],
	      keyup: [KeyFn, boolean] = [onkeyup!, once];
	return [
		() => {
			if (onkeydown) {
				const kh = held.has(key);
				if (kh) {
					onkeydown(ke("down", key));
				}
				if (!kh || !once) {
					let m = downs.get(key);
					if (!m) {
						downs.set(key, m = new Map());
					}
					m.set(id, keydown);
				}
			}
			if (onkeyup) {
				let m = ups.get(key);
				if (!m) {
					ups.set(key, m = new Map());
				}
				m.set(id, keyup);
			}
		},
		(now = true) => {
			const toRun = now && held.has(key) ? ups.get(key)?.get(id)?.[0] : null;
			downs.get(key)?.delete(id);
			ups.get(key)?.delete(id);
			toRun?.(ke("up", key));
		}
	];
},
mouseMoveEvent = (onmousemove: MouseFn) => {
	const id = nextMouseID++;
	return [
		() => mouseMove.set(id, onmousemove),
		() => mouseMove.delete(id)
	];
},
mouseDragEvent = (button: 0 | 1 | 2, onmousemove?: MouseFn, onmouseup: MouseFn = () => {}) => {
	const id = nextMouseID++;
	return [
		() => {
			if (onmousemove) {
				mouseMove.set(id, onmousemove);
			}
			mouseUp[button].set(id, onmouseup);
		},
		(run = true) => {
			const toRun = run ? mouseUp[button].get(id) : null;
			mouseMove.delete(id);
			mouseUp[button].delete(id);
			toRun?.(me(button));
		}
	];
};
