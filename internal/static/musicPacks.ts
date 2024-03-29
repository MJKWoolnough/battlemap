import type {Parsers, Tokeniser} from './lib/bbcode.js';
import type {IDName, Int, MusicPack, MusicTrack, Uint} from './types.js';
import type {WindowElement} from './windows.js';
import {isOpenTag, process} from './lib/bbcode.js';
import {none} from './lib/bbcode_tags.js';
import {add, ids} from './lib/css.js';
import {amendNode, clearNode, event, eventOnce} from './lib/dom.js';
import {DragTransfer, setDragEffect} from './lib/drag.js';
import {audio, br, button, div, h1, img, input, li, span, ul} from './lib/html.js';
import {checkInt} from './lib/misc.js';
import {NodeArray, NodeMap, node, stringSort} from './lib/nodes.js';
import {animate, ns as svgNS, path, rect, svg, title} from './lib/svg.js';
import {audioAssetName, dragAudio, dragAudioFiles, uploadAudio} from './assets.js';
import {audioIDtoURL} from './asset_urls.js';
import {foldersItem, itemControl, psuedoLink} from './ids.js';
import lang from './language.js';
import {bbcodeDrag, registerTag} from './messaging.js';
import {handleError, inited, isAdmin, rpc, timeShift} from './rpc.js';
import {musicSort} from './settings.js';
import {loading, menuItems} from './shared.js';
import {copy, playStatus, remove, rename, stop} from './symbols.js';
import {shell, windows} from './windows.js';

type MusicTrackName = MusicTrack & {
	name?: string;
}

