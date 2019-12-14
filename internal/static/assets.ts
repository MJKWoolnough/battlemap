import {Int, RPC, Tag, Asset} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';
import SortHTML, {SortHTMLType} from './lib/ordered.js';

let rpc: RPC, overlay: LayerType, p: Promise<void>;

interface TagAsset {
	id: Int;
	name: string;
}

class AssetItem {
	htmls = new Map<Int, AssetHTML>();
	editFn = () => this.edit();
	removeFn = () => this.remove();
	asset: Asset;
	constructor(asset: Asset) {
		this.asset = asset;
	}
	html(tagID: Int) {
		if (this.htmls.has(tagID)) {
			return this.htmls.get(tagID);
		}
		const ah = new AssetHTML(this.asset, this.editFn, this.removeFn)
		this.htmls.set(tagID, ah);
		return ah;
	}
	rename(name: string) {
		this.asset.name = name;
		this.htmls.forEach(h => h.rename());
	}
	removeTag(tagID: Int){
		this.htmls.delete(tagID);
	}
	edit() {

	}
	remove() {

	}
}

class AssetHTML {
	asset: Asset;
	html: Node;
	constructor(asset: Asset, editFn: Function, removeFn: Function) {
		this.asset = asset;
		this.html = createHTML("li", [
			createHTML("span", asset.name),
			createHTML("span", {"class": "assetCmds"}, [
				createHTML("span", "✍", {"class": "editAsset", "onclick": editFn}),
				createHTML("span", "⌫", {"class": "removeAsset", "onclick": removeFn})
			])
		]);
	}
	get name() {
		return this.asset.name;
	}
	rename() {
		(this.html.firstChild as HTMLElement).innerText = this.asset.name;
	}
}

class TagRoot {
	tags = new Map<string, TagFolder>();
	html = createHTML("ul");
	list = SortHTML<TagFolder | AssetHTML>(this.html, sortFnDate);
	getTag(tagName: string) {
		if (this.tags.has(tagName)) {
			const tf = this.tags.get(tagName) as TagFolder;
			return tf;
		}
		const tf = new TagFolder({"id": -1, "name": tagName, "assets": []}),
		      s = tagName.lastIndexOf("/"),
		      sn = s === -1 ? "" : tagName.slice(0, s);
		this.tags.set(tagName, tf);
		if (sn === "") {
			this.list.push(tf);
		} else {
			this.getTag(sn).list.push(tf);
		}
		return tf;
	}
	addTag(tf: TagFolder) {
		if (this.tags.has(tf.tag.name)) {
			const ttf = this.tags.get(tf.tag.name) as TagFolder;
			if (ttf.tag.id !== -1) {
				return;
			}
		}
		const s = tf.tag.name.lastIndexOf("/");
		if (s === -1) {
			this.list.push(tf);
		} else {
			const sn = tf.tag.name.slice(0, s);
			this.getTag(sn).list.push(tf);
		}
		this.tags.set(tf.tag.name, tf);
	}
	removeTag(t: TagFolder) {}
	addAsset(a: Asset) {}
}

class TagFolder {
	list: SortHTMLType<TagFolder | AssetHTML>;
	tag: Tag;
	parent?: TagFolder;
	controls: Node;
	html: Node;
	constructor(tag: Tag) {
		const listHTML = createHTML("ul"),
		      i = tag.name.lastIndexOf("/");
		this.list = SortHTML<TagFolder | AssetHTML>(listHTML, sortFn);
		this.controls = createHTML("span");
		this.html = createHTML("li", [
			createHTML("span", tag.name.slice(i === -1 ? 0 : i + 1)),
			this.controls,
			listHTML
		]);
		this.tag = tag;
		if (tag.id !== -1) {
			tags.set(this.tag.id, this);
		}
	}
	get name() {
		return this.tag.name;
	}
	setTag(tag: Tag) {
		this.tag = tag;
		tags.set(tag.id, this);
		createHTML(this.controls, [
			createHTML("span", "✍", {"class": "editTag", "onclick": () => this.rename()}),
			createHTML("span", "⌫", {"class": "removeTag", "onclick": function() {
			}})
		])
	}
	setNoTag() {
		tags.delete(this.tag.id);
		this.tag.id = -1;
		clearElement(this.controls);
	}
	addTag(t: TagFolder){
	}
	removeTag(tag: Int) {
	}
	addAsset(asset: Asset){
	}
	removeAsset(asset: Asset){

	}
	changeName(newName: string) {
		this.tag.name = newName;
		tags.get(this.tag.id)!.tag.name = newName;
		(this.parent as TagFolder).removeTag(this.tag.id);
		list.addTag(this);
	}
	rename() {
		const that = this;
		createHTML(overlay.addLayer(), {"class": "tagRename"}, [
			createHTML("h1", `Rename Tag: ${this.tag.name}`),
			createHTML("label", {"for": "tagRename"}, "New Name"),
			createHTML("input", {"type": "text", "id": "tagRename", "value": this.tag.name, "onkeypress": enterKey}),
			createHTML("button", "Rename", {"onclick": function(this: HTMLElement) {
				const newName = (this.previousSibling as HTMLInputElement).value;
				if (that.tag.name === newName) {
					overlay.removeLayer();
					return;
				}
				if (newName == "") {
					showError(this, "name cannot be nothing");
					return;
				}
				overlay.loading(rpc.renameTag(that.tag.id, newName)).then(name => {
					overlay.removeLayer();
					that.changeName(name);
				}).catch(e => showError(this, e));
			}})
		]);
	}
}

