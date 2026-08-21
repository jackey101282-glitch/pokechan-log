/* =========================================================
   ポケチャン ノート — アプリ本体
   データの正本は Supabase。localStorage は入力途中の下書きのみ。
   ========================================================= */
'use strict';
/* HTMLとJSの版ズレを検出する。ズレていたら1回だけ強制リロードする。
   （GitHub Pages は index.html と app.js を別々に10分キャッシュするため） */
const APP_VERSION = '81';
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
/** タイプを「色つきアイコンだけ」で示す。
 *  丸だけにしたら分かりづらいと指摘されたので（2026-08-19）、アイコンは必ず出す。
 *  文字を落とすことで、1行に複数のポケモンが並ぶ幅を確保する。 */
/** タイプ1つを丸バッジで出す。技のタイプなど「種族ではないもの」に使う */
function typeBadge(t){
  if(!t || !PC.TYPE_COLOR[t]) return '';
  return `<span class="dots"><i style="background:${PC.TYPE_COLOR[t]}" title="${esc(t)}">${typeIcon(t)}</i></span>`;
}
function typeDots(name){
  const s = PC.SPECIES[name]; if(!s) return '';
  return `<span class="dots">${s.types.map(t=>
    `<i style="background:${PC.TYPE_COLOR[t]||'#aaa'}" title="${t}">${typeIcon(t)}</i>`).join('')}</span>`;
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
    /* ★ここも PC.searchSpecies() に統一（v58）。
       以前は `n.includes(q)` だけで、**ひらがなで打つと1件も出なかった**。 */
    const list = PC.searchSpecies(q, {noMega:!!noMega, limit:40}).list;
    return list.sort((a,b)=>{
      const d=(seen[b]||0)-(seen[a]||0); if(d) return d;
      return 0;                                  // 並びは searchSpecies が決めた順を尊重する
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
function effOppOf(n, mega){ return (mega && PC.BASE_OF[mega]===n) ? mega : n; }
function effOpp(n){ return effOppOf(n, S.oppMega); }
/** ★対戦タブ用（v68・社長の要望）。
 *  「相手がメガシンカするとタイプが変わるので相性も変わる。
 *    メガになった時のタイプで対面を作り直してほしい」
 *  例：チリーン(エスパー単) → メガチリーン(エスパー/はがね) で、じめんが等倍→**2倍**。
 *  記録タブは S.oppMega、対戦タブは BT.oppMega を見る。**混ぜないこと。** */
/* ★へんげんじざい／リベロで変わったタイプを、相手の「いま」に反映する（v76）。
   メガシンカと同じ仕組み（タイプだけ差し替えた個体名に置き換える）なので、
   ここ1か所を通すだけで、判定・ダメージ・危ないタイプ・引き先まで全部が新しいタイプで動く。 */
/* ★自分の駒のタイプが変えられている場合、その形で計算する（v80）。
   相手側（へんげんじざい）とまったく同じ仕組み＝タイプだけ差し替えた個体名にする。
   実数値は m.stats に計算済みなので、名前を差し替えても数字はそのまま使える。 */
function effMeBT(m){
  if(!m || !m.name) return m;
  const t = BT && BT.myType && BT.myType[m.label];
  if(!t) return m;
  return {...m, name: PC.typeFormName(m.name, t), _typedFrom: m.name};
}
function effOppBT(n){
  const base = effOppOf(n, BT && BT.oppMega);
  const t = BT && BT.oppType && BT.oppType[n];
  return t ? PC.typeFormName(base, t) : base;
}
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
  initAutocompletes(); initDamageUI(); initVsUI(); initBtUI(); initStatForm();
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
  // タブを増やしたときに書き換え漏れが起きないよう、セクションはDOMから拾う
  $$('main section[id^="tab-"]').forEach(sec=> sec.hidden = (sec.id !== 'tab-'+b.dataset.tab));
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
/* ★これらの実体は core.js に移設した（画面が無くても検証できるようにするため）。
   ここは呼び出し方を変えないための薄いラッパ。effOpp（相手のメガ反映）だけ画面側から渡す。 */
const rosterForCalc = (roster, megaChoice)=> PC.rosterForCalc(roster, megaChoice);
const megaSlotsOf   = roster=> PC.megaSlotsOf(roster);
const dispName      = (rc, label)=> PC.dispName(rc, label);
const bestPlan      = (roster, targets, size, allOpp, fixedMega, oppMegaFn)=>
  PC.bestPlan(roster, targets, size, allOpp, fixedMega, oppMegaFn || effOpp);
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

/* ---------- 音声メモ ----------
   OSの音声入力で喋った内容を、下の入力欄に流し込む。
   解析は core.js の parseBattleText（種族名の照合だけ）なので、外部APIは使わない＝無料。
   誤変換は必ず起きるので、読み取った結果は「確認してください」と明示して人が直せるようにする。 */
$('#voiceClear').onclick = ()=>{ $('#voiceText').value=''; $('#voiceOut').innerHTML=''; };
$('#voiceRun').onclick = ()=>{
  const txt = $('#voiceText').value.trim();
  const out = $('#voiceOut');
  if(!txt){ out.innerHTML='<span class="muted">喋った内容を入れてください。</span>'; return; }
  const r = PC.parseBattleText(txt);
  if(!r.opp_team.length && !r.my_pick.length){
    out.innerHTML='<div class="note w">ポケモンの名前を拾えませんでした。名前をはっきり言い直すか、下の欄に直接入れてください。</div>';
    return;
  }
  if(r.opp_team.length){ setArr(S.opp, r.opp_team.slice(0,6)); }
  if(r.my_pick.length){ setArr(S.myPick, r.my_pick.slice(0,4)); }
  if(r.result){ S.result = r.result;
    $('#btnWin').classList.toggle('on', r.result==='win');
    $('#btnLose').classList.toggle('on', r.result==='lose'); }
  if(!$('#fReason').value.trim()) $('#fReason').value = txt;   // 元の発言は敗因メモとして残す
  renderOpp(); renderPickers(); saveDraft();

  out.innerHTML = `
    <div class="note g" style="margin-bottom:8px">下の欄に反映しました。<b>内容が合っているか必ず確認してください。</b></div>
    <div>相手：<b>${r.opp_team.map(esc).join('・')||'—'}</b></div>
    <div>自分の選出：<b>${r.my_pick.map(esc).join('・')||'—'}</b></div>
    <div>結果：<b>${r.result==='win'?'勝ち':r.result==='lose'?'負け':'（読み取れず）'}</b></div>
    ${r.uncertain.length?`<div class="note w" style="margin-top:8px"><b>聞き取りが怪しい箇所</b><br>
      ${r.uncertain.map(u=>`「${esc(u.heard||'')}」→ <b>${esc(u.guessed)}</b>${u.note?`（${esc(u.note)}）`:''}`).join('<br>')}
      <br><span class="muted">違っていたら下のチップをタップして直してください。</span></div>`:''}`;
};

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
      ${myPlan&&myPlan.bias?`<div class="small" style="margin-top:6px"><span class="badge ng">3体とも${esc(myPlan.bias)}アタッカー</span>
        <span class="muted">${myPlan.bias==='物理'?'おにび・いかく・リフレクター':'ひかりのかべ・とつげきチョッキ'}1枚でまとめて止められます</span></div>`:''}
      <button class="btn sm" id="btnApplyPlan" style="margin-top:9px">この選出にする</button>
      ${bp.all.length>1?`<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">他の候補も見る</summary>
        ${bp.all.slice(1).map((alt,k)=>`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line2)">
          <div class="small muted">候補${k+2}　予想3体中 ${alt.plan.cover}体／外れても ${alt.backup}/${S.opp.length}体</div>
          <div class="pklist">${alt.plan.members.map(n=>pkChip(n,{cls:'tapp',data:`data-alt='${esc(JSON.stringify({m:alt.plan.members,g:alt.mega}))}'`})).join('')}</div>
        </div>`).join('')}</details>`:''}
    </div>

    <div class="pick-card">
      <div class="hd"><b>④ この3体のうち、初手はこれ</b></div>
      ${leadAns ? (()=>{ const v=verdict(leadAns.mu), sn=splitNote(leadAns.mu); return `
        <div class="pklist">${pkChip(leadAns.n,{cls:leadAns.mu.dangerAll?'':'sel'})}</div>
        <div class="small" style="margin-top:7px">
          対 <b>${esc(S.predLead)}</b> ：${muNums(leadAns.mu)}${leadAns.mu.faster?' 先制':''}
          <span class="badge ${v.cls}">${esc(v.txt)}</span>
        </div>
        ${sn?`<div class="small muted" style="margin-top:5px">${esc(sn)}</div>`:''}
        <div class="small muted" style="margin-top:5px">③の3体の中から選んでいます。危険対面ごとの引き先は、下の「初手チェック」に出ます。</div>`; })()
        : '<p class="hint">初手の候補が出せませんでした。</p>'}
    </div>

    ${(()=>{ const t=[]; S.opp.forEach(n=>PC.oppTricks(PC.toBase(n)).forEach(([mv,why])=>t.push([n,mv,why])));
      return t.length?`<div class="pick-card" style="border-left:3px solid var(--fg)">
        <div class="hd"><b>この並びで警戒する技</b></div>
        ${t.map(([n,mv,why])=>`<div class="small" style="padding:2px 0">・<b>${esc(n)}</b> の <b>${esc(mv)}</b> — ${esc(why)}</div>`).join('')}
      </div>`:''; })()}

    <div class="small muted">相手の型は<b>攻撃型／最速型／耐久型</b>の3通り（SP合計66の範囲内）で計算し、幅で出しています。あくまで初手を決めるための目安です。</div>`;

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

/* ---------- 相性の見せ方 ----------
   相手の型は「攻撃型／最速型／耐久型」の3通りで見ている（SP合計66の制約内）。
   点の数字は嘘になるので幅で出し、型によって結論が変わる対面は「型次第」と書く。 */
function dmgRange(lo,hi){
  const a=Math.round(lo*100), b=Math.round(hi*100);
  if(b===0) return '無効';
  if(a>=100) return '100%+';          // 一撃で落ちる。それ以上の桁は読む意味がない
  const bb = Math.min(b,999);
  return a===bb ? `${a}%` : `${a}〜${bb}%`;
}
function muNums(mu){
  return `${dmgRange(mu.myDmgLo,mu.myDmgHi)} / 被${dmgRange(mu.opDmgLo,mu.opDmgHi)}`;
}
/** 相手のいちばん痛い技を一言で。採用率つき（M-5 実データ） */
function threatNote(mu){
  if(!mu || !mu.opMove) return '';
  const r = mu.opMoveRate!=null ? `（採用${mu.opMoveRate}%）` : '';
  const est = mu.opEstimated ? ' <span class="muted">※使用率データなしの推定</span>' : '';
  const g = mu.guard ? ` <span class="muted">${esc(mu.guard)}で1発は耐える</span>` : '';
  return `相手の最大打点：<b>${esc(mu.opMove)}</b>${r} <b>${dmgRange(mu.opDmgLo,mu.opDmgHi)}</b>${est}${g}`;
}
function verdict(mu){
  // 一撃で落とされうる対面は、他が良くても置いてはいけない
  if(mu.opOHKO) return {cls:'ng', mark:'✕',
    txt:`${mu.opOHKOMove||'相手の技'}${mu.opOHKORate!=null?`（採用${mu.opOHKORate}%）`:''}で一撃で落ちる`};
  // 打点が無い対面は、他の指標が良くても勝てない
  if(mu.noOffense) return {cls:'ng', mark:'✕', txt:`打点なし（最大でも${mu.myHits}発）`};
  if(mu.winsAll)   return {cls:'ok', mark:'◎', txt:'どの型でも先に落とせる'};
  if(mu.dangerAll) return {cls:'ng', mark:'✕', txt:'どの型でも不利'};
  if(mu.split)     return {cls:'wn', mark:'△', txt:'相手の型次第'};
  return mu.winsRace ? {cls:'ok', mark:'○', txt:'先に落とせる'}
       : mu.danger   ? {cls:'ng', mark:'✕', txt:'不利'}
                     : {cls:'wn', mark:'△', txt:'押し切れない'};
}
/** 型が割れたとき「どの型なら勝てて、どの型だと負けるか」を一言で */
function splitNote(mu){
  if(!mu.split || !mu.views) return '';
  const ok = mu.views.filter(v=>v.winsRace && !v.danger).map(v=>v.label);
  const ng = mu.views.filter(v=>!v.winsRace || v.danger).map(v=>v.label);
  if(!ok.length || !ng.length) return '';
  return `${ok.join('・')}なら勝てるが、${ng.join('・')}だと負ける`;
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
        const v = verdict(r.mu);
        const cls = v.cls==='ng' ? 'c' : (v.cls==='ok' ? 'a' : 'b');
        return `<div class="ans">
          <span class="rk ${cls}">${v.mark}</span>
          <b>${esc(r.n)}</b>
          ${i===0 && !r.mu.dangerAll ? '<span class="badge ok">当てるならここ</span>' : ''}
          ${r.mu.faster?'<span class="badge wn">先制</span>':''}
          ${r.mu.split?'<span class="badge wn">型次第</span>':''}
          ${r.mu.myMove?`<span class="small muted">${esc(r.mu.myMove)}</span>`:''}
          <span class="num">${muNums(r.mu)}</span>
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
/* 対戦タブの構築切替。#fTeam を動かして、記録タブ側と食い違わないようにする。 */
if($('#btTeam')) $('#btTeam').onchange=()=>{
  $('#fTeam').value=$('#btTeam').value;
  $('#fTeam').onchange();
  BT.sel=null; BT.me=null; BT.meManual=false; BT.matrix=null; BT.seenOrder=[]; BT.done={};
  PC.clearMatchupCache(); if(window.VOICE) VOICE.reset();
  fillTeamSelects();
  safe('実戦',()=>{ btCompute(); btRender(); },'#btGrid');
};
$('#fTeam').onchange=()=>{setArr(S.myPick);renderMyTeamChips();renderPickers();renderSuggest();saveDraft();VS.mine=null;safe('対面',()=>{renderVsPickers();renderVs();},'#vsOut');};

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
  // 引き先は「どの型でも安全」を優先する。型次第の引き先は次善
  const safe = cands.filter(x=>!x.mu.danger)
    .sort((a,b)=> (b.mu.winsAll?1:0)-(a.mu.winsAll?1:0) || (a.mu.split?1:0)-(b.mu.split?1:0) || b.mu.score-a.mu.score);
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
      // 主想定で安全でも、ありうる型のどれかで崩されるなら出す（「型次第」として区別表示）
      if((mu.views||[]).some(v=>v.danger)) dangers.push({opp:p.name, mu, pct:p.pct});
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
        // 「何体に不利か」ではなく「不利な相手が先発してくる確率」で危険度を出す
        const riskP  = r.dangers.filter(d=>d.mu.dangerAll).reduce((s,d)=>s+d.pct,0);
        const maybeP = r.dangers.filter(d=>!d.mu.dangerAll).reduce((s,d)=>s+d.pct,0);
        const grade = riskP>=0.35 ? ['ng',`リスク高（不利な先発 ${Math.round(riskP*100)}%）`]
                    : riskP>0     ? ['wn',`危険対面あり（${Math.round(riskP*100)}%）`]
                    : maybeP>0    ? ['wn','相手の型次第']
                                  : ['ok','安全'];
        const lead = r.vsLead, lv = lead?verdict(lead):null;
        return `<div style="padding:10px 0;border-bottom:1px solid var(--line2)">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <b style="font-size:15px">${marks[i]||''} ${esc(r.name)}</b>
            <span class="badge ${grade[0]}">${grade[1]}</span>
            ${i===0?'<span class="badge ok">これを置く</span>':''}
          </div>
          ${lead&&r.lead?`<div class="small" style="margin-top:5px">
             予想先発 <b>${esc(r.lead.name)}</b>（${Math.round(r.lead.pct*100)}%）に
             ${muNums(lead)}${lead.faster?' 先制':''}
             <span class="badge ${lv.cls}">${esc(lv.txt)}</span>
           </div>
           ${splitNote(lead)?`<div class="small muted" style="margin-top:3px;padding-left:2px">${esc(splitNote(lead))}</div>`:''}`:''}
          ${r.dangers.length ? `<div style="margin-top:7px">
             ${r.dangers.map(d=>{
               const esc2=escapeFor(r.name, d.opp, S.myPick, rc);
               const plan = esc2.type==='switch'
                 ? `<b>${esc(esc2.to)}に引く</b> <span class="muted">(${muNums(esc2.mu)}${esc2.mu.faster?' 先制':''})</span>`
                 : (esc2.mu && esc2.mu.opHits>=3
                     ? `<b>引き先なし。${esc2.mu.opHits}発は耐えるので殴り返す</b> <span class="muted">(${dmgRange(esc2.mu.myDmgLo,esc2.mu.myDmgHi)})</span>`
                     : `<b>引き先なし。切るしかない</b> <span class="muted">（${esc2.mu?esc2.mu.opHits:'?'}発で落ちる）</span>`);
               return `<div class="small" style="padding:3px 0">
                 <span class="badge ${d.mu.dangerAll?'ng':'wn'}" style="font-size:10px">${d.mu.dangerAll?'危険':'型次第'}</span>
                 ${esc(d.opp)} <span class="muted">(${muNums(d.mu)})</span>
                 <span class="muted"> → </span>${plan}</div>`;
             }).join('')}</div>` : `<div class="small muted" style="margin-top:5px">崩される対面なし</div>`}
        </div>`;
      }).join('')
    + `<div class="small muted" style="margin-top:8px">
        危険対面は「必ず負ける」ではなく「そのまま居座ると崩される」の意味です。
        数値は「与える割合 / 受ける割合」。相手の型は<b>攻撃型・最速型・耐久型の3通り</b>（SP合計66の範囲）で計算し、
        その幅を出しています。<b>「型次第」は相手の振り方次第で結論がひっくり返る対面</b>なので、
        1発もらってから「ダメージ計算」タブの逆算で型を絞ってください。</div>`;
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
   実戦モード — 試合中はここだけ見る
   45秒の中でClaudeに聞くと必ず間に合わない（実際に2戦落とした）。
   相手6体を入れた時点で全対面を計算しておき、試合中はタップだけで即答する。
   ========================================================= */
/* ★実戦タブの状態は必ずこの1つの関数で作る（2026-08-20・重大バグの再発防止）。
   v45/v46 で「保存後の自動リセット」「次の試合へ」を足したとき、
   BT を作り直す場所が3か所に散らばり、**タイプ検索が使う BT.tsel を復元し忘れた**。
   その結果、リセット後にタイプを押すと例外で落ち、6体目が入力できなくなっていた
   （社長が実戦で選出を組めず、致命的だった）。
   → 新しい状態を足すときは、必ずここに足すこと。個別に {} を書かない。 */
/* ★観測した技は「その1試合だけ」のもの（2026-08-21・v76・社長の要望）。
   「同じポケモンでも覚えてる技は全然違う。前回の相手はこれを覚えてたけど、
     今回の相手はこれを覚えてる、みたいな感じで**毎回リセットしてほしい**」
   → v64まで（keepObs）は、次の試合に持ち越していた。**持ち越さない**。
   過去の相手が何を撃ってきたかは「これまでの対戦での実績」として別に出しているので、
   参考値としてはそちらに残る（今回の相手の確定情報と混ぜないことが大事）。 */
function newBT(){
  return { opp:[], picks:[], mega:null, megaFixed:null, matrix:null,
           sel:null, me:null, meManual:false,
           hp:{}, oppHp:{}, obs:{}, guardGone:{}, board:{},
           /* ★相手がその技を何回撃ってきたか（v76）。obsCount[相手名][技名] = 回数 */
           obsCount:{},
           seenOrder:[], done:{}, tsel:[], leadGuess:null, oppPredict:null,
           /* ★名前検索の先頭候補（Enterで足す用）。ここに書かないと
              リセット後に undefined になって Enter が黙って効かなくなる（v48と同じ事故） */
           /* ★試合中のダメージ記録（v62・社長の要望）。
              dealt[相手名] = [{move,pct}] … こちらが与えた実測ダメージ
              pending      = 次にHPを更新したときに紐づける技名 */
           dealt:{}, pending:null,
           /* ★実際に場に出した自分の駒（v65）。
              保存していた my_pick は **ツールの推奨（BT.picks）** で、
              社長が実際に出した3体ではなかった。分析の土台が崩れていた。 */
           usedMine:[],
           /* ★相手に積まれた回数（v66）。stacks[相手名][技名] = 回数。
              押すたびに盤面のランクへ加算する。 */
           stacks:{},
           /* ★もう落ちた自分の駒（v67・社長の要望）。
              「引くならこの駒」と言われても、その駒がもう居ないことが多かった。 */
           fainted:{},
           /* ★もう落ちた相手の駒（v75・社長の要望）。
              「自分の駒に生きてる／落ちたの印があるなら、相手のところにも入れてほしい。
                相手のポケモンを倒したときも戦い方が変わるので」
              控えの脅威・交代先の読み・設置技の価値・おはかまいりから外す。 */
           oppFainted:{},
           /* 相手がメガシンカしたら、その形態名を入れる（v68） */
           oppMega:null,
           /* ★へんげんじざい／リベロで今なっているタイプ（v76・社長の要望）。
              oppType[相手名] = 'こおり'。撃ってきた技をタップすると自動で入る。 */
           oppType:{},
           /* ★相手ごとの盤面（積みランク・状態異常）。交代で載せ替える（v77・社長の指摘） */
           oppBoard:{},
           /* ★試合中に見えた相手の持ち物（v79・社長の要望）。oppItem[相手名]='いのちのたま'。
              使用率からの推測を上書きして確定にする。'なし' も選べる。 */
           oppItem:{},
           /* ★みずびたし等で変えられた「自分の駒のいまのタイプ」（v80・社長の指摘）。
              myType[自分のラベル]='みず'。**交代したら自動で消える**（ゲームの挙動どおり）。 */
           myType:{},
           /* ★タイプ診断（v69・社長の要望）。tdType=選んだタイプ, tdMode='def'受ける/'atk'殴る */
           tdType:null, tdMode:'def',
           _searchTop:null,
           /* 前回の盤面を古いとして捨てたか（開いたときに1度だけ知らせる） */
           _staleDropped:false };
}
let BT = newBT();

/* ★種族名の検索は core.js の PC.searchSpecies() に一本化した（2026-08-21・v58）。
   以前はここに独自のローマ字実装を置いていたが、記録タブ・構築タブは別実装で、
   しかもどれも**濁点の揺れを見ていなかった**。社長が「ハカドッグが出てこない」で1敗している。
   同じ用途の検索を画面ごとに書かないこと（鉄則⑤）。 */
function initBtUI(){
  /* ★2026-08-19 修正：ここが「上書き」だったせいで、
     ボタンで選んだ相手が「読み取る」を押した瞬間に全部消えていた。社長が選出に間に合わず1戦落としている。
     いまは必ず「足す」。消したいときは各チップの × か「やり直す」を使う。 */
  const btAddNames = names =>{
    if(!names.length){ toast('ポケモンを拾えませんでした',true); return; }
    const before = BT.opp.length;
    names.forEach(n=>{ if(BT.opp.length<6 && !BT.opp.includes(n)) BT.opp.push(n); });
    const added = BT.opp.length - before;
    $('#btVoice').value='';
    btCompute(); btRender();
    if(added) toast(`${added}体を足しました（いま${BT.opp.length}/6）`);
    else toast('新しく足せるポケモンがありませんでした', true);
  };
  /* タイプで探す。見せ合い画面では相手の名前は出ないが、タイプアイコンは必ず出る。
     2タイプ選べば候補は数体まで落ちるので、名前を知らなくても入力できる。
     出典: app/data/species.js（全313種のタイプ）＋ 使用率順（app/data/usage.js）。 */
  const btTypeRender = ()=>{
    if(!Array.isArray(BT.tsel)) BT.tsel = [];   // 状態が欠けても落ちないようにする
    $('#btTypePick').innerHTML = PC.TYPES.map(t=>{
      const on = BT.tsel.includes(t);
      return `<button class="qb mini ${on?'on':'off'}" data-bt="${t}"
        style="${on?`border-color:${PC.TYPE_COLOR[t]};background:${PC.TYPE_COLOR[t]}22`:''}">
        <i style="background:${PC.TYPE_COLOR[t]};width:15px;height:15px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;margin-right:3px">${typeIcon(t)}</i>${t}</button>`;
    }).join('');
    $$('#btTypePick [data-bt]').forEach(b=> b.onclick=()=>{
      if(!Array.isArray(BT.tsel)) BT.tsel = [];
      const t=b.dataset.bt, i=BT.tsel.indexOf(t);
      if(i>=0) BT.tsel.splice(i,1); else { BT.tsel.push(t); if(BT.tsel.length>2) BT.tsel.shift(); }
      btTypeRender();
    });
    const out = $('#btTypeOut');
    if(!BT.tsel.length){ out.innerHTML=''; return; }
    // 選んだタイプを「全部持っている」種を出す。使用率順→なければ図鑑順
    const rank = n =>{ const u = PC.oppUsage(n); return u ? u.r : 999; };
    /* ★上限14体で切っていたため、使用率の低い相手が候補に出てこなかった（社長の指摘 2026-08-20）。
       デスバーン（使用率圏外）をタイプで探しても出ず、別のポケモンを登録して試合が壊れた。
       → 全件出す。2タイプ選べば数体まで落ちるので、探す手間はむしろ減る。 */
    const all = Object.keys(PC.SPECIES)
      .filter(n=> !PC.isTypeForm(n))               // へんげんじざいの合成個体は候補に出さない
      .filter(n=> !BT.opp.includes(n) && BT.tsel.every(t=> PC.SPECIES[n].types.includes(t)))
      .sort((a,b)=> rank(a)-rank(b) || a.length-b.length);
    const hit = all;
    /* ★6体そろっていると押しても何も起きないのに、押せる見た目のままだった（社長の指摘 2026-08-20）。
       試合中はトーストを見落とすので、「押せない」と「なぜ押せないか」を候補欄に出す。 */
    const full = BT.opp.length>=6;
    out.innerHTML = hit.length
      ? `<div class="small ${full?'':'muted'}" style="width:100%${full?';color:var(--org);font-weight:700':''}">`
        + (full ? `もう6体入っています。入れ替えるには <b>上の「いま入っている6体」の × </b>で1体外してください`
                : `${BT.tsel.join('・')} を持つ <b>${hit.length}体</b>（使用率順・全部出しています）${BT.tsel.length<2?'　<span class="muted">2つ目のタイプを押すと一気に絞れます</span>':''}`) + '</div>'
        + hit.map(n=>`<button class="qb mini ${full?'dim':''}" data-bto="${esc(n)}">${typeDots(n)}${esc(n)}${rank(n)<999?`<span class="muted"> ${rank(n)}位</span>`:''}</button>`).join('')
      : '<span class="small muted">この組み合わせのポケモンはいません</span>';
    $$('#btTypeOut [data-bto]').forEach(b=> b.onclick=()=>{
      if(BT.opp.length>=6) return toast('6匹までです。× で1体外してください',true);
      BT.opp.push(b.dataset.bto); BT.tsel=[];
      btCompute(); btRender(); btTypeRender();
    });
  };
  BT._typeRender = btTypeRender;      // 追加・削除のあとに呼び直す（古い候補が残るのを防ぐ）
  btTypeRender();

  /* 名前で探して即タップ。候補に無いポケモンを入れるとき、
     フルネームを打ってから「足す」を押すのは遅すぎる（選出は90秒）。 */
  const btSearchRender = ()=>{
    const q = ($('#btSearch').value||'').trim();
    const box = $('#btSearchOut');
    if(!q){ box.innerHTML=''; return; }
    const kana = t => t.replace(/[ぁ-ん]/g, c=>String.fromCharCode(c.charCodeAt(0)+0x60))
                       .replace(/[ー－]/g,'').replace(/[ァィゥェォャュョッ]/g,'');
    /* ★ひらがな・カタカナ・ローマ字・濁点の揺れ・1〜2文字の打ち間違いまで、全部ここが吸収する */
    const res = PC.searchSpecies(q, {exclude:BT.opp, limit:10});
    const hit = res.list;
    /* ★Enterで足せるのは「完全に一致した候補」だけ（v61）。
       「もしかして」候補をEnterで無言追加すると、**違うポケモンを登録したことに気づけない**。
       社長は誤登録で3敗している。あいまい候補は必ずクリックで選ばせる。 */
    BT._searchTop = res.fuzzy ? null : (hit[0] || null);
    const full = BT.opp.length>=6;
    box.innerHTML = hit.length
      ? (full?`<div class="small" style="width:100%;color:var(--org);font-weight:700">もう6体入っています。入れ替えるには <b>× </b>で1体外してください</div>`:'')
        /* ★完全一致が無いときは「もしかして」と明示する。黙って似た名前を出すと、
           違うポケモンを登録したことに気づけない（実際に3敗している） */
        + (res.fuzzy?`<div class="small" style="width:100%;color:var(--org)">完全に一致する名前はありません。<b>もしかして：</b></div>`:'')
        + hit.map(n=>`<button class="qb mini ${full?'dim':''}" data-bs="${esc(n)}">${typeDots(n)}${esc(n)}</button>`).join('')
      : '<span class="small muted">見つかりません。<b>上の「タイプで探す」</b>なら、名前が分からなくても必ず見つかります</span>';
    $$('#btSearchOut [data-bs]').forEach(b=> b.onclick=()=>{
      if(BT.opp.length>=6) return toast('6匹までです。× で1体外してください',true);
      BT.opp.push(b.dataset.bs); $('#btSearch').value='';
      btCompute(); btRender(); btSearchRender(); $('#btSearch').focus();
    });
  };
  BT._searchRender = btSearchRender;
  $('#btSearch').oninput = btSearchRender;
  /* ★Enterで先頭候補を足す。PCではマウスに手を移す1動作が丸ごと消える（v57） */
  $('#btSearch').onkeydown = e=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const n = BT._searchTop;
    if(!n){
      if((document.getElementById('btSearchOut').textContent||'').includes('もしかして'))
        toast('完全に一致する名前がありません。候補を押して確かめてください', true);
      return;
    }
    if(BT.opp.length>=6) return toast('6匹までです。× で1体外してください', true);
    BT.opp.push(n); $('#btSearch').value=''; BT._searchTop=null;
    btCompute(); btRender(); btSearchRender(); $('#btSearch').focus();
    toast(`${n} を足しました（いま${BT.opp.length}/6）`);
  };

  $('#btVoiceRun').onclick = ()=> safe('実戦', ()=>{
    const r = PC.parseBattleText($('#btVoice').value.trim());
    btAddNames([...r.opp_team, ...r.my_pick]);        // 相手/自分の切り分けは不要。全部相手として扱う
  }, '#btGrid');
  /* ★観測した技も一緒に消す（v76）。同じ種族でも相手ごとに技は違うので、
     前の試合の「確定4技」を持ち越すと、次の試合で嘘の確定になる。 */
  $('#btReset').onclick = ()=>{
    BT = newBT();
    PC.clearMatchupCache(); $('#btVoice').value=''; btRender(); saveBtDraft();
  };
  loadBtDraft();
  /* 古い盤面を捨てたときは、必ず本人に知らせる（黙って消すと不信の元になる） */
  if(BT._staleDropped){
    BT._staleDropped = false;
    setTimeout(()=> toast('前の試合の盤面（状態異常・天候・壁・残りHP）は消しました', true), 400);
  }
}

