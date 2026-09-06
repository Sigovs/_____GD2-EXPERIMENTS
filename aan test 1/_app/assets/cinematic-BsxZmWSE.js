/* empty css              */import{M as e,V as t,c as n,j as r,m as i,n as a,o,r as s,w as c,y as l}from"./GLTFLoader-Cdku5qF-.js";import{n as u,t as d}from"./ScrollTrigger-Cgjl6ODA.js";import{i as f,n as p,r as m,t as h}from"./terrain-BpImuLhV.js";u.registerPlugin(d);var g=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,_=.65,v=[{p:0,azimuth:0,elevation:82,margin:1.06,targetY:0},{p:.25,azimuth:14,elevation:74,margin:1.06,targetY:0},{p:.65,azimuth:46,elevation:30,margin:1.08,targetY:.1},{p:1,azimuth:64,elevation:7,margin:1.02,targetY:.55}],y=document.querySelector(`#app`);document.documentElement.classList.add(`mode-cinematic`),g&&document.documentElement.classList.add(`is-static`),y.innerHTML=`
  <div class="cine-scroll" id="cine-scroll">
    <div class="cine-stage" id="cine-stage">
      <canvas id="cine-canvas"></canvas>

      <div class="cine-type">
        <div class="cine-zone">
          <p class="cine-eyebrow" id="cine-eyebrow">GD2 / Visitor Intelligence</p>

          <div class="cine-headlines">
            <h1 class="cine-headline cine-headline--first" id="cine-headline-1">
              <span class="cine-line"><span>See the whole</span></span>
              <span class="cine-line"><span>landscape.</span></span>
            </h1>

            <h2 class="cine-headline cine-headline--second" id="cine-headline-2">
              <span class="cine-line"><span>Know where</span></span>
              <span class="cine-line"><span>to move.</span></span>
            </h2>
          </div>
        </div>
      </div>

      <p class="cine-status" id="cine-status">Loading 0%</p>

      <div class="cine-error" id="cine-error" hidden>
        <span class="notice__label">Error</span>
        <p class="notice__message" id="cine-error-message"></p>
        <p class="notice__detail" id="cine-error-detail"></p>
      </div>
    </div>
  </div>
`;var b=e=>document.getElementById(e),x=b(`cine-canvas`),S=b(`cine-stage`),C=new a({canvas:x,antialias:!0});C.setPixelRatio(Math.min(window.devicePixelRatio,2)),C.outputColorSpace=r,C.toneMapping=0;var w=new e;w.background=new o(`#0c0e11`);var T=new c(35,1,.1,5e3),E=new i(16777215,7039851,1.1);w.add(E);var D=new n(16777215,2.5);w.add(D);var O=new s,k=new t,A=new t,j=!1,M=0;function N(e,t,n,r,i){let a=i*i,o=a*i;return(2*o-3*a+1)*e+(o-2*a+i)*n+(-2*o+3*a)*t+(o-a)*r}function P(e,t){let n=v.length-1;if(t<=v[0].p)return v[0][e];if(t>=v[n].p)return v[n][e];let r=0;for(;r<n-1&&t>v[r+1].p;)r+=1;let i=v[r],a=v[r+1],o=a.p-i.p,s=(t-i.p)/o,c=v[r-1]||i,l=v[r+2]||a,u=(a[e]-c[e])/(a.p-c.p)*o,d=(l[e]-i[e])/(l.p-i.p)*o;return N(i[e],a[e],u,d,s)}function F(e,t,n){let r=l.clamp((n-e)/(t-e),0,1);return r*r*(3-2*r)}function I(e){if(!j)return;M=e;let t=P(`azimuth`,e),n=l.clamp(P(`elevation`,e),4,88),r=Math.max(P(`margin`,e),1);A.copy(k),A.y+=P(`targetY`,e);let i=p(t,n),a=m(O,i,T,A)*r;T.position.copy(A).addScaledVector(i,a),T.lookAt(A),T.near=Math.max(a/1e3,.01),T.far=a*10,T.updateProjectionMatrix();let o=F(.2,.75,e);D.position.copy(p(l.lerp(26,-14,o),l.lerp(62,33,o))).multiplyScalar(120),D.intensity=l.lerp(2.5,2.85,o)}function L(){let e=S.clientWidth,t=S.clientHeight;!e||!t||(T.aspect=e/t,T.updateProjectionMatrix(),C.setPixelRatio(Math.min(window.devicePixelRatio,2)),C.setSize(e,t,!1),I(M))}function R(e){let t=b(`cine-status`);if(e===null){t.hidden=!0;return}t.hidden=!1,t.textContent=e}function z(e,t){b(`cine-error-message`).textContent=e,b(`cine-error-detail`).textContent=t||``,b(`cine-error`).hidden=!1,R(null)}function B(){let e={p:0},t=u.timeline({scrollTrigger:{trigger:`#cine-scroll`,start:`top top`,end:`bottom bottom`,scrub:1,pin:`#cine-stage`,pinSpacing:!1,invalidateOnRefresh:!0}});t.fromTo(e,{p:0},{p:1,duration:1,ease:`none`,onUpdate:()=>I(e.p)},0);let n=b(`cine-headline-1`),r=b(`cine-headline-2`).querySelectorAll(`.cine-line > span`),i=b(`cine-eyebrow`);return t.to(i,{opacity:0,y:-24,duration:.13,ease:`power1.in`},.26),t.to(n,{opacity:0,y:-76,duration:.17,ease:`power1.in`},.28),t.fromTo(r,{yPercent:105,opacity:0},{yPercent:0,opacity:1,duration:.14,stagger:.075,ease:`power2.out`},.68),t}function V(){let e=u.timeline({defaults:{ease:`power2.out`}});return e.fromTo(`#cine-eyebrow`,{opacity:0,y:14},{opacity:1,y:0,duration:.7},0),e.fromTo(`#cine-headline-1 .cine-line > span`,{opacity:0,y:28},{opacity:1,y:0,duration:.95,stagger:.12},.12),e}function H(){I(_),u.set([`#cine-eyebrow`,`.cine-headline`,`.cine-line > span`],{opacity:1,y:0,yPercent:0})}L(),f({onProgress:({percent:e,megabytes:t})=>{R(e===void 0?`Loading ${t.toFixed(1)} MB`:`Loading ${e}%`)}}).then(e=>{w.add(e.group),O.copy(e.box),k.copy(e.center),j=!0,R(null),L(),g?H():(I(0),B(),d.refresh(),V())}).catch(e=>{z(`Failed to load ${h}. Confirm the file exists in public/models/ and that the dev server is serving it.`,e?.message||String(e))}),window.addEventListener(`resize`,L),C.setAnimationLoop(()=>{C.render(w,T)});