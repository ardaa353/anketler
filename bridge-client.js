/* Google Drive seçeneği: browser RSA-OAEP + AES-GCM, Apps Script proxy (isteğe bağlı).
   Varsayılan statik mod Drive'a bağlanmaz ve yerel kaydı merkezi kayıt gibi sunmaz. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const cfg=()=>window.IDEAL_BRIDGE_CONFIG||{};
  const endpoint=()=>String(cfg().endpoint||'').trim();
  const base64=buf=>{let s='';for(const n of new Uint8Array(buf))s+=String.fromCharCode(n);return btoa(s)};
  const raw64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const id=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16))).map(n=>n.toString(16).padStart(2,'0')).join('');
  let privateKey=null;
  let privateLabel='';
  async function generateKeys(){
    if(!crypto.subtle)throw Error('Şifreleme için HTTPS (veya localhost) gerekir.');
    const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
    const pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
    const secret=await crypto.subtle.exportKey('jwk',pair.privateKey);
    secret.kid=pub.kid=id(); pub.kid=secret.kid;
    privateKey=pair.privateKey;privateLabel=pub.kid;
    return {publicKey:pub,secret:{format:'idealhukuk-private-key',version:1,warning:'BU DOSYAYI GITHUB REPOSUNA YÜKLEMEYİN',jwk:secret}};
  }
  async function importSecret(file){
    const obj=JSON.parse(await file.text());if(obj.format!=='idealhukuk-private-key'||!obj.jwk?.d)throw Error('Geçersiz özel anahtar dosyası.');
    privateKey=await crypto.subtle.importKey('jwk',obj.jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
    privateLabel=obj.jwk.kid||'';
    return privateLabel;
  }
  async function envelope(surveyId,answers){
    const pub=window.PUBLISHED_SURVEYS?.publicKey;
    if(!pub?.n)throw Error('Şifreleme açık anahtarı GitHub yayın dosyasına eklenmemiş.');
    const rsa=await crypto.subtle.importKey('jwk',pub,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
    const aes=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const responseId=id();
    const payload={responseId,surveyId,createdAt:new Date().toISOString(),answers,meta:{device:innerWidth<680?'Telefon':innerWidth<1024?'Tablet':'Masaüstü',browser:/firefox/i.test(navigator.userAgent)?'Firefox':/edg\//i.test(navigator.userAgent)?'Edge':/chrome|crios/i.test(navigator.userAgent)?'Chrome':/safari/i.test(navigator.userAgent)?'Safari':'Diğer'}};
    const plaintext=new TextEncoder().encode(JSON.stringify(payload));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,plaintext);
    const rawAES=await crypto.subtle.exportKey('raw',aes);
    const wrapped=await crypto.subtle.encrypt({name:'RSA-OAEP'},rsa,rawAES);
    return {format:'idealhukuk-encrypted',version:1,responseId,surveyId,keyId:pub.kid||'',iv:base64(iv),wrappedKey:base64(wrapped),ciphertext:base64(ciphertext),createdAt:payload.createdAt};
  }
  async function decrypt(enc){
    if(!privateKey)throw Error('Önce özel anahtar dosyanızı yükleyin.');
    if(privateLabel&&enc.keyId&&privateLabel!==enc.keyId)throw Error('Bu kayıt farklı bir anahtarla şifrelenmiş.');
    const rawAES=await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,raw64(enc.wrappedKey));
    const aes=await crypto.subtle.importKey('raw',rawAES,{name:'AES-GCM'},false,['decrypt']);
    const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw64(enc.iv)},aes,raw64(enc.ciphertext));
    const value=JSON.parse(new TextDecoder().decode(raw));
    if(value.surveyId!==enc.surveyId||value.responseId!==enc.responseId)throw Error('Yanıt kimliği eşleşmedi.');
    return {id:value.responseId,surveyId:value.surveyId,createdAt:value.createdAt,answers:value.answers,meta:value.meta,source:'Google Drive (şifreli)'};
  }
  function ensureEndpoint(){const url=endpoint();if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_\-]+\/exec$/.test(url))throw Error('Google Apps Script /exec bağlantısını bridge-config.js dosyasına ekleyin.');return url}
  function submit(enc){return new Promise((resolve,reject)=>{
    const src=ensureEndpoint(),requestId=id();
    const iframe=document.createElement('iframe');iframe.name='ih-bridge-'+requestId;iframe.hidden=true;iframe.setAttribute('title','Şifreli gönderim');
    const form=document.createElement('form');form.style.display='none';form.method='POST';form.action=src;form.target=iframe.name;
    const add=(name,value)=>{const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input)};
    add('op','submit');add('requestId',requestId);add('payload',JSON.stringify(enc));
    let settled=false;
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();setTimeout(()=>iframe.remove(),700)};
    const finish=(err,result)=>{if(settled)return;settled=true;cleanup();if(err)reject(err);else resolve(result)};
    const onMessage=event=>{
      if(event.source!==iframe.contentWindow)return;
      // Only Google's Apps Script iframe domains are accepted, plus a random request nonce.
      const host=(()=>{try{return new URL(event.origin).hostname}catch{return''}})();
      if(host!=='script.google.com'&&!host.endsWith('.googleusercontent.com'))return;
      const data=event.data;if(data?.protocol!=='idealhukuk-bridge-v1'||data.requestId!==requestId)return;
      finish(data.ok?null:new Error(data.error||'Sunucu kaydı reddetti.'),data);
    };
    const timer=setTimeout(()=>finish(new Error('Drive yanıtı doğrulanamadı. Yeniden göndermeden önce yöneticiyle görüşün; bağlantı yavaş olabilir.')),25000);
    window.addEventListener('message',onMessage);document.body.append(iframe,form);form.submit();
  })}
  async function submitEncrypted(surveyId,answers){const enc=await envelope(surveyId,answers);return await submit(enc)}
  // JSONP used only to download encrypted ciphertext, never HTML or executable answer content.
  function jsonp(params){return new Promise((resolve,reject)=>{
    const url=ensureEndpoint(),name='__ih_jsonp_'+id().replace(/-/g,'');
    const script=document.createElement('script');
    let done=false;const cleanup=()=>{clearTimeout(timer);script.remove();delete window[name]};
    window[name]=(x)=>{if(done)return;done=true;cleanup();if(!x?.ok)reject(new Error(x?.error||'Drive verileri okunamadı.'));else resolve(x)};
    script.onerror=()=>{if(done)return;done=true;cleanup();reject(new Error('Google Apps Script okunamadı.'))};
    script.src=url+'?'+new URLSearchParams({...params,callback:name}).toString();
    const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('Drive sorgusu zaman aşımına uğradı.'))},22000);
    document.head.append(script);
  })}
  async function fetchEncrypted(surveyId,readKey,offset=0){
    if(!readKey)throw Error('Google Apps Script okuma anahtarını girin.');
    const ts=Math.floor(Date.now()/1000),nonce=id(),message=['list',surveyId,offset,ts,nonce].join('|');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(readKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    return await jsonp({op:'list',survey:surveyId,offset:String(offset),ts:String(ts),nonce,sig});
  }
  window.IdealBridge={cfg,endpoint,generateKeys,importSecret,hasPrivateKey:()=>!!privateKey,submitEncrypted,encryptOffline:envelope,fetchEncrypted,decrypt};
})();