const strCompare = new Intl.Collator().compare,
      sortFn = (a: TagAsset, b :TagAsset) => {
	if (a instanceof AssetHTML) {
		if (b instanceof AssetHTML) {
			return strCompare(a.asset.name, b.asset.name);
		}
		return -1;
	}
	if (b instanceof AssetHTML) {
		return 1;
	}
	return strCompare(a.name, b.name);
      },
      sortFnDate = (a: TagAsset, b: TagAsset) => {
	if (a instanceof AssetHTML && b instanceof AssetHTML) {
		return a.asset.id - b.asset.id;
	}
	return sortFn(a, b);
      },
      tags = new Map<Int, TagFolder>(),
      assets = new Map<Int, AssetItem>(),
      list = new TagRoot(),
      cancellers = new Set<() => void>(),
      html = [
	createHTML("button", "Add Tag", {"onclick": () => {
		createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
			createHTML("h1", "Add Tag"),
			createHTML("label", {"for": "newTagName"}, "New Name"),
			createHTML("input", {"id": "newTagName", "onkeypress": enterKey}),
			createHTML("button", "Add Tag", {"onclick": function(this: HTMLElement) {
				const name = (this.previousSibling as HTMLInputElement).value;
				overlay.loading(rpc.addTag(name).then(tag => {
					list.addTag(new TagFolder({id: tag, name: name, assets: []}));
					overlay.removeLayer();
				}, showError.bind(null, this)));
			}})
		])
	}}),
	createHTML("button", "Add", {"onclick": () => {
		createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
			createHTML("h1", "Add Assets"),
			createHTML("form", {"enctype": "multipart/form-data", "method": "post"}, [
				createHTML("label", {"for": "addAssets"}, "Add Asset(s)"),
				createHTML("input", {"accept": "image/gif, image/png, image/jpeg, image/webp, application/ogg, audio/mpeg, text/html, text/plain, application/pdf, application/postscript", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: Node) {
					const bar = createHTML("progress", {"style": "width: 100%"}) as HTMLElement;
					overlay.loading(HTTPRequest("/assets", {
						"data": new FormData(this.parentNode as HTMLFormElement),
						"method": "POST",
						"response": "JSON",
						"onprogress": (e: ProgressEvent) => {
							if (e.lengthComputable) {
								bar.setAttribute("value", e.loaded.toString());
								bar.setAttribute("max", e.total.toString());
								bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
							}
						}
					}), createHTML("div", {"class": "loadBar"}, [
						createHTML("div", "Uploading file(s)"),
						bar
					])).then((assets: Asset[]) => {
						assets.forEach(list.addAsset.bind(list))
						overlay.removeLayer();
					}, showError.bind(null, this));
				}})
			])
		]);
	}}),
	list.html
      ];

export default Object.freeze({
	set rpc(r: RPC) {
		rpc = r;
		cancellers.forEach(fn => fn());
		cancellers.clear();
		[
			rpc.waitAssetAdd().then(() => {}),
			rpc.waitAssetChange().then(() => {}),
			rpc.waitAssetRemove().then(() => {}),
			rpc.waitTagAdd().then(() => {}),
			rpc.waitTagChange().then(() => {}),
			rpc.waitTagRemove().then(() => {})
		].forEach(s => cancellers.add(s.cancel.bind(s)));
		if (!p) {
			p = Promise.all([
				rpc.getTags(),
				rpc.getAssets()
			]).then(([tags, assets]) => {
				Object.values(tags).forEach(t => list.addTag(new TagFolder(t)));
				Object.values(assets).forEach(a => list.addAsset(a));
			});
		}
	},
	set overlay(o: LayerType) {
		overlay = o;
	},
	set base(b: Node) {
		createHTML(b, {"id": "assets"}, html);
	}
});

