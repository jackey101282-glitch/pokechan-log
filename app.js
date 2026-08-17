/* =========================================================
   ポケチャン ノート — アプリ本体
   データの正本は Supabase。localStorage は入力途中の下書きのみ。
   ========================================================= */
'use strict';
/* HTMLとJSの版ズレを検出する。ズレていたら1回だけ強制リロードする。
   （GitHub Pages は index.html と app.js を別々に10分キャッシュするため） */
const APP_VERSION = '5';
(function(){
  const meta=document.querySelector('meta[name="app-version"]');
  const html=meta?meta.content:null;
  if(html && html!==APP_VERSION){
    if(sessionStorage.getItem('pc_reloaded')!==html){
      sessionStorage.setItem('pc_reloaded', html);
      location.reload();
      throw new Error('version skew: reloading');
    }
    document.addEventListener('DOMContentLoaded',()=>{
      const d=document.createElement('div');
      d.style.cssText='position:fixed;inset:auto 0 0 0;z-index:200;background:#f2685f;color:#fff;padding:12px;text-align:center;font-size:14px';
      d.innerHTML='読み込みが新旧で食い違っています。<b>ページを再読み込みしてください</b>（⌘+Shift+R）';
      document.body.appendChild(d);
    });
  }
})();

const $  = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = (a,b)=> b? Math.round(a/b*100) : 0;
const todayStr = ()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function toast(m,bad){const t=$('#toast');t.textContent=m;t.className='show'+(bad?' bad':'');clearTimeout(t._h);t._h=setTimeout(()=>t.className='',2600);}

/* ---------- 設定チェック ---------- */
if(!window.SUPA || String(window.SUPA.url).includes('YOUR-PROJECT') || String(window.SUPA.key).includes('PASTE-')){
  document.body.innerHTML = '<div style="max-width:560px;margin:12vh auto;padding:24px;font-family:sans-serif">'
    +'<h2>セットアップが未完了です</h2><p>app/supabase-config.js に URL と anon キーを入れてください。手順は SETUP.md にあります。</p></div>';
  throw new Error('config');
}
PC.loadData();
const sb = window.supabase.createClient(window.SUPA.url, window.SUPA.key);

const SPECIES_NAMES = Object.keys(PC.SPECIES);
const MOVE_NAMES    = Object.keys(PC.MOVES);
const NATURE_NAMES  = Object.keys(PC.NATURES);
const ITEMS = ['','いのちのたま','こだわりハチマキ','こだわりメガネ','こだわりスカーフ','きあいのタスキ','たべのこし','とつげきチョッキ','ラムのみ','オボンのみ','たつじんのおび','タイプ強化アイテム','しんかのきせき','メガストーン'];
const ABILITIES = ['','マルチスケイル','かたいツメ','テクニシャン','てきおうりょく','へんげんじざい','ちからもち','ヨガパワー','フェアリーオーラ','しんりょく','げきりゅう','もうか','むしのしらせ','ハードロック','フィルター','ノーガード','ふゆう','かたやぶり','ミラーアーマー','ばけのかわ','じきゅうりょく','さめはだ','すなおこし','ひでり','あまごい','とびだすハバネロ','てんねん','いかく'];
const RANKS = ['モンスターボール級Ⅳ','モンスターボール級Ⅲ','モンスターボール級Ⅱ','モンスターボール級Ⅰ',
  'スーパーボール級Ⅳ','スーパーボール級Ⅲ','スーパーボール級Ⅱ','スーパーボール級Ⅰ',
  'ハイパーボール級Ⅳ','ハイパーボール級Ⅲ','ハイパーボール級Ⅱ','ハイパーボール級Ⅰ',
  'マスターボール級Ⅳ','マスターボール級Ⅲ','マスターボール級Ⅱ','マスターボール級Ⅰ','チャンピオン級'];
// 先頭が初期値。シーズンが進んだらここを並べ替える
const SEASONS = ['M-5','M-6','M-7','M-8','M-4','M-3','M-2','M-1'];

/* ---------- 状態 ---------- */
let USER=null, TEAMS=[], BATTLES=[], EDIT_ID=null;
const S = { opp:[], oppPick:[], myPick:[], result:null, mega:null, oppMega:null, predLead:null, turns:[], tNew:[] };
const DRAFT='pc_note_draft_v2', CTX='pc_note_ctx_v1';
const setArr=(a,src)=>{a.length=0;(src||[]).forEach(v=>a.push(v));};

