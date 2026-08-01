/* ============================================================
   Klokkrak — gedeelde motor voor leerling en leerkracht.
   Leerlijn kloklezen volgens de GO!-visietekst "kloklezen":
     · absoluut lezen eerst ("X uur Y minuten"), relatief pas vanaf L3
     · geen lezing "over/voor het half uur" (bewust weggelaten)
     · geen opdrachten waarbij wijzers getekend moeten worden
     · drie soorten opdrachten: decoderen, interpreteren, meten
   Puur statisch, geen server nodig.
   ============================================================ */
var KK = (function(){
"use strict";

/* ===================== HULPJES ===================== */
function rnd(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t; } return a; }
function pad2(n){ return (n<10?"0":"")+n; }
function h12(h){ var x=h%12; return x===0?12:x; }

/* tijdweergaven */
function digitalStr(h,m,mode24){ return (mode24? h : h12(h))+":"+pad2(m); }
function absWords(h,m){ var H=h12(h); return m===0? (H+" uur") : (H+" uur "+m); }
function absWords24(h,m){ return m===0? (h+" uur") : (h+" uur "+m); }
/* relatieve lezing — zonder "over/voor het half uur", zoals het GO! voorschrijft */
function relWords(h,m){
  var H=h12(h), N=h12(h+1);
  if(m===0)  return H+" uur";
  if(m===15) return "kwart over "+H;
  if(m===30) return "half "+N;
  if(m===45) return "kwart voor "+N;
  if(m<30)   return m+" over "+H;
  return (60-m)+" voor "+N;
}
/* minuten netjes uitschrijven voor meetopdrachten */
function duurWoorden(min){
  if(min<60) return min+" minuten";
  var u=Math.floor(min/60), r=min%60;
  return u+" uur"+(r? " "+r+" minuten":"");
}

/* ===================== WIJZERPLAAT (SVG) =====================
   Hoeveelheid hulp op de plaat is instelbaar, precies zoals de
   visietekst aanraadt: van veel info naar geen info. */
var FACE_LABEL = {
  veel:"Uren én minuten",
  gewoon:"Alle uren",
  weinig:"Alleen 12, 3, 6, 9",
  geen:"Geen cijfers"
};
function clockSVG(h,m,face,cls){
  face=face||"gewoon";
  var C=110, R=90;                 /* middelpunt en straal van de wijzerplaat */
  var s=[], i, a;
  s.push('<svg class="clock'+(cls?" "+cls:"")+'" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="wijzerklok">');
  s.push('<circle class="clock__face" cx="'+C+'" cy="'+C+'" r="'+R+'"/>');
  /* streepjes: per minuut, de vijftallen dikker */
  for(i=0;i<60;i++){
    var big=(i%5===0);
    if(face==="geen" && !big) continue;
    a=(i*6-90)*Math.PI/180;
    var r1=big?(R-14):(R-8), r2=R-2;
    s.push('<line class="clock__tick'+(big?" clock__tick--big":"")+
      '" x1="'+(C+r1*Math.cos(a)).toFixed(1)+'" y1="'+(C+r1*Math.sin(a)).toFixed(1)+
      '" x2="'+(C+r2*Math.cos(a)).toFixed(1)+'" y2="'+(C+r2*Math.sin(a)).toFixed(1)+'"/>');
  }
  /* uurcijfers */
  if(face!=="geen"){
    for(i=1;i<=12;i++){
      if(face==="weinig" && [12,3,6,9].indexOf(i)===-1) continue;
      a=(i*30-90)*Math.PI/180;
      s.push('<text class="clock__num" x="'+(C+(R-30)*Math.cos(a)).toFixed(1)+
             '" y="'+(C+(R-30)*Math.sin(a)).toFixed(1)+'">'+i+'</text>');
    }
  }
  /* minuutcijfers per 5, buiten de plaat (alleen bij "veel") */
  if(face==="veel"){
    for(i=1;i<=12;i++){
      a=(i*30-90)*Math.PI/180;
      s.push('<text class="clock__min" x="'+(C+(R+14)*Math.cos(a)).toFixed(1)+
             '" y="'+(C+(R+14)*Math.sin(a)).toFixed(1)+'">'+((i*5)%60)+'</text>');
    }
  }
  /* wijzers: klein = uren, groot = minuten */
  var ha=((h12(h)%12)*30 + m*0.5 - 90)*Math.PI/180;
  var ma=(m*6-90)*Math.PI/180;
  s.push('<line class="clock__hand clock__hand--h" x1="'+C+'" y1="'+C+'" x2="'+(C+(R-42)*Math.cos(ha)).toFixed(1)+'" y2="'+(C+(R-42)*Math.sin(ha)).toFixed(1)+'"/>');
  s.push('<line class="clock__hand clock__hand--m" x1="'+C+'" y1="'+C+'" x2="'+(C+(R-14)*Math.cos(ma)).toFixed(1)+'" y2="'+(C+(R-14)*Math.sin(ma)).toFixed(1)+'"/>');
  s.push('<circle class="clock__pin" cx="'+C+'" cy="'+C+'" r="6"/>');
  s.push('</svg>');
  return s.join("");
}

/* ===================== OPGAVEN PER GRAAD =====================
   Elk thema levert een opdracht:
     {vorm, prompt, clock:{h,m}, answer, choices, key, extra}
   vormen: mc (tekstkeuze) · mcClock (kies de juiste klok)
           tijd (typ uu:mm) · getal (typ een getal)
   ==================================================================== */

/* --- hulpjes om afleiders te maken --- */
function nearTimes(h,m,step,n){
  var out=[], tries=0;
  while(out.length<n && tries++<60){
    var dh=h, dm=m+pick([-3,-2,-1,1,2,3])*step;
    while(dm<0){ dm+=60; dh--; }
    while(dm>=60){ dm-=60; dh++; }
    if(dh<0) dh+=12;
    if(Math.random()<0.35) dh=(dh+pick([1,11]))%24;
    var key=h12(dh)+":"+dm;
    if(key===h12(h)+":"+m) continue;
    if(out.some(function(o){ return h12(o.h)+":"+o.m===key; })) continue;
    out.push({h:dh,m:dm});
  }
  return out;
}
function mcFrom(answer, wrongs){ return shuffle([answer].concat(wrongs)); }

var THEMES = {
1:[
 {id:"heel", label:"Hele uren", sub:"3 uur · 8 uur", ll:"L1",
  gen:function(cfg){
    var h=rnd(1,12);
    var w=[h12(h+1)+" uur", h12(h+11)+" uur", h12(h+pick([2,10]))+" uur"];
    return {vorm:"mc", prompt:"Hoe laat is het?", clock:{h:h,m:0},
            answer:h12(h)+" uur", choices:mcFrom(h12(h)+" uur", w.filter(function(x,i,s){return s.indexOf(x)===i;}).slice(0,2)),
            key:"heel"+h};
  }},
 {id:"half", label:"Halve uren", sub:"8 uur 30", ll:"L1",
  gen:function(cfg){
    var h=rnd(1,12), a=h12(h)+" uur 30";
    var w=[h12(h+1)+" uur 30", h12(h)+" uur", h12(h+11)+" uur 30"];
    return {vorm:"mc", prompt:"Hoe laat is het?", clock:{h:h,m:30},
            answer:a, choices:mcFrom(a, shuffle(w).slice(0,2)), key:"half"+h};
  }},
 {id:"vijf", label:"Per 5 minuten", sub:"10 uur 25", ll:"L2",
  gen:function(cfg){
    var h=rnd(1,12), m=rnd(1,11)*5, a=absWords(h,m);
    var w=nearTimes(h,m,5,2).map(function(t){ return absWords(t.h,t.m); });
    return {vorm:"mc", prompt:"Hoe laat is het?", clock:{h:h,m:m},
            answer:a, choices:mcFrom(a,w), key:"vijf"+h+"_"+m};
  }},
 {id:"schrijf", label:"Schrijf digitaal", sub:"10:25", ll:"L2",
  gen:function(cfg){
    var h=rnd(1,12), m=Math.random()<0.4? pick([0,30]) : rnd(0,11)*5;
    return {vorm:"tijd", prompt:"Schrijf de tijd digitaal", clock:{h:h,m:m},
            answer:h12(h)+":"+pad2(m), hh:h12(h), mm:m, key:"schr"+h+"_"+m};
  }},
 {id:"welke", label:"Welke klok hoort erbij?", sub:"7:20 → ?", ll:"L2",
  gen:function(cfg){
    var h=rnd(1,12), m=rnd(0,11)*5;
    var w=nearTimes(h,m,5,3);
    var opts=shuffle([{h:h,m:m}].concat(w.slice(0,3)));
    return {vorm:"mcClock", prompt:"Welke klok toont "+h12(h)+":"+pad2(m)+"?",
            clock:null, answer:h12(h)+":"+pad2(m),
            choices:opts.map(function(t){ return {h:t.h,m:t.m,label:h12(t.h)+":"+pad2(t.m)}; }),
            key:"welke"+h+"_"+m};
  }},
 {id:"dagdeel", label:"Voormiddag of namiddag?", sub:"20 uur → namiddag", ll:"L2",
  gen:function(cfg){
    var items=[
     {t:"Je staat op en ontbijt.", h:7, vm:true},
     {t:"De school begint.", h:8, vm:true},
     {t:"Het is speeltijd in de voormiddag.", h:10, vm:true},
     {t:"Je eet 's middags je boterhammen.", h:12, vm:true},
     {t:"De school is gedaan.", h:15, vm:false},
     {t:"Je eet avondeten.", h:18, vm:false},
     {t:"Je gaat slapen.", h:20, vm:false},
     {t:"Het is midden in de nacht.", h:2, vm:true},
     {t:"Je gaat naar de turnles na school.", h:17, vm:false},
     {t:"De zon komt op in de zomer.", h:6, vm:true}
    ];
    var it=pick(items);
    return {vorm:"mc", prompt:it.t+" Het is "+it.h+" uur. Is dat voormiddag of namiddag?",
            clock:null, answer:it.vm?"voormiddag":"namiddag",
            choices:["voormiddag","namiddag"], key:"dag"+it.h};
  }},
 {id:"metenu", label:"Hoeveel uur later?", sub:"3 uur → 2 uur later", ll:"L2",
  gen:function(cfg){
    var h=rnd(1,10), d=rnd(1,3), later=Math.random()<0.65;
    var res=later? h+d : h-d;
    if(res<1) res+=12;
    return {vorm:"tijd", prompt:"Het is "+h12(h)+" uur. Hoe laat is het "+d+" uur "+(later?"later":"vroeger")+"?",
            clock:{h:h,m:0}, answer:h12(res)+":00", hh:h12(res), mm:0, key:"mu"+h+"_"+d+"_"+later};
  }},
 {id:"metenm", label:"Hoeveel minuten later?", sub:"10 uur 15 → 20 min later", ll:"L2",
  gen:function(cfg){
    var h=rnd(1,12), m=rnd(0,6)*5, d=rnd(1,5)*5;
    if(m+d>55){ m=rnd(0,4)*5; }
    var res=m+d;
    return {vorm:"tijd", prompt:"Het is "+absWords(h,m)+". Hoe laat is het "+d+" minuten later?",
            clock:{h:h,m:m}, answer:h12(h)+":"+pad2(res), hh:h12(h), mm:res, key:"mm"+h+"_"+m+"_"+d};
  }}
],
2:[
 {id:"minuut", label:"Tot op de minuut", sub:"10 uur 16", ll:"L3",
  gen:function(cfg){
    var h=rnd(1,12), m=rnd(1,59);
    return {vorm:"tijd", prompt:"Schrijf de tijd digitaal", clock:{h:h,m:m},
            answer:h12(h)+":"+pad2(m), hh:h12(h), mm:m, key:"min"+h+"_"+m};
  }},
 {id:"rel5", label:"Over en voor het uur", sub:"20 over 3 · 10 voor 5", ll:"L3",
  gen:function(cfg){
    var h=rnd(1,12), m=pick([5,10,20,25,35,40,50,55]);
    var a=relWords(h,m);
    var w=[];
    [5,10,20,25,35,40,50,55].forEach(function(mm){ if(mm!==m) w.push(relWords(h,mm)); });
    w=shuffle(w.filter(function(x,i,s){return s.indexOf(x)===i && x!==a;})).slice(0,2);
    return {vorm:"mc", prompt:"Hoe laat is het?", clock:{h:h,m:m},
            answer:a, choices:mcFrom(a,w), key:"rel5"+h+"_"+m};
  }},
 {id:"kwarthalf", label:"Kwart en half", sub:"kwart over 4 · half 7", ll:"L3",
  gen:function(cfg){
    var h=rnd(1,12), m=pick([0,15,30,45]);
    var a=relWords(h,m);
    var w=[0,15,30,45].filter(function(x){return x!==m;}).map(function(x){ return relWords(h,x); });
    return {vorm:"mc", prompt:"Hoe laat is het?", clock:{h:h,m:m},
            answer:a, choices:mcFrom(a, shuffle(w).slice(0,3)), key:"kh"+h+"_"+m};
  }},
 {id:"uren24", label:"24-uren lezing", sub:"'s middags → 14:35", ll:"L3",
  gen:function(cfg){
    var h=rnd(13,23), m=rnd(0,11)*5;
    return {vorm:"tijd", max24:true,
            prompt:"Het is namiddag of avond. Schrijf de tijd in 24-uren.",
            clock:{h:h,m:m}, answer:h+":"+pad2(m), hh:h, mm:m, key:"u24"+h+"_"+m};
  }},
 {id:"relmin", label:"Op de minuut, over en voor", sub:"7 over 3 · 12 voor 9", ll:"L4",
  gen:function(cfg){
    var h=rnd(1,12), m=pick([3,7,8,12,17,22,23,38,42,47,52,53,57]);
    var a=relWords(h,m);
    var w=shuffle([relWords(h,60-m), relWords(h+1,m), relWords(h,m+(m<30?5:-5))])
            .filter(function(x){return x!==a;}).slice(0,2);
    return {vorm:"mc", prompt:"Hoe laat is het?", clock:{h:h,m:m},
            answer:a, choices:mcFrom(a,w), key:"rm"+h+"_"+m};
  }},
 {id:"kwartbij", label:"Kwartier of half uur bijdoen", sub:"+ 15 min · − 30 min", ll:"L3",
  gen:function(cfg){
    var h=rnd(1,12), m=rnd(0,11)*5, d=pick([15,30,45]), bij=Math.random()<0.6;
    var tot=h*60+m+(bij? d : -d);
    if(tot<0) tot+=12*60;
    var rh=Math.floor(tot/60)%12, rm=tot%60;
    return {vorm:"tijd",
            prompt:"Het is "+absWords(h,m)+". Hoe laat is het "+d+" minuten "+(bij?"later":"vroeger")+"?",
            clock:{h:h,m:m}, answer:h12(rh)+":"+pad2(rm), hh:h12(rh), mm:rm,
            key:"kb"+h+"_"+m+"_"+d+"_"+bij};
  }},
 {id:"overuur", label:"Verschil over het uur heen", sub:"van 9:50 tot 10:20", ll:"L4",
  gen:function(cfg){
    var h=rnd(1,11), m=rnd(7,11)*5;
    var dur=rnd(3,11)*5;
    var tot=h*60+m+dur, eh=Math.floor(tot/60), em=tot%60;
    return {vorm:"getal", eenheid:"minuten",
            prompt:"De les start om "+h12(h)+":"+pad2(m)+" en eindigt om "+h12(eh)+":"+pad2(em)+". Hoeveel minuten duurt de les?",
            clock:null, answer:String(dur), key:"ou"+h+"_"+m+"_"+dur};
  }}
],
3:[
 {id:"duur", label:"Hoe lang duurt het?", sub:"van 14:15 tot 16:40", ll:"L5",
  gen:function(cfg){
    var sh=rnd(8,18), sm=rnd(0,11)*5;
    var dur=rnd(5,30)*5;
    var tot=sh*60+sm+dur, eh=Math.floor(tot/60)%24, em=tot%60;
    return {vorm:"duur",
            prompt:"De film start om "+sh+":"+pad2(sm)+" en eindigt om "+eh+":"+pad2(em)+". Hoe lang duurt de film?",
            clock:null, answer:Math.floor(dur/60)+":"+pad2(dur%60), hh:Math.floor(dur/60), mm:dur%60,
            key:"du"+sh+"_"+sm+"_"+dur};
  }},
 {id:"later", label:"Hoe laat is het straks?", sub:"binnen 2 uur 40", ll:"L5",
  gen:function(cfg){
    var h=rnd(6,20), m=rnd(0,11)*5;
    var du=rnd(1,3), dm=rnd(1,11)*5, vooruit=Math.random()<0.7;
    var tot=h*60+m+(vooruit?1:-1)*(du*60+dm);
    tot=(tot+24*60)%(24*60);
    var rh=Math.floor(tot/60), rm=tot%60;
    return {vorm:"tijd", max24:true,
            prompt:"Het is "+h+":"+pad2(m)+". Hoe laat is het "+du+" uur "+dm+" minuten "+(vooruit?"later":"vroeger")+"?",
            clock:null, answer:rh+":"+pad2(rm), hh:rh, mm:rm, key:"la"+h+"_"+m+"_"+du+"_"+dm+"_"+vooruit};
  }},
 {id:"omzet", label:"Tijdmaten omzetten", sub:"2 uur = 120 min", ll:"L5",
  gen:function(cfg){
    var kind=pick(["u2m","m2s","d2u","halfu","kwart","min2u"]);
    var q,a,e;
    if(kind==="u2m"){ var u=rnd(2,9); q=u+" uur = ? minuten"; a=u*60; e="minuten"; }
    else if(kind==="m2s"){ var mi=rnd(2,9); q=mi+" minuten = ? seconden"; a=mi*60; e="seconden"; }
    else if(kind==="d2u"){ var d=rnd(2,7); q=d+" dagen = ? uur"; a=d*24; e="uur"; }
    else if(kind==="halfu"){ var u2=rnd(1,5); q=u2+" en een half uur = ? minuten"; a=u2*60+30; e="minuten"; }
    else if(kind==="kwart"){ var u3=rnd(1,5); q=u3+" uur en een kwartier = ? minuten"; a=u3*60+15; e="minuten"; }
    else { var mm=rnd(2,9)*60; q=mm+" minuten = ? uur"; a=mm/60; e="uur"; }
    return {vorm:"getal", eenheid:e, prompt:q, clock:null, answer:String(a), key:"om"+kind+"_"+a};
  }},
 {id:"rooster", label:"Uurrooster lezen", sub:"bus van 8:12", ll:"L6",
  gen:function(cfg){
    var start=rnd(7,17), min0=rnd(0,5)*10, iv=pick([10,15,20,30]);
    var t0=start*60+min0;
    var rijen=[0,1,2,3].map(function(i){ var t=t0+i*iv; return Math.floor(t/60)+":"+pad2(t%60); });
    var nu=t0+rnd(1,iv-1);
    var wacht=(t0+iv)-nu;
    return {vorm:"getal", eenheid:"minuten",
            prompt:"De bus rijdt om "+rijen.join(", ")+". Je bent aan de halte om "+Math.floor(nu/60)+":"+pad2(nu%60)+". Hoeveel minuten moet je wachten op de volgende bus?",
            clock:null, answer:String(wacht), key:"ro"+t0+"_"+iv+"_"+nu};
  }},
 {id:"optijd", label:"Op tijd of te laat?", sub:"vertrek 8:30", ll:"L6",
  gen:function(cfg){
    var afspraak=rnd(8,19)*60+rnd(0,3)*15;
    var reis=rnd(2,9)*5;
    var vertrek=afspraak-reis+pick([-10,-5,0,5,10]);
    var aankomst=vertrek+reis;
    var op=aankomst<=afspraak;
    return {vorm:"mc",
            prompt:"Je moet er zijn om "+Math.floor(afspraak/60)+":"+pad2(afspraak%60)+
                   ". Je vertrekt om "+Math.floor(vertrek/60)+":"+pad2(vertrek%60)+
                   " en bent "+reis+" minuten onderweg. Ben je op tijd?",
            clock:null, answer:op?"op tijd":"te laat", choices:["op tijd","te laat"],
            key:"op"+afspraak+"_"+vertrek+"_"+reis};
  }}
]
};

function themesFor(g){ return THEMES[g]||[]; }
function themeById(g,id){ var l=themesFor(g); for(var i=0;i<l.length;i++) if(l[i].id===id) return l[i]; return null; }

/* ===================== INSTELLINGEN ===================== */
var GRAAD_LABEL = {1:"1e graad (L1–L2)",2:"2e graad (L3–L4)",3:"3e graad (L5–L6)"};
function defaults(){ return {graad:1, themes:["heel","half"], face:"gewoon", count:10, seconds:0, session:"self"}; }

function makeSettings(host, state, onChange){
  function h(tag,cls,txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }
  function fire(){ ensure(); render(); if(onChange) onChange(); }
  function ensure(){
    state.themes=state.themes.filter(function(id){ return themeById(state.graad,id); });
    if(!state.themes.length){ var l=themesFor(state.graad); if(l.length) state.themes=[l[0].id]; }
    if(!FACE_LABEL[state.face]) state.face="gewoon";
  }
  function chipRow(parent,opts){
    var box=h("div","chips"); parent.appendChild(box);
    opts.items.forEach(function(it){
      var b=h("button","chip"+(it.wide?" chip--wide":""), it.label);
      b.type="button"; b.dataset.k=it.k;
      b.onclick=function(){ opts.pick(it.k); fire(); };
      box.appendChild(b);
    });
    return box;
  }
  host.innerHTML=""; var B={};

  var bG=h("div","block"); host.appendChild(bG);
  bG.appendChild(h("p","block__label","Graad"));
  B.graad=chipRow(bG,{items:[{k:"1",label:"1e graad",wide:true},{k:"2",label:"2e graad",wide:true},{k:"3",label:"3e graad",wide:true}],
    pick:function(k){ var g=+k; if(g!==state.graad){ state.graad=g; state.themes=[]; } }});
  var hint=h("p","block__hint",""); hint.style.marginTop="8px"; bG.appendChild(hint); B.hint=hint;

  var bT=h("div","block"); host.appendChild(bT);
  var lT=h("p","block__label","Onderwerpen "); lT.appendChild(h("span","block__hint","kies er één of meer")); bT.appendChild(lT);
  var tb=h("div","forms"); bT.appendChild(tb); B.tb=tb;
  var tiny=h("div","tinybtns"); bT.appendChild(tiny);
  var aB=h("button","tinybtn","Alles aan"); aB.type="button";
  aB.onclick=function(){ state.themes=themesFor(state.graad).map(function(t){return t.id;}); fire(); };
  var nB=h("button","tinybtn","Alles uit"); nB.type="button";
  nB.onclick=function(){ state.themes=state.themes.slice(0,1); fire(); };
  tiny.appendChild(aB); tiny.appendChild(nB);

  var bF=h("div","block"); host.appendChild(bF);
  var lF=h("p","block__label","Wijzerplaat "); lF.appendChild(h("span","block__hint","hoeveel hulp staat er op de klok?")); bF.appendChild(lF);
  B.face=chipRow(bF,{items:[{k:"veel",label:"Uren + minuten",wide:true},{k:"gewoon",label:"Alle uren",wide:true},
                            {k:"weinig",label:"12, 3, 6, 9",wide:true},{k:"geen",label:"Geen cijfers",wide:true}],
    pick:function(k){ state.face=k; }});
  var prev=h("div","facepreview"); bF.appendChild(prev); B.prev=prev;

  var bN=h("div","block"); host.appendChild(bN);
  bN.appendChild(h("p","block__label","Aantal oefeningen"));
  B.count=chipRow(bN,{items:[{k:"5",label:"5"},{k:"10",label:"10"},{k:"15",label:"15"},{k:"20",label:"20"},{k:"0",label:"∞"}],
    pick:function(k){ state.count=+k; }});

  var bS=h("div","block"); host.appendChild(bS);
  var lS=h("p","block__label","Tijd per oefening "); lS.appendChild(h("span","block__hint","zonder tijdsdruk = Geen")); bS.appendChild(lS);
  B.seconds=chipRow(bS,{items:[{k:"0",label:"Geen"},{k:"20",label:"20 s"},{k:"30",label:"30 s"},{k:"60",label:"60 s"}],
    pick:function(k){ state.seconds=+k; }});

  function render(){
    ensure();
    B.graad.querySelectorAll(".chip").forEach(function(c){ c.setAttribute("aria-pressed", +c.dataset.k===state.graad); });
    B.hint.textContent=GRAAD_LABEL[state.graad];
    tb.innerHTML="";
    themesFor(state.graad).forEach(function(t){
      var on=state.themes.indexOf(t.id)>-1;
      var b=h("button","form-opt"); b.type="button"; b.setAttribute("aria-pressed",on);
      var demo=h("span","form-opt__demo",t.sub);
      var tx=h("span","form-opt__txt"); tx.appendChild(h("b",null,t.label));
      if(t.ll) tx.appendChild(h("span",null,"leerjaar "+t.ll.slice(1)));
      var tick=h("span","form-opt__tick","✓");
      b.appendChild(demo); b.appendChild(tx); b.appendChild(tick);
      b.onclick=function(){
        var i=state.themes.indexOf(t.id);
        if(i>-1){ if(state.themes.length>1) state.themes.splice(i,1); }
        else state.themes.push(t.id);
        fire();
      };
      tb.appendChild(b);
    });
    B.face.querySelectorAll(".chip").forEach(function(c){ c.setAttribute("aria-pressed", c.dataset.k===state.face); });
    B.prev.innerHTML=clockSVG(10,25,state.face,"clock--mini");
    B.count.querySelectorAll(".chip").forEach(function(c){ c.setAttribute("aria-pressed", +c.dataset.k===state.count); });
    B.seconds.querySelectorAll(".chip").forEach(function(c){ c.setAttribute("aria-pressed", +c.dataset.k===state.seconds); });
  }
  render(); if(onChange) onChange();
  return { sync:render };
}

/* ===================== LINK & QR ===================== */
function buildHash(s){
  return "#g="+s.graad+"&th="+s.themes.join(".")+"&w="+s.face+"&n="+s.count+"&t="+s.seconds+"&m="+(s.session==="class"?"c":"s");
}
function parseParams(str){
  if(!str) return null;
  var i=str.indexOf("#"); if(i>-1) str=str.slice(i+1);
  if(!str || str.indexOf("g=")===-1) return null;
  var kv={}; str.split("&").forEach(function(p){ var a=p.split("="); if(a.length===2) kv[a[0]]=decodeURIComponent(a[1]); });
  var g=+kv.g; if(!(g===1||g===2||g===3)) return null;
  var out=defaults(); out.graad=g;
  out.themes=(kv.th||"").split(".").filter(function(id){ return themeById(g,id); });
  if(!out.themes.length) return null;
  out.face=FACE_LABEL[kv.w]? kv.w : "gewoon";
  out.count=kv.n!=null? Math.max(0,Math.min(50,+kv.n||0)) : 10;
  out.seconds=kv.t!=null? Math.max(0,Math.min(180,+kv.t||0)) : 0;
  out.session=kv.m==="c"?"class":"self";
  return out;
}

/* ===================== REEKS OPBOUWEN ===================== */
function buildSet(cfg){
  var n=cfg.count>0?cfg.count:12, list=[], used={}, last="";
  for(var i=0;i<n;i++){
    var ex=null;
    for(var t=0;t<80;t++){
      var th=themeById(cfg.graad, pick(cfg.themes)); if(!th) continue;
      var c=th.gen(cfg); c.theme=th;
      if(c.key===last) continue;
      if(!used[c.key]){ ex=c; break; }
      if(!ex) ex=c;
    }
    if(!ex) break;
    used[ex.key]=true; last=ex.key; list.push(ex);
  }
  return list;
}

/* ===================== GELUID ===================== */
var actx=null, soundOn=true;
function resumeAudio(){ try{ if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==="suspended") actx.resume(); }catch(e){} }
function beep(f,d,ty,v,w){
  if(!soundOn||!actx) return;
  try{ var o=actx.createOscillator(), g=actx.createGain();
    o.type=ty||"sine"; o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,actx.currentTime+(w||0));
    g.gain.exponentialRampToValueAtTime(v||.22,actx.currentTime+(w||0)+.02);
    g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+(w||0)+(d||.15));
    o.connect(g); g.connect(actx.destination);
    o.start(actx.currentTime+(w||0)); o.stop(actx.currentTime+(w||0)+(d||.15)+.05);
  }catch(e){}
}
function sGood(){ beep(660,.12,"sine",.22); beep(880,.16,"sine",.22,.09); }
function sBad(){ beep(220,.22,"square",.12); }
function sDone(){ [523,659,784,1047].forEach(function(f,i){ beep(f,.18,"sine",.2,i*.12); }); }
function toggleSound(){ soundOn=!soundOn; var b=document.getElementById("soundBtn"); if(b) b.textContent=soundOn?"🔊":"🔇"; return soundOn; }

