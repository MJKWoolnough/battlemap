import type {Uint} from './types.js';

type KeyFn = (e: KeyboardEvent) => void;

let nextID = 0;

const held = new Set<string>(),
      downs = new Map<string, Map<Uint, [KeyFn, boolean]>>(),
      ups = new Map<string, Map<Uint, [KeyFn, boolean]>>(),
      ke = (event: "down" | "up", key: string) => new KeyboardEvent(`key${event}`, {
	key,
	"ctrlKey": held.has("Control"),
	"shiftKey": held.has("Shift"),
	"altKey": held.has("Alt"),
	"metaKey": held.has("OS")
      });

window.addEventListener("keydown", (e: KeyboardEvent) => {
	const {key, target}= e;
	if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
		return;
	}
	const events = downs.get(key);
	if (events) {
		for (const [id, [event, once]] of events) {
			event(e);
			if (once) {
				events.delete(id);
			}
		}
	}
	held.add(key);
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
	const {key} = e;
	if (!held.has(key)) {
		return;
	}
	const events = ups.get(key);
	if (events) {
		for (const [id, [event, once]] of events) {
			event(e);
			if (once) {
				events.delete(id);
			}
		}
	}
	held.delete(key);
});

window.addEventListener("blur", () => {
	for (const key of held) {
		const events = ups.get(key);
		if (events && events.size) {
			const k = ke("up", key);
			for (const [id, [event, once]] of events) {
				event(k);
				if (once) {
					events.delete(id);
				}
			}
		}
		held.delete(key);
	}
});

export default function(key: string, onkeydown?: KeyFn, onkeyup?: KeyFn, now = false, once = false) {
	const id = nextID++;
	if (onkeydown) {
		if (now && held.has(key)) {
			onkeydown(ke("down", key));
		}
		if (!now || !once) {
			let m = downs.get(key);
			if (!m) {
				downs.set(key, m = new Map());
			}
			m.set(id, [onkeydown, once]);
		}
	}
	if (onkeyup) {
		let m = ups.get(key);
		if (!m) {
			ups.set(key, m = new Map());
		}
		m.set(id, [onkeyup, once]);
	}
	return (run?: true) => {
		if (run && held.has(key)) {
			ups.get(key)?.get(id)?.[0](ke("up", key));
		}
		downs.get(key)?.delete(id);
		ups.get(key)?.delete(id);
	};
}
