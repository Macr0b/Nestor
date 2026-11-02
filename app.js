/* Nestor — Copyright (C) 2026 Macr0b — AGPL-3.0-or-later (voir LICENSE). */
/* Nestor — application installable.
   À chaque nouvelle version, changer APP_VERSION ici ET VERSION dans sw.js. */
var APP_VERSION = "1.0.1";

(function(){
  "use strict";
  var num=Geo.num,$=function(id){return document.getElementById(id)};
  var H=window.APP_HOST||null;
  function clone(o){return JSON.parse(JSON.stringify(o))}
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function r2(v){return Math.round(v*100)/100}

  /* ---------- langues ---------- */
  var LANG="fr",NF=null;
  function pickLang(){
    var saved=null;try{saved=localStorage.getItem("plancoupe.lang")}catch(e){}
    if(saved&&I18N.dict[saved])return saved;
    var navs=(navigator.languages||[navigator.language||"fr"]);
    for(var i=0;i<navs.length;i++){var full=String(navs[i]).toLowerCase(),c=full.split("-")[0];
      if(c==="zh"&&/hant|-tw|-hk|-mo/.test(full)&&I18N.dict["zh-Hant"])return "zh-Hant";
      if((c==="no"||c==="nn")&&I18N.dict.nb)return "nb";
      if(I18N.dict[c])return c}
    return "en";
  }
  function T(key,p){
    var s=(I18N.dict[LANG]&&I18N.dict[LANG][key]);if(s==null)s=I18N.dict.en[key];if(s==null)s=I18N.dict.fr[key];if(s==null)return key;
    if(p)s=s.replace(/\{(\w+)\}/g,function(_,k){return p[k]!=null?p[k]:""});return s;
  }
  function fmt(n){return NF.format(Math.round(n*10)/10)}
  function applyLang(code){
    LANG=code;var meta=I18N.langs.filter(function(l){return l.code===code})[0]||{dir:"ltr",locale:code};
    NF=new Intl.NumberFormat(meta.locale||code,{maximumFractionDigits:1});
    document.documentElement.lang=code;document.documentElement.dir=meta.dir||"ltr";
    document.title=T("app.title");
    document.querySelectorAll("[data-i18n]").forEach(function(el){el.textContent=T(el.getAttribute("data-i18n"))});
    document.querySelectorAll("[data-i18n-ph]").forEach(function(el){el.placeholder=T(el.getAttribute("data-i18n-ph"))});
    document.querySelectorAll("[data-i18n-aria]").forEach(function(el){el.setAttribute("aria-label",T(el.getAttribute("data-i18n-aria")))});
    $("verLbl").textContent=T("set.version",{v:APP_VERSION});
  }
  var langSel=$("langSel");
  langSel.innerHTML=I18N.langs.slice().sort(function(a,b){return a.name.localeCompare(b.name,"en")}).map(function(l){return '<option value="'+l.code+'">'+esc(l.name)+'</option>'}).join("");

  /* ---------- exemple ---------- */
  function exampleTypes(){
    function fromD(d){var ps=Geo.flattenPath(d,function(l){return l/0.25}).map(function(s){return {pts:Geo.simplify(s.pts,0.01),closed:s.closed}});
      ps.forEach(function(p){if(p.closed&&p.pts.length>1){var a=p.pts[0],b=p.pts[p.pts.length-1];if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)p.pts.pop()}});return ps}
    function off(p,x,y){return {closed:p.closed,pts:p.pts.map(function(q){return [q[0]+x,q[1]+y]})}}
    var plate=fromD("M6 0H194A6 6 0 0 1 200 6V114A6 6 0 0 1 194 120H6A6 6 0 0 1 0 114V6A6 6 0 0 1 6 0Z M120 60A20 20 0 1 0 80 60A20 20 0 1 0 120 60Z");
    var disc=fromD("M60 30A30 30 0 1 0 0 30A30 30 0 1 0 60 30Z M36 30A6 6 0 1 0 24 30A6 6 0 1 0 36 30Z");
    var ell=fromD("M0 0H150V40H40V100H0Z"),tab=fromD("M0 0H80V30H0Z"),all=[];
    [[plate,0,0],[plate,0,200],[disc,300,0],[disc,380,0],[disc,460,0],[disc,540,0],[ell,300,100],[ell,300,260],
     [tab,500,100],[tab,500,150],[tab,500,200],[tab,600,100],[tab,600,150],[tab,600,200]].forEach(function(a){all=all.concat(a[0].map(function(p){return off(p,a[1],a[2])}))});
    var t=Geo.toTypes(Geo.groupPieces(all).pieces);
    t.forEach(function(x){x.name=""});["ex.facade","ex.angle","ex.disc","ex.tab"].forEach(function(k,i){if(t[i])t[i].nameKey=k});
    return t;
  }
  function exampleState(){return {id:null,name:"",example:true,source:"",sheet:{panels:[{L:600,W:400,qty:""}],gap:2,margin:5,mode:"nest"},types:exampleTypes()}}
  function typeName(t,i){return t.name||(t.nameKey?T(t.nameKey):T("piece.default",{n:i+1}))}

  var state=exampleState(),lastSrc=null;

  /* ---------- import SVG ---------- */
  function unitToMM(v){var m=/^\s*([+-]?[\d.]+(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i.exec(v||"");if(!m)return null;var x=parseFloat(m[1]),u=m[2].toLowerCase();
    var f={mm:1,cm:10,in:25.4,pt:0.352778,pc:4.23333,px:null,"":null}[u];return f===undefined?null:(f===null?{px:x}:{mm:x*f})}
  function shapeToD(el){
    var t=el.tagName.toLowerCase(),a=function(n){return num(el.getAttribute(n),0)};
    if(t==="path")return el.getAttribute("d")||"";
    if(t==="rect"){var x=a("x"),y=a("y"),w=a("width"),h=a("height"),rx=el.hasAttribute("rx")?a("rx"):(el.hasAttribute("ry")?a("ry"):0),ry=el.hasAttribute("ry")?a("ry"):rx;
      if(w<=0||h<=0)return "";rx=Math.min(rx,w/2);ry=Math.min(ry,h/2);
      if(!rx||!ry)return "M"+x+" "+y+"H"+(x+w)+"V"+(y+h)+"H"+x+"Z";
      return "M"+(x+rx)+" "+y+"H"+(x+w-rx)+"A"+rx+" "+ry+" 0 0 1 "+(x+w)+" "+(y+ry)+"V"+(y+h-ry)+"A"+rx+" "+ry+" 0 0 1 "+(x+w-rx)+" "+(y+h)+"H"+(x+rx)+"A"+rx+" "+ry+" 0 0 1 "+x+" "+(y+h-ry)+"V"+(y+ry)+"A"+rx+" "+ry+" 0 0 1 "+(x+rx)+" "+y+"Z"}
    if(t==="circle"||t==="ellipse"){var cx=a("cx"),cy=a("cy"),erx=t==="circle"?a("r"):a("rx"),ery=t==="circle"?a("r"):a("ry");if(erx<=0||ery<=0)return "";
      return "M"+(cx+erx)+" "+cy+"A"+erx+" "+ery+" 0 1 1 "+(cx-erx)+" "+cy+"A"+erx+" "+ery+" 0 1 1 "+(cx+erx)+" "+cy+"Z"}
    if(t==="line")return "M"+a("x1")+" "+a("y1")+"L"+a("x2")+" "+a("y2");
    if(t==="polyline"||t==="polygon"){var p=(el.getAttribute("points")||"").trim();if(!p)return "";var nums=p.split(/[\s,]+/);var d="M"+nums[0]+" "+nums[1];for(var i=2;i+1<nums.length;i+=2)d+="L"+nums[i]+" "+nums[i+1];return d+(t==="polygon"?"Z":"")}
    return "";
  }
  function parseSVG(text,unitOverride){
    var doc=new DOMParser().parseFromString(text,"image/svg+xml");
    var root=doc.documentElement;if(!root||root.nodeName.toLowerCase()!=="svg"||doc.getElementsByTagName("parsererror").length)throw new Error(T("err.svg"));
    root.querySelectorAll("script,foreignObject,image").forEach(function(n){n.remove()});
    root.querySelectorAll("*").forEach(function(n){for(var k=n.attributes.length-1;k>=0;k--){var nm=n.attributes[k].name;if(/^on/i.test(nm))n.removeAttribute(nm)}});
    var host=$("svgScratch");host.innerHTML="";var svg=document.importNode(root,true);host.appendChild(svg);
    try{
      var vb=(svg.getAttribute("viewBox")||"").trim().split(/[\s,]+/).map(Number),hasVB=vb.length===4&&vb[2]>0;
      var wa=unitToMM(svg.getAttribute("width")),ill=/Illustrator/i.test(text),f,how;
      if(unitOverride&&unitOverride!=="auto"){f=num(unitOverride,1);how="how.manual"}
      else if(wa&&wa.mm&&hasVB){f=wa.mm/vb[2];how="how.doc"}
      else if(wa&&wa.mm&&!hasVB){f=1;how="how.mm"}
      else{var unit=ill?0.352778:0.264583;f=unit*((wa&&wa.px&&hasVB)?wa.px/vb[2]:1);how=ill?"how.ai":"how.px"}
      var rootM=svg.getScreenCTM(),inv=rootM?rootM.inverse():null,paths=[],warn={};
      svg.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon").forEach(function(el){
        if(el.closest("defs,clipPath,mask,pattern,marker,symbol"))return;
        var cs=getComputedStyle(el);if(cs.display==="none"||cs.visibility==="hidden")return;
        var d=shapeToD(el);if(!d)return;
        var m=(inv&&el.getScreenCTM())?inv.multiply(el.getScreenCTM()):new DOMMatrix();
        var sc=Math.sqrt(Math.abs(m.a*m.d-m.b*m.c))||1;
        var col=cs.stroke&&cs.stroke!=="none"?cs.stroke:(cs.fill&&cs.fill!=="none"?cs.fill:"");
        var layer="",g=el.parentElement;while(g&&g!==svg){if(g.tagName.toLowerCase()==="g"&&g.id){layer=g.id}g=g.parentElement}
        var subs;try{subs=Geo.flattenPath(d,function(len){return len*sc*f/0.25})}catch(e){warn.paths=(warn.paths||0)+1;return}
        subs.forEach(function(s){
          var pts=s.pts.map(function(q){return [(m.a*q[0]+m.c*q[1]+m.e)*f,(m.b*q[0]+m.d*q[1]+m.f)*f]});
          if(s.closed&&pts.length>1){var A=pts[0],B=pts[pts.length-1];if(Math.hypot(A[0]-B[0],A[1]-B[1])<1e-6)pts.pop()}
          pts=Geo.simplify(pts,0.01);if(pts.length>=2)paths.push({pts:pts,closed:s.closed,layer:layer,color:col})});
      });
      var nt=svg.querySelectorAll("text").length;if(nt)warn.texts=nt;
      var nu=svg.querySelectorAll("use").length;if(nu)warn.symbols=nu;
      return {paths:paths,how:how,warn:warn};
    } finally {host.innerHTML=""}
  }

  /* ---------- import AI / PDF (pdf.js embarqué) ---------- */
  var pdfjsP=null;
  function loadScript(src){return new Promise(function(ok,ko){var s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=function(){ko(new Error(T("err.aiLoad")))};document.head.appendChild(s)})}
  function getPdfjs(){
    var base=(H&&H.pdfBase)||"vendor/pdfjs/";
    if(!pdfjsP){pdfjsP=loadScript(base+"pdf.min.js").then(function(){return H&&H.pdfBase?loadScript(base+"pdf.worker.min.js"):null}).then(function(){
      var lib=window.pdfjsLib;if(!lib)throw new Error(T("err.aiLoad"));lib.GlobalWorkerOptions.workerSrc=base+"pdf.worker.min.js";return lib}).catch(function(e){pdfjsP=null;throw e})}
    return pdfjsP;
  }
  function hexOf(a){if(!a)return "";if(typeof a[0]==="string")return a[0];if(a.length>=3)return "#"+[a[0],a[1],a[2]].map(function(v){v=Math.round(v<=1&&!(a instanceof Uint8ClampedArray)?v*255:v);return ("0"+Math.max(0,Math.min(255,v)).toString(16)).slice(-2)}).join("");return ""}
  function mmul(o,m){return [o[0]*m[0]+o[2]*m[1],o[1]*m[0]+o[3]*m[1],o[0]*m[2]+o[2]*m[3],o[1]*m[2]+o[3]*m[3],o[0]*m[4]+o[2]*m[5]+o[4],o[1]*m[4]+o[3]*m[5]+o[5]]}
  async function parseAI(buf,unitOverride){
    var lib=await getPdfjs(),OPS=lib.OPS,doc;
    try{doc=await lib.getDocument({data:new Uint8Array(buf.slice(0)),isEvalSupported:false,disableFontFace:true}).promise}
    catch(e){throw new Error(T("err.aiNoPdf"))}
    var manual=unitOverride&&unitOverride!=="auto",f=manual?num(unitOverride,1):0.352778,how=manual?"how.manual":"how.pdf";
    var paths=[],yOff=0,pages=doc.numPages,warn={};
    var PAINT={};["stroke","closeStroke","fill","eoFill","fillStroke","eoFillStroke","closeFillStroke","closeEOFillStroke"].forEach(function(k){if(OPS[k]!=null)PAINT[OPS[k]]=1});
    for(var pn=1;pn<=pages;pn++){
      var page=await doc.getPage(pn),view=page.view,ol=await page.getOperatorList();
      var ctm=[1,0,0,1,0,0],stack=[],pending=[],stroke="",fill="",cs=[];
      for(var i=0;i<ol.fnArray.length;i++){
        var fn=ol.fnArray[i],a=ol.argsArray[i];
        if(fn===OPS.save){stack.push(ctm);cs.push([stroke,fill])}
        else if(fn===OPS.restore){if(stack.length)ctm=stack.pop();var sf=cs.pop();if(sf){stroke=sf[0];fill=sf[1]}}
        else if(fn===OPS.transform){ctm=mmul(ctm,a)}
        else if(fn===OPS.paintFormXObjectBegin){stack.push(ctm);cs.push([stroke,fill]);if(a&&a[0])ctm=mmul(ctm,a[0])}
        else if(fn===OPS.paintFormXObjectEnd){if(stack.length)ctm=stack.pop();var sf2=cs.pop();if(sf2){stroke=sf2[0];fill=sf2[1]}}
        else if(fn===OPS.setStrokeRGBColor){stroke=hexOf(a)}
        else if(fn===OPS.setFillRGBColor){fill=hexOf(a)}
        else if(fn===OPS.constructPath){
          var ops=a[0],c=a[1],k=0,d="",cx=0,cy=0;
          var P=function(x,y){return (ctm[0]*x+ctm[2]*y+ctm[4])+" "+(ctm[1]*x+ctm[3]*y+ctm[5])};
          for(var j=0;j<ops.length;j++){var op=ops[j];
            if(op===OPS.moveTo){cx=c[k];cy=c[k+1];d+="M"+P(cx,cy);k+=2}
            else if(op===OPS.lineTo){cx=c[k];cy=c[k+1];d+="L"+P(cx,cy);k+=2}
            else if(op===OPS.curveTo){d+="C"+P(c[k],c[k+1])+" "+P(c[k+2],c[k+3])+" "+P(c[k+4],c[k+5]);cx=c[k+4];cy=c[k+5];k+=6}
            else if(op===OPS.curveTo2){d+="C"+P(cx,cy)+" "+P(c[k],c[k+1])+" "+P(c[k+2],c[k+3]);cx=c[k+2];cy=c[k+3];k+=4}
            else if(op===OPS.curveTo3){d+="C"+P(c[k],c[k+1])+" "+P(c[k+2],c[k+3])+" "+P(c[k+2],c[k+3]);cx=c[k+2];cy=c[k+3];k+=4}
            else if(op===OPS.closePath){d+="Z"}
            else if(op===OPS.rectangle){var x=c[k],y=c[k+1],w=c[k+2],h=c[k+3];d+="M"+P(x,y)+"L"+P(x+w,y)+"L"+P(x+w,y+h)+"L"+P(x,y+h)+"Z";cx=x;cy=y;k+=4}
          }
          pending.push(d);
        }
        else if(PAINT[fn]){
          var col=(fn!==OPS.fill&&fn!==OPS.eoFill)?stroke:fill;
          pending.forEach(function(pd){
            var subs;try{subs=Geo.flattenPath(pd,function(len){return len*f/0.25})}catch(e){warn.paths=(warn.paths||0)+1;return}
            subs.forEach(function(s){
              var pts=s.pts.map(function(q){return [(q[0]-view[0])*f,(view[3]-q[1])*f+yOff]});
              if(s.closed&&pts.length>1){var A=pts[0],B=pts[pts.length-1];if(Math.hypot(A[0]-B[0],A[1]-B[1])<1e-6)pts.pop()}
              pts=Geo.simplify(pts,0.01);if(pts.length>=2)paths.push({pts:pts,closed:s.closed,layer:"",color:col||""})})});
          pending=[];
        }
        else if(fn===OPS.endPath){pending=[]}
        else if(fn===OPS.showText&&!warn.texts){warn.texts=1}
      }
      yOff+=(view[3]-view[1])*f+20;
    }
    if(pages>1)warn.pages=pages;
    return {paths:paths,how:how,warn:warn};
  }

  /* ---------- import commun ---------- */
  async function importData(name,data){
    var u=$("unitSel").value,res,kind;
    var bytes=new Uint8Array(data),head=String.fromCharCode.apply(null,bytes.subarray(0,1024));
    if(/\.(ai|pdf)$/i.test(name)||head.indexOf("%PDF")>=0){kind=/\.pdf$/i.test(name)?"PDF":"AI";res=await parseAI(data,u)}
    else{
      var text=new TextDecoder("utf-8").decode(bytes);
      if(/^%!PS/.test(text))throw new Error(T("err.aiNoPdf"));
      if(/\.dxf$/i.test(name)||/^\s*0\s*[\r\n]+\s*SECTION/.test(text)){kind="DXF";res=Geo.parseDXF(text,u);res.how=u!=="auto"?"how.manual":(res.detected?"how.dxf":"how.dxfNone");
        res.warn={texts:res.warn.textes,blocks:res.warn.blocs}}
      else{kind="SVG";res=parseSVG(text,u)}
    }
    if(!res.paths.length)throw new Error(T("err.noPaths"));
    var g=Geo.groupPieces(res.paths),types=Geo.toTypes(g.pieces),b=Geo.bbox(res.paths);
    types.forEach(function(t){t.name=""});
    state.types=types;state.source=name;state.example=false;
    state.info={kind:kind,how:res.how,size:[b[2]-b[0],b[3]-b[1]],n:g.pieces.length,frame:g.frame,warn:res.warn||{}};
    if(!state.name)state.name=name.replace(/\.(dxf|svg|ai|pdf)$/i,"");
    lastSrc={name:name,data:data};
  }
  var importing=false;
  async function runImport(name,data){
    if(importing)return;importing=true;
    $("fileInfo").innerHTML='<span class="hint">'+esc(T("file.reading",{n:name}))+'</span>';
    try{await importData(name,data);markDirty();renderAll()}
    catch(e){showFileErr((e&&e.message)||T("err.generic"))}
    importing=false;
  }
  function handleFile(file){
    if(!file){showFileErr(T("err.none"));return}
    if(file.size>40*1024*1024){showFileErr(T("err.tooBig"));return}
    var rd=new FileReader();
    rd.onload=function(){runImport(file.name,rd.result)};
    rd.onerror=function(){showFileErr(T("err.read"))};
    rd.readAsArrayBuffer(file);
  }
  function showFileErr(m){$("fileInfo").innerHTML='<span class="warn">'+esc(m)+'</span><span class="hint">'+esc(T("err.formats"))+'</span>'}
  $("fileIn").addEventListener("change",function(e){handleFile(e.target.files&&e.target.files[0]);e.target.value=""});
  var drop=$("drop");
  ["dragenter","dragover"].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.add("over")})});
  ["dragleave","drop"].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.remove("over")})});
  drop.addEventListener("drop",function(e){handleFile(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0])});
  $("unitSel").addEventListener("change",function(){if(lastSrc)runImport(lastSrc.name,lastSrc.data);else renderFileInfo()});
  if("launchQueue" in window){window.launchQueue.setConsumer(function(p){if(p&&p.files&&p.files.length)p.files[0].getFile().then(handleFile)})}

  function renderFileInfo(){
    var el=$("fileInfo"),i=state.info;
    if(state.example){el.innerHTML='<span class="hint"><span class="tag">'+esc(T("file.exampleTag"))+'</span> '+esc(T("file.exampleHint"))+'</span>';return}
    if(!state.source){el.innerHTML='<span class="hint">'+esc(T("file.none"))+'</span>';return}
    var h=['<span>'+esc(T("file.name",{n:""}))+'<span class="fn">'+esc(state.source)+'</span></span>'];
    if(i){h.push('<span>'+esc(T("file.summary",{kind:i.kind,w:fmt(i.size[0]),h:fmt(i.size[1]),n:i.n,how:T(i.how)}))+'</span>');
      if(i.frame)h.push('<span class="hint">'+esc(T("file.frame"))+'</span>');
      var w=i.warn||{},ws=[];
      if(w.texts)ws.push(T("warn.texts",{n:w.texts}));if(w.blocks)ws.push(T("warn.blocks",{n:w.blocks}));if(w.symbols)ws.push(T("warn.symbols",{n:w.symbols}));
      if(w.pages)ws.push(T("warn.pages",{n:w.pages}));if(w.paths)ws.push(T("warn.paths",{n:w.paths}));
      ws.forEach(function(x){h.push('<span class="warn">'+esc(x)+'</span>')});}
    el.innerHTML=h.join("");
  }

  /* ---------- dessin ---------- */
  function dOf(paths,closedOnly){return paths.filter(function(p){return p.closed===closedOnly}).map(function(p){
    return "M"+p.pts.map(function(q){return r2(q[0])+" "+r2(q[1])}).join("L")+(p.closed?"Z":"")}).join("")}
  function thumb(t){var pad=Math.max(t.w,t.h)*0.06;
    return '<svg viewBox="'+(-pad)+' '+(-pad)+' '+(t.w+2*pad)+' '+(t.h+2*pad)+'" aria-hidden="true"><path class="svg-piece" d="'+dOf(t.paths,true)+'"/><path class="svg-open" d="'+dOf(t.paths,false)+'"/></svg>'}
  function sheetSVG(s){
    var L=s.L,W=s.W,m=num(state.sheet.margin,0),sw=Math.max(L,W)/600,pad=Math.max(L,W)*0.015;
    var id="h"+Math.random().toString(36).slice(2,8),hs=Math.max(L,W)/70;
    var o=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(-pad)+' '+(-pad)+' '+(L+2*pad)+' '+(W+2*pad)+'" role="img" aria-label="'+esc(T("res.panelAria",{w:fmt(L),h:fmt(W)}))+'">'];
    o.push('<defs><pattern id="'+id+'" width="'+hs+'" height="'+hs+'" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="'+hs+'" stroke-width="'+(sw*0.8)+'" style="stroke:var(--hatch)"/></pattern></defs>');
    o.push('<rect class="svg-panel" x="0" y="0" width="'+L+'" height="'+W+'" stroke-width="'+sw+'"/><rect x="0" y="0" width="'+L+'" height="'+W+'" fill="url(#'+id+')"/>');
    if(m>0)o.push('<rect class="svg-margin" x="'+m+'" y="'+m+'" width="'+(L-2*m)+'" height="'+(W-2*m)+'" stroke-width="'+(sw*0.7)+'" stroke-dasharray="'+(sw*6)+' '+(sw*4)+'"/>');
    s.parts.forEach(function(p){var t=state.types[p.i],pp=Geo.placedPaths(t,p);
      o.push('<path class="svg-piece'+(p.i%2?" alt":"")+'" stroke-width="'+sw+'" d="'+dOf(pp,true)+'"><title>'+esc(typeName(t,p.i))+' — '+fmt(t.w)+' × '+fmt(t.h)+'</title></path>');
      var od=dOf(pp,false);if(od)o.push('<path class="svg-open" stroke-width="'+sw+'" d="'+od+'"/>');
      var fs=Math.min(Math.min(p.w,p.h)*0.4,Math.max(L,W)*0.03);
      o.push('<text class="svg-num" x="'+(p.x+p.w/2)+'" y="'+(p.y+p.h/2+fs*0.35)+'" text-anchor="middle" font-size="'+fs+'" stroke-width="'+fs*0.15+'">'+(p.i+1)+'</text>');
    });
    o.push('</svg>');return o.join("");
  }
  function exportSVGText(s){
    var L=s.L,W=s.W,groups={};
    s.parts.forEach(function(p){Geo.placedPaths(state.types[p.i],p).forEach(function(q){var key=q.color||"#000000";(groups[key]=groups[key]||[]).push(q)})});
    var o=['<?xml version="1.0" encoding="UTF-8"?>','<svg xmlns="http://www.w3.org/2000/svg" width="'+L+'mm" height="'+W+'mm" viewBox="0 0 '+L+' '+W+'">'];
    Object.keys(groups).forEach(function(c){o.push('<g fill="none" stroke="'+esc(c)+'" stroke-width="0.1">');
      groups[c].forEach(function(q){o.push('<path d="M'+q.pts.map(function(v){return (Math.round(v[0]*1000)/1000)+" "+(Math.round(v[1]*1000)/1000)}).join("L")+(q.closed?"Z":"")+'"/>')});o.push('</g>')});
    o.push('</svg>');return o.join("\n");
  }

  /* ---------- téléchargement ---------- */
  function saveFile(filename,blob){
    if(H&&H.save)return H.save(filename,blob);
    var mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
    if(mobile&&navigator.canShare){try{var file=new File([blob],filename,{type:blob.type||"application/octet-stream"});
      if(navigator.canShare({files:[file]}))return navigator.share({files:[file]}).then(function(){return "shared"})}catch(e){}}
    var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove()},4000);return Promise.resolve("saved");
  }
  function slug(s){return ((s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase())||"plan"}

  /* ---------- résultat ---------- */
  var last=null,job=0,worker=null,workerURL=null;
  function typeArea(t){var A=t.paths.filter(function(p){return p.closed&&p.pts.length>2}).map(function(p){var a=0,P=p.pts;for(var i=0;i<P.length;i++){var q=P[i],r=P[(i+1)%P.length];a+=q[0]*r[1]-r[0]*q[1]}return Math.abs(a/2)}).sort(function(a,b){return b-a});
    if(!A.length)return t.w*t.h;var s=A[0];for(var i=1;i<A.length;i++)s-=A[i];return Math.max(s,0)}
  function panelList(){return (state.sheet.panels||[]).map(function(p){return {L:num(p.L,0),W:num(p.W,0),qty:p.qty===""||p.qty==null?-1:Math.max(0,Math.floor(num(p.qty,0)))}})}
  function nestInput(){return {panels:panelList(),gap:num(state.sheet.gap,0),margin:num(state.sheet.margin,0),
    types:state.types.map(function(t){return {w:t.w,h:t.h,rot:!!t.rot,qty:Math.floor(num(t.qty,0)),on:t.on!==false,polys:t.paths.filter(function(p){return p.closed&&p.pts.length>=3}).map(function(p){return p.pts}),lines:t.paths.filter(function(p){return !(p.closed&&p.pts.length>=3)}).map(function(p){return p.pts})}})}}
  function runNest(input){return new Promise(function(ok,ko){
    function inline(){setTimeout(function(){try{ok(nest(input))}catch(x){ko(x)}},0)}
    try{
      if(!workerURL)workerURL=URL.createObjectURL(new Blob(["var nest="+nest.toString()+";self.onmessage=function(e){self.postMessage(nest(e.data))};"],{type:"text/javascript"}));
      if(worker)worker.terminate();
      var w=worker=new Worker(workerURL);
      w.onmessage=function(e){ok(e.data)};
      w.onerror=function(e){if(e&&e.preventDefault)e.preventDefault();if(worker===w)worker=null;inline()};
      w.postMessage(input);
    }catch(e){worker=null;inline()}
  })}
  function renderResult(){
    var my=++job,mode=state.sheet.mode==="rect"?"rect":"nest",msg=$("calcMsg");
    if(mode==="rect"){draw(Geo.pack(state.sheet,state.types));msg.textContent="";return}
    var input=nestInput();
    if(!input.types.some(function(t){return t.on&&t.qty>0})||!input.panels.some(function(p){return p.L>0&&p.W>0})){draw({sheets:[],unplaced:[],count:0,total:0});msg.textContent="";return}
    $("result").classList.add("busy");msg.textContent=T("calc.running");var t0=Date.now();
    runNest(input).then(function(res){if(my!==job)return;
      msg.textContent=T("calc.done",{s:fmt((Date.now()-t0)/1000),p:fmt(res.res)});draw(res)})
      .catch(function(){if(my!==job)return;$("result").classList.remove("busy");msg.textContent=T("calc.fail")});
  }
  function draw(res){
    last=res;$("result").classList.remove("busy");
    var n=res.sheets.length,used=0,total=0,h=[],groups={},order=[];
    res.sheets.forEach(function(s){s.area=0;s.parts.forEach(function(p){s.area+=typeArea(state.types[p.i])});used+=s.area;total+=s.L*s.W;
      var key=fmt(s.L)+" × "+fmt(s.W);if(!groups[key]){groups[key]=0;order.push(key)}groups[key]++});
    var pct=n?Math.round(1000*(1-used/total))/10:0;
    var breakdown=order.map(function(k){return groups[k]+" × "+k}).join(" · ");
    h.push('<div class="summary">'+
      '<div class="stat"><div class="v">'+n+'</div><div class="k">'+esc(T("res.panels"))+'</div>'+(n?'<div class="bd">'+esc(breakdown)+'</div>':'')+'</div>'+
      '<div class="stat"><div class="v">'+res.count+'<span style="font-size:18px;color:var(--muted)"> / '+res.total+'</span></div><div class="k">'+esc(T("res.placed"))+'</div></div>'+
      '<div class="stat"><div class="v">'+(n?fmt(pct):"–")+' %</div><div class="k">'+esc(T("res.waste"))+'</div></div></div>');
    function names(why){var o={};res.unplaced.forEach(function(u){if((u.why||"size")!==why)return;var t=state.types[u.i];o[(u.i+1)+" · "+typeName(t,u.i)+" ("+fmt(t.w)+" × "+fmt(t.h)+")"]=1});return Object.keys(o)}
    var big=names("size"),stock=names("stock");
    if(big.length)h.push('<div class="alert">'+esc(T("res.tooBig",{list:big.join(", ")}))+'</div>');
    if(stock.length)h.push('<div class="alert">'+esc(T("res.noStock",{list:stock.join(", ")}))+'</div>');
    res.sheets.forEach(function(s,si){var fr=s.free&&s.free[0];
      var meta=fmt(s.L)+" × "+fmt(s.W)+" · "+T("sheet.meta",{n:s.parts.length,u:fmt(Math.round(1000*s.area/(s.L*s.W))/10)})+(fr&&fr.w>=50&&fr.h>=50?" · "+T("sheet.free",{w:fmt(Math.floor(fr.w)),h:fmt(Math.floor(fr.h))}):"");
      h.push('<article class="sheet"><h3>'+esc(T("sheet.title",{i:si+1,n:n}))+' <small>'+esc(meta)+'</small></h3>'+
        '<div class="svgbox">'+sheetSVG(s)+'</div>'+
        '<div class="dl"><button class="btn sm" type="button" data-dl="svg" data-s="'+si+'">'+esc(T("dl.svg"))+'</button><button class="btn sm" type="button" data-dl="dxf" data-s="'+si+'">'+esc(T("dl.dxf"))+'</button><span class="hint" id="dlmsg'+si+'"></span></div></article>')});
    if(!n&&!res.unplaced.length)h.push('<p class="hint">'+esc(T("res.empty"))+'</p>');
    if(n)h.push('<p class="hint">'+esc(T("res.note"))+'</p>');
    $("result").innerHTML=h.join("");
  }
  $("result").addEventListener("click",function(e){
    var b=e.target.closest("[data-dl]");if(!b||!last)return;
    var si=+b.dataset.s,s=last.sheets[si],msg=$("dlmsg"+si),kind=b.dataset.dl,base=slug(state.name||state.source.replace(/\.\w+$/,""))+"-"+(si+1);
    var data,type;
    if(kind==="svg"){data=exportSVGText(s);type="image/svg+xml"}
    else{var polys=[];s.parts.forEach(function(p){polys=polys.concat(Geo.placedPaths(state.types[p.i],p))});data=Geo.exportDXF(polys,s.W);type="application/dxf"}
    saveFile(base+"."+kind,new Blob([data],{type:type})).then(function(){msg.textContent=T("dl.done",{f:base+"."+kind})}).catch(function(err){if(err&&err.name==="AbortError")return;msg.textContent=T("dl.fail")});
  });

  /* ---------- pièces ---------- */
  function renderTypes(){
    $("types").innerHTML=state.types.length?state.types.map(function(t,i){
      return '<div class="trow'+(t.on===false?" off":"")+'" data-i="'+i+'"><label class="pick"><input type="checkbox" id="t'+i+'-on" data-k="on"'+(t.on!==false?" checked":"")+' aria-label="'+esc(T("piece.include",{n:i+1}))+'"></label><div class="thumb"><span class="n">'+(i+1)+'</span>'+thumb(t)+'</div>'+
        '<div class="tline"><input class="nm" type="text" id="t'+i+'-n" data-k="name" value="'+esc(t.name)+'" placeholder="'+esc(typeName({nameKey:t.nameKey},i))+'" aria-label="'+esc(T("piece.nameLbl",{n:i+1}))+'"><span class="dim">'+fmt(t.w)+' × '+fmt(t.h)+'</span></div>'+
        '<div class="tline"><label class="qty">'+esc(T("piece.qty"))+'<input type="number" id="t'+i+'-q" data-k="qty" inputmode="numeric" min="0" step="1" value="'+esc(t.qty)+'"></label>'+
        '<label class="rot" title="'+esc(T("pieces.keepHint"))+'"><input type="checkbox" id="t'+i+'-r" data-k="rot"'+(t.rot?"":" checked")+'>'+esc(T("piece.keep"))+'</label></div></div>'}).join("")
      :'<p class="hint">'+esc(T("pieces.empty"))+'</p>';
    updatePick();
  }
  function updatePick(){
    var n=state.types.length,on=state.types.filter(function(t){return t.on!==false}).length;
    $("pcount").textContent=n?"("+on+"/"+n+")":"";
    var b=$("btnAll");b.hidden=!n;b.textContent=on===n?T("pieces.none"):T("pieces.all");
  }
  var rt=null;function scheduleCalc(){clearTimeout(rt);rt=setTimeout(renderResult,250)}
  $("types").addEventListener("input",function(e){var row=e.target.closest(".trow");if(!row)return;var t=state.types[+row.dataset.i],k=e.target.dataset.k;if(!t||!k||k==="on"||k==="rot")return;
    if(k==="name")t.name=e.target.value;else t.qty=e.target.value===""?0:Math.max(0,Math.floor(num(e.target.value,0)));
    markDirty();if(k!=="name")scheduleCalc()});
  $("types").addEventListener("change",function(e){var k=e.target.dataset.k,row=e.target.closest(".trow");if(!row)return;var t=state.types[+row.dataset.i];
    if(k==="rot"){t.rot=!e.target.checked;markDirty();scheduleCalc()}
    else if(k==="on"){t.on=e.target.checked;row.classList.toggle("off",!t.on);updatePick();markDirty();scheduleCalc()}});
  $("btnAll").addEventListener("click",function(){var all=state.types.every(function(t){return t.on!==false});state.types.forEach(function(t){t.on=!all});renderTypes();markDirty();scheduleCalc()});
  function renderPanels(){
    var ps=state.sheet.panels;
    $("panels").innerHTML=ps.map(function(p,i){
      return '<div class="pnl" data-i="'+i+'">'+
        '<input type="number" id="pl'+i+'-L" data-k="L" inputmode="decimal" min="1" value="'+esc(p.L)+'" aria-label="'+esc(T("panel.L"))+'">'+
        '<span class="x" aria-hidden="true">×</span>'+
        '<input type="number" id="pl'+i+'-W" data-k="W" inputmode="decimal" min="1" value="'+esc(p.W)+'" aria-label="'+esc(T("panel.W"))+'">'+
        '<input type="number" id="pl'+i+'-q" data-k="qty" inputmode="numeric" min="0" step="1" value="'+esc(p.qty)+'" placeholder="∞" aria-label="'+esc(T("panel.qty"))+'">'+
        '<button class="mini" type="button" data-act="up"'+(i===0?' disabled':'')+' aria-label="'+esc(T("panel.up"))+'" title="'+esc(T("panel.up"))+'">↑</button>'+
        '<button class="mini" type="button" data-act="del"'+(ps.length<2?' disabled':'')+' aria-label="'+esc(T("panel.remove"))+'" title="'+esc(T("panel.remove"))+'">×</button></div>'}).join("");
  }
  $("panels").addEventListener("input",function(e){var row=e.target.closest(".pnl");if(!row)return;var p=state.sheet.panels[+row.dataset.i],k=e.target.dataset.k;if(!p||!k)return;
    p[k]=e.target.value===""?"":(k==="qty"?Math.max(0,Math.floor(num(e.target.value,0))):num(e.target.value,0));markDirty();scheduleCalc()});
  $("panels").addEventListener("click",function(e){var b=e.target.closest("[data-act]");if(!b)return;var i=+b.closest(".pnl").dataset.i,ps=state.sheet.panels;
    if(b.dataset.act==="up"&&i>0){var x=ps[i];ps[i]=ps[i-1];ps[i-1]=x}
    else if(b.dataset.act==="del"&&ps.length>1)ps.splice(i,1);
    renderPanels();markDirty();scheduleCalc()});
  $("btnAddPanel").addEventListener("click",function(){var ps=state.sheet.panels,l=ps[ps.length-1]||{L:600,W:400};ps.push({L:l.L,W:l.W,qty:""});renderPanels();markDirty();scheduleCalc();
    var el=$("pl"+(ps.length-1)+"-L");if(el)el.focus()});
  [["sG","gap"],["sM","margin"]].forEach(function(a){$(a[0]).addEventListener("input",function(e){state.sheet[a[1]]=e.target.value===""?"":num(e.target.value,0);markDirty();scheduleCalc()})});
  $("projName").addEventListener("input",function(e){state.name=e.target.value;markDirty()});
  $("sMode").addEventListener("change",function(e){state.sheet.mode=e.target.value;markDirty();renderResult()});

  function renderInputs(){renderPanels();$("sG").value=state.sheet.gap;$("sM").value=state.sheet.margin;$("projName").value=state.name||"";$("sMode").value=state.sheet.mode==="rect"?"rect":"nest"}
  function renderAll(){renderInputs();renderFileInfo();renderTypes();renderResult()}

  /* ---------- derniers réglages (mémorisés sur l'appareil) ---------- */
  var PREFS="plancoupe.reglages.v1",prefT=null;
  function markDirty(){clearTimeout(prefT);prefT=setTimeout(savePrefs,400)}
  function savePrefs(){try{localStorage.setItem(PREFS,JSON.stringify({panels:state.sheet.panels,gap:state.sheet.gap,margin:state.sheet.margin,mode:state.sheet.mode}))}catch(e){}}
  function loadPrefs(){try{var p=JSON.parse(localStorage.getItem(PREFS)||"null");if(!p)return;
    if(Array.isArray(p.panels)&&p.panels.length)state.sheet.panels=p.panels.map(function(x){return {L:num(x.L,600),W:num(x.W,400),qty:x.qty===""||x.qty==null?"":Math.max(0,Math.floor(num(x.qty,0)))}});
    if(p.gap!=null)state.sheet.gap=num(p.gap,2);if(p.margin!=null)state.sheet.margin=num(p.margin,5);state.sheet.mode=p.mode==="rect"?"rect":"nest"}catch(e){}}

  /* ---------- réglages ---------- */
  function openSettings(){$("settings").hidden=false;$("btnCloseSet").focus()}
  function closeSettings(){$("settings").hidden=true}
  $("btnSettings").addEventListener("click",openSettings);
  $("btnCloseSet").addEventListener("click",closeSettings);
  $("settings").addEventListener("click",function(e){if(e.target===this)closeSettings()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!$("settings").hidden)closeSettings()});
  langSel.addEventListener("change",function(){try{localStorage.setItem("plancoupe.lang",langSel.value)}catch(e){}applyLang(langSel.value);renderAll();refreshInstall()});

  /* ---------- installation ---------- */
  var deferredPrompt=null;
  var standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredPrompt=e;refreshInstall()});
  window.addEventListener("appinstalled",function(){deferredPrompt=null;standalone=true;refreshInstall()});
  function refreshInstall(){
    var g=$("installGrp"),b=$("btnInstall"),h=$("installHint");
    if(standalone||(H&&H.noInstall)){g.hidden=true;return}
    g.hidden=false;b.hidden=!deferredPrompt;
    var ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1),
      safariMac=/Macintosh/.test(ua)&&/Safari/.test(ua)&&!/Chrome|Chromium|Edg|Firefox/.test(ua),firefox=/Firefox/.test(ua);
    h.textContent=deferredPrompt?"":ios?T("inst.ios"):safariMac?T("inst.safari"):firefox?T("inst.firefox"):T("inst.other");
  }
  $("btnInstall").addEventListener("click",function(){if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt.userChoice.finally(function(){deferredPrompt=null;refreshInstall()})});

  /* ---------- mises à jour ---------- */
  var reg=null,reloading=false;
  function showUpdate(){$("updBanner").hidden=false}
  function watchReg(r){
    reg=r;if(r.waiting&&navigator.serviceWorker.controller)showUpdate();
    r.addEventListener("updatefound",function(){var nw=r.installing;if(!nw)return;nw.addEventListener("statechange",function(){if(nw.state==="installed"&&navigator.serviceWorker.controller)showUpdate()})});
  }
  if(H&&H.noInstall){$("updGrp").hidden=true}
  else if("serviceWorker" in navigator&&location.protocol!=="file:"){
    navigator.serviceWorker.register("sw.js").then(function(r){watchReg(r);r.update().catch(function(){})}).catch(function(){});
    navigator.serviceWorker.addEventListener("controllerchange",function(){if(reloading)return;reloading=true;location.reload()});
    document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&reg)reg.update().catch(function(){})});
  }
  $("btnUpdate").addEventListener("click",function(){
    if(reg&&reg.waiting)reg.waiting.postMessage("skipWaiting");else location.reload()});
  $("btnCheck").addEventListener("click",function(){
    var m=$("checkMsg");
    if(!("serviceWorker" in navigator)){m.textContent=T("upd.unavailable");return}
    if(!navigator.onLine){m.textContent=T("upd.offline");return}
    m.textContent=T("upd.checking");
    (reg?Promise.resolve(reg):navigator.serviceWorker.getRegistration()).then(function(r){
      if(!r){m.textContent=T("upd.unavailable");return}
      if(!reg)watchReg(r);
      return r.update().then(function(){setTimeout(function(){if(r.waiting||r.installing){m.textContent=T("upd.found");showUpdate()}else m.textContent=T("upd.latest")},1500)});
    }).catch(function(){m.textContent=T("upd.offline")});
  });

  /* ---------- démarrage ---------- */
  var lang0=pickLang();langSel.value=lang0;applyLang(lang0);
  loadPrefs();renderAll();refreshInstall();
})();