/* ---------- 表示ヘルパ ---------- */
function typeIcon(t){
  const d = PC.TYPE_ICON[t]; if(!d) return '';
  return `<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
}
function typeChips(name){
  const s = PC.SPECIES[name]; if(!s) return '';
  return s.types.map(t=>
    `<span class="tp" style="background:${PC.TYPE_COLOR[t]||'#aaa'}">${typeIcon(t)}${t}</span>`).join(' ');
}
function pkChip(name, opts){
  opts = opts||{};
  return `<span class="pk ${opts.cls||''}" ${opts.data||''}>${typeChips(name)}<b>${esc(name)}</b>${opts.x?'<span class="x">×</span>':''}</span>`;
}

/* ---------- オートコンプリート ---------- */
function autocomplete(inputSel, boxSel, source, onPick, opts){
  opts = opts||{};
  const inp=$(inputSel), box=$(boxSel); let hi=-1, items=[];
  let composing=false, justComposed=false;   // 日本語入力（IME）の確定Enter対策
  const close=()=>{box.hidden=true;hi=-1;};
  const render=()=>{
    const q=inp.value.trim();
    items = source(q).slice(0,40);
    if(!items.length){close();return;}
    box.innerHTML = items.map((it,i)=>{
      const n = typeof it==='string'? it : it.name;
      const meta = (typeof it==='object' && it.meta)? `<span class="mini">${esc(it.meta)}</span>`:'';
      return `<div data-i="${i}" class="${i===hi?'hi':''}">${opts.types!==false?typeChips(n):''}<span>${esc(n)}</span>${meta}</div>`;
    }).join('');
    box.hidden=false;
    box.querySelectorAll('div').forEach(d=> d.onmousedown=e=>{e.preventDefault();choose(+d.dataset.i);});
  };
  const choose=i=>{ const it=items[i]; if(!it)return; const n=typeof it==='string'?it:it.name; inp.value=''; close(); onPick(n); };

  // IME: 変換中は候補確定の対象にしない。確定直後の1回目のEnterも読み飛ばす
  inp.addEventListener('compositionstart', ()=>{ composing=true; });
  inp.addEventListener('compositionend', ()=>{
    composing=false; justComposed=true;
    setTimeout(()=>{ justComposed=false; }, 80);
    render();
  });

  inp.addEventListener('input', render);
  inp.addEventListener('focus', render);
  inp.addEventListener('blur', ()=>setTimeout(close,120));
  inp.addEventListener('keydown', e=>{
    // 変換確定のEnter（isComposing / keyCode 229）はここで握りつぶす
    if(composing || e.isComposing || e.keyCode===229) return;
    if(e.key==='Enter' && justComposed){ e.preventDefault(); return; }

    if(box.hidden){
      if(e.key==='Enter'){ e.preventDefault(); const q=inp.value.trim(); if(q){ inp.value=''; onPick(q); } }
      return;
    }
    if(e.key==='ArrowDown'){e.preventDefault();hi=Math.min(hi+1,items.length-1);render();}
    else if(e.key==='ArrowUp'){e.preventDefault();hi=Math.max(hi-1,0);render();}
    else if(e.key==='Enter'){e.preventDefault(); choose(hi<0?0:hi);}
    else if(e.key==='Escape') close();
  });
  return {refresh:render};
}
/** 過去に登録した相手ポケモンを優先して並べる
 *  noMega=true のときはメガフォルムを候補から外す（相手のパーティ入力用） */
function makeSpeciesSource(noMega){
  return q=>{
    const seen = {};
    BATTLES.forEach(b=> (b.opp_team||[]).forEach(n=> seen[n]=(seen[n]||0)+1));
    const hit = n => !q || n.includes(q);
    let list = SPECIES_NAMES.filter(hit);
    if(noMega) list = list.filter(n=> !PC.isMegaForm(n));
    return list.sort((a,b)=>{
      const d=(seen[b]||0)-(seen[a]||0); if(d) return d;
      const ai=a.indexOf(q), bi=b.indexOf(q);
      return (ai<0?99:ai)-(bi<0?99:bi) || a.length-b.length;
    }).map(n=>{
      const tags=[];
      if(seen[n]) tags.push(`過去${seen[n]}回`);
      if(noMega && PC.canMega(n)) tags.push('メガ可');
      return tags.length? {name:n, meta:tags.join(' / ')} : n;
    });
  };
}
const speciesSource = makeSpeciesSource(false);
const oppSpeciesSource = makeSpeciesSource(true);
/** 相手の名前を、メガが判明していればメガ名に解決する */
function effOpp(n){ return (S.oppMega && PC.BASE_OF[S.oppMega]===n) ? S.oppMega : n; }
function moveSource(forMon){
  return q=>{
    const obs = PC.observedMoves(BATTLES)[forMon]||[];
    const obsNames = obs.map(o=>o.move);
    const hit = n => !q || n.includes(q);
    const list = MOVE_NAMES.filter(hit);
    return list.sort((a,b)=>{
      const ao=obsNames.indexOf(a), bo=obsNames.indexOf(b);
      if(ao>=0||bo>=0) return (ao<0?99:ao)-(bo<0?99:bo);
      return a.indexOf(q)-b.indexOf(q) || a.length-b.length;
    }).map(n=>{
      const o = obs.find(x=>x.move===n);
      return o? {name:n, meta:`観測${o.count}回`} : n;
    });
  };
}

/* =========================================================
   認証
   ========================================================= */
async function boot(){
  const {data:{session}} = await sb.auth.getSession();
  if(session) await enterApp(session.user); else $('#login').hidden=false;
}
sb.auth.onAuthStateChange((ev)=>{ if(ev==='SIGNED_OUT') location.reload(); });
$('#lgIn').onclick = async ()=>{
  const email=$('#lgEmail').value.trim(), password=$('#lgPass').value;
  if(!email||!password) return msg('メールとパスワードを入れてください','r');
  $('#lgIn').disabled=true;
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  $('#lgIn').disabled=false;
  if(error) return msg('ログインできませんでした：'+error.message,'r');
  $('#login').hidden=true; await enterApp(data.user);
};
$('#lgUp').onclick = async ()=>{
  const email=$('#lgEmail').value.trim(), password=$('#lgPass').value;
  if(!email||password.length<6) return msg('メールと6文字以上のパスワードを入れてください','r');
  const {data,error}=await sb.auth.signUp({email,password});
  if(error) return msg('作成できませんでした：'+error.message,'r');
  if(data.session){ $('#login').hidden=true; await enterApp(data.user); }
  else msg('確認メールを送りました。リンクを開いてからログインしてください。','g');
};
$('#lgPass').addEventListener('keydown',e=>{if(e.key==='Enter')$('#lgIn').click();});
function msg(m,c){ $('#loginMsg').innerHTML=`<div class="note ${c}" style="margin-bottom:14px">${esc(m)}</div>`; }
$('#btnOut').onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };

async function enterApp(user){
  USER=user; $('#app').hidden=false; $('#whoami').textContent=user.email;
  $('#fSeason').innerHTML = SEASONS.map(s=>`<option>${s}</option>`).join('');
  $('#fRank').innerHTML   = RANKS.map(s=>`<option>${s}</option>`).join('');
  $('#fDate').value = todayStr();
  ['mvlist','mvlist2'].forEach(id=>{
    if($('#'+id)) return;
    const dl=document.createElement('datalist'); dl.id=id;
    dl.innerHTML=MOVE_NAMES.map(m=>`<option value="${esc(m)}">`).join('');
    document.body.appendChild(dl);
  });
  await Promise.all([loadTeams(), loadBattles()]);
  initAutocompletes(); initDamageUI();
  restoreDraft(); renderAll();
}
/* DBにまだ無い列があっても保存を落とさない。
   足りない列を自動で外して再送し、あとで何が保存できなかったかを知らせる。 */
async function dbWrite(table, mode, payload, id){
  const body={...payload}, dropped=[];
  for(let i=0;i<8;i++){
    const q = mode==='insert' ? sb.from(table).insert(body) : sb.from(table).update(body).eq('id', id);
    const { error } = await q;
    if(!error) return { ok:true, dropped };
    const m = /Could not find the '(.+?)' column/.exec(error.message||'');
    if(m && Object.prototype.hasOwnProperty.call(body, m[1])){ delete body[m[1]]; dropped.push(m[1]); continue; }
    return { ok:false, error };
  }
  return { ok:false, error:{message:'保存できませんでした'} };
}
const COL_LABEL={roster:'6匹の詳細（特性・性格・持ち物・SP・技）',plans:'並びごとの選出プラン',note:'メモ',
  turns:'ターンの記録',mega:'自分のメガ枠',opp_mega:'相手のメガ',pred_lead:'先発予想'};
function warnDropped(dropped){
  if(!dropped.length) return;
  const names=dropped.map(c=>COL_LABEL[c]||c).join('・');
  toast(`保存しました（${names} は未保存：DBの更新が必要）`, true);
}

async function loadTeams(){
  const {data,error}=await sb.from('teams').select('*').order('created_at',{ascending:false});
  if(error) return toast('構築の読込に失敗: '+error.message,true); TEAMS=data||[];
}
async function loadBattles(){
  const {data,error}=await sb.from('battles').select('*')
    .order('played_at',{ascending:false}).order('created_at',{ascending:false}).limit(3000);
  if(error) return toast('ログの読込に失敗: '+error.message,true); BATTLES=data||[];
}

/* ---------- タブ ---------- */
$$('.tab').forEach(b=> b.onclick=()=>{
  $$('.tab').forEach(x=>x.classList.toggle('on',x===b));
  ['rec','dmg','advice','stat','hist','team'].forEach(t=> $('#tab-'+t).hidden=(t!==b.dataset.tab));
  if(b.dataset.tab==='stat') renderStats();
  if(b.dataset.tab==='hist') renderHist();
  if(b.dataset.tab==='advice') renderAdvice();
  window.scrollTo({top:0});
});

/* =========================================================
   対戦タブ
   ========================================================= */
function initAutocompletes(){
  autocomplete('#oppInput','#oppSug', oppSpeciesSource, n=>{
    if(S.opp.length>=6) return toast('6匹までです',true);
    const base = PC.toBase(n);                 // メガ名で入れられてもベースに直す
    if(base!==n) toast(`${base} として登録しました（メガはバトル中に記録します）`);
    if(S.opp.includes(base)) return toast('すでに入っています',true);
    S.opp.push(base); renderOpp(); saveDraft();
  });
  autocomplete('#tInput','#tSug', speciesSource, n=>{
    if(S.tNew.length>=6) return toast('6匹までです',true);
    if(S.tNew.find(x=>x.name===n)) return toast('すでに入っています',true);
    S.tNew.push({name:n, ability:'', nature:'', item:'', sp:{h:0,a:0,b:0,c:0,d:0,s:0}, moves:['','','','']});
    renderTNew();
  });
}
function currentTeam(){ return TEAMS.find(t=>t.id===$('#fTeam').value); }
/** 相性計算に渡す形。
 *  1バトルでメガシンカできるのは1体だけなので、メガ枠が複数ある構築では
 *  「選ばなかった方」をメガ前の姿として計算する（メガの数値で二重取りしない）。 */
function rosterForCalc(roster, megaChoice){
  const megaSlots = roster.filter(m=>PC.isMegaForm(m.name)).map(m=>m.name);
  return roster.map(m=>{
    const demote = PC.isMegaForm(m.name) && megaSlots.length>1 && megaChoice && megaChoice!==m.name;
    const calcName = demote ? PC.toBase(m.name) : m.name;
    return {
      label:m.name,                    // 表示・選出の照合はこちら
      name:calcName,                   // 計算に使う姿
      demoted:demote,
      stats:PC.realStats(calcName, m.sp, m.nature),
      moves:(m.moves||[]).filter(Boolean),
      ability: demote ? '' : (m.ability||''),
      item:    demote ? '' : (m.item||'')
    };
  }).filter(m=>m.stats);
}
/** この構築が持つメガ枠。複数あればどれを切るかで結果が変わる */
function megaSlotsOf(roster){ return roster.filter(m=>PC.isMegaForm(m.name)).map(m=>m.name); }
/** メガの切り方を総当たりして、いちばん良い選出を返す。
 *  第一基準＝予想した相手3体への強さ、第二基準＝予想が外れた時に相手6体をどれだけ見れるか。 */
function bestPlan(roster, targets, size, allOpp){
  const slots = megaSlotsOf(roster);
  const choices = slots.length>1 ? slots : [null];
  const pool = [];
  choices.forEach(ch=>{
    const rc = rosterForCalc(roster, ch);
    const sug = PC.suggestPicks(rc, targets, Math.min(size, rc.length));
    sug.top.forEach(c=>{
      // 選んだメガが選出に入っていない案は、メガを切る意味がないので除外
      if(ch && !c.members.includes(ch)) return;
      // 予想が外れた場合の保険：相手6体のうち何体を見れるか
      let backup = 0, blind = [];
      (allOpp||targets).forEach(o=>{
        const ok = c.members.some(n=>{
          const m = rc.find(r=>r.label===n) || {name:n};
          const mu = PC.matchup(m,{name:effOpp(o)});
          return mu && mu.winsRace;
        });
        ok ? backup++ : blind.push(o);
      });
      pool.push({plan:c, mega:ch, rc, backup, blind});
    });
  });
  if(!pool.length){
    const rc = rosterForCalc(roster, null);
    const sug = PC.suggestPicks(rc, targets, Math.min(size, rc.length));
    return {plan:sug.top[0], mega:null, rc, backup:0, blind:[], all:sug.top.map(p=>({plan:p,rc,backup:0,blind:[]}))};
  }
  pool.sort((a,b)=> b.plan.cover-a.plan.cover || b.backup-a.backup || b.plan.total-a.plan.total);
  // 同じ並びが重複しないように畳む
  const seen=new Set(), uniq=[];
  pool.forEach(p=>{ const k=[...p.plan.members].sort().join('|'); if(seen.has(k))return; seen.add(k); uniq.push(p); });
  return {...uniq[0], all:uniq.slice(0,3)};
}
function currentRoster(){
  const t=currentTeam(); if(!t) return [];
  if(t.roster && t.roster.length) return t.roster;
  return (t.members||[]).map(n=>({name:n, sp:{}, moves:[]}));
}

function renderOpp(){
  const el=$('#oppChips');
  el.innerHTML = S.opp.length
    ? S.opp.map((p,i)=>{
        const megaNow = S.oppMega && PC.BASE_OF[S.oppMega]===p;
        const badge = megaNow ? `<span class="badge ng" style="margin-left:2px">→ ${esc(S.oppMega)}</span>`
                   : (PC.canMega(p) ? '<span class="badge wn" style="margin-left:2px">メガ可</span>' : '');
        return `<span class="pk">${typeChips(megaNow?S.oppMega:p)}<b>${esc(p)}</b>${badge}<span class="x" data-i="${i}">×</span></span>`;
      }).join('')
    : '<span class="pk ghost">まだ入力されていません</span>';
  el.querySelectorAll('.x').forEach((x,i)=> x.onclick=()=>{
    const removed=S.opp.splice(i,1)[0];
    const j=S.oppPick.indexOf(removed); if(j>=0) S.oppPick.splice(j,1);
    renderOpp(); saveDraft();
  });
  $('#oppCount').textContent = `${S.opp.length}/6`;
  // 予想は最初に1回だけ立てて、以降は全員が同じものを見る
  safe('予想', computePrediction, null);
  // 1か所こけても後ろを巻き込まない。黙って空にせず、その場に理由を出す
  safe('quick', renderQuick, null);
  safe('team',  renderMyTeamChips, null);
  safe('pick',  renderPickers, null);
  safe('読み',  renderLeadPredict, '#predictOut');
  safe('選出の提案', renderSuggest, '#suggestOut');
  safe('ターン', renderTurns, '#turnList');
  safe('対面ガイド', renderGuide, '#guideOut');
}
function safe(label, fn, target){
  try{ fn(); }
  catch(e){
    console.error('['+label+']', e);
    if(target && $(target)) $(target).innerHTML =
      `<div class="note r small"><b>${esc(label)}の表示に失敗しました</b><br>
       ページを再読み込みしてください（⌘+Shift+R）。直らない場合はこの文言を伝えてください：<br>
       <code style="font-size:11px">${esc(e.name+': '+e.message)}</code></div>`;
  }
}

/* よく当たる相手のクイック選択。履歴がなければ環境の使用率上位で埋める */
/* 使用率上位。相手側は「メガになる前の姿」で持つ（見せ合いでは判別できないため） */
const META_TOP = ['ガブリアス','アシレーヌ','マスカーニャ','ブリジュラス','ミミッキュ','カバルドン',
  'ギャラドス','カイリュー','メタグロス','マフォクシー','リザードン','ハッサム',
  'アーマーガア','イダイトウ♂','キラフロル','サザンドラ','ゲッコウガ','ゲンガー','ニンフィア','スコヴィラン'];
function renderQuick(){
  const seen={};
  BATTLES.forEach(b=>(b.opp_team||[]).forEach(n=>seen[n]=(seen[n]||0)+1));
  const hist=Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,14);
  const list = hist.length>=6
    ? hist.map(([n,c])=>({n,c}))
    : META_TOP.slice(0,14).map(n=>({n,c:seen[n]||0}));
  $('#quickLabel').textContent = hist.length>=6
    ? 'よく当たる相手（タップで追加）'
    : '環境の使用率上位（タップで追加）※記録が溜まるとあなたの遭遇順に切り替わります';
  $('#oppQuick').innerHTML = list.map(x=>
    `<button class="qb ${S.opp.includes(x.n)?'dim':''}" data-q="${esc(x.n)}">${typeChips(x.n)}${esc(x.n)}${x.c?`<span class="cnt">${x.c}</span>`:''}</button>`).join('');
  $$('#oppQuick .qb').forEach(b=> b.onclick=()=>{
    if(S.opp.length>=6) return toast('6匹までです',true);
    if(S.opp.includes(b.dataset.q)) return;
    S.opp.push(b.dataset.q); renderOpp(); saveDraft();
  });
}

/* 予想は1回だけ計算して、画面のどこからも同じものを参照する。
   （別々に計算し直すと、②の先発と初手チェックの先発が食い違う） */
let PRED = null;
function computePrediction(){
  const roster=currentRoster();
  if(S.opp.length<3 || roster.length<3){ PRED=null; return; }
  const size = $('#fRule').value==='double' ? 4 : 3;
  // 相手はこちらのメガの切り方を知らないので、予想はメガ未確定の状態で立てる
  const neutral = rosterForCalc(roster, null);
  const pp   = PC.predictPicks(S.opp, BATTLES, neutral, size, META_TOP);
  const lead = PC.predictLead(pp.picks, BATTLES);
  const bp   = bestPlan(roster, pp.picks, size, S.opp);
  S.predLead = lead[0] ? lead[0].name : null;
  PRED = { size, neutral, pp, picks:pp.picks, lead, bp };
}

/* 読み：相手の3体 → その中の先発 → こちらの3体 → こちらの初手 */
function renderLeadPredict(){
  const card=$('#cardLead');
  const roster=currentRoster();
  if(!PRED || S.opp.length<3 || roster.length<3){ card.hidden=true; return; }
  card.hidden=false;

  const size = PRED.size;
  const rc = PRED.neutral;

  // 的中率（先発は保存値と実績を照合、選出は過去ログの時系列で検証）
  const doneLead = BATTLES.filter(b=> b.pred_lead && (b.turns||[])[0] && b.turns[0].oppMon);
  const hitLead  = doneLead.filter(b=> PC.toBase(b.turns[0].oppMon)===b.pred_lead).length;
  const bt = PC.backtestPicks(BATTLES, rc, size, META_TOP);
  const accParts=[];
  if(bt.total) accParts.push(`選出の的中 ${pct(bt.hit,bt.total)}%（${bt.hit}/${bt.total}体・${bt.games}戦で検証）`);
  if(doneLead.length) accParts.push(`先発の的中 ${pct(hitLead,doneLead.length)}%`);
  $('#leadAcc').textContent = accParts.join(' ／ ');

  const { pp, picks:theirPicks, lead, bp } = PRED;
  const myPlan = bp.plan;
  const planRc = bp.rc;
  const myMembers = myPlan ? myPlan.members : planRc.map(m=>m.label);

  // ④ 初手は、下の「初手チェック」と同じ関数で決める（食い違わないように）
  const rank4 = leadRanking(myMembers, theirPicks, planRc, BATTLES);
  const leadAns = rank4[0] ? {n:rank4[0].name, mu:rank4[0].vsLead} : null;

  $('#predictOut').innerHTML = `
    <div class="pick-card best">
      <div class="hd"><b>① 相手はこの3体で来る</b><span class="muted">${S.opp.length}体中</span></div>
      <div class="pklist">${theirPicks.map(n=>pkChip(n,{})).join('')}</div>
      <div class="small muted" style="margin-top:7px">
        ${pp.ranked.slice(0,size).map(r=>`${esc(r.name)} ${Math.round(r.pct*100)}%${r.why.length?`（${esc(r.why.join('・'))}）`:''}`).join(' ／ ')}
      </div>
      <div class="small muted" style="margin-top:4px">外れ候補：${pp.ranked.slice(size).map(r=>`${esc(r.name)} ${Math.round(r.pct*100)}%`).join('、')||'—'}</div>
    </div>

    <div class="pick-card">
      <div class="hd"><b>② その中の先発</b></div>
      <div class="pklist">${lead.slice(0,2).map((p,i)=>
        `<span class="pk ${i===0?'sel':''}">${typeChips(p.name)}<b>${esc(p.name)}</b>
          <span class="small muted" style="margin-left:4px">${Math.round(p.pct*100)}%</span></span>`).join('')}</div>
      ${lead[0]&&lead[0].why.length?`<div class="small muted" style="margin-top:6px">${esc(lead[0].why.join('・'))}</div>`:''}
    </div>

    <div class="pick-card">
      <div class="hd"><b>③ こちらの選出</b>
        <span class="badge ${myPlan&&myPlan.cover>=size?'ok':'wn'}">${myPlan?`予想3体中 ${myPlan.cover}体に有利`:''}</span>
        <span class="badge ${bp.backup>=S.opp.length-1?'ok':(bp.backup>=S.opp.length-2?'wn':'ng')}">予想が外れても ${bp.backup}/${S.opp.length}体</span></div>
      <div class="pklist">${myMembers.map(n=>pkChip(n,{cls:bp.mega===n?'sel':''})).join('')}</div>
      ${bp.mega?`<div class="small" style="margin-top:6px"><span class="badge ok">メガは ${esc(bp.mega)} に切る</span>
        <span class="muted">（もう片方はメガ前の数値で計算しています）</span></div>`:''}
      ${bp.blind.length?`<div class="small muted" style="margin-top:6px">予想が外れて出てくると厳しい：${esc(bp.blind.join('、'))}</div>`:''}
      ${myPlan&&myPlan.sharedWeak.length?`<div class="small" style="margin-top:6px"><span class="badge ng">全員 ${esc(myPlan.sharedWeak.join('・'))} に弱い</span></div>`:''}
      <button class="btn sm" id="btnApplyPlan" style="margin-top:9px">この選出にする</button>
      ${bp.all.length>1?`<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">他の候補も見る</summary>
        ${bp.all.slice(1).map((alt,k)=>`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line2)">
          <div class="small muted">候補${k+2}　予想3体中 ${alt.plan.cover}体／外れても ${alt.backup}/${S.opp.length}体</div>
          <div class="pklist">${alt.plan.members.map(n=>pkChip(n,{cls:'tapp',data:`data-alt='${esc(JSON.stringify({m:alt.plan.members,g:alt.mega}))}'`})).join('')}</div>
        </div>`).join('')}</details>`:''}
    </div>

    <div class="pick-card">
      <div class="hd"><b>④ この3体のうち、初手はこれ</b></div>
      ${leadAns ? `<div class="pklist">${pkChip(leadAns.n,{cls:leadAns.mu.danger?'':'sel'})}</div>
        <div class="small" style="margin-top:7px">
          対 <b>${esc(S.predLead)}</b> ：${Math.round(leadAns.mu.myDmg*100)}% / 被${Math.round(leadAns.mu.opDmg*100)}%${leadAns.mu.faster?' 先制':''}
          ${leadAns.mu.danger?' <span class="badge ng">ここも不利。置いたら早めに引く前提</span>':(leadAns.mu.winsRace?' <span class="badge ok">先に落とせる</span>':' <span class="badge wn">押し切れない</span>')}
        </div>
        <div class="small muted" style="margin-top:5px">③の3体の中から選んでいます。危険対面ごとの引き先は、下の「初手チェック」に出ます。</div>`
        : '<p class="hint">初手の候補が出せませんでした。</p>'}
    </div>

    <div class="small muted">相手の型は「ぶっぱ想定」で計算しています。あくまで初手を決めるための目安です。</div>`;

  const apply=(members, mega)=>{
    setArr(S.myPick, members);
    S.mega = (mega && members.includes(mega)) ? mega : null;
    renderPickers(); renderTurns(); renderGuide(); saveDraft();
    toast(S.mega?`選出に反映（メガは ${S.mega}）`:'選出に反映しました');
  };
  const b=$('#btnApplyPlan');
  if(b) b.onclick=()=>apply(myMembers, bp.mega);
  $$('#predictOut [data-alt]').forEach(c=> c.onclick=()=>{
    const a=JSON.parse(c.dataset.alt); apply(a.m, a.g);
  });
}

/* 相手1体ごとに「自分の選出の誰を当てるべきか」 */
function renderGuide(){
  const card=$('#cardGuide'), out=$('#guideOut');
  const targets = S.oppPick.length ? S.oppPick : S.opp;
  const mine = S.myPick.length ? S.myPick : currentRoster().map(m=>m.name);
  if(!targets.length || !mine.length){ card.hidden=true; return; }
  card.hidden=false;
  const rc = rosterForCalc(currentRoster(), S.mega);
  out.innerHTML = targets.map(o=>{
    const rows = mine.map(n=>{
      const m = rc.find(r=>r.label===n) || {name:n};
      return {n, mu:PC.matchup(m,{name:effOpp(o)})};
    }).filter(x=>x.mu).sort((a,b)=> b.mu.score - a.mu.score);
    if(!rows.length) return '';
    return `<div class="mg">
      <div class="op">${typeChips(o)} ${esc(o)}</div>
      ${rows.slice(0,3).map((r,i)=>{
        const cls = r.mu.danger ? 'c' : (r.mu.winsRace ? 'a' : 'b');
        const mark = r.mu.danger ? '✕' : (r.mu.winsRace ? '◎' : '△');
        return `<div class="ans">
          <span class="rk ${cls}">${mark}</span>
          <b>${esc(r.n)}</b>
          ${i===0 && !r.mu.danger ? '<span class="badge ok">当てるならここ</span>' : ''}
          ${r.mu.faster?'<span class="badge wn">先制</span>':''}
          ${r.mu.myMove?`<span class="small muted">${esc(r.mu.myMove)}</span>`:''}
          <span class="num">${Math.round(r.mu.myDmg*100)}% / 被${Math.round(r.mu.opDmg*100)}%</span>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}
function renderMyTeamChips(){
  const r=currentRoster();
  $('#myTeamChips').innerHTML = r.length? r.map(m=>pkChip(m.name,{})).join('') : '';
}
function renderPickers(){
  const oe=$('#oppPick');
  oe.innerHTML = S.opp.length ? S.opp.map(p=>pkChip(p,{cls:'tapp '+(S.oppPick.includes(p)?'sel':''),data:`data-p="${esc(p)}"`})).join('')
    : '<span class="pk ghost">先に相手のパーティを入力</span>';
  oe.querySelectorAll('.tapp').forEach(c=> c.onclick=()=>{toggle(S.oppPick,c.dataset.p);renderPickers();renderTurns();renderGuide();saveDraft();});

  const mine=currentRoster().map(m=>m.name);
  const me=$('#myPick');
  me.innerHTML = mine.length ? mine.map(p=>pkChip(p,{cls:'tapp '+(S.myPick.includes(p)?'sel':''),data:`data-p="${esc(p)}"`})).join('')
    : '<span class="pk ghost">「構築」タブで自分の6匹を登録してください</span>';
  me.querySelectorAll('.tapp').forEach(c=> c.onclick=()=>{toggle(S.myPick,c.dataset.p);renderPickers();renderTurns();renderLead();renderGuide();saveDraft();});

  // メガにできる枠だけを候補にする（1バトル1体まで）
  const megaable = S.myPick.filter(p=> PC.isMegaForm(p) || PC.canMega(p));
  const keep=$('#fMega').value;
  $('#fMega').innerHTML='<option value="">（切らなかった／未記録）</option>'+megaable.map(p=>`<option>${esc(p)}</option>`).join('');
  if(megaable.includes(keep)) $('#fMega').value=keep;
  else if(S.mega && megaable.includes(S.mega)) $('#fMega').value=S.mega;
  else { $('#fMega').value=''; if(S.mega && !megaable.includes(S.mega)) S.mega=null; }
  renderLead(); renderGuide();
}
function toggle(a,v){const i=a.indexOf(v);i<0?a.push(v):a.splice(i,1);}
$('#fMega').addEventListener('change',()=>{S.mega=$('#fMega').value||null;saveDraft();});
$('#fTeam').onchange=()=>{setArr(S.myPick);renderMyTeamChips();renderPickers();renderSuggest();saveDraft();};

/* ---------- 似た並びとの過去実績 ----------
   選出の提案は「読みと選出」カードに一本化した。ここは実績だけを出す。 */
function renderSuggest(){
  const card=$('#cardSuggest'), out=$('#suggestOut');
  const sim = S.opp.length>=3 ? PC.similarBattles(BATTLES, S.opp, 3) : [];
  if(!sim.length){ card.hidden=true; out.innerHTML=''; return; }
  card.hidden=false;
  const agg={};
  sim.forEach(x=>{const k=[...(x.b.my_pick||[])].sort().join(' / ')||'(未記録)';
    agg[k]=agg[k]||{w:0,n:0}; agg[k].n++; if(x.b.result==='win')agg[k].w++;});
  const rows=Object.entries(agg).sort((a,b)=>b[1].n-a[1].n)
    .map(([k,v])=>`<tr class="${v.w/v.n<0.5?'bad':''}"><td>${esc(k)}<div class="bar"><i style="width:${pct(v.w,v.n)}%"></i></div></td><td class="num">${v.n}</td><td class="num">${pct(v.w,v.n)}%</td></tr>`).join('');
  out.innerHTML = `<h2>似た並びと戦った実績<span class="sub">3体以上一致・${sim.length}戦</span></h2>
    <p class="hint">実際に勝てた選出・負けた選出です。上の提案より、こちらの数字を優先してよい場面があります。</p>
    <table><tr><th>選出</th><th class="num">戦</th><th class="num">勝率</th></tr>${rows}</table>`;
}

/* ---------- 初手の順位づけと、崩れた時の逃げ道 ---------- */
/** myName が oppName に不利なとき、どうすべきか */
function escapeFor(myName, oppName, picks, rc){
  const cands = picks.filter(p=>p!==myName).map(p=>{
    const m = rc.find(r=>r.label===p) || {name:p};
    return {p, mu:PC.matchup(m,{name:effOpp(oppName)})};
  }).filter(x=>x.mu);
  const safe = cands.filter(x=>!x.mu.danger).sort((a,b)=>b.mu.score-a.mu.score);
  const me = rc.find(r=>r.label===myName) || {name:myName};
  const mine = PC.matchup(me,{name:effOpp(oppName)});
  if(safe.length && (!mine || safe[0].mu.score > mine.score + 0.4))
    return {type:'switch', to:safe[0].p, mu:safe[0].mu};
  // 引き先も無い＝耐えて殴るしかない。何発で落ちるかを出す
  return {type:'stay', mu:mine};
}
/** 予想先発の確率で重みづけして、初手の良さを順位づけする */
function leadRanking(picks, oppList, rc, battles){
  const pred = PC.predictLead(oppList, battles);
  return picks.map(n=>{
    const m = rc.find(r=>r.label===n) || {name:n};
    let ev=0, worst=99, dangers=[];
    pred.forEach(p=>{
      const mu = PC.matchup(m,{name:effOpp(p.name)});
      if(!mu) return;
      ev += p.pct * mu.score;
      if(mu.score < worst) worst = mu.score;
      if(mu.danger) dangers.push({opp:p.name, mu, pct:p.pct});
    });
    const vsLead = pred[0] ? PC.matchup(m,{name:effOpp(pred[0].name)}) : null;
    return {name:n, ev, worst, dangers, vsLead, lead:pred[0]};
  }).sort((a,b)=> b.ev - a.ev);
}

/* ---------- 初手チェック ---------- */
function renderLead(){
  const el=$('#leadOut'); const roster=currentRoster();
  if(!S.myPick.length || !S.opp.length){ el.innerHTML=''; return; }
  const rc = rosterForCalc(roster, S.mega);
  // 予想は共有のものを使う。ここで計算し直すと「読み」と食い違う
  const targets = (PRED && PRED.picks.length) ? PRED.picks : S.opp;
  const rank = leadRanking(S.myPick, targets, rc, BATTLES);
  if(!rank.length){ el.innerHTML=''; return; }

  const marks = ['①','②','③','④'];
  el.innerHTML = `<div class="small muted" style="margin-bottom:8px">
      選んだ${S.myPick.length}体のうち、<b>どれを初手に置くか</b>の順位です。相手の先発予想の確率で重みづけしています。</div>`
    + rank.map((r,i)=>{
        const grade = r.dangers.length===0 ? ['ok','安全'] :
                      (r.dangers.length<=1 ? ['wn','ほぼ安全'] : ['ng','リスク高']);
        const lead = r.vsLead;
        return `<div style="padding:10px 0;border-bottom:1px solid var(--line2)">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <b style="font-size:15px">${marks[i]||''} ${esc(r.name)}</b>
            <span class="badge ${grade[0]}">${grade[1]}</span>
            ${i===0?'<span class="badge ok">これを置く</span>':''}
          </div>
          ${lead&&r.lead?`<div class="small" style="margin-top:5px">
             予想先発 <b>${esc(r.lead.name)}</b>（${Math.round(r.lead.pct*100)}%）に
             ${Math.round(lead.myDmg*100)}% / 被${Math.round(lead.opDmg*100)}%${lead.faster?' 先制':''}
             ${lead.danger?'<span class="badge ng">不利</span>':(lead.winsRace?'<span class="badge ok">先に落とせる</span>':'<span class="badge wn">押し切れない</span>')}
           </div>`:''}
          ${r.dangers.length ? `<div style="margin-top:7px">
             ${r.dangers.map(d=>{
               const esc2=escapeFor(r.name, d.opp, S.myPick, rc);
               const plan = esc2.type==='switch'
                 ? `<b>${esc(esc2.to)}に引く</b> <span class="muted">(${Math.round(esc2.mu.myDmg*100)}% / 被${Math.round(esc2.mu.opDmg*100)}%${esc2.mu.faster?' 先制':''})</span>`
                 : (esc2.mu && esc2.mu.opHits>=3
                     ? `<b>引き先なし。${esc2.mu.opHits}発は耐えるので殴り返す</b> <span class="muted">(${Math.round(esc2.mu.myDmg*100)}%)</span>`
                     : `<b>引き先なし。切るしかない</b> <span class="muted">（${esc2.mu?esc2.mu.opHits:'?'}発で落ちる）</span>`);
               return `<div class="small" style="padding:3px 0">
                 <span class="badge ng" style="font-size:10px">危険</span>
                 ${esc(d.opp)} <span class="muted">(${Math.round(d.mu.myDmg*100)}% / 被${Math.round(d.mu.opDmg*100)}%)</span>
                 <span class="muted"> → </span>${plan}</div>`;
             }).join('')}</div>` : `<div class="small muted" style="margin-top:5px">崩される対面なし</div>`}
        </div>`;
      }).join('')
    + `<div class="small muted" style="margin-top:8px">
        危険対面は「必ず負ける」ではなく「そのまま居座ると崩される」の意味です。
        数値は「与える割合 / 受ける割合」、相手は<b>ぶっぱ想定</b>で計算しています。</div>`;
}

/* ---------- ターンログ ---------- */
function fieldAt(i){
  let my = S.myPick[0]||'', op = S.oppPick[0]||'';
  for(let k=0;k<i;k++){
    const t=S.turns[k]; if(!t) continue;
    if(t.myAct && t.myAct.type==='switch' && t.myAct.to) my=t.myAct.to;
    if(t.oppAct && t.oppAct.type==='switch' && t.oppAct.to) op=t.oppAct.to;
  }
  return {my,op};
}
/* メガシンカは「行動」ではなく、技や交代と同じターンに同時に起きる。
   なので行動タイプから外し、独立したチェックにしている。 */
const ACTS=[['move','技'],['switch','交代'],['protect','まもる'],['other','その他']];
function normAct(a){                     // 旧データ（type:'mega'）を読み替える
  a = a || {type:'move'};
  if(a.type==='mega'){ return {type:'move', move:a.move||'', mega:true, megaTo:a.to||''}; }
  return a;
}
/** メガは1バトル1回きり。他のターンで既に切っていたら、そのターンは選べない */
function myMegaLocked(i){ return S.turns.some((t,j)=> j!==i && t.myAct && t.myAct.mega); }
function oppMegaLocked(i){ return S.turns.some((t,j)=> j!==i && t.oppAct && t.oppAct.mega); }
function renderTurns(){
  const list=$('#turnList');
  if(!S.myPick.length){
    list.innerHTML='<p class="hint">自分の選出だけ決めれば、相手の3体が分からなくてもターンを記録できます。</p>';
    $('#turnField').textContent=''; return;
  }
  const oppChoices = S.opp.length ? S.opp : S.oppPick;    // 相手は「分かっている全員」から選ぶ
  list.innerHTML = S.turns.map((t,i)=>{
    const f=fieldAt(i);
    const myMon=t.myMon||f.my, opMon=t.oppMon||f.op;
    t.myAct = normAct(t.myAct); t.oppAct = normAct(t.oppAct);
    const myMoves=(currentRoster().find(r=>r.name===myMon)||{}).moves||[];
    const mySel = myMoves.filter(Boolean);
    return `<div class="turn">
      <div class="th"><span class="no">${i+1}手目</span>
        <select data-t="${i}" data-k="myMon" style="padding:4px 8px;font-size:12px;width:auto;flex:0 1 auto">
          ${S.myPick.map(p=>`<option ${myMon===p?'selected':''}>${esc(p)}</option>`).join('')}
        </select>
        <span class="muted">vs</span>
        <select data-t="${i}" data-k="oppMon" style="padding:4px 8px;font-size:12px;width:auto;flex:0 1 auto">
          <option value="">相手を選ぶ</option>
          ${oppChoices.map(p=>`<option ${opMon===p?'selected':''}>${esc(p)}</option>`).join('')}
        </select>
        <span style="flex:1"></span><button class="btn ghost sm" data-del="${i}">削除</button></div>
      <div class="side"><span class="lb me">自分</span>
        <select data-t="${i}" data-k="myType">${ACTS.map(a=>`<option value="${a[0]}" ${t.myAct.type===a[0]?'selected':''}>${a[1]}</option>`).join('')}</select>
        ${t.myAct.type==='move'
          ? (mySel.length
             ? `<select data-t="${i}" data-k="myMove"><option value="">技を選ぶ</option>${mySel.map(m=>`<option ${t.myAct.move===m?'selected':''}>${esc(m)}</option>`).join('')}</select>`
             : `<input type="text" data-t="${i}" data-k="myMove" value="${esc(t.myAct.move||'')}" placeholder="技名">`)
          : t.myAct.type==='switch'
          ? `<select data-t="${i}" data-k="myTo"><option value="">誰に交代？</option>${S.myPick.filter(p=>p!==myMon).map(p=>`<option ${t.myAct.to===p?'selected':''}>${esc(p)}</option>`).join('')}</select>`
          : ''}
        ${(PC.isMegaForm(myMon)||PC.canMega(myMon))
          ? `<label class="mgchk ${t.myAct.mega?'on':''}" ${myMegaLocked(i)?'style="opacity:.4"':''}>
               <input type="checkbox" data-t="${i}" data-k="myMega" ${t.myAct.mega?'checked':''} ${myMegaLocked(i)?'disabled':''}>
               このターンにメガ</label>` : ''}
      </div>
      <div class="side"><span class="lb op">相手</span>
        <select data-t="${i}" data-k="opType">${ACTS.map(a=>`<option value="${a[0]}" ${t.oppAct.type===a[0]?'selected':''}>${a[1]}</option>`).join('')}</select>
        ${t.oppAct.type==='move'
          ? `<input type="text" data-t="${i}" data-k="opMove" value="${esc(t.oppAct.move||'')}" placeholder="使ってきた技" list="mvlist">`
          : t.oppAct.type==='switch'
          ? `<select data-t="${i}" data-k="opTo"><option value="">誰に交代？</option>${oppChoices.filter(p=>p!==opMon).map(p=>`<option ${t.oppAct.to===p?'selected':''}>${esc(p)}</option>`).join('')}</select>`
          : ''}
        ${PC.megaFormsOf(opMon).length
          ? `<label class="mgchk ${t.oppAct.mega?'on':''}" ${oppMegaLocked(i)?'style="opacity:.4"':''}>
               <input type="checkbox" data-t="${i}" data-k="opMega" ${t.oppAct.mega?'checked':''} ${oppMegaLocked(i)?'disabled':''}>
               メガ</label>
             ${t.oppAct.mega && PC.megaFormsOf(opMon).length>1
               ? `<select data-t="${i}" data-k="opMegaTo"><option value="">どれ？</option>${PC.megaFormsOf(opMon).map(m=>`<option ${t.oppAct.megaTo===m?'selected':''}>${esc(m)}</option>`).join('')}</select>`
               : ''}` : ''}
      </div>
      ${t.oppAct.type==='move' && obsHint(opMon) ? `<div class="small muted">よく使ってくる技：${obsHint(opMon)}</div>`:''}
    </div>`;
  }).join('') || '<p class="hint">まだターンが記録されていません。</p>';

  if(!$('#mvlist')){ const dl=document.createElement('datalist'); dl.id='mvlist';
    dl.innerHTML=MOVE_NAMES.map(m=>`<option value="${esc(m)}">`).join(''); document.body.appendChild(dl); }

  list.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>{S.turns.splice(+b.dataset.del,1);renderTurns();saveDraft();});
  list.querySelectorAll('[data-t]').forEach(el=> el.addEventListener('change',()=>{
    const i=+el.dataset.t, k=el.dataset.k, v=el.value, t=S.turns[i];
    if(k==='myType'){t.myAct={type:v};} else if(k==='opType'){t.oppAct={type:v};}
    else if(k==='myMove')t.myAct.move=v; else if(k==='myTo')t.myAct.to=v;
    else if(k==='opMove')t.oppAct.move=v; else if(k==='opTo')t.oppAct.to=v;
    else if(k==='myMega'){
      t.myAct.mega = el.checked;
      S.mega = el.checked ? (t.myMon || fieldAt(i).my) : null;
    }
    else if(k==='opMega'){
      t.oppAct.mega = el.checked;
      const forms = PC.megaFormsOf(t.oppMon || fieldAt(i).op);
      t.oppAct.megaTo = el.checked ? (forms.length===1 ? forms[0] : (t.oppAct.megaTo||'')) : '';
      S.oppMega = t.oppAct.megaTo || null;
    }
    else if(k==='opMegaTo'){ t.oppAct.megaTo=v; S.oppMega=v||null; }
    else if(k==='myMon') t.myMon=v;
    else if(k==='oppMon') t.oppMon=v;
    // バトル中に判明した相手は、そのまま「相手の選出」に積み上がる
    [t.oppMon, t.oppAct && t.oppAct.to].forEach(n=>{
      if(!n) return;
      if(!S.opp.includes(n)) S.opp.push(n);
      if(!S.oppPick.includes(n)) S.oppPick.push(n);
    });
    // 相手がメガを解除する記録は無いので、mega行動を消したら判明状態も戻す
    // 記録から消えたら、判明状態も戻す
    S.oppMega = (S.turns.find(x=>x.oppAct&&x.oppAct.mega&&x.oppAct.megaTo)||{}).oppAct?.megaTo || null;
    S.mega    = (S.turns.find(x=>x.myAct&&x.myAct.mega) ? (S.turns.find(x=>x.myAct&&x.myAct.mega).myMon||S.mega) : S.mega);
    renderTurns(); renderOpp(); renderPickers(); saveDraft();
  }));
  const f=fieldAt(S.turns.length);
  $('#turnField').textContent = `現在の場：${f.my} vs ${f.op}`;
}
function obsHint(mon){
  const o=(PC.observedMoves(BATTLES)[mon]||[]).slice(0,4);
  return o.length? o.map(x=>`${esc(x.move)}(${x.count})`).join('、') : '';
}
$('#btnAddTurn').onclick=()=>{
  if(!S.myPick.length) return toast('自分の選出だけ先に決めてください',true);
  const f=fieldAt(S.turns.length);
  S.turns.push({n:S.turns.length+1, myMon:f.my, oppMon:f.op, myAct:{type:'move'}, oppAct:{type:'move'}});
  renderTurns(); saveDraft();
};

/* ---------- 結果 ---------- */
$('#btnWin').onclick=()=>setRes('win'); $('#btnLose').onclick=()=>setRes('lose');
function setRes(r){ S.result=(S.result===r?null:r);
  $('#btnWin').classList.toggle('on',S.result==='win'); $('#btnLose').classList.toggle('on',S.result==='lose'); saveDraft(); }

/* ---------- 下書き / 状況の引き継ぎ ---------- */
function saveDraft(){
  const d={date:$('#fDate').value,season:$('#fSeason').value,rule:$('#fRule').value,rank:$('#fRank').value,
    team:$('#fTeam').value,opp:S.opp,oppPick:S.oppPick,myPick:S.myPick,result:S.result,mega:S.mega,
    oppMega:S.oppMega,predLead:S.predLead,
    turns:S.turns,reason:$('#fReason').value,sets:$('#fSets').value,key:$('#fKey').value,next:$('#fNext').value,editId:EDIT_ID};
  try{localStorage.setItem(DRAFT,JSON.stringify(d));
      localStorage.setItem(CTX,JSON.stringify({season:d.season,rule:d.rule,rank:d.rank,team:d.team}));}catch(e){}
}
['#fSeason','#fRank','#fReason','#fSets','#fKey','#fNext','#fDate','#fRule'].forEach(s=>$(s).addEventListener('input',saveDraft));
$('#fRule').addEventListener('change',renderSuggest);

function restoreDraft(){
  fillTeamSelects();
  let ctx=null,d=null;
  try{ctx=JSON.parse(localStorage.getItem(CTX)||'null');}catch(e){}
  try{d=JSON.parse(localStorage.getItem(DRAFT)||'null');}catch(e){}
  const last = BATTLES[0];
  const src = d || ctx || (last? {season:last.season,rule:last.rule,rank:last.rank,team:last.team_id} : null);
  if(src){
    if(src.season) $('#fSeason').value=src.season;
    if(src.rule)   $('#fRule').value=src.rule;
    if(src.rank)   $('#fRank').value=src.rank;
    if(src.team && TEAMS.some(t=>t.id===src.team)) $('#fTeam').value=src.team;
  }
  $('#ctxAuto').textContent = d? '入力途中を復元しました' : (src? '前回の設定を引き継ぎました' : '');
  $('#fDate').value = (d&&d.date)||todayStr();
  if(d){
    setArr(S.opp,d.opp);setArr(S.oppPick,d.oppPick);setArr(S.myPick,d.myPick);setArr(S.turns,d.turns);
    S.result=d.result||null;S.mega=d.mega||null;S.oppMega=d.oppMega||null;S.predLead=d.predLead||null;
    EDIT_ID=d.editId||null;
    $('#fReason').value=d.reason||'';$('#fSets').value=d.sets||'';$('#fKey').value=d.key||'';$('#fNext').value=d.next||'';
    $('#btnWin').classList.toggle('on',S.result==='win');$('#btnLose').classList.toggle('on',S.result==='lose');
    $('#btnSave').textContent=EDIT_ID?'この試合を更新する':'この試合を保存する';
  }
  renderOpp();
}
function clearForm(){
  setArr(S.opp);setArr(S.oppPick);setArr(S.myPick);setArr(S.turns);
  S.result=null;S.mega=null;S.oppMega=null;S.predLead=null;EDIT_ID=null;
  ['#fReason','#fSets','#fKey','#fNext'].forEach(s=>$(s).value='');
  $('#btnWin').classList.remove('on');$('#btnLose').classList.remove('on');
  $('#btnSave').textContent='この試合を保存する';
  localStorage.removeItem(DRAFT); renderOpp();
}
$('#btnClear').onclick=()=>{ if(confirm('入力中の内容を消します。よろしいですか？')) clearForm(); };

/* ---------- 保存 ---------- */
$('#btnSave').onclick=async ()=>{
  if(!S.result) return toast('勝ち／負けを選んでください',true);
  if(!S.opp.length) return toast('相手のポケモンを入れてください',true);
  if(!$('#fReason').value.trim() && !confirm('勝因/敗因が空です。ここが一番効くところですが、このまま保存しますか？')) return;
  const rec={user_id:USER.id, team_id:$('#fTeam').value||null, played_at:$('#fDate').value||todayStr(),
    season:$('#fSeason').value||null, rule:$('#fRule').value, rank:$('#fRank').value||null,
    opp_team:S.opp, my_pick:S.myPick, opp_pick:S.oppPick, mega:S.mega||null,
    opp_mega:S.oppMega||null, pred_lead:S.predLead||null, turns:S.turns,
    result:S.result, reason:$('#fReason').value.trim()||null, key_turn:$('#fKey').value.trim()||null,
    next_plan:$('#fNext').value.trim()||null, opp_sets:$('#fSets').value.trim()||null};
  $('#btnSave').disabled=true;
  const res = EDIT_ID ? await dbWrite('battles','update',rec,EDIT_ID)
                      : await dbWrite('battles','insert',rec);
  $('#btnSave').disabled=false;
  if(!res.ok) return toast('保存に失敗: '+res.error.message,true);
  const wasEdit=!!EDIT_ID;
  await loadBattles(); clearForm(); renderAll();
  res.dropped.length ? warnDropped(res.dropped)
    : toast(wasEdit?'更新しました':`保存しました（通算 ${BATTLES.length} 戦）`);
  window.scrollTo({top:0,behavior:'smooth'});
};

/* =========================================================
   ダメージ計算
   ========================================================= */
let dmgState={a:'',d:'',move:''};
function initDamageUI(){
  const rankOpts = [6,5,4,3,2,1,0,-1,-2,-3,-4,-5,-6].map(v=>`<option value="${v}" ${v===0?'selected':''}>${v>0?'+':''}${v}</option>`).join('');
  $('#dARank').innerHTML=rankOpts; $('#dDRank').innerHTML=rankOpts;
  $('#dAItem').innerHTML=ITEMS.map(i=>`<option value="${i}">${i||'なし'}</option>`).join('');
  $('#dDItem').innerHTML=ITEMS.map(i=>`<option value="${i}">${i||'なし'}</option>`).join('');
  $('#dAAbil').innerHTML=ABILITIES.map(i=>`<option value="${i}">${i||'なし'}</option>`).join('');
  $('#dDAbil').innerHTML=ABILITIES.map(i=>`<option value="${i}">${i||'なし'}</option>`).join('');
  autocomplete('#dA','#dAsug', speciesSource, n=>{dmgState.a=n;$('#dA').value=n;prefillFromRoster('a',n);calcNow();});
  autocomplete('#dD','#dDsug', speciesSource, n=>{dmgState.d=n;$('#dD').value=n;prefillFromRoster('d',n);calcNow();});
  autocomplete('#dMove','#dMovesug', q=>{
    const hit=n=>!q||n.includes(q);
    return MOVE_NAMES.filter(hit).sort((a,b)=>a.indexOf(q)-b.indexOf(q)||a.length-b.length);
  }, n=>{dmgState.move=n;$('#dMove').value=n;calcNow();}, {types:false});
  ['#dASide','#dDSide','#dARank','#dDRank','#dAItem','#dDItem','#dAAbil','#dDAbil','#dDSpread','#dRefl','#dBurn','#dCrit','#dFull','#dWeather']
    .forEach(s=>$(s).addEventListener('change',calcNow));
  $('#btnRev').onclick=reverseCalc;
}
function prefillFromRoster(which,name){
  const m=currentRoster().find(r=>r.name===name); if(!m) return;
  if(which==='a'){ if(m.item) $('#dAItem').value=ITEMS.includes(m.item)?m.item:''; if(m.ability&&ABILITIES.includes(m.ability))$('#dAAbil').value=m.ability; $('#dASide').value='me'; }
  else { if(m.item) $('#dDItem').value=ITEMS.includes(m.item)?m.item:''; if(m.ability&&ABILITIES.includes(m.ability))$('#dDAbil').value=m.ability; $('#dDSide').value='me'; }
}
function sideStats(name, side, key, spreadKind){
  // side==='me' なら登録済みの実数値、'op' なら想定値
  if(side==='me'){
    const m=currentRoster().find(r=>r.name===name);
    if(m && m.sp){ const st=PC.realStats(name,m.sp,m.nature); if(st) return {val:st[key], src:'登録した実数値'}; }
  }
  return {val:PC.assumedStat(name,key,spreadKind||'max'), src:(spreadKind==='none'?'無振り想定':spreadKind==='hp'?'H32想定':'ぶっぱ想定')};
}
function calcNow(){
  const an=dmgState.a||$('#dA').value.trim(), dn=dmgState.d||$('#dD').value.trim(), mn=dmgState.move||$('#dMove').value.trim();
  const out=$('#dmgOut');
  if(!PC.SPECIES[an]||!PC.SPECIES[dn]||!PC.MOVES[mn]){ out.innerHTML='<p class="hint">攻撃側・技・防御側を入れると計算します。</p>'; return; }
  const mv=PC.MOVES[mn], aSide=$('#dASide').value, dSide=$('#dDSide').value, spread=$('#dDSpread').value;
  const atkKey = mv.cat==='物'?'a':'c', defKey = mv.cat==='物'?'b':'d';
  const A=sideStats(an,aSide,atkKey,'max');
  const D=sideStats(dn,dSide,defKey,spread);
  const H=sideStats(dn,dSide,'h',spread==='none'?'none':'max');
  $('#dAInfo').textContent = `${mv.cat==='物'?'攻撃':'特攻'} ${A.val}（${A.src}）／ ${mv.type}・威力${mv.power||'-'}・${mv.cat}`;
  $('#dDInfo').textContent = `${mv.cat==='物'?'防御':'特防'} ${D.val}／HP ${H.val}（${D.src}）`;

  const r=PC.calcDamage({
    attacker:{name:an, atkStat:A.val, types:PC.SPECIES[an].types, ability:$('#dAAbil').value,
      item:$('#dAItem').value, rank:+$('#dARank').value, hpRatio:1},
    defender:{name:dn, defStat:D.val, hp:H.val, types:PC.SPECIES[dn].types, ability:$('#dDAbil').value,
      item:$('#dDItem').value, rank:+$('#dDRank').value, hpRatio:$('#dFull').checked?1:0.5},
    move:mv,
    field:{weather:$('#dWeather').value, reflect:$('#dRefl').checked && mv.cat==='物',
      lightscreen:$('#dRefl').checked && mv.cat==='特', burn:$('#dBurn').checked},
    flags:{critical:$('#dCrit').checked}
  });
  if(r.error){ out.innerHTML=`<div class="note w">${esc(r.error)}</div>`; return; }
  if(r.eff===0){ out.innerHTML=`<div class="note r">タイプ相性で<b>無効</b>です。</div>`; return; }
  const effTxt = r.eff>=4?'こうかちょうバツグン（4倍）':r.eff===2?'こうかバツグン（2倍）':r.eff===1?'等倍':r.eff===0.5?'いまひとつ（1/2）':'かなりいまひとつ（1/4）';
  out.innerHTML=`
    <div style="font-size:22px;font-weight:800">${r.pctMin.toFixed(1)}% 〜 ${r.pctMax.toFixed(1)}%</div>
    <div class="small muted">ダメージ ${r.min}〜${r.max} ／ 相手のHP ${H.val}</div>
    <div class="dmgbar"><i style="width:${Math.min(100,r.pctMax)}%"></i><span>${esc(r.ko)}</span></div>
    <div class="small"><span class="badge ${r.eff>1?'ok':r.eff<1?'ng':'wn'}">${effTxt}</span></div>
    ${r.note.length?`<div class="small muted" style="margin-top:8px">${r.note.map(esc).join(' ／ ')}</div>`:''}`;
}
/* 逆算：受けたダメージの実数値から、相手の振り方・持ち物を絞る（くろこ流） */
function syncRev(){
  const max=+$('#revMax').value||0, now=$('#revNow').value, dmg=$('#revDmg').value;
  if(max && now!=='' && dmg===''){ $('#revDmg').value = Math.max(0, max-(+now)); }
  const d=+$('#revDmg').value||0;
  $('#revPctShow').textContent = (max&&d) ? `＝ 最大HPの ${(d/max*100).toFixed(1)}%` : '';
}
['#revMax','#revNow'].forEach(s=>$(s).addEventListener('input',()=>{ $('#revDmg').value=''; syncRev(); }));
$('#revDmg').addEventListener('input', syncRev);

function reverseCalc(){
  const an=dmgState.a||$('#dA').value.trim(), dn=dmgState.d||$('#dD').value.trim(), mn=dmgState.move||$('#dMove').value.trim();
  const out=$('#revOut');
  syncRev();
  const maxHp=+$('#revMax').value||0, dmg=+$('#revDmg').value||0;
  if(!PC.SPECIES[an]||!PC.SPECIES[dn]||!PC.MOVES[mn]||!dmg||!maxHp){
    out.innerHTML='<div class="note w">攻撃側・技・防御側と、最大HP・受けたダメージを入れてください。</div>'; return; }
  const target = dmg/maxHp*100;
  const mv=PC.MOVES[mn];
  const atkKey=mv.cat==='物'?'a':'c', defKey=mv.cat==='物'?'b':'d';
  const D=sideStats(dn,$('#dDSide').value,defKey,$('#dDSpread').value);
  const spreads=[['攻撃ぶっぱ＋性格補正','max'],['攻撃ぶっぱ（無補正）','hp'],['攻撃無振り','none']];
  const items=['','いのちのたま','こだわりハチマキ','こだわりメガネ','たつじんのおび','タイプ強化アイテム'];
  const hit=[], miss=[];
  spreads.forEach(([label,kind])=>{
    const atk=PC.assumedStat(an,atkKey,kind);
    items.forEach(it=>{
      if(it==='こだわりハチマキ'&&mv.cat!=='物')return;
      if(it==='こだわりメガネ'&&mv.cat!=='特')return;
      const r=PC.calcDamage({
        attacker:{name:an,atkStat:atk,types:PC.SPECIES[an].types,ability:'',item:it,rank:0,hpRatio:1},
        defender:{name:dn,defStat:D.val,hp:maxHp,types:PC.SPECIES[dn].types,ability:$('#dDAbil').value,item:$('#dDItem').value,rank:0,hpRatio:1},
        move:mv, field:{weather:$('#dWeather').value}, flags:{}
      });
      if(r.error||r.eff===0) return;
      const row={label, item:it||'持ち物なし', range:`${r.min}〜${r.max}（${r.pctMin.toFixed(1)}〜${r.pctMax.toFixed(1)}%）`, atk};
      (dmg>=r.min && dmg<=r.max) ? hit.push(row) : miss.push(row);
    });
  });

  // 「否定できたもの」＝どの振り方でもこの数字が出せなかった持ち物 / 振り方
  const hitItems=new Set(hit.map(h=>h.item)), hitSpreads=new Set(hit.map(h=>h.label));
  const allItems=new Set(miss.concat(hit).map(h=>h.item)), allSpreads=new Set(miss.concat(hit).map(h=>h.label));
  const deniedItems=[...allItems].filter(i=>!hitItems.has(i));
  const deniedSpreads=[...allSpreads].filter(s=>!hitSpreads.has(s));

  out.innerHTML = hit.length
    ? `<div class="note g small">受けた <b>${dmg}</b>（${target.toFixed(1)}%）から、<b>${hit.length}通り</b>に絞れました。</div>
       <table style="margin-top:8px"><tr><th>相手の想定</th><th>持ち物</th><th>この場合のダメージ</th><th class="num">実数値</th></tr>
       ${hit.map(c=>`<tr><td>${esc(c.label)}</td><td>${esc(c.item)}</td><td class="small muted">${esc(c.range)}</td><td class="num">${c.atk}</td></tr>`).join('')}</table>
       ${(deniedItems.length||deniedSpreads.length)?`<div class="note r small" style="margin-top:10px">
          <b>この時点で否定できたもの</b><br>
          ${deniedItems.length?`持ち物：${deniedItems.map(esc).join('・')} ではない<br>`:''}
          ${deniedSpreads.length?`振り方：${deniedSpreads.map(esc).join('・')} ではない`:''}
       </div>`:''}
       <div class="small muted" style="margin-top:8px">絞り切れないときは、次に食らったダメージでもう一度かけると更に減ります。分かったことは「判明した相手の型」欄に残しておくと次戦で効きます。</div>`
    : `<div class="note w">該当する組み合わせが見つかりませんでした。特性（かたいツメ・テクニシャン・てきおうりょく等）、天候、能力ランク、急所が絡んでいる可能性があります。防御側の「耐久の想定」を変えて試してください。</div>`;
}

/* =========================================================
   相談（原則集 ＋ 自動診断）
   ========================================================= */
let ADVICE_TAG = null;
function diagnose(){
  const B = BATTLES, on = new Set();
  const w = n => { const s=B.slice(0,n); return {n:s.length, w:s.filter(b=>b.result==='win').length}; };
  if(B.length < 30) on.add('fewBattles');
  const r10 = w(10);
  if(r10.n>=8 && r10.w/r10.n < 0.4) on.add('slump');
  if(B.length>=20 && B.filter(b=>b.result==='win').length/B.length < 0.42) on.add('lowWin');
  // 直近の連敗
  let streak=0; for(const b of B){ if(b.result==='lose') streak++; else break; }
  if(streak>=3) on.add('losingStreak');
  // 連勝＝ここで崩れやすい
  let win=0; for(const b of B){ if(b.result==='win') win++; else break; }
  if(win>=4) on.add('winStreak');
  // 同じ構築を長く使って勝率が落ちている
  const byTeam={}; B.forEach(b=>{const k=b.team_id||'-';byTeam[k]=byTeam[k]||{n:0,w:0};byTeam[k].n++;if(b.result==='win')byTeam[k].w++;});
  Object.values(byTeam).forEach(v=>{ if(v.n>=30 && v.w/v.n<0.45) on.add('stuckTeam'); });
  Object.values(byTeam).forEach(v=>{ if(v.n>0 && v.n<6) on.add('newTeamLowSample'); });
  // 記録の質
  if(B.length>=10 && B.filter(b=>!b.reason).length/B.length > 0.3) on.add('noReason');
  if(B.length>=10 && B.filter(b=>!(b.turns||[]).length).length/B.length > 0.5) on.add('noTurns');
  if(B.length>=15 && !B.some(b=>(b.opp_sets||'').trim())) on.add('noCalcHabit');
  // 明確に負けている相手がいる
  const opp={}; B.forEach(b=>new Set(b.opp_team||[]).forEach(p=>{opp[p]=opp[p]||{n:0,w:0};opp[p].n++;if(b.result==='win')opp[p].w++;}));
  if(Object.values(opp).some(v=>v.n>=4 && v.w/v.n<0.35)) on.add('badMatchup');
  // 今の入力に未遭遇の相手がいる
  if(S.opp.some(n=>!opp[n])) on.add('unknownOpp');
  return on;
}
function renderAdvice(){
  const on = diagnose();
  const auto = (window.PRINCIPLES||[]).filter(p=>(p.when||[]).some(t=>on.has(t)));
  $('#adviceAuto').innerHTML = auto.length
    ? auto.map(p=>adviceCard(p,true)).join('')
    : '<p class="hint">いまのところ、データから引っかかるものはありません。このまま数を積みましょう。</p>';

  const tags=[...new Set((window.PRINCIPLES||[]).flatMap(p=>p.tags||[]))];
  $('#adviceTags').innerHTML = tags.map(t=>
    `<button class="qb ${ADVICE_TAG===t?'':''}" data-tag="${esc(t)}" style="${ADVICE_TAG===t?'border-color:var(--red);background:var(--redsoft)':''}">${esc(t)}</button>`).join('')
    + `<button class="qb" data-tag="" style="${!ADVICE_TAG?'border-color:var(--red);background:var(--redsoft)':''}">すべて</button>`;
  $$('#adviceTags .qb').forEach(b=> b.onclick=()=>{ ADVICE_TAG=b.dataset.tag||null; renderAdvice(); });

  const list=(window.PRINCIPLES||[]).filter(p=>!ADVICE_TAG||(p.tags||[]).includes(ADVICE_TAG));
  $('#adviceList').innerHTML = list.map(p=>adviceCard(p,false)).join('');
}
function adviceCard(p, highlight){
  const body = esc(p.body)
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
  return `<div class="card" style="${highlight?'border-color:var(--red);background:var(--redsoft)':''}">
    <h2 style="margin-bottom:4px">${highlight?'<span class="num">!</span>':''}${esc(p.title)}</h2>
    <div class="small muted" style="margin-bottom:10px">${(p.tags||[]).map(t=>`#${esc(t)}`).join(' ')} ・ 出典: ${esc(p.src)}</div>
    <div style="font-size:14px"><p>${body}</p></div>
  </div>`;
}

/* =========================================================
   分析
   ========================================================= */
['#sTeam','#sRule'].forEach(s=>$(s).addEventListener('change',renderStats));
function statSet(){
  const t=$('#sTeam').value,r=$('#sRule').value;
  return BATTLES.filter(b=>(!t||b.team_id===t)&&(!r||b.rule===r));
}
function tbl(rows,head){
  if(!rows.length) return '<p class="hint">データがまだ足りません。</p>';
  return `<table><tr>${head.map(h=>`<th class="${h.num?'num':''}">${h.t}</th>`).join('')}</tr>${rows.join('')}</table>`;
}
function rateRow(label,w,n,bad,extra){
  const p=pct(w,n);
  return `<tr class="${bad?'bad':''}"><td>${esc(label)}<div class="bar"><i style="width:${p}%"></i></div></td>${extra||''}<td class="num">${n}</td><td class="num">${p}%</td></tr>`;
}
function renderStats(){
  const B=statSet(), w=B.filter(b=>b.result==='win').length;
  const rec=B.slice(0,20), rw=rec.filter(b=>b.result==='win').length;
  const td=B.filter(b=>b.played_at===todayStr()), tw=td.filter(b=>b.result==='win').length;
  $('#kpis').innerHTML=`
    <div class="kpi"><div class="k">通算</div><div class="v">${B.length}<span style="font-size:14px">戦</span></div><div class="s">${w}勝 ${B.length-w}敗</div></div>
    <div class="kpi"><div class="k">勝率</div><div class="v">${pct(w,B.length)}<span style="font-size:14px">%</span></div><div class="s">${B.length<30?'30戦未満は参考値':'十分な母数'}</div></div>
    <div class="kpi"><div class="k">直近20戦</div><div class="v">${pct(rw,rec.length)}<span style="font-size:14px">%</span></div><div class="s">${rw}勝 ${rec.length-rw}敗</div></div>
    <div class="kpi"><div class="k">今日</div><div class="v">${td.length}<span style="font-size:14px">戦</span></div><div class="s">${tw}勝 ${td.length-tw}敗</div></div>`;

  const opp={};
  B.forEach(b=> new Set(b.opp_team||[]).forEach(p=>{opp[p]=opp[p]||{n:0,w:0};opp[p].n++;if(b.result==='win')opp[p].w++;}));
  const oppArr=Object.entries(opp).map(([p,v])=>({p,...v}));
  const bad=oppArr.filter(x=>x.n>=3).sort((a,b)=>(a.w/a.n)-(b.w/b.n)||b.n-a.n);
  $('#tblOppBad').innerHTML=tbl(bad.slice(0,10).map(x=>rateRow(x.p,x.w,x.n,x.w/x.n<0.5)),
    [{t:'相手のポケモン'},{t:'遭遇',num:1},{t:'勝率',num:1}]);
  $('#tblOppRate').innerHTML=tbl(oppArr.sort((a,b)=>b.n-a.n).slice(0,20).map(x=>
    `<tr><td>${esc(x.p)}<div class="bar b"><i style="width:${pct(x.n,B.length)}%"></i></div></td><td class="num">${x.n}</td><td class="num">${pct(x.n,B.length)}%</td></tr>`),
    [{t:'相手のポケモン'},{t:'遭遇',num:1},{t:'遭遇率',num:1}]);

  const mg={};
  B.forEach(b=>{const k=b.mega||'（切らなかった／未記録）';mg[k]=mg[k]||{n:0,w:0};mg[k].n++;if(b.result==='win')mg[k].w++;});
  $('#tblMega').innerHTML=tbl(Object.entries(mg).map(([p,v])=>({p,...v})).sort((a,b)=>b.n-a.n)
    .map(x=>rateRow(x.p,x.w,x.n,x.w/x.n<0.45,`<td class="num">${pct(x.n,B.length)}%</td>`)),
    [{t:'メガ枠'},{t:'選出比',num:1},{t:'回数',num:1},{t:'勝率',num:1}]);

  const combo={};
  B.forEach(b=>{if(!(b.my_pick||[]).length)return;const k=[...b.my_pick].sort().join(' / ');
    combo[k]=combo[k]||{n:0,w:0};combo[k].n++;if(b.result==='win')combo[k].w++;});
  $('#tblCombo').innerHTML=tbl(Object.entries(combo).map(([p,v])=>({p,...v})).filter(x=>x.n>=2)
    .sort((a,b)=>b.n-a.n).slice(0,15).map(x=>rateRow(x.p,x.w,x.n,x.w/x.n<0.45)),
    [{t:'選出パターン'},{t:'回数',num:1},{t:'勝率',num:1}]);

  const mine={};
  B.forEach(b=> new Set(b.my_pick||[]).forEach(p=>{mine[p]=mine[p]||{n:0,w:0};mine[p].n++;if(b.result==='win')mine[p].w++;}));
  $('#tblMyPick').innerHTML=tbl(Object.entries(mine).map(([p,v])=>({p,...v})).filter(x=>x.n>=3)
    .sort((a,b)=>(b.w/b.n)-(a.w/a.n)).map(x=>rateRow(x.p,x.w,x.n,x.w/x.n<0.45)),
    [{t:'自分の選出'},{t:'選出',num:1},{t:'勝率',num:1}]);

  const obs=PC.observedMoves(B);
  const obsRows=Object.entries(obs).sort((a,b)=>b[1].reduce((s,x)=>s+x.count,0)-a[1].reduce((s,x)=>s+x.count,0))
    .slice(0,20).map(([p,list])=>`<tr><td>${typeChips(p)} ${esc(p)}</td><td class="small">${list.slice(0,5).map(x=>`${esc(x.move)} <span class="muted">${Math.round(x.rate*100)}%</span>`).join('、')}</td></tr>`);
  $('#tblObs').innerHTML=tbl(obsRows,[{t:'ポケモン'},{t:'よく使ってくる技'}]);

  const tm={};
  BATTLES.forEach(b=>{const k=b.team_id||'—';tm[k]=tm[k]||{n:0,w:0};tm[k].n++;if(b.result==='win')tm[k].w++;});
  $('#tblTeam').innerHTML=tbl(Object.entries(tm).map(([id,v])=>({name:(TEAMS.find(t=>t.id===id)||{}).name||'未設定',...v}))
    .sort((a,b)=>b.n-a.n).map(x=>rateRow(x.name,x.w,x.n,x.n>=20&&x.w/x.n<0.45)),
    [{t:'構築'},{t:'戦数',num:1},{t:'勝率',num:1}]);

  renderFeedback(B,bad,mg,combo);
}
function renderFeedback(B,bad,mg,combo){
  const el=$('#feedback'); const out=[];
  if(B.length<20){ out.push(['b',`まだ ${B.length} 戦です。<b>30〜50戦</b>回さないと、構築の良し悪しも運負けかどうかも判別できません。まずは数を積むところからです。`]); }
  const worst=bad.filter(x=>x.w/x.n<0.4)[0];
  if(worst) out.push(['r',`<b>${esc(worst.p)}</b> がいる試合の勝率が <b>${pct(worst.w,worst.n)}%</b>（${worst.n}戦）。ここが今いちばん大きい穴です。対策の駒か、選出の型を決めましょう。`]);
  const megaArr=Object.entries(mg).filter(([k])=>k!=='（切らなかった／未記録）').map(([p,v])=>({p,...v})).filter(x=>x.n>=5);
  if(megaArr.length>=2){
    megaArr.sort((a,b)=>(b.w/b.n)-(a.w/a.n));
    const hi=megaArr[0], lo=megaArr[megaArr.length-1];
    if(hi.w/hi.n - lo.w/lo.n > 0.2)
      out.push(['w',`メガ枠は <b>${esc(hi.p)}</b> が ${pct(hi.w,hi.n)}%、<b>${esc(lo.p)}</b> が ${pct(lo.w,lo.n)}%。${esc(lo.p)}を切る試合の選出基準を見直す価値があります。`]);
  }
  const comboArr=Object.entries(combo).map(([p,v])=>({p,...v})).filter(x=>x.n>=4);
  const best=comboArr.sort((a,b)=>(b.w/b.n)-(a.w/a.n))[0];
  if(best && best.w/best.n>=0.6) out.push(['g',`勝ちパターンは <b>${esc(best.p)}</b>（${best.n}戦 ${pct(best.w,best.n)}%）。この形に持ち込める並びを見つけたら迷わず選出してよさそうです。`]);
  const noReason=B.filter(b=>!b.reason).length;
  if(B.length>=10 && noReason/B.length>0.3) out.push(['w',`勝因/敗因が空の試合が ${noReason} 件あります。<b>ここを書いた試合だけが復習に使えます</b>。1文でいいので必ず残しましょう。`]);
  const noTurn=B.filter(b=>!(b.turns||[]).length).length;
  if(B.length>=10 && noTurn/B.length>0.5) out.push(['b',`ターンの記録がある試合は ${B.length-noTurn} 件です。ここが増えると「相手がよく使ってくる技」の精度が上がり、型読みができるようになります。`]);
  el.innerHTML = out.length? out.map(([c,t])=>`<div class="note ${c}" style="margin-bottom:8px">${t}</div>`).join('')
    : '<p class="hint">記録が溜まると、ここに気づきが出ます。</p>';
}

/* =========================================================
   履歴
   ========================================================= */
['#hTeam','#hPoke'].forEach(s=>$(s).addEventListener('input',renderHist));
function renderHist(){
  const t=$('#hTeam').value,p=$('#hPoke').value.trim();
  const list=BATTLES.filter(b=>(!t||b.team_id===t)&&(!p||(b.opp_team||[]).some(x=>x.includes(p))));
  const w=list.filter(b=>b.result==='win').length;
  $('#histSummary').textContent=`${list.length}戦 ${w}勝 ${list.length-w}敗 ・ 勝率 ${pct(w,list.length)}%`;
  const tn=id=>(TEAMS.find(t=>t.id===id)||{}).name||'—';
  $('#histList').innerHTML=list.slice(0,300).map(b=>`
    <div class="log ${b.result}">
      <div class="head"><span class="rz ${b.result}">${b.result==='win'?'WIN':'LOSE'}</span>
        <span>${esc(b.played_at)}</span><span>${b.rule==='double'?'ダブル':'シングル'}</span>
        ${b.season?`<span>${esc(b.season)}</span>`:''}${b.rank?`<span>${esc(b.rank)}</span>`:''}
        <span style="margin-left:auto">${esc(tn(b.team_id))}</span></div>
      <div class="tm"><span class="lbl">相手</span>${esc((b.opp_team||[]).join(' / '))}</div>
      ${b.opp_pick&&b.opp_pick.length?`<div class="tm"><span class="lbl">相手選出</span><b>${esc(b.opp_pick.join(' / '))}</b></div>`:''}
      ${b.my_pick&&b.my_pick.length?`<div class="tm"><span class="lbl">自分選出</span><b>${esc(b.my_pick.join(' / '))}</b>${b.mega?` <span class="lbl">メガ</span>${esc(b.mega)}`:''}</div>`:''}
      ${(b.turns||[]).length?`<div class="small muted">ターン記録 ${b.turns.length}手</div>`:''}
      ${b.reason?`<div class="why">${esc(b.reason)}</div>`:''}
      ${b.next_plan?`<div class="why" style="border-left:3px solid var(--blue)">次回：${esc(b.next_plan)}</div>`:''}
      ${b.opp_sets?`<div class="small muted" style="margin-top:5px">型：${esc(b.opp_sets)}</div>`:''}
      <div style="display:flex;gap:8px;margin-top:9px">
        <button class="btn sm" data-edit="${b.id}">編集</button>
        <button class="btn sm danger" data-del="${b.id}">削除</button></div>
    </div>`).join('')||'<p class="hint">まだ記録がありません。</p>';
  $$('#histList [data-del]').forEach(x=>x.onclick=async ()=>{
    if(!confirm('この試合を削除します。元に戻せません。'))return;
    const {error}=await sb.from('battles').delete().eq('id',x.dataset.del);
    if(error)return toast('削除に失敗: '+error.message,true);
    await loadBattles();renderAll();toast('削除しました');
  });
  $$('#histList [data-edit]').forEach(x=>x.onclick=()=>{
    const b=BATTLES.find(v=>v.id===x.dataset.edit);if(!b)return;
    EDIT_ID=b.id;
    $('#fDate').value=b.played_at;$('#fSeason').value=b.season||'';$('#fRule').value=b.rule;
    $('#fRank').value=b.rank||'';$('#fTeam').value=b.team_id||'';
    setArr(S.opp,b.opp_team);setArr(S.oppPick,b.opp_pick);setArr(S.myPick,b.my_pick);setArr(S.turns,b.turns);
    S.result=b.result;S.mega=b.mega||null;S.oppMega=b.opp_mega||null;S.predLead=b.pred_lead||null;
    $('#fReason').value=b.reason||'';$('#fSets').value=b.opp_sets||'';$('#fKey').value=b.key_turn||'';$('#fNext').value=b.next_plan||'';
    $('#btnWin').classList.toggle('on',S.result==='win');$('#btnLose').classList.toggle('on',S.result==='lose');
    $('#btnSave').textContent='この試合を更新する';
    renderOpp();saveDraft();
    $$('.tab').find(t=>t.dataset.tab==='rec').click();
  });
}
$('#btnExportJson').onclick=()=>dl('battlelog.json',JSON.stringify({teams:TEAMS,battles:BATTLES},null,2),'application/json');
$('#btnExportCsv').onclick=()=>{
  const cols=['played_at','season','rule','rank','result','opp_team','opp_pick','my_pick','mega','reason','key_turn','next_plan','opp_sets'];
  const q=v=>`"${String(Array.isArray(v)?v.join('/'):(v??'')).replace(/"/g,'""')}"`;
  dl('battlelog.csv','﻿'+[cols.join(','),...BATTLES.map(b=>cols.map(c=>q(b[c])).join(','))].join('\n'),'text/csv');
};
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

