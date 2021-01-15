import {MusicPack, MusicTrack, Int, Uint} from './types.js';
import {clearElement} from './lib/dom.js';
import {createHTML, audio, br, div, button, h1, input, li, span, ul} from './lib/html.js';
import {svg, animate, path, rect, title} from './lib/svg.js';
import lang from './language.js';
import {SortNode, stringSort, noSort} from './lib/ordered.js';
import {addSymbol, getSymbol} from './symbols.js';
import {rpc} from './rpc.js';
import {WindowElement, windows, loadingWindow} from './windows.js';
import {requestAudioAssetName, requestShell} from './misc.js';

const audioEnabled = () => new Promise<void>(enabled => audio({"src": "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQgAAAAAAAAAAAD//w=="}).play().then(enabled).catch(() => document.body.appendChild(div({"style": "position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5)", "onclick": function(this: HTMLDivElement) {this.remove(); enabled()}}))));

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
		this.audioElement = audio({"src": `/audio/${this.id}`, "1onloadeddata": () => this.waitPlay(), "onended": () => this.waitPlay()});
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
		const now = Date.now() / 1000,
		      length = this.audioElement.duration;
		if (this.repeat === -1) {
			if (now < this.parent.playTime + length) {
				this.audioElement.currentTime = now - this.parent.playTime;
				this.audioElement.play();
			} else {
				this.stop();
				this.parent.checkPlayState();
			}
		} else {
			const cycle = length + this.repeat,
			      p = (now - this.parent.playTime) % cycle;
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
			window.setTimeout(() => this.play(this.playTime), 0);
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

const newPack = () => ({"tracks": [], "volume": 255, "playTime": 0, "playing": false}),
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
      };

export const userMusic = () => {
	audioEnabled().then(rpc.musicPackList).then(list => {
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
		rpc.waitMusicPackRemove().then(name => delete packs[name]);
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
				for (const t of mt.tracks) {
					p.tracks.push(new Track(p, {"id": t, "volume": 255, "repeat": 0}));
				}
			}
		});
		rpc.waitMusicPackTrackRemove().then(mr => {
			const pack = packs[mr.musicPack];
			if (pack && pack.tracks.length >= mr.track) {
				pack.tracks.splice(mr.track, 1);
			}
		});
		commonWaits((name: string) => packs[name]);
	});
};

