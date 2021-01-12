import {MusicPack, MusicTrack, Int, Uint} from './types.js';
import {clearElement} from './lib/dom.js';
import {createHTML, audio, br, button, h1, input, li, span, ul} from './lib/html.js';
import {svg, animate, path, rect, title} from './lib/svg.js';
import lang from './language.js';
import {SortNode, stringSort, noSort} from './lib/ordered.js';
import {addSymbol, getSymbol} from './symbols.js';
import {rpc} from './rpc.js';
import {WindowElement, windows, loadingWindow} from './windows.js';
import {requestAudioAssetName, requestShell} from './misc.js';

type MusicPackNode = MusicPack & {
	name: string;
	node: HTMLLIElement;
}

const newPack = () => ({"tracks": [], "volume": 255, "playTime": 0, "playing": false}),
      commonWaits = (getPack: (name: string) => (MusicPack | undefined)) => {
	rpc.waitMusicPackVolume().then(pv => {
		const pack = getPack(pv.musicPack);
		if (pack) {
			pack.volume = pv.volume;
		}
	});
	rpc.waitMusicPackPlay().then(pp => {
		const pack = getPack(pp.musicPack);
		if (pack) {
			pack.playTime = pp.playTime;
		}
	});
	rpc.waitMusicPackStop().then(name => {
		const pack = getPack(name);
		if (pack) {
			pack.playTime = 0;
		}
	});
	rpc.waitMusicPackTrackVolume().then(mv => {
		const pack = getPack(mv.musicPack);
		if (pack && pack.tracks.length >= mv.track) {
			pack.tracks[mv.track].volume = mv.volume;
		}
	});
	rpc.waitMusicPackTrackRepeat().then(mr => {
		const pack = getPack(mr.musicPack);
		if (pack && pack.tracks.length >= mr.track) {
			pack.tracks[mr.track].repeat = mr.repeat;
		}
	});
      };

export const userMusic = () => {
	rpc.musicPackList().then(list => {
		rpc.waitMusicPackAdd().then(name => list[name] = newPack());
		rpc.waitMusicPackRename().then(ft => {
			const p = list[ft.from];
			if (p) {
				delete list[ft.from];
				list[ft.to] = p;
			}
		});
		rpc.waitMusicPackRemove().then(name => delete list[name]);
		rpc.waitMusicPackCopy().then(ft => {
			const p = list[ft.from];
			if (p) {
				list[ft.to] = {"tracks": JSON.parse(JSON.stringify(p.tracks)), "volume": p.volume, "playTime": 0};
			}
		});
		rpc.waitMusicPackTrackAdd().then(mt => {
			const p = list[mt.musicPack];
			if (p) {
				for (const t of mt.tracks) {
					p.tracks.push({"id": t, "volume": 255, "repeat": 0});
				}
			}
		});
		rpc.waitMusicPackTrackRemove().then(mr => {
			const pack = list[mr.musicPack];
			if (pack && pack.tracks.length >= mr.track) {
				pack.tracks.splice(mr.track, 1);
			}
		});
		commonWaits((name: string) => list[name]);
	});
};