/* =========================================================
   構築
   ========================================================= */
const PRESET={
  name:'紫電アマガライチュウ',
  note:'重い並び：①ステロ＋剣舞しんそくメガルカリオ（通したら負け）②アローラキュウコン＋バシャーモ＋ギャラドス（壁＋積み）③タスキドドゲザン。メガ選出比率＝ライチュウ4：マフォクシー6。出典: ふとん氏 M-4最終5位／チームID 8MPGR1FPXR',
  roster:[
    {name:'メガライチュウY',ability:'ノーガード',nature:'おくびょう',item:'メガストーン',sp:{h:30,a:0,b:31,c:0,d:0,s:5},moves:['でんじほう','きあいだま','くさむすび','わるだくみ']},
    {name:'アーマーガア',ability:'ミラーアーマー',nature:'わんぱく',item:'たべのこし',sp:{h:32,a:2,b:17,c:0,d:15,s:0},moves:['ブレイブバード','ビルドアップ','とんぼがえり','はねやすめ']},
    {name:'ガブリアス',ability:'さめはだ',nature:'ようき',item:'こだわりスカーフ',sp:{h:0,a:31,b:3,c:0,d:0,s:32},moves:['じしん','げきりん','がんせきふうじ','ステルスロック']},
    {name:'アシレーヌ',ability:'げきりゅう',nature:'ひかえめ',item:'ラムのみ',sp:{h:32,a:0,b:10,c:1,d:0,s:23},moves:['うたかたのアリア','ムーンフォース','アクアジェット','アンコール']},
    {name:'マスカーニャ',ability:'しんりょく',nature:'いじっぱり',item:'きあいのタスキ',sp:{h:0,a:32,b:2,c:0,d:0,s:32},moves:['トリックフラワー','じごくづき','ふいうち','どくびし']},
    {name:'メガマフォクシー',ability:'ふゆう',nature:'ひかえめ',item:'メガストーン',sp:{h:15,a:0,b:7,c:14,d:0,s:30},moves:['だいもんじ','サイコショック','マジカルシャイン','みがわり']}
  ],
  plans:{0:'（要検証）マスカのじごくづきでハイパーボイスを止めつつどくびし→アマガで詰め。本命打点はマフォクシーのだいもんじ',
    1:'メガ枠＋アシレーヌ＋@1。マスカ＋アシレ＋マフォが広く浅く対応できる。カバルドンにはライチュウのくさむすび',
    2:'メガ枠＋アシレーヌ＋@1。ギルガルド等の取り巻きを考えるとこの形が最良',
    3:'ライチュウ＋@2、またはマスカ＋マフォ＋@1。わるだくみライチュウで起点にするか、どくびし＋みがわりマフォで通す',
    4:'マスカ＋マフォ＋@1。どくびし＋みがわりマフォクシーで詰める（みがわりでやどりぎを透かす）'}
};
const PATTERNS=['マフォクシー＋ニンフィア','カバルドン＋メタグロス＋アシレーヌ','カイリュー＋ギルガルド','アーマーガア＋ハラバリー','メガスコヴィラン'];

