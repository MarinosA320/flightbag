/* DA40 D performance from digitised AFM charts (5.3.7 take-off, 5.3.8 climb, 5.3.11 landing, fuel flow).
   Each chart reproduces its own printed example within a few percent; results are a planning aid. */
(function(G){
function cy(c,x){const n=c.length;if(x<=c[0][0]){const j=Math.min(5,n-1);return c[0][1]+(x-c[0][0])*(c[j][1]-c[0][1])/((c[j][0]-c[0][0])||1)}
  if(x>=c[n-1][0]){const j=Math.max(0,n-6);return c[n-1][1]+(x-c[n-1][0])*(c[n-1][1]-c[j][1])/((c[n-1][0]-c[j][0])||1)}
  for(let i=1;i<n;i++)if(x<=c[i][0]){const a=c[i-1],b=c[i];return a[1]+(b[1]-a[1])*(x-a[0])/((b[0]-a[0])||1)}}
function fam(cs,xin,yin,xout){const s=cs.map(c=>[cy(c,xin),c]).sort((a,b)=>a[0]-b[0]);const ys=s.map(q=>q[0]);let i;
  if(yin<=ys[0])i=0;else if(yin>=ys[ys.length-1])i=ys.length-2;else{i=0;while(ys[i+1]<yin)i++}
  const f=(yin-ys[i])/((ys[i+1]-ys[i])||1);return cy(s[i][1],xout)*(1-f)+cy(s[i+1][1],xout)*f}
function paY(pa,x,PA){const k=Object.keys(pa).map(Number).sort((a,b)=>a-b);let i;if(PA<=k[0])i=0;else if(PA>=k[k.length-1])i=k.length-2;else{i=0;while(k[i+1]<PA)i++}
  const f=(PA-k[i])/((k[i+1]-k[i])||1);return cy(pa[String(k[i])],x)*(1-f)+cy(pa[String(k[i+1])],x)*f}
function make(M){
  function dist(name,PA,T,m,w){const C=M[name],a=C.ax,warn=[];
    if(PA<0){PA=0}if(PA>a.PAmax){warn.push('pressure altitude above chart');}
    if(T<a.Tlo||T>a.Thi)warn.push('temperature outside chart range');
    if(m>1150)warn.push('mass above 1150 kg');if(m<a.mmin){warn.push(`mass below chart minimum ${a.mmin} kg; ${a.mmin} kg used`);m=a.mmin}
    const xT=a.TL+(T+35)*(a.TR-a.TL)/85,xm=a.ML+(1150-m)*(a.MR-a.ML)/(1150-a.mlo);
    const y1=paY(C.pa,xT,PA),y2=fam(C.mass,a.mxin,y1,xm);let y3;
    if(w>=0){y3=fam(C.head,a.wxin,y2,a.WL+Math.min(w,20)*(a.WR-a.WL)/20);if(w>20)warn.push('headwind above 20 kt, 20 kt used')}
    else if(C.tail.length){const t=Math.min(-w,10);y3=fam(C.tail,a.wxin,y2,a.WL+t*(a.WR-a.WL)/20);if(-w>10)warn.push('tailwind above 10 kt, beyond chart')}
    else{y3=y2;warn.push('tailwind landing not covered by the AFM chart: choose the into-wind runway')}
    const D=y=>a.D0-(y-a.y0)/a.k;return {v:D(y3),steps:[D(y1),D(y2),D(y3)],warn}}
  function climb(name,PA,T,m){const C=M[name],a=C.ax;const xT=a.TL+(T+35)*(a.TR-a.TL)/85,xm=a.ML+(1150-m)*(a.MR-a.ML)/(1150-a.mlo);
    const y1=paY(C.pa,xT,PA),y2=fam(C.mass,a.mxin,y1,xm);return Math.max(0,(y2-a.y0)/a.k)}
  function fuelflow(load){const t=M.fuelflow;let i=0;if(load<=t[0][0])return t[0][1]*3.785;if(load>=t[t.length-1][0])return t[t.length-1][1]*3.785;while(t[i+1][0]<load)i++;
    const f=(load-t[i][0])/(t[i+1][0]-t[i][0]);return (t[i][1]+(t[i+1][1]-t[i][1])*f)*3.785}
  return {dist,climb,fuelflow}}
G.PerfEngine=make;
if(typeof module!=='undefined')module.exports=make;
})(typeof window!=='undefined'?window:globalThis);
