"use strict";
offer(async function(rpc, base, overlay) {
	let changed = false;
	const {createHTML, clearElement} = await include("html.js"),
	      {HTTPRequest} = await include("conn.js"),
	      {showError, enterKey} = await include("misc.js"),
	      assetList = (function() {
		const asset = function(a) {
			const details = function() {
				const allTags = tagList.getAll(),
				      tagOptions = () => {
					const df = document.createDocumentFragment();
					df.appendChild(createHTML("option", "Select a Tag"));
					allTags.filter(t => t.id > 0 && !a.Tags.includes(t.id)).forEach(t => df.appendChild(createHTML("option", {"value": t.id}, t.name)))
					return df;
				      },
				      createTagLine = function(t) {
					return createHTML(
						"li",
						{},
						[
							createHTML("span", t.name),
							createHTML(
								"span",
								{
									"class": "delete",

									"onclick": function() {
										overlay.loading(rpc.request("Assets.RemoveAssetTag", {"AssetID": a.ID, "TagID": t.id})).then(() => {
											const s = this.parentNode.parentNode.parentNode.getElementsByTagName("select")[0];
											this.parentNode.parentNode.removeChild(this.parentNode);
											clearElement(s);
											t.removeAsset(as);
											a.Tags.splice(a.Tags.indexOf(t.id), 1);
											tagHTML.delete(t.id);
											if (a.Tags.length === 0) {
												tagList.get(0).addAsset(as);
											}
											s.appendChild(tagOptions());
										}, showError.bind(null, this));
									}
								},
								"⌫"
							)
						]
					);
				      };
				createHTML(
					overlay.addLayer(),
					{
						"class": "assetDetails"
					},
					[
						createHTML(
						      "h1",
						      {},
						      [
							createHTML("span", a.Name),
							createHTML(
								"span",
								"✍",
								{
									"class": "rename",

									"onclick": function() {
										createHTML(
											overlay.addLayer(),
											{
												"class": "assetRename"
											},
											[
												createHTML("h1", "Rename: " + a.Name),
												createHTML(
													"label",
													{
														"for": "assetRename"
													},
													"New Name"
												),
												createHTML(
													"input",
													{
														"id": "assetRename",
														"type": "text",
														"value": a.Name,

														"onkeypress": enterKey
													}
												),
												createHTML(
													"button",
													"Rename",
													{
														"onclick": function() {
															const oldName = a.Name,
															      newName = this.previousSibling.value;
															if (oldName === newName) {
																overlay.removeLayer();
																return;
															}
															a.Name = newName;
															overlay.loading(rpc.request("Assets.RenameAsset", a)).then(name => {
																overlay.removeLayer();
																a.Name = name;
																if (name !== oldName) {
																	this.previousSibling.textContent = name;
																	tagHTML.forEach(h => h.firstChild.textContent = name);
																	a.Tags.forEach(tid => {
																		const t = tagList.get(tid);
																		t.removeAsset(as)
																		t.addAsset(as)
																	});
																}
															}, e => {
																a.Name = oldName;
																showError(this, e);
															});
														}
													}
												)
											]
										);
									}
								}
							),
							createHTML(
								"span",
								"⌫",
								{
									"class": "delete",

									"onclick": function() {
										createHTML(
											overlay.addLayer(),
											{
												"class": "assetDelete"
											},
											[
												createHTML("span", `Are you sure you wish to delete this asset: ${a.Name}? This cannot be undone!`),
												createHTML("br"),
												createHTML(
													"button",
													"Yes",
													{
														"onclick": function() {
															overlay.loading(rpc.request("Assets.RemoveAsset", a.ID)).then(() => {
																if (a.Tags.length === 0) {
																	tagList.get(0).removeAsset(as);
																} else {
																	a.Tags.forEach(tid => tagList.get(tid).removeAsset(as));
																}
																overlay.removeLayer();
																overlay.removeLayer();
															}).catch(showError.bind(null, this));
														}
													}
												),
												createHTML(
													"button",
													"No",
													{
														"onclick": overlay.removeLayer
													}
												)
											]

										)
									}
								}
							)
						      ]
						),
						a.Type === "image" ? createHTML(
							"img",
							{
								"src": `assets/${a.ID}.${a.Ext}`,
								"style": "max-width: 50%; max-height: 50%;"
							}
						) : a.Type === "audio" ? createHTML(
							"audio",
							{
								"controls": "controls",
								"src": `assets/${asset.ID}.${asset.Ext}`
							}
						) : [],
						createHTML("h2", "Tags"),
						createHTML(
							"select",
							{
								"onchange": function() {
									const val = parseInt(this.value);
									overlay.loading(rpc.request("Assets.AddAssetTag", {"AssetID": a.ID, "TagID": val})).then(() => {
										if (a.Tags.length === 0) {
											tagList.get(0).removeAsset(as);
										}
										a.Tags.push(val);
										const tag = tagList.get(val);
										tagHTML.set(val, html());
										tag.addAsset(as);
										this.parentNode.getElementsByTagName("ul")[0].appendChild(createTagLine(tag));
									}, showError.bind(null, this));
								}
							},
							tagOptions()
						),
						createHTML(
							"ul",
							{},
							allTags.filter(t => a.Tags.includes(t.id)).map(t => createTagLine(t))
						)
					]
				);
			      },
			      html = function() {
				return createHTML( 
					"li",
					{
						"class": "assetName"
					},
					createHTML(
						"span",
						{
							"onclick": details
						},
						a.Name
					)
				);
			      },
			      tagHTML = new Map(a.Tags.map(t => [t, html()])),
			      as = Object.freeze({
				"id": a.ID,
				get name() {return a.Name;},
				"removeTag": tid => {
					a.Tags.splice(a.Tags.indexOf(tid), 1);
					tagHTML.delete(tid);
					if (a.Tags.length === 0) {
						tagList.get(0).addAsset(as);
					}
				},
				"html": tid => tagHTML.get(tid)
			      });
			tagHTML.set(0, html());
			a.Tags.forEach(tid => tagList.get(tid).addAsset(as));
			if (a.Tags.length === 0) {
				tagList.get(0).addAsset(as);
			}
			return as;
		      };
		let base;
		return Object.freeze({
			"add": asset
		});
	      }()),
	      tagList = (function() {
		let uID = -1, bID = 0;
		const tags = new Map(), tagNames = new Map(),
		      tag = function(t) {
			bID++;
			const s = createHTML("ul"),
			      h = t.ID === 0 ? s : createHTML(
				"li",
				{
					"class": "tag"
				},
				[
					createHTML(
						"label",
						t.Name.split("/").pop(),
						{
							"for": "tag_" + bID
						}
					),
					t.ID > 0 ? [
						createHTML(
							"span",
							"✍",
							{
								"class": "rename",

								"onclick": function() {
									const renamer = this;
									createHTML(
										overlay.addLayer(),
										{
											"class": "tagRename"
										},
										[
											createHTML("h1", "Rename: " + t.Name),
											createHTML(
												"label",
												{
													"for": "tagRename"
												},
												"New Name"
											),
											createHTML(
												"input", {
													"id": "tagRename",
													"type": "text",
													"value": t.Name,

													"onkeypress": enterKey
												}
											),
											createHTML(
												"button",
												"Rename",
												{
													"onclick": function() {
														const oldName = t.Name,
														      newName = this.previousSibling.value;
														if (oldName === newName) {
															overlay.removeLayer();
															return;
														}
														t.Name = newName;
														overlay.loading(rpc.request("Assets.RenameTag", t)).then(name => {
															overlay.removeLayer();
															if (name !== oldName) {
																tags.delete(t.ID);
																if (childTags.length === 0) {
																	p.removeTag(at);
																	tagNames.delete(oldName);
																	t.Name = name;
																	const bt = tag(t);
																	assets.forEach(bt.addAsset);
																} else {
																	t.Name = oldName;
																	const bt = tag({
																		"ID": t.ID,
																		"Name": name,
																		"Assets": t.Assets
																	});
																	assets.forEach(bt.addAsset);
																	t.ID = uID--;
																	t.Assets = [];
																	tags.set(t.ID, at);
																	assets.splice(0, assets.length);
																	renamer.parentNode.removeChild(renamer.nextSibling);
																	renamer.parentNode.removeChild(renamer);
																}
															}
														}, e => {
															t.Name = oldName;
															showError(this, e);
														});
													}
												}
											)
										]
									);

								}
							}
						),
						createHTML(
							"span",
							"⌫",
							{
								"class": "delete",

								"onclick": function() {
									createHTML(
										overlay.addLayer(),
										{
											"class": "tagDelete"
										},
										[
											createHTML("div", `Are you sure you wish to delete this tag: ${t.Name}? This cannot be undone!`),
											createHTML(
												"button",
												"Yes",
												{
													"onclick": () => {
														overlay.loading(rpc.request("Assets.RemoveTag", t.ID)).then(() => {
															overlay.removeLayer();
															Array.from(assets).forEach(a => {
																at.removeAsset(a);
																a.removeTag(at)
															});
															tags.delete(t.ID);
															if (childTags.length === 0) {
																p.removeTag(at);
																return;
															}
															this.parentNode.removeChild(this.previousSibling);
															this.parentNode.removeChild(this);
															assets.splice(0, assets.length);
															t.ID = uID--;
															tags.set(t.ID, at);
														}, showError.bind(null, this));
													}
												}
											),
											createHTML(
												"button",
												"No",
												{
													"onclick": overlay.removeLayer
												}
											)
										]
									);
								}
							}
						)
					] : [],
					createHTML("input", {"type": "checkbox", "id": "tag_" + bID}),
					s
				]
			      ),
			      childTags = [],
			      assets = [],
			      p = getParentTag(t.Name),
			      at = Object.freeze({
				get id() {return t.ID},
				get parent() {return p;},
				"childTags": childTags,
				"addTag": at => {
					let pos = 0;
					for (; pos < childTags.length; pos++) {
						if (at.name.localeCompare(childTags[pos].name) < 0) {
							break;
						}
					}
					if (pos === childTags.length) {
						if (assets.length === 0) {
							s.appendChild(at.html);
						} else {
							s.insertBefore(at.html, assets[0].html(t.ID));
						}
						childTags.push(at);
					} else {
						s.insertBefore(at.html, s.childNodes[pos]);
						childTags.splice(pos, 0, at);
					}
				},
				"removeTag": bt => {
					s.removeChild(bt.html);
					childTags.splice(childTags.indexOf(bt), 1);
					if (t.ID < 0 && childTags.length === 0) {
						tags.delete(t.ID);
						tagNames.delete(t.Name);
						p.removeTag(at);
					}
				},
				"addAsset": a => {
					let pos = 0;
					for (; pos < assets.length; pos++) {
						if (t.ID === 0) {
							if (a.id > assets[pos].id)  {
								break;
							}
						} else if (a.name.localeCompare(assets[pos].name) < 0) {
							break;
						}
					}
					if (pos === assets.length) {
						s.appendChild(a.html(t.ID));
					} else {
						s.insertBefore(a.html(t.ID), assets[pos].html(t.ID));
					}
					assets.splice(pos, 0, a);
				},
				"removeAsset": a => {
					assets.splice(assets.indexOf(a), 1);
					s.removeChild(a.html(t.ID))
				},
				"html": h,
				get name() { return t.Name;}
			      });
			if (tagNames.has(t.Name)) {
				const oTag = tagNames.get(t.Name);
				Array.from(oTag.childTags).forEach(ot => {
					oTag.removeTag(ot);
					at.addTag(ot);
				});
				tags.delete(oTag.id);
				p.addTag(at);
			} else if (p) {
				p.addTag(at);
			}
			tags.set(t.ID, at);
			tagNames.set(t.Name, at);
			return at
		      },
		      getParentTag = function(name) {
			if (!name.includes("/")) {
				return tags.get(0);
			}
			const pName = name.substring(0, name.lastIndexOf("/"));
			if (tagNames.has(pName)) {
				return tagNames.get(pName);
			}
			const t = tag({
				"ID": uID--,
				"Name": pName,
				"Assets": []
			});
			return t;
		      };
		tags.set(0, tag({
		      "ID": 0,
		      "Name": "",
		      "Assets": []
		}));
		return Object.freeze({
			"add": tag,
			"get": tags.get.bind(tags),
			"getAll": () => Array.from(tags.values())
		});
	      }());
	return Promise.all([
		rpc.request("Assets.ListAssets"),
		rpc.request("Assets.ListTags")
	]).then(([assets, tags]) => {
		base.appendChild(createHTML(
			"button",
			"Add Tag",
			{
				"onclick": function() {
					createHTML(
						overlay.addLayer(),
						{
							"class": "tagAdd"
						},
						[
							createHTML("h1", "Add Tag"),
							createHTML(
								"label",
								{
									"for": "newTagName"
								},
								"New Name"
							),
							createHTML(
								"input",
								{
									"id": "newTagName",

									"onkeypress": enterKey
								}
							),
							createHTML(
								"button",
								{
									"onclick": function() {
										overlay.loading(rpc.request("Assets.AddTag", this.previousSibling.value)).then(tag => {
											tagList.add(tag);
											overlay.removeLayer();
										}, showError);
									}
								},
								"Add Tag"
							)
						]
					);
				}
			}
		));
		base.appendChild(createHTML(
			"button",
			"Add Asset(s)",
			{
				"onclick": function() {
					createHTML(
						overlay.addLayer(),
						{
							"class": "assetAdd"
						},
						[
							createHTML("h1", "Add Assets"),
							createHTML(
								"form",
								{
									"enctype": "multipart/form-data",
									"method": "post"
								},
								[
									createHTML(
										"label",
										"Add Asset(s)",
										{
											"for": "addAssets"
										}
									),
									createHTML(
										"input",
										{
											"accept": "image/gif, image/png, image/jpeg, image/webp, application/ogg, audio/mpeg, text/html, text/plain, application/pdf, application/postscript",
											"id": "addAssets",
											"multiple": "multiple",
											"name": "asset",
											"type": "file",

											"onchange": function() {
												const bar = createHTML("progress", {"style": "width: 100%"});
												overlay.loading(
													HTTPRequest("/socket", {
														"data": new FormData(this.parentNode),
														"method": "POST",
														"response": "JSON",

														"onprogress": e => {
															if (e.lengthComputable) {
																bar.setAttribute("value", e.loaded);
																bar.setAttribute("max", e.total);
																bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
															}
														}
													}),
													createHTML(
														"div",
														{
															"class": "loadBar"
														},
														[
															createHTML("div", {}, "Uploading file(s)"),
															bar
														]
													)
												).then(assets => {
													assets.forEach(assetList.add);
													overlay.removeLayer();
												}, showError.bind(null, this));
											}
										}
									)
								]
							)
						]
					);
				}
			}
		));
		const al = document.getElementById("assetLoading");
		if (al) {
			al.textContent = "Assets";
		}
		tags.forEach(tagList.add);
		assets.forEach(assetList.add);
		base.appendChild(tagList.get(0).html);
	}, e => console.log(e));
});