export default function(base: Node) {
	rpc.musicPackList().then(list => {
		class Track {
			id: Uint;
			_volume: Uint;
			_repeat: Int;
			node: HTMLLIElement;
			nameNode: HTMLSpanElement;
			volumeNode: HTMLInputElement;
			repeatNode: HTMLInputElement;
			cleanup: () => void;
			audioElement: HTMLAudioElement | null = null;
			repeatWait: Int = -1;
			parent: Pack;
			constructor(parent: Pack, track: MusicTrack) {
				this.id = track.id;
				this.parent = parent;
				this.node = li([
					this.nameNode = span(),
					this.volumeNode = input({"type": "range", "max": 255, "value": this._volume = track.volume, "onchange": () => {
						rpc.musicPackTrackVolume(parent._name, parent.tracks.findIndex(t => t === this), this._volume = parseInt(this.volumeNode.value));
						this.updateVolume();
					}}),
					this.repeatNode = input({"type": "number", "min": -1, "value": this._repeat = track.repeat, "onchange": () => rpc.musicPackTrackRepeat(parent._name, parent.tracks.findIndex(t => t === this), this._repeat = parseInt(this.repeatNode.value))}),
					remove({"class": "itemRemove", "title": lang["MUSIC_TRACK_REMOVE"], "onclick": () => parent.window.confirm(lang["MUSIC_TRACK_REMOVE"], lang["MUSIC_TRACK_REMOVE_LONG"]).then(d => {
						if (!d) {
							return;
						}
						rpc.musicPackTrackRemove(parent._name, this.remove());
					})})
				]);
				this.cleanup = requestAudioAssetName(track.id, (name: string) => this.nameNode.innerText = name);
			}
			get volume() {
				return this._volume;
			}
			set volume(volume: Uint) {
				this._volume = volume;
				this.volumeNode.value = volume.toString();
				this.updateVolume();
			}
			get repeat() {
				return this._repeat;
			}
			set repeat(repeat: Int) {
				this._repeat = repeat;
				this.repeatNode.value = repeat.toString()
				this.waitPlay();
			}
			updateVolume() {
				if (this.audioElement) {
					this.audioElement.volume = this._volume * this.parent._volume / 65025
				}
			}
			play() {
				if (this.audioElement) {
					return;
				}
				this.audioElement = audio({"src": `/audio/${this.id}`, "1oncanplaythrough": () => {
					this.updateVolume();
					this.waitPlay();
				}, "onended": () => {
					this.waitPlay();
				}});
			}
			waitPlay() {
				if (this.audioElement === null) {
					return;
				}
				if (this.repeatWait !== -1) {
					window.clearTimeout(this.repeatWait);
					this.repeatWait = -1;
				}
				const now = Date.now() / 1000,
				      length = this.audioElement.duration;
				if (this._repeat === -1) {
					if (now < this.parent._playTime + length) {
						this.audioElement.currentTime = now - this.parent._playTime;
						this.audioElement.play();
					} else {
						this.stop();
					}
				} else {
					const cycle = length + this._repeat,
					      p = (now - this.parent._playTime) % cycle;
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
						}, cycle - p);
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
					this.parent.checkPlayState();
				}
			}
			remove() {
				const pos = this.parent.tracks.findIndex(t => t === this);
				this.parent.tracks.splice(pos, 1);
				this.stop();
				this.cleanup();
				return pos;
			}
		}
		type SVGAnimateBeginElement = SVGAnimateElement & {
			beginElement: Function;
		}
		class Pack {
			tracks: SortNode<Track>;
			_name: string;
			_volume: Uint;
			_playTime: Uint;
			currentTime: Uint = 0;
			node: HTMLLIElement;
			nameNode: HTMLSpanElement;
			titleNode: HTMLElement;
			volumeNode: HTMLInputElement;
			toPlay = animate({"attributeName": "d", "to": playIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"}) as SVGAnimateBeginElement;
			toPause = animate({"attributeName": "d", "to": pauseIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"}) as SVGAnimateBeginElement;
			playPauseTitle: SVGTitleElement;
			window: WindowElement;
			constructor(name: string, pack: MusicPack) {
				this.tracks = new SortNode<Track>(ul(), noSort);
				for (const track of pack.tracks) {
					this.tracks.push(new Track(this, track));
				}
				this._playTime = pack.playTime;
				this.playPauseTitle = title(this._playTime === 0 ? lang["MUSIC_PLAY"] : lang["MUSIC_PAUSE"]);
				this.window = windows({"window-title": lang["MUSIC_WINDOW_TITLE"], "ondragover": (e: DragEvent) => {
					if (e.dataTransfer && e.dataTransfer.types.includes("audioasset")) {
						e.preventDefault();
						e.dataTransfer.dropEffect = "link";
					}
				}, "ondrop": (e: DragEvent) => {
					if (e.dataTransfer!.types.includes("audioasset")) {
						const id = JSON.parse(e.dataTransfer!.getData("audioasset")).id;
						this.tracks.push(new Track(this, {id, "volume": 255, "repeat": 0}));
						rpc.musicPackTrackAdd(this._name, [id]);
					}
				}}, [
					this.titleNode = h1(name),
					svg({"style": "width: 2em", "viewBox": "0 0 90 90"}, [
						this.playPauseTitle,
						path({"d": this._playTime === 0 ? playIcon : pauseIcon, "style": "fill: currentColor", "stroke": "none", "fill-rule": "evenodd"}, [this.toPlay, this.toPause]),
						rect({"width": "100%", "height": "100%", "fill-opacity": 0, "onclick": () => {
							if (this._playTime === 0) {
								this.play();
							} else {
								this.pause();
							}

						}})
					]),
					stop({"style": "width: 2em; height: 2em", "title": lang["MUSIC_STOP"], "onclick": () => {
						if (this._playTime !== 0) {
							this.stop();
						}
					}}),
					br(),
					this.volumeNode = input({"type": "range", "max": 255, "value": this._volume = pack.volume, "onchange": () => {
						rpc.musicPackSetVolume(this._name, this._volume = parseInt(this.volumeNode.value));
						this.updateVolume();
					}}),
					this.tracks.node
				]);
				this.node = li([
					this.nameNode = span({"onclick": () => requestShell().addWindow(this.window)}, this._name = name),
					rename({"title": lang["MUSIC_RENAME"], "class": "itemRename", "onclick": () => requestShell().prompt(lang["MUSIC_RENAME"], lang["MUSIC_RENAME_LONG"], this._name).then(name => {
						if (name && name !== this._name) {
							rpc.musicPackRename(this._name, name).then(name => {
								if (name !== this._name) {
									this.name = name;
									musicList.sort();
								}
							});
						}
					})}),
					copy({"title": lang["MUSIC_COPY"], "class": "itemLink", "onclick": () => requestShell().prompt(lang["MUSIC_COPY"], lang["MUSIC_COPY_LONG"], this._name).then(name => {
						if (name) {
							rpc.musicPackCopy(this._name, name).then(name => {
								musicList.push(new Pack(name, {
									"tracks": this.tracks.map(t => ({"id": t.id, "volume": t.volume, "repeat": t.repeat})),
									"volume": this._volume,
									"playTime": 0
								}));
							});
						}
					})}),
					remove({"title": lang["MUSIC_REMOVE"], "class": "itemRemove", "onclick": () => requestShell().confirm(lang["MUSIC_REMOVE"], lang["MUSIC_REMOVE_LONG"]).then(remove => {
						if (remove) {
							this.remove();
							rpc.musicPackRemove(this._name);
						}
					})})
				]);
			}
			get name() {
				return this._name;
			}
			set name(name: string) {
				this.titleNode.innerText = this.nameNode.innerText = this._name = name;
			}
			get volume() {
				return this._volume;
			}
			set volume(volume: Uint) {
				this._volume = volume;
				this.volumeNode.value = volume.toString();
				this.updateVolume();
			}
			set playTime(playTime: Uint) {
				this._playTime = playTime;
			}
			play() {
				this._playTime = 1;
				this.toPause.beginElement();
				this.playPauseTitle.textContent = lang["MUSIC_PAUSE"];
				for (const t of this.tracks) {
					t.play();
				}
			}
			pause() {
				this.stop();
			}
			stop() {
				this._playTime = 0;
				this.toPlay.beginElement();
				this.playPauseTitle.textContent = lang["MUSIC_PLAY"];
				for (const t of this.tracks) {
					t.stop();
				}
			}
			checkPlayState() {
				if (this._playTime === 0) {
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
		      musicList = new SortNode<Pack>(ul({"id": "musicPackList"}), (a: MusicPackNode, b: MusicPackNode) => {
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
		      pauseIcon = "M35,15 c0,0 -20,0 -20,0 c0,0 0,60 0,60 c0,0 20,0 20,0 c0,0 0,-60 0,-60 z M55,15 v60 l20,0 l0,-60 z";
		for (const name in list) {
			musicList.push(new Pack(name, list[name]));
		}
		createHTML(clearElement(base), {"id": "musicPacks"}, [
			button(lang["MUSIC_ADD"], {"onclick": () => requestShell().prompt(lang["MUSIC_ADD"], lang["MUSIC_ADD_NAME"]).then(name => {
				if (name) {
					rpc.musicPackAdd(name).then(name => musicList.push(new Pack(name, newPack())));
				}
			})}),
			musicList.node
		]);
		rpc.waitMusicPackAdd().then(name => musicList.push(new Pack(name, newPack())));
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
				musicList.push(new Pack(ft.to, {"tracks": JSON.parse(JSON.stringify(pack.tracks)), "volume": pack.volume, "playTime": 0}));
			}
		});
		rpc.waitMusicPackTrackAdd().then(mt => {
			const pack = findPack(mt.musicPack);
			if (pack) {
				for (const t of mt.tracks) {
					pack.tracks.push(new Track(pack, {"id": t, "volume": 255, "repeat": 0}));
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
