import type {MusicPack, MusicTrack, Int, Uint, SVGAnimateBeginElement} from './types.js';
import type {WindowElement} from './windows.js';
import {clearElement, svgNS} from './lib/dom.js';
import {createHTML, audio, br, div, button, h1, input, li, span, ul} from './lib/html.js';
import {svg, animate, path, rect, symbol, title} from './lib/svg.js';
import lang from './language.js';
import {NodeArray, node, stringSort, noSort} from './lib/nodes.js';
import {addSymbol, getSymbol} from './symbols.js';
import {rpc, inited, handleError} from './rpc.js';
import {windows, shell} from './windows.js';
import {audioAssetName, uploadAudio} from './assets.js';
import {checkInt} from './shared.js';

class Track {
	id: Uint;
	volume: Uint;
	repeat: Int;
	audioElement: HTMLAudioElement | null = null;
	repeatWait: Int = -1;
	parent: Pack;
	constructor(parent: Pack, track: MusicTrack) {
		this.id = track.id;
		this.volume = track.volume;
		this.repeat = track.repeat;
		this.parent = parent;
	}
	setVolume(volume: Uint) {
		this.volume = volume;
		this.updateVolume();
	}
	setRepeat(repeat: Int) {
		this.repeat = repeat;
		this.waitPlay();
	}
	play() {
		if (this.audioElement) {
			this.waitPlay()
			return;
		}
		this.audioElement = audio({"src": `/audio/${this.id}`, "1onloadeddata": () => {
			this.updateVolume();
			this.waitPlay();
		}, "onended": () => this.waitPlay()});
	}
	updateVolume() {
		if (this.audioElement) {
			this.audioElement.volume = this.volume * this.parent.volume / 65025
		}
	}
	waitPlay() {
		if (!this.audioElement) {
			return;
		}
		if (this.repeatWait !== -1) {
			window.clearTimeout(this.repeatWait);
			this.repeatWait = -1;
		}
		const tnow = now(),
		      length = this.audioElement.duration;
		if (this.repeat === -1) {
			if (tnow < this.parent.playTime + length) {
				this.audioElement.currentTime = tnow - this.parent.playTime;
				this.audioElement.play();
			} else {
				this.stop();
				this.parent.checkPlayState();
			}
		} else {
			const cycle = length + this.repeat,
			      p = (tnow - this.parent.playTime) % cycle;
			if (p < length) {
				this.audioElement.currentTime = p;
				this.audioElement.play();
			} else {
				this.audioElement.pause();
				this.repeatWait = window.setTimeout(() => {
					if (this.audioElement) {
						this.audioElement.play();
					}
					this.repeatWait = -1;
				}, (cycle - p) * 1000);
			}
		}
	}
	stop() {
		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement = null;
			if (this.repeatWait !== -1) {
				window.clearTimeout(this.repeatWait);
				this.repeatWait = -1;
			}
		}
	}
	remove() {
		const pos = this.parent.tracks.findIndex(t => t === this);
		this.parent.tracks.splice(pos, 1);
		this.stop();
		return pos;
	}
}

class Pack {
	tracks: Track[];
	volume: Uint;
	playTime: Uint;
	currentTime: Uint = 0;
	constructor(pack: MusicPack) {
		this.tracks = [];
		for (const track of pack.tracks) {
			this.tracks.push(new Track(this, track));
		}
		this.volume = pack.volume;
		this.playTime = pack.playTime;
		if (this.playTime !== 0) {
			window.setTimeout(() => this.play(this.playTime));
		}
	}
	setVolume(volume: Uint) {
		this.volume = volume;
		this.updateVolume();
	}
	play(playTime: Uint) {
		if (playTime === 0) {
			this.stop();
			return;
		}
		this.playTime = playTime;
		for (const t of this.tracks) {
			t.play();
		}
	}
	pause() {
		this.stop();
	}
	stop() {
		this.playTime = 0;
		for (const t of this.tracks) {
			t.stop();
		}
	}
	checkPlayState() {
		if (this.playTime === 0) {
			return;
		}
		for (const t of this.tracks) {
			if (t.audioElement !== null) {
				return;
			}
		}
		this.stop();
	}
	updateVolume() {
		for (const t of this.tracks) {
			t.updateVolume();
		}
	}
	remove() {
		for (const t of this.tracks) {
			t.stop();
		}
	}
}