/* ===================== SPEL ===================== */
var onExit=function(){}, game=null;
function setOnExit(fn){ onExit=fn||function(){}; }
function $(s){ return document.querySelector(s); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }

function startGame(cfg){
  resumeAudio();
  game={cfg:cfg, set:buildSet(cfg), i:0, stars:0, good:0, total:0, log:[],
        typed:"", typed2:"", active:0, locked:false, reveal:false, timer:null, cur:null};
  ["screenHome","screenSetup","screenScan","screenGen","screenDone"].forEach(function(id){
    var e=document.getElementById(id); if(e) e.classList.add("hidden");
  });
  $("#screenPlay").classList.remove("hidden");
  $("#starCount").textContent="0";
  window.scrollTo(0,0);
  next();
}
function clearTimer(){ if(game&&game.timer){ clearInterval(game.timer); game.timer=null; }
  var g=document.getElementById("glow"); if(g) g.style.opacity=0; }

function next(){
  clearTimer();
  var s=$("#splash"); if(s) s.classList.remove("show");
  if(game.cfg.count>0 && game.i>=game.cfg.count) return endGame();
  if(game.i>=game.set.length) game.set=game.set.concat(buildSet(game.cfg));
  game.cur=game.set[game.i]; game.i++;
  game.typed=""; game.typed2=""; game.active=0; game.locked=false; game.reveal=false;
  render(game.cur);
  var f=$("#progFill"); if(f) f.style.width=game.cfg.count>0? Math.round(100*(game.i-1)/game.cfg.count)+"%" : "0%";
  if(game.cfg.session!=="class" && game.cfg.seconds>0) startTimer(game.cfg.seconds);
}
function startTimer(secs){
  var bar=document.getElementById("timeFill"), total=secs*10, left=total, glow=document.getElementById("glow");
  game.timer=setInterval(function(){
    left--;
    if(bar){ var f=left/total; bar.style.width=Math.max(0,Math.round(100*f))+"%";
      bar.style.background=f>.35?"var(--grass)":f>.15?"var(--sun-deep)":"var(--berry)"; }
    if(glow){ var sl=left/10;
      if(sl<=5){ glow.style.opacity=String(.55*(1-sl/5)); glow.style.setProperty("--glowc", sl>2.5?"#FFD27A":"#E5566B"); }
      else glow.style.opacity=0; }
    if(left<=0){ clearTimer(); miss(); }
  },100);
}

