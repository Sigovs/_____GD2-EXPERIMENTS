/* empty css              */import{C as e,M as t,P as n,V as r,_ as i,b as a,c as o,d as s,g as c,h as l,j as u,k as d,l as f,m as p,n as m,o as h,p as ee,r as g,u as te,w as ne,y as _}from"./GLTFLoader-Cdku5qF-.js";import{i as re,n as v,r as y,t as ie}from"./terrain-BpImuLhV.js";import{t as b}from"./OrbitControls-CHyntx6b.js";var ae=class extends i{constructor(e){super(e)}load(e,t,n,r){let i=this,a=new s(this.manager);a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(e){let n=i.parse(JSON.parse(e));t&&t(n)},n,r)}parse(e){return new x(e)}},x=class{constructor(e){this.isFont=!0,this.type=`Font`,this.data=e}generateShapes(e,t=100,n=`ltr`){let r=[],i=oe(e,t,this.data,n);for(let e=0,t=i.length;e<t;e++)r.push(...i[e].toShapes());return r}};function oe(e,t,n,r){let i=Array.from(e),a=t/n.resolution,o=(n.boundingBox.yMax-n.boundingBox.yMin+n.underlineThickness)*a,s=[],c=0,l=0;(r==`rtl`||r==`tb`)&&i.reverse();for(let e=0;e<i.length;e++){let t=i[e];if(t===`
`)c=0,l-=o;else{let e=se(t,a,c,l,n);r==`tb`?(c=0,l+=n.ascender*a):c+=e.offsetX,s.push(e.path)}}return s}function se(e,t,r,i,a){let o=a.glyphs[e]||a.glyphs[`?`];if(!o){console.error(`THREE.Font: character "`+e+`" does not exists in font family `+a.familyName+`.`);return}let s=new n,c,l,u,d,f,p,m,h;if(o.o){let e=o._cachedOutline||=o.o.split(` `);for(let n=0,a=e.length;n<a;)switch(e[n++]){case`m`:c=e[n++]*t+r,l=e[n++]*t+i,s.moveTo(c,l);break;case`l`:c=e[n++]*t+r,l=e[n++]*t+i,s.lineTo(c,l);break;case`q`:u=e[n++]*t+r,d=e[n++]*t+i,f=e[n++]*t+r,p=e[n++]*t+i,s.quadraticCurveTo(f,p,u,d);break;case`b`:u=e[n++]*t+r,d=e[n++]*t+i,f=e[n++]*t+r,p=e[n++]*t+i,m=e[n++]*t+r,h=e[n++]*t+i,s.bezierCurveTo(f,p,m,h,u,d)}}return{offsetX:o.ha*t,path:s}}var ce=class e extends te{constructor(e,t={}){let n=t.font;if(n===void 0)super();else{let r=n.generateShapes(e,t.size,t.direction);t.depth===void 0&&(t.depth=50),t.bevelThickness===void 0&&(t.bevelThickness=10),t.bevelSize===void 0&&(t.bevelSize=8),t.bevelEnabled===void 0&&(t.bevelEnabled=!1),super(r,t)}this.type=`TextGeometry`}toJSON(){return super.toJSON()}static fromJSON(t){let n=t.options;return n.font=new x(n.font.data),new e(n.text,n)}},S=`./fonts/gd-lab-bold.typeface.json`,le={top:{azimuth:0,elevation:88},oblique:{azimuth:45,elevation:30},low:{azimuth:45,elevation:9}},C={inlay:{label:`Inlay`,depth:.08,surfaceOffset:-.02},monolith:{label:`Monolith`,depth:1.7,surfaceOffset:-.2},beacon:{label:`Beacon`,depth:.9,surfaceOffset:-.1}},w={treatment:`monolith`,text:`GD`,positionX:-1,positionZ:4,rotation:0,scale:5,depth:C.monolith.depth,surfaceOffset:C.monolith.surfaceOffset,brightness:1},ue=26e3,de=document.querySelector(`#app`);de.innerHTML=`
  <canvas class="lab-canvas" id="lab-canvas"></canvas>

  <section class="lab-panel" aria-label="Typography lab controls">
    <h1 class="lab-title">Typography lab</h1>

    <div class="lab-group">
      <span class="lab-legend">Treatment</span>
      <div class="lab-controls" id="lab-treatments">
        <button class="btn" type="button" data-treatment="inlay" aria-pressed="false">Inlay</button>
        <button class="btn" type="button" data-treatment="monolith" aria-pressed="true">Monolith</button>
        <button class="btn" type="button" data-treatment="beacon" aria-pressed="false">Beacon</button>
      </div>
    </div>

    <div class="lab-group">
      <span class="lab-legend">Letterforms</span>
      <div class="lab-field">
        <div class="lab-field__head"><label class="lab-field__label" for="lab-text">text</label></div>
        <input class="lab-input" id="lab-text" type="text" value="GD" maxlength="12" spellcheck="false" />
      </div>
    </div>

    <div class="lab-group">
      <span class="lab-legend">Placement</span>
      <div class="lab-field" data-field="positionX">
        <div class="lab-field__head">
          <label class="lab-field__label" for="lab-positionX">position x</label>
          <span class="lab-field__value" id="val-positionX">0.0</span>
        </div>
        <input class="lab-range" id="lab-positionX" type="range" min="-9" max="9" step="0.1" value="-1" />
      </div>
      <div class="lab-field" data-field="positionZ">
        <div class="lab-field__head">
          <label class="lab-field__label" for="lab-positionZ">position z</label>
          <span class="lab-field__value" id="val-positionZ">0.0</span>
        </div>
        <input class="lab-range" id="lab-positionZ" type="range" min="-9" max="9" step="0.1" value="4" />
      </div>
      <div class="lab-field" data-field="rotation">
        <div class="lab-field__head">
          <label class="lab-field__label" for="lab-rotation">rotation</label>
          <span class="lab-field__value" id="val-rotation">0°</span>
        </div>
        <input class="lab-range" id="lab-rotation" type="range" min="-180" max="180" step="1" value="0" />
      </div>
      <div class="lab-field" data-field="scale">
        <div class="lab-field__head">
          <label class="lab-field__label" for="lab-scale">scale</label>
          <span class="lab-field__value" id="val-scale">5.0</span>
        </div>
        <input class="lab-range" id="lab-scale" type="range" min="1" max="10" step="0.1" value="5" />
      </div>
    </div>

    <div class="lab-group">
      <span class="lab-legend">Form</span>
      <div class="lab-field" data-field="depth">
        <div class="lab-field__head">
          <label class="lab-field__label" for="lab-depth">extrusion depth</label>
          <span class="lab-field__value" id="val-depth">1.70</span>
        </div>
        <input class="lab-range" id="lab-depth" type="range" min="0.02" max="4" step="0.02" value="1.7" />
      </div>
      <div class="lab-field" data-field="surfaceOffset">
        <div class="lab-field__head">
          <label class="lab-field__label" for="lab-surfaceOffset">surface offset</label>
          <span class="lab-field__value" id="val-surfaceOffset">-0.20</span>
        </div>
        <input class="lab-range" id="lab-surfaceOffset" type="range" min="-1.5" max="1.5" step="0.01" value="-0.2" />
      </div>
      <div class="lab-field" data-field="brightness">
        <div class="lab-field__head">
          <label class="lab-field__label" for="lab-brightness">material brightness</label>
          <span class="lab-field__value" id="val-brightness">1.00</span>
        </div>
        <input class="lab-range" id="lab-brightness" type="range" min="0.3" max="2" step="0.01" value="1" />
      </div>
    </div>

    <div class="lab-group">
      <span class="lab-legend">Camera</span>
      <div class="lab-controls">
        <button class="btn" type="button" data-view="top">Top</button>
        <button class="btn" type="button" data-view="oblique">Oblique</button>
        <button class="btn" type="button" data-view="low">Low</button>
      </div>
      <div class="lab-controls">
        <button class="btn" type="button" id="lab-auto" aria-pressed="false">Auto camera off</button>
      </div>
    </div>

    <div class="lab-group">
      <span class="lab-legend">Export</span>
      <div class="lab-controls">
        <button class="btn" type="button" id="lab-copy">Copy settings</button>
      </div>
      <p class="lab-note" id="lab-readout">surface &mdash;</p>
    </div>
  </section>

  <p class="lab-status" id="lab-status">Loading 0%</p>

  <div class="notice" id="notice" hidden>
    <span class="notice__label">Error</span>
    <p class="notice__message" id="notice-message"></p>
    <p class="notice__detail" id="notice-detail"></p>
  </div>
`;var T=e=>document.getElementById(e),fe=T(`lab-canvas`),E=new m({canvas:fe,antialias:!0});E.setPixelRatio(Math.min(window.devicePixelRatio,2)),E.setSize(window.innerWidth,window.innerHeight,!1),E.outputColorSpace=u,E.toneMapping=0;var D=new t;D.background=new h(`#121417`);var O=new ne(35,window.innerWidth/window.innerHeight,.1,5e3),k=new b(O,E.domElement);k.enableDamping=!0,k.dampingFactor=.05,D.add(new p(16777215,7039851,1.1));var A=new o(16777215,2.5);A.position.set(1,1.35,.8).normalize().multiplyScalar(120),D.add(A);var j=new ee;D.add(j);var M=new g,N=new r,P=null,F=null,I=null,L=null,R=0,z=new d,pe=new r(0,-1,0),B=new r,V={pale:new h(`#e6e4df`),paleSide:new h(`#c9c6c0`),graphite:new h(`#2a2d31`),dark:new h(`#16181b`),edgeSoft:new h(`#4fa8b3`),edgeBright:new h(`#63d2dc`)},H={paleFace:new e({roughness:.85,metalness:0}),paleSide:new e({roughness:.9,metalness:0}),graphiteSide:new e({roughness:.75,metalness:0}),darkFace:new e({roughness:.6,metalness:0}),darkSide:new e({roughness:.65,metalness:0}),edgeSoft:new l({transparent:!0,opacity:.85}),edgeBright:new l({})};function U(){let e=w.brightness,t=(t,n)=>t.color.copy(n).multiplyScalar(e);t(H.paleFace,V.pale),t(H.paleSide,V.paleSide),t(H.graphiteSide,V.graphite),t(H.darkFace,V.dark),t(H.darkSide,V.dark),t(H.edgeSoft,V.edgeSoft),t(H.edgeBright,V.edgeBright)}function me(e){return e===`inlay`?[H.paleFace,H.paleSide]:e===`beacon`?[H.darkFace,H.darkSide]:[H.paleFace,H.graphiteSide]}function he(e){return e===`inlay`?H.edgeSoft:e===`beacon`?H.edgeBright:null}function ge(){I&&=(j.remove(I),I.geometry.dispose(),null),L&&=(j.remove(L),L.geometry.dispose(),null)}function W(){if(!F)return;ge();let e=w.text.length?w.text:`GD`,t;try{t=new ce(e,{font:F,size:w.scale,depth:w.depth,height:w.depth,curveSegments:10,bevelEnabled:!1})}catch{Z(`Could not build "${e}"`);return}t.computeBoundingBox();let n=t.boundingBox;if(!n)return;t.translate(-(n.max.x+n.min.x)/2,-(n.max.y+n.min.y)/2,0),I=new a(t,me(w.treatment)),I.rotation.x=-Math.PI/2,j.add(I);let r=he(w.treatment);r&&(L=new c(new f(t,24),r),L.rotation.x=-Math.PI/2,j.add(L)),G()}function _e(e,t){if(!P)return null;B.set(e,M.max.y+100,t),z.set(B,pe);let n=z.intersectObject(P,!0);return n.length?n[0].point.y:null}function G(){if(!I)return;j.rotation.y=_.degToRad(w.rotation),j.position.set(w.positionX,0,w.positionZ),j.updateMatrixWorld(!0);let e=new g().setFromObject(I),t=[];for(let n=0;n<=2;n+=1)for(let r=0;r<=2;r+=1){let i=_e(_.lerp(e.min.x,e.max.x,n/2),_.lerp(e.min.z,e.max.z,r/2));i!==null&&t.push(i)}R=t.length?t.reduce((e,t)=>e+t,0)/t.length:0,j.position.y=R+w.surfaceOffset,j.updateMatrixWorld(!0),T(`lab-readout`).textContent=`surface ${R.toFixed(3)} · base ${j.position.y.toFixed(3)}`}var K=!1,q=0;function ve(e,t,n,r){let i=y(e,t,O,n)*r;return O.position.copy(n).addScaledVector(t,i),O.lookAt(n),O.near=Math.max(i/1e3,.01),O.far=i*10+100,O.updateProjectionMatrix(),i}function J(e){let t=le[e];!t||!P||(Y(!1),ve(M,v(t.azimuth,t.elevation),N,1.12),k.target.copy(N),k.update())}function Y(e){K=e,k.enabled=!e,e&&(q=performance.now());let t=T(`lab-auto`);t.setAttribute(`aria-pressed`,String(e)),t.textContent=e?`Auto camera on`:`Auto camera off`,e||(k.target.copy(ye()),k.update())}var X=new r;function ye(){return X.lengthSq()?X:N}function be(e){if(!K||!P)return;let t=_.clamp((e-q)/ue,0,1),n=t*t*(3-2*t),i=v(_.lerp(0,52,n),_.lerp(87,10,n)),a=I?new g().setFromObject(j).getCenter(new r):N.clone();X.copy(N).lerp(a,n);let o=y(M,i,O,X)*1.06,s=I?new g().setFromObject(j):M,c=y(s,i,O,X)*2.1,l=_.lerp(o,Math.min(c,o),n);O.position.copy(X).addScaledVector(i,l),O.lookAt(X),O.near=Math.max(l/1e3,.01),O.far=l*10+100,O.updateProjectionMatrix()}function Z(e){let t=T(`lab-status`);if(e===null){t.hidden=!0;return}t.hidden=!1,t.textContent=e}function xe(e,t){T(`notice-message`).textContent=e,T(`notice-detail`).textContent=t||``,T(`notice`).hidden=!1,Z(null)}var Q=[{key:`positionX`,decimals:1},{key:`positionZ`,decimals:1},{key:`rotation`,decimals:0,suffix:`°`},{key:`scale`,decimals:1},{key:`depth`,decimals:2},{key:`surfaceOffset`,decimals:2},{key:`brightness`,decimals:2}];function $(e){let t=Q.find(t=>t.key===e);if(!t)return;let n=T(`lab-${e}`);n&&(n.value=String(w[e]));let r=T(`val-${e}`);r&&(r.textContent=w[e].toFixed(t.decimals)+(t.suffix||``))}for(let e of Q){let t=T(`lab-${e.key}`);t.addEventListener(`input`,()=>{w[e.key]=parseFloat(t.value),$(e.key),e.key===`brightness`?U():e.key===`scale`||e.key===`depth`?W():G()})}T(`lab-text`).addEventListener(`input`,e=>{w.text=e.target.value,W()});for(let e of document.querySelectorAll(`[data-treatment]`))e.addEventListener(`click`,()=>{let t=e.dataset.treatment;w.treatment=t,w.depth=C[t].depth,w.surfaceOffset=C[t].surfaceOffset,$(`depth`),$(`surfaceOffset`);for(let e of document.querySelectorAll(`[data-treatment]`))e.setAttribute(`aria-pressed`,String(e.dataset.treatment===t));W()});for(let e of document.querySelectorAll(`[data-view]`))e.addEventListener(`click`,()=>J(e.dataset.view));T(`lab-auto`).addEventListener(`click`,()=>Y(!K)),T(`lab-copy`).addEventListener(`click`,async()=>{let e=JSON.stringify({treatment:w.treatment,text:w.text,positionX:w.positionX,positionZ:w.positionZ,rotation:w.rotation,scale:w.scale,depth:w.depth,surfaceOffset:w.surfaceOffset,brightness:w.brightness,sampledSurfaceHeight:Number(R.toFixed(4)),baseY:Number(j.position.y.toFixed(4))},null,2),t=T(`lab-copy`),n=!1;try{await navigator.clipboard.writeText(e),n=!0}catch{let t=document.createElement(`textarea`);t.value=e,t.style.position=`fixed`,t.style.opacity=`0`,document.body.appendChild(t),t.select();try{n=document.execCommand(`copy`)}catch{n=!1}document.body.removeChild(t)}t.textContent=n?`Copied`:`Copy failed — see console`,n||console.log(e),setTimeout(()=>{t.textContent=`Copy settings`},1600)}),window.addEventListener(`resize`,()=>{O.aspect=window.innerWidth/window.innerHeight,O.updateProjectionMatrix(),E.setPixelRatio(Math.min(window.devicePixelRatio,2)),E.setSize(window.innerWidth,window.innerHeight,!1)}),U();for(let e of Q)$(e.key);function Se(){return new Promise((e,t)=>{new ae().load(S,e,void 0,()=>t(Error(`Could not load the typeface at ${S}`)))})}Z(`Loading 0%`),Promise.all([re({onProgress:({percent:e,megabytes:t})=>{Z(e===void 0?`Loading terrain ${t.toFixed(1)} MB`:`Loading terrain ${e}%`)}}),Se()]).then(([e,t])=>{P=e.group,D.add(P),M.copy(e.box),N.copy(e.center),F=t,k.minDistance=Math.max(e.size.length()*.01,.01),k.maxDistance=e.size.length()*12,W(),J(`oblique`),Z(null)}).catch(e=>{xe(String(e?.message||``).includes(`typeface`)?`Failed to load the typeface at ${S}. Regenerate it with: python scripts/make-typeface.py`:`Failed to load ${ie}. Confirm the file exists in public/models/ and that the dev server is serving it.`,e?.message||String(e))}),E.setAnimationLoop(e=>{K?be(e):k.update(),E.render(D,O)});