export default function(base: Node) {
	audioEnabled().then(rpc.musicPackList).then(list => {
		class AdminTrack extends Track {
			node: HTMLLIElement;
			nameNode: HTMLSpanElement;
			volumeNode: HTMLInputElement;
			repeatNode: HTMLInputElement;
			cleanup: () => void;
			repeatWait: Int = -1;
			constructor(parent: AdminPack, track: MusicTrack) {
				super(parent, track);
				this.node = li([
					this.nameNode = span(),
					this.volumeNode = input({"type": "range", "max": 255, "value": this.volume = track.volume, "onchange": () => {
						rpc.musicPackTrackVolume(parent.name, parent.tracks.findIndex(t => t === this), this.volume = parseInt(this.volumeNode.value));
						this.updateVolume();
					}}),
					this.repeatNode = input({"type": "number", "min": -1, "value": this.repeat = track.repeat, "onchange": () => rpc.musicPackTrackRepeat(parent.name, parent.tracks.findIndex(t => t === this), this.repeat = parseInt(this.repeatNode.value))}),
					remove({"class": "itemRemove", "title": lang["MUSIC_TRACK_REMOVE"], "onclick": () => parent.window.confirm(lang["MUSIC_TRACK_REMOVE"], lang["MUSIC_TRACK_REMOVE_LONG"]).then(d => {
						if (!d) {
							return;
						}
						rpc.musicPackTrackRemove(parent.name, this.remove());
					})})
				]);
				this.cleanup = requestAudioAssetName(track.id, (name: string) => this.nameNode.innerText = name);
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
				const pos = super.remove();
				this.cleanup();
				return pos;
			}
		}
		type SVGAnimateBeginElement = SVGAnimateElement & {
			beginElement: Function;
		}
		class AdminPack extends Pack {
			tracks: SortNode<AdminTrack>;
			name: string;
			currentTime: Uint = 0;
			node: HTMLLIElement;
			nameNode: HTMLSpanElement;
			titleNode: HTMLElement;
			volumeNode: HTMLInputElement;
			toPlay = animate(toPlayOptions) as SVGAnimateBeginElement;
			toPause = animate(toPauseOptions) as SVGAnimateBeginElement;
			playPauseNode: SVGSVGElement;
			playPauseTitle: SVGTitleElement;
			window: WindowElement;
			constructor(name: string, pack: MusicPack) {
				super(pack);
				this.tracks = new SortNode<AdminTrack>(ul(), noSort);
				for (const track of pack.tracks) {
					this.tracks.push(new AdminTrack(this, track));
				}
				this.playPauseTitle = title(this.playTime === 0 ? lang["MUSIC_PLAY"] : lang["MUSIC_PAUSE"]);
				this.window = windows({"window-title": lang["MUSIC_WINDOW_TITLE"], "ondragover": (e: DragEvent) => {
					if (e.dataTransfer && e.dataTransfer.types.includes("audioasset") && this.currentTime === 0) {
						e.preventDefault();
						e.dataTransfer.dropEffect = "link";
					}
				}, "ondrop": (e: DragEvent) => {
					if (e.dataTransfer!.types.includes("audioasset")) {
						const id = JSON.parse(e.dataTransfer!.getData("audioasset")).id;
						this.tracks.push(new AdminTrack(this, {id, "volume": 255, "repeat": 0}));
						rpc.musicPackTrackAdd(this.name, [id]);
					}
				}}, [
					this.titleNode = h1(name),
					this.playPauseNode = svg({"style": "width: 2em", "viewBox": "0 0 90 90"}, [
						this.playPauseTitle,
						path({"d": this.playTime === 0 ? playIcon : pauseIcon, "style": "fill: currentColor", "stroke": "none", "fill-rule": "evenodd"}, [this.toPlay, this.toPause]),
						rect({"width": "100%", "height": "100%", "fill-opacity": 0, "onclick": () => {
							if (this.playTime === 0) {
								this.play(Date.now(), true);
							} else {
								this.pause(true);
							}

						}})
					]),
					stop({"style": "width: 2em; height: 2em", "title": lang["MUSIC_STOP"], "onclick": () => {
						if (this.playTime !== 0) {
							this.stop(true);
						}
					}}),
					br(),
					this.volumeNode = input({"type": "range", "max": 255, "value": pack.volume, "onchange": () => {
						rpc.musicPackSetVolume(this.name, this.volume = parseInt(this.volumeNode.value));
						this.updateVolume();
					}}),
					this.tracks.node
				]);
				this.node = li([
					this.nameNode = span({"onclick": () => requestShell().addWindow(this.window)}, this.name = name),
					rename({"title": lang["MUSIC_RENAME"], "class": "itemRename", "onclick": () => requestShell().prompt(lang["MUSIC_RENAME"], lang["MUSIC_RENAME_LONG"], this.name).then(name => {
						if (name && name !== this.name) {
							rpc.musicPackRename(this.name, name).then(name => {
								if (name !== this.name) {
									this.name = name;
									musicList.sort();
								}
							});
						}
					})}),
					copy({"title": lang["MUSIC_COPY"], "class": "itemLink", "onclick": () => requestShell().prompt(lang["MUSIC_COPY"], lang["MUSIC_COPY_LONG"], this.name).then(name => {
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
					remove({"title": lang["MUSIC_REMOVE"], "class": "itemRemove", "onclick": () => requestShell().confirm(lang["MUSIC_REMOVE"], lang["MUSIC_REMOVE_LONG"]).then(remove => {
						if (remove) {
							this.remove();
							rpc.musicPackRemove(this.name);
						}
					})})
				]);
			}
			setName(name: string) {
				this.titleNode.innerText = this.nameNode.innerText = this.name = name;
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
				this.playPauseTitle.textContent = lang["MUSIC_PAUSE"];
				if (sendRPC) {
					rpc.musicPackPlay(this.name, 0).then(playTime => {
						this.playTime = playTime;
					});
				}
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
				this.playPauseTitle.textContent = lang["MUSIC_PLAY"];
				if (sendRPC) {
					rpc.musicPackStop(this.name);
				}
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
		      stop = addSymbol("stop", svg({"viewBox": "0 0 90 90"}, path({"d": "M75,15 c-15,-15 -45,-15 -60,0 c-15,15 -15,45 0,60 c15,15 45,15 60,0 c15,-15 15,-45 0,-60 z M25,25 v40 h40 v-40 z", "style": "fill: currentColor", "stroke": "none", "fill-rule": "evenodd"}))),
		      musicList = new SortNode<AdminPack>(ul({"id": "musicPackList"}), (a: AdminPack, b: AdminPack) => {
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
			button(lang["MUSIC_ADD"], {"onclick": () => requestShell().prompt(lang["MUSIC_ADD"], lang["MUSIC_ADD_NAME"]).then(name => {
				if (name) {
					rpc.musicPackAdd(name).then(name => musicList.push(new AdminPack(name, newPack())));
				}
			})}),
			musicList.node
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
				for (const t of mt.tracks) {
					pack.tracks.push(new AdminTrack(pack, {"id": t, "volume": 255, "repeat": 0}));
				}
			}
		});
		rpc.waitMusicPackTrackRemove().then(mr => {
			const pack = findPack(mr.musicPack);
			if (pack && pack.tracks.length >= mr.track) {
				pack.tracks[mr.track].remove();
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
}
