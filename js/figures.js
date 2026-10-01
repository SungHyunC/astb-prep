/* ============================================================
   ASTB-E Prep — figures.js
   MCT 그림 문항용 SVG 렌더러. 규격: content/AUTHORING.md §5
   renderFig(fig) → SVG 문자열 (모르는 타입이면 "")
   ============================================================ */
"use strict";

const FIG = (() => {
  const n2 = v => Math.round(v*100)/100;
  const T = (x,y,s,cls="",anchor="middle",extra="") => `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" class="${cls}" ${extra}>${esc(s)}</text>`;
  const svg = (w,h,inner,label) => `<svg class="fig" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label||"그림")}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  function head(x,y,dx,dy,cls="arw",size=8){ const L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, px=-uy, py=ux;
    return `<path d="M${n2(x)} ${n2(y)} L${n2(x-ux*size+px*size*0.55)} ${n2(y-uy*size+py*size*0.55)} L${n2(x-ux*size-px*size*0.55)} ${n2(y-uy*size-py*size*0.55)} Z" class="${cls}"/>`; }
  function arrow(x1,y1,x2,y2,lcls="ac",hcls="arw"){ return `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" class="${lcls}"/>`+head(x2,y2,x2-x1,y2-y1,hcls); }
  function ceiling(x1,x2,y){ let s=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="ln"/>`;
    for(let x=x1+4;x<x2;x+=10) s+=`<line x1="${x}" y1="${y}" x2="${x-7}" y2="${y-7}" class="hatch"/>`; return s; }
  function ground(x1,x2,y){ let s=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="ln"/>`;
    for(let x=x1+4;x<x2;x+=9) s+=`<line x1="${x}" y1="${y}" x2="${x-7}" y2="${y+7}" class="hatch"/>`; return s; }
  // 회전 방향 화살표 (화면 좌표: 각도 증가 = 시계 방향)
  function rotArrow(cx,cy,R,dir,cls="ac"){ const P=a=>[cx+R*Math.cos(a),cy+R*Math.sin(a)], a1=-117*Math.PI/180, a2=-63*Math.PI/180;   // 위쪽 54° 호 — 옆 기어에 닿지 않게
    if(dir==="cw"){ const [sx,sy]=P(a1),[ex,ey]=P(a2); return `<path d="M${n2(sx)} ${n2(sy)} A${R} ${R} 0 0 1 ${n2(ex)} ${n2(ey)}" class="${cls}"/>`+head(ex,ey,-Math.sin(a2),Math.cos(a2),cls==="hi"?"arw hi":"arw",9); }
    const [sx,sy]=P(a2),[ex,ey]=P(a1); return `<path d="M${n2(sx)} ${n2(sy)} A${R} ${R} 0 0 0 ${n2(ex)} ${n2(ey)}" class="${cls}"/>`+head(ex,ey,Math.sin(a1),-Math.cos(a1),cls==="hi"?"arw hi":"arw",9); }
  function zigzagH(x1,x2,y,amp=7,n=6){ const w=(x2-x1)/n; let d=`M${n2(x1)} ${y}`; for(let i=0;i<n;i++) d+=` L${n2(x1+w*(i+0.5))} ${y+(i%2?amp:-amp)}`; return `<path d="${d} L${n2(x2)} ${y}" class="ln"/>`; }
  function zigzagV(x,y1,y2,amp=8,n=8){ const h=(y2-y1)/n; let d=`M${x} ${n2(y1)}`; for(let i=0;i<n;i++) d+=` L${x+(i%2?amp:-amp)} ${n2(y1+h*(i+0.5))}`; return `<path d="${d} L${x} ${n2(y2)}" class="ln"/>`; }
  const num = s => { const m=String(s).match(/-?\d+(\.\d+)?/); return m?parseFloat(m[0]):NaN; };

  /* ---- lever ---- */
  function lever(f){
    const W=340,H=176, x0=26, x1=314, sc=(x1-x0)/f.length, X=v=>x0+v*sc, by=80; let g="";
    g+=`<rect x="${x0}" y="${by-4}" width="${x1-x0}" height="8" rx="3" class="fillb"/>`;
    const fx=X(f.fulcrum);
    g+=`<path d="M${n2(fx)} ${by+4} L${n2(fx-14)} ${by+30} L${n2(fx+14)} ${by+30} Z" class="fillw"/>`+ground(fx-26,fx+26,by+30);
    for(const it of f.items){ const x=X(it.x);
      if(it.kind==="weight"){ g+=`<rect x="${n2(x-17)}" y="${by-31}" width="34" height="27" rx="3" class="fillb"/>`+T(x,by-38,it.label,"a"); }
      else if(it.dir==="up"){ g+=arrow(x,by+50,x,by+7)+T(x,by+63,it.label,"a"); }
      else { g+=arrow(x,by-54,x,by-7)+T(x,by-60,it.label,"a"); }
    }
    // 치수선: 받침점·하중 위치를 이웃한 점끼리 잇는다
    const pts=[...new Set([f.fulcrum,...f.items.map(i=>i.x)])].sort((a,b)=>a-b), dy=H-22;
    for(let i=0;i+1<pts.length;i++){ const a=X(pts[i]), b=X(pts[i+1]); if(b-a<8) continue;
      g+=`<line x1="${n2(a)}" y1="${dy}" x2="${n2(b)}" y2="${dy}" class="thin"/><line x1="${n2(a)}" y1="${dy-5}" x2="${n2(a)}" y2="${dy+5}" class="thin"/><line x1="${n2(b)}" y1="${dy-5}" x2="${n2(b)}" y2="${dy+5}" class="thin"/>`;
      g+=T((a+b)/2,dy+15,`${n2(pts[i+1]-pts[i])}${f.unit?" "+f.unit:""}`,"m"); }
    return svg(W,H,g,"지렛대");
  }
  /* ---- pulley ---- */
  function pulley(f){
    const W=260,H=236, n=f.strands, cx=130; let g=ceiling(60,200,12);
    if(n===1){
      g+=`<line x1="${cx}" y1="12" x2="${cx}" y2="34" class="ln"/><circle cx="${cx}" cy="54" r="20" class="fillb"/><circle cx="${cx}" cy="54" r="3" class="fillw"/>`;
      g+=`<path d="M110 54 A20 20 0 0 1 150 54" class="ac"/><line x1="110" y1="54" x2="110" y2="150" class="ac"/>`;
      g+=`<rect x="84" y="150" width="52" height="36" rx="4" class="fillb"/>`+T(110,173,f.load);
      g+=arrow(150,54,150,176)+T(152,194,f.effort,"a");
      return svg(W,H,g,"고정 도르래");
    }
    const gap=20, w=gap*(n-1), xs=[...Array(n)].map((_,i)=>cx-w/2+i*gap), L=xs[0]-14, R=xs[n-1]+14;
    g+=`<line x1="${cx}" y1="12" x2="${cx}" y2="36" class="ln"/><rect x="${n2(L)}" y="36" width="${n2(R-L)}" height="22" rx="9" class="fillb"/>`;
    g+=`<rect x="${n2(L)}" y="122" width="${n2(R-L)}" height="22" rx="9" class="fillb"/>`;
    for(const x of xs) g+=`<line x1="${n2(x)}" y1="58" x2="${n2(x)}" y2="122" class="ac"/>`;
    g+=`<path d="M${n2(R)} 47 L${n2(R+16)} 47" class="ac"/>`+arrow(R+16,47,R+16,196)+T(R+18,214,f.effort,"a","start");
    g+=`<line x1="${cx}" y1="144" x2="${cx}" y2="158" class="ln"/><rect x="${cx-32}" y="158" width="64" height="36" rx="4" class="fillb"/>`+T(cx,181,f.load);
    return svg(W,H,g,"도르래 장치");
  }
  /* ---- gears ---- */
  function gearPath(cx,cy,r,t){ const step=2*Math.PI/t, ri=r-3.2, ro=r+3.2; let d="";
    for(let k=0;k<t;k++){ const a=k*step; const pts=[[ri,a],[ro,a+step*0.18],[ro,a+step*0.5],[ri,a+step*0.68]];
      for(const [rr,aa] of pts){ const x=cx+rr*Math.cos(aa), y=cy+rr*Math.sin(aa); d+=(d?" L":"M")+n2(x)+" "+n2(y); } }
    return d+" Z"; }
  function gears(f){
    let rs=f.gears.map(g=>8+g.teeth*1.1); const total=rs.reduce((a,r)=>a+2*r,0), maxR=Math.max(...rs);
    const s=Math.min(1, 312/total, 62/maxR); rs=rs.map(r=>r*s);
    const H=Math.max(...rs)*2+74, cy=Math.max(...rs)+30; let x=14+rs[0], g="";
    const cxs=[]; rs.forEach((r,i)=>{ if(i>0) x+=rs[i-1]+r; cxs.push(x); });
    const W=Math.max(200, cxs[cxs.length-1]+rs[rs.length-1]+14);
    f.gears.forEach((ge,i)=>{ const cx=cxs[i], r=rs[i];
      const cls="gear"+(ge.label===f.driver?" drv":"")+(f.ask&&ge.label===f.ask?" ask":"");
      g+=`<path d="${gearPath(cx,cy,r,ge.teeth)}" class="${cls}"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(Math.max(4,r*0.18))}" class="fillb"/>`;
      g+=T(cx,cy+r+18,`${ge.label} · ${ge.teeth}T`,ge.label===f.driver?"a":(f.ask&&ge.label===f.ask?"g":"m"));
      if(ge.label===f.driver) g+=rotArrow(cx,cy,r+12,f.dir);
      if(f.ask&&ge.label===f.ask&&ge.label!==f.driver) g+=T(cx,cy-r-10,"?","g");
    });
    return svg(n2(W),n2(H),g,"맞물린 기어");
  }
  /* ---- belt ---- */
  function belt(f){
    const [p1,p2]=f.pulleys; let r1=10+p1.d*3.4, r2=10+p2.d*3.4; const s=Math.min(1,140/(r1+r2)); r1*=s; r2*=s;
    const W=320, cy=Math.max(r1,r2)+26, H=cy+Math.max(r1,r2)+40, x1=24+r1, x2=W-24-r2; let g="";
    if(!f.crossed) g+=`<line x1="${n2(x1)}" y1="${n2(cy-r1)}" x2="${n2(x2)}" y2="${n2(cy-r2)}" class="ac"/><line x1="${n2(x1)}" y1="${n2(cy+r1)}" x2="${n2(x2)}" y2="${n2(cy+r2)}" class="ac"/>`;
    else g+=`<line x1="${n2(x1)}" y1="${n2(cy-r1)}" x2="${n2(x2)}" y2="${n2(cy+r2)}" class="ac"/><line x1="${n2(x1)}" y1="${n2(cy+r1)}" x2="${n2(x2)}" y2="${n2(cy-r2)}" class="ac"/>`;
    [[p1,x1,r1],[p2,x2,r2]].forEach(([p,x,r])=>{ const drv=p.label===f.driver, ask=f.ask&&p.label===f.ask;
      g+=`<circle cx="${n2(x)}" cy="${n2(cy)}" r="${n2(r)}" class="gear${drv?" drv":""}${ask?" ask":""}"/><circle cx="${n2(x)}" cy="${n2(cy)}" r="3.5" class="fillw"/>`;
      g+=T(x,cy+r+18,`${p.label} · ${p.d}${f.unit?" "+f.unit:""}`,drv?"a":(ask?"g":""));
      if(drv) g+=rotArrow(x,cy,r+9,f.dir); else if(ask) g+=T(x,cy-r-10,"?","g"); });
    return svg(W,n2(H),g,f.crossed?"엇걸린 벨트":"평행 벨트");
  }
  /* ---- incline ---- */
  function incline(f){
    const W=340,H=180, A=[28,150], B=[292,150], C=[292,62]; let g="";
    g+=`<path d="M${A[0]} ${A[1]} L${B[0]} ${B[1]} L${C[0]} ${C[1]} Z" class="fillb"/>`+ground(16,318,150);
    const ang=Math.atan2(C[1]-A[1],C[0]-A[0]), deg=ang*180/Math.PI, t=0.52, px=A[0]+(C[0]-A[0])*t, py=A[1]+(C[1]-A[1])*t;
    const nx=Math.sin(ang), ny=-Math.cos(ang);             // 경사면 바깥쪽 법선
    const bx=px+nx*12, by=py+ny*12;
    g+=`<rect x="${n2(bx-18)}" y="${n2(by-12)}" width="36" height="24" rx="3" class="fillw" transform="rotate(${n2(deg)} ${n2(bx)} ${n2(by)})"/>`;
    g+=T(bx+nx*26,by+ny*26,f.load,"",'middle');
    if(f.force){ const ux=Math.cos(ang), uy=Math.sin(ang), sx=bx+ux*22, sy=by+uy*22;
      g+=arrow(sx,sy,sx+ux*54,sy+uy*54)+T(sx+ux*64+nx*14,sy+uy*64+ny*14,f.force,"a"); }
    g+=T(C[0]+8,(B[1]+C[1])/2+4,f.height,"m","start");
    if(f.length) g+=T((A[0]+C[0])/2+nx*-16,(A[1]+C[1])/2+ny*-16+10,f.length,"m","middle",`transform="rotate(${n2(deg)} ${n2((A[0]+C[0])/2+nx*-16)} ${n2((A[1]+C[1])/2+ny*-16+10)})"`);
    if(f.base) g+=T((A[0]+B[0])/2,168,f.base,"m");
    return svg(W,H,g,"경사면");
  }
  /* ---- hydraulic ---- */
  function hydraulic(f){
    const W=320,H=196; let g="";
    g+=`<path d="M52 70 L52 170 L292 170 L292 70" class="ln"/><path d="M84 70 L84 138 L176 138 L176 70" class="ln"/>`;
    g+=`<path d="M53 76 L83 76 L83 139 L177 139 L177 76 L291 76 L291 169 L53 169 Z" class="fluid"/>`;
    g+=`<rect x="53" y="66" width="30" height="10" class="fillb"/><rect x="177" y="66" width="114" height="10" class="fillb"/>`;
    g+=arrow(68,16,68,62)+T(68,12,f.small.force,"a");
    g+=`<rect x="200" y="30" width="68" height="36" rx="4" class="fillb"/>`+T(234,53,f.large.force,f.large.force.includes("?")?"g":"");
    g+=T(68,120,f.small.area,"m")+T(234,110,f.large.area,"m");
    return svg(W,H,g,"유압 장치");
  }
  /* ---- circuit ---- */
  function circuit(f){
    const W=340,H=190, top=40, bot=156, L=34; let g="";
    const bat=`<line x1="${L}" y1="${top}" x2="${L}" y2="88" class="ln"/><line x1="${L-14}" y1="88" x2="${L+14}" y2="88" class="ln"/><line x1="${L-8}" y1="98" x2="${L+8}" y2="98" class="ln" style="stroke-width:3.4"/><line x1="${L}" y1="98" x2="${L}" y2="${bot}" class="ln"/>`+T(L+20,86,"+","m","start")+T(L+14,120,f.source,"a","start");
    g+=bat;
    const rs=f.resistors;
    if(f.mode==="series"){ const R=312, seg=(R-L)/rs.length; let x=L; g+=`<line x1="${R}" y1="${top}" x2="${R}" y2="${bot}" class="ln"/><line x1="${L}" y1="${bot}" x2="${R}" y2="${bot}" class="ln"/>`;
      rs.forEach((lab,i)=>{ const a=x, b=x+seg, zA=a+seg*0.3, zB=b-seg*0.3;
        g+=`<line x1="${n2(a)}" y1="${top}" x2="${n2(zA)}" y2="${top}" class="ln"/>`+zigzagH(zA,zB,top)+`<line x1="${n2(zB)}" y1="${top}" x2="${n2(b)}" y2="${top}" class="ln"/>`+T((zA+zB)/2,top-14,lab,"a"); x=b; }); }
    else { const xs=rs.map((_,i)=>rs.length>1?130+i*(150/(rs.length-1)):200), R=xs[xs.length-1];
      g+=`<line x1="${L}" y1="${top}" x2="${n2(R)}" y2="${top}" class="ln"/><line x1="${L}" y1="${bot}" x2="${n2(R)}" y2="${bot}" class="ln"/>`;
      rs.forEach((lab,i)=>{ const x=xs[i]; g+=`<line x1="${n2(x)}" y1="${top}" x2="${n2(x)}" y2="74" class="ln"/>`+zigzagV(x,74,122,7,6)+`<line x1="${n2(x)}" y1="122" x2="${n2(x)}" y2="${bot}" class="ln"/>`+T(x+12,102,lab,"a","start"); }); }
    return svg(W,H,g,f.mode==="series"?"직렬 회로":"병렬 회로");
  }
  /* ---- springs ---- */
  function springs(f){
    const W=280, ks=f.springs; let g="", H;
    if(f.mode==="series"){ const segH=ks.length===3?46:58; H=34+ks.length*(segH+8)+64; g+=ceiling(90,190,12); let y=12;
      ks.forEach((k,i)=>{ g+=zigzagV(140,y,y+segH,9,8)+T(160,y+segH/2+4,k,"a","start"); y+=segH;
        if(i<ks.length-1){ g+=`<rect x="124" y="${y}" width="32" height="6" rx="2" class="fillb"/>`; y+=8; } });
      g+=`<line x1="140" y1="${y}" x2="140" y2="${y+10}" class="ln"/><rect x="108" y="${y+10}" width="64" height="36" rx="4" class="fillb"/>`+T(140,y+33,f.load); }
    else { H=222; const xs=ks.length===3?[90,140,190]:[105,175], L="ABC"; g+=ceiling(60,220,12);
      xs.forEach((x,i)=>{ g+=zigzagV(x,12,104,8,8)+T(x+(i===0?-14:14),62,L[i],"a",i===0?"end":"start"); });
      g+=T(140,212,ks.map((k,i)=>`${L[i]} ${k}`).join(" · "),"m");
      g+=`<rect x="${xs[0]-14}" y="104" width="${xs[xs.length-1]-xs[0]+28}" height="8" rx="3" class="fillb"/><line x1="140" y1="112" x2="140" y2="130" class="ln"/><rect x="108" y="130" width="64" height="36" rx="4" class="fillb"/>`+T(140,153,f.load); }
    return svg(W,H,g,f.mode==="series"?"직렬 스프링":"병렬 스프링");
  }
  /* ---- pipe ---- */
  function pipe(f){
    const W=340,H=170, cy=86, secs=f.sections, maxD=Math.max(...secs.map(s=>s.d)), hs=secs.map(s=>clamp(s.d/maxD*84,16,84));
    const tr=24, segW=(W-24-tr*(secs.length-1))/secs.length; let x=12, topPts=[], botPts=[];
    secs.forEach((s,i)=>{ const h=hs[i]; topPts.push([x,cy-h/2],[x+segW,cy-h/2]); botPts.push([x,cy+h/2],[x+segW,cy+h/2]); x+=segW+(i<secs.length-1?tr:0); });
    const path=pts=>pts.map((p,i)=>(i?"L":"M")+n2(p[0])+" "+n2(p[1])).join(" ");
    let g=`<path d="${path(topPts)} ${path([...botPts].reverse()).replace(/^M/,"L")} Z" class="fluid"/><path d="${path(topPts)}" class="ln"/><path d="${path(botPts)}" class="ln"/>`;
    x=12; secs.forEach((s,i)=>{ const cx=x+segW/2; g+=T(cx,cy-hs[i]/2-10,`${s.label} · ${s.d}${f.unit?" "+f.unit:""}`,"a"); x+=segW+tr; });
    const ax=12+segW*0.2, dir=f.flow==="left"?-1:1; g+=arrow(ax+(dir<0?46:0),cy,ax+(dir<0?0:46),cy)+T(12+segW*0.2+23,cy+hs[0]/2+18,"흐름","m");
    return svg(W,H,g,"굵기가 변하는 관");
  }
  /* ---- beam: 받침대 두 개에 걸린 보 (하중 분배) ---- */
  function beam(f){
    const W=340,H=172, x0=28, x1=312, sc=(x1-x0)/f.length, X=v=>x0+v*sc, by=84; let g="";
    g+=`<rect x="${x0}" y="${by-5}" width="${x1-x0}" height="10" rx="3" class="fillb"/>`;
    for(const s of f.supports){ const x=X(s.x);
      g+=`<path d="M${n2(x)} ${by+5} L${n2(x-13)} ${by+29} L${n2(x+13)} ${by+29} Z" class="fillw"/>`+ground(x-22,x+22,by+29)+T(x,by+50,s.label,"a"); }
    for(const it of f.loads){ const x=clamp(X(it.x),x0+17,x1-17);      // 끝에 놓인 하중도 상자가 보 밖으로 나가지 않게
      g+=`<rect x="${n2(x-17)}" y="${by-31}" width="34" height="26" rx="3" class="fillb"/>`+T(x,by-38,it.label,"a"); }
    const pts=[...new Set([0,f.length,...f.supports.map(s=>s.x),...f.loads.map(l=>l.x)])].sort((a,b)=>a-b), dy=H-16;
    for(let i=0;i+1<pts.length;i++){ const a=X(pts[i]), b=X(pts[i+1]); if(b-a<10) continue;
      g+=`<line x1="${n2(a)}" y1="${dy}" x2="${n2(b)}" y2="${dy}" class="thin"/><line x1="${n2(a)}" y1="${dy-5}" x2="${n2(a)}" y2="${dy+5}" class="thin"/><line x1="${n2(b)}" y1="${dy-5}" x2="${n2(b)}" y2="${dy+5}" class="thin"/>`;
      g+=T((a+b)/2,dy-5,`${n2(pts[i+1]-pts[i])}${f.unit?" "+f.unit:""}`,"m"); }
    return svg(W,H,g,"받침대 두 개 위의 보");
  }
  /* ---- tank: 모양이 다른 용기들(tanks) 또는 구멍 뚫린 탱크 하나(holes) ---- */
  function tank(f){
    if(f.holes){
      const W=300,H=200, L=70, R=170, top=22, bot=176, hh=bot-top, lv=bot-hh*f.level; let g="";
      g+=`<rect x="${L+1}" y="${n2(lv)}" width="${R-L-2}" height="${n2(bot-lv-1)}" class="fluid"/>`;
      g+=`<path d="M${L} ${top} L${L} ${bot} L${R} ${bot} L${R} ${top}" class="ln"/>`+ground(L-24,R+60,bot+1);
      g+=`<line x1="${L+4}" y1="${n2(lv)}" x2="${R-4}" y2="${n2(lv)}" class="thin"/>`;
      for(const h of f.holes){ const y=bot-hh*h.h;
        g+=`<line x1="${R}" y1="${n2(y)}" x2="${R+14}" y2="${n2(y)}" class="ac"/><circle cx="${R}" cy="${n2(y)}" r="3.4" class="arw"/>`+T(R+22,y+4,h.label,"a","start"); }
      return svg(W,H,g,"구멍이 뚫린 물탱크");
    }
    const ts=f.tanks, base=152, ch=100, dims={rect:[40,40],wide:[92,92],flare:[40,92],taper:[92,40]};
    const total=ts.reduce((t,x)=>t+Math.max(...dims[x.shape]),0)+28*(ts.length-1), s=Math.min(1,292/total);
    const W=Math.max(220,total*s+48), H=200; let x=(W-total*s)/2, g=ground(10,W-10,base+1);
    for(const t of ts){ const [wb,wt]=dims[t.shape].map(v=>v*s), wm=Math.max(wb,wt), cx=x+wm/2, topY=base-ch, lv=base-ch*t.level;
      const half=y=>(wb+(wt-wb)*(base-y)/ch)/2;
      g+=`<path d="M${n2(cx-half(lv))} ${n2(lv)} L${n2(cx-wb/2)} ${base} L${n2(cx+wb/2)} ${base} L${n2(cx+half(lv))} ${n2(lv)} Z" class="fluid"/>`;
      g+=`<path d="M${n2(cx-wt/2)} ${topY} L${n2(cx-wb/2)} ${base} L${n2(cx+wb/2)} ${base} L${n2(cx+wt/2)} ${topY}" class="ln"/>`;
      g+=T(cx,base+18,t.label,"a"); if(t.note) g+=T(cx,base+33,t.note,"m");
      x+=wm+28*s; }
    return svg(n2(W),H,g,"모양이 다른 용기");
  }
  /* ---- wheel: 축바퀴(윈치) — 큰 바퀴에 힘, 작은 축에 하중 ---- */
  function wheel(f){
    const W=300,H=226, cx=150, cy=74, R=54, r=18; let g=ceiling(110,190,10);
    g+=`<line x1="${cx}" y1="10" x2="${cx}" y2="${cy}" class="ln"/>`;
    g+=`<circle cx="${cx}" cy="${cy}" r="${R}" class="gear"/><circle cx="${cx}" cy="${cy}" r="${r}" class="fillb"/><circle cx="${cx}" cy="${cy}" r="3.5" class="fillw"/>`;
    g+=`<line x1="${cx}" y1="${cy}" x2="${n2(cx+R*Math.cos(-0.6))}" y2="${n2(cy+R*Math.sin(-0.6))}" class="thin"/>`+T(cx+R+6,cy-R+6,f.wheel,"m","start");
    g+=`<line x1="${cx-r}" y1="${cy}" x2="${cx-r}" y2="${cy+90}" class="ac"/><rect x="${cx-r-26}" y="${cy+90}" width="52" height="34" rx="4" class="fillb"/>`+T(cx-r,cy+112,f.load);
    g+=`<line x1="${n2(cx-r*0.7)}" y1="${n2(cy-r*0.7)}" x2="${cx-R-2}" y2="${cy-R+8}" class="thin"/>`+T(cx-R-6,cy-R+6,f.axle,"m","end");
    g+=arrow(cx+R,cy,cx+R,cy+124)+T(cx+R+4,cy+140,f.effort,"a","start");
    return svg(W,H,g,"축바퀴");
  }

  /* ===== ANIT 그림 ===== */
  let uid=0;
  /* ---- attitude: 자세계 (bank +: 오른쪽 경사, pitch +: 기수 들림) ---- */
  function attitude(f){
    const W=220,H=220, cx=110, cy=110, r=82, k=2.6, id="aic"+(++uid); let g="";
    g+=`<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`;
    let card=`<rect x="${cx-240}" y="${cy-320}" width="480" height="320" class="sky"/><rect x="${cx-240}" y="${cy}" width="480" height="320" class="earth"/>`;
    card+=`<line x1="${cx-240}" y1="${cy}" x2="${cx+240}" y2="${cy}" class="hz"/>`;
    for(const d of [5,10,15,20]){ const w=d%10?14:24;
      card+=`<line x1="${cx-w}" y1="${n2(cy-d*k)}" x2="${cx+w}" y2="${n2(cy-d*k)}" class="pl"/><line x1="${cx-w}" y1="${n2(cy+d*k)}" x2="${cx+w}" y2="${n2(cy+d*k)}" class="pl"/>`;
      if(!(d%10)) card+=T(cx-w-4,cy-d*k+4,String(d),"pt","end")+T(cx-w-4,cy+d*k+4,String(d),"pt","end"); }
    g+=`<g clip-path="url(#${id})"><g transform="rotate(${n2(-f.bank)} ${cx} ${cy}) translate(0 ${n2(f.pitch*k)})">${card}</g></g>`;
    g+=`<circle cx="${cx}" cy="${cy}" r="${r}" class="ln"/><circle cx="${cx}" cy="${cy}" r="${r+12}" class="ln"/>`;
    for(const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){ const t=(a-90)*Math.PI/180, L=Math.abs(a)%30===0?12:7;
      g+=`<line x1="${n2(cx+(r+1)*Math.cos(t))}" y1="${n2(cy+(r+1)*Math.sin(t))}" x2="${n2(cx+(r+1+L)*Math.cos(t))}" y2="${n2(cy+(r+1+L)*Math.sin(t))}" class="ln"/>`; }
    g+=`<g transform="rotate(${n2(-f.bank)} ${cx} ${cy})"><path d="M${cx} ${cy-r+2} L${cx-7} ${cy-r+14} L${cx+7} ${cy-r+14} Z" class="ptr"/></g>`;
    g+=`<path d="M${cx-58} ${cy} L${cx-20} ${cy} L${cx-10} ${cy+9} M${cx+58} ${cy} L${cx+20} ${cy} L${cx+10} ${cy+9}" class="hi" style="stroke-width:4"/><circle cx="${cx}" cy="${cy}" r="4" class="arw hi"/>`;
    return svg(W,H,g,"자세계");
  }
  /* ---- heading: 방향 지시계 (hdg 0–359) ---- */
  function heading(f){
    const W=220,H=220, cx=110, cy=112, r=84; let card="";
    for(let a=0;a<360;a+=5){ const L=a%30===0?14:a%10===0?9:5, t=(a-90)*Math.PI/180;
      card+=`<line x1="${n2(cx+r*Math.cos(t))}" y1="${n2(cy+r*Math.sin(t))}" x2="${n2(cx+(r-L)*Math.cos(t))}" y2="${n2(cy+(r-L)*Math.sin(t))}" class="ln"/>`; }
    const lab={0:"N",90:"E",180:"S",270:"W"};
    for(let a=0;a<360;a+=30){ const t=(a-90)*Math.PI/180, x=cx+(r-28)*Math.cos(t), y=cy+(r-28)*Math.sin(t);
      card+=`<text x="${n2(x)}" y="${n2(y+5)}" text-anchor="middle" class="${lab[a]?"cd":"cn"}" transform="rotate(${a} ${n2(x)} ${n2(y)})">${lab[a]||a/10}</text>`; }
    let g=`<circle cx="${cx}" cy="${cy}" r="${r+8}" class="fillb"/><g transform="rotate(${n2(-f.hdg)} ${cx} ${cy})">${card}</g>`;
    g+=`<path d="M${cx} ${cy-r+2} L${cx-8} ${cy-r-12} L${cx+8} ${cy-r-12} Z" class="arw hi"/>`;
    g+=`<path d="M${cx} ${cy-26} L${cx+4} ${cy-8} L${cx+26} ${cy+2} L${cx+26} ${cy+7} L${cx+4} ${cy+4} L${cx+3} ${cy+20} L${cx+10} ${cy+25} L${cx-10} ${cy+25} L${cx-3} ${cy+20} L${cx-4} ${cy+4} L${cx-26} ${cy+7} L${cx-26} ${cy+2} L${cx-4} ${cy-8} Z" class="plane"/>`;
    return svg(W,H,g,"방향 지시계");
  }
  // 문자 라벨 콜아웃: 부위 앵커 → 좌/우 여백의 라벨 (같은 쪽 라벨끼리 겹치지 않게 밀어냄)
  function callouts(labels, anchors, W, H){ let g=""; const used={L:[],R:[]};
    for(const lb of labels){ const a=anchors[lb.part]; if(!a) continue; const side=a[2]||(a[0]<W/2?"L":"R");
      let y=a[1]; for(let k=0;k<12&&used[side].some(v=>Math.abs(v-y)<16);k++) y+=(k%2?-1:1)*16*Math.ceil((k+1)/2);
      y=clamp(y,12,H-8); used[side].push(y); const lx=side==="L"?16:W-16;
      g+=`<circle cx="${a[0]}" cy="${a[1]}" r="2.6" class="arw hi"/><line x1="${a[0]}" y1="${a[1]}" x2="${side==="L"?lx+12:lx-12}" y2="${n2(y)}" class="co"/>`+T(lx,y+4,lb.label,"g","middle"); }
    return g; }
  const AC_TOP={nose:[170,24,"R"],propeller:[154,17,"L"],cockpit:[170,56,"L"],fuselage:[170,140,"L"],wing:[104,94,"L"],wingtip:[298,96,"R"],
    aileron:[66,109,"L"],flap:[214,109,"R"],horizontal_stabilizer:[136,178,"L"],elevator:[206,191,"R"],trim_tab:[189,196,"R"],vertical_stabilizer:[170,176,"R"]};
  const AC_SIDE={propeller:[34,84,"L"],cowling:[58,100,"L"],cockpit:[148,74,"L"],fuselage:[210,100,"R"],wing:[150,99,"L"],landing_gear:[134,152,"L"],
    vertical_stabilizer:[270,70,"R"],rudder:[300,80,"R"],horizontal_stabilizer:[278,102,"R"],elevator:[311,101,"R"]};
  /* ---- aircraft: 항공기 부위 (view top|side) ---- */
  function aircraft(f){
    const W=340, side=f.view==="side", H=side?190:216; let g="";
    if(!side){
      g+=`<path d="M38 82 L160 78 L160 114 L38 112 Z M180 78 L302 82 L302 112 L180 114 Z" class="fillb"/>`;
      g+=`<path d="M60 104 L110 104 L110 114 L60 113 Z M230 104 L280 104 L280 113 L230 114 Z" class="cs"/>`;
      g+=`<path d="M112 104 L158 104 L158 114 L112 114 Z M182 104 L228 104 L228 114 L182 114 Z" class="cs2"/>`;
      g+=`<path d="M122 170 L218 170 L218 184 L122 184 Z" class="fillb"/><path d="M124 184 L216 184 L216 194 L124 194 Z" class="cs"/><rect x="184" y="194" width="10" height="3" class="cs2"/>`;
      g+=`<path d="M170 22 C 182 22 184 40 184 60 L182 190 C 182 200 158 200 158 190 L156 60 C 156 40 158 22 170 22 Z" class="fillb"/>`;
      g+=`<ellipse cx="170" cy="56" rx="9" ry="14" class="glass"/><line x1="170" y1="160" x2="170" y2="200" class="ln" style="stroke-width:4"/>`;
      g+=`<line x1="152" y1="17" x2="188" y2="17" class="ln" style="stroke-width:3"/>`;
      g+=callouts(f.labels,AC_TOP,W,H);
      return svg(W,H,g,"항공기 위에서 본 모습");
    }
    g+=`<path d="M40 92 C 40 82 60 80 80 80 L120 80 L132 70 L160 70 L176 82 L262 92 L300 92 L300 108 L262 108 L80 116 C 56 116 40 112 40 104 Z" class="fillb"/>`;
    g+=`<path d="M128 78 L138 70 L158 70 L168 80 Z" class="glass"/>`;
    g+=`<path d="M252 92 L272 44 L290 44 L296 92 Z" class="fillb"/><path d="M290 44 L304 46 L306 92 L296 92 Z" class="cs"/>`;
    g+=`<path d="M262 98 L304 98 L304 104 L262 106 Z" class="fillb"/><path d="M304 98 L318 100 L318 104 L304 104 Z" class="cs"/>`;
    g+=`<path d="M118 96 C 140 92 172 93 186 97 C 172 101 140 102 118 100 Z" class="fillw"/>`;
    g+=`<line x1="34" y1="70" x2="34" y2="128" class="ln" style="stroke-width:3"/><line x1="34" y1="98" x2="40" y2="98" class="ln"/>`;
    g+=`<line x1="128" y1="114" x2="134" y2="146" class="ln"/><circle cx="134" cy="152" r="8" class="fillw"/><line x1="66" y1="114" x2="64" y2="146" class="ln"/><circle cx="64" cy="152" r="7" class="fillw"/>`;
    g+=ground(20,330,161);
    g+=callouts(f.labels,AC_SIDE,W,H);
    return svg(W,H,g,"항공기 옆에서 본 모습");
  }
  const SHIP={bow:[150,24,"R"],stern:[150,206,"R"],port:[111,128,"L"],starboard:[189,128,"R"],amidships:[150,112,"R"],
    port_bow:[127,62,"L"],starboard_bow:[173,62,"R"],port_quarter:[116,192,"L"],starboard_quarter:[184,192,"R"],superstructure:[150,148,"L"]};
  /* ---- ship: 함정 위에서 본 모습 (선수 위쪽) ---- */
  function ship(f){
    const W=300,H=222; let g="";
    g+=`<path d="M150 14 C 168 40 190 72 190 112 L188 190 C 186 204 184 208 182 210 L118 210 C 116 208 114 204 112 190 L110 112 C 110 72 132 40 150 14 Z" class="fillb"/>`;
    g+=`<rect x="136" y="118" width="28" height="44" rx="4" class="fillw"/><line x1="150" y1="22" x2="150" y2="204" class="thin" stroke-dasharray="4 5"/>`;
    if(f.labels.some(l=>l.part==="beam")) g+=`<line x1="112" y1="168" x2="188" y2="168" class="ac"/>`+head(112,168,-1,0)+head(188,168,1,0);
    const anchors={...SHIP,beam:[150,168,"R"]};
    g+=callouts(f.labels,anchors,W,H);
    return svg(W,H,g,"함정 위에서 본 모습");
  }
  /* ---- runway: 활주로 진입단 표지 (아래가 접근 방향) ---- */
  function runway(f){
    const W=220, L=58, R=134, cxr=(L+R)/2, thr=196, H=f.blastpad||f.displaced?262:214; let g="";
    const RWY={threshold:[96,184,"R"],designation:[96,150,"R"],centerline:[96,66,"R"],aiming_point:[120,92,"R"],touchdown_zone:[72,126,"L"],
      displaced_threshold:[96,214,"R"],blast_pad:[96,(f.displaced?232:thr)+14,"R"]};
    g+=`<rect x="${L}" y="8" width="${R-L}" height="${(f.displaced?232:thr)-8}" class="rwy"/>`;
    for(let i=0;i<4;i++){ g+=`<rect x="${L+4+i*8}" y="${thr-30}" width="5" height="26" class="mk"/><rect x="${R-9-i*8}" y="${thr-30}" width="5" height="26" class="mk"/>`; }
    g+=`<text x="${cxr}" y="${thr-40}" text-anchor="middle" class="rn">${esc(f.num)}</text>`;
    for(let y=thr-80;y>12;y-=22) g+=`<rect x="${cxr-1.5}" y="${y-12}" width="3" height="12" class="mk"/>`;
    g+=`<rect x="${L+8}" y="78" width="12" height="28" class="mk"/><rect x="${R-20}" y="78" width="12" height="28" class="mk"/>`;
    for(const [y,n] of [[118,3],[46,2]]) for(let i=0;i<n;i++){ g+=`<rect x="${L+6+i*6}" y="${y}" width="3.5" height="16" class="mk"/><rect x="${R-9.5-i*6}" y="${y}" width="3.5" height="16" class="mk"/>`; }
    g+=`<rect x="${L}" y="${thr-2}" width="${R-L}" height="3" class="mk"/>`;
    if(f.displaced){ for(const x of [L+14,cxr,R-14]) g+=`<line x1="${x}" y1="${thr+30}" x2="${x}" y2="${thr+8}" class="mk2"/>`+head(x,thr+6,0,-1,"mkh",6); }
    if(f.blastpad){ const y0=f.displaced?232:thr, y1=y0+28; g+=`<rect x="${L}" y="${y0}" width="${R-L}" height="${y1-y0}" class="pad"/>`;
      for(const d of [6,16]) g+=`<path d="M${L+4} ${y0+d+8} L${cxr} ${y0+d} L${R-4} ${y0+d+8}" class="chev"/>`; }
    g+=callouts(f.labels||[],RWY,W,H);
    return svg(W,H,g,"활주로 진입단");
  }
  /* ---- papi: 진입각 지시등 4개 (왼쪽부터 white개는 백색, 나머지 적색) ---- */
  function papi(f){
    const W=260,H=96; let g=`<line x1="20" y1="66" x2="240" y2="66" class="thin"/>`;
    for(let i=0;i<4;i++){ const x=58+i*48; g+=`<circle cx="${x}" cy="44" r="13" class="${i<f.white?"lw":"lr"}"/>`; }
    g+=T(130,88,"PAPI","m");
    return svg(W,H,g,"PAPI 진입각 지시등");
  }
  const R={lever,pulley,gears,belt,incline,hydraulic,circuit,springs,pipe,beam,tank,wheel,attitude,heading,aircraft,ship,runway,papi};
  return { render(f){ try{ return f&&R[f.type] ? R[f.type](f) : ""; }catch(e){ console.warn("fig render failed",e,f); return ""; } }, num };
})();
function renderFig(f){ return FIG.render(f); }