$('#tPreset').onclick=()=>{
  $('#tName').value=PRESET.name;
  setArr(S.tNew, PRESET.roster.map(r=>JSON.parse(JSON.stringify(r))));
  renderTNew(); toast('読み込みました。「保存」を押してください');
};
function renderTNew(){
  const el=$('#tChips');
  el.innerHTML = S.tNew.length
    ? S.tNew.map((m,i)=>`<span class="pk">${typeChips(m.name)}<b>${esc(m.name)}</b><span class="x" data-i="${i}">×</span></span>`).join('')
    : '<span class="pk ghost">まだ入っていません</span>';
  el.querySelectorAll('.x').forEach(x=>x.onclick=()=>{S.tNew.splice(+x.dataset.i,1);renderTNew();});
}
$('#tSave').onclick=async ()=>{
  const name=$('#tName').value.trim();
  if(!name) return toast('構築名を入れてください',true);
  if(!S.tNew.length) return toast('ポケモンを入れてください',true);
  const isP = name===PRESET.name;
  const res = await dbWrite('teams','insert',{user_id:USER.id,name,
    members:S.tNew.map(m=>m.name), roster:S.tNew,
    plans:isP?PRESET.plans:{}, note:isP?PRESET.note:null});
  if(!res.ok) return toast('保存に失敗: '+res.error.message,true);
  $('#tName').value=''; S.tNew.length=0; renderTNew();
  await loadTeams(); renderAll();
  res.dropped.length ? warnDropped(res.dropped) : toast('構築を保存しました');
};

