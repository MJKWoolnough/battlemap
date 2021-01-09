import {MusicPack, MusicTrack, Int, Uint} from './types.js';
import {clearElement} from './lib/dom.js';
import {createHTML, br, button, h1, input, li, span, ul} from './lib/html.js';
import {svg, animate, path, rect} from './lib/svg.js';
import lang from './language.js';
import {SortNode, stringSort, noSort} from './lib/ordered.js';
import {getSymbol} from './symbols.js';
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
			parent: Pack;
			constructor(parent: Pack, track: MusicTrack) {
				this.id = track.id;
				this.parent = parent;
				this.node = li([
					this.nameNode = span(),
					this.volumeNode = input({"type": "range", "max": 255, "value": this._volume = track.volume, "onchange": () => rpc.musicPackTrackVolume(parent._name, parent.tracks.findIndex(t => t === this), parseInt(this.volumeNode.value))}),
					this.repeatNode = input({"type": "number", "min": -1, "value": this._repeat = track.repeat, "onchange": () => rpc.musicPackTrackRepeat(parent._name, parent.tracks.findIndex(t => t === this), parseInt(this.repeatNode.value))}),
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
			}
			get repeat() {
				return this._repeat;
			}
			set repeat(repeat: Int) {
				this._repeat = repeat;
			}
			remove() {
				const pos = this.parent.tracks.findIndex(t => t === this);
				this.parent.tracks.splice(pos, 1);
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
			node: HTMLLIElement;
			nameNode: HTMLSpanElement;
			titleNode: HTMLElement;
			volumeNode: HTMLInputElement;
			window: WindowElement;
			constructor(name: string, pack: MusicPack) {
				this.tracks = new SortNode<Track>(ul(), noSort);
				for (const track of pack.tracks) {
					this.tracks.push(new Track(this, track));
				}
				this._playTime = pack.playTime;
				const toPlay = animate({"attributeName": "d", "to": playIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"}) as SVGAnimateBeginElement,
				      toPause = animate({"attributeName": "d", "to": pauseIcon, "dur": "0.2s", "begin": "click", "fill": "freeze"}) as SVGAnimateBeginElement;
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
					svg({"style": "width: 1em", "viewBox": "0 0 90 90"}, [
						path({"d": this._playTime === 0 ? playIcon : pauseIcon, "style": "fill: currentColor", "stroke": "none", "fill-rule": "evenodd"}, [toPlay, toPause]),
						rect({"width": "100%", "height": "100%", "fill-opacity": 0, "onclick": () => {
							if (this._playTime === 0) {
								this._playTime = 1;
								toPause.beginElement();
							} else {
								this._playTime = 0;
								toPlay.beginElement();
							}

						}})
					]),
					br(),
					this.volumeNode = input({"type": "range", "max": 255, "value": this._volume = pack.volume, "onchange": () => rpc.musicPackSetVolume(this._name, parseInt(this.volumeNode.value))}),
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
			}
			set playTime(playTime: Uint) {
				this._playTime = playTime;
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
