// Cell·Data Lab — shared login for the web version (Firebase Auth + Firestore).
// Active only when firebase-config.js defined window.CELLGRAPH_FIREBASE. One login is shared by every page on the same site.
(function(){
'use strict';
const cfg=window.CELLGRAPH_FIREBASE;
const MODE=cfg!==undefined;
const CONFIGURED=!!(cfg&&cfg.apiKey&&cfg.projectId);
const VER='10.12.2';
const APPROVAL=MODE&&window.CDL_REQUIRE_APPROVAL!==false; // only people an admin approved may use the apps
// app pages (window.CDL_GATE) stay hidden from the very first paint until the login check says this person may use them
const GATED=APPROVAL&&CONFIGURED&&(window.CDL_GATE===true||/(graph-maker|cellport)(\.html)?$/i.test(location.pathname));
function wait(on){ if(!GATED) return; document.documentElement.classList.toggle('fba-wait',!!on); }
if(GATED){ const st=document.createElement('style'); st.id='fba-wait-css'; st.textContent=`html.fba-wait body>*:not(.fba-ov):not(.fba-toast){visibility:hidden!important}
html.fba-wait body::before{content:"로그인 확인 중…";position:fixed;inset:0;display:grid;place-items:center;font:14px 'IBM Plex Sans KR','Malgun Gothic',system-ui,sans-serif;color:#7c8a93;z-index:1}`;
  (document.head||document.documentElement).appendChild(st); wait(true); }
const S={ready:false,err:false,resolved:false,user:null,auth:null,fs:null,p:null,status:'out',admin:false,unsub:null};
const subs=[], chips=[], ssubs=[];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function css(){
  if(document.getElementById('fba-css')) return;
  const st=document.createElement('style'); st.id='fba-css';
  st.textContent=`
.fba-acct{display:inline-flex;align-items:center;gap:8px;font-family:inherit}
.fba-who{font-size:12.5px;color:var(--ink2,#4d5a63);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fba-tag{font-size:11.5px;padding:2px 8px;border-radius:999px;background:#fdf0dc;color:#8a5300;white-space:nowrap}
a.fba-btn{text-decoration:none;display:inline-block}
.fba-btn{font:inherit;font-size:13px;border:1px solid var(--line,#d5dce1);background:var(--panel,#fff);color:var(--ink,#1b2328);padding:7px 12px;border-radius:7px;cursor:pointer;white-space:nowrap}
.fba-btn:hover{border-color:var(--accent,var(--teal,#0f5c78));color:var(--accent,var(--teal,#0f5c78))}
.fba-btn.fba-main{background:var(--accent,var(--teal,#0f5c78));border-color:var(--accent,var(--teal,#0f5c78));color:var(--accent-ink,var(--on-teal,#fff));font-weight:600}
.fba-btn.fba-main:hover{filter:brightness(1.08);color:var(--accent-ink,var(--on-teal,#fff))}
.fba-btn.fba-line{border-color:var(--accent,var(--teal,#0f5c78));color:var(--accent,var(--teal,#0f5c78));font-weight:600}
.fba-btn:disabled{opacity:.55;cursor:wait}
.fba-btn:focus-visible,.fba-box input:focus-visible{outline:2px solid var(--accent,var(--teal,#0f5c78));outline-offset:1px}
.fba-ov{position:fixed;inset:0;background:rgba(10,20,26,.45);display:grid;place-items:center;z-index:100;padding:16px}
.fba-ov[data-gate]{background:var(--bg,var(--paper,#eef1f3));z-index:110}
.fba-ov[data-gate] .fba-box{box-shadow:0 18px 50px -24px rgba(0,0,0,.35)}
.fba-ov[data-gate]~.fba-ov:not([data-gate]){z-index:115}
.fba-box{background:var(--panel,#fff);color:var(--ink,#1b2328);border:1px solid var(--line,#d5dce1);border-radius:12px;padding:22px;width:min(380px,100%);display:grid;gap:11px;box-shadow:0 18px 50px -20px rgba(0,0,0,.5);font-size:14px;line-height:1.5}
.fba-box h2{margin:0;font-size:19px}
.fba-box p{margin:0;color:var(--ink2,#4d5a63);font-size:13.5px}
.fba-box input{font:inherit;font-size:14px;width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line,#d5dce1);border-radius:7px;background:var(--panel,#fff);color:var(--ink,#1b2328)}
.fba-or{display:flex;align-items:center;gap:8px;color:var(--muted,#7c8a93);font-size:12px}
.fba-or::before,.fba-or::after{content:"";flex:1;border-top:1px solid var(--line,#d5dce1)}
.fba-err{color:#c62828;font-size:12.5px;min-height:1.2em}
.fba-row{display:flex;gap:8px;flex-wrap:wrap}
.fba-row .fba-btn{flex:1}
.fba-links{display:flex;justify-content:space-between;gap:8px;font-size:12.5px}
.fba-links button{background:none;border:0;padding:0;font:inherit;color:var(--accent,var(--teal,#0f5c78));cursor:pointer;text-decoration:underline}
.fba-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--ink,#1b2328);color:var(--panel,#fff);padding:8px 14px;border-radius:7px;font-size:13px;z-index:110;max-width:calc(100% - 32px)}
`;
  document.head.appendChild(st);
}
let tT=0; function toast(m){ let t=document.querySelector('.fba-toast'); if(!t){ t=document.createElement('div'); t.className='fba-toast'; t.setAttribute('role','status'); document.body.appendChild(t); } t.textContent=m; clearTimeout(tT); tT=setTimeout(()=>t.remove(),3400); }
function overlay(html,mount,locked){
  css(); const ov=document.createElement('div'); ov.className='fba-ov'; ov.innerHTML=`<div class="fba-box" role="dialog" aria-modal="true">${html}</div>`;
  const close=()=>{ ov.remove(); document.removeEventListener('keydown',k); };
  const k=e=>{ if(e.key==='Escape') close(); };
  ov.addEventListener('click',e=>{ if((!locked&&e.target===ov)||e.target.closest('[data-fba-close]')) close(); });
  if(!locked) document.addEventListener('keydown',k); document.body.appendChild(ov); if(mount) mount(ov,close); return close;
}
function load(src){ return new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>no(new Error('load '+src)); document.head.appendChild(s); }); }
function init(){
  if(S.p) return S.p;
  S.p=(async()=>{
    if(!MODE) return;
    if(!CONFIGURED){ S.resolved=true; emit(); return; }
    try{
      const b=`https://www.gstatic.com/firebasejs/${VER}/`;
      await load(b+'firebase-app-compat.js');
      await Promise.all([load(b+'firebase-auth-compat.js'),load(b+'firebase-firestore-compat.js')]);
      if(!firebase.apps||!firebase.apps.length) firebase.initializeApp(cfg);
      S.auth=firebase.auth(); S.fs=firebase.firestore(); S.ready=true;
      await new Promise(res=>{ let first=true; S.auth.onAuthStateChanged(async u=>{ await onAuth(u); if(first){ first=false; res(); } }); });
    }catch(e){ console.warn('login',e); S.err=true; S.resolved=true; emit(); }
  })();
  return S.p;
}
// approval: approved/{uid} written by an admin; a person who is not yet approved leaves a request in requests/{uid}
async function onAuth(u){
  if(S.unsub){ try{ S.unsub(); }catch(e){} S.unsub=null; }
  S.user=u||null; S.admin=false; S.resolved=true;
  if(!u){ S.status='out'; emit(); return; }
  if(!APPROVAL){ S.status='ok'; emit(); return; }
  S.status='checking'; emitStatus();
  try{ await S.fs.collection('requests').limit(1).get(); S.admin=true; }catch(e){ S.admin=false; }
  if(S.user!==u) return;
  if(S.admin){ S.status='ok'; emit(); return; }
  try{
    const ref=S.fs.doc('approved/'+u.uid);
    const d=await ref.get();
    if(d.exists){ S.status='ok'; emit(); return; }
    await S.fs.doc('requests/'+u.uid).set({email:u.email||'',name:u.displayName||'',at:Date.now()},{merge:true});
    S.status='pending'; emit();
    if(typeof ref.onSnapshot==='function') S.unsub=ref.onSnapshot(x=>{ if(x.exists&&S.user===u&&S.status!=='ok'){ S.status='ok'; emit(); toast('관리자가 승인했습니다. 이제 쓸 수 있습니다.'); } },()=>{});
  }catch(e){ console.warn('approval',e); S.status='pending'; emit(); }
}
function emitStatus(){ if(S.err||S.status==='ok') wait(false); else if(S.resolved&&(S.status==='out'||S.status==='pending')) wait(true); chips.forEach(render); ssubs.forEach(cb=>{ try{ cb(S.status); }catch(e){ console.error(e); } }); }
function emit(){ emitStatus(); const u=S.status==='ok'?S.user:null; subs.forEach(cb=>{ try{ cb(u); }catch(e){ console.error(e); } }); }
function render(el){
  if(!el) return; css(); el.hidden=!MODE; if(!MODE) return;
  el.classList.add('fba-acct');
  if(S.user){ const n=S.user.email||S.user.displayName||'로그인됨';
    const tag=S.status==='pending'?'<span class="fba-tag">승인 대기</span>':S.status==='checking'?'<span class="fba-tag">확인 중</span>':'';
    const adm=S.admin&&el.dataset.admin!=null?`<a class="fba-btn" href="${esc(el.dataset.admin||'admin.html')}">사용자 승인</a>`:'';
    el.innerHTML=`<span class="fba-who" title="${esc(n)}">${esc(n)}</span>${tag}${adm}<button class="fba-btn" type="button" data-fba="logout">로그아웃</button>`; }
  else el.innerHTML=`<button class="fba-btn fba-line" type="button" data-fba="login">${S.err?'로그인 (연결 실패)':(S.resolved||!CONFIGURED?'로그인':'로그인 확인 중…')}</button>`;
}
function msg(e){ const c=(e&&e.code)||''; return ({'auth/invalid-email':'이메일 형식을 확인하세요.','auth/missing-password':'비밀번호를 입력하세요.','auth/missing-email':'이메일을 입력하세요.','auth/weak-password':'비밀번호는 6자 이상이어야 합니다.','auth/email-already-in-use':'이미 가입된 이메일입니다. 로그인을 누르세요.','auth/invalid-credential':'이메일 또는 비밀번호가 맞지 않습니다.','auth/invalid-login-credentials':'이메일 또는 비밀번호가 맞지 않습니다.','auth/wrong-password':'이메일 또는 비밀번호가 맞지 않습니다.','auth/user-not-found':'가입되지 않은 이메일입니다. 회원가입을 누르세요.','auth/too-many-requests':'시도가 너무 많습니다. 잠시 후 다시 해 주세요.','auth/popup-closed-by-user':'로그인 창이 닫혔습니다.','auth/popup-blocked':'팝업이 막혔습니다. 브라우저에서 팝업을 허용해 주세요.','auth/unauthorized-domain':'이 주소는 로그인에 등록되지 않았습니다. 관리자에게 Firebase 승인 도메인 추가를 요청하세요.','auth/operation-not-allowed':'이 로그인 방식이 꺼져 있습니다. 관리자에게 문의하세요.','auth/network-request-failed':'인터넷 연결을 확인하세요.'})[c]||('로그인하지 못했습니다. '+(e&&e.message||''));
}
function openLogin(){
  if(!CONFIGURED){ overlay(`<h2>로그인</h2><p>아직 로그인 서버가 연결되지 않았습니다. 관리자가 <b>firebase-config.js</b>에 Firebase 설정을 넣으면 로그인과 계정 저장이 켜집니다. 그 전까지는 데이터가 이 브라우저에만 저장됩니다.</p><div class="fba-row"><button class="fba-btn" type="button" data-fba-close>닫기</button></div>`); return; }
  if(S.err||!S.ready){ overlay(`<h2>로그인</h2><p>로그인 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.</p><div class="fba-row"><button class="fba-btn" type="button" data-fba-close>닫기</button></div>`); return; }
  overlay(`<h2>Cell·Data Lab 로그인</h2>
    <p>한 번 로그인하면 그래프 메이커와 셀 데이터 변환기 모두 내 계정에 비공개로 저장되어, 다른 컴퓨터에서도 이어서 볼 수 있습니다.</p>
    <button class="fba-btn" type="button" id="fbaG">Google 계정으로 로그인</button>
    <div class="fba-or">또는 이메일</div>
    <input type="email" id="fbaE" placeholder="이메일" autocomplete="username">
    <input type="password" id="fbaP" placeholder="비밀번호 (6자 이상)" autocomplete="current-password">
    <div class="fba-err" id="fbaErr" role="alert"></div>
    <div class="fba-row"><button class="fba-btn fba-main" type="button" id="fbaIn">로그인</button><button class="fba-btn" type="button" id="fbaUp">회원가입</button></div>
    <div class="fba-links"><button type="button" id="fbaR">비밀번호를 잊었어요</button><button type="button" data-fba-close>닫기</button></div>`,(ov,close)=>{
      const q=s=>ov.querySelector(s), err=m=>{ q('#fbaErr').textContent=m||''; };
      const run=async fn=>{ err(''); ov.querySelectorAll('.fba-btn').forEach(b=>b.disabled=true);
        try{ await fn(); close(); toast(APPROVAL?'로그인했습니다. 승인 여부를 확인합니다.':'로그인했습니다.'); }catch(e){ console.warn(e); err(msg(e)); ov.querySelectorAll('.fba-btn').forEach(b=>b.disabled=false); } };
      q('#fbaG').onclick=()=>run(()=>S.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
      q('#fbaIn').onclick=()=>run(()=>S.auth.signInWithEmailAndPassword(q('#fbaE').value.trim(),q('#fbaP').value));
      q('#fbaUp').onclick=()=>run(()=>S.auth.createUserWithEmailAndPassword(q('#fbaE').value.trim(),q('#fbaP').value));
      q('#fbaP').addEventListener('keydown',e=>{ if(e.key==='Enter') q('#fbaIn').click(); });
      q('#fbaR').onclick=async()=>{ const em=q('#fbaE').value.trim(); if(!em){ err('비밀번호를 다시 정할 이메일을 먼저 입력하세요.'); return; } try{ await S.auth.sendPasswordResetEmail(em); err(''); toast('비밀번호 재설정 메일을 보냈습니다.'); }catch(e){ err(msg(e)); } };
      q('#fbaE').focus();
    });
}
const beforeLogout=[];
async function logout(){
  if(!S.auth) return;
  if(!confirm('로그아웃할까요?\n다른 사람이 같은 컴퓨터를 쓸 수 있도록 이 브라우저에 남은 데이터도 지웁니다. (계정에 저장된 데이터는 그대로 있습니다)')) return;
  for(const f of beforeLogout){ try{ await f(); }catch(e){ console.warn(e); } }
  try{ await S.auth.signOut(); toast('로그아웃했습니다.'); }catch(e){ console.warn(e); }
}
// a gentle gate for the apps: ask to log in once per visit, but allow working without it
function hardGate(){
  const show=st=>{
    const cur=document.querySelector('.fba-ov[data-gate]');
    if(st==='ok'||st==='checking'||S.err||!S.resolved){ if(cur&&st==='ok') cur.remove(); return; }
    if(cur&&cur.dataset.gate===st) return; if(cur) cur.remove();
    const html=st==='out'?`<h2>로그인해 주세요</h2><p>이 앱은 관리자가 승인한 사람만 쓸 수 있습니다. 로그인하면 관리자에게 사용 요청이 전달되고, 승인되면 바로 쓸 수 있습니다.</p><div class="fba-row"><button class="fba-btn fba-main" type="button" data-fba="login">로그인</button></div>`
      :`<h2>관리자 승인을 기다리는 중입니다</h2><p><b>${esc(S.user&&S.user.email||'')}</b> 계정으로 사용 요청을 보냈습니다. 관리자가 승인하면 이 화면이 저절로 사라집니다. 승인이 늦어지면 관리자에게 연락해 주세요.</p><div class="fba-row"><button class="fba-btn" type="button" data-fba="logout">다른 계정으로 로그인</button></div>`;
    overlay(html,ov=>{ ov.setAttribute('data-gate',st); },true);
  };
  ssubs.push(show); if(S.resolved) show(S.status);
}
function gate(){
  if(!MODE||!CONFIGURED) return;
  if(APPROVAL) return hardGate();
  onUser(u=>{
    if(u||S.err) { const o=document.querySelector('.fba-ov[data-gate]'); if(o) o.remove(); return; }
    let skip=false; try{ skip=sessionStorage.getItem('fba.skip')==='1'; }catch(e){}
    if(skip||document.querySelector('.fba-ov[data-gate]')) return;
    overlay(`<h2>로그인해 주세요</h2><p>로그인하면 불러온 데이터와 설정이 내 계정에 저장되어 다른 컴퓨터에서도 이어서 볼 수 있습니다. 로그인하지 않으면 이 브라우저에만 저장됩니다.</p>
      <div class="fba-row"><button class="fba-btn fba-main" type="button" id="fbaGo">로그인</button><button class="fba-btn" type="button" id="fbaSkip">로그인 없이 쓰기</button></div>`,(ov,close)=>{
        ov.setAttribute('data-gate','');
        ov.querySelector('#fbaGo').onclick=()=>{ close(); openLogin(); };
        ov.querySelector('#fbaSkip').onclick=()=>{ try{ sessionStorage.setItem('fba.skip','1'); }catch(e){} close(); };
      });
  });
}
function onUser(cb){ subs.push(cb); if(S.resolved) cb(S.user); }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-fba]'); if(!b) return; if(b.dataset.fba==='login') openLogin(); else if(b.dataset.fba==='logout') logout(); });
window.FBA={MODE,CONFIGURED,APPROVAL,init,onUser,openLogin,logout,gate,toast,
  onStatus(cb){ ssubs.push(cb); if(S.resolved) cb(S.status); },
  get status(){ return S.status; }, get admin(){ return S.admin; },
  chip(el){ if(el&&chips.indexOf(el)<0){ chips.push(el); render(el); } },
  beforeLogout(f){ beforeLogout.push(f); },
  get user(){ return S.user; }, get resolved(){ return S.resolved; }, get fs(){ return S.fs; }, get ready(){ return S.ready; }};
})();
