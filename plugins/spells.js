const[e,t,n,a,l,s,i,o,r,d,c,p,h,m,E,f,u]=await Promise.all(["/lib/css.js","/lib/dom.js","/lib/events.js","/lib/html.js","/lib/misc.js","/lib/svg.js","/colours.js","/ids.js","/keys.js","/language.js","/map.js","/map_fns.js","/map_tokens.js","/rpc.js","/settings.js","/shared.js","/tools.js"].map(include)),g={stroke:"#f00",fill:"rgba(255, 0, 0, 0.5)",style:"clip-path: none; pointer-events: none;"},L=s.circle(),v=s.g(g,L),P=s.path(),_=s.g(g,P),S=s.rect(),T=s.g(g,S),k=s.rect(),y=s.g(g,k),Y=s.rect(),b=s.g(g,Y),I=[v,_,T,y,b],N=new Map([[_,P],[T,S],[y,k],[b,Y]]),M=(e,n)=>{const{gridSize:a,gridDistance:l}=c.mapData,s=a*e/(l||1),i=s>>1,o=a*n/(l||1);t.amendNode(L,{r:s}),t.amendNode(P,{d:`M0,0 L${s},-${i} q${.425*s},${i} 0,${s} z`}),t.amendNode(S,{x:-i,y:-i,width:s,height:s}),t.amendNode(k,{x:0,y:-o/2,width:s,height:o}),t.amendNode(Y,{x:-i,y:-o/2,width:s,height:o})},$=["#ff0000","#ddddff","#00ff00","#0000ff","#ffffff","#000000","#ffff00","#996622","#000000"].map(((e,t)=>[i.hex2Colour(e),i.hex2Colour(e,8===t?255:128)]));let j=20,D=5;if(m.isAdmin){let i=v,g=!1,L=0,P=0,S=0,k=0,Y=!1,C=!1;const A=d.makeLangPack({ADD_SPELL:"Add Spell to Map",DAMAGE_TYPE:"Damage Type",SPELL_SIZE:"Spell Size",SPELL_TYPE:"Spell Shape",SPELL_TYPE_CIRCLE:"Circle Spell",SPELL_TYPE_CONE:"Cone Spell",SPELL_TYPE_CUBE:"Cube Spell",SPELL_TYPE_LINE:"Line Spell",SPELL_TYPE_WALL:"Wall Spell",SPELL_WIDTH:"Spell Width",TITLE:"Spell Effects",TYPE_0:"Fire",TYPE_1:"Ice",TYPE_2:"Acid",TYPE_3:"Water",TYPE_4:"Steam",TYPE_5:"Necrotic",TYPE_6:"Lightning",TYPE_7:"Earth",TYPE_8:"Darkness"}),w=e.id(),x=e=>{i!==e&&i.parentNode&&i.replaceWith(e),i=e,i!==_&&i!==y||z(),t.amendNode(ee,{style:{"--spell-display":i===y||i===b?"block":""}})},W=()=>m.rpc.broadcast({type:"plugin-spells",data:[I.indexOf(i)??0,j,D,L,P,S,k]}),O=()=>m.rpc.broadcast({type:"plugin-spells",data:null}),z=()=>{const{token:e}=h.selected;e?(t.amendNode(i,{transform:`translate(${L=Math.round(e.x+e.width/2)}, ${P=Math.round(e.y+e.height/2)})`}),i.parentNode||t.amendNode(c.root,i)):(_.remove(),y.remove())},G=a.input({type:"checkbox",checked:E.autosnap.value,class:o.settingsTicker}),q=()=>G.click(),[R,B]=n.keyEvent("Shift",q,q),[U,X]=n.mouseDragEvent(0,void 0,(()=>C=!1)),[H,K]=n.mouseDragEvent(2,void 0,(()=>{Y=!1,O()})),[Z,F]=n.mouseMoveEvent((e=>{if(C||i===_||i===y){const[n,a]=c.screen2Grid(e.clientX,e.clientY,G.checked);t.amendNode(N.get(i),{transform:`rotate(${S=l.mod(Math.round(180*Math.atan2(a-P,n-L)/Math.PI),360)})`})}else[L,P]=c.screen2Grid(e.clientX,e.clientY,G.checked),t.amendNode(i,{transform:`translate(${L}, ${P})`});Y&&W()}),(()=>g=!1)),J=()=>{if(i!==_&&i!==y){const{layer:e}=h.selected;if(e){const{gridSize:t,gridDistance:n}=c.mapData,a=(i===v?2:1)*t*j/n,s=i===b?t*D/n:a;p.doTokenAdd(e.path,{id:0,x:L-(a>>1),y:P-(s>>1),width:a,height:s,rotation:l.mod(Math.floor(256*S/360),256),snap:G.checked,fill:$[k][1],stroke:$[k][0],strokeWidth:1,tokenType:1,isEllipse:i===v,lightColours:[],lightStages:[],lightTimings:[],tokenData:{}})}}},[Q,V]=r.registerKeyEvent("spells-create",A.ADD_SPELL,"Enter",J),ee=a.div([f.labels([A.DAMAGE_TYPE,": "],a.select({onchange:function(){k=l.checkInt(parseInt(this.value),0,$.length-1);for(const e of I)t.amendNode(e,{stroke:$[k][0],fill:$[k][1]})}},Array.from({length:$.length},((e,t)=>a.option({value:t},A["TYPE_"+t]))))),a.fieldset([a.legend(A.SPELL_TYPE),[[v,"SPELL_TYPE_CIRCLE"],[_,"SPELL_TYPE_CONE"],[T,"SPELL_TYPE_CUBE"],[y,"SPELL_TYPE_LINE"],[b,"SPELL_TYPE_WALL"]].map((([e,t],n)=>[n>0?a.br():[],f.labels(a.input({type:"radio",name:"plugin-spell-type",checked:!n,class:o.settingsTicker,onclick:()=>x(e)}),[A[t],": "])]))]),f.labels(G,`${d.default.TOOL_MEASURE_SNAP}: `),a.br(),f.labels([A.SPELL_SIZE,": "],a.input({type:"number",min:1,value:j,onchange:function(){M(j=l.checkInt(parseInt(this.value),1,1e3,10),D)}})),a.div({style:"display: var(--spell-display, none)"},f.labels([A.SPELL_WIDTH,": "],a.input({type:"number",min:1,value:D,onchange:function(){M(j,D=l.checkInt(parseInt(this.value),1,1e3,10))}})))]);u.addTool(Object.freeze({name:A.TITLE,id:"tool_spells",icon:s.svg({viewBox:"0 0 100 100"},[s.title(A.TITLE),s.g({fill:"currentColor",stroke:"currentColor"},[s.path({d:"M60,35 v70 h-20 v-100 h20 v30 h-20 v-30 h20","fill-rule":"evenodd",transform:"rotate(-45, 50, 50)"}),s.path({d:"M50,10 q0,10 10,10 q-10,0 -10,10 q0,-10 -10,-10 q10,0 10,-10",id:w}),s.use({href:`#${w}`,transform:"translate(5, 0) scale(1.5)"}),s.use({href:`#${w}`,transform:"translate(-45, 30) scale(1.2)"}),s.use({href:`#${w}`,transform:"translate(-30, -5) scale(0.8)"})])]),options:ee,mapMouseOver:function(e){return!g&&(g=!0,i===_||i===y?z():[L,P]=c.screen2Grid(e.clientX,e.clientY,G.checked),t.amendNode(i,{transform:`translate(${L}, ${P})`}),i!==_&&i!==y&&t.amendNode(this,i),Q(),Z(),!0)},mapMouse0:()=>i!==T&&i!==b||(C=!0,U(),!1),mapMouse2:()=>(Y=!0,W(),H(),!1),tokenMouse0:function(e){return!this.previousSibling&&e.shiftKey},tokenMouse2:u.ignore,set:R,unset:()=>{Y&&(O(),Y=!1),F(),K(),V(),X(),i?.remove(),B()}})),f.mapLoadedReceive((()=>M(j,D))),h.tokenSelectedReceive((()=>{!g||i!==_&&i!==y||z()}))}else{let e=null;m.rpc.waitBroadcast().when((({type:n,data:a})=>{if("plugin-spells"!==n)return;if(null===a)return e?.remove(),void(e=null);if(!(a instanceof Array)||7!==a.length)return void console.log("plugin spells: broadcast data must be an array with length 7");const[s,i,o,r,d,p,h]=a,m=I[s];for(const[e,t]of[[l.isInt(s,0,I.length-1),"invalid type"],[l.isInt(i,1,1e3),"invalid size"],[l.isInt(o,1,1e3),"invalid width"],[l.isInt(r)&&l.isInt(d),"invalid coords"],[l.isInt(p,0,360),"invalid rotation"],[l.isInt(h,0,$.length-1),"invalid damage type"]])if(!e)return void console.log("plugin spells: "+t);e!==m&&(e?.remove(),t.amendNode(c.root,m)),M(j=i,D=o),t.amendNode(N.get(t.amendNode(e=m,{transform:`translate(${r}, ${d})`,stroke:$[h][0],fill:$[h][1]})),{transform:`rotate(${p})`})}))}m.combined.waitGridDistanceChange().when((()=>setTimeout(M,0,j,D)));