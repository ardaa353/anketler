/* İdeal Hukuk Kulübü — Supabase altyapısı kullanan yönetim paneli ve herkese açık anket istemcisi */
(()=>{'use strict';
const TYPES={text:'Kısa metin',textarea:'Uzun paragraf',email:'E-posta',number:'Sayı',tel:'Telefon',url:'Web adresi',date:'Tarih',time:'Saat','datetime-local':'Tarih-saat',radio:'Tek seçim',checkbox:'Çoklu seçim',select:'Açılır liste',yesno:'Evet / Hayır',scale:'Doğrusal ölçek',slider:'Kaydırıcı',rating:'Yıldız puan',likert:'Likert ölçeği',ranking:'Sıralama',matrix:'Tek seçimli matris','matrix-multi':'Çoklu seçimli matris',file:'Dosya yükleme (bu sürümde pasif)'};
const OPTION_TYPES=new Set(['radio','checkbox','select','likert','ranking','matrix','matrix-multi']),MATRIX_TYPES=new Set(['matrix','matrix-multi']),NUMBER_TYPES=new Set(['rating','scale','slider']);
const root=document.getElementById('admin-root'), ui=document.getElementById('ui-layer'),banner=document.getElementById('preview-banner');
const esc=x=>escapeHTML(String(x??''));
const uid=()=>crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join('');
const supaUrl=()=>String(window.IDEAL_SUPABASE_URL||'').replace(/\/$/,'');
const pubKey=()=>String(window.IDEAL_SUPABASE_KEY||'');
const configured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supaUrl()) && pubKey().length>20 && !pubKey().includes('BURAYA');
const state={token:sessionStorage.getItem('ihk-token')||'',surveys:[],editor:null,index:0,mode:'login',selected:'',responses:[],responseTotal:0,responseOffset:0,stats:null,message:'',bad:false,preview:false,surveyId:''};window.APP_STATE=state;
const link=id=>{const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('s',id);return u.toString();};
const stamp=s=>s?new Date(s).toLocaleString('tr-TR'):'—';
function notify(s,bad=false){state.message=s;state.bad=bad;}
function msg(){return state.message?`<div role="status" class="${state.bad?'ad-error':'ad-ok'}">${esc(state.message)}</div>`:'';}
async function fetchSafe(url,init){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  try{return await fetch(url,{...init,signal:ctrl.signal,cache:'no-store'});}
  catch(err){throw Error(err.name==='AbortError'?'Supabase 15 saniyede yanıt vermedi. Ağ erişimini kontrol edin.':'Supabase bağlantısı kurulamadı: '+err.message);}
  finally{clearTimeout(timer);}
}
async function request(path,options={},admin=false){
  if(!configured())throw Error('Önce config.js dosyasına Supabase URL ve publishable key yazın.');
  if(path==='/api/auth'){
    const creds=JSON.parse(options.body||'{}');
    if(creds.username!==window.IDEAL_ADMIN_USERNAME)throw Error('Kullanıcı adı veya parola hatalı');
    const resp=await fetchSafe(supaUrl()+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json','apikey':pubKey()},body:JSON.stringify({email:window.IDEAL_ADMIN_EMAIL,password:creds.password})});
    const data=await resp.json();
    if(!resp.ok)throw Error('Kullanıcı adı veya parola hatalı / hesap onayı eksik');
    // JWT alındı, yönetici yetkisi SQL gateway içinde ayrıca doğrulanır.
    return {token:data.access_token};
  }
  if(admin&&!state.token)throw Error('Yönetici girişi gerekli');
  const url=new URL(path,'https://placeholder.invalid');
  const payload=options.body?JSON.parse(options.body):{};
  const q=Object.fromEntries(url.searchParams);
  const headers={'Content-Type':'application/json','apikey':pubKey()};
  if(admin)headers.Authorization='Bearer '+state.token;
  const resp=await fetchSafe(supaUrl()+'/rest/v1/rpc/ihk_api',{method:'POST',headers,body:JSON.stringify({p_path:url.pathname,p_method:options.method||'GET',p_payload:payload,p_query:q})});
  const data=await resp.json().catch(()=>({}));
  if(!resp.ok)throw Error(data.message||data.error||'Supabase HTTP '+resp.status);
  return data;
}
const publicApi=(p,o)=>request('/api'+p,o,false);
const adminApi=(p,o)=>request('/api/admin'+p,o,true);
function emptyQuestion(){return {id:'q_'+uid().replace(/-/g,'').slice(0,14),type:'text',title:'SORU',text:'Yeni sorunuz nedir?',required:false,help:'',placeholder:'Yanıtınızı yazın',options:['Birinci seçenek','İkinci seçenek','Üçüncü seçenek'],rows:['Satır 1','Satır 2'],min:1,max:5,step:1,minSelect:0,maxSelect:0,allowOther:false};}
function emptySurvey(){return {id:'',title:'Yeni Anket',description:'Katılımınız için teşekkürler.',questions:[emptyQuestion()],settings:{privacyNotice:'Yanıtlar anket yöneticisi tarafından görüntülenir. Cihaz/tarayıcı kategorisi ve ziyaret olayları istatistik amacıyla kaydedilebilir.',requireConsent:true,thankYou:'Katılımınız için teşekkür ederiz.'},status:'draft'};}
// Yalnızca yönetim ekranına eklenen bileşenler için kısa mikro-toz birleşme hareketi.
let adminDustRun=0;
function sceneDust(){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const el=document.getElementById('admin-dust');if(!el)return;
 const boxes=[...root.querySelectorAll('.ad-panel,.ad-survey-card,.ad-brand,.ad-nav button')];
 if(!boxes.length)return;const width=innerWidth,height=innerHeight;
 const ratio=Math.min(devicePixelRatio||1,1.25);el.width=width*ratio;el.height=height*ratio;el.style.display='block';
 const ctx=el.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
 let pts=[];for(const box of boxes){const r=box.getBoundingClientRect();if(r.width<2||r.bottom<0||r.top>height)continue;
  const n=Math.min(450,Math.ceil((r.width+r.height)*2/4));for(let i=0;i<n;i++){const t=i/n,peri=2*(r.width+r.height),d=t*peri;let x,y;if(d<r.width){x=r.left+d;y=r.top;}else if(d<r.width+r.height){x=r.right;y=r.top+d-r.width;}else if(d<2*r.width+r.height){x=r.right-(d-r.width-r.height);y=r.bottom;}else{x=r.left;y=r.bottom-(d-2*r.width-r.height);}pts.push({x,y,rx:x+(Math.random()-.5)*Math.min(width,550),ry:y+(Math.random()-.5)*Math.min(height,440),phase:Math.random()*7});}}
 if(pts.length>2000)pts=pts.filter((_,i)=>i%Math.ceil(pts.length/2000)===0);
 const run=++adminDustRun,started=performance.now();const frame=now=>{if(run!==adminDustRun)return;const t=Math.min(1,(now-started)/870),a=1-(1-t)**3;ctx.clearRect(0,0,width,height);
  ctx.globalAlpha=Math.min(1,t*3)*(1-t*.25);for(const p of pts){ctx.fillStyle=Math.sin(now*.01+p.phase)>0?'#00e5ff':'#ae88ff';ctx.fillRect(p.rx+(p.x-p.rx)*a,p.ry+(p.y-p.ry)*a,.85,.85);}ctx.globalAlpha=1;
  if(t<1)requestAnimationFrame(frame);else{ctx.clearRect(0,0,width,height);el.style.display='none';}};requestAnimationFrame(frame);
}
function layout(content){root.hidden=false;ui.style.display='none';root.innerHTML=`<div class="ad-layout"><header class="ad-header"><div class="ad-brand"><img src="logo.png" alt="EBYÜ İdeal Hukuk Kulübü"><div><h1>İdeal Hukuk Kulübü</h1><div class="ad-muted">3D Anket Yönetim Merkezi</div></div></div><div class="ad-row"><span class="ad-chip ad-live">Supabase · Gerçek veriler</span><button class="ad-btn-ghost" data-act="logout">Çıkış</button></div></header><nav class="ad-nav"><button data-act="home" class="${state.mode==='home'?'active':''}">Anketler</button><button data-act="new" class="${state.mode==='edit'?'active':''}">+ Yeni Anket</button><button data-act="answers" class="${state.mode==='answers'?'active':''}">Yanıtlar ve İstatistik</button></nav>${msg()}${content}<footer class="ad-small" style="margin:28px 0">En fazla 10 anket tutulur. Yeni yayımlanan anket, sırası gelen eski anketi ve yanıtlarını veritabanından siler. Dosya yükleme bu sürümde kapalıdır.</footer></div>`;requestAnimationFrame(sceneDust);}
function loginPage(){state.mode='login';root.hidden=false;ui.style.display='none';root.innerHTML=`<main class="ad-login-wrap"><section class="ad-panel ad-login"><img src="logo.png" alt="İdeal Hukuk Kulübü"><h1>Yönetici Girişi</h1><p>İdeal Hukuk Kulübü · 3D Anket Sistemi</p>${!configured()?'<div class="ad-error">Supabase ayarları eksik. <code>config.js</code> dosyasını doldurun.</div>':''}<form id="login-form"><label class="ad-field"><span>Kullanıcı adı</span><input class="ad-input" name="username" autocomplete="username" required></label><label class="ad-field"><span>Şifre</span><input class="ad-input" name="password" type="password" autocomplete="current-password" required></label>${msg()}<button type="submit" class="ad-btn" style="width:100%">Giriş Yap</button></form><p class="ad-small">Giriş Supabase Auth ile, yönetici yetkisi PostgreSQL üzerinde doğrulanır.</p></section></main>`;requestAnimationFrame(sceneDust);}
function card(s){
  const url=link(s.id);
  return `<article class="ad-survey-card">
    <div class="ad-row" style="justify-content:space-between">
      <span class="ad-chip ad-live">● Yayında</span>
      <span class="ad-small">${stamp(s.updated_at)}</span>
    </div>
    <h3>${esc(s.title)}</h3>
    <div class="ad-kpi">${Number(s.response_count)||0}</div>
    <div class="ad-stat">Yanıt · ${Number(s.view_count)||0} görüntüleme olayı</div>
    <div class="ad-row" style="margin-top:16px">
      <button class="ad-btn-ghost" data-act="edit" data-id="${esc(s.id)}">Düzenle</button>
      <button class="ad-btn-ghost" data-act="responses" data-id="${esc(s.id)}">Yanıtlar</button>
    </div>
    <div class="ad-link" style="margin-top:12px">
      <code>${esc(url)}</code>
      <button class="ad-btn-ghost" data-act="copy" data-id="${esc(s.id)}">Kopyala</button>
      <a target="_blank" rel="noopener" href="${esc(url)}">Aç ↗</a>
    </div>
  </article>`;
}
function home(){
  state.mode='home';
  const bySlot=new Map(state.surveys.map(s=>[Number(s.slot_no),s]));
  const tiles=Array.from({length:10},(_,i)=>{
    const slot=i+1;
    const survey=bySlot.get(slot);
    return `<div class="ad-slot">
      <div class="ad-slot-head"><span>${slot}. YUVA</span><small>${survey?'Yayında':'Boş'}</small></div>
      ${survey?card(survey):'<article class="ad-survey-card ad-empty">Henüz anket yok</article>'}
    </div>`;
  }).join('');
  const localDraft=localStorage.getItem('ihk-local-draft');
  layout(`<section class="ad-panel">
    <div class="ad-row" style="justify-content:space-between">
      <div><h2>10 Sabit Anket Yuvası</h2>
      <p class="ad-muted">11. anket 1. yuvanın; 12. anket 2. yuvanın; 21. anket yeniden 1. yuvanın yerini alır.
      Silinen anketin cevapları ve ziyaret kayıtları da veritabanından kaldırılır.</p></div>
      <button class="ad-btn" data-act="new">+ Yeni Anket</button>
    </div>
    <div class="ad-row">
      <span class="ad-chip ad-live">${state.surveys.length}/10 aktif</span>
      ${localDraft?'<button class="ad-btn-ghost" data-act="load-local-draft">Kaydedilmiş yerel taslağı aç</button>':''}
    </div>
    <div class="ad-grid">${tiles}</div>
  </section>`);
}
const field=(label,key,v,area=false)=>`<label class="ad-field"><span>${label}</span>${area?`<textarea class="ad-textarea" data-bind="${key}">${esc(v)}</textarea>`:`<input class="ad-input" data-bind="${key}" value="${esc(v)}">`}</label>`;
const qfield=(label,key,v,t='text')=>`<label class="ad-field"><span>${label}</span>${t==='textarea'?`<textarea class="ad-textarea" data-qfield="${key}">${esc(v)}</textarea>`:`<input class="ad-input" type="${t}" data-qfield="${key}" value="${esc(v)}">`}</label>`;
function editor(){state.mode='edit';let s=state.editor;if(!s)return home();const q=s.questions[state.index]||s.questions[0];if(!q)return;const options=Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${q.type===k?'selected':''}>${esc(v)}</option>`).join('');layout(`<section class="ad-panel"><div class="ad-row" style="justify-content:space-between;align-items:flex-start"><div><h2>Anket Düzenleyici</h2><p class="ad-muted">21 soru türü · 3D toz geçişleri · Mobil uyum · Zorunlu alan doğrulaması</p></div><span class="ad-chip">${s.status==='active'?'Yayında':'Taslak'}</span></div><div class="ad-columns">${field('Anket başlığı','title',s.title)}${field('Anket açıklaması','description',s.description)}</div><div class="ad-editor"><div><div class="ad-panel"><h3>Sorular (${s.questions.length})</h3>${s.questions.map((x,i)=>`<button data-act="choose-question" data-index="${i}" class="ad-question-tab ${i===state.index?'selected':''}"><span class="ad-qno">${i+1}</span><span class="ad-qtext">${esc(x.text)}</span><small>${esc(TYPES[x.type])}</small></button>`).join('')}<button class="ad-btn" style="width:100%;margin-top:12px" data-act="add-q">+ Soru Ekle</button></div></div><div><div class="ad-panel"><div class="ad-row" style="justify-content:space-between"><h3>${state.index+1}. Soru</h3><span class="ad-chip">${esc(TYPES[q.type])}</span></div><label class="ad-field"><span>Soru türü</span><select class="ad-select" data-qfield="type">${options}</select></label>${qfield('Üst başlık','title',q.title)}${qfield('Soru metni','text',q.text,'textarea')}${qfield('Açıklama','help',q.help,'textarea')}${qfield('İpucu','placeholder',q.placeholder)}<label class="ad-checkbox"><input type="checkbox" data-qfield="required" ${q.required?'checked':''}> Zorunlu soru (*)</label>${OPTION_TYPES.has(q.type)?qfield('Seçenekler · her satıra bir seçenek','options',(q.options||[]).join('\n'),'textarea'):''}${MATRIX_TYPES.has(q.type)?qfield('Matris satırları · her satıra bir ifade','rows',(q.rows||[]).join('\n'),'textarea'):''}${NUMBER_TYPES.has(q.type)?`<div class="ad-columns">${qfield('En küçük','min',q.min,'number')}${qfield('En büyük','max',q.max,'number')}</div>${q.type==='slider'?qfield('Adım','step',q.step,'number'):''}`:''}${q.type==='checkbox'?`<div class="ad-columns">${qfield('Asgari seçim','minSelect',q.minSelect,'number')}${qfield('Azami seçim (0: sınırsız)','maxSelect',q.maxSelect,'number')}</div>`:''}${['radio','checkbox','select','likert'].includes(q.type)?`<label class="ad-checkbox"><input type="checkbox" data-qfield="allowOther" ${q.allowOther?'checked':''}> Diğer seçeneğine izin ver</label>`:''}${q.type==='file'?'<div class="ad-warning">Bu sürümde dosya yükleme desteklenmiyor. Anket yayımlarken bu soru türünü kullanmayın.</div>':''}<div class="ad-divider"></div><div class="ad-row"><button class="ad-btn-ghost" data-act="up">↑ Yukarı</button><button class="ad-btn-ghost" data-act="down">↓ Aşağı</button><button class="ad-btn-ghost" data-act="duplicate">Çoğalt</button><button class="ad-btn-warn" data-act="delete-q">Sil</button></div></div></div></div><div class="ad-panel" style="margin-top:18px"><h3>Gizlilik ve bitiş mesajı</h3>${field('Yanıt sonrası teşekkür yazısı','thankYou',s.settings.thankYou)}${field('Katılımcıya gösterilecek bilgilendirme','privacyNotice',s.settings.privacyNotice,true)}<label class="ad-checkbox"><input type="checkbox" data-setting="requireConsent" ${s.settings.requireConsent?'checked':''}> Yanıt göndermeden önce onay istensin</label></div><div class="ad-actions-sticky"><div class="ad-row"><button class="ad-btn-ghost" data-act="home">Geri</button><button class="ad-btn-ghost" data-act="preview">3D Önizleme</button></div><div class="ad-row"><button class="ad-btn-ghost" data-act="save">Taslak Kaydet</button><button class="ad-btn" data-act="publish">${s.status==='active'?'Değişiklikleri Yayınla':'Yayınla ve Link Al'}</button></div></div></section>`);}
function presentSurvey(s,preview=false){state.preview=preview;state.surveyId=preview?'':s.id;state.lastEventStep=-1;state.publicStarted=false;root.hidden=true;ui.style.display='flex';banner.hidden=!preview;SURVEY_CONFIG.questions=structuredClone(s.questions);SURVEY_CONFIG.settings=s.settings||{};SURVEY_CONFIG.surveyId=s.id;const thank=document.querySelector('#success-screen .success-card p');thank.textContent=s.settings?.thankYou||'Katılımınız için teşekkür ederiz.';buildForm();if(!preview)recordEvent('view');}
async function showPublic(id){root.hidden=false;root.innerHTML='<div class="ad-login-wrap"><div class="ad-panel">3D anket yükleniyor…</div></div>';try{const r=await publicApi('/surveys/'+encodeURIComponent(id));presentSurvey(r.survey);}catch(e){root.innerHTML=`<div class="ad-login-wrap"><div class="ad-panel ad-login"><img src="logo.png" alt="Logo"><h1>Anket açılamıyor</h1><p>${esc(e.message)}</p><p>Bu anket 10 yuvalı döngüde silinmiş ya da bağlantı geçersiz olabilir.</p></div></div>`;}}
function eventMeta(){return {};}let lastEventAt=0;function recordEvent(type){if(state.preview||!state.surveyId)return;const now=Date.now();if(type==='step'&&now-lastEventAt<500)return;lastEventAt=now;publicApi('/surveys/'+state.surveyId+'/events',{method:'POST',body:JSON.stringify({type})}).catch(()=>{});}
window.recordLocalSurveyView=step=>{if(step===state.lastEventStep)return;state.lastEventStep=step;if(step===0&&!state.publicStarted){state.publicStarted=true;recordEvent('start');}else if(step>0)recordEvent('step');};
window.submitSurveyAnswer=async()=>{if(state.preview)return {ok:true,preview:true};if(!state.surveyId)throw Error('Anket ID bulunamadı');if(!state.pendingSubmission)state.pendingSubmission=uid();const result=await publicApi('/surveys/'+state.surveyId+'/responses',{method:'POST',body:JSON.stringify({responseId:state.pendingSubmission,answers:formAnswers,consent:SURVEY_CONFIG.settings?.requireConsent===false?true:!!document.getElementById('survey-consent')?.checked})});state.pendingSubmission='';return result;};
window.uploadSurveyFile=async()=>{throw Error('Dosya yükleme bu sürümde henüz desteklenmiyor.');};
async function reload(){
  const resp=await fetchSafe(supaUrl()+'/rest/v1/rpc/ihk_slots_list',{
    method:'POST',
    headers:{'apikey':pubKey(),'Authorization':'Bearer '+state.token,'Content-Type':'application/json'},
    body:'{}'
  });
  const data=await resp.json().catch(()=>({}));
  if(!resp.ok)throw Error(data.message||data.error||'10 yuva listesi alınamadı; Supabase SQL düzeltmesini kontrol edin.');
  state.surveys=Array.isArray(data.surveys)?data.surveys:[];
}
async function openAdmin(){await reload();home();}
async function loadEditor(id){const r=await adminApi('/surveys/'+id);state.editor=r.survey;state.index=0;editor();}
async function saveEditor(){
  const s=state.editor;
  if(!s)throw Error('Anket seçilmedi');
  if(!s.id){
    localStorage.setItem('ihk-local-draft',JSON.stringify(s));
    return s;
  }
  const r=await adminApi('/surveys/'+s.id,{
    method:'PUT',body:JSON.stringify(s)
  });
  state.editor=r.survey;
  return r.survey;
}
async function doPublish(){
  const s=state.editor;
  if(!s)throw Error('Anket seçilmedi');
  let survey;
  if(s.id){
    // Güncelleme sırasında anketin kimliği ve yeri değişmez.
    survey=await saveEditor();
  }else{
    // Yalnızca yeni anketlerde SQL atomik silme + ekleme uygular.
    const resp=await fetchSafe(supaUrl()+'/rest/v1/rpc/ihk_publish_new',{
      method:'POST',
      headers:{'apikey':pubKey(),'Authorization':'Bearer '+state.token,'Content-Type':'application/json'},
      body:JSON.stringify({p_survey:s})
    });
    const data=await resp.json().catch(()=>({}));
    if(!resp.ok)throw Error(data.message||data.error||'Anket yayımlanamadı; SQL fonksiyonunu kontrol edin.');
    if(!data.survey?.id)throw Error('Supabase yeni anketin bağlantı kimliğini döndürmedi.');
    survey=data.survey;
    state.editor=survey;
    localStorage.removeItem('ihk-local-draft');
  }
  await reload();
  return survey;
}
function errorToast(e){notify(e.message||String(e),true);render();}
function render(){if(state.mode==='login')loginPage();else if(state.mode==='home')home();else if(state.mode==='edit')editor();else if(state.mode==='answers')showAnswers();}
async function selectAnswers(id,offset=0){state.selected=id;state.responseOffset=offset;const [a,b]=await Promise.all([adminApi('/surveys/'+id+'/responses?limit=100&offset='+offset),adminApi('/surveys/'+id+'/stats')]);state.responses=a.responses;state.responseTotal=a.total;state.stats=b;state.mode='answers';render();}
const colors=['#00e5ff','#8c65ff','#fa68b8','#ffc35c','#63e7a0','#4c7fff','#ef7c70','#bca0ff'];
function barChart(entries){let max=Math.max(1,...entries.map(x=>x[1]));return entries.map(([k,v])=>`<div class="chart-line"><div><span>${esc(k)}</span><strong>${v}</strong></div><div class="chart-track"><i style="width:${v/max*100}%"></i></div></div>`).join('');}
function pieChart(entries){let total=entries.reduce((n,e)=>n+e[1],0);if(!total)return '<p>Yanıt yok.</p>';let pos=0;const sectors=entries.map(([,v],i)=>{const from=pos;pos+=v/total*100;return `${colors[i%colors.length]} ${from}% ${pos}%`;});return `<div class="pie-layout"><div style="width:150px;height:150px;border-radius:50%;background:conic-gradient(${sectors.join(',')});border:5px solid #ffffff10"></div><div class="pie-legend">${entries.map(([k,v],i)=>`<p><i style="background:${colors[i%colors.length]}"></i> ${esc(k)} · ${v} (${Math.round(v/total*100)}%)</p>`).join('')}</div></div>`;}
function answerValue(value){if(value===null||value===undefined)return '—';if(Array.isArray(value))return value.join(' › ');if(typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):v}`).join(' | ');return String(value);}
function showAnswers(){state.mode='answers';const cur=state.surveys.find(x=>x.id===state.selected);const all=state.responses||[];let questionDefs=[];const cat=[];if(state.answeredSurvey)questionDefs=state.answeredSurvey.questions||[];const plots=questionDefs.map(q=>{const counter=new Map();for(const a of all){let v=a.answers[q.id];if(v===undefined||v===null||v==='')continue;const vals=Array.isArray(v)?v:(typeof v==='object'?Object.entries(v).map(([k,p])=>k+': '+answerValue(p)):[v]);for(let val of vals){val=String(val);counter.set(val,(counter.get(val)||0)+1);}}const entries=[...counter].sort((a,b)=>b[1]-a[1]).slice(0,10);return `<article class="chart-card"><h3>${esc(q.text)}</h3><p>${esc(TYPES[q.type]||q.type)}</p>${entries.length?( ['radio','checkbox','select','yesno','likert','rating','scale'].includes(q.type)?pieChart(entries):barChart(entries)):'<p>Bu soruya yanıt bulunamadı.</p>'}</article>`;});const stats=state.stats||{events:{},devices:{},responses:state.responseTotal};const deviceCounts=Object.entries(stats.devices||{});layout(`<section class="ad-panel"><h2>Yanıtlar ve İstatistikler</h2><label class="ad-field"><span>Anket seç</span><select class="ad-select" id="answer-survey"><option value="">Anket seçiniz</option>${state.surveys.map(s=>`<option value="${s.id}" ${s.id===state.selected?'selected':''}>${esc(s.title)}</option>`).join('')}</select></label>${cur?`<div class="metric-row"><article><small>Toplam Yanıt</small><b>${state.responseTotal}</b></article><article><small>Görüntüleme Olayı</small><b>${stats.events?.view||0}</b></article><article><small>Başlatma Olayı</small><b>${stats.events?.start||0}</b></article></div><div class="ad-row" style="margin:16px 0"><button class="ad-btn" data-act="export-csv">Tüm Yanıtları CSV İndir</button><button class="ad-btn-ghost" data-act="refresh-answers">Yenile</button></div><p class="ad-muted">Ziyaret sayıları anonim olaylardır; benzersiz kişi veya kimlik tespiti değildir. Aşağıdaki grafikler ekranda yüklenmiş son 100 yanıta aittir.</p><div class="chart-grid"><article class="chart-card"><h3>Cihaz kategorileri</h3>${pieChart(deviceCounts)}</article>${plots.join('')}</div><h3 style="margin-top:24px">Kişi bazlı yanıt kayıtları</h3><div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Yanıt zamanı</th><th>Yanıt ID</th><th>Cihaz</th>${questionDefs.map(q=>`<th>${esc(q.text)}</th>`).join('')}</tr></thead><tbody>${all.map(a=>`<tr><td>${stamp(a.created_at)}</td><td>${esc(a.id)}</td><td>${esc(a.client?.device||'—')} / ${esc(a.client?.browser||'—')}</td>${questionDefs.map(q=>q.type==='file'&&a.answers[q.id]?.fileId?`<td><button class="ad-btn-ghost" data-act="download-file" data-file="${esc(a.answers[q.id].fileId)}" data-filename="${esc(a.answers[q.id].name)}">${esc(a.answers[q.id].name)} indir</button></td>`:`<td>${esc(answerValue(a.answers[q.id]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="ad-row" style="justify-content:space-between;margin-top:17px"><button class="ad-btn-ghost" data-act="prev-page" ${!state.responseOffset?'disabled':''}>← Önceki 100</button><span>${state.responseOffset+1}–${Math.min(state.responseOffset+all.length,state.responseTotal)} / ${state.responseTotal}</span><button class="ad-btn-ghost" data-act="next-page" ${state.responseOffset+all.length>=state.responseTotal?'disabled':''}>Sonraki 100 →</button></div>`:'<div class="ad-empty">Yanıt ve istatistiklerini görmek için bir anket seç.</div>'}</section>`);}
async function enterAnswers(id){if(!id){state.selected='';state.mode='answers';return render();}const r=await adminApi('/surveys/'+id);state.answeredSurvey=r.survey;await selectAnswers(id);}
function csvValue(x){const s=String(x??'').replace(/^([=+\-@])/,'\'$1');return '"'+s.replace(/"/g,'""')+'"';} // CSV formula injection protection
async function exportCSV(){if(!state.selected)return;const questions=state.answeredSurvey?.questions||[],header=['Yanıt ID','Tarih','Cihaz','Tarayıcı',...questions.map(q=>q.text)];
 const all=[];let offset=0,total=1;do{const part=await adminApi('/surveys/'+state.selected+'/responses?limit=200&offset='+offset);all.push(...part.responses);offset+=part.responses.length;total=part.total;if(!part.responses.length)break;}while(offset<total);
 let lines=[header,...all.map(r=>[r.id,r.created_at,r.client?.device||'',r.client?.browser||'',...questions.map(q=>answerValue(r.answers[q.id]))])];let csv='\ufeff'+lines.map(line=>line.map(csvValue).join(',')).join('\r\n');
 let a=document.createElement('a');const blob=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=blob;a.download='tum-yanitlar-'+state.selected+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(blob),10000);
}
async function downloadSurveyFile(){throw Error('Bu sürümde dosya indirme desteği yok.');}
window.openSurveyById=showPublic;
window.initializeApplication=async()=>{ui.style.display='none';root.hidden=false;const s=new URLSearchParams(location.search).get('s');if(s){await showPublic(s);return;}if(!configured()){state.mode='login';notify('Supabase URL ve publishable key eksik. config.js ayarlarını tamamlayın.',true);render();return;}if(state.token){try{await adminApi('/me');await openAdmin();return;}catch{state.token='';sessionStorage.removeItem('ihk-token');}}loginPage();};
document.getElementById('preview-exit').addEventListener('click',()=>{state.preview=false;banner.hidden=true;root.hidden=false;ui.style.display='none';state.mode='edit';editor();});
root.addEventListener('submit',async e=>{if(e.target.id!=='login-form')return;e.preventDefault();const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;try{const f=new FormData(e.target);const d=await request('/api/auth',{method:'POST',body:JSON.stringify({username:f.get('username'),password:f.get('password')})});state.token=d.token;sessionStorage.setItem('ihk-token',d.token);notify('Giriş başarılı');await openAdmin();}catch(ex){notify(ex.message,true);loginPage();}finally{btn.disabled=false;}});
root.addEventListener('input',e=>{let s=state.editor;if(!s)return;let el=e.target,k=el.dataset.bind;if(k){if(k==='thankYou')s.settings.thankYou=el.value;else if(k==='privacyNotice')s.settings.privacyNotice=el.value;else s[k]=el.value;}k=el.dataset.qfield;if(k){let q=s.questions[state.index];if(k==='options'||k==='rows')q[k]=el.value.split('\n').map(x=>x.trim()).filter(Boolean);else if(['min','max','step','minSelect','maxSelect'].includes(k))q[k]=Number(el.value);else q[k]=el.type==='checkbox'?el.checked:el.value;}k=el.dataset.setting;if(k)s.settings[k]=el.checked;});
root.addEventListener('change',e=>{let el=e.target;if(el.id==='answer-survey'){enterAnswers(el.value).catch(errorToast);return;}if(el.dataset.qfield==='type'){editor();}});
root.addEventListener('click',async e=>{let el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act,id=el.dataset.id,s=state.editor;try{if(a==='logout'){sessionStorage.removeItem('ihk-token');state.token='';state.mode='login';state.message='';return loginPage();}
if(a==='home'){await reload();state.message='';return home();}if(a==='new'){state.editor=emptySurvey();state.index=0;return editor();}if(a==='load-local-draft'){try{const saved=JSON.parse(localStorage.getItem('ihk-local-draft')||'null');state.editor=saved&&Array.isArray(saved.questions)?saved:emptySurvey();state.editor.id='';state.editor.status='draft';state.index=0;return editor();}catch{throw Error('Yerel taslak açılamadı');}}if(a==='choose-question'){state.index=Number(el.dataset.index);return editor();}if(a==='add-q'){if(s.questions.length>=100)throw Error('En fazla 100 soru');s.questions.push(emptyQuestion());state.index=s.questions.length-1;return editor();}if(a==='delete-q'){if(s.questions.length<=1)throw Error('En az bir soru gerekli');s.questions.splice(state.index,1);state.index=Math.max(0,state.index-1);return editor();}if(a==='duplicate'){const clone=structuredClone(s.questions[state.index]);clone.id=emptyQuestion().id;s.questions.splice(state.index+1,0,clone);state.index++;return editor();}
if(a==='up'||a==='down'){const i=state.index,j=i+(a==='up'?-1:1);if(j<0||j>=s.questions.length)return;[s.questions[i],s.questions[j]]=[s.questions[j],s.questions[i]];state.index=j;return editor();}
if(a==='preview'){return presentSurvey({...structuredClone(s),id:'preview'},true);}
if(a==='save'){await saveEditor();notify(s.id?'Yayındaki anket güncellendi. Linki değişmedi.':'Taslak bu tarayıcıda kaydedildi, veritabanında yer kaplamıyor.');return editor();}
if(a==='publish'){el.disabled=true;const isNew=!s.id;const out=await doPublish();notify((isNew?'Anket yayımlandı; dolu yuvadaki eski anket ve tüm yanıtları silindi.':'Değişiklikler yayımlandı, anketin sırası ve bağlantısı değişmedi.')+' Bağlantı: '+link(out.id));return home();}
if(a==='edit'){return loadEditor(id);}

if(a==='copy'){try{await navigator.clipboard.writeText(link(id));notify('Anket bağlantısı kopyalandı.');}catch{notify(link(id));}return home();}

if(a==='answers'){state.mode='answers';return showAnswers();}if(a==='responses'){return enterAnswers(id);}if(a==='refresh-answers'){return enterAnswers(state.selected);}if(a==='export-csv'){return await exportCSV();}if(a==='download-file'){return await downloadSurveyFile(el.dataset.file,el.dataset.filename);}
if(a==='prev-page'){return selectAnswers(state.selected,Math.max(0,state.responseOffset-100));}if(a==='next-page'){return selectAnswers(state.selected,state.responseOffset+100);}
}catch(err){notify(err.message,true);render();}finally{el.disabled=false;}});
})();