/** 相手6体が決まった時点で、全部の対面を先に計算しておく */
/* ★先発の候補を3体、理由つきで並べる（2026-08-21・v61）。
   社長の実戦の形がこうなったため：
     「1体目は、カバルドン対策で出てくる相手に対して ギャラドス／キラフロル／カイリュー。
       相手のタイプによって ミミッキュ か ルカリオ。
       有利対面を常に取ってくる相手には、逆にカバルドンが刺さる（ステロ→あくび連打）」
   ツールは初手を1体しか出していなかったが、社長が毎回考えているのは
   **「この駒が通るか。通らないなら次は誰か」** なので、候補を並べて比べられる形にする。
   出す情報は3つだけ：①相手6体の何体に有利か ②何が来たら終わりか ③そのときどこへ引くか */
/** 表示用の小さな安全網。ここがこけても選出カードごと消えないようにする */
function safeHtml(label, fn){
  try{ return fn() || ''; }
  catch(e){ console.error('['+label+']', e);
    return `<div class="small muted" style="margin-top:8px">${esc(label)}の表示に失敗しました（${esc(e.name)}）</div>`; }
}
/* ★「引く」ことのコストを出す（2026-08-21・v81・社長の指摘）。

   社長：「不利対面で『このポケモンに引いてください』と言われるけど、その時点で一撃もらうのは
     ほぼ確定している。ミミッキュの強みはばけのかわで、**2回行動できることが確定している**こと。
     でもすでに対面していてそこから引くと、**ただで相手に攻撃をさせるだけ**になる。
     つるぎのまいも使えずに、じしんで純粋に負ける。
     だったら**この駒で戦えるだけ戦って、犠牲にはなるけど次の駒の強みを100%活かす**選択肢もある」

   ★数字で確認した（メガルカリオ vs ガブリアス で「ミミッキュに引く」と言われた場面）：
     ミミッキュ vs ガブリアス … 対面で出すと **◎殴る・一撃で落とされうる0%**
                                引いて出すと **✕引く・一撃で落とされうる99%**
     ＝ ツールは◎の側を根拠に「引くなら→ミミッキュ」と言っていた。**助言そのものが強みを消していた。**

   ★交代には4種類ある。ここを分けずに「引くなら→X」と言うのが間違いだった。
     ① 無償 … 無効／2割未満。タダで降りられる。相手の技を**誘って**引くのはこれ（釣り）
     ② 資源を1つ使う … ばけのかわ・タスキ・マルチスケイル が交代の1発で消える。**強みを半分捨てる**
     ③ 有償 … まともに食らう。削れた状態で戦うことになる
     ④ 引けない … 8割以上（v80で実装済み）
   ＋第5の選択肢として「**引かない＝この駒を捨てて、次を万全で出す**」を必ず併記する。

   ★いかく（ギャラドス）だけは逆で、**交代で出すたびに再発動する＝引くほど得**。これも出す。 */
const SWITCH_RESOURCE = {
  'ばけのかわ':'ばけのかわが剥がれます', 'マルチスケイル':'マルチスケイルが切れます',
  'がんじょう':'がんじょうを使ってしまいます'
};
function btSwitchCard(pickRoster, me, oppEff, st, c){
  const cand = pickRoster.filter(r=> r.label!==me.label).map(r=>{
    let cc=null; try{ cc = PC.callIt(r, oppEff, {roster:null, st}); }catch(e){}
    if(!cc) return null;
    const w = (cc.mu.oppRows||[]).slice().sort((a,b)=> b.rateHi-a.rateHi)[0];
    const d = w ? Math.round(w.rateHi * r.stats.h) : 0;
    const pct = r.stats.h ? d / r.stats.h : 0;
    const res = SWITCH_RESOURCE[r.ability||''] || (r.item==='きあいのタスキ' ? 'きあいのタスキが無駄になります' : null);
    /* ★ばけのかわ・がんじょう・きあいのタスキは、交代の1発を**完全に防ぐ**（マルチスケイルは半減するだけ）。
       だから「引けない」ではなく「**引けるが、その1発で強みを使い切る**」が正しい分類。
       ここを分けないと、社長が実戦で言われた「ミミッキュに引く」の何が問題なのかが出せない。 */
    const fullBlock = (r.ability||'')==='ばけのかわ' || (r.ability||'')==='がんじょう'
                   || r.item==='きあいのタスキ';
    /* 交代の1発で資源が消えるなら、降りたあとの実力は「資源が無い状態」で見る */
    let after = null;
    if(res && d>0){ try{ after = PC.callIt(r, oppEff, {roster:null, st, guardGone:true}); }catch(e){} }
    /* ★「釣り」の情報（社長の指摘）。
       「地面タイプの相手がじしんを打ってくるよね → ギャラドスに変えよう。
         電気タイプが電気技を打ってくるよね → カバルドンに変えよう。
         **あえて効果抜群の対面を作って、引くことで無効化する**」
       最悪ケース（げきりん等）だけ出すと、この読みが画面から消える。
       **採用率がいちばん高い技を無効化できるなら、それを必ず併記する。** */
    const t = PC.SPECIES[r.name] ? PC.SPECIES[r.name].types : [];
    const ab = PC.immuneType(r.ability||'');
    const bait = (PC.oppMoves(oppEff, 30)||[])
      .filter(x=> x.type===ab || PC.effectiveness(x.type, t)===0)
      .sort((a,b)=> b.rate-a.rate)[0] || null;
    return { r, n:r.disp||r.label, d, pct, move:w?w.move:'', mark:cc.mark, head:cc.head,
             free: d===0 || pct<0.2, res: (d>0 ? res : null), after, bait, fullBlock,
             intimidate: (r.ability||'')==='いかく',
             /* 完全に防ぐ手段を持っているなら、被ダメージが大きくても「引ける」 */
             ng: !fullBlock && pct>=0.8 };
  }).filter(Boolean);
  if(!cand.length) return '';
  /* 釣れる（主力技を無効化できる）駒は、最悪ケースが重くても選択肢として上に出す */
  const rank = x => x.free?0 : (x.bait && x.bait.rate>=50)?1 : x.ng?4 : x.res?3 : 2;
  cand.sort((a,b)=> rank(a)-rank(b) || a.pct-b.pct);
  const best = cand[0];
  const line = x =>
      x.ng   ? `<span style="color:var(--red)"><b>${esc(x.n)}</b> は引けません（${esc(x.move)}で${x.d}/${x.r.stats.h}＝${Math.round(x.pct*100)}%）</span>`
    : x.free ? `<b>${esc(x.n)}</b> <span style="color:var(--grn)">タダで降りられます</span><span class="muted">（${x.d?`${esc(x.move)}で${x.d}`:esc(x.move)+'は無効'}）</span>${x.intimidate?'<span style="color:var(--grn)"> ・いかくが再発動</span>':''}`
    : x.res  ? `<b>${esc(x.n)}</b> <span style="color:var(--org)">交代の1発で${esc(x.res)}</span>`
             + (x.fullBlock?`<span class="muted">（1発は防ぎますが、それに使ってしまいます）</span>`:'')
             + (x.after?`<br><span class="muted" style="margin-left:12px">└ そのあとは <b>${x.after.mark}${esc(x.after.head)}</b>・一撃で落とされうる <b>${x.after.pOHKO}%</b>${
                 x.mark!==x.after.mark?`（対面で出していれば ${x.mark}）`:''}</span>`:'')
             : `<b>${esc(x.n)}</b> <span class="muted">${esc(x.move)}で ${x.d}/${x.r.stats.h}（${Math.round(x.pct*100)}%）食らって降ります</span>`;
  const baitLine = x => (x.bait && !x.free)
    ? `<div class="small" style="margin-left:12px;color:var(--grn)">└ <b>${esc(x.bait.name)}(${x.bait.rate}%)</b>を撃たれるなら<b>無効で降りられます</b>${
        x.move?`<span class="muted">（${esc(x.move)}を撃たれると${Math.round(x.pct*100)}%）</span>`:''}</div>` : '';

  /* 引かずに戦った場合の見通し。捨て駒にする判断の材料 */
  const stay = (()=>{
    const hits = c.mu.opHits, my = c.mu.myHits;
    const best2 = (c.moves && c.moves.best) ? c.moves.best : null;
    return `<span class="muted">引かずに戦うと：</span>相手に落とされるまで<b>${hits}発</b>`
      + (best2 ? `／<b>${esc(best2.name)}</b>で相手を落とすのに<b>${my}発</b>` : '');
  })();

  return `<div class="small" style="margin-top:6px">
    <div>引くなら → ${line(best)}</div>${baitLine(best)}
    ${cand.slice(1).filter(x=>!x.ng||cand.length<=2).slice(0,2).map(x=>`<div style="margin-top:2px">${line(x)}${baitLine(x)}</div>`).join('')}
    <div style="margin-top:4px;padding-top:4px;border-top:1px dashed var(--line)">${stay}</div>
    ${(!best.free)?`<div class="small muted" style="margin-top:3px">
      引くと交代の1ターンをタダで殴られます。${best.res?'<b>その駒の強みを先に使い切る</b>ことになるので、':''
      }<b>ここで削り切る／捨て駒にして次を万全で出す</b>方が良い場面もあります</div>`:''}
  </div>`;
}

/* ★「3体をチームとして役割が回るか」を出す（2026-08-21・v80・社長の指摘）。
   社長：「一対一の対面が強いのをただ出せばいいわけじゃない。ちゃんと三体をチームとして
     役割を持たせて戦わなきゃ勝てない。木を見て森を見ずになると負ける」

   ★これまでの選出スコアは **◎○の数の足し算** しか見ていなかった。
     そのせいで、実戦（ハラバリー戦）で起きたことが表現できていなかった：
       ・ガブリアスの じしん(99.3%) を無効化できるのは カイリューとギャラドスだけ。
         選出（カバルドン/メガルカリオ/ミミッキュ）には**1枚も無かった**ので開幕で2体落ちた
       ・ハラバリーの でんき を無効化できるのは カバルドンだけ。
         みずびたし(93.8%)でその無効が消える。**引き先が残っていれば引いて戻すだけで復活する**
     ＝「1v1で勝てるか」ではなく「**無償で降りられる駒があるか／引き先が残っているか**」。

   ここは点数を書き換えず、**事実だけを並べる**（並べ替えは38戦で回して悪化させた実績があるため）。 */
function btRoleCard(rc){
  if(!BT.opp.length || !rc.length) return '';
  const inPickL = m => BT.picks.includes(m.label) || BT.picks.includes(m.name);
  const rows = BT.opp.map(n=>{
    const o = effOppBT(n);
    const mv = (PC.oppMoves(o, 30) || []).sort((a,b)=> b.rate-a.rate);
    if(!mv.length) return null;
    /* その相手の攻撃技を、採用率の合計で何%ぶん無効にできるか */
    const canFree = rc.map(m=>{
      const t = PC.SPECIES[m.name] ? PC.SPECIES[m.name].types : [];
      const ab = PC.immuneType(m.ability||'');
      const zero = mv.filter(x=> x.type===ab || PC.effectiveness(x.type, t)===0);
      /* ★合計ではなく「いちばん採用率の高い技」で見る。足すと121%のような数字になって意味が壊れる */
      const rate = zero.length ? Math.max(...zero.map(x=>x.rate)) : 0;
      return {m, rate, moves:[...new Set(zero.map(x=>x.name))],
              /* ★その相手の**主力技そのもの**を止められるか。ここが本体。
                 ミミッキュはガブリアスのドラゴン技(77%)を無効にできるが、
                 実際に落とされたのは じしん(99.3%)。「何かを無効にできる」では足りない。 */
              stopsTop: zero.some(x=> x.name===mv[0].name)};
    }).filter(x=> x.rate>=30).sort((a,b)=> b.rate-a.rate);
    const top = canFree.filter(x=>x.stopsTop);
    return {n, top:mv[0], canFree,
            inPick: top.filter(x=> inPickL(x.m)), bench: top.filter(x=> !inPickL(x.m))};
  }).filter(Boolean);
  if(!rows.length) return '';
  const holes = rows.filter(r=> !r.inPick.length && r.bench.length);
  return `<div style="margin-top:10px">
    <div class="small" style="font-weight:700">無償で降りられる相手
      <span class="muted"> ・相手の主力技を0にできる駒。1v1の有利不利とは別の軸です</span></div>
    <table style="width:100%;margin-top:5px;font-size:13px">
      ${rows.map(r=>`<tr style="border-top:1px solid var(--line2)">
        <td style="padding:5px 6px 5px 0;white-space:nowrap;vertical-align:top">
          <span style="display:inline-flex;align-items:center;gap:2px">${typeDots(effOppBT(r.n))}<b>${esc(r.n)}</b></span></td>
        <td style="padding:5px 0;vertical-align:top">
          ${r.canFree.length
            ? r.canFree.map(x=>`<span style="display:inline-flex;align-items:center;gap:2px;margin-right:8px;${
                inPickL(x.m)?'font-weight:700':'opacity:.5'}">${typeDots(x.m.name)}${esc(x.m.disp||x.m.label)}
                <span class="muted">${esc(x.moves.slice(0,2).join('・'))}${x.moves.length>2?'他':''} ${Math.round(x.rate)}% を無効${
                  x.stopsTop?'':'（主力は止まらない）'}${inPickL(x.m)?'':'・控え'}</span></span>`).join('')
            : `<span class="muted">無効にできる駒はいません（主力 ${esc(r.top.name)} ${r.top.rate}%）</span>`}
        </td></tr>`).join('')}
    </table>
    ${holes.length?`<div class="small" style="margin-top:6px;color:var(--org)">
      <b>いまの選出では、この主力技を止められる駒が入っていません：</b>
      ${holes.map(h=>`<b>${esc(h.n)}の${esc(h.top.name)}(${h.top.rate}%)</b> → 控えの ${
        h.bench.map(x=>esc(x.m.disp||x.m.label)).join('・')} なら無効`).join(' ／ ')}
      <br><span class="muted">入れておくと、その技が飛んでくるたびに無償で降りられます</span></div>`:''}
  </div>`;
}
function btLeadCandidates(rc){
  if(!BT.opp.length || !rc.length) return '';
  const opp = BT.opp.map(effOpp);
  const rows = rc.map(m=>{
    let good=0; const bad=[], ohko=[];
    opp.forEach(o=>{
      let c=null; try{ c = PC.callIt(m, o, {oppTeam:opp, st:BT.board||{}}); }catch(e){}
      if(!c) return;
      if(c.mark==='◎'||c.mark==='○') good++;
      if(c.mark==='✕') bad.push(o);
      if(c.pOHKO >= 25) ohko.push(o);       // 一撃で落とされうる相手は別枠で出す
    });
    /* 危ない相手が来たときの逃げ先。いちばん危ない1体についてだけ出す（増やすと読まなくなる） */
    const worst = ohko[0] || bad[0] || null;
    let escape = null;
    if(worst){
      const alt = rc.filter(x=>x.label!==m.label).map(x=>{
        try{ return {n:x.label, c:PC.callIt(x, worst, {oppTeam:opp, st:BT.board||{}})}; }catch(e){ return null; }
      }).filter(x=>x&&x.c).sort((a,b)=> b.c.mu.score-a.c.mu.score)[0];
      if(alt && (alt.c.mark==='◎'||alt.c.mark==='○')) escape = {to:alt.n, from:worst, mark:alt.c.mark};
    }
    return {m, good, bad, ohko, escape};
  }).sort((a,b)=> b.good-a.good || a.bad.length-b.bad.length);

  const top = rows.slice(0,3);
  return `<div style="margin-top:10px">
    <div class="small" style="font-weight:700">先発の候補<span class="muted"> ・相手6体に対して。上から順に有利が多い</span></div>
    <table style="width:100%;margin-top:5px;font-size:13px">
      ${top.map((r,i)=>`<tr style="border-top:1px solid var(--line2)">
        <td style="padding:6px 6px 6px 0;vertical-align:top;white-space:nowrap">
          <b>${i+1}. ${esc(r.m.disp||r.m.label)}</b><br>
          <span class="small muted">有利 ${r.good}/${opp.length}体</span>
        </td>
        <td style="padding:6px 0;vertical-align:top">
          ${r.ohko.length
            ? `<span style="color:var(--red)">一撃で落とされる：<b>${r.ohko.map(esc).join('・')}</b></span><br>`
            : ''}
          ${r.bad.length
            ? `<span class="muted">通らない：${r.bad.filter(x=>!r.ohko.includes(x)).map(esc).join('・')||'なし'}</span>`
            : '<span class="muted">通らない相手なし</span>'}
          ${r.escape ? `<br><span class="small muted">${esc(r.escape.from)}が来たら → <b>${esc(r.escape.to)}</b>（${r.escape.mark}）</span>` : ''}
        </td>
      </tr>`).join('')}
    </table>
  </div>`;
}
/* ★持ち物の確定は状態なので、**計算する画面が毎回宣言する**（鉄則⑤）。
   宣言し忘れると、実戦タブで入れた確定が対面タブにも効いて数字が食い違う。 */
function syncOppItems(){ PC.setOppItems((BT && BT.oppItem) || {}); }
function btCompute(){
  syncOppItems();
  const roster = currentRoster();
  if(!roster.length || !BT.opp.length){ BT.matrix=null; return; }
  const size = $('#fRule').value==='double' ? 4 : 3;
  /* ★2026-08-20 の重大な設計ミス（実戦7戦の分析で判明）。
     記録タブは `bestPlan(roster, 予想された相手の3体, ...)` を渡していたのに、
     **実戦で使うこのタブだけ相手6体をそのまま渡していた**。
     相手6体を等しく見ると「広く浅く見られる駒」が必ず選ばれるため、
     相手が誰でも同じ3体（カバルドン/メガルカリオ/カイリュー）が推奨され続け、
     社長は6戦中5戦それに従って1勝4敗になった。**相手に合わせた選出になっていなかった。**
     → 相手が実際に出してくる3体を予想し、それを潰せる3体を選ぶ。
        6体全部は「予想が外れたときの保険（backup）」として引き続き見る。 */
  const neutral = rosterForCalc(roster, null);
  const pp = PC.predictPicks(BT.opp, BATTLES, neutral, size, META_TOP);
  const targets = (pp && pp.picks && pp.picks.length) ? pp.picks : BT.opp;
  BT.oppPredict = targets;
  const bp = bestPlan(roster, targets, size, BT.opp, BT.megaFixed, effOppBT);
  BT.picks = bp.plan ? bp.plan.members : roster.slice(0,size).map(m=>m.name);
  BT.mega  = bp.mega;
  // メガ枠が選出に入っていなければ、そのメガは切れない。嘘を出さないよう必ず外す
  if(BT.mega && !BT.picks.includes(BT.mega)) BT.mega = null;
  /* ★選出の並びは「初手に出す順」にする（社長の指摘 2026-08-20）。
     以前は選出カードの並びと、いまの対面で最初に選ばれる駒が別々の理屈で決まっていたため、
     「選出はカバルドンが先頭なのに、対面ではメガルカリオが押されている」という状態になり、
     毎試合そこを押し直す無駄が発生していた。
     → 相手の先発予想に対していちばん強い駒を先頭に置き、対面の既定もそれに揃える。 */
  const leadGuess = (PC.predictLead(targets, BATTLES)||[])[0];
  if(leadGuess && BT.picks.length>1){
    const rcLead = rosterForCalc(roster, BT.mega);
    const scoreOf = n => {
      const me = rcLead.find(r=>r.label===n||r.name===n);
      if(!me) return -1;
      const c = PC.callIt(me, effOppBT(leadGuess.name), {});
      return c ? c.mu.score : -1;
    };
    BT.picks = [...BT.picks].sort((a,b)=> scoreOf(b)-scoreOf(a));
    BT.leadGuess = leadGuess.name;      // 画面で「相手の先発予想」を出すために持っておく
  }

  // メガ枠を手で変えたら、その姿で全部計算し直す（bp.rc は提案時のもの）
  const rc = (BT.megaFixed ? rosterForCalc(roster, BT.mega) : (bp.rc || rosterForCalc(roster, BT.mega)));
  BT.matrix = {};
  BT.opp.forEach(o=>{
    const knownOf = BT.obs && BT.obs[o] ? BT.obs[o] : null;
    BT.matrix[o] = roster.map(m=>{
      const me = rc.find(r=>r.label===m.name) || {name:m.name};
      const c = PC.callIt(me, effOppBT(o), {known:knownOf, st:BT.board||{}});
      return { name:m.name, mu: c ? c.mu : PC.matchup(me,{name:effOppBT(o), known:knownOf}), call:c };
    }).filter(x=>x.mu);
  });
}

/** 1対面の結論を1語で */
/* 対面表の1マス。結論は PC.callIt() に一本化してあるので、ここは短縮表示だけ。 */
function btAct(mu, c){
  if(c) return {c:c.cls, t:c.head, m:c.mark};
  if(mu.opOHKO) return {c:'ng', t:'一撃で落ちる', m:'✕'};
  if(mu.noOffense) return {c:'ng', t:'打点なし', m:'✕'};
  if(mu.winsAll) return {c:'ok', t:'殴る', m:'◎'};
  if(mu.split) return {c:'wn', t:'様子見', m:'△'};
  return mu.winsRace ? {c:'ok', t:'殴る', m:'○'} : {c:'ng', t:'引く', m:'✕'};
}