/* MCT '원리 5개 한 장 요약' 카드 — 볼트 노트(05 ASTB-E 공부법)의 5원리 */
const MCT_PRINCIPLES = [
  {name:"일의 원리", rule:"힘 × 거리 = 일정. 힘을 줄이면 그만큼 더 먼 거리를 움직여야 한다 (경사면·나사·도르래 공통).",
   fig:{type:"incline",length:"10 ft",height:"2 ft",load:"100 lb",force:"20 lb"}},
  {name:"지렛대", rule:"힘₁ × 받침점까지 거리₁ = 힘₂ × 거리₂. 받침점에서 멀리 누를수록 힘이 덜 든다.",
   fig:{type:"lever",length:9,fulcrum:3,unit:"ft",items:[{x:0,label:"60 lb",kind:"weight"},{x:9,label:"F = 30 lb",kind:"force"}]}},
  {name:"도르래", rule:"움직도르래를 받치는 줄 수 = 기계적 이득. 필요한 힘 = 하중 ÷ 줄 수 (줄은 그 배수만큼 더 당긴다).",
   fig:{type:"pulley",strands:3,load:"300 lb",effort:"F = 100 lb"}},
  {name:"기어·벨트", rule:"맞물린 기어는 방향이 반대. 회전수 × 톱니 수 = 일정 (작은 기어가 빠르다). 평벨트는 같은 방향, X벨트는 반대.",
   fig:{type:"gears",gears:[{teeth:30,label:"A"},{teeth:15,label:"B"}],driver:"A",dir:"cw",ask:"B"}},
  {name:"유체", rule:"파스칼: F₁/A₁ = F₂/A₂ (작은 피스톤이 더 멀리 움직임). 관이 좁아지면 유속↑·압력↓. 수압은 깊이에 비례.",
   fig:{type:"hydraulic",small:{area:"2 in²",force:"10 lb"},large:{area:"20 in²",force:"100 lb"}}},
];
