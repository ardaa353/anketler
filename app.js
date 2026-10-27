/* SADECE STATİK GITHUB PAGES: Yalnızca bu tarayıcıdaki demo yönetici verisi.
   Sunucu olmadığı için güvenli kimlik denetimi ve merkezi yanıt toplama YOKTUR. */
(() => {
  'use strict';
  const T = {
    text:'Kısa yanıt',textarea:'Paragraf',email:'E-posta',number:'Sayı',tel:'Telefon',url:'Web adresi',
    date:'Tarih',time:'Saat','datetime-local':'Tarih ve saat',radio:'Tek seçim',checkbox:'Çoklu seçim',
    select:'Açılır liste',yesno:'Evet / Hayır',scale:'Doğrusal ölçek',slider:'Kaydırıcı',rating:'Yıldız puanlama',
    likert:'Likert ölçeği',ranking:'Sıralama',matrix:'Tek seçimli matris',
    'matrix-multi':'Çok seçimli matris',file:'Dosya adı (dosya aktarılmaz)'
  };
  const OPTIONS_TYPES = new Set(['radio','checkbox','select','likert','ranking','matrix','matrix-multi']);
  const MATRIX_TYPES = new Set(['matrix','matrix-multi']);
  const NUM_TYPES = new Set(['scale','slider','rating']);
  const root = document.getElementById('admin-root');
  const esc = v=>escapeHTML(String(v??''));
  // On local file:// previews randomUUID may be unavailable (insecure context).
  const clientUUID=()=>{if(crypto.randomUUID)return crypto.randomUUID();const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');};
  const config=window.APP_CONFIG||{};
  const bridgeActive=()=>!!(window.IdealBridge && window.IdealBridge.endpoint());
  const publicKeyStorage='idealhukuk_public_key_v3';
  let readSecret='';
  const state={token:sessionStorage.getItem('ideal_admin_token')||'',mode:'login',surveys:[],editor:null,activeQ:0,
      messages:null,responses:[],responsesTotal:0,responsesOffset:0,responseSurvey:'',surveyId:'',preview:false,archivePage:0};
  window.APP_STATE=state;
  // GitHub Pages yalnızca statik dosya sunar. Şifre koruması yalnızca bu cihazda bir DEMO kilididir.
  // HASH bile sitenin JavaScript kaynak kodundan okunabilir; gerçek yönetici yetkilendirmesi DEĞİLDİR.
  const STATIC_DB_KEY='idealhukuk_static_admin_v2';
  const PUBLIC_RECORDS_KEY='idealhukuk_local_answers_v2';
  const PUBLIC_EVENTS_KEY='idealhukuk_local_events_v2';
  const credentialHash='c75cc89e';
  const hashDemo=v=>{let h=2166136261;for(const ch of String(v)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')};
  function parseLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
  function dbRead(){const db=parseLocal(STATIC_DB_KEY,{surveys:[]});return db&&Array.isArray(db.surveys)?db:{surveys:[]}}
  function dbSave(db){try{localStorage.setItem(STATIC_DB_KEY,JSON.stringify(db))}catch(e){throw Error('Tarayıcı depolama alanı doldu. Önce özel yedeğinizi indirin.')};return db}
  const safeId=()=>clientUUID().replace(/-/g,'');
  const responseRead=()=>parseLocal(PUBLIC_RECORDS_KEY,[]);
  const eventRead=()=>parseLocal(PUBLIC_EVENTS_KEY,[]);
  const eventSave=e=>{try{const events=eventRead();events.push(e);localStorage.setItem(PUBLIC_EVENTS_KEY,JSON.stringify(events.slice(-12000)))}catch{}};
  const deviceInfo=()=>{
    const ua=navigator.userAgent||'',platform=/android/i.test(ua)?'Android':/iphone|ipad|ipod/i.test(ua)?'iOS':/windows/i.test(ua)?'Windows':/macintosh/i.test(ua)?'macOS':/linux/i.test(ua)?'Linux':'Diğer';
    const browser=/edg\//i.test(ua)?'Edge':/firefox/i.test(ua)?'Firefox':/chrome|crios/i.test(ua)?'Chrome':/safari/i.test(ua)?'Safari':'Diğer';
    return {device:innerWidth<680?'Telefon':innerWidth<1024?'Tablet':'Masaüstü',platform,browser};
  };
  const publicLink=id=>{
    const origin=location.protocol==='file:'?'https://KULLANICI.github.io/DEPO/':location.href.split('#')[0].split('?')[0];
    return origin+'?s='+encodeURIComponent(id);
  };
  function activeList(){return dbRead().surveys.filter(s=>s.status==='published').sort((a,b)=>Date.parse(a.publishedAt||0)-Date.parse(b.publishedAt||0))}
  function capPublished(db){const active=db.surveys.filter(s=>s.status==='published').sort((a,b)=>Date.parse(a.publishedAt||0)-Date.parse(b.publishedAt||0));
    while(active.length>10){const old=active.shift();old.status='closed';old.archivedAt=new Date().toISOString();}
  }
  function publishedJS(){const active=activeList().map(({id,title,description,questions,settings,publishedAt})=>({id,title,description,questions,settings,publishedAt}));
    return '/* İdeal Hukuk Kulübü — Aktif anketler. Yalnızca halka açık anketler bulunur. */\nwindow.PUBLISHED_SURVEYS = '+JSON.stringify({version:3,surveys:active,publicKey:parseLocal(publicKeyStorage,null)})+';\n';
  }
  function downloadText(contents,filename,mime='application/json'){const blob=new Blob([contents],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const serialize=v=>typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'');
  const publishedRecords=()=>Array.isArray(window.PUBLISHED_SURVEYS?.surveys)?window.PUBLISHED_SURVEYS.surveys:[];
  async function api(path, opts={}){
    let db=dbRead(), method=opts.method||'GET', body={};
    if(typeof opts.body==='string'){try{body=JSON.parse(opts.body)}catch{}}
    if(path==='/admin/login'){
      if(body.username!=='idealhukukklb'||hashDemo(body.password)!==credentialHash)throw Error('Kullanıcı adı veya şifre yanlış.');
      return {token:'DEMO_SESSION_ONLY'};
    }
    if(path==='/admin/me'){
      if(!state.token)throw Error('Oturum açın.');return {ok:true};
    }
    if(path==='/admin/surveys'&&method==='GET')return {surveys:db.surveys.map(s=>({...s,responseCount:responseRead().filter(r=>r.surveyId===s.id).length})).sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0))};
    if(path==='/admin/surveys'&&method==='POST'){
      const now=new Date().toISOString();const s={...body,id:safeId(),createdAt:now,updatedAt:now};
      if(s.status==='published')s.publishedAt=now;
      db.surveys.push(s);capPublished(db);dbSave(db);return {survey:s};
    }
    const sm=path.match(/^\/admin\/surveys\/([a-zA-Z0-9_-]+)$/);
    if(sm){const s=db.surveys.find(s=>s.id===sm[1]);if(!s)throw Error('Anket bulunamadı.');
      if(method==='DELETE'){db.surveys=db.surveys.filter(x=>x.id!==s.id);dbSave(db);return {ok:true};}
      if(method==='PUT'){
        const was=s.status;Object.assign(s,body);s.updatedAt=new Date().toISOString();
        if(s.status==='published'&&was!=='published')s.publishedAt=new Date().toISOString();
        if(s.status==='published'&&!s.publishedAt)s.publishedAt=new Date().toISOString();
        capPublished(db);dbSave(db);return {survey:s};
      }
    }
    const rm=path.match(/^\/admin\/surveys\/([a-zA-Z0-9_-]+)\/responses(?:\?offset=(\d+))?$/);
    if(rm){const rows=responseRead().filter(r=>r.surveyId===rm[1]).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));return {responses:rows.slice(+(rm[2]||0),+(rm[2]||0)+100),total:rows.length};}
    const ex=path.match(/^\/admin\/surveys\/([a-zA-Z0-9_-]+)\/export$/);
    if(ex){const s=db.surveys.find(s=>s.id===ex[1]);if(!s)throw Error('Anket bulunamadı.');const rows=responseRead().filter(r=>r.surveyId===s.id),cols=['Kimlik','Tarih','Cihaz','İşletim sistemi','Tarayıcı',...s.questions.map(q=>q.text||q.title)];
      const csvText='\ufeff'+cols.map(csv).join(',')+'\n'+rows.map(r=>[r.id,r.createdAt,r.meta?.device,r.meta?.platform,r.meta?.browser,...s.questions.map(q=>serialize(r.answers?.[q.id]))].map(csv).join(',')).join('\n');
      return new Response(csvText,{headers:{'Content-Type':'text/csv;charset=utf-8'}});
    }
    const pub=path.match(/^\/public\/surveys\/([a-zA-Z0-9_-]+)$/);
    if(pub){const s=publishedRecords().find(s=>s.id===pub[1]);if(!s)throw Error('Bu bağlantı yayında değil veya henüz GitHub’a yeni anketler dosyası yüklenmemiş.');return {survey:s};}
    const submit=path.match(/^\/public\/surveys\/([a-zA-Z0-9_-]+)\/responses$/);
    if(submit){if(state.preview)return {ok:true,preview:true};
      const s=publishedRecords().find(s=>s.id===submit[1]);if(!s)throw Error('Anket artık yayında değil.');
      const row={id:safeId(),surveyId:s.id,createdAt:new Date().toISOString(),answers:body.answers||{},meta:deviceInfo()};
      const rows=responseRead();rows.push(row);
      try{localStorage.setItem(PUBLIC_RECORDS_KEY,JSON.stringify(rows))}catch{throw Error('Tarayıcıda kayıt alanı dolu. Yanıtınız saklanamadı.');}
      window.LAST_LOCAL_RECORD=row;
      eventSave({surveyId:s.id,type:'submit',at:row.createdAt,meta:row.meta});return {ok:true,localOnly:true};
    }
    throw Error('Bu işlem salt GitHub Pages modunda desteklenmiyor.');
  }
  window.publicApi=(path,opts={})=>api(path,opts);
  window.submitSurveyAnswer=()=>{
    if(state.preview)return Promise.resolve({ok:true,preview:true});
    if(bridgeActive())return window.IdealBridge.submitEncrypted(state.surveyId,formAnswers);
    return api('/public/surveys/'+encodeURIComponent(state.surveyId)+'/responses',{method:'POST',body:JSON.stringify({answers:formAnswers})});
  };
  const adminApi=(path,opts={})=>api(path,{...opts,admin:true});
  window.recordLocalSurveyView=(step)=>{if(!state.surveyId||state.preview)return;eventSave({surveyId:state.surveyId,type:step<0?'view':'step',step,at:new Date().toISOString(),meta:deviceInfo()});};
  window.downloadLastLocalResponse=()=>{if(!window.LAST_LOCAL_RECORD)return;downloadText(JSON.stringify({format:'idealhukuk-response',version:1,response:window.LAST_LOCAL_RECORD},null,2),'anket-yanitim-'+window.LAST_LOCAL_RECORD.id.slice(0,8)+'.json')};
  function chartFor(s){
    const rows=responseRead().filter(r=>r.surveyId===s.id),events=eventRead().filter(e=>e.surveyId===s.id),views=events.filter(e=>e.type==='view').length;
    const submissions=rows.length,completion=views?Math.min(100,Math.round(submissions/views*100)):0;
    const cat=s.questions.find(q=>['radio','select','yesno','rating','scale','likert','checkbox'].includes(q.type));
    const counts={};if(cat)for(const r of rows){const a=r.answers?.[cat.id];for(const v of Array.isArray(a)?a:[a])if(v!=null&&v!==''){const k=String(v);counts[k]=(counts[k]||0)+1;}}
    const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8),total=entries.reduce((v,x)=>v+x[1],0)||1;
    const colors=['#00e5ff','#8959ff','#ef68e1','#3fcfb3','#feb769','#779cff','#ff6384','#c2fb95'];
    let pieOffset=0;const pie=entries.map(([label,value],i)=>{const dash=value/total*100;const circle=`<circle cx="64" cy="64" r="43" fill="none" stroke="${colors[i]}" stroke-width="23" stroke-dasharray="${dash} ${100-dash}" stroke-dashoffset="${-pieOffset}" pathLength="100" transform="rotate(-90 64 64)"/>`;pieOffset+=dash;return circle;}).join('');
    const bars=entries.map(([label,value],i)=>`<div class="chart-line"><div>${esc(label)} <strong>${value}</strong></div><div class="chart-track"><i style="width:${100*value/Math.max(1,entries[0]?.[1]||1)}%;background:${colors[i]}"></i></div></div>`).join('');
    const devices={};for(const r of rows){const device=[r.meta?.platform||'Bilinmiyor',r.meta?.browser||''].filter(Boolean).join(' / ');devices[device]=(devices[device]||0)+1;}
    const texts=s.questions.filter(q=>['text','textarea','email'].includes(q.type));
    const duplicates=texts.map(q=>{const freq={};for(const r of rows){const v=String(r.answers?.[q.id]||'').trim();if(v)freq[v]=(freq[v]||0)+1;}
      const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3);return top.length?`<div class="ad-stat-block"><b>${esc(q.text)}</b>${top.map(([a,n])=>`<p>${esc(a.slice(0,100))} <strong>×${n}</strong></p>`).join('')}</div>`:'';}).join('');
    const dateGroups={};for(const r of rows){const day=String(r.createdAt||'').slice(0,10);dateGroups[day]=(dateGroups[day]||0)+1;}
    const timeline=Object.entries(dateGroups).sort((a,b)=>a[0].localeCompare(b[0])).slice(-10).map(([day,n])=>`<div class="chart-line"><div>${esc(day)} <strong>${n}</strong></div><div class="chart-track"><i style="width:${100*n/Math.max(...Object.values(dateGroups),1)}%"></i></div></div>`).join('');
    return `<section class="ad-analytics"><div class="metric-row"><article><small>Bu tarayıcıdaki görüntülemeler</small><b>${views}</b></article><article><small>Bu tarayıcıdaki yanıtlar</small><b>${submissions}</b></article><article><small>Örnek tamamlama oranı</small><b>%${completion}</b></article></div>
      <div class="chart-grid"><div class="chart-card"><h3>Seçenek dağılımı</h3>${cat?`<p>${esc(cat.text)}</p><div class="pie-layout"><svg width="155" height="155" viewBox="0 0 128 128" aria-label="Yanıt pasta grafiği">${pie||'<circle cx="64" cy="64" r="43" fill="none" stroke="#374454" stroke-width="23"/>'}</svg><div class="pie-legend">${entries.map(([l,n],i)=>`<p><i style="background:${colors[i]}"></i>${esc(l)}: ${n}</p>`).join('')}</div></div>`:'<p>Seçenekli soru yok.</p>'}${bars}</div>
      <div class="chart-card"><h3>Yanıtların zaman dağılımı</h3>${timeline||'<p>Henüz veri yok.</p>'}<div class="ad-divider"></div><h3>Cihaz / tarayıcı</h3>${Object.entries(devices).map(([d,n])=>`<p>${esc(d)}: <strong>${n}</strong></p>`).join('')||'<p>Henüz veri yok.</p>'}</div></div>
      ${texts.length?`<div class="chart-card"><h3>En sık tekrarlanan yazılı yanıtlar</h3>${duplicates||'<p>Henüz yazılı yanıt yok.</p>'}</div>`:''}
      <p class="ad-small">Bu grafikler yalnızca bu tarayıcıda kaydedilen veya elle içe aktarılan kayıtlardan oluşur. Gerçek trafik ölçümü veya kişilerin kimliğini saptama değildir.</p></section>`;
  }
  function exportPrivateBackup(){downloadText(JSON.stringify({format:'idealhukuk-private-backup',version:2,createdAt:new Date().toISOString(),surveys:dbRead().surveys,responses:responseRead(),events:eventRead()},null,2),'idealhukuk-OZEL-yedek-'+new Date().toISOString().slice(0,10)+'.json');}
  async function importFiles(files){const results={surveys:0,responses:0};const arr=Array.from(files||[]);
    for(const f of arr){if(f.size>15*1024*1024)throw Error('İçeri aktarılan dosya 15MB sınırını aşıyor.');
      const d=JSON.parse(await f.text());
      if(d.format==='idealhukuk-response'&&d.response){const rows=responseRead();if(!rows.some(r=>r.id===d.response.id)){rows.push(d.response);localStorage.setItem(PUBLIC_RECORDS_KEY,JSON.stringify(rows));results.responses++;}}
      else if(d.format==='idealhukuk-private-backup'&&Array.isArray(d.surveys)){const db=dbRead();for(const s of d.surveys){if(!s||typeof s.id!=='string'||!Array.isArray(s.questions))continue;const ind=db.surveys.findIndex(x=>x.id===s.id);if(ind>=0)db.surveys[ind]=s;else db.surveys.push(s);results.surveys++;}
        capPublished(db);dbSave(db);const rows=responseRead();for(const r of (Array.isArray(d.responses)?d.responses:[])){if(r?.id&&!rows.some(x=>x.id===r.id)){rows.push(r);results.responses++;}}localStorage.setItem(PUBLIC_RECORDS_KEY,JSON.stringify(rows));}
      else throw Error('Desteklenmeyen dosya. Yalnızca bu panelin özel yedekleri veya yanıt JSON dosyaları yüklenebilir.');
    }
    return results;
  }
  function sceneDust(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const targets=[...root.querySelectorAll('.ad-panel,.ad-survey-card,.ad-brand,.ad-nav button')];if(!targets.length)return;
    const canvas=document.getElementById('admin-dust');if(!canvas)return;
    const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,1.4);canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.display='block';
    const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);const points=[];
    for(const el of targets){const r=el.getBoundingClientRect();if(r.bottom<0||r.top>h||r.width<2)continue;
      const perimeter=2*(r.width+r.height),samples=Math.min(650,Math.floor(perimeter/3));
      for(let i=0;i<samples;i++){const d=i/samples*perimeter;let tx,ty;if(d<r.width){tx=r.left+d;ty=r.top}else if(d<r.width+r.height){tx=r.right;ty=r.top+d-r.width}else if(d<r.width*2+r.height){tx=r.right-(d-r.width-r.height);ty=r.bottom}else{tx=r.left;ty=r.bottom-(d-r.width*2-r.height)}points.push({tx,ty});}
    }
    const reduced=points.length>2400?points.filter((_,i)=>i%Math.ceil(points.length/2400)===0):points;
    const data=reduced.map(p=>({...p,x:p.tx+(Math.random()-.5)*Math.min(w,700),y:p.ty+(Math.random()-.5)*Math.min(h,600),phase:Math.random()*6.3}));
    const start=performance.now();let run=++sceneDust.run;
    function frame(t){if(run!==sceneDust.run)return;const f=Math.min(1,(t-start)/800),ease=1-(1-f)**3;c.clearRect(0,0,w,h);
      for(const p of data){c.globalAlpha=Math.min(1,f*3)*(1-f*.22);c.fillStyle=Math.sin(p.phase+t*.01)>0?'#00e5ff':'#9870ff';c.fillRect(p.x+(p.tx-p.x)*ease,p.y+(p.ty-p.y)*ease,.8,.8)}
      c.globalAlpha=1;if(f<1)requestAnimationFrame(frame);else{c.clearRect(0,0,w,h);canvas.style.display='none';}
    }requestAnimationFrame(frame);
  }
  sceneDust.run=0;
  function newQuestion(type='text'){
    return {id:'q_'+clientUUID().replace(/-/g,'').slice(0,12),type,title:'SORU',text:'Yeni soru başlığı',
      required:false,help:'',placeholder:'',allowOther:false,options:['Seçenek 1','Seçenek 2','Seçenek 3'],rows:['Satır 1','Satır 2'],
      min:type==='rating'?1:1,max:5,step:1,minSelect:0,maxSelect:0};
  }
  function newSurvey(){return {title:'Yeni Anket',description:'',status:'draft',questions:[newQuestion()],settings:{requireConsent:bridgeActive(),privacyNotice:'Cevaplarınızın ve tarayıcı/cihaz türü gibi teknik bilgilerin anket amacıyla işlenmesini kabul ediyorum. Yönetici tarafından erişim sağlanabilir.',thankYou:'Katılımınız için teşekkür ederiz.'}};}
  function stamp(s){try{return new Date(s).toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'});}catch{return String(s||'');}}
  function notification(success,message){state.messages={success,message};}
  function notice(){if(!state.messages)return '';let m=state.messages;return `<div class="${m.success?'ad-ok':'ad-error'}" role="status">${esc(m.message)}</div>`;}
  function layout(content){
    root.innerHTML=`<div class="ad-layout"><header class="ad-header"><div class="ad-brand"><img src="logo.png" alt="İdeal Hukuk Kulübü">
      <div><h1>İdeal Hukuk Kulübü</h1><div class="ad-muted">GitHub Pages · Anket yönetimi</div></div></div>
      <div class="ad-row"><span class="ad-chip">YEREL YÖNETİM</span><button class="ad-btn-ghost" data-act="logout">Çıkış yap</button></div></header>
      <nav class="ad-nav" aria-label="Yönetim menüsü">
      <button data-act="home" class="${state.mode==='home'?'active':''}">Anketlerim</button>
      <button data-act="new" class="${state.mode==='edit'?'active':''}">Anket oluştur</button>
      <button data-act="answers" class="${state.mode==='answers'?'active':''}">Yanıtlar</button>
      <button data-act="drive" class="${state.mode==='drive'?'active':''}">Drive senkronizasyonu</button></nav>
      <div class="ad-warning"><strong>Önemli:</strong> GitHub Pages üzerinde yönetici girişi demo kilididir, güvenli yetkilendirme değildir. Anket tanımları cihazınızda; yayınlamak için <b>surveys-data.js</b> dosyasını GitHub'a yükleyin. ${bridgeActive()?'Şifreli yanıtlar Drive bağlantısına gönderilebilir; görüntülemek için özel anahtar ve senkronizasyon gerekir.':'Drive bağlantısı kapalıdır; yanıtlar sadece yanıtlayanın tarayıcısında kalır.'}</div>${notice()}${content}</div>`;
  }
  function render(){
    if(state.mode==='login')renderLogin();
    if(state.mode==='home')renderHome();
    if(state.mode==='edit')renderEditor();
    if(state.mode==='answers')renderResponses();
    if(state.mode==='drive')renderBridge();
    requestAnimationFrame(sceneDust);
  }
  function renderLogin(){
    root.innerHTML=`<main class="ad-login-wrap"><section class="ad-panel ad-login"><img src="logo.png" alt="EBYÜ İdeal Hukuk Kulübü">
      <h1>Yönetici Girişi</h1><p>İdeal Hukuk Kulübü anket yönetim paneli</p>
      <form id="login-form"><label class="ad-field"><span>Kullanıcı adı</span><input class="ad-input" name="username" autocomplete="username" required></label>
      <label class="ad-field"><span>Şifre</span><input class="ad-input" name="password" type="password" autocomplete="current-password" required></label>
      ${notice()}<button class="ad-btn" style="width:100%;margin-top:12px" type="submit">Giriş Yap</button></form>
      <p class="ad-small">Bu giriş yalnızca arayüz demosu için bir kilittir. JavaScript tarayıcıda çalıştığından gerçek parola koruması sağlamaz. Kişisel veriler için kullanmayın.</p></section></main>`;
  }
  function surveyCard(s){
    return `<article class="ad-survey-card">
      <div class="ad-row" style="justify-content:space-between"><span class="ad-chip ${s.status==='published'?'ad-live':''}">${s.status==='published'?'● Aktif':s.status==='closed'?'◌ Arşiv':'○ Taslak'}</span><span class="ad-small">${stamp(s.updatedAt)}</span></div>
      <h3 style="margin-top:16px">${esc(s.title)}</h3><div class="ad-kpi">${Number(s.responseCount)||0}</div><div class="ad-stat">Bu cihazda kayıtlı yanıt · ${s.questions.length} soru</div>
      <div class="ad-row" style="margin-top:17px"><button class="ad-btn-ghost" data-act="edit" data-id="${esc(s.id)}">Düzenle</button>
        <button class="ad-btn-ghost" data-act="open-responses" data-id="${esc(s.id)}">Yanıtlar / Grafikler</button>
        ${s.status==='published'?`<button class="ad-btn-warn" data-act="close" data-id="${esc(s.id)}">Durdur</button>`:`<button class="ad-btn-ghost" data-act="republish" data-id="${esc(s.id)}">${s.status==='closed'?'Yeniden':'İlk kez'} yayınla</button>`}</div>
      ${s.status==='published'?`<div class="ad-link" style="margin-top:12px"><code>${esc(publicLink(s.id))}</code><button class="ad-btn-ghost" data-act="copy" data-id="${esc(s.id)}">Kopyala</button></div>`:''}
      </article>`;
  }
  function renderHome(){
    const actives=state.surveys.filter(s=>s.status==='published').sort((a,b)=>Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0));
    const archived=state.surveys.filter(s=>s.status!=='published').sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));
    const pages=Math.max(1,Math.ceil(archived.length/10));state.archivePage=Math.max(0,Math.min(state.archivePage,pages-1));
    layout(`<section class="ad-panel"><div class="ad-row" style="justify-content:space-between"><div><h2>Aktif Anketler</h2><p class="ad-muted">Her zaman en fazla 10 aktif anket. 11. yayınlama en eski aktif olanı arşivler.</p></div><button class="ad-btn" data-act="new">+ Yeni anket</button></div>
      <div class="ad-action-strip"><div><strong>${actives.length} / 10 aktif</strong><p>Değişikliklerden sonra <code>surveys-data.js</code> indirilip GitHub'a yüklenmelidir. Aksi halde linkler güncellenmez.</p></div>
        <div class="ad-row"><button class="ad-btn" data-act="export-published"><span>↓</span> GitHub yayın dosyasını indir</button><button class="ad-btn-ghost" data-act="backup">Özel yedek indir</button><button class="ad-btn-ghost" data-act="import">Yedek / yanıt yükle</button></div>
        <input id="admin-import" type="file" hidden multiple accept=".json,application/json"></div>
      <div class="ad-grid">${actives.map(surveyCard).join('')||'<div class="ad-empty">Henüz aktif anket yok.</div>'}</div></section>
      <section class="ad-panel" style="margin-top:22px"><div class="ad-row" style="justify-content:space-between"><div><h2>Arşiv ve Taslaklar</h2><p class="ad-muted">10'lu sayfalara ayrılır. Eski anketi yeniden yayınlamak onu listenin sonuna ekler; en eski aktif anket kapanır.</p></div><span class="ad-chip">${archived.length} anket</span></div>
      <div class="ad-grid">${archived.slice(state.archivePage*10,(state.archivePage+1)*10).map(surveyCard).join('')||'<div class="ad-empty">Arşiv boş.</div>'}</div>
      <div class="ad-row" style="justify-content:space-between;margin-top:20px"><button class="ad-btn-ghost" data-act="archive-prev" ${state.archivePage===0?'disabled':''}>← Önceki 10</button><span class="ad-muted">Sayfa ${state.archivePage+1} / ${pages}</span><button class="ad-btn-ghost" data-act="archive-next" ${state.archivePage>=pages-1?'disabled':''}>Sonraki 10 →</button></div></section>`);
  }
  const field=(title,key,value,tag='input',extra='')=>`<label class="ad-field"><span>${title}</span>${tag==='textarea'?`<textarea class="ad-textarea" data-bind="${key}" ${extra}>${esc(value)}</textarea>`:
    `<input class="ad-input" data-bind="${key}" value="${esc(value)}" ${extra}>`}</label>`;
  function questionEditor(q){
    const typeOptions=Object.entries(T).map(([key,label])=>`<option value="${key}" ${q.type===key?'selected':''}>${esc(label)}</option>`).join('');
    const optInputs=OPTIONS_TYPES.has(q.type)?`
        <label class="ad-field"><span>Seçenekler (her satıra bir seçenek)</span><textarea class="ad-textarea" rows="6" data-qfield="options">${esc((q.options||[]).join('\n'))}</textarea></label>`:'';
    const matrixRows=MATRIX_TYPES.has(q.type)?`<label class="ad-field"><span>Matris satırları (her satıra bir ifade)</span><textarea class="ad-textarea" rows="4" data-qfield="rows">${esc((q.rows||[]).join('\n'))}</textarea></label>`:'';
    const numInputs=NUM_TYPES.has(q.type)?`<div class="ad-columns">${qField('En küçük değer','min',q.min,'number')}${qField('En büyük değer','max',q.max,'number')}</div>${q.type==='slider'?qField('Artış miktarı','step',q.step,'number'):''}`:'';
    const checkLimits=q.type==='checkbox'?`<div class="ad-columns">${qField('En az seçim (0: sınırsız)','minSelect',q.minSelect,'number')}${qField('En fazla seçim (0: sınırsız)','maxSelect',q.maxSelect,'number')}</div>`:'';
    const other= ['radio','checkbox','select','likert'].includes(q.type)?`<label class="ad-checkbox"><input type="checkbox" data-qfield="allowOther" ${q.allowOther?'checked':''}> Diğer seçeneğine izin ver</label>`:'';
    return `<div class="ad-panel"><div class="ad-row" style="justify-content:space-between"><h3>Seçilen soru</h3><span class="ad-chip">${esc(T[q.type])}</span></div>
       <div class="ad-columns">${qField('Soru türü','type',q.type,'select',typeOptions)}${qField('Üst başlık','title',q.title)}</div>
       ${qField('Soru metni','text',q.text,'textarea')}${qField('Yardım metni','help',q.help,'textarea')}
       ${qField('İpucu / placeholder','placeholder',q.placeholder)}
       <label class="ad-checkbox"><input type="checkbox" data-qfield="required" ${q.required?'checked':''}> Bu soru zorunlu olsun <span style="color:#ff9eaf">*</span></label>
       ${optInputs}${matrixRows}${numInputs}${checkLimits}${other}
       <div class="ad-divider"></div><div class="ad-row" style="justify-content:space-between">
         <div class="ad-row"><button class="ad-btn-ghost" data-act="move-q-up">↑ Yukarı</button><button class="ad-btn-ghost" data-act="move-q-down">↓ Aşağı</button>
         <button class="ad-btn-ghost" data-act="duplicate-q">Çoğalt</button></div><button class="ad-btn-warn" data-act="delete-q">Soruyu sil</button></div>
       </div>`;
  }
  function qField(title,key,value,type='text',opt=''){
    const control=type==='textarea'?`<textarea class="ad-textarea" data-qfield="${key}" rows="3">${esc(value)}</textarea>`:
      type==='select'?`<select class="ad-select" data-qfield="${key}">${opt}</select>`:
      `<input class="ad-input" type="${type}" data-qfield="${key}" value="${esc(value)}">`;
    return `<label class="ad-field"><span>${title}</span>${control}</label>`;
  }
  function renderEditor(){
    const s=state.editor;if(!s){state.mode='home';return render();}
    const q=s.questions[Math.max(0,Math.min(state.activeQ,s.questions.length-1))];
    layout(`<section class="ad-panel"><div class="ad-row" style="justify-content:space-between"><div><h2>${s.id?'Anketi Düzenle':'Anket Oluştur'}</h2><p class="ad-muted">Soruları ekleyin, düzenleyin, önizleyin ve ardından yayınlayın.</p></div><span class="ad-chip">${s.status==='published'?'Yayında':s.status==='closed'?'Kapalı':'Taslak'}</span></div>
      <div class="ad-columns" style="margin-top:15px">${field('Anket başlığı','title',s.title)}
      <label class="ad-field"><span>Yayın durumu</span><select class="ad-select" data-bind="status"><option value="draft" ${s.status==='draft'?'selected':''}>Taslak</option><option value="published" ${s.status==='published'?'selected':''}>Yayında</option><option value="closed" ${s.status==='closed'?'selected':''}>Kapalı</option></select></label></div>
      ${field('Anket açıklaması (isteğe bağlı)','description',s.description,'textarea')}
      ${s.id&&s.status==='published'?`<div class="ad-link"><code>${esc(publicLink(s.id))}</code><button class="ad-btn-ghost" data-act="copy" data-id="${esc(s.id)}">Linki kopyala</button></div>`:''}
    </section>
    <div class="ad-editor" style="margin-top:18px"><div class="ad-panel"><div class="ad-row" style="justify-content:space-between"><h3>Sorular (${s.questions.length})</h3><button class="ad-btn-ghost" data-act="add-q">+ Ekle</button></div>
      ${s.questions.map((x,i)=>`<button type="button" data-act="select-q" data-index="${i}" class="ad-question-tab ${i===state.activeQ?'selected':''}"><span class="ad-qno">${i+1}</span><span class="ad-qtext">${esc(x.text||x.title)}</span><small>${x.required?'* ':''}${esc(T[x.type]||x.type)}</small></button>`).join('')}
      <p class="ad-small">Sorular sürüklemeden ↑ ↓ tuşlarıyla sıralanabilir. + Ekle ile 21 farklı soru türü kullanabilirsiniz.</p></div>${questionEditor(q)}</div>
    <section class="ad-panel" style="margin-top:20px"><h3>Anket Ayarları</h3>
      <label class="ad-checkbox"><input type="checkbox" data-setting="requireConsent" ${s.settings.requireConsent?'checked':''}> Yanıt göndermeden önce aydınlatma/onay kutusu göster</label>
      <label class="ad-field"><span>Aydınlatma ve gizlilik metni</span><textarea class="ad-textarea" data-setting="privacyNotice">${esc(s.settings.privacyNotice||'')}</textarea></label>
      ${field('Teşekkür / başarı ekranı açıklaması','thankYou',s.settings.thankYou||'')}
      <div class="ad-actions-sticky"><div class="ad-row"><button class="ad-btn-ghost" data-act="preview">👁 Önizle</button><button class="ad-btn-ghost" data-act="save">Kaydet</button></div>
      <div class="ad-row"><button class="ad-btn" data-act="publish">10’lu döngüye yayınla</button>${s.id?'<button class="ad-btn-warn" data-act="delete-survey">Anketi Sil</button>':''}</div></div>
      <p class="ad-small">Önizleme kayıt oluşturmaz. Yayın bağlantısı, en güncel surveys-data.js GitHub’a yüklendikten sonra çalışır. En eski 11. aktif anket yerine arşive alınır. Soru silmek eski yanıtları silmez fakat raporlamayı etkileyebilir.</p>
    </section>`);
  }
  function answerCell(q,val){
    if(val==null||val===''||Array.isArray(val)&&!val.length)return '<span class="ad-muted">—</span>';
    if(q.type==='file')return esc(val)+' (dosya içeriği yok)';
    if(Array.isArray(val))return esc(val.join(' → '));
    if(typeof val==='object')return Object.entries(val).map(([k,v])=>`<div><b>${esc(k)}:</b> ${esc(Array.isArray(v)?v.join(', '):v)}</div>`).join('');
    return esc(val);
  }
  function renderResponses(){
    const selected=state.surveys.find(s=>s.id===state.responseSurvey);
    const options=state.surveys.map(s=>`<option value="${esc(s.id)}" ${s.id===state.responseSurvey?'selected':''}>${esc(s.title)} (${s.responseCount||0} yanıt)</option>`).join('');
    let main='';
    if(selected){
      main=`<div class="ad-row" style="justify-content:space-between;margin:20px 0"><div><h3>${esc(selected.title)}</h3><div class="ad-muted">Bu tarayıcıdaki / manuel içe aktarılan ${state.responsesTotal} yanıt · En yeni üstte</div></div>
        <button class="ad-btn" data-act="export">CSV / Excel indir</button></div>
      <div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Yanıt ID</th><th>Tarih</th><th>Cihaz</th>${selected.questions.map(q=>`<th>${esc(q.text||q.title)}</th>`).join('')}</tr></thead>
        <tbody>${state.responses.map(r=>`<tr><td title="${esc(r.id)}">${esc(r.id.slice(0,8))}…</td><td>${stamp(r.createdAt)}</td><td>${esc([r.meta?.device,r.meta?.platform,r.meta?.browser].filter(Boolean).join(' / ')||'—')}</td>${selected.questions.map(q=>`<td>${answerCell(q,r.answers[q.id])}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${selected.questions.length+3}" class="ad-empty">Bu anket için henüz yanıt yok.</td></tr>`}</tbody></table></div>
      <div class="ad-row" style="justify-content:space-between;margin-top:20px"><span class="ad-muted">${Math.min(state.responsesTotal,state.responsesOffset+1)}–${Math.min(state.responsesTotal,state.responsesOffset+state.responses.length)} / ${state.responsesTotal}</span>
      <div class="ad-row"><button class="ad-btn-ghost" data-act="prev-page" ${state.responsesOffset===0?'disabled':''}>← Önceki</button><button class="ad-btn-ghost" data-act="next-page" ${state.responsesOffset+100>=state.responsesTotal?'disabled':''}>Sonraki →</button></div></div>`;
    }
    layout(`<section class="ad-panel"><h2>Yanıtlar ve İstatistikler</h2><p class="ad-muted">Her anketin yanıtlarını ayrı görüntüleyin, tarih ve soru bazında inceleyin, CSV olarak indirin.</p>
       <label class="ad-field" style="max-width:680px;margin-top:20px"><span>Yanıtlarını görmek istediğiniz anket</span><select class="ad-select" id="response-select"><option value="">Anket seçin...</option>${options}</select></label>
       ${main}${selected?chartFor(selected):''}<div class="ad-action-strip"><button class="ad-btn" data-act="drive">Drive şifreli yanıtları eşitle</button><button class="ad-btn-ghost" data-act="import">Katılımcı yanıt JSON dosyalarını içe aktar</button><button class="ad-btn-ghost" data-act="backup">Özel yedek indir</button><input id="admin-import" type="file" hidden multiple accept=".json"></div></section>`);
  }
  function renderBridge(){
    const pk=parseLocal(publicKeyStorage,null),endpoint=window.IdealBridge?.endpoint()||'';
    const select=state.surveys.map(s=>`<option value="${esc(s.id)}" ${state.responseSurvey===s.id?'selected':''}>${esc(s.title)} — ${esc(s.id.slice(0,10))}</option>`).join('');
    layout(`<section class="ad-panel"><h2>Google Drive — Şifreli Yanıt Kutusu</h2>
      <p class="ad-muted">Anket tanımları GitHub Pages'te yayınlanır. Bu bağlantı kurulursa yanıtlar tarayıcıda AES-GCM ve RSA-OAEP ile şifrelenir ve Google Apps Script üzerinden belgede saklanır. Özel anahtar yalnızca yönetici cihazında kullanılır.</p>
      <p class="ad-${endpoint?'ok':'error'}">${endpoint?'Apps Script bağlantısı tanımlı.':'Bağlantı henüz ayarlanmadı: bridge-config.js dosyasına Apps Script /exec adresini ekleyin.'}</p>
      <div class="ad-columns"><div class="ad-panel"><h3>1 · Anahtar oluştur ve yayınla</h3><p class="ad-small">Bir kez oluşturduğunuz anahtar takımını kullanın. Yeni anahtar üretmek eski şifreli yanıtları mevcut özel anahtarla çözmenizi engeller. Özel anahtarı GitHub'a asla yüklemeyin.</p>
        <p class="ad-small">${pk?.n?'Açık anahtar hazır. Kimlik: '+esc(pk.kid||''):'Henüz açık anahtar üretilmemiş.'}</p>
        <button class="ad-btn" data-act="drive-generate">Anahtar üret + ÖZEL dosyayı indir</button><p class="ad-small">Ardından “Anketlerim” → “GitHub yayın dosyasını indir” → surveys-data.js yükle.</p></div>
      <div class="ad-panel"><h3>2 · Özel anahtarı yükle</h3><p class="ad-small">Özel anahtar her oturum için yeniden yüklenir; tarayıcı depolamasına kaydedilmez.</p>
        <button class="ad-btn-ghost" data-act="drive-secret">Özel anahtar JSON dosyasını seç</button><input type="file" id="drive-private-file" hidden accept=".json,application/json">
        <div class="ad-small" style="margin-top:12px">${window.IdealBridge?.hasPrivateKey()?'Bu oturumda özel anahtar yüklendi.':'Bu oturumda özel anahtar yüklenmedi.'}</div></div></div>
      <div class="ad-panel" style="margin-top:18px"><h3>3 · Şifreli kayıtları içe aktar</h3>
        <label class="ad-field"><span>Anket seç</span><select class="ad-select" id="drive-survey">${select||'<option value="">Önce anket oluşturun</option>'}</select></label>
        <label class="ad-field"><span>Apps Script READ_KEY (yöneticiye özel)</span><input class="ad-input" id="drive-read-key" type="password" autocomplete="off" placeholder="Google Apps Script Script Properties / READ_KEY" value="${esc(readSecret)}"></label>
        <button class="ad-btn" data-act="drive-sync">Drive'dan çek · Şifre çöz · Yanıtlara ekle</button>
        <p class="ad-small">Kayıtlar yanıt ID ile tekilleştirilir. Bu işlem yerel tarayıcı veritabanına kopyalar. Google Dokümanı otomatik silinmez: önce kalıcı yedek oluşturmalısınız. Cihaz değiştirince veritabanınız taşınmaz, ancak Drive'daki kayıtları özel anahtarla yeniden çekebilirsiniz.</p>
        <p class="ad-small">Güvenlik: Bağlı Google Dokümanı'nın düzenleme yetkisini herkese açık bırakmayın. Bu sayfada görülen yönetici şifre alanı gerçek güvenlik sağlamaz.</p></div></section>`);
  }
  async function syncEncryptedFromDrive(){
    if(!bridgeActive())throw Error('Önce bridge-config.js içine Apps Script bağlantısı ekleyin.');
    if(!window.IdealBridge.hasPrivateKey())throw Error('Önce özel anahtar dosyasını seçin.');
    const survey=root.querySelector('#drive-survey')?.value||'';
    readSecret=root.querySelector('#drive-read-key')?.value||'';
    if(!survey||!readSecret)throw Error('Anket ve READ_KEY gerekli.');
    let off=0,all=0,added=0,pages=0,recordList=responseRead();
    const known=new Set(recordList.map(x=>x.id));
    while(pages++<30){
      const part=await window.IdealBridge.fetchEncrypted(survey,readSecret,off);
      if(!Array.isArray(part.records))throw Error('Beklenmedik yanıt biçimi.');
      for(const row of part.records){
        // Invalid ciphertext remains on Drive for investigation, without silently dropping it.
        let dec;try{dec=await window.IdealBridge.decrypt(row);}catch(e){throw Error('Yanıt çözülemedi ('+row.responseId+'): '+e.message);}
        all++;if(!known.has(dec.id)){recordList.push(dec);known.add(dec.id);added++;}
      }
      try{localStorage.setItem(PUBLIC_RECORDS_KEY,JSON.stringify(recordList));}
      catch{throw Error('Yerel kayıt alanı dolu. Mevcut özel yedeğinizi indirin ve alan açın.');}
      off=Number(part.nextOffset)||0;
      if(off>=Number(part.total)||part.records.length===0)break;
    }
    await refreshSurveys();state.responseSurvey=survey;
    notification(true,`${all} şifreli kayıt okundu; ${added} yeni yanıt çözüldü. Google Dokümanı silinmedi.`);
    state.mode='drive';render();
  }
  async function refreshSurveys(){const data=await adminApi('/admin/surveys');state.surveys=data.surveys||[];}
  async function openAdmin(){
    try{await refreshSurveys();state.mode='home';notification(true,'Hoş geldiniz.');render();}
    catch(e){state.mode='login';notification(false,e.message);render();}
  }
  async function saveEditor(){
    const s=state.editor;
    if(!s.title?.trim())throw new Error('Anket başlığını yazın.');
    if(!s.questions.length)throw new Error('En az bir soru olmalıdır.');
    if(s.questions.some(q=>OPTIONS_TYPES.has(q.type)&&q.options.filter(Boolean).length<2))throw new Error('Seçenekli sorularda en az iki seçenek gereklidir.');
    const payload={title:s.title,description:s.description,questions:s.questions,settings:s.settings,status:s.status};
    const result=s.id?await adminApi(`/admin/surveys/${s.id}`,{method:'PUT',body:JSON.stringify(payload)}):
      await adminApi('/admin/surveys',{method:'POST',body:JSON.stringify(payload)});
    state.editor=result.survey;
    await refreshSurveys();
    return result.survey;
  }
  async function loadResponses(id,offset=0){
    state.responseSurvey=id;state.responsesOffset=offset;
    if(id){const v=await adminApi(`/admin/surveys/${id}/responses?offset=${offset}`);state.responses=v.responses;state.responsesTotal=v.total;}
    else {state.responses=[];state.responsesTotal=0;}
    state.mode='answers';render();
  }
  async function downloadAdmin(path,filename){
    const r=await adminApi(path,{raw:true});const blob=await r.blob();
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function showPublic(s,preview=false){
    state.preview=preview;state.surveyId=s.id||'preview';
    SURVEY_CONFIG.questions=s.questions;
    SURVEY_CONFIG.settings=s.settings||{};
    document.querySelector('.success-card p').textContent=preview?'Önizleme: yanıt kaydedilmedi.':(bridgeActive()?'Yanıtınız şifrelenerek Google Drive bağlantısına kaydedildi.':'Yanıt yalnızca bu tarayıcıda saklandı; yöneticiye otomatik iletilmez.');
    document.getElementById('save-answer-json').hidden=preview||bridgeActive();
    root.hidden=true;
    const banner=document.getElementById('preview-banner');banner.hidden=!preview;
    document.getElementById('ui-layer').style.display='flex';
    buildForm();
    if(!preview)window.recordLocalSurveyView(-1);
  }
  async function initializeApplication(){
    const id=new URL(location.href).searchParams.get('s');
    if(id){
      root.hidden=false;root.innerHTML='<div class="ad-login-wrap"><div class="ad-panel">Anket yükleniyor…</div></div>';
      try {const result=await api(`/public/surveys/${encodeURIComponent(id)}`);showPublic(result.survey);}
      catch(e){root.innerHTML=`<div class="ad-login-wrap"><div class="ad-panel" style="text-align:center;max-width:480px"><img src="logo.png" style="height:75px;margin:auto auto 18px"><h2 style="font-size:1.4rem;margin:15px 0">Anket açılamıyor</h2><p class="ad-muted">${esc(e.message)}</p><p class="ad-muted">Bağlantı yanlış, anket taslak veya kapatılmış olabilir.</p></div></div>`;}
      return;
    }
    document.getElementById('ui-layer').style.display='none';root.hidden=false;
    if(state.token){try{await adminApi('/admin/me');await openAdmin();}catch{state.token='';sessionStorage.removeItem('ideal_admin_token');state.mode='login';render();}}
    else {state.mode='login';render();}
  }
  window.initializeApplication=initializeApplication;
  document.getElementById('preview-exit').addEventListener('click',()=>{
    state.preview=false;document.getElementById('preview-banner').hidden=true;document.getElementById('ui-layer').style.display='none';
    document.getElementById('success-screen').style.opacity=0;
    root.hidden=false;state.mode='edit';render();
  });
  root.addEventListener('submit',async e=>{
    if(e.target.id!=='login-form')return;
    e.preventDefault();const button=e.target.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Doğrulanıyor…';
    try {const form=new FormData(e.target);const r=await api('/admin/login',{method:'POST',body:JSON.stringify({username:form.get('username'),password:form.get('password')})});
      state.token=r.token;sessionStorage.setItem('ideal_admin_token',r.token);notification(null,'');await openAdmin();}
    catch(error){notification(false,error.message);state.mode='login';render();}
    finally{button.disabled=false;}
  });
  root.addEventListener('input',e=>{
    const el=e.target;if(el.id==='drive-read-key'){readSecret=el.value;return;}
    const s=state.editor;if(!s)return;
    if(el.dataset.bind){const key=el.dataset.bind;
      if(key==='thankYou')s.settings.thankYou=el.value;
      else s[key]=el.value;}
    if(el.dataset.qfield){const key=el.dataset.qfield,q=s.questions[state.activeQ];
      if(key==='options'||key==='rows')q[key]=el.value.split('\n').map(v=>v.trim()).filter(Boolean);
      else if(['min','max','step','minSelect','maxSelect'].includes(key))q[key]=Number(el.value);
      else q[key]=el.value;}
    if(el.dataset.setting){s.settings[el.dataset.setting]=el.type==='checkbox'?el.checked:el.value;}
  });
  root.addEventListener('change',async e=>{
    const el=e.target,s=state.editor;
    if(el.id==='response-select'){try{await loadResponses(el.value);}catch(err){notification(false,err.message);render();}return;}
    if(s && el.dataset.qfield){const q=s.questions[state.activeQ],k=el.dataset.qfield;
      q[k]=(k==='options'||k==='rows')?el.value.split('\n').map(v=>v.trim()).filter(Boolean):(el.type==='checkbox'?el.checked:el.value);
      if(k==='type'){if(k==='type'&&q.type==='rating'){q.min=1;q.max=5;}render();}}
    if(s&&el.dataset.bind)s[el.dataset.bind]=el.value;
    if(s&&el.dataset.setting)s.settings[el.dataset.setting]=el.type==='checkbox'?el.checked:el.value;
  });
  root.addEventListener('change',async e=>{
    if(e.target.id==='drive-private-file'){try{const file=e.target.files?.[0];if(!file)return;await window.IdealBridge.importSecret(file);notification(true,'Özel anahtar yalnızca bu oturum için yüklendi.');render();}catch(err){notification(false,err.message);render();}return;}
    if(e.target.id==='drive-survey'){state.responseSurvey=e.target.value;return;}
    if(e.target.id!=='admin-import')return;
    try{const n=await importFiles(e.target.files);await refreshSurveys();notification(true,`${n.surveys} anket ve ${n.responses} yanıt içe aktarıldı.`);render();}
    catch(err){notification(false,err.message);render();}
  });
  root.addEventListener('click',async e=>{
    const b=e.target.closest('[data-act]');if(!b)return;
    const act=b.dataset.act,s=state.editor;
    if(act==='drive'){state.mode='drive';state.messages=null;return render();}
    if(act==='drive-secret'){root.querySelector('#drive-private-file')?.click();return;}
    if(act==='drive-generate'){
      if(!confirm('Yeni bir anahtar oluşturursanız eski yanıtlar yeni anahtarla çözülemez. Mevcut özel anahtarınızı sakladınız mı?'))return;
      try{const result=await window.IdealBridge.generateKeys();
        downloadText(JSON.stringify(result.secret,null,2),'OZEL-ANAHTAR-GITHUBA-YUKLEME.json');
        localStorage.setItem(publicKeyStorage,JSON.stringify(result.publicKey));
        notification(true,'Özel anahtar dosyası indirildi; güvenle saklayın. Açık anahtar için surveys-data.js dosyasını yeniden yayımlayın.');render();}
      catch(e){notification(false,e.message);render();}return;
    }
    if(act==='drive-sync'){
      b.disabled=true;b.textContent='Şifreli yanıtlar okunuyor…';
      try{await syncEncryptedFromDrive();}catch(e){notification(false,e.message);render();}return;
    }
    if(act==='export-published'){
      downloadText(publishedJS(),'surveys-data.js','text/javascript');notification(true,'surveys-data.js indirildi. GitHub deponuzdaki aynı adlı dosyanın yerine yükleyin.');return render();
    }
    if(act==='backup'){exportPrivateBackup();notification(true,'ÖZEL yedeğiniz indirildi. Bu dosyayı herkese açık GitHub reposuna KOYMAYIN.');return render();}
    if(act==='import'){const f=root.querySelector('#admin-import');if(f)f.click();return;}
    if(act==='close'||act==='republish'){
      const db=dbRead(),item=db.surveys.find(s=>s.id===b.dataset.id);if(!item)return;
      item.status=act==='close'?'closed':'published';item.updatedAt=new Date().toISOString();if(act==='republish')item.publishedAt=item.updatedAt;
      capPublished(db);dbSave(db);await refreshSurveys();notification(true,act==='close'?'Anket yerel listede durduruldu.':'Anket yerel listede yeniden yayınlandı.');return render();
    }
    if(act==='archive-prev'||act==='archive-next'){state.archivePage+=act==='archive-next'?1:-1;return render();}
    if(act==='logout'){state.token='';sessionStorage.removeItem('ideal_admin_token');state.mode='login';state.messages=null;return render();}
    if(act==='new'){state.editor=newSurvey();state.activeQ=0;state.mode='edit';state.messages=null;return render();}
    if(act==='home'){try{await refreshSurveys();state.mode='home';state.messages=null;render();}catch(err){notification(false,err.message);render();}return;}
    if(act==='answers'){try{await refreshSurveys();await loadResponses(state.responseSurvey||'');}catch(err){notification(false,err.message);render();}return;}
    if(act==='edit'){state.editor=structuredClone(state.surveys.find(x=>x.id===b.dataset.id));state.activeQ=0;state.mode='edit';state.messages=null;return render();}
    if(act==='open-responses'){try{await loadResponses(b.dataset.id);}catch(err){notification(false,err.message);render();}return;}
    if(act==='copy'){try{await navigator.clipboard.writeText(publicLink(b.dataset.id));notification(true,'Bağlantı panoya kopyalandı.');}catch{notification(false,'Tarayıcı kopyalamayı engelledi. Linki seçip kopyalayın.');}return render();}
    if(act==='select-q'){state.activeQ=Number(b.dataset.index);return render();}
    if(act==='add-q'){if(s.questions.length>=100)return alert('En fazla 100 soru eklenebilir.');s.questions.push(newQuestion());state.activeQ=s.questions.length-1;return render();}
    if(act==='delete-q'){if(s.questions.length<=1)return alert('En az bir soru olmalıdır.');s.questions.splice(state.activeQ,1);state.activeQ=Math.max(0,state.activeQ-1);return render();}
    if(act==='duplicate-q'){const copy=structuredClone(s.questions[state.activeQ]);copy.id=newQuestion().id;s.questions.splice(state.activeQ+1,0,copy);state.activeQ++;return render();}
    if(act==='move-q-up'||act==='move-q-down'){const from=state.activeQ,to=from+(act==='move-q-up'?-1:1);if(to<0||to>=s.questions.length)return;
      [s.questions[from],s.questions[to]]=[s.questions[to],s.questions[from]];state.activeQ=to;return render();}
    if(act==='preview'){try{showPublic(structuredClone(s),true);}catch(err){notification(false,err.message);render();}return;}
    if(['save','publish'].includes(act)){
      b.disabled=true;let old=s.status;
      try{if(act==='publish')s.status='published';const saved=await saveEditor();
        notification(true,act==='publish'?`Yerel yayına alındı. Linki aktif etmek için surveys-data.js dosyasını indirip GitHub’a yükleyin. Link: ${publicLink(saved.id)}`:'Anket tarayıcınızda kaydedildi.');render();}
      catch(err){s.status=old;notification(false,err.message);render();}finally{b.disabled=false;}return;
    }
    if(act==='delete-survey'){
      if(!confirm('Bu anket ve tüm yanıtları kalıcı olarak SİLİNECEK. Emin misiniz?'))return;
      try{await adminApi(`/admin/surveys/${s.id}`,{method:'DELETE'});await refreshSurveys();state.mode='home';notification(true,'Anket ve yanıtları silindi.');render();}
      catch(err){notification(false,err.message);render();}return;
    }
    if(act==='export'){if(!state.responseSurvey)return;try{await downloadAdmin(`/admin/surveys/${state.responseSurvey}/export`,`anket-yanitlar-${state.responseSurvey}.csv`);}
      catch(err){notification(false,err.message);render();}return;}
    if(act==='download-file'){
      try{await downloadAdmin(`/admin/uploads/${b.dataset.file}`,`anket-dosya-${b.dataset.file}`);}
      catch(err){notification(false,err.message);render();}return;
    }
    if(act==='prev-page'||act==='next-page'){
      try{await loadResponses(state.responseSurvey,Math.max(0,state.responsesOffset+(act==='next-page'?100:-100)));}
      catch(err){notification(false,err.message);render();}return;
    }
  });
})();