/* ---------- weergave ---------- */
function render(ex){
  var stage=$("#stage"); stage.innerHTML="";
  var cls=game.cfg.session==="class";
  var wrap=el("div", cls? "exwrap classbar":"exwrap"); stage.appendChild(wrap);
  wrap.appendChild(el("div","themetag",ex.theme.label));
  if(!cls && game.cfg.seconds>0){
    var tb=el("div","timebar"), tf=el("div","timebar__fill"); tf.id="timeFill"; tf.style.width="100%";
    tb.appendChild(tf); wrap.appendChild(tb);
  }
  wrap.appendChild(el("p","exlead",ex.prompt));
  if(ex.clock){
    var cw=el("div","clockwrap"); cw.innerHTML=clockSVG(ex.clock.h,ex.clock.m,game.cfg.face); wrap.appendChild(cw);
  }
  if(ex.vorm==="mc"){
    var ch=el("div","choices choices--words");
    ex.choices.forEach(function(c){
      var b=el("button","choice choice--word",c); b.type="button";
      b.onclick=function(){ if(game.locked||cls) return; submit(c===ex.answer, ex, c, b); };
      ch.appendChild(b);
    });
    wrap.appendChild(ch);
  }
  else if(ex.vorm==="mcClock"){
    var cg=el("div","clockgrid");
    ex.choices.forEach(function(c){
      var b=el("button","clockopt"); b.type="button";
      b.innerHTML=clockSVG(c.h,c.m,game.cfg.face,"clock--small");
      b.dataset.v=c.label;
      b.onclick=function(){ if(game.locked||cls) return; submit(c.label===ex.answer, ex, c.label, b); };
      cg.appendChild(b);
    });
    wrap.appendChild(cg);
  }
  else if(ex.vorm==="tijd" || ex.vorm==="duur"){
    var row=el("div","timeinput");
    var t1=el("span","ttile ttile--blank","?"); t1.id="tHH";
    var sep=el("span","tsep", ex.vorm==="duur"? "u":":");
    var t2=el("span","ttile ttile--blank","?"); t2.id="tMM";
    var lab1=el("span","tlab", ex.vorm==="duur"? "uur":"uren");
    var lab2=el("span","tlab","minuten");
    var g1=el("span","tgroup"); g1.appendChild(t1); g1.appendChild(lab1);
    var g2=el("span","tgroup"); g2.appendChild(t2); g2.appendChild(lab2);
    row.appendChild(g1); row.appendChild(sep); row.appendChild(g2);
    wrap.appendChild(row);
    t1.onclick=function(){ if(!game.locked){ game.active=0; syncCur(); } };
    t2.onclick=function(){ if(!game.locked){ game.active=1; syncCur(); } };
    if(!cls) wrap.appendChild(padEl());
  }
  else if(ex.vorm==="getal"){
    var row2=el("div","timeinput");
    var tg=el("span","ttile ttile--blank","?"); tg.id="tHH";
    var g3=el("span","tgroup"); g3.appendChild(tg); g3.appendChild(el("span","tlab",ex.eenheid||""));
    row2.appendChild(g3); wrap.appendChild(row2);
    if(!cls) wrap.appendChild(padEl());
  }
  if(cls) classControls(ex, wrap);
  syncCur();
}
function padEl(){
  var box=el("div","pad");
  ["1","2","3","4","5","6","7","8","9","del","0","ok"].forEach(function(k){
    var b=el("button","key"+(k==="del"?" key--del":k==="ok"?" key--act":""), k==="del"?"⌫":k==="ok"?"✓":k);
    b.type="button"; b.dataset.k=k;
    b.onclick=function(){ press(k); };
    box.appendChild(b);
  });
  return box;
}
function twoFields(){ var ex=game.cur; return ex.vorm==="tijd"||ex.vorm==="duur"; }
function syncCur(){
  var a=document.getElementById("tHH"), b=document.getElementById("tMM");
  if(a){ a.textContent=game.typed===""?"?":game.typed; a.classList.toggle("filled",game.typed!==""); a.classList.toggle("cursor", game.active===0); }
  if(b){ b.textContent=game.typed2===""?"?":game.typed2; b.classList.toggle("filled",game.typed2!==""); b.classList.toggle("cursor", game.active===1); }
}
function press(k){
  if(game.locked) return;
  var two=twoFields();
  if(k==="ok"){ check(); return; }
  var fld=(two&&game.active===1)?"typed2":"typed";
  if(k==="del"){ game[fld]=game[fld].slice(0,-1); syncCur(); return; }
  /* uren en minuten hebben hoogstens 2 cijfers; een los getal (bv. 120 minuten)
     mag langer zijn */
  var maxLen = two? 2 : 4;
  if(game[fld].length<maxLen) game[fld]+=k;
  /* Automatisch naar het minutenvak springen zodra het uur niet verder kan
     groeien: bij twee cijfers, of bij een eerste cijfer vanaf 3 (want er is
     geen uur dat met 3 t.e.m. 9 begint). Het kind hoeft dus niets te tikken. */
  if(two && game.active===0 && (game.typed.length===2 || +game.typed>=3)) game.active=1;
  syncCur();
}
function check(){
  var ex=game.cur;
  if(ex.vorm==="getal"){
    if(game.typed==="") return;
    submit(parseInt(game.typed,10)===parseInt(ex.answer,10), ex, game.typed);
    return;
  }
  if(game.typed==="" || game.typed2==="") return;
  var ok=parseInt(game.typed,10)===ex.hh && parseInt(game.typed2,10)===ex.mm;
  submit(ok, ex, game.typed+(ex.vorm==="duur"?" u ":":")+pad2(parseInt(game.typed2,10)||0));
}

