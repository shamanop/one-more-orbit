// Headless balance sim: runs the real <script> from index.html with a stubbed DOM and fake clock.
// Usage: node tools/sim.js   (200 seeded runs per strategy; see bottom of file)
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function run({W=390,H=844,strategy='none',seconds=300,seed=1}){
  let s=seed; const rnd=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};
  const M=Object.create(Math); M.random=rnd;
  const els={}; const el=id=>els[id]||(els[id]={id,textContent:'',classList:{add(){this.s=1},remove(){this.s=0}},style:{},listeners:{},addEventListener(t,f){this.listeners[t]=f},getContext:()=>new Proxy({},{get:(_,k)=>k==='createRadialGradient'?()=>({addColorStop(){}}):k==='canvas'?undefined:()=>{} ,set:()=>true})});
  let now=0, timers=[], rafs=[];
  const stubNode=()=>({connect(){},start(){},stop(){},frequency:{value:0},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}});
  const env={document:{getElementById:el,hidden:false,addEventListener(){}},performance:{now:()=>now},innerWidth:W,innerHeight:H,window:{addEventListener(){},devicePixelRatio:1,AudioContext:null},
    AudioContext:function(){return{currentTime:0,sampleRate:8000,destination:{},createOscillator:stubNode,createGain:stubNode,createBufferSource:stubNode,createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)})}},
    setTimeout:(f,ms)=>timers.push({t:now+ms,f}),requestAnimationFrame:f=>rafs.push(f),Math:M,Date:{now:()=>now}};
  const expose='; return {get moons(){return moons},get score(){return score},get dead(){return dead},canvas,tryCapture,get touch(){return touch},set touch(v){touch=v}};';
  const g=new Function(...Object.keys(env),src+expose)(...Object.values(env));
  const stats={captures:0,deathAt:null,maxOrbit:0,lockedAt:null};
  const step=1000/60;
  for(let t=0;t<seconds*1000;t+=step){
    now=t; timers=timers.filter(x=>x.t<=now?(x.f(),false):true);
    if(strategy==='tapspam' && Math.round(t/step)%6===0){ // tap+release every 100ms at a far corner
      g.touch={x:0,y:0}; const b=g.score; g.tryCapture(); g.touch=null;
    }
    const r=rafs; rafs=[]; r.forEach(f=>f(now));
    const orb=g.moons.filter(m=>m.orbiting).length; stats.maxOrbit=Math.max(stats.maxOrbit,orb);
    if(orb===5&&stats.lockedAt===null) stats.lockedAt=t/1000;
    if(g.dead){stats.deathAt=t/1000;break;}
  }
  stats.score=g.score; stats.finalText=el('final').textContent; stats.moonsNow=g.moons.length;
  return stats;
}
module.exports=run;
if(require.main===module){
  const out={none:[],tapspam:[]};
  for(const strat of ['none','tapspam']) for(let sd=1;sd<=200;sd++) out[strat].push(run({strategy:strat,seed:sd*7919,seconds:strat==='none'?120:600}));
  const sum=(a,f)=>a.filter(f).length;
  const n=out.none, tsp=out.tapspam;
  const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
  console.log('NO INPUT (200 runs, 120s): died',sum(n,r=>r.deathAt!==null),'| median death t',med(n.filter(r=>r.deathAt).map(r=>r.deathAt)));
  console.log('TAP-SPAM far corner (200 runs, 600s): died',sum(tsp,r=>r.deathAt!==null),'| reached 5 orbiting',sum(tsp,r=>r.lockedAt!==null),'| median lock t',med(tsp.filter(r=>r.lockedAt).map(r=>r.lockedAt)),'| alive at 600s w/ 0 free moons',sum(tsp,r=>!r.deathAt&&r.moonsNow===5));
  console.log('sample death text:',JSON.stringify(n.find(r=>r.deathAt&&r.score%1)?.finalText));
  console.log('sample tapspam final score @600s:',tsp.find(r=>!r.deathAt)?.score.toFixed(1));
}
