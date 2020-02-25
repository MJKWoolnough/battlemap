import {Int, RPC, FolderRPC, FolderItems, FromTo, IDName, LayerType} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {audio, br, button, div, form, h1, img, input, label, li, option, progress, span, select, ul} from './lib/dom.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';
import {SortHTML, stringSort} from './lib/ordered.js';
import folderInit, {Root, Folder, Item, getPaths} from './folders.js';

class Asset implements Item {
	id: Int;
	name: string;
	parent: Folder;
	html: HTMLElement;
	constructor(parent: Folder, id: Int, name: string) {
		this.id = id;
		this.name = name;
		this.parent = parent;
		const self = this, root = parent.root;
		this.html = li([
			span(name, {"class": "asset", "onclick": () => {
				const overlay = root.overlay;
				return createHTML(root.overlay.addLayer(), {"class": "showAsset"}, [
					h1(self.name),
					root.fileType === "Images" ? [
						img({"src": `/images/${self.id}`})
					] : [
						audio({"src": `/audio/${self.id}`, "controls": "controls"})
					]
				]);
			}}),
			span("~", {"class": "assetRename", "onclick": () => {
				const overlay = root.overlay,
				      parentPath = self.parent.getPath() + "/",
				      paths: HTMLOptionElement[] = [],
				      parents = select({"id": "folderName"}, getPaths(root.folder, "/").map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
				      newName = input({"type": "text", "value": self.name});
				return createHTML(root.overlay.addLayer(), {"class": "renameAsset"}, [
					h1("Move Folder"),
					div(`Old Location: ${parentPath}${self.name}`),
					label({"for": "folderName"}, "New Location: "),
					parents,
					newName,
					br(),
					button("Move", {"onclick": () => overlay.loading(root.rpcFuncs.move(parentPath + self.name, parents.value + newName.value)).then(newPath => {
						root.moveItem(parentPath + self.name, newPath);
						overlay.removeLayer();
					}).catch(e => showError(newName, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				])

			}}),
			span("+", {"class": "assetLink", "onclick": () => {
				const overlay = root.overlay,
				      parentPath = self.parent.getPath() + "/",
				      paths: HTMLOptionElement[] = [],
				      parents = select({"id": "folderName"}, getPaths(root.folder, "/").map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
				      newName = input({"type": "text", "value": self.name});
				return createHTML(root.overlay.addLayer(), {"class": "linkAsset"}, [
					h1("Add Link"),
					div(`Current Location: ${parentPath}${self.name}`),
					label({"for": "folderName"}, "New Link: "),
					parents,
					newName,
					br(),
					button("Link", {"onclick": () => overlay.loading(root.rpcFuncs.link(self.id, parents.value + newName.value)).then(newPath => {
						root.addItem(self.id, newPath);
						overlay.removeLayer();
					}).catch(e => showError(newName, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				])

			}}),
			span("-", {"class": "assetRemove", "onclick": () => {
				const root = self.parent.root,
				      overlay = root.overlay,
				      path = self.parent.getPath() + "/" + self.name,
				      pathDiv = div(path);
				return createHTML(overlay.addLayer(), {"class": "removeAsset"}, [
					h1("Remove Asset"),
					div("Remove the following asset?"),
					pathDiv,
					button("Yes, Remove!", {"onclick": () => overlay.loading(root.rpcFuncs.remove(path)).then(() => {
						root.removeItem(path);
						overlay.removeLayer();
					}).catch(e => showError(pathDiv, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				]);
			}})
		]);
		this.parent = parent;
	}
}

export default function (rpc: RPC, overlay: LayerType, base: Node, fileType: "Images" | "Audio") {
	folderInit(fileType == "Audio" ? rpc["audio"] : rpc["images"], overlay, base, fileType, Asset, (root: Root)  => button(`Upload ${fileType}`, {"onclick": () => createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
		h1(`Upload ${fileType}`),
		form({"enctype": "multipart/form-data", "method": "post"}, [
			label({"for": "addAssets"}, "Add Asset(s)"),
			input({"accept": fileType === "Images" ? "image/gif, image/png, image/jpeg, image/webp" : "application/ogg, audio/mpeg", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: Node) {
				const bar = progress({"style": "width: 100%"}) as HTMLElement;
				overlay.loading(HTTPRequest(`/${fileType.toLowerCase()}/`, {
					"data": new FormData(this.parentNode as HTMLFormElement),
					"method": "POST",
					"response": "json",
					"onprogress": (e: ProgressEvent) => {
						if (e.lengthComputable) {
							bar.setAttribute("value", e.loaded.toString());
							bar.setAttribute("max", e.total.toString());
							bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
						}
					}
				}), div({"class": "loadBar"}, [
					div("Uploading file(s)"),
					bar
				])).then((assets: Record<string, Int>) => {
					Object.entries(assets).forEach(([name, id]) => root.addItem(id, name))
					overlay.removeLayer();
				}, showError.bind(null, this));
			}})
		])
	])}));
};