/* ---------- klasmodus ---------- */
function classControls(ex, wrap){
  var hand=el("div","handprompt");
  hand.innerHTML='<span class="wave">🙋</span> Wie kan het zeggen?';
  wrap.appendChild(hand);
  var c=el("div","classctrls");
  var r=el("button","bigbtn bigbtn--rev","👀 Toon antwoord"); r.type="button";
  r.onclick=function(){ classReveal(ex); };
  var n=el("button","bigbtn bigbtn--next","Volgende →"); n.type="button";
  n.onclick=function(){ next(); };
  c.appendChild(r); c.appendChild(n); wrap.appendChild(c);
  wrap.appendChild(el("div","somcount", game.cfg.count>0? "Oefening "+game.i+" van "+game.cfg.count : "Oefening "+game.i));
}
function classReveal(ex){
  if(game.reveal) return; game.reveal=true; sGood();
  if(ex.vorm==="mc"||ex.vorm==="mcClock"){
    document.querySelectorAll(".choice,.clockopt").forEach(function(b){
      var v=b.dataset.v!=null? b.dataset.v : b.textContent;
      if(v===ex.answer) b.classList.add("good");
    });
  } else {
    var a=document.getElementById("tHH"), b=document.getElementById("tMM");
    if(ex.vorm==="getal"){ if(a){ a.textContent=ex.answer; a.classList.add("filled","reveal"); } }
    else { if(a){ a.textContent=String(ex.hh); a.classList.add("filled","reveal"); }
           if(b){ b.textContent=pad2(ex.mm); b.classList.add("filled","reveal"); } }
  }
}