const audioEnabled = () => new Promise<void>(enabled => audio({"src": "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQgAAAAAAAAAAAD//w=="}).play().then(enabled).catch(() => document.body.appendChild(div({"style": "position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.75); cursor: pointer", "onclick": function(this: HTMLDivElement) {this.remove(); enabled()}}, div({"style": "display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3em; color: #fff"}, lang["MUSIC_ENABLE"]))))),
      playStatus = addSymbol("playing", symbol({"viewBox": "0 0 10 10"}, path({"d": "M1,1 v8 l8,-4 z", "fill": "currentColor"}))),
      newPack = () => ({"tracks": [], "volume": 255, "playTime": 0, "playing": false}),
      commonWaits = (getPack: (name: string) => (Pack | undefined)) => {
	rpc.waitMusicPackVolume().then(pv => {
		const pack = getPack(pv.musicPack);
		if (pack) {
			pack.setVolume(pv.volume);
		}
	});
	rpc.waitMusicPackPlay().then(pp => {
		const pack = getPack(pp.musicPack);
		if (pack) {
			pack.play(pp.playTime);
		}
	});
	rpc.waitMusicPackStop().then(name => {
		const pack = getPack(name);
		if (pack) {
			pack.stop();
		}
	});
	rpc.waitMusicPackTrackRemove().then(mr => {
		const pack = getPack(mr.musicPack);
		if (pack && pack.tracks.length >= mr.track) {
			pack.tracks[mr.track].remove();
		}
	});
	rpc.waitMusicPackTrackVolume().then(mv => {
		const pack = getPack(mv.musicPack);
		if (pack && pack.tracks.length >= mv.track) {
			pack.tracks[mv.track].setVolume(mv.volume);
		}
	});
	rpc.waitMusicPackTrackRepeat().then(mr => {
		const pack = getPack(mr.musicPack);
		if (pack && pack.tracks.length >= mr.track) {
			pack.tracks[mr.track].setRepeat(mr.repeat);
		}
	});
      },
      now = () => timeShift + Date.now() / 1000;

let timeShift = 0;

inited.then(() => rpc.currentTime()).then(t => timeShift = t - Date.now() / 1000);

