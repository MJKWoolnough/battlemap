const[e,t,i,n,s,o,r,a,l,g,h,c,d]=await Promise.all(["/lib/dom.js","/lib/html.js","/lib/nodes.js","/lib/settings.js","/lib/svg.js","/ids.js","/keys.js","/language.js","/map.js","/map_tokens.js","/plugins.js","/shared.js","/windows.js"].map(include));let m="";const f=`data:image/svg+xml,%3Csvg xmlns="${s.ns}" viewBox="0 0 100 100"%3E%3Cg stroke="%23000"%3E%3Crect x="2" y="2" width="96" height="96" stroke-width="4" stroke-dasharray="20 8" fill="%2388f" /%3E%3Cpath d="M10,40 v-15 q0,-2 2,-2 h75 q2,0 2,2 v17 z" fill="%23aaa" /%3E%3Cpath d="M10,40 v30 q0,2 2,2 h75 q2,0 2,-2 v-30 z m5,-17 v-3 q0,-2 2,-2 h12 q2,0 2,2 v3 z" fill="%23333" /%3E%3Ccircle cx="50" cy="50" r="18" fill="%23888" /%3E%3Ccircle cx="50" cy="50" r="12" fill="%23111" /%3E%3Crect x="70" y="36" width="15" height="8" rx="1" fill="%23cc0" /%3E%3C/g%3E%3Crect x="86" width="3" y="23.5" height="48" fill="rgba(0, 0, 0, 0.25)" /%3E%3Crect x="82" width="3" y="36" height="8" fill="rgba(0, 0, 0, 0.25)" /%3E%3C/svg%3E`,u=(e,n,r,a)=>{const h=window.getComputedStyle(e);for(const e of h)if("display"===e&&"none"===h.getPropertyValue(e))return a;switch(e.nodeName){case"image":return a.then((()=>{n.setTransform(r.multiply(e.getCTM())),n.drawImage(e,0,0,parseInt(e.getAttribute("width")),parseInt(e.getAttribute("height"))),n.resetTransform()}));case"rect":if(e.getAttribute("fill")?.startsWith("url(#Pattern_")){const i=g.definitions.list.get(e.getAttribute("fill").slice(5,-1))?.firstChild;if(i instanceof SVGImageElement)return a.then((()=>{const s=n.fillStyle,o=parseInt(i.getAttribute("width")),a=parseInt(i.getAttribute("height")),l=t.canvas({width:o,height:a});l.getContext("2d").drawImage(i,0,0,o,a),n.fillStyle=n.createPattern(l,"repeat"),n.setTransform(r.multiply(e.getCTM())),n.fillRect(0,0,parseInt(e.getAttribute("width")),parseInt(e.getAttribute("height"))),n.resetTransform(),n.fillStyle=s}));break}case"polygon":case"ellipse":return a.then((()=>new Promise((o=>{const{width:r,height:a}=l.mapData;t.img({src:`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${s.ns}" width="${r}" height="${a}">${g.definitions[i.node].outerHTML}${e.outerHTML}</svg>`)}`,width:r,height:a,onload:function(){n.drawImage(this,0,0),o()}})}))));case"defs":return m='<script type="text/css">#lighting>*{mix-blend-mode:screen;}<\/script>'+e.outerHTML,a;case"g":const h=e.getAttribute("id");if(h===o.layerGrid)return E.value?a:a.then((()=>new Promise((i=>{const{width:o,height:r}=l.mapData;t.img({src:`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${s.ns}" width="${o}" height="${r}"><defs>${g.definitions.list.get("grid").outerHTML}</defs>${e.innerHTML}</svg>`)}`,width:o,height:r,onload:function(){n.drawImage(this,0,0),i()}})}))));if(h===o.layerLight){for(const i of e.childNodes)a=a.then((()=>new Promise((e=>{const{width:o,height:r}=l.mapData;t.img({src:`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${s.ns}" width="${o}" height="${r}">${m}${i.outerHTML.replace("mix-blend-mode","mix-blend-mod")}</svg>`)}`,onload:function(){n.globalCompositeOperation=i.style.getPropertyValue("mix-blend-mode")||"none",n.drawImage(this,0,0),n.globalCompositeOperation="source-over",e()}})}))));return a}if(e.classList.contains(o.hiddenLayer))return a}for(const t of e.children)a=u(t,n,r,a);return a},w=a.makeLangPack({ENABLE_GRID:"Show Grid on Screenshot",ENABLE_PNG:"Automatic PNG creation",ERROR_GENERATING:"Unknown error while generating PNG",KEY_SCREENSHOT:"Screenshot Key",SCREENSHOT_TAKE:"Take Screenshot"}),p=new n.BoolSetting("plugin-screenshot-png"),E=new n.BoolSetting("plugin-screenshot-grid"),v=()=>{const{width:i,height:n}=l.mapData,s=t.canvas({width:i,height:n,style:"max-width: 100%;max-height: 100%"}),o=s.getContext("2d"),r=(new DOMMatrix).scaleSelf(l.panZoom.zoom,l.panZoom.zoom,1,i/2,n/2).inverse(),g=new Date,h=`${g.getFullYear()}-${("0"+(g.getMonth()+1)).slice(-2)}-${("0"+g.getDate()).slice(-2)}_${("0"+g.getHours()).slice(-2)}-${("0"+g.getMinutes()).slice(-2)}-${("0"+g.getSeconds()).slice(-2)}`;let c=Promise.resolve();for(const e of l.root.children)c=u(e,o,r,c);c.then((()=>{const i=t.a({download:`${h}.png`},s),n=d.windows({"window-icon":f,"window-title":h},i);e.amendNode(d.shell,n),p.value||s.toBlob((t=>{if(t){const s=URL.createObjectURL(t);e.amendNode(i,{href:s}),e.amendNode(n,{onremove:()=>URL.revokeObjectURL(s)})}else n.alert(a.default.ERROR,w.ERROR_GENERATING,f)}))}))};h.addPlugin("screenshot",{settings:{fn:t.div([[[E,"ENABLE_GRID"],[p,"ENABLE_PNG"]].map((([e,i])=>[c.labels(t.input({type:"checkbox",class:o.settingsTicker,checked:!e.value,onchange:function(){e.set(!this.checked)}}),[w[i],": "]),t.br()])),t.button({onclick:v},w.SCREENSHOT_TAKE)])}}),r.registerKeyEvent("screenshot-key",w.KEY_SCREENSHOT,"PrintScreen",(e=>{v(),e.preventDefault()}))[0]();