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
	asset: Asset;
	funcs: AssetFuncs;
	constructor(asset: Asset) {
		this.asset = asset;
		this.funcs = {
			edit :() => {},
			remove: () => {}
		};
	}
	html(tagID: Int) {
		if (this.htmls.has(tagID)) {
			return this.htmls.get(tagID);
		}
		const ah = new AssetHTML(this.asset, this.funcs)
		this.htmls.set(tagID, ah);
		return ah;
	}
	rename(name: string) {
		this.asset.name = name;
		this.htmls.forEach(h => h.rename(name));
	}
	removeTag(tagID: Int){
		this.htmls.delete(tagID);
	}
}

type AssetFuncs = {
	edit: Function;
	remove: Function;
}

class AssetHTML {
	html: Node;
	constructor(asset: Asset, funcs: AssetFuncs) {
		this.html = createHTML("li", [
			createHTML("span", asset.name),
			createHTML("span", {"class": "assetCmds"}, [
				createHTML("span", "✍", {"class": "editAsset", "onclick": funcs.edit}),
				createHTML("span", "⌫", {"class": "removeAsset", "onclick": funcs.remove})
			])
		]);
	}
	rename(name: string) {
		//this.html.???
	}
}

class TagRoot {
	html: Node;
	list: SortHTMLType<TagFolder | AssetHTML>;
	constructor() {
		this.html = createHTML("ul");
		this.list = SortHTML<TagFolder | AssetHTML>(this.html, sortFnDate);
	}
	addTag(t: TagFolder) {

	}
	removeTag(t: TagFolder) {

	}
}

class TagFolder {
	html: Node;
	list: SortHTMLType<TagFolder | AssetHTML>;
	tag: Tag;
	parent?: TagFolder;
	controls: Node;
	constructor(tag: Tag) {
		const listHTML = createHTML("ul");
		this.list = SortHTML<TagFolder | AssetHTML>(listHTML, sortFn);
		this.controls = createHTML("span");
		this.html = createHTML("li", [
			createHTML("span", tag.name.split('/', 2)[0]),
			this.controls,
			listHTML
		]);
		this.tag = tag;
		if (tag.id !== -1) {
			tags.set(this.tag.id, this);
		}
	}
	setParent(t?: TagFolder) {
		this.parent = t;
		clearElement(this.controls);
		if (t) {
			createHTML(this.controls, [
				createHTML("span", "✍", {"class": "editTag", "onclick": () => this.rename()}),
				createHTML("span", "⌫", {"class": "removeTag", "onclick": function() {
				}})
			])
		}
	}
	setTag(tag: Tag) {
		this.tag = tag;
		tags.set(tag.id, this);
	}
	setNoTag() {
		tags.delete(this.tag.id);
		this.tag.id = -1;
	}
	addTag(t: TagFolder){
		const nextSlash = t.tag.name.indexOf("/", this.tag.name.length + 1),
		      nextTagName = nextSlash === -1 ? t.tag.name : t.tag.name.slice(0, nextSlash);
		let nextTag = this.list.find(e => e instanceof TagFolder ? e.tag.name === nextTagName : false);
		if (!nextTag && nextSlash !== -1) {
			nextTag = new TagFolder({id: -1, name: nextTagName, assets: []});
		}
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
	if (a instanceof AssetItem) {
		if (b instanceof AssetItem) {
			return strCompare(a.name, b.name);
		}
		return -1;
	}
	if (b instanceof AssetItem) {
		return 1;
	}
	return strCompare(a.name, b.name);
      },
      sortFnDate = (a: TagAsset, b: TagAsset) => {
	if (a instanceof AssetItem && b instanceof AssetItem) {
		if (a.id === b.id) {
			return 0;
		} else if (a.id < b.id) {
			return 1;
		}
		return -1;
	}
	return sortFn(a, b);
      },
      tags = new Map<Int, TagFolder>(),
      assets = new Map<Int, AssetItem>(),
      list = new TagFolder({id: -1, name: "", assets: []}),
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