function renderTeams(){
  $('#teamList').innerHTML=TEAMS.map(t=>{
    const bs=BATTLES.filter(b=>b.team_id===t.id), w=bs.filter(b=>b.result==='win').length;
    const roster=(t.roster&&t.roster.length)?t.roster:(t.members||[]).map(n=>({name:n,sp:{},moves:[]}));
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:8px">
        <b>${esc(t.name)}</b><span class="small muted">${bs.length}戦 ${pct(w,bs.length)}%</span>
        <span style="flex:1"></span><button class="btn sm danger" data-tdel="${t.id}">削除</button></div>
      ${t.note?`<div class="small muted" style="margin-top:8px">${esc(t.note)}</div>`:''}
      ${bs.length<30?`<div class="note w small" style="margin-top:10px">母数が${bs.length}戦。30〜50戦は回さないと良し悪しは判断できません。</div>`:''}
      <div style="margin-top:12px">${roster.map((m,i)=>rosterRow(t,m,i)).join('')}</div>
      <div style="margin-top:14px">
        <div class="small muted" style="margin-bottom:6px">対策すべき5つの並びへの選出プラン（書けない＝そこが穴）</div>
        ${PATTERNS.map((p,i)=>`<div class="field" style="margin-bottom:8px"><label class="f">${esc(p)}</label>
          <input type="text" data-plan="${t.id}" data-pi="${i}" value="${esc((t.plans||{})[i]||'')}" placeholder="誰を出して、初手に何を置いて、どう勝つか"></div>`).join('')}
      </div></div>`;
  }).join('')||'<p class="hint">まだ構築が登録されていません。上から追加してください。</p>';

  $$('#teamList [data-tdel]').forEach(x=>x.onclick=async ()=>{
    if(!confirm('この構築を削除します。（記録した試合そのものは残ります）'))return;
    const {error}=await sb.from('teams').delete().eq('id',x.dataset.tdel);
    if(error)return toast('削除に失敗: '+error.message,true);
    await loadTeams();renderAll();toast('削除しました');
  });
  $$('#teamList [data-plan]').forEach(inp=>inp.addEventListener('change',async ()=>{
    const t=TEAMS.find(v=>v.id===inp.dataset.plan);if(!t)return;
    const plans={...(t.plans||{})};plans[inp.dataset.pi]=inp.value;
    const res=await dbWrite('teams','update',{plans},t.id);
    if(!res.ok)return toast('保存に失敗: '+res.error.message,true);
    if(res.dropped.length) return warnDropped(res.dropped);
    t.plans=plans;toast('プランを保存しました');
  }));
  $$('#teamList [data-rk]').forEach(inp=>inp.addEventListener('change',async ()=>{
    const t=TEAMS.find(v=>v.id===inp.dataset.tid);if(!t)return;
    const i=+inp.dataset.ri, k=inp.dataset.rk;
    const roster=JSON.parse(JSON.stringify(t.roster&&t.roster.length?t.roster:(t.members||[]).map(n=>({name:n,sp:{},moves:[]}))));
    if(k.startsWith('sp.')) { roster[i].sp=roster[i].sp||{}; roster[i].sp[k.slice(3)]=+inp.value||0; }
    else if(k.startsWith('mv')) { roster[i].moves=roster[i].moves||[]; roster[i].moves[+k.slice(2)]=inp.value; }
    else roster[i][k]=inp.value;
    const res=await dbWrite('teams','update',{roster},t.id);
    if(!res.ok)return toast('保存に失敗: '+res.error.message,true);
    if(res.dropped.length) return warnDropped(res.dropped);
    t.roster=roster; renderTeams(); toast('保存しました');
  }));
}
function rosterRow(t,m,i){
  const st=PC.realStats(m.name,m.sp,m.nature);
  const spTotal=Object.values(m.sp||{}).reduce((a,b)=>a+(+b||0),0);
  const KEY=[['h','H'],['a','A'],['b','B'],['c','C'],['d','D'],['s','S']];
  return `<details style="border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:8px">
    <summary style="cursor:pointer;list-style:none">
      <span class="pk" style="border:none;padding:0">${typeChips(m.name)}<b>${esc(m.name)}</b></span>
      <span class="small muted" style="margin-left:8px">${st?`${st.h}-${st.a}-${st.b}-${st.c}-${st.d}-${st.s}`:''} ／ SP計${spTotal}${spTotal>66?' ⚠超過':''}</span>
    </summary>
    <div style="height:10px"></div>
    <div class="row">
      <div><label class="f">特性</label><input type="text" value="${esc(m.ability||'')}" data-tid="${t.id}" data-ri="${i}" data-rk="ability"></div>
      <div><label class="f">能力補正</label><select data-tid="${t.id}" data-ri="${i}" data-rk="nature"><option value="">-</option>${NATURE_NAMES.map(n=>`<option ${m.nature===n?'selected':''}>${n}</option>`).join('')}</select></div>
      <div><label class="f">持ち物</label><input type="text" value="${esc(m.item||'')}" data-tid="${t.id}" data-ri="${i}" data-rk="item"></div>
    </div>
    <div style="height:8px"></div><label class="f">能力ポイント（合計66まで）</label>
    <div class="row">${KEY.map(([k,L])=>`<div style="flex:1 1 45px"><label class="f" style="text-align:center">${L}</label>
      <input type="number" min="0" max="32" value="${(m.sp||{})[k]||0}" data-tid="${t.id}" data-ri="${i}" data-rk="sp.${k}" style="text-align:center;padding:7px"></div>`).join('')}</div>
    <div style="height:8px"></div><label class="f">技</label>
    <div class="row">${[0,1,2,3].map(j=>`<div style="flex:1 1 45%"><input type="text" list="mvlist2" value="${esc((m.moves||[])[j]||'')}" data-tid="${t.id}" data-ri="${i}" data-rk="mv${j}" placeholder="技${j+1}"></div>`).join('')}</div>
  </details>`;
}

/* ---------- 共通 ---------- */
function fillTeamSelects(){
  const opts=TEAMS.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const keep=$('#fTeam').value;
  $('#fTeam').innerHTML=opts||'<option value="">（構築を登録してください）</option>';
  if(keep&&TEAMS.some(t=>t.id===keep))$('#fTeam').value=keep;
  $('#hTeam').innerHTML='<option value="">すべて</option>'+opts;
  $('#sTeam').innerHTML='<option value="">すべて</option>'+opts;
}
function renderAll(){
  fillTeamSelects(); renderOpp(); renderTeams(); renderHist(); renderStats();
  if(!$('#mvlist2')){const dl2=document.createElement('datalist');dl2.id='mvlist2';
    dl2.innerHTML=MOVE_NAMES.map(m=>`<option value="${esc(m)}">`).join('');document.body.appendChild(dl2);}
}
boot();