/* ---------- antwoord ---------- */
var GOED=[["🎉","Goed zo!"],["⭐","Super!"],["👏","Knap!"],["💪","Sterk!"],["🌟","Prima!"],["🚀","Geweldig!"]];
function answerText(ex){
  if(ex.vorm==="getal") return ex.answer+(ex.eenheid? " "+ex.eenheid:"");
  if(ex.vorm==="duur") return duurWoorden(ex.hh*60+ex.mm);
  if(ex.vorm==="tijd") return ex.hh+":"+pad2(ex.mm);
  return ex.answer;
}
function submit(ok, ex, given, btn){
  if(game.locked) return; game.locked=true;
  clearTimer(); game.total++;
  game.log.push({ex:ex, ok:ok, given:given});
  if(ok){
    game.good++; game.stars++;
    $("#starCount").textContent=String(game.stars);
    if(btn) btn.classList.add("good");
    sGood(); splash(pick(GOED),null); confetti(26);
    setTimeout(next, 950);
  } else {
    if(btn) btn.classList.add("bad");
    document.querySelectorAll(".choice,.clockopt").forEach(function(b){
      var v=b.dataset.v!=null? b.dataset.v : b.textContent;
      if(v===ex.answer) b.classList.add("good");
    });
    var a=document.getElementById("tHH"), b2=document.getElementById("tMM");
    if(a && ex.vorm==="getal"){ a.textContent=ex.answer; a.classList.add("filled"); }
    else if(a){ a.textContent=String(ex.hh); a.classList.add("filled"); if(b2){ b2.textContent=pad2(ex.mm); b2.classList.add("filled"); } }
    sBad(); splash(["🤔","Bijna!"], "Juist is: "+answerText(ex));
    setTimeout(next, 2400);
  }
}
function miss(){
  if(!game||game.locked) return; game.locked=true;
  game.total++;
  game.log.push({ex:game.cur, ok:false, given:null, timeout:true});
  sBad(); splash(["⏰","De tijd is om!"], "Juist is: "+answerText(game.cur));
  setTimeout(next, 2400);
}
var spT=null;
function splash(pair,hint){
  var s=$("#splash"); if(!s) return;
  $("#splashEmo").textContent=pair[0]; $("#splashTxt").textContent=pair[1];
  $("#splashHint").textContent=hint||"";
  s.classList.add("show");
  if(spT) clearTimeout(spT);
  spT=setTimeout(function(){ s.classList.remove("show"); }, hint?2200:800);
}