function btRender(){
  const roster = currentRoster();
  /* 選んだ6体。試合中にスクロールさせないため、タイプは小さい丸だけにして1行に複数入るようにする。 */
  /* ★選んだ6体が候補チップと同じ見た目で、どれが「入っている」のか分からなかった（社長の指摘 2026-08-20）。
     6体そろうと候補が押せなくなるので、外す×の場所が分からないと詰む。見出しを付けて区別する。 */
  $('#btOppChips').innerHTML = BT.opp.length
    ? `<div class="small" style="width:100%;font-weight:700;color:${BT.opp.length>=6?'var(--org)':'var(--muted)'}">`
      + `いま入っている ${BT.opp.length}体${BT.opp.length>=6?'（そろいました。入れ替えるなら × で外す）':' / 6体'}</div>`
      + BT.opp.map((n,i)=>`<span class="pk mini">${typeDots(n)}<b>${esc(n)}</b><span class="x" data-bx="${i}">×</span></span>`).join('')
    : '<span class="pk ghost">下から6体を選んでください</span>';
  $$('#btOppChips [data-bx]').forEach(x=> x.onclick=()=>{
    BT.opp.splice(+x.dataset.bx,1); btCompute(); btRender();
    // 外したら候補欄も戻す（押せない見た目のまま残ると、また選べないと思われる）
    if(BT._typeRender) BT._typeRender();
    if(BT._searchRender) BT._searchRender();
  });

  /* 入力の候補。すでに何体か入っていれば「上位構築での同居率」で並べ替える。
     選出は90秒しかないので、探す時間を1体でも減らすのが効く。
     出典: champs.pokedb.tokyo の上位構築517件（app/data/teams.js）。 */
  const seen={}; BATTLES.forEach(b=>(b.opp_team||[]).forEach(n=>seen[n]=(seen[n]||0)+1));
  const hist=Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n])=>n);
  let list, why='';
  if(BT.opp.length){
    const pred = PC.predictRest(BT.opp, 12);
    if(pred.length){
      list = pred.map(p=>p.name).filter(n=>PC.SPECIES[n]);
      why = `<div class="small muted" style="margin-top:6px">いま入っている${BT.opp.length}体と<b>一緒に使われやすい順</b>に並べています（上位構築517件）</div>`;
    }
  }
  if(!list || !list.length) list = (hist.length>=6?hist:META_TOP.slice(0,10));
  const qFull = BT.opp.length>=6;
  $('#btQuick').innerHTML = why + list.filter(n=>!BT.opp.includes(n)).slice(0,12)
      .map(n=>`<button class="qb mini ${qFull?'dim':''}" data-bq="${esc(n)}">${typeDots(n)}${esc(n)}</button>`).join('');
  $$('#btQuick [data-bq]').forEach(b=> b.onclick=()=>{
    if(BT.opp.length>=6) return toast('6匹までです',true);
    if(BT.opp.includes(b.dataset.bq)) return;
    if(BT.opp.length===5){ const w=$('#btInputWrap'); if(w) setTimeout(()=>{w.open=false;},0); }
    BT.opp.push(b.dataset.bq); btCompute(); btRender();
  });

  if(!BT.matrix || !roster.length){ $('#btPlan').innerHTML=''; $('#btGrid').innerHTML=''; $('#btDetail').innerHTML=''; return; }
  const rc = rosterForCalc(roster, BT.mega);

  /* 選出は試合開始時に一度読むもの。試合中は「いまの対面」を見るので、折りたたんで高さを取らない。 */
  $('#btPlan').innerHTML = `<details open class="planbox">
    <summary class="cardsum" style="border-left:3px solid var(--fg)">
      <span>選出 <b>${BT.picks.map((n,i)=> (i===0?'初手 ':'') + esc(dispName(rc,n))).join(' / ')}</b>${BT.mega?`<span class="muted"> ・メガ=${esc(BT.mega)}</span>`:'<span class="muted"> ・メガは切らない</span>'}${BT.leadGuess?`<span class="muted"> ・相手の先発予想=${esc(BT.leadGuess)}</span>`:''}</span>
    </summary>
    <div class="card" style="border-left:3px solid var(--fg)">
    ${(()=>{ const slots = megaSlotsOf(roster);
      if(slots.length<=1) return BT.mega?`<div class="small">メガは <b>${esc(BT.mega)}</b> に切る</div>`:'';
      return `<div class="small" style="margin-top:6px">メガをどれに切るか（変えると全部の判定が変わります）</div>
        <div class="quick" style="margin-top:4px">${slots.map(sl=>
          `<button class="qb ${BT.mega===sl?'on':'off'}" data-btmega="${esc(sl)}">${esc(sl)}</button>`).join('')}</div>`;
    })()}
    ${safeHtml('先発候補', ()=> btLeadCandidates(rc))}
    ${safeHtml('役割', ()=> btRoleCard(rc))}
    ${(()=>{ /* ★落とされると一気に苦しくなる駒。毎回は出さず、
                「その駒だけが答えになっている相手が2体以上」のときだけ出す。 */
      const picks = rc.filter(r=> BT.picks.includes(r.label) || BT.picks.includes(r.name));
      if(picks.length<2) return '';
      const k = PC.keyPieces(picks, BT.opp.map(effOpp), {known: BT.obs||{}});
      let h='';
      k.keys.forEach(x=> h += `<div>・<b>${esc(x.name)}</b> は <b>${x.only.map(esc).join('・')}</b> の唯一の答え。
        <b style="color:var(--red)">先に落とされると受けが無くなる</b>ので温存する</div>`);
      if(k.uncovered.length) h += `<div>・<b style="color:var(--red)">${k.uncovered.map(esc).join('・')}</b> は
        この3体では誰も見れない。無理に殴らず、削って交代で回す</div>`;
      return h ? `<div class="note w" style="margin-top:8px"><div class="small">${h}</div></div>` : '';
    })()}
    ${(()=>{ // ★一撃で落とされる対面。試合前にこれだけは頭に入れる
      const ko=[];
      BT.opp.forEach(o=>{ (BT.matrix[o]||[]).forEach(c=>{
        if(BT.picks.includes(c.name) && c.call && c.call.pOHKO >= 25){
          const k = c.call.koMoves[0];
          ko.push(`<b>${esc(dispName(rc,c.name))}</b>は<b>${esc(o)}</b>の<b>${esc(k.move)}</b>`
                + `<span class="muted">(${k.rateOf}%)</span>で一撃`
                + `<span class="muted"> — 該当する型は約${c.call.pOHKO}%</span>`);
        }
      });});
      return ko.length?`<div class="note r" style="margin-top:8px"><div class="small">${ko.map(x=>'・'+x).join('<br>')}</div></div>`:'';
    })()}
    ${(()=>{const t=[];BT.opp.forEach(n=>PC.oppTricks(PC.toBase(n)).forEach(([mv,why])=>t.push(`<b>${esc(n)}</b>の<b>${esc(mv)}</b> — ${esc(why)}`)));
      return t.length?`<details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">相手の変化技・妨害技（${t.length}件）</summary>
        <div class="small" style="margin-top:6px">${t.map(x=>'・'+x).join('<br>')}</div></details>`:'';})()}
  </div></details>
  <!-- ★危ないタイプ（v70）。左カラムに置く。中身は btNowRender が入れる
       （いま出している駒が確定するのが btNowRender のため）。
       社長の要望：「対面の中じゃなくて外に出したい。PCの左下の空きスペースに。
       スクロールしないと見に行けないのを直したい」 -->
  <div id="btDanger"></div>
`;
  // 終了まわりは「いまの対面」の下に置く（btNowRender のあとに描く）
  const endHost = $('#btEnd');
  if(endHost) endHost.innerHTML = `
    <button class="btn primary btn-full" id="btDone" style="margin-bottom:8px">試合が終わった</button>
    <div id="btDoneBox" style="margin-bottom:14px"></div>
    <div class="hpwrap" style="margin-bottom:14px">
      <button class="btn ghost sm" id="btToRec">くわしく書く（記録タブへ送る）</button>
      <button class="btn ghost sm" id="btNewGame" style="margin-left:auto">次の試合へ（入力を消す）</button>
    </div>`;

  /* 保存しないで次の試合に行きたいときのために、いつでも押せるリセットを置く。
     保存後は自動でリセットされるが、記録しない試合もあるため（社長の要望 2026-08-20）。 */
  const ng = $('#btNewGame');
  if(ng) ng.onclick = ()=>{
    if(BT.opp.length && !confirm('いま入っている相手6体と記録を消して、次の試合の入力に戻ります。よろしいですか？')) return;
    BT = newBT();
    PC.clearMatchupCache(); if(window.VOICE) VOICE.reset();
    saveBtDraft(); btCompute(); btRender();
    const w=$('#btInputWrap'); if(w) w.open=true;
    window.scrollTo(0,0);
    toast('次の試合の入力に戻りました（相手の技も消しています。相手ごとに技は違うため）');
  };

  /* ---------- 試合が終わったら、その場で数タップだけ残す ----------
     社長の要望（2026-08-20）：
     「一手ずつ全部記録するのは大変で続かない。勝った試合は分析いらない。
       負けた試合の敗因が溜まればいい。相手6体・実際の選出・苦しめられた技・立ち回りが
       ざっくり残れば、同じ技を使う他のポケモンにも対策できる」
     → 勝ち=2タップ、負け=数タップ。記録タブへ移動させない（移動が最大のハードルだった）。 */
  BT.done = BT.done || {};
  const btDoneRender = ()=>{
    const box = $('#btDoneBox'); if(!box) return;
    const d = BT.done;
    if(!d.open){ box.innerHTML=''; return; }
    const chips = (arr, key, multi)=> arr.map(n=>{
      const on = multi ? (d[key]||[]).includes(n) : d[key]===n;
      return `<button class="qb mini ${on?'on':'off'}" data-dn="${key}" data-dv="${esc(n)}">${typeDots(n)}${esc(n)}</button>`;
    }).join('');
    /* 敗因ごとに聞き方を変える。「一言メモ」と書かれても何を書けばいいか分からないため
       （社長の要望 2026-08-20：プレイングミスなら"何がミスだったか"を聞いてほしい）。 */
    const CAUSES = ['構築の相性','選出ミス','技の相性','プレイングミス','相手の立ち回り','事故（急所・命中）'];
    const ASK = {
      '構築の相性':'どの並びに詰んだ？（例：受け2枚で崩せなかった）',
      '選出ミス':'どう選べばよかった？（例：ギャラドスを出すべきだった）',
      '技の相性':'どの技が無かった／通らなかった？（例：鋼に打点が無い）',
      'プレイングミス':'何がミスだった？（例：交代読みを外して裏に負担）',
      '相手の立ち回り':'どんな立ち回り・コンボがきつかった？（例：あくび＋設置で回された）',
      '事故（急所・命中）':'何が外れた／急所に当たった？'
    };
    // やられた技の候補は、選んだ相手の実採用技をそのまま出す（打ち込ませない）
    const mvs = d.painMon ? (PC.oppMoveChoices(d.painMon)||[]).slice(0,10) : [];
    box.innerHTML = `<div class="card" style="border-left:3px solid var(--fg)">
      <div class="small" style="font-weight:800;margin-bottom:6px">結果</div>
      <div class="quick">
        <button class="qb ${d.result==='win'?'on':'off'}" data-dn="result" data-dv="win">勝ち</button>
        <button class="qb ${d.result==='lose'?'on':'off'}" data-dn="result" data-dv="lose">負け</button>
      </div>
      ${(()=>{ /* ★実際に出した3体（v65）。ここを記録していなかったため、
           保存されていた「こちらの選出」は**ツールの推奨**で、社長が本当に出した3体ではなかった。
           試合中に「自分」チップで押した駒が初期値なので、ふつうは確認するだけで済む。 */
        const rc2 = rosterForCalc(currentRoster(), BT.mega);
        const cur = (d.myPick && d.myPick.length) ? d.myPick : (BT.usedMine||[]).slice(0,3);
        const ok = cur.length===3;
        return `<div class="small" style="font-weight:800;margin-top:12px">
            実際に出した3体<span class="muted"> ${ok?'合っていればそのまま':'タップして選んでください'}</span></div>
          <div class="quick">${rc2.map(m=>{
            const i = cur.indexOf(m.label);
            return `<button class="qb mini ${i>=0?'on':'off'}" data-dn="myPick" data-dv="${esc(m.label)}">${
              i>=0?`<b>${'①②③'[i]||''}</b> `:''}${typeDots(m.name)}${esc(m.disp||m.label)}</button>`;
          }).join('')}</div>
          <div class="small ${ok?'muted':''}" style="${ok?'':'color:var(--org)'}">${
            ok ? `実際に出した3体：${cur.join(' → ')}`
               : `<b>${cur.length}体しか選ばれていません。</b>ツールの推奨ではなく、あなたが実際に出した3体を残します`}</div>`;
      })()}
      <div class="small" style="font-weight:800;margin-top:12px">相手の選出<span class="muted"> 出てきた順にタップ（①が初手）</span></div>
      <div class="quick">${BT.opp.map(n=>{
        const i=(d.oppPick||[]).indexOf(n);
        return `<button class="qb mini ${i>=0?'on':'off'}" data-dn="oppPick" data-dv="${esc(n)}">${
          i>=0?`<b>${'①②③'[i]||''}${i===0?' 初手':''}</b> `:''}${typeDots(n)}${esc(n)}</button>`;
      }).join('')}</div>
      <div class="small muted">${(d.oppPick||[]).length? `相手の選出：${d.oppPick.join(' → ')}${(d.oppPick||[]).length<3?'（見えた分だけでOK）':''}`
        : '試合中にタップしていれば自動で入ります'}</div>
      ${d.result==='lose' ? `
        <div class="small" style="font-weight:800;margin-top:12px">なぜ負けたか<span class="muted"> いくつでも選べます</span></div>
        <div class="quick">${CAUSES.map(c=>
          `<button class="qb mini ${(d.causes||[]).includes(c)?'on':'off'}" data-dn="causes" data-dv="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        ${(d.causes||[]).length?`<div class="small muted" style="margin-top:8px">${
            (d.causes||[]).map(c=>esc(ASK[c]||c)).join('<br>')}</div>
          <textarea id="btDoneMemo" rows="${Math.min(4,(d.causes||[]).length+1)}" placeholder="一言でOK。空でも保存できます">${esc(d.memo||'')}</textarea>`:''}
        <div class="small muted" style="margin-top:10px">いちばんきつかった相手</div>
        <div class="quick">${chips(BT.opp,'painMon',false)}</div>
        ${mvs.length?`<div class="small muted" style="margin-top:10px">やられた技</div>
          <div class="quick">${mvs.map(m=>
            `<button class="qb mini ${d.painMove===m.name?'on':'off'}" data-dn="painMove" data-dv="${esc(m.name)}">${esc(m.name)}<span class="muted"> ${m.rate}%</span></button>`).join('')}</div>`:''}
        <div class="small muted" style="margin-top:10px">出しておけばよかった駒<span class="muted">（結果論でOK。溜まると選出の型になります）</span></div>
        <div class="quick">${(currentRoster()||[]).map(m=>
          `<button class="qb mini ${d.should===m.name?'on':'off'}" data-dn="should" data-dv="${esc(m.name)}">${typeDots(m.name)}${esc(m.name)}</button>`).join('')}</div>
        <div class="small muted" style="margin-top:10px">あると良かった技<span class="muted">（駒は合っていたが技が足りなかったとき）</span></div>
        <input type="text" id="btDoneWant" list="mvlist" placeholder="例：れいとうパンチ" value="${esc(d.want||'')}">
      ` : ''}
      <div class="hpwrap" style="margin-top:12px">
        <button class="btn primary" id="btDoneSave">この内容で保存</button>
        <button class="btn ghost sm" id="btDoneCancel">やめる</button>
      </div>
      <div class="small muted" style="margin-top:6px">${d.result==='lose'?'空のままでも保存できます。分かるところだけで十分です':'勝ち試合は結果だけで十分です'}</div>
    </div>`;
    const keepText = ()=>{ const m=$('#btDoneMemo'), w=$('#btDoneWant');
      if(m) d.memo=m.value; if(w) d.want=w.value; };
    ['#btDoneMemo','#btDoneWant'].forEach(sel=>{ const el=$(sel); if(el) el.oninput=keepText; });
    $$('#btDoneBox [data-dn]').forEach(b=> b.onclick=()=>{
      keepText();
      const k=b.dataset.dn, v=b.dataset.dv;
      if(k==='oppPick'){ const a=d.oppPick||[]; const i=a.indexOf(v);
        if(i>=0) a.splice(i,1); else if(a.length<3) a.push(v); d.oppPick=a; }
      /* 実際に出した3体。初期値は試合中に押した駒。押し直しで修正できる（v65） */
      else if(k==='myPick'){
        const a = (d.myPick && d.myPick.length) ? d.myPick : (BT.usedMine||[]).slice(0,3);
        const i = a.indexOf(v);
        if(i>=0) a.splice(i,1); else if(a.length<3) a.push(v);
        d.myPick = a;
      }
      else if(k==='causes'){ const a=d.causes||[]; const i=a.indexOf(v);
        if(i>=0) a.splice(i,1); else a.push(v); d.causes=a; }   // 敗因は複数選べる（原因は1つとは限らない）
      else d[k] = (d[k]===v ? null : v);
      if(k==='painMon') d.painMove=null;              // 相手を変えたら技の選択は捨てる
      btDoneRender();
    });
    $('#btDoneCancel').onclick = ()=>{ BT.done={}; btDoneRender(); };
    $('#btDoneSave').onclick = async ()=>{
      keepText();
      if(!d.result) return toast('勝ち／負けを選んでください',true);
      /* ★実際に出した3体が入っていないと、分析の土台が壊れる（v65の修正点そのもの）。
         入っていなければ、試合中に押した駒で補う。それも無ければ止める。 */
      if(!d.myPick || !d.myPick.length) d.myPick = (BT.usedMine||[]).slice(0,3);
      /* ★ここでツールの推奨を代わりに入れない。それをやっていたのが今回の不具合の正体。
         分からないまま埋めるより、1タップ聞く方がよい。 */
      if(d.myPick.length < 3) return toast('「実際に出した3体」をタップしてください（分析がこれで決まります）', true);
      const rec={ user_id:USER.id, team_id:$('#fTeam').value||null, played_at:todayStr(),
        season:$('#fSeason').value||null, rule:$('#fRule').value||'single', rank:$('#fRank').value||null,
        /* ★my_pick は「実際に出した3体」。以前はここに BT.picks（＝ツールの推奨）を
           そのまま入れていたため、**社長が推奨と違う選出をしても記録は推奨のまま**だった。
           駒ごとの勝率も選出別の勝率も、実際の選出ではなく推奨に対する数字になっていた（v65で修正）。 */
        opp_team:BT.opp, my_pick:d.myPick,
        opp_pick:d.oppPick||[], mega:BT.mega||null,
        turns:[], result:d.result,
        lose_cause:(d.causes||[]).join(' / ')||null, pain_mon:d.painMon||null, pain_move:d.painMove||null,
        memo:(d.memo||'').trim()||null, should_pick:d.should||null, want_move:(d.want||'').trim()||null,
        reason:d.result==='lose' ? [(d.causes||[]).join('・'),d.painMon&&`${d.painMon}がきつい`,d.painMove&&`${d.painMove}でやられた`,
          d.should&&`${d.should}を出すべきだった`,(d.memo||'').trim()].filter(Boolean).join(' / ') : null };
      $('#btDoneSave').disabled=true;
      const res = await dbWrite('battles','insert',rec);
      $('#btDoneSave').disabled=false;
      if(!res.ok) return toast('保存に失敗: '+res.error.message, true);
      /* ★保存したら次の試合をすぐ始められる状態に戻す（社長の指摘 2026-08-20）。
         相手の技の観測（BT.obs）だけは残す。同じ相手に何度も当たるので次の試合でも効くため。 */
      BT = newBT();
      PC.clearMatchupCache(); if(window.VOICE) VOICE.reset();
      saveBtDraft();                      // 空になった状態を保存し直す（キーは 'pokechan_bt'）
      await loadBattles(); renderAll();
      window.scrollTo(0,0);
      res.dropped.length ? warnDropped(res.dropped)
        : toast(`保存しました（通算 ${BATTLES.length} 戦）。次の試合をどうぞ`);
    };
  };
  const doneBtn = $('#btDone');
  // 相手の選出は、試合中にタップした順から自動で埋める（入れ直させない）
  if(doneBtn) doneBtn.onclick = ()=>{ BT.done={open:true, oppPick:[...(BT.seenOrder||[])]}; btDoneRender(); };
  btDoneRender();

  /* 試合が終わったら、実戦タブで集めたもの（相手6体・選出・メガ枠・観測した技）を
     記録タブへそのまま渡す。ここを繋いでいなかったので、タップで記録した相手の技が
     端末内に留まったまま、分析にも履歴にも入っていなかった（2026-08-19 の棚卸しで判明）。 */
  const send = $('#btToRec');
  if(send) send.onclick = ()=>{
    S.opp = [...BT.opp];
    S.myPick = [...BT.picks];
    S.mega = BT.mega || null;
    // 観測した技を「ターンの記録」の形に変換する（observedMoves() がこの形を読む）
    const turns = [];
    Object.entries(BT.obs||{}).forEach(([o, moves])=>{
      (moves||[]).forEach(mv=> turns.push({ n:turns.length+1, myMon:null, oppMon:o,
        myAct:{type:'move'}, oppAct:{type:'move', move:mv}, note:'実戦タブで記録' }));
    });
    if(turns.length) S.turns = [...(S.turns||[]), ...turns];
    renderAll(); saveDraft();
    const tab = [...document.querySelectorAll('button.tab')].find(b=>b.dataset.tab==='rec');
    if(tab) tab.click();
    window.scrollTo(0,0);
    toast(`相手6体・選出・観測した技${turns.length}件を記録に送りました。勝敗と敗因を入れて保存してください`);
  };

  $$('#btPlan [data-btmega]').forEach(b=> b.onclick=()=>{
    BT.megaFixed = b.dataset.btmega; BT.mega = BT.megaFixed;
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  });

  // 相手 × 自分の選出3体。タップで詳細
  $('#btGrid').innerHTML = `<div class="card"><h2>対面表<span class="sub">出てきた相手をタップ</span></h2>
    <table><tr><th>相手</th>${BT.picks.map(p=>`<th class="num">${esc(p.slice(0,5))}</th>`).join('')}</tr>
    ${BT.opp.map(o=>{
      const row = BT.matrix[o]||[];
      return `<tr data-bo="${esc(o)}" style="cursor:pointer">
        <td>${typeChips(o)} ${esc(o)}</td>
        ${BT.picks.map(p=>{ const c=row.find(x=>x.name===p);
          if(!c) return '<td class="num">—</td>';
          const a=btAct(c.mu, c.call);
          return `<td class="num"><span class="badge ${a.c}">${a.t}</span></td>`;
        }).join('')}</tr>`;
    }).join('')}</table></div>`;
  $$('#btGrid [data-bo]').forEach(tr=> tr.onclick=()=>{
    BT.sel=tr.dataset.bo; btNowRender();   // ★自分の選択は変えない（上と同じ理由）
    const w=$('#btInputWrap'); if(w) w.open=false;
    const n=$('#btNow'); if(n) n.scrollIntoView({block:'start'});   // smooth は試合中の待ち時間になるので使わない
  });
  btNowRender();
}

/* ================= 実戦（対戦タブ） 1画面 =================
   社長の要望（2026-08-19）：
   「実戦と対戦と対面で3つ見なきゃいけなくてどこを見ればいいか分からない。一つにまとめて欲しい。
     1画面を見れば、今の対面で有利か不利か、何が出されそうでどんな立ち回りをすべきか、
     相手が変わったら相手を切り替えてまた立ち回りを示して、ダメージ食らったら計算して、を
     1画面でやりやすくして。自分のHPは数字、相手のHPは％」
   → 結論は core の PC.callIt() 1本に統一。画面ごとに違うことを言わないようにする。 */

function btNowRender(){
  syncOppItems();
  const host = $('#btNow'); if(!host) return;
  const roster = currentRoster();
  if(!roster.length || !BT.opp.length){ host.innerHTML=''; return; }
  const rc = rosterForCalc(roster, BT.mega);

  // 相手：既定は先頭。自分：既定は「その相手にいちばん強い選出内の駒」
  if(!BT.sel || !BT.opp.includes(BT.sel)) BT.sel = BT.opp[0];
  const o = effOppBT(BT.sel);
  const inPick = r => BT.picks.includes(r.label) || BT.picks.includes(r.name);
  const mine = [...rc].sort((a,b)=> (inPick(b)?1:0)-(inPick(a)?1:0));
  /* ★自分の既定は必ず「選出した3体」から選ぶ（社長の指摘 2026-08-20）。
     以前は BT.me が有効でありさえすれば再選択しなかったため、選出が決まる前に入っていた
     控えの駒がそのまま残り、場にいない駒の判定を見てしまうことがあった。
     手で選んだとき（BT.meManual）は尊重する。相手を変えても勝手に変えない方針は維持。 */
  const cur = mine.find(m=>m.label===BT.me);
  const needDefault = !cur || (!BT.meManual && BT.picks.length && (!inPick(cur) || BT.me!==BT.picks[0]));
  if(needDefault){
    /* 既定は「選出の先頭＝初手に出すべき駒」。選出カードの並びと必ず一致させる。 */
    const lead = mine.find(m=> m.label===BT.picks[0] || m.name===BT.picks[0]);
    BT.me = lead ? lead.label : (mine.filter(inPick)[0]||mine[0]).label;
  }
  const me = mine.find(m=>m.label===BT.me) || mine[0];
  /* ★ここで BT.usedMine に足さないこと（v65）。
     既定の選択は「ツールが推奨した初手」なので、社長が押していないのに
     「出した」と記録され、**推奨で埋める**という直したはずの不具合が形を変えて戻る。
     記録するのは社長が実際にチップを押したときだけ。押していなければ
     試合終了の画面で1タップ確認してもらう。 */
  const maxHP = me.stats ? me.stats.h : 0;
  BT.hp = BT.hp||{}; BT.oppHp = BT.oppHp||{};
  const hp = BT.hp[me.label]!=null ? BT.hp[me.label] : maxHP;
  const oppPct = BT.oppHp[BT.sel]!=null ? BT.oppHp[BT.sel] : 100;
  const seen = (BT.obs && BT.obs[BT.sel]) || [];

  BT.guardGone = BT.guardGone || {};
  const gGone = !!BT.guardGone[me.label];
  const gName = PC.myOneHitGuard({item:me.item, ability:me.ability});
  /* 引き先は必ず「選出した3体」の中から出す。
     控えのポケモンを勧めるのは矛盾（社長の指摘 2026-08-19）。 */
  /* ★落ちた駒は引き先の候補から外す（v67）。
     ここを外していなかったので「引くなら → メガルカリオ」と言われても、
     そのルカリオはもう落ちている、ということが実戦で起きていた。 */
  BT.fainted = BT.fainted || {};
  /* ★落ちた相手も同じように外す（v75）。相手を1体倒した時点で
     「控えから飛んでくる技」も「交代されたらどうする」も変わる。 */
  BT.oppFainted = BT.oppFainted || {};
  const alive = r => !BT.fainted[r.label];
  const oppAlive = n => !BT.oppFainted[n];
  const pickRoster = rc.filter(r=> inPick(r) && alive(r));
  BT.board = BT.board || {};
  const st = BT.board;
  /* ★みずびたし等でタイプが変えられていたら、その形で計算する（v80）。
     引き先の候補（pickRoster）は素のままでよい＝**交代すれば元のタイプに戻る**ため。 */
  const meNow = effMeBT(me);
  const c = me.stats ? PC.callIt(meNow, o, {roster: pickRoster.length?pickRoster:rc,
                                         myHP:hp, oppHPPct:oppPct/100, known:seen, guardGone:gGone, st,
                                         oppTeam: BT.opp.filter(oppAlive)}) : null;
  const rd = c && c.read;

  /* 相手が交代してきた時の答え。試合中いちばん聞かれる択なので、画面と音声の両方に出す。
     いま出ている相手を除いた残りのうち、こちらがいちばん困る1体を選ぶ。 */
  let swIn = null;
  if(c){
    const others = BT.opp.filter(n=> n!==BT.sel && oppAlive(n));
    const cand = others.map(n=>{
      const cc = PC.callIt(meNow, effOppBT(n), {roster: pickRoster.length?pickRoster:rc,
                                           myHP:hp, known:(BT.obs&&BT.obs[n])||[], guardGone:gGone, st});
      return cc ? {name:n, c:cc} : null;
    }).filter(Boolean).sort((a,b)=> a.c.mu.score - b.c.mu.score);
    swIn = cand[0] || null;
  }

  // 試合中はスクロールが命取りになるので、タイプは小さい丸だけにして1行に複数入れる
  /* ★相手が実際に出してきた順を、操作を増やさずに残す（社長の要望 2026-08-20）。
     試合中に相手をタップする＝その相手が場に出た瞬間なので、タップ順がそのまま出現順になる。
     3体そろえば相手の選出が確定し、「試合が終わった」にもそのまま入る。 */
  BT.seenOrder = BT.seenOrder || [];
  const ordOf = n => { const i=BT.seenOrder.indexOf(n); return i<0?'':'①②③'[i]||''; };
  /* ★相手のメガシンカ（v68・社長の要望）。
     「相手がメガシンカするとタイプが変わるので相性も変わる。
       メガになった時のタイプで対面を作り直してほしい」
     例：チリーン(エスパー単) → メガチリーン(エスパー/はがね) で、じめんが等倍→2倍。
     メガできる相手にだけ「メガ」ボタンを出す。押すとその形態で全部の判定が組み直る。
     相手のメガ枠は1体だけなので、別の相手を押したら前のは自動で解除する。 */
  const oppChips = BT.opp.map(n=>{
    const o=ordOf(n);
    const base = PC.toBase(n);
    /* ★MEGA_OF は配列。リザードンのように**メガが2つ**ある相手がいるので、
       1つ決め打ちにしないこと（X と Y でタイプが違う）。 */
    const forms = PC.MEGA_OF[base] || [];
    const on = BT.oppMega && PC.BASE_OF[BT.oppMega]===base;
    /* ★へんげんじざいで変わったタイプは、アイコンと名前の両方で分かるようにする（v76）。
       ここが見えていないと、判定だけ変わって理由が分からない画面になる。 */
    const nowT = (BT.oppType||{})[n] || null;
    const eff  = effOppBT(n);
    const disp = on ? BT.oppMega : n;
    const shortName = f => 'メガ' + (f.replace('メガ'+base, '') || '');
    /* ★倒した相手は打ち消し線＋薄字。右の × で切り替える（自分側と同じ操作にしてある）。
       落ちた相手にメガのボタンを出しても押す場面が無いので、そこは隠す。 */
    const dead = !!BT.oppFainted[n];
    return `<span class="pk mini" style="${dead?'opacity:.45':''}">`
      + `<button class="qb mini ${n===BT.sel?'on':'off'}" data-btopp="${esc(n)}"
           style="${dead?'text-decoration:line-through':''}">${o?`<b>${o}</b>`:''}${typeDots(eff)}${esc(disp)}${
             nowT?`<b style="color:var(--org)">〈${esc(nowT)}〉</b>`:''}</button>`
      + (dead ? '' : forms.map(f=>`<button class="qb mini" data-btoppmega="${esc(f)}" title="${esc(f)}にした／戻す"
               style="padding:1px 6px;font-size:11px;margin-left:2px;${
                 BT.oppMega===f?'color:var(--red);font-weight:700':'color:var(--muted)'}">${
                 BT.oppMega===f?esc(shortName(f))+'中':esc(shortName(f))}</button>`).join(''))
      + `<button class="qb mini" data-btoppdead="${esc(n)}" title="倒した／戻す"
           style="padding:1px 6px;font-size:11px;margin-left:2px;${dead?'color:var(--red);font-weight:700':'color:var(--muted)'}">${dead?'倒':'×'}</button>`
      + `</span>`;
  }).join('');
  /* ★落ちた駒は打ち消し線＋薄字。右の × で切り替える（もう一度押すと戻る）。
     試合中のタップを増やさないよう、駒を選ぶ操作（本体）とは別の当たり判定にしてある。 */
  const myChips  = mine.map(m=>{
    const dead = !!BT.fainted[m.label];
    /* ★タイプを変えられている駒は、変えられた側のアイコンと〈みず〉を出す（v80）。
       ここが見えていないと「なぜ削れないのか」が画面から分からない。 */
    const tNow = (BT.myType||{})[m.label] || null;
    return `<span class="pk mini" style="${dead?'opacity:.45':''}">`
      + `<button class="qb mini ${m.label===BT.me?'on':'off'}" data-btme="${esc(m.label)}"
           style="${dead?'text-decoration:line-through':''}">${typeDots(effMeBT(m).name)}${esc(m.disp||m.label)}${
             tNow?`<b style="color:var(--org)">〈${esc(tNow)}〉</b>`:''}${
             m.demoted?'<span class="muted"> メガ無</span>':''}${inPick(m)?'':'<span class="muted"> 控</span>'}</button>`
      + `<button class="qb mini" data-btdead="${esc(m.label)}" title="落ちた／戻す"
           style="padding:1px 6px;font-size:11px;margin-left:2px;${dead?'color:var(--red);font-weight:700':'color:var(--muted)'}">${dead?'落':'×'}</button>`
      + `</span>`;
  }).join('');

  // 逆算の結果（自分が食らったダメージ）
  const src = rd ? (rd.candidates.length ? rd.candidates : rd.others) : [];
  const readBlock = (!rd || rd.notHitYet) ? '' : `
    <div class="small" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)">
      食らったダメージ <b>${rd.taken}</b>（HP${rd.maxHP}中）
      ${src.length ? `→ 撃たれたのは <b>${src.map(x=>esc(x.name)+(x.rate!=null?`<span class="muted">(${x.rate}%)</span>`:'')).join(' か ')}</b>`
                   : '→ <span class="muted">該当なし。急所・2回被弾・天候・ランク変化の可能性</span>'}
      ${rd.fromFullList&&src.length?'<br><span class="muted">※採用率10%未満の技。全技から推定した参考値です</span>':''}
      ${rd.candidates.length&&rd.ruledOut.moves.length?`<br><span class="muted">この一撃では無かった技：${rd.ruledOut.moves.map(esc).join('・')}</span>`:''}
      ${(rd.left && rd.left.worstMove) ? `<br>いちばん痛い <b>${esc(rd.left.worstMove)}</b>(${Math.round(rd.left.worstPct*100)}%) で
        ${rd.left.diesNext?'<b style="color:var(--red)">次の一撃で落ちる</b>':`<b>あと${rd.left.worst}発</b>`}` : ''}
    </div>`;

  host.innerHTML = `
  <div class="card" style="${c?`border-left:4px solid var(--${c.cls==='ok'?'win':c.cls==='ng'?'red':'warn'})`:''}">
    <h2>いまの対面<span class="sub">相手/自分をタップで切替</span></h2>
    <div class="small muted">相手</div>
    <div class="quick" style="margin-top:4px">${oppChips}</div>
    ${(()=>{ /* ★相手の持ち物を確定させる（v79・社長の要望）。
         「いのちのたまとかせんせいのツメを持ってると計算が狂う。毎回じゃないけど登録できたらいい」
         ふだんは畳んでおく。押した時だけ開く（試合中のタップを増やさないため）。
         候補は**採用率の高い順**＋「データに載りにくいが実戦で効くもの」を足してある。 */
      const raw = PC.oppItemsRaw(BT.sel).filter(x=>x.rate>=3).sort((a,b)=>b.rate-a.rate).slice(0,8);
      const EXTRA = ['いのちのたま','こだわりスカーフ','こだわりハチマキ','こだわりメガネ',
                     'きあいのタスキ','とつげきチョッキ','たべのこし','ラムのみ','オボンのみ','せんせいのツメ'];
      const seen = new Set(raw.map(x=>x.name));
      const extra = EXTRA.filter(n=>!seen.has(n));
      const now = (BT.oppItem||{})[BT.sel] || null;
      const ti = PC.teamItemsOf(PC.toBase(BT.sel)) || [];
      const chip = (n, rate) => `<button class="qb mini ${now===n?'on':'off'}" data-btoppitem="${esc(n)}">${
        esc(n)}${rate!=null?`<span class="muted"> ${rate}%</span>`:''}</button>`;
      return `<details ${now?'open':''} style="margin-top:4px"><summary class="small ${now?'':'muted'}" style="cursor:pointer">
          持ち物${now?`：<b style="color:var(--org)">${esc(now)}</b>（確定として計算中）`
                    :'<span class="muted">（見えたら押す。推測より優先します）</span>'}</summary>
        <div class="quick" style="margin-top:5px">
          ${chip('なし')}${raw.map(x=>chip(x.name, x.rate)).join('')}
          ${extra.length?`<span class="small muted" style="width:100%;margin-top:3px">データに載っていないもの</span>`:''}
          ${extra.map(n=>chip(n)).join('')}
        </div>
        ${ti.length?`<div class="small muted" style="margin-top:5px">上位構築での持ち物：${
          ti.map(x=>`${esc(x.name)} ${x.rate}%`).join('・')}</div>`:''}
      </details>`; })()}
    <div class="hpwrap">
      <span class="small muted">相手の残りHP</span>
      <div class="seg" id="btOppHp">
        ${[100,90,75,60,50,40,25,10].map(v=>`<button class="${oppPct===v?'on':''}" data-btop="${v}">${v}</button>`).join('')}
      </div>
      <button class="btn ghost sm" data-btopd="-5">−5</button>
      <button class="btn ghost sm" data-btopd="5">＋5</button>
    </div>

    <div class="small muted" style="margin-top:12px">自分</div>
    <div class="quick" style="margin-top:4px">${myChips}</div>
    <div class="hpwrap">
      <span class="small muted">自分の残りHP</span>
      <input id="btHp" class="hpnum" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4"
             autocomplete="off" value="${hp}">
      <span class="muted">/ ${maxHP}</span>
      <button class="btn ghost sm" data-bthp="full">満タン</button>
    </div>
    ${gName?`<div class="hpwrap">
      <span class="small muted">${esc(gName)}</span>
      <div class="seg"><button class="${gGone?'':'on'}" data-btguard="0">まだ残っている</button><button class="${gGone?'on':''}" data-btguard="1">もう無い</button></div>
    </div>`:''}

    ${c?`<div class="note ${c.cls==='ok'?'g':c.cls==='ng'?'r':'w'}" style="margin-top:12px">
      <div class="nowhead">${c.mark} ${esc(c.head)}</div>
      <div class="small" style="margin-top:2px">${esc(c.why)}</div>
      ${c.to
        ? safeHtml('引く判断', ()=> btSwitchCard(pickRoster, me, o, st, c))
        : (()=>{ /* ★引き先が無いことを黙っていない（v67）。
             落ちた駒を除外した結果、引く先が消えることがある。
             「引く」と言われて引けないのがいちばん困る。 */
            const left = pickRoster.filter(r=> r.label!==me.label);
            if(!left.length) return `<div class="small" style="margin-top:6px;color:var(--red)">
              <b>引く先がありません。</b>${esc(me.disp||me.label)}で押し切るしかありません</div>`;
            return `<div class="small" style="margin-top:6px;color:var(--org)">
              <b>有利に引ける駒がありません。</b>残っているのは
              ${left.map(r=>esc(r.disp||r.label)).join('・')}。どれも不利なので、
              引くなら<b>削られるのを承知</b>で選ぶことになります</div>`;
          })()}
      ${(()=>{ /* ★タイプを変えられているときは、「引いて出し直す」が最善手になることが多い（v80）。
           社長の指摘そのもの：「カバルドンから引いて、またカバルドンを出すことで電気技が無効に戻る」。
           ★ただし**引き先が本当に受けられるか**まで出す。ハラバリー相手にギャラドスへ引くと
             パラボラチャージ125%で引いた瞬間に落ちる＝「引き先にならない引き先」を潰す。 */
        const tNow = (BT.myType||{})[me.label]; if(!tNow) return '';
        const cand = pickRoster.filter(r=> r.label!==me.label).map(r=>{
          let cc=null; try{ cc = PC.callIt(r, o, {roster:null, st}); }catch(e){}
          if(!cc) return null;
          const w = (cc.mu.oppRows||[]).slice().sort((a,b)=> b.rateHi-a.rateHi)[0];
          const d = w ? Math.round(w.rateHi*r.stats.h) : 0;
          /* ★8割食らう引き先は「引き先ではない」。ステロや削れを考えると確実に落ちる。
             ギャラドスがハラバリーのでんき技で196/202＝97%、といった形をここで弾く。 */
          return {n:r.disp||r.label, d, hp:r.stats.h, ko: d >= r.stats.h*0.8, move:w?w.move:''};
        }).filter(Boolean).sort((a,b)=> (a.d/a.hp)-(b.d/b.hp));
        const safe = cand.filter(x=>!x.ko);
        return `<div class="small" style="margin-top:6px;padding:7px 9px;border:1px dashed var(--org);border-radius:8px">
          <b style="color:var(--org)">${esc(me.disp||me.label)}は ${esc(tNow)} タイプにされています。</b>
          <b>一度引いて出し直せば元に戻ります</b>
          <span class="muted">（タイプ一致や無効が復活します）</span>
          <div style="margin-top:4px">${
            safe.length
              ? `引き先：${safe.map(x=>`<b>${esc(x.n)}</b> <span class="muted">${esc(x.move)}で${x.d}/${x.hp}</span>`).join('　')}`
              : '<b style="color:var(--red)">引き先がありません。</b>この形のまま押し切るしかありません'}
            ${cand.filter(x=>x.ko).length?`<br><span style="color:var(--red)">引いてはいけない：${
              cand.filter(x=>x.ko).map(x=>`<b>${esc(x.n)}</b>（${esc(x.move)}で${x.d}/${x.hp}＝${
                Math.round(x.d/x.hp*100)}%）`).join('・')}</span>`:''}
          </div></div>`;
      })()}
      ${Object.keys(BT.fainted||{}).length
        ? `<div class="small muted" style="margin-top:4px">落ちた駒：${
            Object.keys(BT.fainted).map(esc).join('・')}<span class="muted">（引き先の候補から外しています）</span></div>`
        : ''}
      ${(()=>{ /* ★倒した相手（v75）。3体そろって見えているなら「相手の残り何体」まで出す。
           試合の詰め方が変わるところなので、除外していることを黙っていない。 */
        const down = Object.keys(BT.oppFainted).filter(n=> BT.opp.includes(n));
        if(!down.length) return '';
        const three = BT.seenOrder.length===3 ? BT.seenOrder : null;
        const rest = three ? `・相手の選出3体のうち<b>残り${three.filter(oppAlive).length}体</b>` : '';
        return `<div class="small muted" style="margin-top:4px">倒した相手：${
          down.map(esc).join('・')}<span class="muted">（控えの脅威と交代先の読みから外しています${rest}）</span></div>`;
      })()}
      ${swIn?`<div class="small" style="margin-top:6px">${esc(swIn.name)}に交代されたら → <b>${swIn.c.mark} ${esc(swIn.c.head)}</b>${swIn.c.to?`（${esc(swIn.c.to.name)}へ）`:''}</div>`:''}
    </div>
    ${(c.moves&&c.moves.rows&&c.moves.rows.length)?`<div class="card" style="margin-top:8px;padding:11px 13px;border-left:3px solid var(--fg)">
      ${(()=>{ /* ★この相手に、これまで何を撃って何%削ったか（v62）。
           社長の要望「相手が交代して、また出てきたときに、すでにこの相手にはこれを何回撃っているかが分かるように」。
           実測が入っていれば、計算より実測を優先して「あと何発」を出す。 */
        const log = (BT.dealt && BT.dealt[BT.sel]) || [];
        if(!log.length) return '';
        const byMove = {};
        log.forEach(x=>{ const k=x.move||'（技を選ばずに更新）';
          byMove[k]=byMove[k]||{n:0,sum:0}; byMove[k].n++; byMove[k].sum+=x.pct; });
        const rows = Object.entries(byMove).map(([m,v])=>
          `${esc(m)} ${v.n}回で <b>${v.sum}%</b>${v.n>1?`<span class="muted">（1発あたり約${Math.round(v.sum/v.n)}%）</span>`:''}`);
        /* 実測の1発あたりから「あと何発」を出す。計算値とズレていたらそれも出す。 */
        const best = Object.entries(byMove).filter(([m,v])=>m!=='（技を選ばずに更新）'&&v.sum>0)
          .map(([m,v])=>({m, per:v.sum/v.n})).sort((a,b)=>b.per-a.per)[0];
        let left = '';
        if(best){
          const need = Math.ceil(oppPct / best.per);
          const calc = (c.moves.rows||[]).find(r=>r.name===best.m);
          const calcNeed = calc && calc.hi>0 ? Math.ceil((oppPct/100)/calc.hi) : null;
          left = `<div class="small" style="margin-top:4px">実測だと <b>${esc(best.m)}</b> であと <b>${need}発</b>`
               + `<span class="muted">（残り${oppPct}%・1発 約${Math.round(best.per)}%）</span>`
               + (calcNeed!=null && calcNeed!==need
                   ? `<span style="color:var(--org)"> ／ 計算では${calcNeed}発。<b>実測を優先してください</b></span>` : '')
               + `</div>`;
        }
        return `<div class="card" style="margin-top:8px;padding:11px 13px;border-left:3px solid var(--blue)">
          <div class="small" style="font-weight:800;margin-bottom:4px">この相手に与えたダメージ</div>
          <div class="small">${rows.join('<br>')}</div>${left}</div>`;
      })()}
      <div class="small" style="font-weight:800">撃つ技${c.moves.best?` … <b>${esc(c.moves.best.name)}</b>`:''}</div>
      ${(()=>{ const s=c.moves.speed; if(!s) return '';
        /* ★どの型に先を取れるかを必ず数字で出す。
           「型次第」と書くだけでは、どっちに賭けるか決められない（鉄則⑥）。 */
        const win=s.rows.filter(r=>r.faster), lose=s.rows.filter(r=>!r.faster);
        return `<div class="small muted" style="margin-bottom:5px">
          こちら <b>S${s.myS}</b> ／ 相手 ${s.rows.map(r=>`${esc(r.label)} <b>${r.s}</b>`).join('・')}
          ${s.allSlower ? '<br><b style="color:var(--grn)">どの型より速い。先制技を使わなくても先に動けます</b>'
           : s.allFaster ? '<br><b style="color:var(--red)">どの型にも抜かれます。先制技以外は後攻になります</b>'
           : `<br><b style="color:var(--org)">${lose.map(r=>esc(r.label)).join('・')} には抜かれます</b>`
             + (s.scarfRate>=15?`<span class="muted">（こだわりスカーフ採用${s.scarfRate}%）</span>`:'')}
          ${s.weatherBoost?`<br><b style="color:var(--red)">天候で${esc(s.weatherBoost.name)}が発動して2倍速です</b>`:''}
          ${s.quickClaw?`<br><b style="color:var(--red)">せんせいのツメ。5回に1回は、素早さに関係なく先に動かれます</b>`:''}
        </div>`;
      })()}
      ${c.moves.why?`<div class="small muted" style="margin-bottom:6px">${c.moves.why}</div>`:''}
      ${c.moves.rows.map(r=>{
        const on = c.moves.best && r.name===c.moves.best.name;
        const pri = r.pri>0 ? `<span class="badge g">先制+${r.pri}</span> ` : (r.pri<0? `<span class="badge w">後攻</span> `:'');
        /* ★この技で先に動けるか（v72・社長の要望）。
           「先制技を使わなくても、実はこの技で先に通っていた」を潰すための表示。 */
        const fst = r.status ? '' :
          r.first==='always' ? `<span class="badge g">先に動ける</span> `
        : r.first==='never'  ? `<span class="badge ng">後に動く</span> `
        : `<span class="badge wn">型次第</span> `;
        let body;
        if(r.immune) body = '<span class="muted">無効</span>';
        else if(r.status) body = `<span class="muted">変化技${r.note?' — '+esc(r.note):''}</span>`;
        else body = `<b>${Math.round(r.lo*100)}〜${Math.round(r.hi*100)}%</b>`
          + `<span class="muted"> ${r.hits}発${r.acc<100?`・命中${r.acc}%`:''}${r.eff>1?'・こうかばつぐん':r.eff<1?'・いまひとつ':''}</span>`
          + (r.through&&r.through.length?`<span class="muted"> ／交代先 ${r.through.length}体に通る</span>`
                                        :`<span class="muted" style="color:var(--org)"> ／交代先に通らない</span>`);
        /* ★「撃った」を1タップで残せるようにする（v62・社長の要望）。
           押しても画面は変わらない。次に相手の残りHPを押した瞬間に、その技のダメージとして記録される。 */
        const shot = (!r.status && !r.immune)
          ? ` <button class="qb mini" data-btshot="${esc(r.name)}" style="padding:1px 7px;font-size:11px">撃った</button>` : '';
        return `<div class="small" style="margin:3px 0;${on?'font-weight:700':''}">${on?'▶ ':'・'}${fst}${pri}${esc(r.name)} … ${body}${shot}</div>`;
      }).join('')}
    </div>`:''}
    ${safeHtml('通るタイプ', ()=> btTypeThroughCard(o, me))}
    ${(c.todo&&c.todo.length)?`<div class="card" style="margin-top:8px;padding:11px 13px;border-left:3px solid var(--blue)">
      <div class="small" style="font-weight:800;margin-bottom:4px">引く前にやること</div>
      ${c.todo.map(d=>`<div class="small" style="margin:3px 0">・${d.t}</div>`).join('')}
    </div>`:''}
    <div class="small" style="margin-top:10px">
      ${c.detail.map(d=>`<div style="margin:3px 0;color:${d.k==='bad'?'var(--red)':d.k==='good'?'var(--grn)':d.k==='warn'?'var(--org)':d.k==='role'?'var(--blue)':'inherit'}">・${d.t}</div>`).join('')}
    </div>`:''}
    ${safeHtml('タイプ診断', ()=> btTypeCard(rc))}
    ${btBoardCard(st)}
    ${readBlock}
  </div>
  ${btSeenCard(BT.sel, seen)}`;

  /* ★左カラム（#btDanger）へ流し込む（v70）。ここで入れる理由は、
     「いま出している駒(me)」が確定するのが btNowRender だから。
     btRender 側で同じ判定をもう一度書くと、必ず食い違う（鉄則⑤）。 */
  { const dh = $('#btDanger');
    if(dh) dh.innerHTML = safeHtml('危ないタイプ', ()=> btDangerCard(rc, me, c)); }

  /* 音声。★指のタップから始めないと iOS は鳴らさないので、必ずボタン経由にする。 */
  const vb = $('#btSpeakBtn');   // ★#btVoice は既存の音声メモ欄。IDを衝突させないこと
  if(vb) vb.onclick = async ()=>{
    const on = await VOICE.toggle();
    VOICE.reset();
    btNowRender();
    if(on) btSpeak();
  };
  /* 結論が変わった時だけ喋る。画面は頻繁に再描画されるので、同じ内容は繰り返さない。 */
  function btSpeak(){
    if(!window.VOICE || !VOICE.isOn() || !c) return;
    const lines = voiceLines(c, swIn ? {switchIn:{name:swIn.name, head:swIn.c.head}} : {});
    VOICE.sayIfChanged([BT.me,BT.sel,c.head,c.to&&c.to.name,hp,oppPct].join('|'), lines);
  }
  btSpeak();

  $$('#btNow [data-btoppmega]').forEach(b=> b.onclick=()=>{
    const m = b.dataset.btoppmega;               // ボタンにメガ形態名そのものを持たせてある
    if(!PC.SPECIES[m]) return;
    const base = PC.BASE_OF[m] || m;
    /* 相手のメガ枠は1体だけ。押し直しで解除、別の形態を押したら乗り換える */
    BT.oppMega = (BT.oppMega === m) ? null : m;
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
    toast(BT.oppMega
      ? `${BT.oppMega} として計算し直しました（${PC.SPECIES[m].types.join('/')}）`
      : `${base} に戻しました`);
  });
  $$('#btNow [data-btopp]').forEach(b=> b.onclick=()=>{
    /* ★相手を変えても自分の選択は変えない（社長の指摘 2026-08-20）。
       以前は BT.me=null にして「その相手にいちばん強い駒」を勝手に選び直していた。
       画面には「殴る」と出ているのに、出ているのは場にいない別の駒、という事故が起きて
       実際に負けている。自動選択は最初の1回だけ（BT.me が未設定のとき）に限る。 */
    /* ★相手をタップする＝その相手が場に出た瞬間。
       いま出ていた相手の積み・状態異常をしまい、出てきた相手のぶんを載せ替える（社長の指摘）。 */
    if(BT.sel !== b.dataset.btopp){ stashOppBoard(BT.sel); }
    const prevSel = BT.sel;
    BT.sel=b.dataset.btopp;
    if(prevSel !== BT.sel){ loadOppBoard(BT.sel); PC.clearMatchupCache(); }
    // 出てきた順に記録する。3体で打ち切り（相手の選出は3体）
    if(!BT.seenOrder.includes(BT.sel) && BT.seenOrder.length<3) BT.seenOrder.push(BT.sel);
    const pb=$('.planbox'); if(pb) pb.open=false;          // 試合が始まったら選出カードは畳む
    const iw=$('#btInputWrap'); if(iw) iw.open=false;
    /* 盤面（積み・状態異常）が載せ替わっているので、対面だけでなく計算からやり直す */
    if(prevSel !== BT.sel){ btCompute(); btRender(); saveBtDraft(); }
    else btNowRender();
  });
  /* ★相手を倒したときの処理（v75・社長の要望）。
     自分側（data-btdead）と対になる操作。倒した相手は
     控えの脅威・交代先の読み・設置技の価値・おはかまいりの計算から外す。 */
  /* ★持ち物を確定させる／解除する（v79）。押し直しで推測に戻る。 */
  $$('#btNow [data-btoppitem]').forEach(b=> b.onclick=()=>{
    const it = b.dataset.btoppitem;
    BT.oppItem = BT.oppItem || {};
    if(BT.oppItem[BT.sel] === it) delete BT.oppItem[BT.sel]; else BT.oppItem[BT.sel] = it;
    syncOppItems();
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
    toast(BT.oppItem[BT.sel]
      ? `${BT.sel} の持ち物を「${it}」として計算し直しました`
      : `${BT.sel} の持ち物を推測に戻しました`);
  });
  $$('#btNow [data-btoppdead]').forEach(b=> b.onclick=()=>{
    const n = b.dataset.btoppdead;
    BT.oppFainted = BT.oppFainted || {};
    const now = !BT.oppFainted[n];
    if(now) BT.oppFainted[n] = true; else delete BT.oppFainted[n];
    BT.board = BT.board || {}; BT.oppBoard = BT.oppBoard || {};
    if(now){
      /* ★積みも状態異常も、そのポケモンが落ちた時点で消える。
         ★2026-08-21 修正：v75 は applyOppStacks() で引いていたため、
           **控えの相手を「倒した」にすると、いま出ている相手の盤面からランクが引かれていた。**
           盤面は相手ごとに分けたので、その相手のぶんを捨てるだけでよくなった。 */
      delete BT.oppBoard[n];
      if(n === BT.sel) OPP_BOARD_KEYS.forEach(k=> delete BT.board[k]);
      /* メガシンカしていた相手が落ちたら、その形態指定も外す */
      if(BT.oppMega && PC.BASE_OF[BT.oppMega]===PC.toBase(n)) BT.oppMega = null;
      /* へんげんじざいで変わっていたタイプも、落ちれば関係なくなる */
      if(BT.oppType) delete BT.oppType[n];
    }else if(n === BT.sel){
      loadOppBoard(n);                    // 戻したら、積みの記録から盤面を作り直す
    }
    /* 盤面の「相手が落ちた数」と必ず一致させる（自分側と同じ。別々に持つと必ず食い違う） */
    const n2 = Object.keys(BT.oppFainted).filter(x=> BT.opp.includes(x)).length;
    if(n2) BT.board.opFallen = Math.min(5, n2); else delete BT.board.opFallen;
    /* いま対面に選んでいる相手を倒したなら、生きている相手に移す。
       出てきた順（seenOrder）が分かっていればそちらを優先する */
    if(BT.oppFainted[BT.sel]){
      const live = x => BT.opp.includes(x) && !BT.oppFainted[x];
      const next = (BT.seenOrder||[]).find(live) || BT.opp.find(live);
      if(next) BT.sel = next;
    }
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
    toast(BT.oppFainted[n]
      ? `${n} を「倒した」にしました（控えの脅威と交代先から外します）`
      : `${n} を戻しました`);
  });
  $$('#btNow [data-btdead]').forEach(b=> b.onclick=()=>{
    const n = b.dataset.btdead;
    BT.fainted = BT.fainted || {};
    if(BT.fainted[n]) delete BT.fainted[n]; else BT.fainted[n] = true;
    /* 盤面の「自分が落ちた数」と必ず一致させる。別々に持つと必ず食い違う */
    BT.board = BT.board || {};
    const n2 = Object.keys(BT.fainted).length;
    if(n2) BT.board.myFallen = n2; else delete BT.board.myFallen;
    /* いま選んでいる駒が落ちたなら、生きている駒に移す */
    if(BT.fainted[BT.me]){
      const next = (BT.picks||[]).find(x=> !BT.fainted[x]);
      if(next) BT.me = next;
    }
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
    toast(BT.fainted[n] ? `${n} を「落ちた」にしました（引き先から外します）` : `${n} を戻しました`);
  });
  $$('#btNow [data-btme]').forEach(b=> b.onclick=()=>{
    /* ★交代したら、みずびたし等で変えられたタイプは元に戻る（v80・社長の指摘）。
       「引き先が残っているかどうかで価値が変わる」＝ここがチーム戦の本体なので、
       画面でもちゃんと戻して、戻ったことを伝える。 */
    const prev = BT.me;
    if(prev && prev!==b.dataset.btme && BT.myType && BT.myType[prev]){
      const was = BT.myType[prev];
      delete BT.myType[prev];
      PC.clearMatchupCache();
      toast(`${prev} を引いたので、${was}タイプが元に戻りました`);
    }
    BT.me=b.dataset.btme; BT.meManual=true;
    /* ★出した順に記録する。試合終了時の「実際に出した3体」の初期値になる（v65）。
       追加のタップは要らない。社長はどのみちこのチップを押している。 */
    BT.usedMine = BT.usedMine || [];
    if(!BT.usedMine.includes(BT.me)) BT.usedMine.push(BT.me);
    saveBtDraft(); btNowRender();
  });
  /* ★相手の残りHPを更新したら、その差分を「直前に撃った技」に紐づけて残す（v62）。
     社長の要望「何を撃ったことでどのくらい減ったかを残したい」。
     技を指定していなければ、割合の変化だけ記録する（技名なし）。 */
  const setOppHp = v=>{
    const before = BT.oppHp[BT.sel]!=null ? BT.oppHp[BT.sel] : 100;
    const after  = Math.max(0, Math.min(100, v));
    if(after < before){
      BT.dealt[BT.sel] = BT.dealt[BT.sel] || [];
      BT.dealt[BT.sel].push({move: BT.pending || null, pct: before-after});
    }
    BT.pending = null;
    BT.oppHp[BT.sel] = after;
    btNowRender(); saveBtDraft();
  };
  $$('#btNow [data-btop]').forEach(b=> b.onclick=()=> setOppHp(+b.dataset.btop));
  $$('#btNow [data-btopd]').forEach(b=> b.onclick=()=>
    setOppHp((BT.oppHp[BT.sel]!=null?BT.oppHp[BT.sel]:100) + (+b.dataset.btopd)));
  /* 「この技を撃った」。押しても画面は変えない（試合中の視線を動かさない）。
     次にHPを更新した瞬間に、その技のダメージとして残る。 */
  $$('#btNow [data-btshot]').forEach(b=> b.onclick=()=>{
    BT.pending = b.dataset.btshot;
    toast(`${BT.pending} を撃った → 相手の残りHPを押してください`);
  });
  $$('#btNow [data-bthp]').forEach(b=> b.onclick=()=>{ BT.hp[BT.me]=maxHP; btNowRender(); saveBtDraft(); });
  $$('#btNow [data-btguard]').forEach(b=> b.onclick=()=>{
    BT.guardGone[BT.me] = b.dataset.btguard==='1'; PC.clearMatchupCache(); btNowRender(); saveBtDraft(); });
  /* ★2026-08-21 修正（社長の指摘）：「162 と打つと 261 のように**逆から並ぶ**」
     原因は2つ重なっていた。
       ① `<input type="number">` は Chrome では **selectionStart が null**、
          `setSelectionRange()` は例外を投げる（type=number は選択をサポートしない）。
          → カーソル位置が毎回 null＝**先頭に戻る**ので、打つほど先頭に積まれて逆順になっていた。
       ② 1文字打つたびに btNowRender() でカード全体を作り直しており、
          入力欄そのものが別の要素に差し替わっていた。
     直し方：type="text" + inputmode="numeric" にして選択APIを使えるようにし、
     再描画のあとに **打った文字列とカーソル位置をそのまま戻す**。
     打っている途中の値は丸めない（"16" を "16" のまま残す）。欄を離れたときに整える。 */
  const inp=$('#btHp');
  if(inp){
    const caret = el =>{ try{ return el.selectionStart; }catch(e){ return null; } };
    inp.oninput=()=>{
      const raw = inp.value.replace(/[^0-9]/g,'');     // 全角や記号は無視する
      const pos = caret(inp);
      BT.hp[BT.me] = Math.max(0, Math.min(maxHP, parseInt(raw,10) || 0));
      btNowRender();
      const i2=$('#btHp');
      if(i2){
        i2.value = raw;                                // 途中の入力をそのまま残す
        i2.focus();
        if(pos!=null){ try{ i2.setSelectionRange(pos,pos); }catch(e){} }
      }
      saveBtDraft();
    };
    /* 欄を離れたら、実際に使っている値（0〜最大HP）に揃える。
       「999」と打ちっぱなしで残すと、画面の数字と計算が食い違って見える。 */
    inp.onblur=()=>{ const v = BT.hp[BT.me]!=null ? BT.hp[BT.me] : maxHP;
      if(inp.value !== String(v)) inp.value = v; };
  }
  btBindSeen(); btBindBoard();
}

/* ---------- 盤面の状態 ----------
   積み技・天候・状態異常・壁・設置技。計算エンジンは前から対応していたのに、
   画面から渡していなかったので数字が嘘になっていた（2026-08-19 の棚卸しで判明）。
   例：相手がつるぎのまいを1回積むだけで被ダメージは 46〜73% → 93〜143% に変わる。
   試合中にタップ数を増やさないよう、既定は閉じておき、使う時だけ開く。 */
const BOARD_RANKS = [-2,-1,0,1,2,3,4,5,6];
/* ★タイプ診断（2026-08-21・v69・社長の要望）。
   「カバルドンだったら電気は食らわないけど、氷とかだとやばい。草でもやばい。水でもやばいのかな？」
   「キラフロルは岩と毒だと思うけど、**相手が何を撃ってきたらきついのかがまだ理解できてない**」
   ＝ ポケモン同士の相性ではなく、**タイプ単位で「何を食らうとまずいか」**を知りたい、という要望。

   出し方は2段構え：
     ①タイプを選ばなくても、**いま場に出している自分の駒の弱点**を最初から出す（タップ0）
     ②タイプを押すと、自分6匹と相手6体の倍率が一覧で出る（社長が言った「地面を押す」形）
   「受けたら／殴ったら」の切り替えが、社長の言う「に弱い／に強い」にあたる。 */
/* ★「この駒に何が飛んでくるか」を、**危ない順**に出す（2026-08-21・v71）。
   社長の指摘（v70を見て）：
     「メガルカリオ vs ガブリアスで、**ほのお2倍（ほのおのキバ11%）が上**に出て、
       **じめん2倍（じしん99.3%）が下**に出る。これだと『炎は11%だから大丈夫』と思ってしまう。
       **普通にじしんを覚えているでしょう。** 倍率だけでなく**採用率をかけて**並べてほしい」
   ＝ タイプの倍率で並べるのが間違いだった。**実際に食らうダメージ × その技を持っている確率**で並べる。

   さらに2つ：
     ・「対面している相手単体」と「**相手のパーティの中に持っているやつがいるか**」を分けて見たい
       （交代で出てくる可能性があるので、交代されてもいいように技を選べる）
     ・「**こちらの技が相手の特性で効かない可能性**」も採用率つきで見たい（ふゆう・もらいび・ちょすい等）

   ★倍率ではなく `callIt()` が返す**実ダメージ%**を使う。
     倍率は同じでも、相手の攻撃実数値・持ち物・タイプ一致で実際の痛さは全く違う。 */
function btDangerCard(rc, me, c){
  if(!me || !BT.opp.length) return '';
  BT.oppFainted = BT.oppFainted || {};
  const cur = effOppBT(BT.sel);
  const seen = (BT.obs && BT.obs[BT.sel]) || [];

  /* ① いま対面している相手の技を「最大ダメージ × 採用率」で並べる */
  /* ★4発以上耐える技は出さない（v72）。「13発は耐える」は読む価値が無く、
     本当に危ない行を埋もれさせる。社長の指摘「視認性がちょっと難しい」への対応。
     ただし1件も残らないなら、いちばん痛い技だけは出す（無言で空にしない）。 */
  const all = ((c && c.mu && c.mu.oppRows) || [])
    .filter(r=> r.rateHi > 0)
    .map(r=>({...r, risk: r.rateHi * ((r.rateOf==null?100:r.rateOf)/100)}))
    .sort((a,b)=> b.risk-a.risk);
  const rows = (all.filter(r=> r.rateHi >= 0.25).slice(0,4).length
                 ? all.filter(r=> r.rateHi >= 0.25).slice(0,4)
                 : all.slice(0,1));

  /* ★%だけだと判断できない（社長）。
     「30%じゃなくて60ぐらい削られる、何回なら耐えられる、が分かると
       交代しなくていいか／絶対交代しないとまずいかが判断できる」
     → **実数ダメージ**と**あと何発耐えるか**を主役にして、%は添えるだけにする。 */
  const maxHP = me.stats ? me.stats.h : 0;
  const hpNow = (BT.hp && BT.hp[me.label]!=null) ? BT.hp[me.label] : maxHP;
  const line = r => {
    const conf = seen.includes(r.move);
    const dLo = Math.round(r.rate*maxHP), dHi = Math.round(r.rateHi*maxHP);
    const ko = dHi >= hpNow;
    const survive = dHi>0 ? Math.max(0, Math.ceil(hpNow/dHi)) : 99;   // 最悪ケースで何発耐えるか
    const mt = (PC.MOVES[r.move]||{}).type || r.type;
    return `<div class="small" style="margin:4px 0;display:flex;align-items:center;gap:2px;flex-wrap:wrap">`
      + typeBadge(mt)
      + `<b style="${ko?'color:var(--red)':''}">${esc(r.move)}</b> `
      + `<b style="${ko?'color:var(--red)':''}">${dLo}〜${dHi}</b>`
      + `<span class="muted"> 削られる（残り${hpNow}）</span>`
      + (ko ? '<b style="color:var(--red)"> → 一撃で落ちる</b>'
            : `<b> → ${survive}発は耐える</b>`)
      + (conf ? '<span style="color:var(--red);font-weight:700"> 確定</span>'
              : `<span class="muted"> ・採用${r.rateOf==null?'—':Math.round(r.rateOf)}%</span>`)
      + `<span class="muted"> ・${Math.round(r.rate*100)}〜${Math.round(r.rateHi*100)}%</span>`
      + `</div>`;
  };

  /* ② 控えの相手が、同じ技を持っていないか（交代で出てくる） */
  const others = BT.opp.filter(n=> n!==BT.sel && !BT.oppFainted[n]);
  const myTypes = (PC.SPECIES[me.name]||{types:[]}).types;
  const immAb = PC.immuneType(me.ability||'');
  const benchRisk = [];
  others.forEach(n=>{
    const e = effOppBT(n);
    (PC.oppMoves(e)||[]).forEach(m=>{
      if(!m.power) return;
      const eff = (m.type===immAb) ? 0 : PC.effectiveness(m.type, myTypes);
      if(eff < 2) return;                       // 2倍以上だけ。等倍まで出すと読めない
      benchRisk.push({opp:e, move:m.name, rate:m.rate, eff, type:m.type});
    });
  });
  benchRisk.sort((a,b)=> (b.eff*b.rate)-(a.eff*a.rate));

  /* ③ こちらの技が、相手の特性で無効化される可能性 */
  const blocked = [];
  (me.moves||[]).forEach(mv=>{
    const M = PC.MOVES[mv]; if(!M || !M.power || M.cat==='変') return;
    const who = PC.whoBlocks(M.type, BT.opp.filter(n=>!BT.oppFainted[n]).map(effOppBT));
    if(who.length) blocked.push({move:mv, type:M.type, who});
  });

  return `<div class="card" style="margin-top:12px;border-left:3px solid var(--red)">
    <div class="small" style="font-weight:800">
      <span style="display:inline-flex;align-items:center;gap:2px;vertical-align:middle">${typeDots(me.name)}${esc(me.disp||me.label)}</span>
      に飛んでくる技<span class="muted"> ・危ない順（ダメージ×採用率）</span></div>
    <div class="small muted" style="margin:2px 0 5px;display:flex;align-items:center;gap:2px">いま対面：${typeDots(cur)}<b>${esc(cur)}</b></div>
    ${rows.length ? rows.map(line).join('')
                  : '<div class="small muted">通る技がありません</div>'}
    ${all.length>rows.length?`<div class="small muted">他${all.length-rows.length}技は4発以上耐えるので省略</div>`:''}

    ${benchRisk.length ? `
      <div class="small" style="font-weight:800;margin-top:10px">控えにも同じ弱点を突く駒がいます
        <span class="muted"> ・交代で出てくる想定</span></div>
      ${benchRisk.slice(0,3).map(b=>`<div class="small" style="margin:3px 0;display:flex;align-items:center;gap:2px;flex-wrap:wrap">
        ${typeDots(b.opp)}<span class="muted">${esc(b.opp)}の</span>
        ${typeBadge(b.type)}<b>${esc(b.move)}</b>
        <span class="muted">（${b.eff>=4?'4倍':'2倍'}・採用${b.rate}%）</span></div>`).join('')}
      ` : `<div class="small muted" style="margin-top:10px">控えに、この駒の弱点を2倍以上で突ける技はありません</div>`}

    ${(()=>{ /* ★交代したときに、その駒が食らう最大ダメージ（社長の要望）。
         「交代した場合に飛んでくる技がどのぐらいなのかがすぐ分かると、
           じゃあこうやって交代した方がいいなと分かる」 */
      const cand = rc.filter(r=> r.label!==me.label && !BT.fainted[r.label]
                                 && (BT.picks.includes(r.label)||BT.picks.includes(r.name)));
      if(!cand.length) return '';
      const rows2 = cand.map(r=>{
        let cc=null; try{ cc = PC.callIt(r, cur, {roster:null, st:BT.board||{}}); }catch(e){}
        if(!cc) return null;
        const hp = r.stats.h;
        const w = (cc.mu.oppRows||[]).slice().sort((a,b)=> b.rateHi-a.rateHi)[0];
        if(!w) return null;
        const d = Math.round(w.rateHi*hp);
        return {n:r.disp||r.label, name:r.name, move:w.move, d, hp, ko:d>=hp, mark:cc.mark};
      }).filter(Boolean).sort((a,b)=> (a.d/a.hp)-(b.d/b.hp));
      if(!rows2.length) return '';
      return `<div class="small" style="font-weight:800;margin-top:10px">交代したら、その駒が食らう最大
          <span class="muted"> ・${esc(cur)}から</span></div>`
        + rows2.map(x=>`<div class="small" style="margin:3px 0;display:flex;align-items:center;gap:2px;flex-wrap:wrap">
            ${typeDots(x.name)}<b>${esc(x.n)}</b> ${typeBadge((PC.MOVES[x.move]||{}).type)}${esc(x.move)}で
            <b style="${x.ko?'color:var(--red)':''}">${x.d}</b>
            <span class="muted">／HP${x.hp}</span>
            ${x.ko?'<b style="color:var(--red)"> 一撃</b>':`<b> ${Math.ceil(x.hp/x.d)}発は耐える</b>`}
            <span class="muted"> ${x.mark}</span></div>`).join('');
    })()}
    ${blocked.length ? `
      <div class="small" style="font-weight:800;margin-top:10px">こちらの技が効かない可能性
        <span class="muted"> ・特性</span></div>
      ${blocked.map(b=>`<div class="small" style="margin:3px 0">
        ${typeBadge(b.type)}<b>${esc(b.move)}</b><span class="muted">は</span>
        ${b.who.map(w=>`${esc(w.opp)}の<b>${esc(w.ability)}</b>${w.rate!=null?`（${w.rate}%）`:''}`).join('・')}
        <span class="muted">に無効。交代されると空振りします</span></div>`).join('')}
      ` : ''}
  </div>`;
}
function btTypeCard(rc){
  const T = PC.TYPES;
  const mode = BT.tdMode || 'def';
  const sel  = BT.tdType;
  const mul  = (t, name)=> PC.effectiveness(t, (PC.SPECIES[PC.toBase(name)]||{types:[]}).types);
  /* 特性でタイプごと無効になるもの（ふゆう・ちょすい等）も見ないと嘘になる */
  const immAb = name => PC.immuneType(PC.worstDefAbility(PC.toBase(name)));
  const label = v => v===0?'無効' : v>=4?'4倍' : v===2?'2倍' : v===1?'等倍' : v===0.5?'半減' : '1/4';
  const color = v => v===0?'var(--muted)' : v>=4?'var(--red)' : v===2?'var(--red)'
                   : v===1?'inherit' : 'var(--muted)';

  /* ①いま出している駒の弱点（常時） */
  const me = rc.find(r=>r.label===BT.me) || rc[0];
  let now = '';
  if(me){
    const ab = me.ability || '';
    const imm = PC.immuneType(ab);
    const rows = T.map(t=>({t, v: (t===imm ? 0 : PC.effectiveness(t, PC.SPECIES[me.name].types))}));
    const bad = rows.filter(r=>r.v>=2).sort((a,b)=>b.v-a.v);
    const safe = rows.filter(r=>r.v<1);
    now = `<div class="small" style="margin-bottom:6px">
      <b>${esc(me.disp||me.label)}</b> が食らうとまずい：
      ${bad.length ? bad.map(r=>`<span style="color:var(--red);font-weight:700">${esc(r.t)} ${label(r.v)}</span>`).join('・')
                   : '<span class="muted">2倍以上はありません</span>'}
      <br><span class="muted">効きにくい：${safe.length?safe.map(r=>`${esc(r.t)} ${label(r.v)}`).join('・'):'なし'}</span>
    </div>`;
  }

  /* ②タイプを選んだときの一覧 */
  let out = '';
  if(sel){
    const mineRows = rc.map(m=>{
      const v = (PC.immuneType(m.ability||'')===sel) ? 0 : mul(sel, m.name);
      return {n:(m.disp||m.label), v};
    }).sort((a,b)=> mode==='def' ? b.v-a.v : b.v-a.v);
    const oppRows = (BT.opp||[]).map(n=>{
      const e = effOppBT(n);
      const v = (immAb(e)===sel) ? 0 : mul(sel, e);
      return {n:e, v};
    }).sort((a,b)=> b.v-a.v);
    const list = rows => rows.map(r=>
      `<span class="pk mini"><b>${esc(r.n)}</b> <span style="color:${color(r.v)};font-weight:700">${label(r.v)}</span></span>`).join('');
    out = mode==='def'
      ? `<div class="small" style="margin-top:8px"><b>${esc(sel)}の技を食らったとき</b>
           <div class="pklist" style="margin-top:4px">${list(mineRows)}</div>
           <div class="small muted" style="margin-top:6px">相手が${esc(sel)}を食らったとき（こちらが撃つ側）</div>
           <div class="pklist" style="margin-top:4px">${list(oppRows)}</div></div>`
      : `<div class="small" style="margin-top:8px"><b>${esc(sel)}の技で殴ったとき（相手6体）</b>
           <div class="pklist" style="margin-top:4px">${list(oppRows)}</div>
           <div class="small muted" style="margin-top:6px">こちらが${esc(sel)}を食らったとき</div>
           <div class="pklist" style="margin-top:4px">${list(mineRows)}</div></div>`;
  }

  /* ★畳んだままだと意味がないので、いま出している駒の弱点は**タイトルに出す**。
     社長の要望は「空いているスペースに置いてほしい」＝見えていないと使われない。 */
  let head = 'タイプ診断';
  if(me){
    const imm = PC.immuneType(me.ability||'');
    const bad = PC.TYPES.map(t=>({t, v:(t===imm?0:PC.effectiveness(t, PC.SPECIES[me.name].types))}))
      .filter(r=>r.v>=2).sort((a,b)=>b.v-a.v);
    head = `<b>${esc(me.disp||me.label)}</b> がまずいのは `
      + (bad.length
          ? bad.map(r=>`<span style="color:var(--red);font-weight:700">${esc(r.t)}${r.v>=4?' 4倍':''}</span>`).join('・')
          : '<span class="muted">なし</span>');
  }
  /* ★「まずいタイプ」は左カラム（btDangerCard）に移した（v70）。
     ここは「任意のタイプを調べる道具」に徹する。同じものを2か所に出すと、どちらを見ればよいか迷う。 */
  return `<details id="btTypeWrap" style="margin-top:10px" ${sel?'open':''}>
    <summary class="small muted" style="cursor:pointer">タイプ診断<span class="muted"> ・タイプを選んで倍率を調べる</span></summary>
    <div style="margin-top:8px">
      ${now}
      <div class="quick">${T.map(t=>
        `<button class="qb mini ${sel===t?'on':'off'}" data-tdt="${t}"
          style="${sel===t?`border-color:${PC.TYPE_COLOR[t]};background:${PC.TYPE_COLOR[t]}22`:''}">
          <i style="background:${PC.TYPE_COLOR[t]};width:13px;height:13px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;margin-right:3px">${typeIcon(t)}</i>${t}</button>`).join('')}</div>
      <div class="hpwrap" style="margin-top:6px">
        <div class="seg">
          <button class="${mode==='def'?'on':''}" data-tdm="def">食らったら</button>
          <button class="${mode==='atk'?'on':''}" data-tdm="atk">殴ったら</button>
        </div>
        ${sel?`<button class="btn ghost sm" data-tdt="">選択を外す</button>`:''}
      </div>
      ${out}
    </div>
  </details>`;
}
function btBoardCard(st){
  const chip = (label, key, val, on)=>
    `<button class="qb mini ${on?'on':'off'}" data-bb="${key}" data-bv="${val}">${esc(label)}</button>`;
  /* ランクは −／＋ のステッパーにする。ボタンを9個並べると縦に伸びて
     試合中にスクロールが必要になる（社長の指摘）。 */
  const rankRow = (label, key)=>{
    const v = st[key]||0;
    return `<div class="hpwrap" style="gap:6px">
      <span class="small muted" style="min-width:88px">${label}</span>
      <div class="seg">
        <button data-bbstep="${key}" data-bv="-1">−</button>
        <button class="${v?'on':''}" data-bbstep="${key}" data-bv="0" style="min-width:44px">${v>0?'+'+v:v}</button>
        <button data-bbstep="${key}" data-bv="1">＋</button>
      </div>
      ${v?`<span class="small muted">×${(v>=0?(2+v)/2:2/(2-v)).toFixed(2)}</span>`:''}
    </div>`;
  };
  const n = Object.entries(st).filter(([k,v])=> v && v!==0 && v!=='').length;
  return `<details id="btBoardWrap" ${n?'open':''} style="margin-top:10px">
    <summary class="small ${n?'':'muted'}" style="cursor:pointer">
      盤面の状態（積み・天候・状態異常・壁・設置）${n?`<b style="color:var(--org)"> ${n}件 反映中</b>`:''}</summary>
    <div class="small" style="margin-top:8px">
      ${(()=>{ /* ★倒れた数（v62）。おはかまいり（イダイトウ98.9%・ハカドッグ88.6%）は
           倒れた味方1体につき威力+50。ここを入れないと、終盤の被ダメージが3分の1に見える。
           社長は相手の3体目のイダイトウ（＝2体落ち・威力150）に一撃で落とされている。
           押すのは試合中に2回だけなので、ワンアクションとして許容できる。 */
        const stepper = (label, key, max)=>{
          const v = st[key]||0;
          return `<div class="hpwrap" style="gap:6px">
            <span class="small muted" style="min-width:88px">${label}</span>
            <div class="seg">
              <button data-bbstep="${key}" data-bv="-1">−</button>
              <button class="${v?'on':''}" data-bbstep="${key}" data-bv="0" style="min-width:44px">${v}体</button>
              <button data-bbstep="${key}" data-bv="1">＋</button>
            </div>
            ${v?`<span class="small muted" style="color:var(--org)">おはかまいり 威力${50+50*v}</span>`:''}
          </div>`;
        };
        return stepper('相手が落ちた数','opFallen') + stepper('自分が落ちた数','myFallen');
      })()}
      ${rankRow('相手の攻撃','opAtkRank')}
      ${rankRow('相手の素早さ','opSpeRank')}
      ${rankRow('自分の攻撃','myAtkRank')}
      ${rankRow('自分の防御','myDefRank')}
      <div class="hpwrap"><span class="small muted" style="min-width:96px">天候</span>
        <div class="quick">${['','にほんばれ','あめ','すなあらし','ゆき'].map(w=>
          chip(w||'なし','weather',w,(st.weather||'')===w)).join('')}</div></div>
      <!-- ★行動できるかどうかは結論そのものを変えるので、いちばん上に置く（社長の要望 2026-08-20） -->
      <div class="hpwrap"><span class="small muted" style="min-width:96px">動けない</span>
        <div class="quick">
          ${chip('自分がねむり','mySleep',1,!!st.mySleep)}
          ${chip('自分がこおり','myFreeze',1,!!st.myFreeze)}
          ${chip('自分がこんらん','myConfuse',1,!!st.myConfuse)}
          ${chip('相手がねむり','opSleep',1,!!st.opSleep)}
          ${chip('相手がこおり','opFreeze',1,!!st.opFreeze)}</div></div>
      <div class="hpwrap"><span class="small muted" style="min-width:96px">状態異常</span>
        <div class="quick">
          ${chip('相手がやけど','opBurn',1,!!st.opBurn)}
          ${chip('相手がまひ','opParalysis',1,!!st.opParalysis)}
          ${chip('相手がもうどく','opToxic',1,!!st.opToxic)}
          ${chip('自分がやけど','myBurn',1,!!st.myBurn)}
          ${chip('自分がまひ','myParalysis',1,!!st.myParalysis)}
          ${chip('自分がもうどく','myToxic',1,!!st.myToxic)}</div></div>
      <div class="hpwrap"><span class="small muted" style="min-width:96px">こちらの壁</span>
        <div class="quick">
          ${chip('リフレクター','myReflect',1,!!st.myReflect)}
          ${chip('ひかりのかべ','myLightscreen',1,!!st.myLightscreen)}
          ${chip('オーロラベール','myAuroraveil',1,!!st.myAuroraveil)}</div></div>
      <div class="hpwrap"><span class="small muted" style="min-width:96px">こちらの場</span>
        <div class="quick">
          ${chip('ステルスロック','myRocks',1,!!st.myRocks)}
          ${chip('まきびし','mySpikes',1,!!st.mySpikes)}
          ${chip('おいかぜ','myTailwind',1,!!st.myTailwind)}</div></div>
      <!-- ★自分が撒いた側。これが無いと「もう撒いたのか」が分からず、
           「引く前にステルスロックを置け」と言い続けてしまう（社長の要望 2026-08-20） -->
      <div class="hpwrap"><span class="small muted" style="min-width:96px">相手の場</span>
        <div class="quick">
          ${chip('ステルスロック','opRocks',1,!!st.opRocks)}
          ${chip('まきびし','opSpikes',1,!!st.opSpikes)}
          ${chip('どくびし','opTSpikes',1,!!st.opTSpikes)}</div></div>
      ${n?`<button class="btn ghost sm" data-bbreset="1" style="margin-top:8px">盤面をリセット</button>`:''}
    </div></details>`;
}
function btBindBoard(){
  $$('#btNow [data-tdt]').forEach(b=> b.onclick=()=>{
    const t = b.dataset.tdt;
    BT.tdType = (t && BT.tdType!==t) ? t : null;
    btNowRender(); saveBtDraft();
  });
  $$('#btNow [data-tdm]').forEach(b=> b.onclick=()=>{
    BT.tdMode = b.dataset.tdm; btNowRender(); saveBtDraft();
  });
  $$('#btNow [data-bbstep]').forEach(b=> b.onclick=()=>{
    const k=b.dataset.bbstep, d=+b.dataset.bv;
    const cur = BT.board[k]||0;
    /* ★倒れた数は 0〜5。能力ランクの −6〜+6 と同じ範囲にすると、
       マイナスの「落ちた数」という意味のない値が入る（v62） */
    const isCount = (k==='opFallen' || k==='myFallen');
    const lo = isCount ? 0 : -6, hi = isCount ? 5 : 6;
    BT.board[k] = d===0 ? 0 : Math.max(lo, Math.min(hi, cur + d));   // 真ん中を押すと0に戻る
    if(!BT.board[k]) delete BT.board[k];
    stashOppBoard(BT.sel);
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  });
  $$('#btNow [data-bb]').forEach(b=> b.onclick=()=>{
    const k=b.dataset.bb, raw=b.dataset.bv;
    const v = (k==='weather') ? raw : (+raw);
    if(k==='weather') BT.board[k] = (BT.board[k]===v ? '' : v);
    else if(BOARD_RANKS.includes(v) && /Rank$/.test(k)) BT.board[k] = v;
    else BT.board[k] = BT.board[k] ? 0 : 1;          // トグル
    stashOppBoard(BT.sel);
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  });
  const r=$('#btNow [data-bbreset]');
  /* ★「盤面をリセット」は、相手ごとにしまってあるぶんも消す。
     ここを消し忘れると、交代して戻ってきた瞬間に積みが復活する。 */
  if(r) r.onclick=()=>{ BT.board={}; BT.oppBoard={};
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft(); };
}

/* ★「このタイプの技が通る」（2026-08-21・v76・社長の要望）。
   「普通に**このタイプの技がいいよ**っていう書き方の方が助かる。
     それが両立しているとありがたい、単純にツールとして」
   ＝ 技名だけの助言は、相手のタイプが変わった瞬間に読み替えられない。
     タイプで持っておけば、へんげんじざいでも・初見の相手でも、社長自身が判断できる。
   ★持っている技には技名を添える（両立させる）。持っていないタイプは薄字で出す
     （「効くけど手持ちに無い」＝引き先を選ぶ材料になるので、消してはいけない）。 */
function btTypeThroughCard(oppEff, me){
  const ta = PC.typeAdvice(oppEff, me);
  if(!ta) return '';
  const grp = (lo, hi) => ta.rows.filter(r=> r.eff>=lo && r.eff<hi);
  const cell = r => `<span style="display:inline-flex;align-items:center;gap:2px;margin-right:8px;${
      r.mine?'font-weight:700':'opacity:.55'}">${typeBadge(r.type)}${esc(r.type)}${
      r.mine?`<span style="color:var(--grn)">✓${esc(r.mine)}</span>`:''}</span>`;
  const line = (label, rows, color) => rows.length
    ? `<div class="small" style="margin:4px 0;display:flex;flex-wrap:wrap;align-items:center">
         <b style="min-width:52px;${color?`color:${color}`:''}">${label}</b>${rows.map(cell).join('')}</div>`
    : '';
  const dead = ta.rows.filter(r=> r.eff===0);
  return `<div class="card" style="margin-top:8px;padding:11px 13px;border-left:3px solid var(--blue)">
    <div class="small" style="font-weight:800">通るタイプ
      <span class="muted"> ・${esc(PC.stripTypeForm(oppEff))} は ${
        esc(ta.types.join('/'))}${PC.typeFormOf(oppEff)?'（へんげんじざいで変化中）':''}</span></div>
    <div class="small muted" style="margin:2px 0 4px">✓ が付いているのは、いま出している駒が持っている技です</div>
    ${line('4倍', grp(4,99), 'var(--red)')}
    ${line('2倍', grp(2,4), 'var(--red)')}
    ${line('等倍', grp(1,2), '')}
    ${line('半減', grp(0.25,1), 'var(--muted)')}
    ${line('1/4', grp(0.001,0.25), 'var(--muted)')}
    ${dead.length?`<div class="small" style="margin:4px 0;display:flex;flex-wrap:wrap;align-items:center">
      <b style="min-width:52px;color:var(--muted)">無効</b>${dead.map(r=>
        `<span style="display:inline-flex;align-items:center;gap:2px;margin-right:8px;opacity:.6">${
          typeBadge(r.type)}${esc(r.type)}${r.byAbility?`<span class="muted">（${esc(r.byAbility)}）</span>`:''}</span>`).join('')}</div>`:''}
  </div>`;
}

/* ---------- 相手が使ってきた技をワンタップで記録 ----------
   社長の要望：「相手が採用してそうな技を10個くらい出して、打ってきた技を記録していく」
   技は4つまでなので、4つ記録できた時点で「それ以外は飛んでこない」が確定し、判定が一気に正確になる。 */
/* ★押した回数を数えるボタン（2026-08-21・v76・社長の要望）。
   「食らったらこれを食らったっていう感じで入れていくので、
     じゃあ**何回相手はそれを打った**みたいな感じで計測できるといい」
   → 押すたびに ×n が増える。積み技（v66）と同じ操作感に揃えた。
   ★押し間違いを戻せるように、記録済みの技には「−」を出す。
     v66 の積み技は「盤面のステッパーで直す」しか無く、試合中に探すのが遅かった。 */
function seenBtn(oppName, move, seen, sub){
  const up  = PC.statUpOf(move);
  const tag = up ? `<span style="color:var(--org)"> ${Object.entries(up).map(([k,v])=>
    ({a:'攻',b:'防',c:'特攻',d:'特防',s:'速'}[k]+(v>0?'+':'')+v)).join(' ')}</span>` : '';
  /* 積み技は「積まれた回数」、それ以外は「撃たれた回数」。数える先は違うが、見え方は同じにする */
  const cnt = up ? (((BT.stacks||{})[oppName]||{})[move] || 0)
                 : (((BT.obsCount||{})[oppName]||{})[move] || 0);
  const on = seen.includes(move) || cnt>0;
  return `<span class="pk mini">`
    + `<button class="qb ${on?'on':'off'}" data-btseen="${esc(move)}">${esc(move)}${sub||''}${tag}${
        cnt?`<b style="color:var(--org)"> ×${cnt}</b>`:''}</button>`
    + (on ? `<button class="qb mini" data-btseenminus="${esc(move)}" title="1回減らす／取り消す"
         style="padding:1px 6px;font-size:11px;margin-left:2px;color:var(--muted)">−</button>` : '')
    + `</span>`;
}
function btSeenCard(oppName, seen){
  const o = effOppBT(oppName);
  const ch = PC.oppMoveChoices(o);
  const extra = seen.filter(m=> !ch.some(c=>c.name===m));
  const n = seen.length, conf = n>=4;
  if(!ch.length && !extra.length) return '';
  return `<div class="card">
    <h2>相手が使ってきた技<span class="sub">タップで記録・押すたびに回数が増えます ${n}/4</span></h2>
    <div class="small ${conf?'':'muted'}" style="margin-bottom:8px">
      ${conf ? '<b style="color:var(--grn)">4つ確定。これ以外は飛んできません。上の判定はこの4つだけで計算しています。</b>'
             : `記録するほど判定が正確になります。あと${4-n}つで確定。`}
    </div>
    ${(()=>{ /* ★へんげんじざい／リベロ（v76・社長の要望）。
         「変幻自在をした後、このタイプになったってなったら、これで変わりよ、というのがある」
         撃ってきた技をタップすれば自動で入るが、こちらが先に読んで手で置きたい場面もあるので、
         相手が撃ちそうな技のタイプだけをボタンで出しておく（18個並べると試合中に探せない）。 */
      if(!PC.hasProtean(oppName)) return '';
      const now  = (BT.oppType||{})[oppName] || null;
      const cand = [...new Set(PC.oppMoveChoices(o).filter(c=>c.power).map(c=>c.type))];
      if(!cand.length) return '';
      return `<div class="small" style="margin-bottom:8px;padding:7px 9px;border:1px dashed var(--org);border-radius:8px">
        <b style="color:var(--org)">へんげんじざい</b>
        <span class="muted">撃った技のタイプに変わります。技をタップすれば自動で入ります</span>
        <div class="quick" style="margin-top:5px">
          <button class="qb mini ${now?'off':'on'}" data-btoptype="">素のまま
            <span class="muted">${esc((PC.SPECIES[PC.stripTypeForm(effOppOf(oppName, BT.oppMega))]||{types:[]}).types.join('/'))}</span></button>
          ${cand.map(t=>`<button class="qb mini ${now===t?'on':'off'}" data-btoptype="${esc(t)}">${typeBadge(t)}${esc(t)}</button>`).join('')}
        </div>
      </div>`;
    })()}
    <div class="quick">
      ${ch.map(c=> seenBtn(oppName, c.name, seen, `<span class="muted"> ${c.rate}%</span>`)).join('')}
      ${extra.map(m=> seenBtn(oppName, m, seen, '<span class="muted"> 手入力</span>')).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
      <input id="btSeenOther" type="text" placeholder="一覧に無い技（だいもんじ 等）" list="mvlist" style="flex:1;min-width:150px">
      <button class="btn ghost sm" id="btSeenAdd">足す</button>
      ${n?`<button class="btn ghost sm" id="btSeenClear">この相手の記録を消す</button>`:''}
    </div>
    ${btSeenHistory(o)}
  </div>`;
}
/** これまでの自分の対戦で、その相手が実際に使ってきた技 */
function btSeenHistory(o){
  const base = PC.toBase(o);
  const obs = (PC.observedMoves(BATTLES)[o] || PC.observedMoves(BATTLES)[base] || []).slice(0,8);
  if(!obs.length) return '';
  /* ★「今回の相手」と混ぜないこと（v76・社長の指摘）。
     同じ種族でも相手ごとに技は違うので、これは**参考値**であって確定ではない。 */
  return `<div class="small muted" style="margin-top:10px">
    <b>過去の対戦</b>での実績（今回の相手とは別。参考）：${
      obs.map(x=>`${esc(x.move)}(${x.count}回)`).join('・')}</div>`;
}
/* ★積み技ぶんの能力ランクを盤面に足し引きする（v66 の処理を関数にした・v75）。
   sign=+1 で乗せる、-1 で外す。相手が落ちたら、その相手が積んでいたぶんだけ外す。 */
const STACK_RANK_MAP = {a:'opAtkRank', b:'opDefRank', c:'opSpaRank', d:'opSpdRank', s:'opSpeRank'};
/* ★盤面のうち「相手のポケモン1体にくっついているもの」（2026-08-21・社長の指摘）。
   社長：「前のポケモンが使った状態で ×3 とかが残っちゃってる。これ計算狂っちゃう」
   ランク変化も状態異常も、**そのポケモンにくっついていて、交代したら一緒に引っ込む。**
   これまで盤面は1つしか無かったので、りゅうのまい×3 が次に出てきた相手にも乗っていた。
   → 相手ごとにしまっておき、出てきた相手のぶんだけ盤面に載せる。
     「対戦中にポケモンが変わって、また戻ってきたら、いちいち登録し直すのは面倒」という
     社長の条件も、これで満たせる（戻ってきたら積みも状態異常もそのまま戻る）。 */
const OPP_BOARD_KEYS = ['opAtkRank','opDefRank','opSpaRank','opSpdRank','opSpeRank',
                        'opSleep','opFreeze','opBurn','opParalysis','opToxic'];
/* ★空でもキーを残すこと。「盤面をリセットして空にした」と「まだ一度も出ていない」は違う。
   区別しないと、リセット直後に交代して戻ってきた瞬間に積みが復活する。 */
function stashOppBoard(name){
  if(!name) return;
  BT.oppBoard = BT.oppBoard || {}; BT.board = BT.board || {};
  const o={}; OPP_BOARD_KEYS.forEach(k=>{ if(BT.board[k]) o[k]=BT.board[k]; });
  BT.oppBoard[name]=o;
}
function loadOppBoard(name){
  BT.oppBoard = BT.oppBoard || {}; BT.board = BT.board || {};
  OPP_BOARD_KEYS.forEach(k=> delete BT.board[k]);
  if(name in BT.oppBoard) Object.entries(BT.oppBoard[name]).forEach(([k,v])=> BT.board[k]=v);
  else applyOppStacks(name, +1);       // 初めて出てきた相手は、積みの記録から作る（保険）
}
function applyOppStacks(name, sign){
  const st = (BT.stacks||{})[name] || {};
  BT.board = BT.board || {};
  Object.entries(st).forEach(([mv, cnt])=>{
    const up = PC.statUpOf(mv); if(!up) return;
    Object.entries(up).forEach(([k,v])=>{
      const bk = STACK_RANK_MAP[k]; if(!bk) return;
      BT.board[bk] = Math.max(-6, Math.min(6, (BT.board[bk]||0) + sign*v*cnt));
      if(!BT.board[bk]) delete BT.board[bk];
    });
  });
}
function btBindSeen(){
  const key = BT.sel; if(!key) return;
  const set = m =>{
    BT.obs = BT.obs || {};
    const cur = BT.obs[key] = BT.obs[key] || [];
    const up = PC.statUpOf(m);
    /* ★積み技は「押した＝1回積まれた」。押すたびに盤面のランクに乗せる（v66・社長の要望）。
       ふつうの技のように on/off で切り替えると、2回積まれたことを表せない。
       消したいときは盤面のステッパーで直せる（そちらは残してある）。 */
    if(up){
      BT.stacks = BT.stacks || {};
      const st = BT.stacks[key] = BT.stacks[key] || {};
      st[m] = (st[m]||0) + 1;
      BT.board = BT.board || {};
      Object.entries(up).forEach(([k,v])=>{
        const bk = STACK_RANK_MAP[k]; if(!bk) return;
        BT.board[bk] = Math.max(-6, Math.min(6, (BT.board[bk]||0) + v));
        if(!BT.board[bk]) delete BT.board[bk];
      });
      if(!cur.includes(m)) cur.push(m);
      stashOppBoard(key);
      toast(`${m} ${st[m]}回目 → ${Object.entries(up).map(([k,v])=>
        ({a:'攻撃',b:'防御',c:'特攻',d:'特防',s:'素早さ'}[k]+(v>0?'+':'')+v)).join('・')}`);
    }else{
      /* ★通常技も「押した＝1回撃たれた」に変えた（v76・社長の要望）。
         以前は on/off のトグルだったので、**何回撃たれたかが残らなかった**。
         取り消しは右の「−」で1回ずつ戻す。 */
      BT.obsCount = BT.obsCount || {};
      const oc = BT.obsCount[key] = BT.obsCount[key] || {};
      oc[m] = (oc[m]||0) + 1;
      if(!cur.includes(m)) cur.push(m);
      if(oc[m] > 1) toast(`${m} ${oc[m]}回目`);
    }
    /* ★みずびたし等（v80・社長の指摘）。
       撃たれた時点で、**いま場に出しているこちらの駒**のタイプが変わる。
       ハラバリーの みずびたし は採用率93.8%＝ほぼ必ず来る。
       これを入れていなかったので「じしんで全然削れない（なぜ）」が起きた。 */
    {
      const ct = PC.typeChangeOf(m);
      if(ct && BT.me){
        BT.myType = BT.myType || {};
        if(BT.myType[BT.me] !== ct){
          BT.myType[BT.me] = ct;
          toast(`${BT.me} が ${ct} タイプにされました（交代すれば元に戻ります）`);
        }
      }
    }
    /* ★へんげんじざい／リベロ（v76・社長の要望）。
       撃ってきた技をタップした時点で、相手はその技のタイプになっている。
       操作を増やさないよう、ここで自動で入れる（手で置き直すこともできる）。 */
    {
      const M = PC.MOVES[m];
      if(M && M.power && M.cat!=='変' && PC.hasProtean(key)){
        BT.oppType = BT.oppType || {};
        if(BT.oppType[key] !== M.type){
          BT.oppType[key] = M.type;
          toast(`${key} は ${M.type} タイプになりました（へんげんじざい）`);
        }
      }
    }
    if(!cur.length) delete BT.obs[key];
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  };
  /* ★1回ぶん戻す（押し間違いの取り消し）。0になったら「使ってきた技」からも外す。 */
  const dec = m =>{
    const up = PC.statUpOf(m);
    if(up){
      const st = (BT.stacks||{})[key] || {};
      if(st[m]){
        st[m]--;
        BT.board = BT.board || {};
        Object.entries(up).forEach(([k,v])=>{
          const bk = STACK_RANK_MAP[k]; if(!bk) return;
          BT.board[bk] = Math.max(-6, Math.min(6, (BT.board[bk]||0) - v));
          if(!BT.board[bk]) delete BT.board[bk];
        });
        if(!st[m]) delete st[m];
      }
    }else{
      const oc = (BT.obsCount||{})[key] || {};
      if(oc[m]){ oc[m]--; if(!oc[m]) delete oc[m]; }
      if(oc[m]) { /* まだ回数が残っているなら観測からは外さない */ }
    }
    stashOppBoard(key);
    const remain = up ? (((BT.stacks||{})[key]||{})[m]||0) : (((BT.obsCount||{})[key]||{})[m]||0);
    if(!remain){
      const cur = (BT.obs||{})[key] || [];
      const i = cur.indexOf(m); if(i>=0) cur.splice(i,1);
      if(!cur.length && BT.obs) delete BT.obs[key];
    }
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  };
  $$('#btNow [data-btseen]').forEach(b=> b.onclick=()=> set(b.dataset.btseen));
  $$('#btNow [data-btseenminus]').forEach(b=> b.onclick=()=> dec(b.dataset.btseenminus));
  /* ★へんげんじざいのタイプを手で置く／素に戻す（v76） */
  $$('#btNow [data-btoptype]').forEach(b=> b.onclick=()=>{
    const t = b.dataset.btoptype || null;
    BT.oppType = BT.oppType || {};
    if(t) BT.oppType[key] = t; else delete BT.oppType[key];
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
    toast(t ? `${key} を ${t} タイプとして計算し直しました` : `${key} を素のタイプに戻しました`);
  });
  const add=$('#btSeenAdd'), inp=$('#btSeenOther');
  if(add) add.onclick=()=>{ const v=(inp.value||'').trim(); if(!v) return;
    if(!PC.MOVES[v]) return toast('その技名は見つかりません',true); set(v); };
  const clr=$('#btSeenClear');
  if(clr) clr.onclick=()=>{
    delete BT.obs[key];
    if(BT.obsCount) delete BT.obsCount[key];          // 回数も一緒に消す（片方だけ残すと食い違う）
    /* 積まれたぶんは盤面に乗っているので、そこも戻してから消す（v76） */
    applyOppStacks(key, -1);
    if(BT.stacks) delete BT.stacks[key];
    stashOppBoard(key);
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  };
}
/** 実戦モードの観測・HPは、次に開いたときも残す。
 *  ★ただし「その1試合かぎりのもの」は持ち越さない（2026-08-21 修正）。
 *  実際に localStorage に `mySleep:1`（自分がねむり）が残り続けていて、
 *  ページを開き直しただけの新しい試合で「ねむりで動けない」前提の助言が出ていた。
 *  盤面・残りHP・ガードの消費は**その試合のもの**なので、時間が経っていたら捨てる。
 *  相手6体と観測した技は次の試合でも役に立つので残す。
 *  30分：1試合はどんなに長くても十数分。誤爆でリロードした直後は残したい。 */
const BT_FRESH_MS = 30*60*1000;
function saveBtDraft(){
  try{ localStorage.setItem('pokechan_bt', JSON.stringify({
    obs:BT.obs, obsCount:BT.obsCount, opp:BT.opp, hp:BT.hp, oppHp:BT.oppHp, dealt:BT.dealt, stacks:BT.stacks, fainted:BT.fainted, oppFainted:BT.oppFainted, oppMega:BT.oppMega, oppType:BT.oppType, oppBoard:BT.oppBoard, oppItem:BT.oppItem, myType:BT.myType, tdType:BT.tdType, tdMode:BT.tdMode,
    megaFixed:BT.megaFixed, guardGone:BT.guardGone, board:BT.board,
    t: Date.now() })); }catch(e){}
}
function loadBtDraft(){
  try{ const d=JSON.parse(localStorage.getItem('pokechan_bt')||'{}');
    const fresh = d.t && (Date.now() - d.t) < BT_FRESH_MS;
    if(d.opp) BT.opp=d.opp;
    if(d.megaFixed) BT.megaFixed=d.megaFixed;
    if(fresh){
      /* ★観測した技は「その試合のもの」なので、時間が経っていたら捨てる（v76）。
         誤ってリロードした直後（30分以内）は残す。 */
      if(d.obs) BT.obs=d.obs; if(d.obsCount) BT.obsCount=d.obsCount;
      if(d.hp) BT.hp=d.hp; if(d.oppHp) BT.oppHp=d.oppHp; if(d.dealt) BT.dealt=d.dealt; if(d.stacks) BT.stacks=d.stacks; if(d.fainted) BT.fainted=d.fainted; if(d.oppFainted) BT.oppFainted=d.oppFainted; if(d.oppMega) BT.oppMega=d.oppMega; if(d.oppType) BT.oppType=d.oppType; if(d.oppBoard) BT.oppBoard=d.oppBoard; if(d.oppItem) BT.oppItem=d.oppItem; if(d.myType) BT.myType=d.myType;
    if(d.tdType) BT.tdType=d.tdType; if(d.tdMode) BT.tdMode=d.tdMode;
      if(d.guardGone) BT.guardGone=d.guardGone; if(d.board) BT.board=d.board;
    }else if(d.board && Object.keys(d.board).length){
      // 黙って捨てると「さっき入れた状態が消えた」と見えるので、捨てたことは伝える
      BT._staleDropped = true;
    }
  }catch(e){}
}

function btDetail(){
  const el=$('#btDetail');
  if(!BT.sel || !BT.matrix || !BT.matrix[BT.sel]){ el.innerHTML=''; return; }
  const o=BT.sel;
  const rows=[...BT.matrix[o]].sort((a,b)=>{
    const rank=m=> m.noOffense?-2 : m.dangerAll?-3 : m.winsAll?3 : m.winsRace?2 : m.split?1 : 0;
    return rank(b.mu)-rank(a.mu) || b.mu.score-a.mu.score;
  });
  const inPick = rows.filter(r=>BT.picks.includes(r.name));
  const best = inPick[0];
  const a = best ? btAct(best.mu, best.call) : null;
  el.innerHTML = `<div id="btLive">${btLiveCard(o)}</div>
    <div class="card">
    <div class="hd" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      ${typeChips(o)}<b style="font-size:17px">${esc(o)}</b> と対面
    </div>
    ${a?`<div class="note ${a.c==='ok'?'g':a.c==='ng'?'r':'w'}" style="margin:8px 0">
      <div style="font-size:18px;font-weight:800">${esc(best.name)} で ${esc(a.t)}</div>
      <div class="small">${muNums(best.mu)}${best.mu.faster?' ／ 先制できる':' ／ 後手'}</div>
      <div class="small" style="margin-top:4px">${threatNote(best.mu)}</div></div>`:''}
    ${(()=>{ // 一撃で落とされる駒を先に全部出す。ここが最重要
      const ko = rows.filter(r=>r.mu.opOHKO);
      return ko.length?`<div class="note r" style="margin:8px 0">
        <b>一撃で落とされる：</b>${ko.map(r=>`${esc(r.name)}（${esc(r.mu.opOHKOMove||'')}${r.mu.opOHKORate!=null?' 採用'+r.mu.opOHKORate+'%':''}）`).join(' ／ ')}</div>`:'';
    })()}
    ${PC.oppTricks(PC.toBase(o)).map(([mv,why])=>`<div class="small" style="color:var(--red)">・<b>${esc(mv)}</b>：${esc(why)}</div>`).join('')}
    <table style="margin-top:10px"><tr><th>自分</th><th>判断</th><th class="num">与 / 被</th></tr>
    ${rows.map(r=>{const ac=btAct(r.mu, r.call);
      return `<tr class="${BT.picks.includes(r.name)?'':'muted'}"><td>${esc(r.name)}${BT.picks.includes(r.name)?'':' <span class="small muted">(控え)</span>'}</td>
      <td><span class="badge ${ac.c}">${ac.t}</span>${r.mu.opMove?`<div class="small muted">被:${esc(r.mu.opMove)}</div>`:''}</td><td class="num small">${muNums(r.mu)}</td></tr>`;}).join('')}
    </table></div>`;
  btBindLive(); btBindSeen();
}

/* =========================================================
   対面 — 1対1の即答
   「このタイプ何に弱いんだっけ」を毎回調べなくていいようにする画面。
   自分の登録実数値 × 相手の3想定 で、通る技・通らない技・注意点を出す。
   ========================================================= */
let VS = { mine:null, opp:'' };

function initVsUI(){
  autocomplete('#vsOpp','#vsOppSug', oppSpeciesSource, n=>{
    VS.opp = n; $('#vsOpp').value = n; renderVs();
  });
  autocomplete('#vsOppMove','#vsOppMoveSug', q=>{
    const hit=n=>!q||n.includes(q);
    return MOVE_NAMES.filter(hit).sort((a,b)=>a.indexOf(q)-b.indexOf(q)||a.length-b.length);
  }, n=>{ $('#vsOppMove').value=n; }, {types:false});
  $('#vsNarrow').onclick = ()=> safe('絞り込み', vsNarrow, '#vsNarrowOut');
  $('#vsClear').onclick = ()=>{ VS.opp=''; $('#vsOpp').value=''; renderVs(); };
}

/** 自分の駒の選択チップと、よく当たる相手のクイックボタン */
function renderVsPickers(){
  const roster = currentRoster();
  const me = $('#vsMine');
  if(!roster.length){ me.innerHTML = '<span class="pk ghost">「構築」タブで6匹を登録してください</span>'; return; }
  if(!VS.mine || !roster.some(m=>m.name===VS.mine)) VS.mine = roster[0].name;
  me.innerHTML = roster.map(m=>pkChip(m.name,{cls:'tapp '+(VS.mine===m.name?'sel':''),data:`data-v="${esc(m.name)}"`})).join('');
  me.querySelectorAll('.tapp').forEach(c=> c.onclick=()=>{ VS.mine=c.dataset.v; renderVsPickers(); renderVs(); });

  const seen={};
  BATTLES.forEach(b=>(b.opp_team||[]).forEach(n=>seen[n]=(seen[n]||0)+1));
  const hist=Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n])=>n);
  const list = hist.length>=6 ? hist : META_TOP.slice(0,8);
  $('#vsQuick').innerHTML = list.map(n=>
    `<button class="qb ${VS.opp===n?'dim':''}" data-vq="${esc(n)}">${typeChips(n)}${esc(n)}</button>`).join('');
  $$('#vsQuick [data-vq]').forEach(b=> b.onclick=()=>{ VS.opp=b.dataset.vq; $('#vsOpp').value=b.dataset.vq; renderVs(); });
}

/** 食らったダメージ%から、相手の振り方と持ち物を絞る。
 *  本作はHPが%表示なので、実数値ではなく%で受け取るのが実戦的。 */
function vsNarrow(){
  const out=$('#vsNarrowOut');
  const pct0=+$('#vsDmgPct').value, mvName=$('#vsOppMove').value.trim();
  const roster=currentRoster(); const rc=rosterForCalc(roster,S.mega);
  const me=rc.find(r=>r.label===VS.mine); const opp=effOpp(VS.opp);
  const mv=PC.MOVES[mvName];
  if(!me||!PC.SPECIES[opp]){ out.innerHTML='<div class="note w">先に自分と相手を選んでください。</div>'; return; }
  if(!pct0||!mv){ out.innerHTML='<div class="note w">減った%と、相手が使った技を入れてください。</div>'; return; }
  if(mv.cat==='変'||!mv.power){ out.innerHTML='<div class="note w">変化技はダメージから絞れません。</div>'; return; }

  const items=['','いのちのたま','こだわりハチマキ','こだわりメガネ','たつじんのおび','とつげきチョッキ'];
  const hit=[], all=[];
  PC.assumedSpreads(opp).forEach(sp=>{
    items.forEach(it=>{
      if(it==='こだわりハチマキ'&&mv.cat!=='物') return;
      if(it==='こだわりメガネ'&&mv.cat!=='特') return;
      if(it==='とつげきチョッキ') return;                 // 攻撃側の道具ではない
      const r=PC.calcDamage({
        attacker:{name:opp, atkStat: mv.cat==='物'?sp.stats.a:sp.stats.c, types:PC.SPECIES[opp].types,
                  ability:PC.worstDefAbility(opp), item:it, rank:0, hpRatio:1},
        defender:{name:me.name, defStat: mv.cat==='物'?me.stats.b:me.stats.d, hp:me.stats.h,
                  types:PC.SPECIES[me.name].types, ability:me.ability||'', item:me.item||'', rank:0, hpRatio:1},
        move:mv, field:{}, flags:{}});
      if(r.error||r.eff===0) return;
      const lo=r.min/me.stats.h*100, hi=r.max/me.stats.h*100;
      const row={label:sp.label, item:it||'持ち物なし', lo, hi};
      all.push(row);
      if(pct0>=Math.floor(lo)-1 && pct0<=Math.ceil(hi)+1) hit.push(row);
    });
  });
  if(!all.length){ out.innerHTML='<div class="note w">この技では計算できませんでした。</div>'; return; }
  const deniedSpread=[...new Set(all.map(r=>r.label))].filter(l=>!hit.some(h=>h.label===l));
  const deniedItem  =[...new Set(all.map(r=>r.item))].filter(i=>!hit.some(h=>h.item===i));

  out.innerHTML = hit.length
    ? `<div class="note g small"><b>${pct0}%</b> から <b>${hit.length}通り</b>に絞れました。</div>
       <table style="margin-top:8px"><tr><th>相手の想定</th><th>持ち物</th><th class="num">この場合</th></tr>
       ${hit.map(h=>`<tr><td>${esc(h.label)}</td><td>${esc(h.item)}</td><td class="num small muted">${Math.round(h.lo)}〜${Math.round(h.hi)}%</td></tr>`).join('')}</table>
       ${(deniedSpread.length||deniedItem.length)?`<div class="note r small" style="margin-top:10px"><b>この時点で否定できたもの</b><br>
         ${deniedSpread.length?`振り方：${deniedSpread.map(esc).join('・')} ではない<br>`:''}
         ${deniedItem.length?`持ち物：${deniedItem.map(esc).join('・')} ではない`:''}</div>`:''}
       <div class="small muted" style="margin-top:8px">分かったことは、記録の「判明した相手の型」欄に残すと次戦で効きます。</div>`
    : `<div class="note w">該当なし。急所・天候・能力ランク・特性（かたいツメ等）が絡んでいる可能性があります。</div>`;
}

function renderVs(){
  PC.setOppItems({});          // 対面タブは「推測のまま」で見る画面なので、確定は持ち込まない
  const out=$('#vsOut');
  const roster=currentRoster();
  if(!VS.mine || !VS.opp || !PC.SPECIES[VS.opp] || !roster.length){
    out.innerHTML=''; $('#vsNarrowCard').hidden = true; return;
  }
  const rc = rosterForCalc(roster, S.mega);
  const me = rc.find(r=>r.label===VS.mine) || {name:VS.mine};
  const opp = effOpp(VS.opp);
  const mu = PC.matchup(me,{name:opp});
  if(!mu){ out.innerHTML='<div class="note w">計算できませんでした。</div>'; return; }
  const os = PC.SPECIES[opp], ms = PC.SPECIES[me.name];
  const v = verdict(mu);

  /* この対面で「何をするか」を1行で出す。実戦では45秒しかないので、結論を先に置く。 */
  const setupMoves = (me.moves||[]).filter(n=>['つるぎのまい','りゅうのまい','わるだくみ','めいそう','ビルドアップ','てっぺき','からをやぶる','こうそくいどう','ちょうのまい'].includes(n));
  let act;
  if(mu.noOffense && mu.dangerAll) act = {cls:'ng', head:'すぐ引く',    why:`打点が無いうえに不利。最大でも${mu.myHits}発かかる`};
  else if(mu.noOffense)         act = {cls:'ng', head:'引く（打点なし）', why:`最大の乱数でも${mu.myHits}発。居座っても回復・交代で巻き返される`};
  else if(mu.dangerAll)         act = {cls:'ng', head:'引く',           why:'どの型でも不利。居座ると崩される'};
  else if(mu.winsAll && mu.faster && mu.myHits<=1) act = {cls:'ok', head:'殴る（1発で落ちる）', why:'先制して確定圏内'};
  else if(mu.winsAll && setupMoves.length && mu.opHits>=3 && mu.faster)
                                act = {cls:'ok', head:`積む（${setupMoves[0]}）`, why:`相手の打点は${mu.opHits}発かかる。1ターン使える`};
  else if(mu.winsAll)           act = {cls:'ok', head:'殴る',           why:'どの型でも先に落とせる'};
  else if(mu.split)             act = {cls:'wn', head:'1発もらって型を絞る', why:splitNote(mu)||'相手の型で結論が変わる'};
  else if(mu.winsRace)          act = {cls:'ok', head:'殴る',           why:'先に落とせる想定'};
  else if(mu.opHits>=3)         act = {cls:'wn', head:'居座って削る',   why:`${mu.opHits}発は耐えるので、削ってから交代でよい`};
  else                          act = {cls:'ng', head:'引く',           why:'押し切れないうえに、こちらの方が先に落ちる'};

  /* ① こちらの技が何倍で通るか（登録した技があればそれ、無ければ全タイプ） */
  const oppAb = PC.worstDefAbility(opp);
  const immT  = PC.immuneType(oppAb);
  const myMoves = (me.moves||[]).map(n=>PC.MOVES[n]).filter(Boolean);
  const moveRows = myMoves.map(m=>{
    // 変化技はタイプ相性で無効化されない（ゴーストにアンコールは通る）ので相性判定から外す
    if(m.cat==='変') return {m, status:true, e:1, blocked:false, dmg:''};
    const e = PC.effectiveness(m.type, os.types);
    const blocked = (m.type===immT);
    let dmg='';
    if(m.power && m.cat!=='変' && !blocked && e>0){
      const sp=PC.assumedSpreads(opp);
      const p=sp.map(x=>{
        const r=PC.calcDamage({
          attacker:{name:me.name,atkStat:m.cat==='物'?me.stats.a:me.stats.c,types:ms.types,ability:me.ability||'',item:me.item||'',rank:0,hpRatio:1},
          defender:{name:opp,defStat:m.cat==='物'?x.stats.b:x.stats.d,hp:x.stats.h,types:os.types,ability:oppAb,item:'',rank:0,hpRatio:1},
          move:m,field:{},flags:{}});
        return (r.error||r.eff===0)?0:(r.min+r.max)/2/x.stats.h*100;
      });
      dmg = dmgRange(Math.min(...p)/100, Math.max(...p)/100);
    }
    return {m,e,blocked,dmg};
  }).sort((a,b)=> (a.status?1:0)-(b.status?1:0) || b.e-a.e);

  /* ② 相手のタイプ技がこちらに何倍か（18タイプ全部。危ないものだけ強調） */
  const myImm = PC.immuneType(me.ability);
  const inc = PC.TYPES.map(t=>({t, e: (t===myImm?0:PC.effectiveness(t, ms.types))}))
                      .filter(x=>x.e>=2).sort((a,b)=>b.e-a.e);
  const safe = PC.TYPES.map(t=>({t, e:(t===myImm?0:PC.effectiveness(t, ms.types))}))
                       .filter(x=>x.e<=0.5);

  /* ③ 気をつけること */
  const warn=[];
  PC.oppTricks(opp).forEach(([mv,why])=> warn.push(`<b>${esc(mv)}</b>：${esc(why)}`));
  if(oppAb) warn.push(`相手の特性 <b>${esc(oppAb)}</b>${immT?`（<b>${esc(immT)}技が無効</b>）`:''}`);
  if(PC.survivesOneHit(opp)) warn.push('<b>1発は必ず耐えてくる</b>（ばけのかわ／がんじょう）。連続技か2発で崩す');
  /* 4倍弱点は「その相手が実際にそのタイプの技を使っているか」で出し分ける。
     これを見ずに出していたので、でんき技を1つも採用していないガブリアス相手に
     「でんきが4倍。先制技でも落ちる」と警告していた（2026-08-19 社長の指摘）。 */
  const my4 = inc.filter(x=>x.e>=4);
  if(my4.length){
    const oppMv = PC.oppMoveChoices(opp);
    const has = t => !oppMv.length || oppMv.some(m=> m.type===t && m.power>0);
    const real = my4.filter(x=> has(x.t));
    const paper = my4.filter(x=> !has(x.t));
    if(real.length) warn.push(`<b>${real.map(x=>x.t).join('・')}が4倍</b>。先制技でも落ちる`);
    if(paper.length) warn.push(
      `<span class="muted">${paper.map(x=>x.t).join('・')}は4倍だが、${esc(opp)}は採用率上位に${paper.length>1?'これらの':'この'}タイプの技を持っていない</span>`);
  }
  /* 素早さは「どの型を想定した数字か」を書かないと嘘になる（スカーフ型を入れてから特に） */
  if(!mu.faster && mu.fasterAny){
    const sc = PC.oppScarfRate(opp);
    warn.push(sc>=15
      ? `相手の型次第で<b>抜かれる</b>。<b>こだわりスカーフ採用${sc}%</b>なので、上の素早さはスカーフ想定の最大値`
      : '相手の型次第で<b>抜かれる</b>。最速想定なら後手');
  }
  else if(!mu.faster) warn.push('<b>相手の方が速い</b>');
  if(mu.split) warn.push(`<b>相手の型で結論が変わる</b>：${esc(splitNote(mu)||'型を絞ってから動く')}`);
  const atkRows = moveRows.filter(r=>!r.status);
  if(atkRows.length && atkRows.every(r=>r.e<1 || r.blocked)) warn.push('<b>こちらの攻撃技が全部半減以下</b>。殴り合っても勝てない');

  /* ④ 引き先 */
  const others = roster.map(m=>m.name).filter(n=>n!==VS.mine);
  const esc2 = others.map(n=>{
    const m2 = rc.find(r=>r.label===n) || {name:n};
    return {n, mu:PC.matchup(m2,{name:opp})};
  }).filter(x=>x.mu && !x.mu.danger)
    .sort((a,b)=> (b.mu.winsAll?1:0)-(a.mu.winsAll?1:0) || b.mu.score-a.mu.score).slice(0,3);

  $('#vsNarrowCard').hidden = false;
  out.innerHTML = `
  <div class="card">
    <div class="hd" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      ${pkChip(VS.mine,{})}<span class="muted">vs</span>${pkChip(opp,{})}
      <span class="badge ${v.cls}" style="margin-left:auto">${esc(v.txt)}</span>
    </div>
    <div class="note ${act.cls==='ok'?'g':act.cls==='ng'?'r':'w'}" style="margin-bottom:10px">
      <div style="font-size:18px;font-weight:800">${esc(act.head)}</div>
      <div class="small">${esc(act.why)}</div>
    </div>
    <div style="font-size:20px;font-weight:800">${muNums(mu)}</div>
    <div class="small muted">与える割合 / 受ける割合　・　素早さ ${mu.myS} vs ${mu.opSNoScarf||mu.opS}${mu.opSScarf?`<span class="muted">（スカーフなら${mu.opSScarf}）</span>`:''}　${mu.faster?'<b>先制できる</b>':(mu.fasterAny?'型次第で先制':'<b>後手</b>')}</div>
  </div>

  ${warn.length?`<div class="card" style="border-left:3px solid var(--red)">
    <h2 style="margin-bottom:8px">気をつけること</h2>
    ${warn.map(w=>`<div class="small" style="padding:3px 0">・${w}</div>`).join('')}
  </div>`:''}

  <div class="card">
    <h2>こちらの技<span class="sub">通るもの／通らないもの</span></h2>
    ${moveRows.length ? moveRows.map(r=>{
      const cls = r.status ? 'wn' : (r.blocked||r.e===0) ? 'ng' : r.e>=2 ? 'ok' : r.e<1 ? 'ng' : 'wn';
      const lbl = r.status ? '変化技' : r.blocked ? `特性で無効` : r.e===0 ? '無効' : r.e>=4?'4倍':r.e===2?'こうかバツグン':r.e===1?'等倍':r.e===0.5?'いまひとつ':'かなりいまひとつ';
      return `<div class="ans">
        <span class="badge ${cls}">${lbl}</span>
        <b>${esc(r.m.name)}</b>
        <span class="small muted">${esc(r.m.type)}・${esc(r.m.cat)}${r.m.power?'・威力'+r.m.power:''}</span>
        <span class="num">${r.dmg||'—'}</span></div>`;
    }).join('') : '<p class="hint">「構築」タブでこの駒の技を登録すると、技ごとの通り方が出ます。</p>'}
  </div>

  <div class="card">
    <h2>受ける側<span class="sub">${esc(VS.mine)} の弱点</span></h2>
    <div class="small" style="margin-bottom:6px"><b>刺さるタイプ</b></div>
    <div class="pklist">${inc.length?inc.map(x=>`<span class="pk"><span class="badge ${x.e>=4?'ng':'wn'}">${x.e}倍</span>${typeIcon(x.t)}<b>${esc(x.t)}</b></span>`).join(''):'<span class="small muted">2倍以上のタイプなし</span>'}</div>
    <div class="small" style="margin:10px 0 6px"><b>効きにくいタイプ</b></div>
    <div class="pklist">${safe.map(x=>`<span class="pk"><span class="badge ok">${x.e===0?'無効':x.e+'倍'}</span>${typeIcon(x.t)}${esc(x.t)}</span>`).join('')||'<span class="small muted">なし</span>'}</div>
    ${(()=>{ // 相手が実際に撃ってくる技（M-5 使用率の実データ）。無い種だけタイプ一致で代用する
      const mv = PC.oppMoves(opp);
      if(!mv) return `<div class="small muted" style="margin-top:8px">相手（${esc(opp)}）は使用率データが無いため、タイプ一致 <b>${os.types.join('・')}</b> で見積もっています。</div>`;
      const list = mv.slice().sort((a,b)=>b.rate-a.rate)
        .map(m=>`${esc(m.name)}<span class="muted">(${m.rate}%・威${m.power})</span>`).join('　');
      return `<div class="small" style="margin-top:8px">相手（${esc(opp)}）が実際に撃ってくる技<span class="muted">（M-5 採用率）</span><br>${list}</div>`;
    })()}
  </div>

  ${esc2.length?`<div class="card">
    <h2>厳しいときの引き先</h2>
    ${esc2.map(x=>`<div class="ans">
      <span class="badge ${x.mu.winsAll?'ok':'wn'}">${x.mu.winsAll?'安全':'型次第'}</span>
      <b>${esc(x.n)}</b><span class="num">${muNums(x.mu)}${x.mu.faster?' 先制':''}</span></div>`).join('')}
  </div>`:''}`;
}

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
  // 6匹のうち、ほとんど選出していない枠がある＝実質5匹で戦っている
  if(deadSlots().length) on.add('deadSlot');
  return on;
}
/** いまの構築で、ほとんど選出していない枠 [{name,n,total}] */
function deadSlots(teamId){
  const t = teamId ? TEAMS.find(x=>x.id===teamId) : currentTeam();
  if(!t) return [];
  const roster = (t.roster&&t.roster.length) ? t.roster : (t.members||[]).map(n=>({name:n}));
  if(roster.length<4) return [];
  const tb = BATTLES.filter(b=>b.team_id===t.id && (b.my_pick||[]).length);
  if(tb.length<15) return [];                     // 母数が少ないうちは判定しない
  const cnt={}; roster.forEach(m=>cnt[m.name]=0);
  tb.forEach(b=>(b.my_pick||[]).forEach(p=>{ if(p in cnt) cnt[p]++; }));
  return Object.entries(cnt).filter(([,n])=> n/tb.length < 0.08)
    .map(([name,n])=>({name, n, total:tb.length}));
}
function renderAdvice(){
  const on = diagnose();
  const auto = (window.PRINCIPLES||[]).filter(p=>(p.when||[]).some(t=>on.has(t)));
  $('#adviceAuto').innerHTML = auto.length
    ? auto.map(p=>adviceCard(p,true)).join('')
    : '<p class="hint">いまのところ、データから引っかかるものはありません。このまま数を積みましょう。</p>';

  const tags=[...new Set((window.PRINCIPLES||[]).flatMap(p=>p.tags||[]))];
  $('#adviceTags').innerHTML = tags.map(t=>
    `<button class="qb ${ADVICE_TAG===t?'':''}" data-tag="${esc(t)}" style="${ADVICE_TAG===t?'border-color:var(--fg);background:var(--soft)':''}">${esc(t)}</button>`).join('')
    + `<button class="qb" data-tag="" style="${!ADVICE_TAG?'border-color:var(--fg);background:var(--soft)':''}">すべて</button>`;
  $$('#adviceTags .qb').forEach(b=> b.onclick=()=>{ ADVICE_TAG=b.dataset.tag||null; renderAdvice(); });

  const list=(window.PRINCIPLES||[]).filter(p=>!ADVICE_TAG||(p.tags||[]).includes(ADVICE_TAG));
  $('#adviceList').innerHTML = list.map(p=>adviceCard(p,false)).join('');
}
function adviceCard(p, highlight){
  const body = esc(p.body)
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
  return `<div class="card" style="${highlight?'border-left:3px solid var(--fg)':''}">
    <h2 style="margin-bottom:4px">${highlight?'<span class="num">!</span>':''}${esc(p.title)}</h2>
    <div class="small muted" style="margin-bottom:10px">${(p.tags||[]).map(t=>`#${esc(t)}`).join(' ')} ・ 出典: ${esc(p.src)}</div>
    <div style="font-size:14px"><p>${body}</p></div>
  </div>`;
}

/* =========================================================
   分析
   ========================================================= */
/* ★期間で絞る（2026-08-21・社長の要望）。
   「構築のプルダウンの横に日付も指定できたらいい。期間とかで指定できると」
   ここ（statSet）を1か所直せば、**分析タブの全部の表と Claude 用の書き出しが同じ期間になる**
   （同じ絞り込みを画面ごとに書かない＝鉄則⑤）。 */
['#sTeam','#sRule','#sPeriod','#sFrom','#sTo'].forEach(sel=>{
  const el=$(sel); if(el) el.addEventListener('change', ()=>{ applyPeriodPreset(sel); renderStats(); });
});
function dayShift(n){ const d=new Date(); d.setDate(d.getDate()+n);
  const p=x=>String(x).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
/** プルダウンを選んだら日付欄を埋める。日付欄を直接いじったら「期間を指定」に切り替える。 */
function applyPeriodPreset(changed){
  const sel=$('#sPeriod'), from=$('#sFrom'), to=$('#sTo'), row=$('#sRangeRow');
  if(!sel||!from||!to) return;
  if(changed==='#sFrom'||changed==='#sTo'){ sel.value='custom'; }
  else {
    const v=sel.value;
    if(v===''){ from.value=''; to.value=''; }
    else if(v==='today'){ from.value=to.value=dayShift(0); }
    else if(v==='yesterday'){ from.value=to.value=dayShift(-1); }
    else if(v!=='custom'){ from.value=dayShift(-(+v-1)); to.value=dayShift(0); }
  }
  if(row) row.style.display = (sel.value==='') ? 'none' : '';
}
function statSet(){
  const t=$('#sTeam').value, r=$('#sRule').value;
  const f=($('#sFrom')||{}).value||'', to=($('#sTo')||{}).value||'';
  return BATTLES.filter(b=>(!t||b.team_id===t)&&(!r||b.rule===r)
    /* played_at は 'YYYY-MM-DD'。文字列のまま比べられるので日付に直さない */
    && (!f  || (b.played_at||'') >= f)
    && (!to || (b.played_at||'') <= to));
}
/** いま何で絞っているか。書き出しの中身も同じ範囲になるので、必ず画面に出す */
function statScopeLabel(n){
  const f=($('#sFrom')||{}).value||'', to=($('#sTo')||{}).value||'';
  const t=$('#sTeam').value ? (TEAMS.find(x=>x.id===$('#sTeam').value)||{}).name : null;
  const parts=[];
  if(t) parts.push(esc(t));
  if(f||to) parts.push(`${esc(f||'最初')} 〜 ${esc(to||'今日')}`);
  return `いま見ているのは <b>${n}戦</b>${parts.length?`（${parts.join('・')}）`:'（すべて）'}。`
       + `<b>「ファイルに保存（Claudeに渡す用）」もこの範囲だけ</b>が入ります`;
}

/* ---------- 統計の正直さ（2026-08-21） ----------
   前回、p=0.011 と書いた3戦後に p=0.141 まで落ちて結論が崩れた。
   画面に勝率の増減を出す以上、**必ず p値と「あと何戦で判定できるか」を併記する**。 */
/** 2つの勝率の差の p値（正規近似の両側）。母数が小さいときは 1 を返して黙らせない */
function twoPropP(w1,n1,w2,n2){
  if(!n1||!n2) return 1;
  const p1=w1/n1, p2=w2/n2, p=(w1+w2)/(n1+n2);
  const se=Math.sqrt(p*(1-p)*(1/n1+1/n2));
  if(!se) return 1;
  const z=Math.abs(p1-p2)/se;
  // 標準正規の両側p（Abramowitz-Stegun 26.2.17）
  const t=1/(1+0.2316419*z);
  const d=0.3989422804014327*Math.exp(-z*z/2);
  const pr=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return Math.min(1, Math.max(0, 2*pr));
}
/** その差を有意と言うのに必要な、1群あたりのおおよその試合数（両側5%・検出力80%） */
function needN(p1,p2){
  const d=Math.abs(p1-p2); if(d<0.01) return null;
  const pb=(p1+p2)/2;
  return Math.ceil(2*Math.pow(1.96+0.84,2)*pb*(1-pb)/(d*d));
}
function tbl(rows,head){
  if(!rows.length) return '<p class="hint">データがまだ足りません。</p>';
  return `<table><tr>${head.map(h=>`<th class="${h.num?'num':''}">${h.t}</th>`).join('')}</tr>${rows.join('')}</table>`;
}
function rateRow(label,w,n,bad,extra){
  const p=pct(w,n);
  return `<tr class="${bad?'bad':''}"><td>${esc(label)}<div class="bar"><i style="width:${p}%"></i></div></td>${extra||''}<td class="num">${n}</td><td class="num">${p}%</td></tr>`;
}
/* ---------- 構築のアップグレード提案 ----------
   社長の要望（2026-08-20）：
   「メモや敗因をちゃんと分析して『こうするべき』を出してほしい。
     アシレーヌにルカリオを勧められたが、実際に倒したのはカイリューだった、みたいなズレを溜めて、
     環境に合わせて構築をアップグレードしていきたい。
     自分の6体の使用率もカウントして、使わない駒／重い相手への対策を出したい」

   ★設計方針：**母数を必ず出す。足りないときは断定しない。**
     少ない試合数で「この駒を切れ」と言うのは、運と実力の区別がつかないまま構築を壊す行為なので、
     3戦未満は「まだ判定できません（あと◯戦）」と正直に出す。 */
/* 記録の書き出し。ClaudeはこのアプリのDBを読めないので、分析を頼むときは本人に貼ってもらう。
   個人情報は入れない（メールアドレス・IDは出さない）。試合の中身だけ。 */
function bindExport(){
  const btn=$('#expBattles'); if(!btn) return;
  /* 書き出す中身は1か所で作る。ボタンごとに別々に組み立てると必ず食い違う。 */
  const build = ()=>{
    const B = statSet();
    const t = TEAMS.find(x=>x.id===$('#fTeam').value);
    return { B, data:{
      構築: t ? {name:t.name, roster:(t.roster||[]).map(m=>({name:m.name,item:m.item,nature:m.nature,ability:m.ability,sp:m.sp,moves:m.moves}))} : null,
      戦績: {全:B.length, 勝:B.filter(b=>b.result==='win').length},
      試合: B.map(b=>({
        日:b.played_at, 結果:b.result, 相手6体:b.opp_team, 相手の選出:b.opp_pick,
        こちらの選出:b.my_pick, メガ:b.mega,
        敗因:b.lose_cause, きつかった相手:b.pain_mon, やられた技:b.pain_move,
        出すべきだった:b.should_pick, 欲しかった技:b.want_move, メモ:b.memo,
        観測した相手の技: (b.turns||[]).filter(t=>t.oppAct&&t.oppAct.move)
          .map(t=>`${t.oppMon}:${t.oppAct.move}`)
      }))
    }};
  };
  /* ★ファイルに保存（2026-08-21・v64・社長の要望）。
     チャットに貼ると、そのJSONは**会話に残り続けてコンテキストを圧迫する**。
     ファイルなら Claude は集計結果だけ読めばよく、記録が何戦に増えても読む量が変わらない。
     ファイル名は日付＋戦数で固定。Claude 側は ~/Downloads の最新を拾う。 */
  const fbtn = $('#expFile');
  if(fbtn) fbtn.onclick = ()=>{
    const {B, data} = build();
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    const name = `pokechan_${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${B.length}戦.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type:'application/json'}));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    toast(`${name} を保存しました。Claudeに「保存した」と伝えてください`);
  };
  btn.onclick = async ()=>{
    const {B, data} = build();
    const txt = JSON.stringify(data, null, 1);
    const out = $('#expOut'); out.style.display='block'; out.value = txt;
    try{ await navigator.clipboard.writeText(txt); toast(`${B.length}戦ぶんをコピーしました。Claudeに貼ってください`); }
    catch(e){ out.select(); toast('下の欄をコピーしてClaudeに貼ってください', true); }
  };
}