class Track {
	id: Uint;
	volume: Uint;
	repeat: Int;
	audioElement: HTMLAudioElement | null = null;
	#repeatWait: Int = -1;
	#parent: Pack;
	constructor(parent: Pack, track: MusicTrack) {
		this.id = track.id;
		this.volume = track.volume;
		this.repeat = track.repeat;
		this.#parent = parent;
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
			this.waitPlay();
			return;
		}
		this.audioElement = audio({"src": audioIDtoURL(this.id), "onloadeddata": event(() => {
			this.updateVolume();
			this.waitPlay();
		}, eventOnce), "onended": () => this.waitPlay()});
	}
	updateVolume() {
		if (this.audioElement) {
			this.audioElement.volume = this.volume * this.#parent.volume / 65025
		}
	}
	waitPlay() {
		if (this.audioElement) {
			if (this.#repeatWait !== -1) {
				clearTimeout(this.#repeatWait);
				this.#repeatWait = -1;
			}
			const tnow = now(),
			      length = this.audioElement.duration;
			if (this.repeat === -1) {
				if (tnow < this.#parent.playTime + length) {
					this.audioElement.currentTime = tnow - this.#parent.playTime;
					this.audioElement.play();
				} else {
					this.stop();
					this.#parent.checkPlayState();
				}
			} else {
				const cycle = length + this.repeat,
				      p = (tnow - this.#parent.playTime) % cycle;
				if (p < length) {
					this.audioElement.currentTime = p;
					this.audioElement.play();
				} else {
					this.audioElement.pause();
					this.#repeatWait = setTimeout(() => {
						this.audioElement?.play();
						this.#repeatWait = -1;
					}, (cycle - p) * 1000);
				}
			}
		}
	}
	stop() {
		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement = null;
			if (this.#repeatWait !== -1) {
				clearTimeout(this.#repeatWait);
				this.#repeatWait = -1;
			}
		}
	}
	remove() {
		const pos = this.#parent.tracks.findIndex(t => t === this);
		this.#parent.tracks.splice(pos, 1);
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
		if (this.playTime) {
			setTimeout(() => this.play(this.playTime));
		}
	}
	setVolume(volume: Uint) {
		this.volume = volume;
		this.updateVolume();
	}
	play(playTime: Uint) {
		if (playTime) {
			this.playTime = playTime;
			for (const t of this.tracks) {
				t.play();
			}
		} else {
			this.stop();
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
		if (this.playTime) {
			for (const t of this.tracks) {
				if (t.audioElement !== null) {
					return;
				}
			}
			this.stop();
		}
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

const audioEnabled = () => new Promise<void>(enabled => audio({"src": "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQgAAAAAAAAAAAD//w=="}).play().then(enabled).catch(() => amendNode(document.body, div({"style": "position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.75); cursor: pointer; z-index: 2", "onclick": function(this: HTMLDivElement) {this.remove(); enabled()}}, div({"style": "display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3em; color: #fff"}, lang["MUSIC_ENABLE"]))))),
      musicIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Cdefs%3E%3Cmask id="recordMask"%3E%3Cpath d="M0,10 L50,50 0,90 M100,10 L50,50 100,90" fill="%23fff" /%3E%3C/mask%3E%3C/defs%3E%3Cg fill="none" stroke="%23fff"%3E%3Ccircle cx="50" cy="50" r="30" stroke="%23000" stroke-width="40" /%3E%3Ccircle cx="50" cy="50" r="20" stroke="%23111" stroke-width="5" /%3E%3Ccircle cx="50" cy="50" r="10" stroke="%23a00" stroke-width="15" /%3E%3Ccircle cx="50" cy="50" r="49.5" stroke-width="1" /%3E%3Cg stroke-width="0.25" mask="url(%23recordMask)"%3E%3Ccircle cx="50" cy="50" r="45" /%3E%3Ccircle cx="50" cy="50" r="42" /%3E%3Ccircle cx="50" cy="50" r="39" /%3E%3Ccircle cx="50" cy="50" r="36" /%3E%3Ccircle cx="50" cy="50" r="33" /%3E%3Ccircle cx="50" cy="50" r="30" /%3E%3Ccircle cx="50" cy="50" r="27" /%3E%3C/g%3E%3C/g%3E%3C/svg%3E`,
      newPack = (id: Uint, name = "", tracks: MusicTrack[] = [], volume = 255) => ({id, name, tracks, volume, "playTime": 0, "playing": false}),
      commonWaits = (packs: Map<Uint, Pack>) => {
	rpc.waitMusicPackVolume().when(pv => packs.get(pv.id)?.setVolume(pv.volume));
	rpc.waitMusicPackPlay().when(pp => packs.get(pp.id)?.play(pp.playTime));
	rpc.waitMusicPackStop().when(id => packs.get(id)?.stop());
	rpc.waitMusicPackTrackRemove().when(mr => packs.get(mr.id)?.tracks[mr.track]?.remove());
	rpc.waitMusicPackTrackVolume().when(mv => packs.get(mv.id)?.tracks[mv.track]?.setVolume(mv.volume));
	rpc.waitMusicPackTrackRepeat().when(mr => packs.get(mr.id)?.tracks[mr.track]?.setRepeat(mr.repeat));
      },
      now = () => timeShift + Date.now() / 1000;

export const dragMusicPack = new DragTransfer<IDName>("musicpack");

export let open = (_id: Uint) => {};

inited.then(() => {
	if (!isAdmin) {
		audioEnabled().then(rpc.musicPackList).then(list => {
			const packs = new Map<Uint, Pack>();
			for (const pack of list) {
				packs.set(pack.id, new Pack(pack));
			}
			rpc.waitMusicPackAdd().when(({id}) => packs.set(id, new Pack(newPack(id))));
			rpc.waitMusicPackRemove().when(id => {
				const p = packs.get(id);
				if (p) {
					p.remove();
					packs.delete(id)
				}
			});
			rpc.waitMusicPackCopy().when(({id, newID}) => {
				const p = packs.get(id);
				if (p) {
					const tracks: MusicTrack[] = [];
					for (const track in p.tracks) {
						tracks.push({"id": p.tracks[track].id, "volume": p.tracks[track].volume, "repeat": p.tracks[track].repeat});
					}
					packs.set(newID, new Pack({"id": newID, "name": "", tracks, "volume": p.volume, "playTime": 0}));
				}
			});
			rpc.waitMusicPackTrackAdd().when(mt => {
				const p = packs.get(mt.id);
				if (p) {
					for (const id of mt.tracks) {
						p.tracks.push(new Track(p, {id, "volume": 255, "repeat": 0}));
					}
				}
			});
			commonWaits(packs);
		});
		registerTag("musicpack", none);
	} else {
		registerTag("musicpack", (n: Node, t: Tokeniser, p: Parsers) => {
			const tk = t.next(true).value;
			if (tk && isOpenTag(tk) && tk.attr) {
				const id = parseInt(tk.attr);
				if (!isNaN(id)) {
					amendNode(n, process(span({"class": psuedoLink, "onclick": (e: MouseEvent) => {
						if (e.button === 0) {
							open(id);
						}
					}}), t, p, tk.tagName));
				}
			}
		});
		menuItems.push([3, () => [
			lang["TAB_MUSIC_PACKS"],
			(() => {
				const base = div(loading()),
				      dragIcon = img({"class": "imageIcon", "src": musicIcon}),
				      [musicPackList, musicTrackList] = ids(2);
				add({
					[`#${musicPackList},.${musicTrackList}`]: {
						"margin": 0,
						"padding-left": 0,
						"list-style": "none"
					},
					[`#${musicPackList}>li`]: {
						">span": {
							"cursor": "pointer"
						},
						"display": "grid",
						"grid-template-columns": "1em auto 1em 1em 1em"
					},
					[`.${musicTrackList} li`]: {
						">svg": {
							"margin-right": 0,
							"margin-left": "0.5em"
						},
						"display": "grid",
						"grid-template-columns": "auto 10em 5em 2em"
					}
				});
				audioEnabled().then(rpc.musicPackList).then(list => {
					class AdminTrack extends Track {
						[node]: HTMLLIElement;
						#nameNode: HTMLSpanElement;
						#volumeNode: HTMLInputElement;
						#repeatNode: HTMLInputElement;
						cleanup: () => void;
						constructor(parent: AdminPack, track: MusicTrackName) {
							super(parent, track);
							this[node] = li([
								this.#nameNode = span(track.name ?? [lang["MUSIC_TRACK"], " ", track.id + ""]),
								this.#volumeNode = input({"type": "range", "max": 255, "value": this.volume = track.volume, "onchange": () => {
									rpc.musicPackTrackVolume(parent.id, parent.tracks.findIndex(t => t === this), this.volume = checkInt(parseInt(this.#volumeNode.value), 0, 255, 255));
									this.updateVolume();
								}}),
								this.#repeatNode = input({"type": "number", "min": -1, "value": this.repeat = track.repeat, "onchange": () => rpc.musicPackTrackRepeat(parent.id, parent.tracks.findIndex(t => t === this), this.repeat = checkInt(parseInt(this.#repeatNode.value), -1))}),
								remove({"class": itemControl, "title": lang["MUSIC_TRACK_REMOVE"], "onclick": () => parent.window.confirm(lang["MUSIC_TRACK_REMOVE"], lang["MUSIC_TRACK_REMOVE_LONG"]).then(d => {
									if (d) {
										rpc.musicPackTrackRemove(parent.id, this.remove());
									}
								})})
							]);
							this.cleanup = track.name ? () => {} : audioAssetName(track.id, (name: string) => clearNode(this.#nameNode, name));
						}
						setVolume(volume: Uint) {
							super.setVolume(volume);
							this.#volumeNode.value = volume + "";
						}
						setRepeat(repeat: Int) {
							super.setRepeat(repeat);
							this.#repeatNode.value = repeat + "";
						}
						remove() {
							this.cleanup();
							return super.remove();
						}
					}
					class AdminPack extends Pack {
						tracks: NodeArray<AdminTrack>;
						id: Uint;
						name: string;
						[node]: HTMLLIElement;
						#nameNode: HTMLSpanElement;
						#titleNode: HTMLElement;
						#volumeNode: HTMLInputElement;
						#toPlay = animate(toPlayOptions);
						#toPause = animate(toPauseOptions);
						#playPauseNode: SVGPathElement;
						#playPauseTitle: SVGTitleElement;
						#playStatus: SVGSVGElement;
						#pauseTime: Uint = 0;
						window: WindowElement;
						#dragKey: string;
						#bbcodeKey: string;
						constructor(id: Uint, pack: MusicPack) {
							super(pack);
							this.id = id;
							this.name = pack.name;
							this.tracks = new NodeArray<AdminTrack>(ul({"class": musicTrackList}));
							for (const track of pack.tracks) {
								this.tracks.push(new AdminTrack(this, track));
							}
							this.#playPauseTitle = title(this.playTime === 0 ? lang["MUSIC_PLAY"] : lang["MUSIC_PAUSE"]);
							this.#dragKey = dragMusicPack.register(this);
							this.#bbcodeKey = bbcodeDrag.register(() => (t: string) => `[musicpack=${this.id}]${t || this.name}[/musicpack]`);
							const ondragstart = (e: DragEvent) => {
								dragMusicPack.set(e, this.#dragKey, dragIcon);
								bbcodeDrag.set(e, this.#bbcodeKey);
							      };
							this.window = windows({"window-icon": musicIcon, "window-title": lang["MUSIC_WINDOW_TITLE"], "hide-minimise": false, "ondragover": (e: DragEvent) => {
								if (this.currentTime === 0) {
									dragCheck(e);
								}
							}, "ondrop": (e: DragEvent) => {
								if (dragAudio.is(e)) {
									const {id, name} = dragAudio.get(e);
									this.tracks.push(new AdminTrack(this, {id, "volume": 255, "repeat": 0, name}));
									rpc.musicPackTrackAdd(this.id, [id]);
								} else if (dragAudioFiles.is(e)) {
									uploadAudio(dragAudioFiles.asForm(e, "asset"), this.window).then(audio => {
										const ids: Uint[] = [];
										for (const {id, name} of audio) {
											this.tracks.push(new AdminTrack(this, {id, "volume": 255, "repeat": 0, name}));
											ids.push(id);
										}
										rpc.musicPackTrackAdd(this.id, ids);
									}).catch(handleError);
								}
							}}, [
								this.#titleNode = h1({"draggable": "true", ondragstart}, this.name),
								svg({"style": "width: 2em", "viewBox": "0 0 90 90"}, [
									this.#playPauseTitle,
									this.#playPauseNode = path({"d": this.playTime === 0 ? playIcon : pauseIcon, "fill": "currentColor", "stroke": "none", "fill-rule": "evenodd"}, [this.#toPlay, this.#toPause]),
									rect({"width": "100%", "height": "100%", "fill-opacity": 0, "onclick": () => {
										if (this.playTime) {
											this.pause(true);
										} else {
											this.play(now() - this.#pauseTime, true);
										}

									}})
								]),
								stop({"style": "width: 2em; height: 2em", "title": lang["MUSIC_STOP"], "onclick": () => this.stop(true)}),
								br(),
								this.#volumeNode = input({"type": "range", "max": 255, "value": pack.volume, "onchange": () => {
									rpc.musicPackSetVolume(this.id, this.volume = checkInt(parseInt(this.#volumeNode.value), 0, 255, 255));
									this.updateVolume();
								}}),
								this.tracks[node],
								div({"style": "text-align: center"}, lang["MUSIC_DROP"])
							]);
							this[node] = li({"class": foldersItem, "draggable": "true", ondragstart}, [
								this.#playStatus = playStatus({"style": "width: 1em; height: 1em; visibility: hidden"}),
								this.#nameNode = span({"onclick": () => shell.addWindow(this.window), "onauxclick": (e: MouseEvent) => {
									if (e.button === 1) {
										if (this.playTime) {
											this.stop(true);
										} else {
											this.play(now() - this.#pauseTime, true);
										}
									}
								}}, this.name),
								rename({"title": lang["MUSIC_RENAME"], "class": itemControl, "onclick": () => shell.prompt(lang["MUSIC_RENAME"], lang["MUSIC_RENAME_LONG"], this.name).then(name => {
									if (name && name !== this.name) {
										rpc.musicPackRename(this.id, name).then(name => {
											if (name !== this.name) {
												this.setName(name);
												musicList.sort();
											}
										});
									}
								})}),
								copy({"title": lang["MUSIC_COPY"], "class": itemControl, "onclick": () => shell.prompt(lang["MUSIC_COPY"], lang["MUSIC_COPY_LONG"], this.name).then(name => {
									if (name) {
										rpc.musicPackCopy(this.id, name).then(({id, name}) => musicList.set(id, new AdminPack(id, newPack(id, name, this.tracks.map(t => ({"id": t.id, "volume": t.volume, "repeat": t.repeat})), this.volume))));
									}
								})}),
								remove({"title": lang["MUSIC_REMOVE"], "class": itemControl, "onclick": () => shell.confirm(lang["MUSIC_REMOVE"], lang["MUSIC_REMOVE_LONG"]).then(remove => {
									if (remove) {
										this.remove();
										rpc.musicPackRemove(this.id);
									}
								})})
							]);
						}
						transfer(): IDName {
							return {"id": this.id, "name": this.name};
						}
						setName(name: string) {
							clearNode(this.#titleNode, name);
							clearNode(this.#nameNode, this.name = name);
							musicList.sort();
						}
						setVolume(volume: Uint) {
							super.setVolume(volume);
							this.#volumeNode.value = volume + "";
						}
						play(playTime: Uint, sendRPC = false) {
							super.play(playTime);
							if (document.body.contains(this.#toPause)) {
								this.#toPause.beginElement();
							} else {
								amendNode(this.#playPauseNode, {"d": pauseIcon});
							}
							amendNode(this.#playStatus, {"style": {"visibility": undefined}});
							clearNode(this.#playPauseTitle, lang["MUSIC_PAUSE"]);
							if (sendRPC) {
								rpc.musicPackPlay(this.id, Math.round(playTime)).then(playTime => this.playTime = playTime);
							}
							musicList.sort();
						}
						pause(sendRPC = false) {
							const pauseTime = now() - this.playTime;
							this.stop(sendRPC);
							this.#pauseTime = pauseTime;
						}
						stop(sendRPC = false) {
							super.stop();
							this.#pauseTime = 0;
							if (document.body.contains(this.#toPlay)) {
								this.#toPlay.beginElement();
							} else {
								amendNode(this.#playPauseNode, {"d": playIcon});
							}
							amendNode(this.#playStatus, {"style": {"visibility": "hidden"}});
							clearNode(this.#playPauseTitle, lang["MUSIC_PLAY"]);
							if (sendRPC) {
								rpc.musicPackStop(this.id);
							}
							musicList.sort();
						}
						remove() {
							super.remove();
							this.window.remove();
							for (const t of this.tracks) {
								t.cleanup();
							}
							musicList.delete(this.id);
							dragMusicPack.deregister(this.#dragKey);
							bbcodeDrag.deregister(this.#bbcodeKey);
						}
					}
					const musicStringSortFn = (a: AdminPack, b: AdminPack) => stringSort(a.name, b.name),
					      musicActiveSortFn = (a: AdminPack, b: AdminPack) => (b.playTime - a.playTime) || musicStringSortFn(a, b),
					      musicList = new NodeMap<Uint, AdminPack>(ul({"id": musicPackList})),
					      playIcon = "M75,15 c-15,-15 -45,-15 -60,0 c-15,15 -15,45 0,60 c15,15 45,15 60,0 c15,-15 15,-45 0,-60 z M35,25 v40 l30,-20 l0,0 z",
					      pauseIcon = "M35,15 c0,0 -20,0 -20,0 c0,0 0,60 0,60 c0,0 20,0 20,0 c0,0 0,-60 0,-60 z M55,15 v60 l20,0 l0,-60 z",
					      toPlayOptions = {"attributeName": "d", "to": playIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"},
					      toPauseOptions = {"attributeName": "d", "to": pauseIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"},
					      dragCheck = setDragEffect({
						"link": [dragAudio],
						"copy": [dragAudioFiles]
					      });
					musicSort.wait(v => musicList.sort(v ? musicActiveSortFn : musicStringSortFn));
					for (const pack of list) {
						musicList.set(pack.id, new AdminPack(pack.id, pack));
					}
					clearNode(base, [
						button({"onclick": () => shell.prompt(lang["MUSIC_ADD"], lang["MUSIC_ADD_NAME"]).then(name => {
							if (name) {
								rpc.musicPackAdd(name).then(({id, name}) => musicList.set(id, new AdminPack(id, newPack(id, name))));
							}
						})}, lang["MUSIC_ADD"]),
						musicList[node]
					]);
					rpc.waitMusicPackAdd().when(({id, name}) => musicList.set(id, new AdminPack(id, newPack(id, name))));
					rpc.waitMusicPackRename().when(ft => musicList.get(ft.id)?.setName(ft.name));
					rpc.waitMusicPackRemove().when(id => {
						const pack = musicList.get(id);
						if (pack) {
							pack.remove();
							musicList.delete(id);
						}
					});
					rpc.waitMusicPackCopy().when(({id, name}) => {
						const pack = musicList.get(id);
						if (pack) {
							musicList.set(id, new AdminPack(id, newPack(id, name, pack.tracks.map(t => ({"id": t.id, "volume": t.volume, "repeat": t.repeat})), pack.volume)));
						}
					});
					rpc.waitMusicPackTrackAdd().when(mt => {
						const pack = musicList.get(mt.id);
						if (pack) {
							for (const id of mt.tracks) {
								pack.tracks.push(new AdminTrack(pack, {id, "volume": 255, "repeat": 0}));
							}
						}
					});
					commonWaits(musicList);
					open = (id: Uint) => {
						const pack = musicList.get(id);
						if (pack) {
							shell.addWindow(pack.window)
						}
					};
				});
				return base;
			})(),
			true,
			musicIcon
		]]);
	}
});
