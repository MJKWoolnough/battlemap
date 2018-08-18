"use strict";
window.addEventListener("load", function() {
	var tags = {}, tagList = {}, assets = {},
	    overlay = createHTML("div", {"id": "overlay"}),
	    writeAssetLine = function(asset) {
		return createHTML(
			"li",
			{},
			[
				createHTML("span", {}, asset.Name),
				createHTML(
					"span",
					{
						"class": "rename",

						"onclick": function() {
							var name = prompt("New Name?", asset.Name),
							    self = this;
							if (name === null || name === "" || name === asset.Name) {
								return;
							}
							asset.Name = name;
							rpc.request("Assets.RenameAsset", asset, function(n) {
								asset.Name = n;
								self.previousSibling.innerText = n;
							});
						}
					},
					"✍"
				),
				createHTML(
					"span",
					{
						"class": "delete",

						"onclick": function() {
							if (confirm("Sure you want to delete?")) {
								rpc.request("Assets.RemoveAsset", asset.ID);
								delete assets[asset.ID];
								Object.values(tags).forEach(t => t.Assets = t.Assets.filter(b => b !== asset.ID));
								this.parentNode.parentNode.removeChild(this.parentNode);
							}
						}
					},
					"⌫"
				)
			]
		)
	    },
	    writeTags = function(prefix) {
		return Object.values(tags).filter(t => t.Name.substr(0, prefix.length) === prefix && t.Name.substr(prefix.length).indexOf('/') < 0).sort((a, b) => a.Name < b.Name ? -1 : 1).map(t => createHTML(
			"li",
			{
				"class": "tag",
			},
			[
				createHTML(
					"label",
					{
						"for": "tag_" + t.Name
					},
					t.Name.substr(prefix.length),
				)
			].concat(
				t.ID < 0 ? [] : [
					createHTML(
						"span",
						{
							"class": "rename",

							"onclick": function() {
								var name = prompt("New Name?", t.Name);
								if (name === null || name === "" || name === t.Name) {
									return;
								}
								t.Name = name;
								rpc.request("Assets.RenameTag", t, function(n) {
									t.Name = n;
									createPsuedoTags();
									buildList();
								});
							}
						},
						"✍"
					),
					createHTML(
						"span",
						{
							"class": "delete",

							"onclick": function() {
								if (confirm("Sure you want to delete?")) {
									rpc.request("Assets.RemoveTag", t.ID);
									delete tags[t.ID];
									delete tagList[t.Name.toLowerCase()];
									Object.values(assets).forEach(a => a.Tags = a.Tags.filter(u => u !== t.ID));
									createPsuedoTags();
									buildList();
								}
							}
						},
						"⌫"
					)
				]
			).concat([
				createHTML(
					"input",
					{
						"type": "checkbox",
						"id": "tag_" + t.Name
					},
				),
				createHTML(
					"ul",
					{},
					writeTags(t.Name+"/").concat(t.Assets.sort((a, b) => assets[a].Name < assets[b].Name ? -1 : 1).map(a => writeAssetLine(a)))
				)
			])
		));
	    },
	    buildList = function() {
		clearElement(document.body);
		[
			createHTML(
				"label",
				{
					"class": "button",

					"onclick": function() {
						var tag = prompt("Tag Name?", "");
						if (tag !== null && tag !== "") {
							var lTag = tag.toLowerCase();
							if (!tagList.hasOwnProperty(lTag) || tagList[lTag] < 0) {
								rpc.request("Assets.AddTag", tag, function(tag) {
									tags[tag.ID] = tag;
									var lName = tag.Name.toLowerCase();
									if (tagList.hasOwnProperty(lName)) {
										delete tags[tagList[lName]];
									}
									tagList[tag.Name.toLowerCase()] = tag.ID;
									createPsuedoTags();
									buildList();
								});
							} else {
								alert("Tag already exists!");
							}
						}
					}
				},
				"Add Tag"
			),
			createHTML(
				"form",
				{
					"enctype": "multipart/form-data",
					"method": "post",
				},
				[
					createHTML(
						"label",
						{
							"class": "button",
							"for": "asset",
						},
						"Upload Asset"
					),
					createHTML(
						"input",
						{
							"accept": "image/gif, image/png, image/jpeg, image/webp, application/ogg, audio/mpeg, text/html, text/plain, application/pdf, application/postscript",
							"id": "asset",
							"multiple": "multiple",
							"name": "asset",
							"style": "display: none",
							"type": "file",

							"onchange": (function() {
								var bar = createHTML("progress", {"style": "width: 100%"}),
								    progress = createHTML(
									"div",
									{},
									[
										createHTML("h1", {}, "Uploading File(s)"),
										bar,
									]
								    );
								return function(e) {
									bar.setAttribute("value", 0);
									bar.setAttribute("max", 0);
									clearElement(overlay);
									overlay.appendChild(progress);
									var xh = new XMLHttpRequest();
									xh.upload.addEventListener("progress", function(e) {
										bar.setAttribute("value", e.loaded);
										bar.setAttribute("max", e.total);
										bar.innerText = Math.floor(e.loaded*100/e.total) + "%";
									});
									xh.addEventListener("readystatechange", function() {
										if(xh.readyState === 4) {
											if (xh.status === 200) {
												JSON.parse(xh.responseText).forEach(a => assets[a.ID] = a);
												clearElement(overlay);
												buildList();
											} else {
												progress.firstChild.innerText = "Upload Failed!"
											}
										}
									});
									xh.open("POST", "/socket");
									xh.send(new FormData(this.parentNode));
								};
							}())
						}
					)
				]
			),
			createHTML(
				"ul", 
				{},
				writeTags("").concat(
					Object.values(assets).filter(a => a.Tags.length === 0).sort((a, b) => a.ID < b.ID ? 1 : -1).map(a => writeAssetLine(a))),
			),
			overlay
		].forEach(e => document.body.appendChild(e));
	    },
	    createPsuedoTags = function() {
		var neg = -1;
		Object.values(tags).filter(t => t.ID < 0).forEach(t => {delete tags[t.ID]; delete tagList[t.Name.toLowerCase()]});
		Object.values(tags).forEach(t => {
			var tName = t.Name, i;
			while ((i = tName.lastIndexOf('/')) >= 0) {
				tName = tName.substr(0, i);
				var lName = tName.toLowerCase();
				if (!tagList.hasOwnProperty(lName)) {
					tags[neg] = {
						"ID": neg,
						"Name": tName,
						"Assets": [],
					}
					tagList[lName] = neg;
					neg--;
				} else {
					break;
				}
			}
		})
	    },
	    rpc = new RPC("/socket", function() {
		var wg = new waitGroup(buildList);
		wg.add(2);
		rpc.request("Assets.ListTags", null, function(data) {
			tags = data;
			Object.values(tags).forEach(t => tagList[t.Name.toLowerCase()] = t.ID);
			createPsuedoTags();
			wg.done();
		});
		rpc.request("Assets.ListAssets", null, function(data) {
			assets = data;
			wg.done();
		});
	});
});