const UP_MIN = 3;                      // これ未満の母数では結論を出さない
function renderUpgrade(B, L){
  const host = $('#upgrade'); if(!host) return;
  const roster = currentRoster();
  if(!B.length || !roster.length){
    host.innerHTML = '<div class="small muted">記録がまだありません。試合が終わったら対戦タブから残してください</div>';
    return;
  }
  const out = [];
  const box = (title, body, note) =>
    `<div class="mg"><div class="op">${title}</div><div class="small">${body}</div>` +
    (note?`<div class="small muted" style="margin-top:4px">${note}</div>`:'') + '</div>';

  /* ★⓪ ツールの推奨と、実際の選出のズレ（2026-08-21・v62・社長の要望）。
     「ツールで提案された3体じゃないポケモンで勝ったパターンが見たい。
       ツールがミスっていれば僕の判断に寄せる、僕がミスっていればツールの判断に寄せる」
     推奨は**いまのエンジンで計算し直す**（当時の版ではなく、いまの版が何と言うかが知りたいため）。
     過去の記録を使うので、その試合より後の記録は予想に使わない（未来を見ない）。 */
  {
    const size = $('#fRule').value==='double' ? 4 : 3;
    const neutral = rosterForCalc(roster, null);
    const old2new = [...B].reverse();                 // 古い順
    const rows = old2new.map((b,i)=>{
      const team = b.opp_team||[], act = b.my_pick||[];
      if(team.length<3 || act.length<size) return null;
      let rec = [];
      try{
        const past = old2new.slice(0,i).reverse();     // その時点までの記録だけ
        const pp = PC.predictPicks(team, past, neutral, size, META_TOP);
        const bp = bestPlan(roster, (pp.picks&&pp.picks.length)?pp.picks:team, size, team, null);
        rec = (bp.plan && bp.plan.members) || [];
      }catch(e){ return null; }
      if(rec.length<size) return null;
      const same = [...rec].sort().join('|') === [...act].sort().join('|');
      const diff = rec.filter(n=>!act.includes(n));
      return {b, rec, act, same, diff, win: b.result==='win'};
    }).filter(Boolean).reverse();                      // 新しい順に戻す

    if(rows.length){
      const s = rows.filter(r=>r.same), d = rows.filter(r=>!r.same);
      const wins = a=>a.filter(r=>r.win).length;
      const winDiff = d.filter(r=>r.win);
      out.push(box('ツールの推奨と、実際の選出',
        `<b>推奨どおり出した</b> … ${s.length}戦 ${wins(s)}勝${s.length-wins(s)}敗` +
        (s.length>=UP_MIN?`（${pct(wins(s),s.length)}%）`:'<span class="muted">（母数不足）</span>') +
        `<br><b>違う選出をした</b> … ${d.length}戦 ${wins(d)}勝${d.length-wins(d)}敗` +
        (d.length>=UP_MIN?`（${pct(wins(d),d.length)}%）`:'<span class="muted">（母数不足）</span>') +
        (winDiff.length
          ? `<hr style="border:0;border-top:1px solid var(--line2);margin:8px 0">` +
            `<b style="color:var(--org)">推奨と違う選出で勝った ${winDiff.length}戦</b>` +
            `<div class="small" style="margin-top:5px">` +
            winDiff.slice(0,6).map(r=>
              `相手：${esc((r.b.opp_pick&&r.b.opp_pick.length?r.b.opp_pick:r.b.opp_team).join('/'))}<br>` +
              `　ツール：<span class="muted">${esc(r.rec.join('/'))}</span><br>` +
              `　実際　：<b>${esc(r.act.join('/'))}</b>` +
              (r.diff.length?`　<span class="muted">（出さなかった：${esc(r.diff.join('・'))}）</span>`:'')
            ).join('<hr style="border:0;border-top:1px dotted var(--line2);margin:6px 0">') +
            `</div>`
          : ''),
        d.length < UP_MIN
          ? `推奨と違う選出は${d.length}戦だけです。あと${UP_MIN-d.length}戦で比べられるようになります`
          : `<b>違う選出の方が勝っているなら、ツールの点数のつけ方が間違っています。</b>` +
            `そのときは「出さなかった駒」を教えてください。なぜツールがそれを推したかを調べて直します`));
    }
  }

  /* ① 自分の駒の選出率と勝率。使っていない枠＝構築の穴 */
  const mine = {};
  roster.forEach(m=> mine[m.name] = {n:0, w:0});
  B.forEach(b=> (b.my_pick||[]).forEach(n=>{ if(mine[n]){ mine[n].n++; if(b.result==='win') mine[n].w++; } }));
  /* ★name と件数の両方を n と書いてしまい、名前が数字で表示される不具合を出した（2026-08-20）。
     同じ轍を踏まないよう、名前は name、件数は cnt と別の名前にしてある。 */
  const rows = Object.entries(mine).map(([name,v])=>({name, cnt:v.n, w:v.w}))
    .sort((a,b)=> a.cnt-b.cnt);
  out.push(box('駒ごとの選出率と勝率',
    rows.map(r=>`${esc(r.name)} … <b>${r.cnt}回</b>（${pct(r.cnt,B.length)}%）` +
      (r.cnt>=UP_MIN?` 勝率 <b>${pct(r.w,r.cnt)}%</b>`:' <span class="muted">勝率はまだ出せません</span>')).join('<br>'),
    (()=>{ const dead = rows.filter(r=> B.length>=6 && r.cnt<=Math.max(1, Math.floor(B.length*0.15)));
      return dead.length
        ? `<b>${dead.map(r=>esc(r.name)).join('・')}</b> はほとんど選出していません。この枠が仕事をしていないなら、
           重い相手への対策に替える価値があります（下の②を参照）`
        : (B.length<6 ? `あと${6-B.length}戦で「使っていない枠」の判定が出せます` : '極端に出していない枠はありません'); })()));

  /* ② 相手別：勝てない相手と、そのとき何を出していたか。
        ここが「アシレーヌにはルカリオではなくカイリューだった」を拾う場所。 */
  const per = {};
  B.forEach(b=> new Set(b.opp_team||[]).forEach(o=>{
    per[o] = per[o] || {n:0, w:0, by:{}};
    per[o].n++; if(b.result==='win') per[o].w++;
    (b.my_pick||[]).forEach(m=>{ per[o].by[m]=per[o].by[m]||{n:0,w:0}; per[o].by[m].n++; if(b.result==='win') per[o].by[m].w++; });
  }));
  const hard = Object.entries(per).filter(([,v])=> v.n>=UP_MIN).map(([o,v])=>({o,...v, r:v.w/v.n}))
    .sort((a,b)=> a.r-b.r).slice(0,4);
  if(hard.length){
    out.push(box('この相手がいるときの実測',
      hard.map(h=>{
        const best = Object.entries(h.by).filter(([,v])=>v.n>=2).map(([m,v])=>({m,...v,r:v.w/v.n}))
          .sort((a,b)=> b.r-a.r);
        const tool = (()=>{ const rc = rosterForCalc(roster, null);
          const cand = rc.map(m=>({m, c:PC.callIt(m, h.o, {})})).filter(x=>x.c)
            .sort((a,b)=> b.c.mu.score-a.c.mu.score)[0];
          return cand ? cand.m.name : null; })();
        const actual = best[0];
        const gap = (tool && actual && actual.m!==tool && actual.n>=2 && actual.r>0.5)
          ? `<br><span style="color:var(--org)">ツールの推奨は <b>${esc(tool)}</b> ですが、
             実際は <b>${esc(actual.m)}</b> を出した ${actual.n}戦で ${pct(actual.w,actual.n)}% 勝っています。
             次はこちらを試す価値があります</span>` : '';
        return `<b>${esc(h.o)}</b> … ${h.n}戦 ${h.w}勝${h.n-h.w}敗（勝率 ${pct(h.w,h.n)}%）` +
          (best.length?`<br>出した駒：${best.map(x=>`${esc(x.m)} ${x.w}勝${x.n-x.w}敗`).join('、')}`:'') + gap;
      }).join('<hr style="border:0;border-top:1px solid var(--line2);margin:8px 0">'),
      '「ツールの推奨」は相性計算だけの結論です。実測が上回るなら、実測を優先してください'));
  } else {
    const near = Object.entries(per).map(([o,v])=>({o,n:v.n})).sort((a,b)=>b.n-a.n)[0];
    out.push(box('この相手がいるときの実測',
      near ? `いちばん多く当たっているのは <b>${esc(near.o)}</b>（${near.n}戦）です`
           : '記録がまだありません',
      near ? `あと${Math.max(0,UP_MIN-near.n)}戦で相手別の判定を出せます（${UP_MIN}戦以上で表示）`
           : ''));
  }

  /* ③ 手持ちに答えが無い相手。構築を変える理由になるのはここだけ */
  if(hard.length){
    const rc = rosterForCalc(roster, null);
    const noAnswer = hard.filter(h=>{
      return !rc.some(m=>{ const c=PC.callIt(m, h.o, {}); return c && (c.head==='殴る'||c.head==='受ける'||c.head==='削る'); });
    });
    if(noAnswer.length){
      out.push(box('手持ちに答えが無い相手',
        noAnswer.map(h=>{
          const t = (PC.SPECIES[h.o]||{}).types||[];
          const weak = PC.TYPES ? PC.TYPES.filter(a=> PC.effectiveness(a, t) > 1) : [];
          return `<b>${esc(h.o)}</b>（${h.n}戦 勝率${pct(h.w,h.n)}%）<br>` +
                 `6体の誰も「殴る／受ける」に届きません。有効なタイプ：<b>${weak.join('・')}</b>`;
        }).join('<br><br>'),
        '<b>ここが構築を変えるべき唯一の根拠です。</b>選出やプレイングでは解決しません'));
    }
  }

  /* ④ 記録から出た具体的な要望（既に集計済みのものを行動に変える） */
  const sp={}, wm={};
  L.forEach(b=>{ if(b.should_pick) sp[b.should_pick]=(sp[b.should_pick]||0)+1;
                 if(b.want_move)  wm[b.want_move]=(wm[b.want_move]||0)+1; });
  const spTop = Object.entries(sp).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]);
  const wmTop = Object.entries(wm).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]);
  if(spTop.length||wmTop.length){
    out.push(box('自分で「こうすべきだった」と書いたもの',
      [ spTop.length?`<b>出しておけばよかった駒</b>：${spTop.map(([n,c])=>`${esc(n)}（${c}回）`).join('、')}
          → 基本選出に入れることを検討してください`:'',
        wmTop.length?`<b>あると良かった技</b>：${wmTop.map(([m,c])=>`${esc(m)}（${c}回）`).join('、')}
          → 技構成を変える理由になります`:''].filter(Boolean).join('<br>'),
      '2回以上出てきたものだけを載せています（1回は運と区別がつかないため）'));
  }

  host.innerHTML = out.join('');
}

