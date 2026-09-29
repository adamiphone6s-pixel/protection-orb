/* ==========================================================================
   Védőkör — WebGL „folyékony védőgömb”
   Raymarcholt, zajjal torzított gömb márkaszínekkel, irizáló pereme reagál
   az egérre és a görgetésre. Ha nincs WebGL, false-t ad vissza (2D fallback).
   ========================================================================== */
(function () {
  "use strict";

  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uHover;
uniform int uSteps;

// Ashima 3D simplex noise
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

float map(vec3 p){
  p.xz*=rot(uTime*.12+uMouse.x*.6);
  p.yz*=rot(uMouse.y*.4);
  float t=uTime*.22;
  float amp=.1+uHover*.06+uScroll*.1;
  float n=snoise(p*.95+vec3(0.,t,t*.6))*amp;
  n+=snoise(p*2.1-vec3(t*.7))*(.022+uScroll*.03);
  return (length(p)-1.)*.8-n*.8;
}

vec3 calcNormal(vec3 p){
  // tetraéderes normálisbecslés: 4 mintavétel 6 helyett
  const vec2 k=vec2(1.,-1.);
  float e=.012;
  return normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);
  vec3 ro=vec3(0.,0.,4.3);
  vec3 rd=normalize(vec3(uv,-1.75));

  // Paletta: sötét smaragd üveg, krém stúdiófény, sárgaréz peremfény
  vec3 accent=vec3(.84,.68,.38);
  vec3 ember=vec3(.05,.3,.21);
  vec3 bone=vec3(.96,.93,.86);
  vec3 graphite=vec3(.025,.07,.055);

  // Befoglaló gömb — a sugarak nagy része gyorsan kilép
  float b=dot(ro,rd);float c=dot(ro,ro)-1.55*1.55;float h=b*b-c;
  vec4 outc=vec4(0.);
  float glow=0.;
  if(h>0.){
    float t=-b-sqrt(h);
    float tmax=-b+sqrt(h);
    float minD=1e3;
    bool hit=false;
    for(int i=0;i<90;i++){
      if(i>=uSteps)break;
      vec3 p=ro+rd*t;
      float d=map(p);
      minD=min(minD,d);
      if(d<.0025){hit=true;break;}
      t+=d;
      if(t>tmax)break;
    }
    glow=exp(-minD*9.);
    if(hit){
      vec3 p=ro+rd*t;
      vec3 n=calcNormal(p);
      float fres=pow(1.-max(dot(n,-rd),0.),2.4);
      float band=snoise(n*1.6+vec3(uTime*.1))*.5+.5;
      vec3 l=normalize(vec3(-.5,.8,.6));
      float dif=max(dot(n,l),0.);
      float spec=pow(max(dot(reflect(-l,n),-rd),0.),64.);
      vec3 rf=reflect(rd,n);
      // stúdió-softbox tükröződés felül + finom zajos csíkok
      float env=smoothstep(.15,.95,rf.y)*(.55+.45*band);
      float strip=smoothstep(.72,.98,sin(rf.x*3.2+band*2.+uTime*.15)*.5+.5)*smoothstep(-.2,.6,rf.y);
      vec3 col=graphite*(.6+.8*dif);
      col+=bone*env*.5;
      col+=bone*strip*.32;
      // alsó, meleg visszaverődés
      col+=ember*smoothstep(.2,1.,-n.y+band*.25)*.8;
      // sárgaréz perem
      col+=accent*pow(fres,2.2)*1.25;
      col+=bone*spec*.9;
      outc=vec4(col,1.);
    } else {
      // lágy, élsimított perem a lépcsőzés ellen
      float edge=1.-smoothstep(0.,.03,minD);
      outc=vec4(accent*.85,edge*.8);
    }
  }
  // külső fényudvar
  float halo=glow*.55*(1.-outc.a)*(1.-smoothstep(.3,.5,length(uv)));
  vec3 hcol=accent*halo*.75;
  float a=clamp(outc.a+halo,0.,1.);
  vec3 col=outc.rgb*outc.a+hcol;
  gl_FragColor=vec4(col,a);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  window.VKOrbGL = function (canvas, opts) {
    opts = opts || {};
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let gl;
    try {
      gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "high-performance" });
    } catch (e) { gl = null; }
    if (!gl) return false;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ["uRes", "uTime", "uMouse", "uScroll", "uHover", "uSteps"].forEach((n) => (u[n] = gl.getUniformLocation(prog, n)));

    const mobile = window.matchMedia("(max-width: 820px)").matches;
    // Pixelkeret: a gömb lágy, ezért a vásznat kisebb felbontáson rendereljük és a CSS nagyítja fel.
    const baseScale = opts.quality || (mobile ? 0.6 : 0.8);
    let scale = baseScale;
    const MAX_PX = mobile ? 560 : 820;
    gl.uniform1i(u.uSteps, mobile ? 40 : 56);
    let w = 0, h = 0, running = false, visible = true, raf = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let scroll = 0, hover = 0, hoverT = 0;
    const t0 = performance.now();

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25) * scale;
      const cap = Math.min(1, (MAX_PX * scale / baseScale) / Math.max(r.width * dpr, r.height * dpr, 1));
      w = Math.max(1, Math.round(r.width * dpr * cap));
      h = Math.max(1, Math.round(r.height * dpr * cap));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      frame(performance.now());
    }
    // Adaptív minőség: lassú gépen csökkenti, gyorson visszaállítja a felbontást
    let fCount = 0, fSum = 0, fLast = 0;
    function adapt(now) {
      if (fLast) { fSum += now - fLast; fCount++; }
      fLast = now;
      if (fCount < 40) return;
      const avg = fSum / fCount;
      fCount = 0; fSum = 0;
      if (avg > 21 && scale > 0.4) { scale = Math.max(0.4, scale * 0.82); resize(); }
      else if (avg < 14 && scale < baseScale) { scale = Math.min(baseScale, scale * 1.1); resize(); }
    }
    function frame(now) {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      hover += (hoverT - hover) * 0.06;
      gl.uniform1f(u.uTime, reduce ? 2.0 : (now - t0) / 1000);
      gl.uniform2f(u.uMouse, mouse.x, mouse.y);
      gl.uniform1f(u.uScroll, scroll);
      gl.uniform1f(u.uHover, hover);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      if (!running) return;
      adapt(now);
      frame(now);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || reduce || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; fLast = 0; cancelAnimationFrame(raf); }

    if (!reduce) {
      window.addEventListener("pointermove", (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener("resize", resize);
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stop(); });

    resize();
    start();

    return {
      setScroll(v) { scroll = v; if (reduce) frame(performance.now()); },
      setHover(v) { hoverT = v; }
    };
  };
})();