/* ---------- einde ---------- */
function endGame(){
  clearTimer();
  $("#screenPlay").classList.add("hidden");
  var box=$("#resultsBox"); box.innerHTML="";
  var pct=game.total? Math.round(100*game.good/game.total):0;
  var medal=pct>=90?"🏆":pct>=70?"🥇":pct>=50?"🥈":"🥉";
  var titel=pct>=90?"Superkrak!":pct>=70?"Knap gedaan!":pct>=50?"Goed geoefend!":"Blijven oefenen!";
  function h(t,c,x){ var e=document.createElement(t); if(c)e.className=c; if(x!=null)e.textContent=x; return e; }
  box.appendChild(h("div","medal",medal));
  box.appendChild(h("h2",null,titel));
  box.appendChild(h("div","score",game.good+" van de "+game.total+" juist"));
  var bd=h("div","breakdown");
  [["★ "+game.stars,"sterren"],[String(game.total-game.good),"fout"],[pct+"%","juist"]].forEach(function(p){
    var d=h("div","bd"); d.appendChild(h("b",null,p[0])); d.appendChild(h("span",null,p[1])); bd.appendChild(d);
  });
  box.appendChild(bd);
  if(game.log.length){
    var rev=h("div","review");
    var head=h("h3",null,"Overzicht van je reeks");
    var nW=game.log.filter(function(e){return !e.ok;}).length;
    head.appendChild(h("span","review__count", nW? nW+" om te herhalen":"alles juist!"));
    rev.appendChild(head);
    game.log.forEach(function(e,i){
      var row=h("div","review__row"+(e.ok?"":" review__row--bad"));
      row.appendChild(h("span","review__ic"+(e.ok?" review__ic--good":" review__ic--bad"), e.ok?"✓":"✗"));
      var tx=h("span","review__tx");
      tx.appendChild(h("b",null,(i+1)+". "+reviewLabel(e.ex)));
      if(!e.ok){
        var sub=h("span","review__given");
        sub.textContent = e.timeout? "de tijd was om" : (e.given? "jouw antwoord: "+e.given : "geen antwoord");
        tx.appendChild(sub);
      }
      row.appendChild(tx);
      if(e.ex.clock){
        var mini=h("span","review__clock");
        mini.innerHTML=clockSVG(e.ex.clock.h,e.ex.clock.m,game.cfg.face,"clock--tiny");
        row.appendChild(mini);
      }
      rev.appendChild(row);
    });
    box.appendChild(rev);
  }
  var btns=h("div","results__btns");
  var again=h("button","btn btn--grass","🔁 Nog eens!"); again.type="button";
  again.onclick=function(){ $("#screenDone").classList.add("hidden"); startGame(game.cfg); };
  var stop=h("button","btn btn--ghost","Klaar"); stop.type="button";
  stop.onclick=function(){ $("#screenDone").classList.add("hidden"); onExit(); };
  btns.appendChild(again); btns.appendChild(stop); box.appendChild(btns);
  $("#screenDone").classList.remove("hidden");
  sDone(); confetti(120);
}
function reviewLabel(ex){
  if(ex.vorm==="tijd"||ex.vorm==="duur"||ex.vorm==="getal") return ex.prompt+"  →  "+answerText(ex);
  if(ex.vorm==="mcClock") return ex.prompt;
  if(ex.clock) return "Hoe laat? → "+ex.answer;
  return ex.prompt+"  →  "+ex.answer;
}