/* ★成長レポート（2026-08-21・社長の要望）。
   「期間で、どうやって勝率が上がってるかが見れると、成長したなって感じがして嬉しい」
   「活躍しているポケモンとか、敗因として一番大きいものとか、苦手なポケモンとか」
   ★ここは**気持ちよくなるための画面ではない**。母数が少ないうちの上下は運と区別がつかないので、
     必ず p値と「あと何戦で判定できるか」を添える（2026-08-21 に一度この失敗をしている）。 */
function renderGrowth(B){
  const host=$('#growth'); if(!host) return;
  if(!B.length){ host.innerHTML='<div class="small muted">この期間の記録がありません。期間を広げてください。</div>'; return; }
  const wins = a => a.filter(b=>b.result==='win').length;

  /* ① 日ごとの勝率（棒グラフ）。古い→新しい の順に並べて、伸びが左から右に見えるようにする */
  const byDay = {};
  B.forEach(b=>{ const d=b.played_at||'—'; (byDay[d]=byDay[d]||[]).push(b); });
  const days = Object.keys(byDay).filter(d=>d!=='—').sort();
  const bars = days.slice(-21).map(d=>{
    const a=byDay[d], n=a.length, w=wins(a), p=Math.round(w/n*100);
    const md = d.slice(5).replace('-','/');
    /* 3戦未満の日は薄くする。1戦1勝を「勝率100%」として見せない */
    const thin = n<3;
    return `<div style="flex:1;min-width:22px;max-width:46px;display:flex;flex-direction:column;align-items:center;gap:2px"
                 title="${esc(d)} ${n}戦 ${w}勝${n-w}敗 ${p}%">
      <div class="small" style="font-size:10px;${thin?'opacity:.45':''}">${p}%</div>
      <div style="width:100%;height:70px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${p}%;min-height:3px;border-radius:3px 3px 0 0;opacity:${thin?.35:1};
                    background:${p>=50?'var(--win)':'var(--red)'}"></div>
      </div>
      <div class="small muted" style="font-size:10px">${esc(md)}</div>
      <div class="small muted" style="font-size:10px">${n}戦</div>
    </div>`;
  }).join('');

  /* ② 前半と後半で比べる。「成長したか」はこれがいちばん素直な出し方。
     ★配列の並び順に頼らない。**必ず日付で並べ直してから**半分に割る
       （BATTLES は新しい順だが、その前提が変わったら黙って逆の結論を出してしまう）。 */
  const asc = B.slice().sort((a,b)=>
    String(a.played_at||'').localeCompare(String(b.played_at||''))
    || String(a.created_at||'').localeCompare(String(b.created_at||'')));
  const half = Math.floor(asc.length/2);
  const older = asc.slice(0, half);
  const newer = asc.slice(asc.length-half);
  let trend = '';
  if(half>=3){
    const ow=wins(older), nw=wins(newer);
    const op=ow/older.length, np=nw/newer.length;
    const diff=Math.round((np-op)*100);
    const pv=twoPropP(nw,newer.length,ow,older.length);
    const need=needN(op,np);
    trend = `<div class="small" style="margin-top:10px">
      <b>前半 ${older.length}戦 ${Math.round(op*100)}% → 後半 ${newer.length}戦 ${Math.round(np*100)}%</b>
      <b style="color:${diff>0?'var(--grn)':diff<0?'var(--red)':'inherit'}"> ${diff>0?'+':''}${diff}ポイント</b></div>
      <div class="small muted">p=${pv.toFixed(3)}。${
        pv<0.05 ? '<b>偶然では説明しにくい差です</b>'
        : need ? `この差を「本物」と言うには<b>片側あと約${Math.max(0,need-newer.length)}戦</b>必要です（いまは運と区別がつきません）`
               : 'ほぼ差がありません'}</div>`;
  }else{
    trend = `<div class="small muted" style="margin-top:10px">前半・後半で比べるには、この期間にあと${(3-half)*2}戦ほど必要です</div>`;
  }

  /* ③ 活躍している駒／苦手な相手／いちばん多い敗因 */
  const agg = (getKeys) =>{
    const m={};
    B.forEach(b=> new Set(getKeys(b)).forEach(k=>{ m[k]=m[k]||{n:0,w:0}; m[k].n++; if(b.result==='win') m[k].w++; }));
    return Object.entries(m).map(([k,v])=>({k,...v}));
  };
  const MIN = 3;
  const mine = agg(b=> b.my_pick||[]).filter(x=>x.n>=MIN).sort((a,b)=> b.w/b.n-a.w/a.n || b.n-a.n);
  const opp  = agg(b=> b.opp_team||[]).filter(x=>x.n>=MIN).sort((a,b)=> a.w/a.n-b.w/b.n || b.n-a.n);
  const cz={}; B.filter(b=>b.result==='lose').forEach(b=>
    (b.lose_cause||'').split(' / ').map(x=>x.trim()).filter(Boolean).forEach(c=> cz[c]=(cz[c]||0)+1));
  const czTop = Object.entries(cz).sort((a,b)=>b[1]-a[1])[0];

  const listOf = (rows, dir) => rows.length
    ? rows.slice(0,3).map(x=>`<div class="small" style="margin:2px 0;display:flex;align-items:center;gap:3px">
        ${typeDots(x.k)}<b>${esc(x.k)}</b>
        <b style="color:${dir*(x.w/x.n-0.5)>0?'var(--grn)':'var(--red)'}">${pct(x.w,x.n)}%</b>
        <span class="muted">${x.n}戦${x.w}勝</span></div>`).join('')
    : `<div class="small muted">${MIN}戦以上の記録がまだありません</div>`;

  const w=wins(B);
  host.innerHTML = `
    <div class="small">この期間 <b>${B.length}戦 ${w}勝${B.length-w}敗（${pct(w,B.length)}%）</b>
      ${B.length<30?'<span class="muted"> ・30戦未満なので参考値です</span>':''}</div>
    ${trend}
    ${days.length>1?`<div class="small" style="font-weight:800;margin-top:14px">日ごとの勝率
        <span class="muted"> ・左が古い${days.length>21?`（直近21日ぶんだけ表示）`:''}・3戦未満の日は薄字</span></div>
      <div style="display:flex;gap:4px;align-items:flex-end;margin-top:6px;overflow-x:auto">${bars}</div>`
      :`<div class="small muted" style="margin-top:12px">日ごとの棒グラフは、2日以上の記録が溜まると出ます</div>`}
    <div class="row" style="margin-top:16px">
      <div>
        <div class="small" style="font-weight:800">活躍している駒<span class="muted"> ・${MIN}戦以上</span></div>
        ${listOf(mine, 1)}
      </div>
      <div>
        <div class="small" style="font-weight:800">苦手な相手<span class="muted"> ・いると勝てない</span></div>
        ${listOf(opp, -1)}
      </div>
    </div>
    <div class="small" style="margin-top:12px"><b>いちばん多い敗因</b> …
      ${czTop ? `${esc(czTop[0])} <b>${czTop[1]}件</b><span class="muted">（負け${B.length-w}戦中）</span>`
              : '<span class="muted">まだありません。「試合が終わった」で敗因を選ぶと溜まります</span>'}</div>
    <div class="small muted" style="margin-top:8px">
      ここに出る順位は、<b>${MIN}戦程度では簡単に入れ替わります</b>。
      「この駒が強い」ではなく「いまのところ上に来ている」として見てください</div>`;
}

