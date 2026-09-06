/* empty css              */import{E as e,F as t,M as n,V as r,b as i,c as a,i as o,j as s,k as c,m as l,n as ee,o as te,p as u,r as d,t as ne,w as re,x as f,y as ie}from"./GLTFLoader-Cdku5qF-.js";import{i as ae,n as p,r as oe,t as se}from"./terrain-BpImuLhV.js";import{t as ce}from"./OrbitControls-CHyntx6b.js";import{t as le}from"./character-rig-iAnKjvzY.js";var m=`./models/survival-man-test.glb`,ue=1.78,h=.4,g=3,_=1.15,v=Math.PI/12,y=Math.PI,b={minX:-4,maxX:5,minZ:0,maxZ:7,step:1},x=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,de=document.querySelector(`#app`);de.innerHTML=`
  <canvas class="man-canvas" id="man-canvas"></canvas>

  <section class="man-panel" aria-label="Human scale test controls">
    <h1 class="man-title">Human scale test</h1>

    <div class="man-group">
      <span class="man-legend">Figure</span>
      <div class="man-controls">
        <button class="btn" type="button" id="man-toggle" aria-pressed="true">Man on</button>
      </div>
      <div class="man-controls">
        <button class="btn" type="button" id="man-scale-down">Scale −</button>
        <button class="btn" type="button" id="man-scale-up">Scale +</button>
      </div>
      <div class="man-controls">
        <button class="btn" type="button" id="man-rot-left">Rotate ←</button>
        <button class="btn" type="button" id="man-rot-right">Rotate →</button>
      </div>
      <div class="man-controls">
        <button class="btn" type="button" id="man-reset">Reset</button>
      </div>
    </div>

    <div class="man-group">
      <span class="man-legend">Pose</span>
      <div class="man-controls">
        <button class="btn" type="button" id="man-idle" aria-pressed="true">Idle on</button>
      </div>
      <div class="man-controls">
        <button class="btn" type="button" id="man-skeleton" aria-pressed="false">Skeleton off</button>
      </div>
      <div class="man-controls">
        <button class="btn" type="button" id="man-pose-reset">Reset pose</button>
      </div>
    </div>

    <div class="man-group">
      <span class="man-legend">Readout</span>
      <div class="man-readout">
        <span class="man-readout__key">height</span>
        <span class="man-readout__value" id="man-height">&mdash;</span>
        <span class="man-readout__key">position</span>
        <span class="man-readout__value" id="man-position">&mdash;</span>
        <span class="man-readout__key">ground y</span>
        <span class="man-readout__value" id="man-ground">&mdash;</span>
        <span class="man-readout__key">feet y</span>
        <span class="man-readout__value" id="man-feet">&mdash;</span>
        <span class="man-readout__key">facing</span>
        <span class="man-readout__value" id="man-rotation">&mdash;</span>
        <span class="man-readout__key">triangles</span>
        <span class="man-readout__value" id="man-triangles">&mdash;</span>
        <span class="man-readout__key">idle</span>
        <span class="man-readout__value" id="man-animation">&mdash;</span>
      </div>
    </div>
  </section>

  <p class="man-status" id="man-status">Loading 0%</p>

  <div class="notice" id="notice" hidden>
    <span class="notice__label">Error</span>
    <p class="notice__message" id="notice-message"></p>
    <p class="notice__detail" id="notice-detail"></p>
  </div>
`;var S=e=>document.getElementById(e),fe=S(`man-canvas`),C=new ee({canvas:fe,antialias:!0});C.setPixelRatio(Math.min(window.devicePixelRatio,2)),C.setSize(window.innerWidth,window.innerHeight,!1),C.outputColorSpace=s,C.toneMapping=0;var w=new n;w.background=new te(`#121417`);var T=new re(35,window.innerWidth/window.innerHeight,.01,5e3),E=new ce(T,C.domElement);E.enableDamping=!0,E.dampingFactor=.05,w.add(new l(16777215,7039851,1.2));var D=new a(16777215,2.5);D.position.set(1,1.35,.8).normalize().multiplyScalar(120),w.add(D);var O=new u,k=new u;O.add(k),w.add(O);var A=new d,j=new r,M=null,N=null,P=null,F=null,I=1,L=0,R=0,z=!1,B={visible:!0,scale:1,facing:y,x:0,z:0,groundY:0,idle:!x},V={scale:1,facing:y,x:0,z:0},H=new c,pe=new r(0,-1,0),U=new r;function W(e){let t=S(`man-status`);if(e===null){t.hidden=!0;return}t.hidden=!1,t.textContent=e}function me(e,t){S(`notice-message`).textContent=e,S(`notice-detail`).textContent=t||``,S(`notice`).hidden=!1,W(null)}function G(e,t){if(!M)return null;U.set(e,A.max.y+100,t),H.set(U,pe);let n=H.intersectObject(M,!0);return n.length?n[0].point.y:null}function he(){let e=null;for(let t=b.minX;t<=b.maxX;t+=b.step)for(let n=b.minZ;n<=b.maxZ;n+=b.step){let r=.6,i=[G(t,n),G(t+r,n),G(t-r,n),G(t,n+r),G(t,n-r)].filter(e=>e!==null);if(i.length<5)continue;let a=Math.max(...i)-Math.min(...i);(!e||a<e.spread)&&(e={x:t,z:n,spread:a,height:i[0]})}return e}function K(){let e=G(B.x,B.z);B.groundY=e===null?0:e,O.position.set(B.x,B.groundY,B.z),O.scale.setScalar(B.scale),k.rotation.y=B.facing,O.updateMatrixWorld(!0),N&&N.recaptureTargets(),F&&(F.position.set(B.x,B.groundY+.01,B.z),F.scale.setScalar(B.scale),F.visible=B.visible),ge()}function ge(){if(S(`man-height`).textContent=`${(I*B.scale).toFixed(3)} u`,S(`man-position`).textContent=`${B.x.toFixed(2)} / ${B.z.toFixed(2)}`,S(`man-ground`).textContent=B.groundY.toFixed(4),S(`man-rotation`).textContent=`${Math.round(B.facing*180/Math.PI)}°`,k.children.length){let e=new d().setFromObject(k);S(`man-feet`).textContent=e.min.y.toFixed(4)}}function _e(){let t=document.createElement(`canvas`);t.width=t.height=256;let n=t.getContext(`2d`),r=n.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,`rgba(0,0,0,0.55)`),r.addColorStop(.55,`rgba(0,0,0,0.22)`),r.addColorStop(1,`rgba(0,0,0,0)`),n.fillStyle=r,n.fillRect(0,0,256,256);let a=new o(t);a.colorSpace=s;let c=new i(new e(1.1,1.1),new f({map:a,transparent:!0,depthWrite:!1,opacity:.85}));return c.rotation.x=-Math.PI/2,c.renderOrder=1,c}function ve(){let e=p(45,22),t=oe(A,e,T,j)*1.1;T.position.copy(j).addScaledVector(e,t),T.near=Math.max(t/5e3,.01),T.far=t*10+200,T.updateProjectionMatrix(),E.target.copy(j),E.update()}function q(e=6,t=6,n=35){let i=I*B.scale,a=new r(B.x,B.groundY+i*.6,B.z),o=p(n,t);T.position.copy(a).addScaledVector(o,e),T.near=.01,T.far=2e3,T.updateProjectionMatrix(),E.target.copy(a),E.update()}function J(e){B.visible=e,O.visible=e,F&&(F.visible=e),P&&(P.visible=e&&P.userData.on);let t=S(`man-toggle`);t.setAttribute(`aria-pressed`,String(e)),t.textContent=e?`Man on`:`Man off`}function Y(e){B.idle=e,N&&N.setIdleEnabled(e);let t=S(`man-idle`);t.setAttribute(`aria-pressed`,String(e)),t.textContent=e?`Idle on`:`Idle off`,S(`man-animation`).textContent=e?`procedural — breath, weight, gaze`:x?`off — reduced motion`:`off — static pose`}function X(e){P&&(P.userData.on=e,P.visible=e&&B.visible);let t=S(`man-skeleton`);t.setAttribute(`aria-pressed`,String(e)),t.textContent=e?`Skeleton on`:`Skeleton off`}function Z(e){B.scale=ie.clamp(e,h,g),K()}var Q=[];function $(e,t,n){e.addEventListener(t,n),Q.push([e,t,n])}$(S(`man-toggle`),`click`,()=>J(!B.visible)),$(S(`man-scale-up`),`click`,()=>Z(B.scale*_)),$(S(`man-scale-down`),`click`,()=>Z(B.scale/_)),$(S(`man-rot-left`),`click`,()=>{B.facing-=v,K()}),$(S(`man-rot-right`),`click`,()=>{B.facing+=v,K()}),$(S(`man-reset`),`click`,()=>{B.scale=V.scale,B.facing=V.facing,B.x=V.x,B.z=V.z,J(!0),K()}),$(S(`man-idle`),`click`,()=>Y(!B.idle)),$(S(`man-skeleton`),`click`,()=>X(!(P&&P.userData.on))),$(S(`man-pose-reset`),`click`,()=>{N&&N.reset(),K()}),$(window,`resize`,()=>{T.aspect=window.innerWidth/window.innerHeight,T.updateProjectionMatrix(),C.setPixelRatio(Math.min(window.devicePixelRatio,2)),C.setSize(window.innerWidth,window.innerHeight,!1)});function ye(){if(z)return{alreadyDisposed:!0};z=!0,C.setAnimationLoop(null);for(let[e,t,n]of Q)e.removeEventListener(t,n);Q.length=0,E.dispose(),N&&N.dispose();let e=0,t=0,n=0;return w.traverse(r=>{r.geometry&&(r.geometry.dispose(),e+=1);let i=Array.isArray(r.material)?r.material:r.material?[r.material]:[];for(let e of i){for(let t of Object.keys(e)){let r=e[t];r&&r.isTexture&&(r.dispose(),n+=1)}e.dispose(),t+=1}}),w.clear(),C.dispose(),{geometries:e,materials:t,textures:n,contextLost:C.getContext().isContextLost()}}function be(){return new Promise((e,t)=>{new ne().load(m,e,e=>{e.lengthComputable&&e.total>0&&W(`Loading figure ${Math.round(e.loaded/e.total*100)}%`)},()=>t(Error(`Could not load ${m}`)))})}W(`Loading 0%`),Promise.all([ae({onProgress:({percent:e,megabytes:t})=>{W(e===void 0?`Loading terrain ${t.toFixed(1)} MB`:`Loading terrain ${e}%`)}}),be()]).then(([e,n])=>{M=e.group,w.add(M),A.copy(e.box),j.copy(e.center);let i=n.scene;i.updateWorldMatrix(!0,!0);let a=new d().setFromObject(i),o=a.getSize(new r),s=a.getCenter(new r),c=o.y>0?ue/o.y:1;i.scale.setScalar(c),i.position.set(-s.x*c,-a.min.y*c,-s.z*c),k.add(i),O.updateMatrixWorld(!0),I=new d().setFromObject(k).getSize(new r).y,i.traverse(e=>{if(e.isMesh&&e.geometry){let t=e.geometry.getAttribute(`position`);e.geometry.index?L+=e.geometry.index.count/3:t&&(L+=t.count/3),e.frustumCulled=!1}}),L=Math.round(L),F=_e(),w.add(F),N=new le(i),P=new t(i),P.userData.on=!1,P.visible=!1,w.add(P);let l=he();l&&(B.x=V.x=l.x,B.z=V.z=l.z),S(`man-triangles`).textContent=L.toLocaleString(`en-US`),K(),Y(B.idle),X(!1),q(5,5,25),W(null),window.__manTest={camera:T,controls:E,scene:w,manRoot:O,manOrient:k,rig:N,state:B,stance:l,sampleGround:G,frameTerrain:ve,lookAtMan:q,placeMan:K,teardown:ye,triangles:L,reducedMotion:x}}).catch(e=>{me(String(e?.message||``).includes(`survival-man`)?`Failed to load ${m}. Regenerate it with: scripts/convert-survival-man.py`:`Failed to load ${se}. Confirm the file exists in public/models/.`,e?.message||String(e))}),C.setAnimationLoop(e=>{let t=R?(e-R)/1e3:0;R=e,N&&B.idle&&N.update(t),E.update(),C.render(w,T)});