/* ---------- confetti ---------- */
var parts=[], raf=null;
function confetti(n){
  var c=document.getElementById("confetti"); if(!c) return;
  c.width=innerWidth; c.height=innerHeight;
  var cols=["#FFC233","#36A85B","#E5566B","#46B8E8","#7B5EA7"];
  for(var i=0;i<n;i++) parts.push({x:Math.random()*c.width,y:-20-Math.random()*80,
    vx:(Math.random()-.5)*2.4, vy:2+Math.random()*3.2, s:5+Math.random()*6,
    r:Math.random()*Math.PI, vr:(Math.random()-.5)*.25, col:cols[i%cols.length], life:130+Math.random()*60});
  if(!raf) loop();
}
function loop(){
  var c=document.getElementById("confetti"); if(!c){ raf=null; return; }
  var ctx=c.getContext("2d"); raf=requestAnimationFrame(loop);
  ctx.clearRect(0,0,c.width,c.height);
  parts=parts.filter(function(p){ return p.life>0 && p.y<c.height+30; });
  if(!parts.length){ cancelAnimationFrame(raf); raf=null; ctx.clearRect(0,0,c.width,c.height); return; }
  parts.forEach(function(p){
    p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.life--;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
    ctx.fillStyle=p.col; ctx.globalAlpha=Math.max(0,Math.min(1,p.life/60));
    ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s); ctx.restore();
  });
}

/* toetsenbord */
if(typeof document!=="undefined") document.addEventListener("keydown",function(e){
  if(!game || !$("#screenPlay") || $("#screenPlay").classList.contains("hidden")) return;
  if(game.locked) return;
  if(e.key>="0"&&e.key<="9") press(e.key);
  else if(e.key==="Backspace"){ e.preventDefault(); press("del"); }
  else if(e.key==="Enter"){ e.preventDefault(); press("ok"); }
  else if(e.key==="Tab" && twoFields()){ e.preventDefault(); game.active=game.active?0:1; syncCur(); }
});

/* ===================== EXPORT ===================== */
return {
  THEMES:THEMES, themesFor:themesFor, themeById:themeById,
  GRAAD_LABEL:GRAAD_LABEL, FACE_LABEL:FACE_LABEL,
  defaults:defaults, makeSettings:makeSettings,
  buildHash:buildHash, parseParams:parseParams, buildSet:buildSet,
  clockSVG:clockSVG, absWords:absWords, relWords:relWords, digitalStr:digitalStr,
  startGame:startGame, setOnExit:setOnExit, toggleSound:toggleSound, resumeAudio:resumeAudio
};
})();
if(typeof module!=="undefined" && module.exports) module.exports=KK;