function renderStats(){
  const B=statSet(), w=B.filter(b=>b.result==='win').length;
  { const el=$('#sScope'); if(el) el.innerHTML = statScopeLabel(B.length); }
  renderGrowth(B);
  const rec=B.slice(0,20), rw=rec.filter(b=>b.result==='win').length;
  const td=B.filter(b=>b.played_at===todayStr()), tw=td.filter(b=>b.result==='win').length;
  $('#kpis').innerHTML=`
    <div class="kpi"><div class="k">通算</div><div class="v">${B.length}<span style="font-size:14px">戦</span></div><div class="s">${w}勝 ${B.length-w}敗</div></div>
    <div class="kpi"><div class="k">勝率</div><div class="v">${pct(w,B.length)}<span style="font-size:14px">%</span></div><div class="s">${B.length<30?'30戦未満は参考値':'十分な母数'}</div></div>
    <div class="kpi"><div class="k">直近20戦</div><div class="v">${pct(rw,rec.length)}<span style="font-size:14px">%</span></div><div class="s">${rw}勝 ${rec.length-rw}敗</div></div>
    <div class="kpi"><div class="k">今日</div><div class="v">${td.length}<span style="font-size:14px">戦</span></div><div class="s">${tw}勝 ${td.length-tw}敗</div></div>`;

  /* ---------- 敗因（負けた試合だけ） ----------
     社長の方針（2026-08-20）：「相性で勝てる試合は分析いらない。負けた時は必ず原因がある」 */
  const L = B.filter(b=>b.result==='lose');
  const cz = {};
  // 敗因は複数選べるので ' / ' で分解して1つずつ数える（原因は1つとは限らない）
  L.forEach(b=>{ (b.lose_cause||'').split(' / ').map(x=>x.trim()).filter(Boolean)
    .forEach(c=> cz[c]=(cz[c]||0)+1); });
  const czArr = Object.entries(cz).sort((a,b)=>b[1]-a[1]);
  $('#loseCause').innerHTML = czArr.length
    ? tbl(czArr.map(([c,n])=>`<tr><td>${esc(c)}<div class="bar b"><i style="width:${pct(n,L.length)}%"></i></div></td><td class="num">${n}</td><td class="num">${pct(n,L.length)}%</td></tr>`),
        [{t:'敗因'},{t:'件数',num:1},{t:'負け試合に占める割合',num:1}])
      + '<div class="small muted">1試合に複数の原因を選べるので、合計は100%を超えます</div>'
    : `<div class="small muted">まだありません。負けた試合のあと、対戦タブの「試合が終わった」で ${L.length?'敗因を選ぶと':'記録すると'}ここに溜まります</div>`;

  /* 出しておけばよかった駒。結果論の積み重ねが、そのまま選出の型になる（社長の要望 2026-08-20） */
  const sp={}; L.forEach(b=>{ if(b.should_pick) sp[b.should_pick]=(sp[b.should_pick]||0)+1; });
  const spArr=Object.entries(sp).sort((a,b)=>b[1]-a[1]);
  const memos = L.filter(b=>b.memo).slice(0,8);
  if(spArr.length || memos.length){
    $('#loseCause').innerHTML += `
      ${spArr.length?`<div class="small" style="font-weight:800;margin-top:14px">出しておけばよかった駒</div>
        <div class="small">${spArr.map(([n,c])=>`${esc(n)} <b>${c}回</b>`).join('　')}</div>
        <div class="small muted">同じ駒が繰り返し出てくるなら、その駒は選出の基本に入れるべきです</div>`:''}
      ${memos.length?`<div class="small" style="font-weight:800;margin-top:14px">負けたときのメモ</div>
        ${memos.map(b=>`<div class="small" style="margin:4px 0;padding-left:10px;border-left:2px solid var(--line)">
          <span class="muted">${esc(b.lose_cause||'')}${b.pain_mon?`・${esc(b.pain_mon)}`:''}</span><br>${esc(b.memo)}</div>`).join('')}`:''}`;
  }

  /* やられた技 → 同じ技を持つ他のポケモンへ広げる。ここが「1回の負けを環境対策に変える」部分 */
  const pm = {};
  L.forEach(b=>{ if(b.pain_move) { pm[b.pain_move]=pm[b.pain_move]||{n:0, by:{}};
    pm[b.pain_move].n++; if(b.pain_mon) pm[b.pain_move].by[b.pain_mon]=(pm[b.pain_move].by[b.pain_mon]||0)+1; } });
  const pmArr = Object.entries(pm).sort((a,b)=>b[1].n-a[1].n);
  $('#painMoves').innerHTML = pmArr.length
    ? pmArr.map(([mv,v])=>{
        const others = (PC.whoElseHas ? PC.whoElseHas(mv) : []).filter(x=> !v.by[x.name]).slice(0,8);
        const met = new Set(); B.forEach(b=>(b.opp_team||[]).forEach(n=>met.add(n)));
        return `<div class="mg">
          <div class="op"><b>${esc(mv)}</b><span class="muted"> ${v.n}回やられている</span></div>
          <div class="small">やられた相手：${Object.entries(v.by).map(([n,c])=>`${esc(n)}${c>1?`(${c}回)`:''}`).join('・')||'—'}</div>
          ${others.length?`<div class="small" style="margin-top:6px">
            <b>同じ技を持つ他の相手</b>（採用率順）：${others.map(x=>
              `${esc(x.name)}<span class="muted"> ${x.rate}%${met.has(x.name)?'・遭遇あり':''}</span>`).join('、')}
            <div class="muted" style="margin-top:2px">この並びが来たら同じ負け方をします。対戦タブで先に確認してください</div></div>`
           :'<div class="small muted" style="margin-top:6px">この技を採用率10%以上で持つ他のポケモンは環境にいません</div>'}
        </div>`;
      }).join('')
    : '<div class="small muted">まだありません。負けたときに「やられた技」を1タップ選ぶだけで溜まります</div>';

  const wm={}; L.forEach(b=>{ if(b.want_move) wm[b.want_move]=(wm[b.want_move]||0)+1; });
  const wmArr=Object.entries(wm).sort((a,b)=>b[1]-a[1]);
  if(wmArr.length) $('#painMoves').innerHTML += `<div class="small" style="font-weight:800;margin-top:14px">あると良かった技</div>
    <div class="small">${wmArr.map(([m,c])=>`${esc(m)} <b>${c}回</b>`).join('　')}</div>
    <div class="small muted">2回以上出てきた技は、技構成を変える理由になります</div>`;

  renderUpgrade(B, L);

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
  const dead = deadSlots($('#sTeam').value || undefined);
  if(dead.length) out.push(['r',`${dead.map(d=>`<b>${esc(d.name)}</b>（${d.total}戦中 ${d.n}回）`).join('、')} をほとんど選出していません。
    <b>この枠は実質いないのと同じ</b>です。「どの並びに対して出すつもりの枠か」を言葉にできないなら、入れ替える判断材料になります（相談タブの「一度も選出しない枠」参照）。`]);
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

/** 構築データの取り込み。Claudeが出したJSONをそのまま貼れるようにする。
 *  データに無いポケモン名・技名はここで弾いて、何が落ちたかを必ず出す。 */
$('#impRun').onclick = async ()=>{
  const msg=$('#impMsg'); msg.className='small muted'; msg.textContent='';
  let d;
  try{ d = JSON.parse($('#impText').value.trim()); }
  catch(e){ msg.className='small'; msg.style.color='var(--red)'; msg.textContent='JSONとして読めません: '+e.message; return; }
  const name = (d.name||'').trim();
  const roster = Array.isArray(d.roster) ? d.roster : [];
  if(!name) { msg.textContent='name がありません'; return; }
  if(!roster.length){ msg.textContent='roster が空です'; return; }

  const bad=[], clean=[];
  roster.forEach(m=>{
    if(!m || !PC.SPECIES[m.name]){ bad.push(`ポケモン「${m&&m.name||'?'}」がデータにありません`); return; }
    const mv=(m.moves||[]).filter(x=>{
      if(!x) return false;
      if(!PC.MOVES[x]){ bad.push(`${m.name} の技「${x}」がデータにありません`); return false; }
      return true;
    });
    if(m.nature && !PC.NATURES[m.nature]) bad.push(`${m.name} の性格「${m.nature}」が不明`);
    const sp = Object.assign({h:0,a:0,b:0,c:0,d:0,s:0}, m.sp||{});
    const tot = Object.values(sp).reduce((a,b)=>a+b,0);
    if(tot>PC.SP_TOTAL) bad.push(`${m.name} のSP合計が ${tot}（上限${PC.SP_TOTAL}）`);
    Object.entries(sp).forEach(([k,v])=>{ if(v>PC.SP_MAX) bad.push(`${m.name} の${k}が ${v}（1能力の上限${PC.SP_MAX}）`); });
    clean.push({name:m.name, ability:m.ability||'', nature:m.nature||'', item:m.item||'', sp, moves:mv});
  });
  if(!clean.length){ msg.style.color='var(--red)'; msg.textContent='登録できるポケモンがありませんでした'; return; }

  const res = await dbWrite('teams','insert',{user_id:USER.id, name,
    members:clean.map(m=>m.name), roster:clean, plans:{}, note:d.note||null});
  if(!res.ok){ msg.style.color='var(--red)'; msg.textContent='保存に失敗: '+res.error.message; return; }
  $('#impText').value='';
  await loadTeams(); renderAll();
  toast(`「${name}」を${clean.length}匹で登録しました`);
  if(bad.length){
    msg.style.color='var(--org)';
    msg.innerHTML = '取り込みましたが、次は反映されていません：<br>'+bad.map(esc).join('<br>');
  }
};

/* ---------- 実数値から構築を登録する ----------
   社長の要望（2026-08-19）：
   「パーティのスクショをすれば技・能力値・持ち物が全部パーティに登録できるようにしたい。
     そうすればダメージ計算しやすいから」
   ゲームが見せるのは実数値なので、まず「実数値 → 性格＋SP」の逆算をここで済ませる。
   スクショOCRを付けたときは、読み取った値をこのフォームに流し込むだけで済む。 */
let SF = { list:[] };
function initStatForm(){
  if(!$('#sfName')) return;
  autocomplete('#sfName','#sfNameSug',
    q=> PC.searchSpecies(q, {limit:12}).list,
    n=>{ $('#sfName').value=n; sfSolveShow(); });
  ['#sfH','#sfA','#sfB','#sfC','#sfD','#sfS','#sfName'].forEach(id=> $(id).addEventListener('input', sfSolveShow));
  $('#sfAdd').onclick = ()=> safe('登録', sfAdd, '#sfMsg');
  $('#sfSave').onclick = ()=> safe('保存', sfSave, '#sfMsg');
  sfRenderList();
}
function sfRead(){
  const name = ($('#sfName').value||'').trim();
  const g = id => { const v = $(id).value; return v==='' ? null : (+v|0); };
  const real = {h:g('#sfH'), a:g('#sfA'), b:g('#sfB'), c:g('#sfC'), d:g('#sfD'), s:g('#sfS')};
  const full = Object.values(real).every(v=> v!==null && v>0);
  return {name, real, full};
}
function sfSolveShow(){
  const out = $('#sfSolve'); const {name, real, full} = sfRead();
  if(!name || !PC.SPECIES[name]){ out.innerHTML=''; return; }
  if(!full){ out.innerHTML='<span class="muted">6つ全部入れると、性格とSPを自動で出します</span>'; return; }
  const sol = PC.solveSpread(name, real);
  if(!sol.length){
    out.innerHTML = `<span style="color:var(--red)">この実数値になる組み合わせがありません。
      数字か、ポケモン名（メガかどうか）を確認してください。</span>`;
    return;
  }
  SF.sol = sol;
  out.innerHTML = `<div class="note g"><b>${sol.length===1?'確定':'候補'+sol.length+'通り'}</b>：`
    + sol.slice(0,3).map((x,i)=>`<label style="display:block;margin-top:4px">
        <input type="radio" name="sfsol" value="${i}" ${i===0?'checked':''}> ${esc(x.nature)}
        <span class="muted">H${x.sp.h}/A${x.sp.a}/B${x.sp.b}/C${x.sp.c}/D${x.sp.d}/S${x.sp.s}（合計${x.total}）</span></label>`).join('')
    + '</div>';
}
function sfAdd(){
  const {name, real, full} = sfRead();
  if(!name || !PC.SPECIES[name]) throw new Error('ポケモン名が正しくありません');
  if(!full) throw new Error('実数値を6つ全部入れてください');
  const sol = PC.solveSpread(name, real);
  if(!sol.length) throw new Error('この実数値になる組み合わせがありません');
  const pick = sol[+((document.querySelector('input[name=sfsol]:checked')||{}).value || 0)] || sol[0];
  const moves = ['#sfM1','#sfM2','#sfM3','#sfM4'].map(id=>($(id).value||'').trim()).filter(Boolean);
  const bad = moves.filter(m=>!PC.MOVES[m]);
  if(bad.length) throw new Error('技が見つかりません：'+bad.join('・'));
  SF.list = SF.list.filter(x=>x.name!==name);
  SF.list.push({ name, ability:($('#sfAbility').value||'').trim(), item:($('#sfItem').value||'').trim(),
                 nature:pick.nature, sp:pick.sp, moves, real });
  ['#sfName','#sfH','#sfA','#sfB','#sfC','#sfD','#sfS','#sfAbility','#sfItem','#sfM1','#sfM2','#sfM3','#sfM4']
    .forEach(id=> $(id).value='');
  $('#sfSolve').innerHTML='';
  sfRenderList();
  toast(`${name} を足しました（${SF.list.length}/6）`);
}
function sfRenderList(){
  const el = $('#sfList'); if(!el) return;
  el.innerHTML = SF.list.length ? `<table><tr><th>ポケモン</th><th>性格 / SP</th><th>技</th><th></th></tr>
    ${SF.list.map((m,i)=>`<tr><td>${typeDots(m.name)}${esc(m.name)}<div class="small muted">${esc(m.ability||'')} ${esc(m.item||'')}</div></td>
      <td class="small">${esc(m.nature)}<div class="muted">H${m.sp.h}/A${m.sp.a}/B${m.sp.b}/C${m.sp.c}/D${m.sp.d}/S${m.sp.s}</div></td>
      <td class="small">${m.moves.map(esc).join('<br>')}</td>
      <td><button class="btn ghost sm" data-sfdel="${i}">消す</button></td></tr>`).join('')}</table>` : '';
  $$('#sfList [data-sfdel]').forEach(b=> b.onclick=()=>{ SF.list.splice(+b.dataset.sfdel,1); sfRenderList(); });
  $('#sfSaveWrap').hidden = SF.list.length < 1;
}
async function sfSave(){
  if(!SF.list.length) throw new Error('先に1匹以上足してください');
  const name = ($('#sfTeamName').value||'').trim() || SF.list.map(m=>m.name).slice(0,3).join('×');
  const clean = SF.list.map(m=>({name:m.name, ability:m.ability, nature:m.nature, item:m.item, sp:m.sp, moves:m.moves}));
  const res = await dbWrite('teams','insert',{user_id:USER.id, name,
    members:clean.map(m=>m.name), roster:clean, plans:{}, note:'実数値から登録'});
  if(!res.ok) throw new Error('保存に失敗: '+res.error.message);
  SF.list=[]; $('#sfTeamName').value=''; sfRenderList();
  await loadTeams(); renderAll();
  toast(`「${name}」を保存しました`);
}

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
  /* 対戦タブにも同じ切替を置く（記録タブの中にしか無く、試合前に見つけられなかった）。
     値は #fTeam を正本にして、必ず一致させる。 */
  const bt=$('#btTeam');
  if(bt){
    bt.innerHTML=opts||'<option value="">（構築を登録してください）</option>';
    bt.value=$('#fTeam').value;
    const chips=$('#btTeamChips');
    if(chips){ const t=currentTeam();
      chips.textContent = t ? (t.roster||[]).map(m=>m.name).join('・') : '構築タブか取り込み欄から登録してください'; }
  }
}
function renderAll(){
  applyPeriodPreset();                    // 期間の欄の出し分け（初回は「すべて」なので畳む）
  fillTeamSelects(); bindExport(); renderOpp(); renderTeams(); renderHist(); renderStats();
  safe('対面', ()=>{ renderVsPickers(); renderVs(); }, '#vsOut');
  safe('実戦', ()=>{ btCompute(); btRender(); }, '#btGrid');
  if(!$('#mvlist2')){const dl2=document.createElement('datalist');dl2.id='mvlist2';
    dl2.innerHTML=MOVE_NAMES.map(m=>`<option value="${esc(m)}">`).join('');document.body.appendChild(dl2);}
}
boot();
