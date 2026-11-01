/* Nestor — Copyright (C) 2026 Macr0b — AGPL-3.0-or-later (voir LICENSE). */
/* Géométrie : lecture DXF/SVG, regroupement des pièces, placement (rectangles et imbrication), export DXF. */
var Geo=(function(){
  "use strict";
  function num(v,d){var n=parseFloat(String(v).replace(",","."));return isFinite(n)?n:d}

  /* ---- chemin SVG -> polylignes (coordonnées utilisateur) ---- */
  var NARGS={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7,Z:0};
  function flattenPath(d,stepFn){
    var subs=[],cur=null,i=0,s=String(d),n=s.length,cmd=null;
    var cx=0,cy=0,sx=0,sy=0,pcx=0,pcy=0,prev="";
    function ws(){while(i<n&&/[\s,]/.test(s[i]))i++}
    function isNum(){ws();return i<n&&/[0-9.+\-]/.test(s[i])}
    function rnum(){ws();var m=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i,i+40));if(!m)throw new Error("num");i+=m[0].length;return parseFloat(m[0])}
    function rflag(){ws();var c=s[i];if(c!=="0"&&c!=="1")throw new Error("flag");i++;return c==="1"?1:0}
    function pt(x,y){cur.pts.push([x,y])}
    function newSub(x,y){cur={pts:[[x,y]],closed:false};subs.push(cur)}
    function cubic(x1,y1,x2,y2,x3,y3){
      var len=Math.hypot(x1-cx,y1-cy)+Math.hypot(x2-x1,y2-y1)+Math.hypot(x3-x2,y3-y2);
      var k=Math.max(2,Math.min(200,Math.ceil(stepFn(len))));
      for(var j=1;j<=k;j++){var t=j/k,u=1-t;pt(u*u*u*cx+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,u*u*u*cy+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3)}
    }
    function quad(x1,y1,x2,y2){
      var len=Math.hypot(x1-cx,y1-cy)+Math.hypot(x2-x1,y2-y1);
      var k=Math.max(2,Math.min(200,Math.ceil(stepFn(len))));
      for(var j=1;j<=k;j++){var t=j/k,u=1-t;pt(u*u*cx+2*u*t*x1+t*t*x2,u*u*cy+2*u*t*y1+t*t*y2)}
    }
    function arc(rx,ry,rot,fa,fs,x2,y2){
      var x1=cx,y1=cy;rx=Math.abs(rx);ry=Math.abs(ry);
      if(rx<1e-9||ry<1e-9||(x1===x2&&y1===y2)){pt(x2,y2);return}
      var phi=rot*Math.PI/180,co=Math.cos(phi),si=Math.sin(phi);
      var dx=(x1-x2)/2,dy=(y1-y2)/2,x1p=co*dx+si*dy,y1p=-si*dx+co*dy;
      var lam=x1p*x1p/(rx*rx)+y1p*y1p/(ry*ry);if(lam>1){var r=Math.sqrt(lam);rx*=r;ry*=r}
      var num_=rx*rx*ry*ry-rx*rx*y1p*y1p-ry*ry*x1p*x1p,den=rx*rx*y1p*y1p+ry*ry*x1p*x1p;
      var c=Math.sqrt(Math.max(0,num_/den))*(fa===fs?-1:1);
      var cxp=c*rx*y1p/ry,cyp=-c*ry*x1p/rx;
      var ccx=co*cxp-si*cyp+(x1+x2)/2,ccy=si*cxp+co*cyp+(y1+y2)/2;
      function ang(ux,uy,vx,vy){return Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy)}
      var t1=ang(1,0,(x1p-cxp)/rx,(y1p-cyp)/ry),dt=ang((x1p-cxp)/rx,(y1p-cyp)/ry,(-x1p-cxp)/rx,(-y1p-cyp)/ry);
      if(!fs&&dt>0)dt-=2*Math.PI;if(fs&&dt<0)dt+=2*Math.PI;
      var k=Math.max(4,Math.min(360,Math.ceil(stepFn(Math.abs(dt)*Math.max(rx,ry)))));
      for(var j=1;j<=k;j++){var t=t1+dt*j/k;
        if(j===k){pt(x2,y2);break}
        pt(ccx+rx*Math.cos(t)*co-ry*Math.sin(t)*si,ccy+rx*Math.cos(t)*si+ry*Math.sin(t)*co)}
    }
    while(true){
      ws();if(i>=n)break;
      var ch=s[i];
      if(/[a-zA-Z]/.test(ch)){cmd=ch;i++;
        if(cmd==="z"||cmd==="Z"){if(cur){cur.closed=true;cx=sx;cy=sy;cur=null}prev="Z";continue}
        if(!NARGS.hasOwnProperty(cmd.toUpperCase()))return subs;
      } else if(!cmd) break;
      if(cmd==="z"||cmd==="Z")break;
      var U=cmd.toUpperCase(),rel=cmd!==U,first=true;
      do{
        var a=[];
        if(U==="A"){a=[rnum(),rnum(),rnum(),rflag(),rflag(),rnum(),rnum()]}
        else for(var q=0;q<NARGS[U];q++)a.push(rnum());
        var ox=rel?cx:0,oy=rel?cy:0;
        if(U==="M"){
          if(first){cx=a[0]+ox;cy=a[1]+oy;sx=cx;sy=cy;newSub(cx,cy);prev="M"}
          else{if(!cur)newSub(cx,cy);cx=a[0]+ox;cy=a[1]+oy;pt(cx,cy);prev="L"}
        } else {
          if(!cur){newSub(cx,cy);sx=cx;sy=cy}
          if(U==="L"){cx=a[0]+ox;cy=a[1]+oy;pt(cx,cy)}
          else if(U==="H"){cx=a[0]+ox;pt(cx,cy)}
          else if(U==="V"){cy=a[0]+oy;pt(cx,cy)}
          else if(U==="C"){var c1=[a[0]+ox,a[1]+oy],c2=[a[2]+ox,a[3]+oy],e=[a[4]+ox,a[5]+oy];cubic(c1[0],c1[1],c2[0],c2[1],e[0],e[1]);pcx=c2[0];pcy=c2[1];cx=e[0];cy=e[1]}
          else if(U==="S"){var r1=(prev==="C"||prev==="S")?[2*cx-pcx,2*cy-pcy]:[cx,cy];var c2b=[a[0]+ox,a[1]+oy],eb=[a[2]+ox,a[3]+oy];cubic(r1[0],r1[1],c2b[0],c2b[1],eb[0],eb[1]);pcx=c2b[0];pcy=c2b[1];cx=eb[0];cy=eb[1]}
          else if(U==="Q"){var qc=[a[0]+ox,a[1]+oy],qe=[a[2]+ox,a[3]+oy];quad(qc[0],qc[1],qe[0],qe[1]);pcx=qc[0];pcy=qc[1];cx=qe[0];cy=qe[1]}
          else if(U==="T"){var tc=(prev==="Q"||prev==="T")?[2*cx-pcx,2*cy-pcy]:[cx,cy],te=[a[0]+ox,a[1]+oy];quad(tc[0],tc[1],te[0],te[1]);pcx=tc[0];pcy=tc[1];cx=te[0];cy=te[1]}
          else if(U==="A"){var ax=a[5]+ox,ay=a[6]+oy;arc(a[0],a[1],a[2],a[3],a[4],ax,ay);cx=ax;cy=ay}
          prev=U;
        }
        first=false;
      }while(isNum());
    }
    return subs;
  }

  /* ---- outils ---- */
  function bbox(paths){var b=[Infinity,Infinity,-Infinity,-Infinity];
    paths.forEach(function(p){p.pts.forEach(function(q){if(q[0]<b[0])b[0]=q[0];if(q[1]<b[1])b[1]=q[1];if(q[0]>b[2])b[2]=q[0];if(q[1]>b[3])b[3]=q[1]})});return b}
  function simplify(pts,tol){
    if(pts.length<3)return pts;
    var keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;var st=[[0,pts.length-1]];
    while(st.length){var r=st.pop(),a=pts[r[0]],b=pts[r[1]],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),mx=-1,mi=-1;
      for(var k=r[0]+1;k<r[1];k++){var p=pts[k],d=L<1e-12?Math.hypot(p[0]-a[0],p[1]-a[1]):Math.abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/L;if(d>mx){mx=d;mi=k}}
      if(mx>tol){keep[mi]=1;st.push([r[0],mi]);st.push([mi,r[1]])}}
    return pts.filter(function(_,k){return keep[k]});
  }
  function closeIfTouching(p){if(!p.closed&&p.pts.length>2){var a=p.pts[0],b=p.pts[p.pts.length-1];if(Math.hypot(a[0]-b[0],a[1]-b[1])<0.01){p.closed=true;p.pts.pop()}}}

  /* ---- regroupement : chaînage des segments ouverts + inclusion ---- */
  function groupPieces(paths){
    paths=paths.filter(function(p){return p.pts.length>=2});
    paths.forEach(closeIfTouching);
    var N=paths.length,par=new Int32Array(N);for(var i=0;i<N;i++)par[i]=i;
    function f(x){while(par[x]!==x){par[x]=par[par[x]];x=par[x]}return x}
    var tol=0.05,grid={};
    function key(x,y){return Math.round(x/tol)+":"+Math.round(y/tol)}
    paths.forEach(function(p,idx){if(p.closed)return;[p.pts[0],p.pts[p.pts.length-1]].forEach(function(q){
      var gx=Math.round(q[0]/tol),gy=Math.round(q[1]/tol);
      for(var ax=-1;ax<=1;ax++)for(var ay=-1;ay<=1;ay++){var l=grid[(gx+ax)+":"+(gy+ay)];if(l)l.forEach(function(o){var po=paths[o.i].pts[o.e?paths[o.i].pts.length-1:0];if(Math.hypot(po[0]-q[0],po[1]-q[1])<=tol){par[f(idx)]=f(o.i)}})}
    });var k1=key(p.pts[0][0],p.pts[0][1]),k2=key(p.pts[p.pts.length-1][0],p.pts[p.pts.length-1][1]);(grid[k1]=grid[k1]||[]).push({i:idx,e:0});(grid[k2]=grid[k2]||[]).push({i:idx,e:1})});
    var cl={};paths.forEach(function(p,idx){var r=f(idx);(cl[r]=cl[r]||[]).push(p)});
    function d2(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
    function chain(ps){
      var closed=ps.filter(function(p){return p.closed}),rem=ps.filter(function(p){return !p.closed}),out=closed.slice();
      while(rem.length){var cur=rem.shift(),pts=cur.pts.slice(),found=true;
        while(found){found=false;
          for(var i=0;i<rem.length;i++){var q=rem[i].pts,s=q[0],e=q[q.length-1],end=pts[pts.length-1],st=pts[0];
            if(d2(end,s)<=tol)pts=pts.concat(q.slice(1));
            else if(d2(end,e)<=tol)pts=pts.concat(q.slice().reverse().slice(1));
            else if(d2(st,e)<=tol)pts=q.slice(0,-1).concat(pts);
            else if(d2(st,s)<=tol)pts=q.slice().reverse().slice(0,-1).concat(pts);
            else continue;
            rem.splice(i,1);found=true;break}}
        var c=pts.length>3&&d2(pts[0],pts[pts.length-1])<=tol;if(c)pts.pop();
        out.push({pts:pts,closed:c,layer:cur.layer,color:cur.color})}
      return out}
    var clusters=Object.keys(cl).map(function(k){var ps=chain(cl[k]);return {paths:ps,b:bbox(ps)}});
    function build(cls){
      cls.sort(function(a,b){return (b.b[2]-b.b[0])*(b.b[3]-b.b[1])-(a.b[2]-a.b[0])*(a.b[3]-a.b[1])});
      var tops=[],e=0.01;
      cls.forEach(function(c){var host=null;
        for(var t=0;t<tops.length;t++){var h=tops[t].b;if(c.b[0]>=h[0]-e&&c.b[1]>=h[1]-e&&c.b[2]<=h[2]+e&&c.b[3]<=h[3]+e){host=tops[t];break}}
        if(host){host.paths=host.paths.concat(c.paths);host.kids++}else tops.push({paths:c.paths.slice(),b:c.b,kids:0,outer:c})});
      return tops;
    }
    var tops=build(clusters.slice()),frame=false;
    if(tops.length===1&&tops[0].kids>=2){var o=tops[0].outer;
      if(o.paths.length===1&&o.paths[0].closed&&simplify(o.paths[0].pts.concat([o.paths[0].pts[0]]),0.01).length<=5){
        frame=true;tops=build(clusters.filter(function(c){return c!==o}))}}
    var pieces=tops.map(function(t){var b=t.b;
      return {w:b[2]-b[0],h:b[3]-b[1],paths:t.paths.map(function(p){return {pts:p.pts.map(function(q){return [q[0]-b[0],q[1]-b[1]]}),closed:p.closed,layer:p.layer||"",color:p.color||""}})}});
    return {pieces:pieces,frame:frame};
  }
  function signature(pc){var n=0;pc.paths.forEach(function(p){n+=p.pts.length});
    return Math.round(pc.w*10)+"x"+Math.round(pc.h*10)+"/"+pc.paths.length+"/"+n}
  function toTypes(pieces){
    var map={},list=[];
    pieces.forEach(function(pc){var s=signature(pc);if(map[s]){map[s].qty++;return}var t={name:"",qty:1,rot:true,w:pc.w,h:pc.h,paths:pc.paths};map[s]=t;list.push(t)});
    list.sort(function(a,b){return b.w*b.h-a.w*a.h});
    list.forEach(function(t,i){t.name="Pièce "+(i+1)});
    return list;
  }

  /* ---- DXF ---- */
  function parseDXF(text,unitOverride){
    var lines=text.split(/\r\n|\r|\n/),pairs=[];
    for(var i=0;i+1<lines.length;i+=2){var c=parseInt(lines[i].trim(),10);if(isNaN(c))continue;pairs.push([c,lines[i+1].trim()])}
    var ins=0,warn={},section=null,ents=[],curE=null,polyl=null;
    for(var j=0;j<pairs.length;j++){var c=pairs[j][0],v=pairs[j][1];
      if(c===0&&v==="SECTION"){var nx=pairs[j+1];section=nx&&nx[0]===2?nx[1]:null;continue}
      if(c===0&&v==="ENDSEC"){section=null;continue}
      if(section==="HEADER"&&c===9&&v==="$INSUNITS"){var nn=pairs[j+1];if(nn)ins=parseInt(nn[1],10)||0}
      if(section!=="ENTITIES")continue;
      if(c===0){curE={type:v,g:[]};ents.push(curE);continue}
      if(curE)curE.g.push([c,v]);
    }
    var umap={0:1,1:25.4,2:304.8,4:1,5:10,6:1000,8:0.0000254,9:0.0254,10:914.4};
    var f=unitOverride&&unitOverride!=="auto"?num(unitOverride,1):(umap[ins]||1);
    var paths=[],step=function(len){return len*f/0.25};
    function G(e,code){for(var k=0;k<e.g.length;k++)if(e.g[k][0]===code)return parseFloat(e.g[k][1]);return undefined}
    function GS(e,code){for(var k=0;k<e.g.length;k++)if(e.g[k][0]===code)return e.g[k][1];return ""}
    function bulgeSeg(out,p1,p2,b){
      if(!b||Math.abs(b)<1e-9){out.push(p2);return}
      var th=4*Math.atan(b),c=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);if(c<1e-12){out.push(p2);return}
      var r=c/(2*Math.sin(Math.abs(th)/2)),a0=Math.atan2(p2[1]-p1[1],p2[0]-p1[0]);
      var off=Math.sign(th)*(Math.PI/2-Math.abs(th)/2),cx=p1[0]+r*Math.cos(a0+off),cy=p1[1]+r*Math.sin(a0+off);
      var s0=Math.atan2(p1[1]-cy,p1[0]-cx),k=Math.max(4,Math.min(360,Math.ceil(step(Math.abs(th)*r))));
      for(var q=1;q<k;q++){var t=s0+th*q/k;out.push([cx+r*Math.cos(t),cy+r*Math.sin(t)])}
      out.push(p2);
    }
    function polyFrom(verts,closed){
      var out=[verts[0].p];
      for(var q=1;q<verts.length;q++)bulgeSeg(out,verts[q-1].p,verts[q].p,verts[q-1].b);
      if(closed&&verts.length>1){bulgeSeg(out,verts[verts.length-1].p,verts[0].p,verts[verts.length-1].b);out.pop()}
      return out;
    }
    function add(pts,closed,e){if(pts.length>=2)paths.push({pts:pts,closed:closed,layer:GS(e,8)})}
    for(var ei=0;ei<ents.length;ei++){var e=ents[ei],T=e.type;
      if(T==="LINE")add([[G(e,10),G(e,20)],[G(e,11),G(e,21)]],false,e);
      else if(T==="LWPOLYLINE"){var vs=[],flag=G(e,70)||0;
        e.g.forEach(function(g){if(g[0]===10)vs.push({p:[parseFloat(g[1]),0],b:0});else if(g[0]===20&&vs.length)vs[vs.length-1].p[1]=parseFloat(g[1]);else if(g[0]===42&&vs.length)vs[vs.length-1].b=parseFloat(g[1])});
        if(vs.length)add(polyFrom(vs,!!(flag&1)),!!(flag&1),e)}
      else if(T==="POLYLINE"){polyl={e:e,flag:G(e,70)||0,vs:[]}}
      else if(T==="VERTEX"&&polyl){var vf=G(e,70)||0;if(!(vf&16))polyl.vs.push({p:[G(e,10),G(e,20)],b:G(e,42)||0})}
      else if(T==="SEQEND"&&polyl){if(polyl.vs.length&&!(polyl.flag&(16|64)))add(polyFrom(polyl.vs,!!(polyl.flag&1)),!!(polyl.flag&1),polyl.e);polyl=null}
      else if(T==="CIRCLE"||T==="ARC"){var cx=G(e,10),cy=G(e,20),r=G(e,40),a1=0,a2=2*Math.PI,full=T==="CIRCLE";
        if(!full){a1=(G(e,50)||0)*Math.PI/180;a2=(G(e,51)||0)*Math.PI/180;while(a2<=a1)a2+=2*Math.PI}
        var k=Math.max(full?24:4,Math.min(720,Math.ceil(step((a2-a1)*r)))),pts=[];
        for(var q=0;q<(full?k:k+1);q++){var t=a1+(a2-a1)*q/k;pts.push([cx+r*Math.cos(t),cy+r*Math.sin(t)])}
        add(pts,full,e)}
      else if(T==="ELLIPSE"){var ecx=G(e,10),ecy=G(e,20),mx=G(e,11),my=G(e,21),ra=G(e,40)||1,p1=G(e,41)||0,p2=G(e,42);if(p2===undefined)p2=2*Math.PI;while(p2<=p1)p2+=2*Math.PI;
        var R=Math.hypot(mx,my),ang=Math.atan2(my,mx),efull=Math.abs(p2-p1-2*Math.PI)<1e-6,ek=Math.max(24,Math.min(720,Math.ceil(step((p2-p1)*R)))),ep=[];
        for(var q2=0;q2<(efull?ek:ek+1);q2++){var tt=p1+(p2-p1)*q2/ek,x=R*Math.cos(tt),y=R*ra*Math.sin(tt);ep.push([ecx+x*Math.cos(ang)-y*Math.sin(ang),ecy+x*Math.sin(ang)+y*Math.cos(ang)])}
        add(ep,efull,e)}
      else if(T==="SPLINE"){var deg=G(e,71)||3,sflag=G(e,70)||0,knots=[],ctrl=[],wts=[],fit=[];
        e.g.forEach(function(g){var v=parseFloat(g[1]);if(g[0]===40)knots.push(v);else if(g[0]===10)ctrl.push([v,0]);else if(g[0]===20&&ctrl.length)ctrl[ctrl.length-1][1]=v;else if(g[0]===41)wts.push(v);else if(g[0]===11)fit.push([v,0]);else if(g[0]===21&&fit.length)fit[fit.length-1][1]=v});
        var sp=null;
        if(ctrl.length>deg&&knots.length===ctrl.length+deg+1){
          var u0=knots[deg],u1=knots[ctrl.length],ln=0;for(var q3=1;q3<ctrl.length;q3++)ln+=Math.hypot(ctrl[q3][0]-ctrl[q3-1][0],ctrl[q3][1]-ctrl[q3-1][1]);
          var sk=Math.max(ctrl.length*8,Math.min(4000,Math.ceil(step(ln))));sp=[];
          for(var q4=0;q4<=sk;q4++){var u=u0+(u1-u0)*q4/sk;if(q4===sk)u=u1-1e-12*(u1-u0);
            var kk=deg;while(kk<ctrl.length-1&&knots[kk+1]<=u)kk++;
            var dpts=[];for(var z=0;z<=deg;z++){var cp=ctrl[kk-deg+z],w=wts.length===ctrl.length?wts[kk-deg+z]:1;dpts.push([cp[0]*w,cp[1]*w,w])}
            for(var rr=1;rr<=deg;rr++)for(var jj=deg;jj>=rr;jj--){var ii=kk-deg+jj,den=knots[ii+deg-rr+1]-knots[ii],al=den===0?0:(u-knots[ii])/den;
              dpts[jj]=[(1-al)*dpts[jj-1][0]+al*dpts[jj][0],(1-al)*dpts[jj-1][1]+al*dpts[jj][1],(1-al)*dpts[jj-1][2]+al*dpts[jj][2]]}
            var D=dpts[deg];sp.push([D[0]/D[2],D[1]/D[2]])}
        } else if(fit.length>=2)sp=fit; else if(ctrl.length>=2)sp=ctrl;
        if(sp)add(sp,!!(sflag&1),e)}
      else if(T==="INSERT")warn.blocs=(warn.blocs||0)+1;
      else if(T==="TEXT"||T==="MTEXT")warn.textes=(warn.textes||0)+1;
    }
    paths.forEach(function(p){p.pts=simplify(p.pts.map(function(q){return [q[0]*f,-q[1]*f]}),0.01)});
    return {paths:paths,factor:f,detected:umap[ins]?ins:0,warn:warn};
  }

  /* ---- export ---- */
  function exportDXF(polys,W){
    var o=["0","SECTION","2","HEADER","9","$ACADVER","1","AC1009","9","$INSUNITS","70","4","0","ENDSEC","0","SECTION","2","ENTITIES"];
    function r(v){return (Math.round(v*10000)/10000).toString()}
    polys.forEach(function(p){var lay=(p.layer||"0").replace(/[^A-Za-z0-9_\-]/g,"_")||"0";
      o.push("0","POLYLINE","8",lay,"66","1","70",p.closed?"1":"0","10","0","20","0","30","0");
      p.pts.forEach(function(q){o.push("0","VERTEX","8",lay,"10",r(q[0]),"20",r(W-q[1]),"30","0")});
      o.push("0","SEQEND","8",lay)});
    o.push("0","ENDSEC","0","EOF");return o.join("\r\n")+"\r\n";
  }

  /* ---- placement guillotine (encombrements) ---- */
  function pack(sheet,types){
    var k=Math.max(0,num(sheet.gap,0)),t=Math.max(0,num(sheet.margin,0)),items=[],unplaced=[];
    var panels=(sheet.panels||[]).map(function(p,pi){var q=p.qty===""||p.qty==null||num(p.qty,-1)<0?Infinity:Math.floor(num(p.qty,0));
      return {pi:pi,L:num(p.L,0),W:num(p.W,0),left:q}}).filter(function(p){return p.L>0&&p.W>0});
    types.forEach(function(p,i){if(p.on===false)return;var q=Math.min(500,Math.max(0,Math.floor(num(p.qty,0))));if(p.w<=0&&p.h<=0)return;
      for(var j=0;j<q;j++)items.push({i:i,L:Math.max(p.w,0.01),W:Math.max(p.h,0.01),rot:!!p.rot})});
    items.sort(function(a,b){return Math.max(b.L,b.W)-Math.max(a.L,a.W)||b.L*b.W-a.L*a.W});
    var sheets=[];
    function fits(it,r){var o=[];if(it.L<=r.w+1e-9&&it.W<=r.h+1e-9)o.push({w:it.L,h:it.W,turned:false});
      if(it.rot&&it.W<=r.w+1e-9&&it.L<=r.h+1e-9)o.push({w:it.W,h:it.L,turned:true});return o}
    function full(p){return {x:t,y:t,w:p.L-2*t,h:p.W-2*t}}
    function place(s,ri,it,o){var r=s.free.splice(ri,1)[0];
      s.parts.push({x:r.x,y:r.y,w:o.w,h:o.h,i:it.i,turned:o.turned});
      var rw=r.w-o.w-k,rh=r.h-o.h-k,aA=Math.max(rw*r.h,o.w*rh),aB=Math.max(rw*o.h,r.w*rh),add=[];
      if(aA>=aB){add.push({x:r.x+o.w+k,y:r.y,w:rw,h:r.h});add.push({x:r.x,y:r.y+o.h+k,w:o.w,h:rh})}
      else{add.push({x:r.x+o.w+k,y:r.y,w:rw,h:o.h});add.push({x:r.x,y:r.y+o.h+k,w:r.w,h:rh})}
      add.forEach(function(a){if(a.w>0.5&&a.h>0.5)s.free.push(a)})}
    items.forEach(function(it){var best=null;
      sheets.forEach(function(s,si){s.free.forEach(function(r,ri){fits(it,r).forEach(function(o){
        var sc=r.w*r.h-o.w*o.h,sc2=Math.min(r.w-o.w,r.h-o.h);if(!best||sc<best.sc||(sc===best.sc&&sc2<best.sc2))best={si:si,ri:ri,o:o,sc:sc,sc2:sc2}})})});
      if(!best){
        for(var q=0;q<panels.length&&!best;q++){var P=panels[q];if(P.left<=0)continue;var fr=full(P);if(fr.w<=0||fr.h<=0)continue;var o=fits(it,fr);
          if(o.length){P.left--;sheets.push({pi:P.pi,L:P.L,W:P.W,parts:[],free:[fr]});best={si:sheets.length-1,ri:0,o:o[0]}}}
        if(!best){var anyFit=panels.some(function(P){var fr=full(P);return fr.w>0&&fr.h>0&&fits(it,fr).length});unplaced.push({i:it.i,why:anyFit?"stock":"size"});return}
      }
      place(sheets[best.si],best.ri,it,best.o)});
    var used=0,count=0;
    sheets.forEach(function(s){s.used=0;s.parts.forEach(function(p){s.used+=p.w*p.h});used+=s.used;count+=s.parts.length;s.free.sort(function(a,b){return b.w*b.h-a.w*a.h})});
    return {sheets:sheets,unplaced:unplaced,used:used,count:count,total:items.length};
  }
  function placedPaths(type,part){
    return type.paths.map(function(p){return {closed:p.closed,layer:p.layer,color:p.color,pts:p.pts.map(function(q){
      var u=q[0],v=q[1],k=part.k!=null?part.k:(part.turned?3:0),w=type.w,h=type.h;
      var a=k===0?[u,v]:k===1?[h-v,u]:k===2?[w-u,h-v]:[v,w-u];return [part.x+a[0],part.y+a[1]]})}});
  }
  function rectType(L,W){return {w:L,h:W,paths:[{pts:[[0,0],[L,0],[L,W],[0,W]],closed:true,layer:"",color:""}]}}
  return {num:num,flattenPath:flattenPath,groupPieces:groupPieces,toTypes:toTypes,parseDXF:parseDXF,exportDXF:exportDXF,pack:pack,placedPaths:placedPaths,simplify:simplify,bbox:bbox,rectType:rectType};
})();
function nest(input){
  "use strict";
  var gap=Math.max(0,input.gap||0),margin=Math.max(0,input.margin||0),types=input.types;
  var panels=(input.panels||[]).map(function(p,pi){return {pi:pi,L:p.L,W:p.W,left:p.qty<0?Infinity:p.qty}}).filter(function(p){return p.L>0&&p.W>0});
  var maxA=0;panels.forEach(function(p){maxA=Math.max(maxA,p.L*p.W)});
  var r=Math.max(0.4,Math.sqrt(maxA/700000));
  var R=Math.ceil(gap/r+1.42),M=Math.ceil(margin/r);
  function rotPts(pts,w,h,k){return pts.map(function(q){var u=q[0],v=q[1];
    return k===0?[u,v]:k===1?[h-v,u]:k===2?[w-u,h-v]:[v,w-u]})}
  function raster(polys,w,h,lines){
    var wc=Math.max(1,Math.ceil(w/r-1e-9)),hc=Math.max(1,Math.ceil(h/r-1e-9)),g=new Uint8Array(wc*hc);
    function mark(x,y){var cx=Math.floor(x/r),cy=Math.floor(y/r);if(cx<0)cx=0;if(cy<0)cy=0;if(cx>=wc)cx=wc-1;if(cy>=hc)cy=hc-1;g[cy*wc+cx]=1}
    function edge(a,b){var len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/(r*0.4))+1;for(var s=0;s<=n;s++){var t=s/n;mark(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)}}
    (lines||[]).forEach(function(P){for(var i=0;i+1<P.length;i++)edge(P[i],P[i+1])});
    if(!polys.length&&!(lines&&lines.length)){g.fill(1)}
    else{
      polys.forEach(function(P){for(var i=0;i<P.length;i++)edge(P[i],P[(i+1)%P.length])});
      for(var j=0;j<hc;j++){var yc=(j+0.5)*r,xs=[];
        polys.forEach(function(P){for(var i=0;i<P.length;i++){var a=P[i],b=P[(i+1)%P.length];
          if((a[1]<=yc&&b[1]>yc)||(b[1]<=yc&&a[1]>yc))xs.push(a[0]+(yc-a[1])*(b[0]-a[0])/(b[1]-a[1]))}});
        xs.sort(function(p,q){return p-q});
        for(var k=0;k+1<xs.length;k+=2){var x0=Math.max(0,Math.floor(xs[k]/r)),x1=Math.min(wc-1,Math.floor(xs[k+1]/r));for(var x=x0;x<=x1;x++)g[j*wc+x]=1}}
    }
    var rowsI=[],cells=0;
    for(var y=0;y<hc;y++){var iv=[],x=0;while(x<wc){if(g[y*wc+x]){var a0=x;while(x<wc&&g[y*wc+x])x++;iv.push(a0,x-1);cells+=x-a0}else x++}rowsI.push(iv)}
    var dil={};
    for(var y2=0;y2<hc;y2++){var iv2=rowsI[y2];for(var t=0;t<iv2.length;t+=2)for(var dy=-R;dy<=R;dy++){var dx=Math.floor(Math.sqrt(R*R-dy*dy)),ry=y2+dy;(dil[ry]=dil[ry]||[]).push([iv2[t]-dx,iv2[t+1]+dx])}}
    var dilRows=[];Object.keys(dil).forEach(function(k){var arr=dil[k].sort(function(p,q){return p[0]-q[0]}),out=[];
      arr.forEach(function(s){if(out.length&&s[0]<=out[out.length-1][1]+1)out[out.length-1][1]=Math.max(out[out.length-1][1],s[1]);else out.push([s[0],s[1]])});
      dilRows.push({dy:+k,iv:out})});
    return {wc:wc,hc:hc,rows:rowsI,dil:dilRows,cells:cells};
  }
  var orient=types.map(function(t){
    if(!t.on||!(t.qty>0))return null;
    var ks=t.rot?[0,1,2,3]:[0,2],seen={},list=[];
    ks.forEach(function(k){var w=k%2?t.h:t.w,h=k%2?t.w:t.h;
      var o=raster(t.polys.map(function(P){return rotPts(P,t.w,t.h,k)}),w,h,(t.lines||[]).map(function(P){return rotPts(P,t.w,t.h,k)}));
      var sig=o.wc+"x"+o.hc+":"+o.rows.map(function(x){return x.join(",")}).join("|");if(seen[sig])return;seen[sig]=1;
      o.k=k;o.w=w;o.h=h;list.push(o)});
    return list;
  });
  var items=[];
  types.forEach(function(t,i){if(!orient[i])return;var q=Math.min(500,Math.floor(t.qty));for(var j=0;j<q;j++)items.push({i:i,cells:orient[i][0].cells})});
  items.sort(function(a,b){return b.cells-a.cells||a.i-b.i});
  var sheets=[];
  function newSheet(P){var cols=Math.floor(P.L/r),rows=Math.floor(P.W/r),occ=new Uint8Array(cols*rows),prev=new Int32Array(cols*rows);
    for(var y=0;y<rows;y++)for(var x=0;x<cols;x++)if(x<M||x>=cols-M||y<M||y>=rows-M)occ[y*cols+x]=1;
    var s={P:P,cols:cols,rows:rows,occ:occ,prev:prev,parts:[]};for(var yy=0;yy<rows;yy++)rowPrev(s,yy);return s}
  function rowPrev(s,y){var last=-1,b=y*s.cols;for(var x=0;x<s.cols;x++){if(s.occ[b+x])last=x;s.prev[b+x]=last}}
  function conflict(s,o,x,y){
    for(var j=0;j<o.hc;j++){var iv=o.rows[j],base=(y+j)*s.cols+x;
      for(var t=0;t<iv.length;t+=2){var p=s.prev[base+iv[t+1]];if(p>=x+iv[t])return p-iv[t]+1}}
    return -1}
  function fit(s,o,bestScore){
    if(o.wc>s.cols||o.hc>s.rows)return null;
    var best=null,maxX=s.cols-o.wc,rows=s.rows;
    for(var y=0;y<=rows-o.hc;y++){var x=0;
      while(x<=maxX){if(x*rows+y>=bestScore)break;var c=conflict(s,o,x,y);if(c<0){bestScore=x*rows+y;best={x:x,y:y,score:bestScore};break}x=c}}
    return best}
  function place(s,o,x,y){
    o.dil.forEach(function(d){var yy=y+d.dy;if(yy<0||yy>=s.rows)return;var b=yy*s.cols;
      d.iv.forEach(function(v){var x0=Math.max(0,x+v[0]),x1=Math.min(s.cols-1,x+v[1]);for(var xx=x0;xx<=x1;xx++)s.occ[b+xx]=1});rowPrev(s,yy)})}
  function tryOn(s,os){var best=null,bo=null;os.forEach(function(o){var f=fit(s,o,best?best.score:Infinity);if(f){best=f;bo=o}});return best?{f:best,o:bo}:null}
  var unplaced=[],fitCache={};
  items.forEach(function(it){
    var os=orient[it.i],done=null,si;
    for(si=0;si<sheets.length&&!done;si++){var t=tryOn(sheets[si],os);if(t)done={s:sheets[si],t:t}}
    if(!done){
      for(var q=0;q<panels.length&&!done;q++){var P=panels[q];if(P.left<=0)continue;var s=newSheet(P),t2=tryOn(s,os);
        if(t2){P.left--;sheets.push(s);done={s:s,t:t2}}}
    }
    if(done){place(done.s,done.t.o,done.t.f.x,done.t.f.y);done.s.parts.push({i:it.i,k:done.t.o.k,x:done.t.f.x*r,y:done.t.f.y*r,w:done.t.o.w,h:done.t.o.h})}
    else{
      var key=it.i;if(fitCache[key]==null)fitCache[key]=panels.some(function(P){return !!tryOn(newSheet(P),os)});
      unplaced.push({i:it.i,why:fitCache[key]?"stock":"size"});
    }
  });
  return {sheets:sheets.map(function(s){return {pi:s.P.pi,L:s.P.L,W:s.P.W,parts:s.parts}}),unplaced:unplaced,total:items.length,count:items.length-unplaced.length,res:r};
}
