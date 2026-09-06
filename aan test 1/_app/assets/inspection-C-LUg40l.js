/* empty css              */import{M as e,V as t,c as n,j as r,m as i,n as a,o,r as s,w as c}from"./GLTFLoader-Cdku5qF-.js";import{i as l,n as u,r as d,t as f}from"./terrain-BpImuLhV.js";import{t as p}from"./OrbitControls-CHyntx6b.js";var m=1.12,h={oblique:{azimuth:45,elevation:30},top:{azimuth:0,elevation:88},low:{azimuth:45,elevation:9}},g=document.querySelector(`#app`);g.innerHTML=`
  <canvas class="viewport" id="viewport"></canvas>

  <section class="panel" aria-label="Terrain inspection readout">
    <h1 class="panel__title">Terrain inspection</h1>

    <div class="panel__group">
      <span class="panel__legend">Asset</span>
      <div class="readout">
        <span class="readout__key">status</span>
        <span class="readout__value" id="out-status">initialising</span>
        <span class="readout__key">vertices</span>
        <span class="readout__value" id="out-vertices">&mdash;</span>
        <span class="readout__key">triangles</span>
        <span class="readout__value" id="out-triangles">&mdash;</span>
        <span class="readout__key">size x/y/z</span>
        <span class="readout__value" id="out-dimensions">&mdash;</span>
        <span class="readout__key">scale</span>
        <span class="readout__value" id="out-scale">&mdash;</span>
      </div>
    </div>

    <div class="panel__group">
      <span class="panel__legend">Camera</span>
      <div class="readout">
        <span class="readout__key">position</span>
        <span class="readout__value" id="out-camera">&mdash;</span>
        <span class="readout__key">distance</span>
        <span class="readout__value" id="out-distance">&mdash;</span>
      </div>
      <div class="controls">
        <button class="btn" type="button" data-view="top">Top</button>
        <button class="btn" type="button" data-view="oblique">Oblique</button>
        <button class="btn" type="button" data-view="low">Low</button>
      </div>
    </div>

    <div class="panel__group">
      <span class="panel__legend">Display</span>
      <div class="controls">
        <button class="btn" type="button" id="toggle-wireframe" aria-pressed="false">
          Wireframe off
        </button>
      </div>
    </div>
  </section>

  <div class="notice" id="notice" hidden>
    <span class="notice__label" id="notice-label">Error</span>
    <p class="notice__message" id="notice-message"></p>
    <p class="notice__detail" id="notice-detail"></p>
  </div>
`;var _=e=>document.getElementById(e),v=_(`viewport`),y=new a({canvas:v,antialias:!0});y.setPixelRatio(Math.min(window.devicePixelRatio,2)),y.setSize(window.innerWidth,window.innerHeight,!1),y.outputColorSpace=r,y.toneMapping=0;var b=new e;b.background=new o(`#121417`);var x=new c(35,window.innerWidth/window.innerHeight,.1,5e3),S=new p(x,y.domElement);S.enableDamping=!0,S.dampingFactor=.05;var C=new i(16777215,7039851,1.2);b.add(C);var w=new n(16777215,2.5);w.position.set(1,1.35,.8).normalize().multiplyScalar(100),b.add(w);var T=new s,E=new t,D=[],O=!1,k=!1;function A(e){_(`out-status`).textContent=e}function j(e,t){_(`notice-message`).textContent=e,_(`notice-detail`).textContent=t||``,_(`notice`).hidden=!1,A(`failed`)}function M(e){return e.toLocaleString(`en-US`)}function N(e){if(!k)return;let t=h[e];if(!t)return;let n=u(t.azimuth,t.elevation),r=d(T,n,x,E)*m;x.position.copy(E).addScaledVector(n,r),x.near=Math.max(r/1e3,.01),x.far=r*10,x.updateProjectionMatrix(),S.target.copy(E),S.update();for(let t of document.querySelectorAll(`[data-view]`))t.dataset.active=String(t.dataset.view===e)}A(`loading 0%`),l({onProgress:({percent:e,megabytes:t})=>{A(e===void 0?`loading ${t.toFixed(1)} MB`:`loading ${e}%`)}}).then(e=>{b.add(e.group),T.copy(e.box),E.copy(e.center),D=e.meshes;let{size:t}=e;_(`out-vertices`).textContent=M(e.vertices),_(`out-triangles`).textContent=M(e.triangles),_(`out-dimensions`).textContent=`${t.x.toFixed(2)} / ${t.y.toFixed(2)} / ${t.z.toFixed(2)}`,_(`out-scale`).textContent=`${e.scale.toPrecision(4)}×`,A(`loaded`),k=!0,S.minDistance=Math.max(t.length()*.02,.01),S.maxDistance=t.length()*12,N(`oblique`)}).catch(e=>{j(`Failed to load ${f}. Confirm the file exists in public/models/ and that the dev server is serving it.`,e?.message||String(e))});for(let e of document.querySelectorAll(`[data-view]`))e.addEventListener(`click`,()=>N(e.dataset.view));var P=_(`toggle-wireframe`);P.addEventListener(`click`,()=>{O=!O;for(let e of D){let t=Array.isArray(e.material)?e.material:[e.material];for(let e of t)e&&(e.wireframe=O)}P.setAttribute(`aria-pressed`,String(O)),P.textContent=O?`Wireframe on`:`Wireframe off`}),window.addEventListener(`resize`,()=>{x.aspect=window.innerWidth/window.innerHeight,x.updateProjectionMatrix(),y.setPixelRatio(Math.min(window.devicePixelRatio,2)),y.setSize(window.innerWidth,window.innerHeight,!1)});var F=0;y.setAnimationLoop(e=>{if(S.update(),k&&e-F>120){F=e;let{x:t,y:n,z:r}=x.position;_(`out-camera`).textContent=`${t.toFixed(1)} / ${n.toFixed(1)} / ${r.toFixed(1)}`,_(`out-distance`).textContent=x.position.distanceTo(E).toFixed(1)}y.render(b,x)});