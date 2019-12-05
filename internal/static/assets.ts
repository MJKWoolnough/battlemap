import {Int, RPC, Tag, Asset} from './types.js';
import {createHTML} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';
import SortHTML, {SortHTMLType} from './lib/ordered.js';

interface TagAsset {
	id: Int;
	name: string;
}

export default function(rpc: RPC, overlay: LayerType, base: Node): Promise<void> {
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

	class TagFolder {
		html: Node;
		list: SortHTMLType<TagFolder | AssetHTML>;
		name: string;
		id: number;
		parent: TagFolder | null;
		constructor(name: string, parent: TagFolder | null) {
			const listHTML = createHTML("ul");
			this.list = SortHTML<TagFolder | AssetHTML>(listHTML, parent == null ? sortFnDate : sortFn);
			this.html = parent === null ? listHTML : createHTML("li", [
				createHTML("span", name.split('/', 2)[0]),
				name.indexOf('/') === -1 ? [
					createHTML("span", "✍", {"class": "editAsset", "onclick": () => this.rename()}),
					createHTML("span", "⌫", {"class": "removeAsset", "onclick": function() {

					}})
				] : [],
				listHTML
			]);
			this.id = -1;
			this.name = name;
			this.parent = parent;
		}
		setTag(tag: Tag) {
			if (this.id === -1) {
				this.id = tag.id;
				tags.set(tag.id, this);
			}
		}
		setNoTag() {
			if (this.id !== -1) {
				tags.delete(this.id);
				this.id = -1;
			}
		}
		addTag(name: string, tag: Tag){
			const s = name.indexOf('/');
			let thisName = name;
			if (s > -1) {
				thisName = name.slice(0, s);
			}
			let tagf = this.list.find(e => e instanceof TagFolder && e.name === thisName) as TagFolder;
			if (!(tagf instanceof TagFolder)) {
				tagf = new TagFolder(name, this);
				this.list.push(tagf);
			}
			if (s === -1) {
				tagf.setTag(tag);
			} else {
				tagf.addTag(name.slice(s+1), tag);
			}
		}
		removeTag(tag: Int) {

		}
		addAsset(asset: Asset){

		}
		removeAsset(asset: Asset){

		}
		changeName(newName: string) {
			this.name = newName;
			tags.get(this.id)!.name = newName;
			(this.parent as TagFolder).removeTag(this.id);
			list.addTag(newName, {id: this.id, name: newName, assets: []});

		}
		rename() {
			const that = this;
			createHTML(overlay.addLayer(), {"class": "tagRename"}, [
				createHTML("h1", `Rename Tag: ${this.name}`),
				createHTML("label", {"for": "tagRename"}, "New Name"),
				createHTML("input", {"type": "text", "id": "tagRename", "value": this.name, "onkeypress": enterKey}),
				createHTML("button", "Rename", {"onclick": function(this: HTMLElement) {
					const newName = (this.previousSibling as HTMLInputElement).value;
					if (that.name === newName) {
						overlay.removeLayer();
						return;
					}
					if (newName == "") {
						showError(this, "name cannot be nothing");
						return;
					}
					overlay.loading(rpc.renameTag(that.id, newName)).then(name => {
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
	      list = new TagFolder("", null);


	return Promise.all([
		rpc.getTags(),
		rpc.getAssets()
	]).then(([tags, assets]) => {
		Object.values(tags).forEach(t => list.addTag(t.name, t));
		Object.values(assets).forEach(a => list.addAsset(a));
		createHTML(base, {"id": "assets"}, [
			createHTML("button", "Add Tag", {"onclick": () => {
				createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
					createHTML("h1", "Add Tag"),
					createHTML("label", {"for": "newTagName"}, "New Name"),
					createHTML("input", {"id": "newTagName", "onkeypress": enterKey}),
					createHTML("button", "Add Tag", {"onclick": function(this: HTMLElement) {
						const name = (this.previousSibling as HTMLInputElement).value;
						overlay.loading(rpc.addTag(name).then(tag => {
							list.addTag(name, {id: tag, name: name, assets: []});
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
		]);
	});
}
