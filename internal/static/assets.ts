import {Int, RPC, Tag, Asset} from './types.js';
import {createHTML} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';
import SortHTML from './lib/ordered.js';

interface TagAsset {
	id: Int;
	name: string;
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
      assets = new Map<Int, AssetItem>();

class AssetItem {
	htmls = new Map<Int, AssetHTML>();
	editFn: () => void;
	asset: Asset;
	constructor(asset: Asset) {
		this.asset = asset;
		this.editFn = () => {
			
		};
	}
	html(tagID: Int) {
		if (this.htmls.has(tagID)) {
			return this.htmls.get(tagID);
		}
		const ah = new AssetHTML(this.asset)
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

class AssetHTML {
	html: Node;
	constructor(asset: Asset) {
		this.html = createHTML("li");
	}
	rename(name: string) {
		//this.html.???
	}
}

class TagFolder {
	html: Node;
	list: Array<any>;
	name: string;
	id: number;
	parent: TagFolder | null;
	constructor(name: string, tag: Tag, parent: TagFolder | null) {
		const listHTML = createHTML("ul");
		this.list = SortHTML<TagFolder | AssetHTML>(listHTML, parent == null ? sortFnDate : sortFn);
		this.html = createHTML("li", [
			createHTML("span", name.split('/', 2)[0]),
			name.indexOf('/') === -1 ? [
				//controls
			] : [],
			listHTML
		]);
		this.id = tag.id;
		this.name = name;
		this.parent = parent;
	}
	update(tag: Tag){}
	addTag(tag: Tag){}
	addAsset(asset: Asset){}
	removeAsset(asset: Asset){}
}

export default function(rpc: RPC, overlay: LayerType, base: Node): void {
	const [list, addTag, addAsset] = (() => {
		const node = createHTML("div");
		return [
			node,
			(tag: Tag) => {
				console.log(tag);
			},
			(asset: Asset) => {
				console.log(asset);
			}
		] as [Node, (tag: Tag) => void, (asset: Asset) => void];
	})();
	Promise.all([
		rpc.getTags(),
		rpc.getAssets()
	]).then(([tags, assets]) => {
		Object.values(tags).forEach(addTag);
		Object.values(assets).forEach(addAsset);
		base.appendChild(createHTML("button", "Add Tag", {"onclick": () => {
			createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
				createHTML("h1", "Add Tag"),
				createHTML("label", {"for": "newTagName"}, "New Name"),
				createHTML("input", {"id": "newTagName", "onkeypress": enterKey}),
				createHTML("button", "Add Tag", {"onclick": function(this: HTMLElement) {
					const name = (this.previousSibling as HTMLInputElement).value;
					overlay.loading(rpc.addTag(name).then(tag => {
						addTag({id: tag, name: name, assets: []});
						overlay.removeLayer();
					}, showError.bind(null, this)));
				}})
			]);
		}}));
		base.appendChild(createHTML("button", "Add", {"onclick": () => {
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
							assets.forEach(addAsset)
							overlay.removeLayer();
						}, showError.bind(null, this));
					}})
				])
			]);
		}}));
	});
}