export const userMusic = () => audioEnabled().then(rpc.musicPackList).then(list => {
	const packs: Record<string, Pack> = {};
	for (const name in list) {
		packs[name] = new Pack(list[name]);
	}
	rpc.waitMusicPackAdd().then(name => packs[name] = new Pack(newPack()));
	rpc.waitMusicPackRename().then(ft => {
		const p = packs[ft.from];
		if (p) {
			delete packs[ft.from];
			packs[ft.to] = p;
		}
	});
	rpc.waitMusicPackRemove().then(name => {
		const p = packs[name];
		if (p) {
			p.remove();
			delete packs[name]
		}
	});
	rpc.waitMusicPackCopy().then(ft => {
		const p = packs[ft.from];
		if (p) {
			const tracks: MusicTrack[] = [];
			for (const track in p.tracks) {
				tracks.push({"id": p.tracks[track].id, "volume": p.tracks[track].volume, "repeat": p.tracks[track].repeat});
			}
			packs[ft.to] = new Pack({tracks, "volume": p.volume, "playTime": 0});
		}
	});
	rpc.waitMusicPackTrackAdd().then(mt => {
		const p = packs[mt.musicPack];
		if (p) {
			for (const id of mt.tracks) {
				p.tracks.push(new Track(p, {id, "volume": 255, "repeat": 0}));
			}
		}
	});
	commonWaits((name: string) => packs[name]);
}),
musicIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cdefs%3E%3Cmask id="recordMask"%3E%3Cpath d="M0,10 L50,50 0,90 M100,10 L50,50 100,90" fill="%23fff" /%3E%3C/mask%3E%3C/defs%3E%3Cg fill="none" stroke="%23fff"%3E%3Ccircle cx="50" cy="50" r="30" stroke="%23000" stroke-width="40" /%3E%3Ccircle cx="50" cy="50" r="20" stroke="%23111" stroke-width="5" /%3E%3Ccircle cx="50" cy="50" r="10" stroke="%23a00" stroke-width="15" /%3E%3Ccircle cx="50" cy="50" r="49.5" stroke-width="1" /%3E%3Cg stroke-width="0.25" mask="url(%23recordMask)"%3E%3Ccircle cx="50" cy="50" r="45" /%3E%3Ccircle cx="50" cy="50" r="42" /%3E%3Ccircle cx="50" cy="50" r="39" /%3E%3Ccircle cx="50" cy="50" r="36" /%3E%3Ccircle cx="50" cy="50" r="33" /%3E%3Ccircle cx="50" cy="50" r="30" /%3E%3Ccircle cx="50" cy="50" r="27" /%3E%3C/g%3E%3C/g%3E%3C/svg%3E`;

export default (base: Node) => {
	audioEnabled().then(rpc.musicPackList).then(list => {
		class AdminTrack extends Track {
			[node]: HTMLLIElement;
			nameNode: HTMLSpanElement;
			volumeNode: HTMLInputElement;
			repeatNode: HTMLInputElement;
			cleanup: () => void;
			repeatWait: Int = -1;
			constructor(parent: AdminPack, track: MusicTrack) {
				super(parent, track);
				this[node] = li([
					this.nameNode = span(),
					this.volumeNode = input({"type": "range", "max": 255, "value": this.volume = track.volume, "onchange": () => {
						rpc.musicPackTrackVolume(parent.name, parent.tracks.findIndex(t => t === this), this.volume = checkInt(parseInt(this.volumeNode.value), 0, 255, 255));
						this.updateVolume();
					}}),
					this.repeatNode = input({"type": "number", "min": -1, "value": this.repeat = track.repeat, "onchange": () => rpc.musicPackTrackRepeat(parent.name, parent.tracks.findIndex(t => t === this), this.repeat = checkInt(parseInt(this.repeatNode.value), -1))}),
					remove({"class": "itemRemove", "title": lang["MUSIC_TRACK_REMOVE"], "onclick": () => parent.window.confirm(lang["MUSIC_TRACK_REMOVE"], lang["MUSIC_TRACK_REMOVE_LONG"]).then(d => {
						if (!d) {
							return;
						}
						rpc.musicPackTrackRemove(parent.name, this.remove());
					})})
				]);
				this.cleanup = audioAssetName(track.id, (name: string) => this.nameNode.innerText = name);
			}
			setVolume(volume: Uint) {
				super.setVolume(volume);
				this.volumeNode.value = volume.toString();
			}
			setRepeat(repeat: Int) {
				super.setRepeat(repeat);
				this.repeatNode.value = repeat.toString();
			}
			remove() {
				this.cleanup();
				return super.remove();
			}
		}
		class AdminPack extends Pack {
			tracks: NodeArray<AdminTrack>;
			name: string;
			currentTime: Uint = 0;
			[node]: HTMLLIElement;
			nameNode: HTMLSpanElement;
			titleNode: HTMLElement;
			volumeNode: HTMLInputElement;
			toPlay = animate(toPlayOptions) as SVGAnimateBeginElement;
			toPause = animate(toPauseOptions) as SVGAnimateBeginElement;
			playPauseNode: SVGPathElement;
			playPauseTitle: SVGTitleElement;
			playStatus: SVGSVGElement;
			window: WindowElement;
			constructor(name: string, pack: MusicPack) {
				super(pack);
				this.tracks = new NodeArray<AdminTrack>(ul({"class": "musicTrackList"}), noSort);
				for (const track of pack.tracks) {
					this.tracks.push(new AdminTrack(this, track));
				}
				this.playPauseTitle = title(this.playTime === 0 ? lang["MUSIC_PLAY"] : lang["MUSIC_PAUSE"]);
				this.window = windows({"window-icon": musicIcon, "window-title": lang["MUSIC_WINDOW_TITLE"], "ondragover": (e: DragEvent) => {
					if (e.dataTransfer && this.currentTime === 0) {
						if (e.dataTransfer.types.includes("audioasset")) {
							e.preventDefault();
							e.dataTransfer.dropEffect = "link";
						} else if (e.dataTransfer.types.includes("Files")) {
							for (const a of e.dataTransfer.items) {
								switch (a["type"]) {
								case "application/ogg":
								case "audio/mpeg":
									break;
								default:
									return;
								}
							}
							e.preventDefault();
							e.dataTransfer.dropEffect = "copy";
						}
					}
				}, "ondrop": (e: DragEvent) => {
					if (!e.dataTransfer) {
						return;
					}
					if (e.dataTransfer.types.includes("audioasset")) {
						const id = JSON.parse(e.dataTransfer.getData("audioasset")).id;
						this.tracks.push(new AdminTrack(this, {id, "volume": 255, "repeat": 0}));
						rpc.musicPackTrackAdd(this.name, [id]);
					} else if (e.dataTransfer.types.includes("Files")) {
						const f = new FormData();
						for (const file of e.dataTransfer.files) {
							f.append("asset", file);
						}
						uploadAudio(f, this.window).then(audio => {
							for (const {id} of audio) {
								this.tracks.push(new AdminTrack(this, {id, "volume": 255, "repeat": 0}));
								rpc.musicPackTrackAdd(this.name, [id]);
							}
						}).catch(handleError);
						e.preventDefault();
					}
				}}, [
					this.titleNode = h1(name),
					svg({"style": "width: 2em", "viewBox": "0 0 90 90"}, [
						this.playPauseTitle,
						this.playPauseNode = path({"d": this.playTime === 0 ? playIcon : pauseIcon, "fill": "currentColor", "stroke": "none", "fill-rule": "evenodd"}, [this.toPlay, this.toPause]),
						rect({"width": "100%", "height": "100%", "fill-opacity": 0, "onclick": () => {
							if (this.playTime === 0) {
								this.play(now(), true);
							} else {
								this.pause(true);
							}

						}})
					]),
					stop({"style": "width: 2em; height: 2em", "title": lang["MUSIC_STOP"], "onclick": () => this.stop(true)}),
					br(),
					this.volumeNode = input({"type": "range", "max": 255, "value": pack.volume, "onchange": () => {
						rpc.musicPackSetVolume(this.name, this.volume = checkInt(parseInt(this.volumeNode.value), 0, 255, 255));
						this.updateVolume();
					}}),
					this.tracks[node],
					div({"style": "text-align: center"}, lang["MUSIC_DROP"])
				]);
				this[node] = li({"class": "foldersItem"}, [
					this.playStatus = playStatus({"style": {"width": "1em", "height": "1em", "visibility": "hidden"}}),
					this.nameNode = span({"onclick": () => shell.addWindow(this.window)}, this.name = name),
					rename({"title": lang["MUSIC_RENAME"], "class": "itemRename", "onclick": () => shell.prompt(lang["MUSIC_RENAME"], lang["MUSIC_RENAME_LONG"], this.name).then(name => {
						if (name && name !== this.name) {
							rpc.musicPackRename(this.name, name).then(name => {
								if (name !== this.name) {
									this.name = name;
									musicList.sort();
								}
							});
						}
					})}),
					copy({"title": lang["MUSIC_COPY"], "class": "itemCopy", "onclick": () => shell.prompt(lang["MUSIC_COPY"], lang["MUSIC_COPY_LONG"], this.name).then(name => {
						if (name) {
							rpc.musicPackCopy(this.name, name).then(name => {
								musicList.push(new AdminPack(name, {
									"tracks": this.tracks.map(t => ({"id": t.id, "volume": t.volume, "repeat": t.repeat})),
									"volume": this.volume,
									"playTime": 0
								}));
							});
						}
					})}),
					remove({"title": lang["MUSIC_REMOVE"], "class": "itemRemove", "onclick": () => shell.confirm(lang["MUSIC_REMOVE"], lang["MUSIC_REMOVE_LONG"]).then(remove => {
						if (remove) {
							this.remove();
							rpc.musicPackRemove(this.name);
						}
					})})
				]);
			}
			setName(name: string) {
				this.titleNode.innerText = this.nameNode.innerText = this.name = name;
				musicList.sort();
			}
			setVolume(volume: Uint) {
				super.setVolume(volume);
				this.volumeNode.value = volume.toString();
			}
			play(playTime: Uint, sendRPC = false) {
				super.play(playTime);
				if (document.body.contains(this.toPause)) {
					this.toPause.beginElement();
				} else {
					this.playPauseNode.setAttribute("d", pauseIcon);
				}
				this.playStatus.style.removeProperty("visibility");
				this.playPauseTitle.textContent = lang["MUSIC_PAUSE"];
				if (sendRPC) {
					rpc.musicPackPlay(this.name, 0).then(playTime => {
						this.playTime = playTime;
					});
				}
				musicList.sort();
			}
			pause(sendRPC = false) {
				this.stop(sendRPC);
			}
			stop(sendRPC = false) {
				super.stop();
				if (document.body.contains(this.toPlay)) {
					this.toPlay.beginElement();
				} else {
					this.playPauseNode.setAttribute("d", playIcon);
				}
				this.playStatus.style.setProperty("visibility", "hidden");
				this.playPauseTitle.textContent = lang["MUSIC_PLAY"];
				if (sendRPC) {
					rpc.musicPackStop(this.name);
				}
				musicList.sort();
			}
			remove() {
				super.remove();
				this.window.remove();
				for (const t of this.tracks) {
					t.cleanup();
				}
				musicList.filterRemove(p => Object.is(p, this));
			}
		}
		const rename = getSymbol("rename")!,
		      copy = getSymbol("copy")!,
		      remove = getSymbol("remove")!,
		      stop = addSymbol("stop", svg({"viewBox": "0 0 90 90"}, path({"d": "M75,15 c-15,-15 -45,-15 -60,0 c-15,15 -15,45 0,60 c15,15 45,15 60,0 c15,-15 15,-45 0,-60 z M25,25 v40 h40 v-40 z", "fill": "currentColor", "stroke": "none", "fill-rule": "evenodd"}))),
		      musicList = new NodeArray<AdminPack>(ul({"id": "musicPackList"}), (a: AdminPack, b: AdminPack) => {
			const dt = b.playTime - a.playTime;
			if (dt === 0) {
				return stringSort(a.name, b.name);
			}
			return dt;
		      }),
		      findPack = (name: string) => {
			for (const p of musicList) {
				if (p.name === name) {
					return p;
				}
			}
			return null;
		      },
		      playIcon = "M75,15 c-15,-15 -45,-15 -60,0 c-15,15 -15,45 0,60 c15,15 45,15 60,0 c15,-15 15,-45 0,-60 z M35,25 v40 l30,-20 l0,0 z",
		      pauseIcon = "M35,15 c0,0 -20,0 -20,0 c0,0 0,60 0,60 c0,0 20,0 20,0 c0,0 0,-60 0,-60 z M55,15 v60 l20,0 l0,-60 z",
		      toPlayOptions = {"attributeName": "d", "to": playIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"},
		      toPauseOptions = {"attributeName": "d", "to": pauseIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"};
		for (const name in list) {
			musicList.push(new AdminPack(name, list[name]));
		}
		createHTML(clearElement(base), {"id": "musicPacks"}, [
			button(lang["MUSIC_ADD"], {"onclick": () => shell.prompt(lang["MUSIC_ADD"], lang["MUSIC_ADD_NAME"]).then(name => {
				if (name) {
					rpc.musicPackAdd(name).then(name => musicList.push(new AdminPack(name, newPack())));
				}
			})}),
			musicList[node]
		]);
		rpc.waitMusicPackAdd().then(name => musicList.push(new AdminPack(name, newPack())));
		rpc.waitMusicPackRename().then(ft => {
			const pack = findPack(ft.from);
			if (pack) {
				pack.name = ft.to;
				musicList.sort();
			}
		});
		rpc.waitMusicPackRemove().then(name => musicList.filterRemove(p => p.name === name)[0].remove());
		rpc.waitMusicPackCopy().then(ft => {
			const pack = findPack(ft.from);
			if (pack) {
				const tracks: MusicTrack[] = [];
				for (const track in pack.tracks) {
					tracks.push({"id": pack.tracks[track].id, "volume": pack.tracks[track].volume, "repeat": pack.tracks[track].repeat});
				}
				musicList.push(new AdminPack(ft.to, {tracks, "volume": pack.volume, "playTime": 0}));
			}
		});
		rpc.waitMusicPackTrackAdd().then(mt => {
			const pack = findPack(mt.musicPack);
			if (pack) {
				for (const id of mt.tracks) {
					pack.tracks.push(new AdminTrack(pack, {id, "volume": 255, "repeat": 0}));
				}
			}
		});
		commonWaits((name: string) => {
			for (const p of musicList) {
				if (p.name === name) {
					return p;
				}
			}
			return undefined;
		});
	});
};
