/* empty css              */import{E as e,M as t,V as n,b as r,c as i,i as a,j as o,k as s,m as c,n as l,o as u,p as d,r as f,t as ee,w as te,x as ne,y as re}from"./GLTFLoader-Cdku5qF-.js";import{n as p,t as m}from"./ScrollTrigger-Cgjl6ODA.js";import{i as ie,n as ae,r as oe,t as se}from"./terrain-BpImuLhV.js";import{t as ce}from"./character-rig-iAnKjvzY.js";var h=`./models/survival-man-test.glb`,g=1.78,le=Math.PI,_=32,v=38,ue=34,de=33,y={minX:-4,maxX:5,minZ:0,maxZ:7,step:1},b=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,fe=document.querySelector(`#app`);document.documentElement.classList.add(`mode-manscroll`),b&&document.documentElement.classList.add(`ms-static`),fe.innerHTML=`
  <div class="ms-scroll" id="ms-scroll">
    <div class="ms-stage" id="ms-stage">
      <canvas id="ms-canvas"></canvas>

      <div class="ms-markers" id="ms-markers">
        <p class="ms-marker" id="ms-marker-0">
          <span class="ms-marker__index">01</span>
          <span class="ms-marker__text">Beside him.</span>
        </p>
        <p class="ms-marker" id="ms-marker-1">
          <span class="ms-marker__index">02</span>
          <span class="ms-marker__text">The basin opens.</span>
        </p>
        <p class="ms-marker" id="ms-marker-2">
          <span class="ms-marker__index">03</span>
          <span class="ms-marker__text">One person, for scale.</span>
        </p>
      </div>

      <section class="ms-debug" aria-label="Scroll camera debug">
        <h1 class="ms-debug__title">Scroll camera</h1>
        <div class="ms-debug__grid">
          <span class="ms-debug__key">progress</span>
          <span class="ms-debug__value" id="ms-progress">0.0%</span>
          <span class="ms-debug__key">camera</span>
          <span class="ms-debug__value" id="ms-camera">&mdash;</span>
          <span class="ms-debug__key">target</span>
          <span class="ms-debug__value" id="ms-target">&mdash;</span>
          <span class="ms-debug__key">fov</span>
          <span class="ms-debug__value" id="ms-fov">&mdash;</span>
          <span class="ms-debug__key">man on screen</span>
          <span class="ms-debug__value" id="ms-mansize">&mdash;</span>
        </div>
      </section>

      <p class="ms-status" id="ms-status">Loading 0%</p>

      <div class="ms-error" id="ms-error" hidden>
        <span class="notice__label">Error</span>
        <p class="notice__message" id="ms-error-message"></p>
        <p class="notice__detail" id="ms-error-detail"></p>
      </div>
    </div>
  </div>
`;var x=e=>document.getElementById(e),pe=x(`ms-canvas`),S=x(`ms-stage`),C=new l({canvas:pe,antialias:!0});C.setPixelRatio(Math.min(window.devicePixelRatio,2)),C.outputColorSpace=o,C.toneMapping=0;var w=new t;w.background=new u(`#0c0e11`);var T=new te(_,1,.01,5e3);w.add(new c(16777215,7039851,1.15));var E=new i(16777215,2.5);E.position.set(1,1.35,.8).normalize().multiplyScalar(120),w.add(E);var D=new d,O=new d;D.add(O),w.add(D);var k=new f,A=new n,j=null,M=null,N=null,P=g,F=[],I=0,L=0,R=!1,z={x:0,z:0,groundY:0},B=new s,me=new n(0,-1,0),V=new n,H=new n,U=new n,W=new n,G=new n;function K(e){let t=x(`ms-status`);if(e===null){t.hidden=!0;return}t.hidden=!1,t.textContent=e}function he(e,t){x(`ms-error-message`).textContent=e,x(`ms-error-detail`).textContent=t||``,x(`ms-error`).hidden=!1,K(null)}function q(e,t){if(!j)return null;V.set(e,k.max.y+100,t),B.set(V,me);let n=B.intersectObject(j,!0);return n.length?n[0].point.y:null}function ge(){let e=null;for(let t=y.minX;t<=y.maxX;t+=y.step)for(let n=y.minZ;n<=y.maxZ;n+=y.step){let r=.6,i=[q(t,n),q(t+r,n),q(t-r,n),q(t,n+r),q(t,n-r)].filter(e=>e!==null);if(i.length<5)continue;let a=Math.max(...i)-Math.min(...i);(!e||a<e.spread)&&(e={x:t,z:n,spread:a})}return e}function J(){let e=new n(z.x,z.groundY,z.z),t=P,r=T.fov;T.fov=v,T.updateProjectionMatrix();let i=ae(ue,de),a=oe(k,i,T,A)*1.04,o=A.clone().addScaledVector(i,a);T.fov=r,T.updateProjectionMatrix();let s={pos:e.clone().add(new n(1.08,t*.92,3.3)),tgt:e.clone().add(new n(-.3,t*.52,-1.3))},c={pos:e.clone().add(new n(1.35,t*1.1,4.1)),tgt:e.clone().add(new n(-.26,t*.5,-1.8))},l={pos:e.clone().add(new n(2.85,t*3.1,7.6)),tgt:e.clone().add(new n(.05,t*.3,-2.9))},u={pos:e.clone().add(new n(4.6,t*6.2,12.4)).lerp(o,.42),tgt:e.clone().add(new n(.4,0,-4.4)).lerp(A,.45)};F=[{p:0,pos:s.pos,tgt:s.tgt,fov:_},{p:.1,pos:c.pos,tgt:c.tgt,fov:32.6},{p:.45,pos:l.pos,tgt:l.tgt,fov:34.2},{p:.75,pos:u.pos,tgt:u.tgt,fov:36.6},{p:1,pos:o,tgt:A.clone(),fov:v}]}function _e(e,t,n,r,i){let a=i*i,o=a*i;return(2*o-3*a+1)*e+(o-2*a+i)*n+(-2*o+3*a)*t+(o-a)*r}function Y(e,t){let n=F.length-1;if(t<=F[0].p)return e(F[0]);if(t>=F[n].p)return e(F[n]);let r=0;for(;r<n-1&&t>F[r+1].p;)r+=1;let i=F[r],a=F[r+1],o=a.p-i.p,s=(t-i.p)/o,c=F[r-1]||i,l=F[r+2]||a,u=(e(a)-e(c))/(a.p-c.p)*o,d=(e(l)-e(i))/(l.p-i.p)*o;return _e(e(i),e(a),u,d,s)}function X(e){F.length&&(I=re.clamp(e,0,1),H.set(Y(e=>e.pos.x,I),Y(e=>e.pos.y,I),Y(e=>e.pos.z,I)),U.set(Y(e=>e.tgt.x,I),Y(e=>e.tgt.y,I),Y(e=>e.tgt.z,I)),T.position.copy(H),T.up.set(0,1,0),T.lookAt(U),T.fov=Y(e=>e.fov,I),T.near=.02,T.far=4e3,T.updateProjectionMatrix())}function Z(){return W.set(z.x,z.groundY,z.z).project(T),G.set(z.x,z.groundY+P,z.z).project(T),Math.abs(W.y-G.y)*.5*S.clientHeight}var Q=0;function ve(e){if(e-Q<100)return;Q=e,x(`ms-progress`).textContent=`${(I*100).toFixed(1)}%`,x(`ms-camera`).textContent=`${H.x.toFixed(1)} / ${H.y.toFixed(1)} / ${H.z.toFixed(1)}`,x(`ms-target`).textContent=`${U.x.toFixed(1)} / ${U.y.toFixed(1)} / ${U.z.toFixed(1)}`,x(`ms-fov`).textContent=`${T.fov.toFixed(1)}°`;let t=Z();x(`ms-mansize`).textContent=`${t.toFixed(0)} px · ${(t/S.clientHeight*100).toFixed(1)}% h`}function $(){let e=S.clientWidth,t=S.clientHeight;!e||!t||(T.aspect=e/t,T.updateProjectionMatrix(),C.setPixelRatio(Math.min(window.devicePixelRatio,2)),C.setSize(e,t,!1),R&&(J(),X(I)))}function ye(){let t=document.createElement(`canvas`);t.width=t.height=256;let n=t.getContext(`2d`),i=n.createRadialGradient(128,128,0,128,128,128);i.addColorStop(0,`rgba(0,0,0,0.55)`),i.addColorStop(.55,`rgba(0,0,0,0.22)`),i.addColorStop(1,`rgba(0,0,0,0)`),n.fillStyle=i,n.fillRect(0,0,256,256);let s=new a(t);s.colorSpace=o;let c=new r(new e(1.1,1.1),new ne({map:s,transparent:!0,depthWrite:!1,opacity:.85}));return c.rotation.x=-Math.PI/2,c.renderOrder=1,c}var be=null;function xe(){p.registerPlugin(m);let e={p:0},t=p.timeline({scrollTrigger:{trigger:`#ms-scroll`,start:`top top`,end:`bottom bottom`,scrub:1,pin:`#ms-stage`,pinSpacing:!1,invalidateOnRefresh:!0}});t.fromTo(e,{p:0},{p:1,duration:1,ease:`none`,onUpdate:()=>X(e.p)},0);for(let e of[{id:`ms-marker-0`,show:null,hide:.2},{id:`ms-marker-1`,show:.42,hide:.62},{id:`ms-marker-2`,show:.74,hide:null}])e.show!==null&&t.fromTo(`#${e.id}`,{opacity:0,y:18},{opacity:1,y:0,duration:.06,ease:`power2.out`},e.show),e.hide!==null&&t.to(`#${e.id}`,{opacity:0,y:-14,duration:.06,ease:`power1.in`},e.hide);return p.fromTo(`#ms-marker-0`,{opacity:0,y:18},{opacity:1,y:0,duration:.8,ease:`power2.out`,delay:.15}),t}function Se(){X(1),p.set(`.ms-marker`,{opacity:1,y:0})}function Ce(){return new Promise((e,t)=>{new ee().load(h,e,e=>{e.lengthComputable&&e.total>0&&K(`Loading figure ${Math.round(e.loaded/e.total*100)}%`)},()=>t(Error(`Could not load ${h}`)))})}$(),K(`Loading 0%`),Promise.all([ie({onProgress:({percent:e,megabytes:t})=>{K(e===void 0?`Loading terrain ${t.toFixed(1)} MB`:`Loading terrain ${e}%`)}}),Ce()]).then(([e,t])=>{j=e.group,w.add(j),k.copy(e.box),A.copy(e.center);let r=t.scene;r.updateWorldMatrix(!0,!0);let i=new f().setFromObject(r),a=i.getSize(new n),o=i.getCenter(new n),s=a.y>0?g/a.y:1;r.scale.setScalar(s),r.position.set(-o.x*s,-i.min.y*s,-o.z*s),O.add(r),O.rotation.y=le,r.traverse(e=>{e.isMesh&&(e.frustumCulled=!1)});let c=ge();c&&(z.x=c.x,z.z=c.z);let l=q(z.x,z.z);z.groundY=l===null?0:l,D.position.set(z.x,z.groundY,z.z),D.updateMatrixWorld(!0),P=new f().setFromObject(O).getSize(new n).y,N=ye(),N.position.set(z.x,z.groundY+.01,z.z),w.add(N),M=new ce(r),R=!0,J(),X(0),K(null),b?Se():(be=xe(),m.refresh()),window.__manScroll={camera:T,scene:w,rig:M,place:z,track:F,manHeight:P,applyCamera:X,buildTrack:J,manScreenHeightPx:Z,getProgress:()=>I,reducedMotion:b,scrollTimeline:be}}).catch(e=>{he(String(e?.message||``).includes(`survival-man`)?`Failed to load ${h}. Regenerate it with: scripts/convert-survival-man.py`:`Failed to load ${se}. Confirm the file exists in public/models/.`,e?.message||String(e))}),window.addEventListener(`resize`,$),C.setAnimationLoop(e=>{let t=L?(e-L)/1e3:0;L=e,M&&!b&&M.update(t),ve(e),C.render(w,T)});