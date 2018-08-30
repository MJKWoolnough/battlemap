"use strict";
offer(async function(rpc, base, overlay) {
	let changed = false;
	const {createHTML, clearElement} = await include("html.js"),
	      {xmlHTTP} = await include("conn.js"),
	      tags = {}, tagList = {}, assets = {},
	      createAssetTag = function(asset, tag) {
		return createHTML(
			"li",
			{},
			[
				createHTML("span", tag.Name),
				createHTML(
					"span",
					"⌫",
					{
						"class": "removeTag",

						"onclick": function() {
							changed = true;
							rpc.request("Assets.RemoveAssetTag", {"AssetID": asset.ID, "TagID": tag.ID}).then(() => {
								asset.Tags = asset.Tags.filter(t => t !== tag.ID);
								tag.Assets = tag.Assets.filter(a => a !== asset.ID);
								this.parentNode.parentNode.removeChild(this.parentNode);
							})
						}
					}
				)
			]
		)
	      },
	      writeAssetLine = function(asset) {
		return createHTML("li",	{}, [
			createHTML(
				"span",
				asset.Name,
				{
					"class": "assetName",

					"onclick": function() {
						changed = false;
						createHTML(
							overlay.addLayer(),
							{},
							[
								createHTML("h1", 
									{},
									[
										createHTML("span", asset.Name),
										createHTML(
											"span",
											"✍",
											{
												"class": "rename",

												"onclick": function() {
													const name = prompt("New Name?", asset.Name);
													if (name === null || name === "" || name === asset.Name) {
														return;
													}
													asset.Name = name;
													rpc.request("Assets.RenameAsset", asset).then(n => {
														changed = true;
														asset.Name = n;
														this.previousSibling.innerText = n;
													});
												}
											}
										),
										createHTML(
											"span",
											"⌫",
											{
												"class": "delete",

												"onclick": function() {
													if (confirm("Sure you want to delete?")) {
														rpc.request("Assets.RemoveAsset", asset.ID);
														delete assets[asset.ID];
														Object.values(tags).forEach(t => t.Assets = t.Assets.filter(b => b !== asset.ID));
														changed = true;
														overlay.removeLayer();
													}
												}
											}
										)
									]
								),
								asset.Type === "audio" ? createHTML(
									"audio",
									{
										"controls": "controls",
										"src": `assets/${asset.ID}.${asset.Ext}`
									}
								) : asset.Type === "image" ? createHTML (
									"img",
									{
										"src": `assets/${asset.ID}.${asset.Ext}`,
										"style": "max-width: 50%; max-height: 50%;"
									}
								) : [],
								createHTML("br"),
								createHTML("label", {"for": "tags"}, "Add Tag: "),
								createHTML(
									"select",
									{
										"id": "tags",

										"onchange": function() {
											const val = parseInt(this.value);
											if (val >= 0 && !asset.Tags.includes(val)) {
												rpc.request("Assets.AddAssetTag", {"AssetID": asset.ID, "TagID": val}).then(() => {
													changed = true;
													asset.Tags.push(val);
													tags[val].Assets.push(asset.ID);
													document.getElementById("tagList").appendChild(createAssetTag(asset, tags[val]));
												});
											}
										}
									},
									[
										createHTML("option", {"value": "-1"}, "--Choose Tag--"),
										Object.values(tags).filter(t => t.ID >= 0).map(t => createHTML("option", {"value": t.ID}, t.Name))
									]
								),
								createHTML("h2", "Tags"),
								createHTML(
									"ul",
									{"id": "tagList"},
									asset.Tags.map(t => createAssetTag(asset, tags[t]))
								)
							]
						);
					}
				}
			)
		])
	      },
	      writeTags = function(prefix) {
		return Object.values(tags).filter(t => t.Name.substr(0, prefix.length) === prefix && t.Name.substr(prefix.length).indexOf('/') < 0).sort((a, b) => a.Name < b.Name ? -1 : 1).map(t => createHTML(
			"li",
			{
				"class": "tag",
			},
			[
				createHTML("label", {"for": "tag_" + t.Name}, t.Name.substr(prefix.length)),
				t.ID < 0 ? [] : [
					createHTML(
						"span",
						"✍",
						{
							"class": "rename",

							"onclick": function() {
								const name = prompt("New Name?", t.Name);
								if (name === null || name === "" || name === t.Name) {
									return;
								}
								t.Name = name;
								rpc.request("Assets.RenameTag", t).then(n => {
									t.Name = n;
									createPsuedoTags();
									writeList();
								});
							}
						}
					),
					createHTML(
						"span",
						"⌫",
						{
							"class": "delete",

							"onclick": function() {
								if (confirm("Sure you want to delete?")) {
									rpc.request("Assets.RemoveTag", t.ID);
									delete tags[t.ID];
									delete tagList[t.Name.toLowerCase()];
									Object.values(assets).forEach(a => a.Tags = a.Tags.filter(u => u !== t.ID));
									createPsuedoTags();
									writeList();
								}
							}
						}
					)
				],
				createHTML("input", {"type": "checkbox", "id": "tag_" + t.Name}),
				createHTML(
					"ul",
					{},
					[
						writeTags(t.Name+"/"),
						t.Assets.sort((a, b) => assets[a].Name < assets[b].Name ? -1 : 1).map(a => writeAssetLine(assets[a]))
					]
				)
			]
		));
	      },
	      writeList = function() {
		const container = document.getElementById("assetList");
		clearElement(container);
		writeTags("").concat(Object.values(assets).filter(a => a.Tags.length === 0).sort((a, b) => a.ID < b.ID ? 1 : -1).map(a => writeAssetLine(a))).forEach(c => container.appendChild(c));
	      },
	      buildHTML = function() {
		[document.getElementById("assetLoading")].filter(t => t != null).forEach(t => t.parentNode.removeChild(t));
		[
			createHTML(
				"label",
				"Add Tag",
				{
					"class": "button",

					"onclick": function() {
						const tag = prompt("Tag Name?", "");
						if (tag !== null && tag !== "") {
							const lTag = tag.toLowerCase();
							if (!tagList.hasOwnProperty(lTag) || tagList[lTag] < 0) {
								rpc.request("Assets.AddTag", tag).then(tag => {
									tags[tag.ID] = tag;
									const lName = tag.Name.toLowerCase();
									if (tagList.hasOwnProperty(lName)) {
										delete tags[tagList[lName]];
									}
									tagList[tag.Name.toLowerCase()] = tag.ID;
									createPsuedoTags();
									writeList();
								});
							} else {
								alert("Tag already exists!");
							}
						}
					}
				}
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
						"Upload Asset",
						{
							"class": "button",
							"for": "asset",
						}
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
								const bar = createHTML("progress", {"style": "width: 100%"}),
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
									xmlHTTP("/socket", {
										"method": "POST",
										"data": new FormData(this.parentNode),

										"progress": e => {
											bar.setAttribute("value", e.loaded);
											bar.setAttribute("max", e.total);
											bar.innerText = Math.floor(e.loaded*100/e.total) + "%";
										}
									}).then(responseText => {
										JSON.parse(xh.responseText).forEach(a => assets[a.ID] = a);
										clearElement(overlay);
										writeList();
									}, () => {
										progress.firstChild.innerText = "Upload Failed!"
									});
								};
							}())
						}
					),
				]
			),
			createHTML("ul", {"id": "assetList"})
		].forEach(e => base.appendChild(e));
		writeList();
	      },
	      createPsuedoTags = function() {
		let neg = -1;
		Object.values(tags).filter(t => t.ID < 0).forEach(t => {delete tags[t.ID]; delete tagList[t.Name.toLowerCase()]});
		Object.values(tags).forEach(t => {
			let tName = t.Name, i;
			while ((i = tName.lastIndexOf('/')) >= 0) {
				tName = tName.substr(0, i);
				const lName = tName.toLowerCase();
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
	      };
	Promise.all([
		rpc.request("Assets.ListTags"),
		rpc.request("Assets.ListAssets")
	]).then(data => {
		Object.assign(tags, data[0]);
		Object.values(tags).forEach(t => tagList[t.Name.toLowerCase()] = t.ID);
		createPsuedoTags();
		Object.assign(assets, data[1]);
		buildHTML();
	}, e => console.log(e));
});
