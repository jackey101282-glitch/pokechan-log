/* =========================================================
   ポケチャン ノート — アプリ本体
   データの正本は Supabase。localStorage は入力途中の下書きのみ。
   ========================================================= */
'use strict';
/* HTMLとJSの版ズレを検出する。ズレていたら1回だけ強制リロードする。
   （GitHub Pages は index.html と app.js を別々に10分キャッシュするため） */
const APP_VERSION = '40';
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
function rosterForCalc(roster, megaChoice){
  const megaSlots = roster.filter(m=>PC.isMegaForm(m.name)).map(m=>m.name);
  return roster.map(m=>{
    const demote = PC.isMegaForm(m.name) && megaSlots.length>1 && megaChoice && megaChoice!==m.name;
    const calcName = demote ? PC.toBase(m.name) : m.name;
    return {
      label:m.name,                    // 表示・選出の照合はこちら
      name:calcName,                   // 計算に使う姿
      // 画面に出す名前は「実際に計算した姿」。メガ枠を別に切るなら メガ前の名前で出さないと嘘になる
      disp: demote ? PC.toBase(m.name) : m.name,
      demoted:demote,
      stats:PC.realStats(calcName, m.sp, m.nature),
      moves:(m.moves||[]).filter(Boolean),
      ability: demote ? '' : (m.ability||''),
      item:    demote ? '' : (m.item||'')
    };
  }).filter(m=>m.stats);
}
/** 表示名。メガ枠を別に切る駒は「メガ前の姿」で出す（メガできないのにメガ名で出すのは嘘） */
function dispName(rc, label){
  const r = (rc||[]).find(x=> x.label===label);
  return r ? (r.disp || r.label) : label;
}
/** この構築が持つメガ枠。複数あればどれを切るかで結果が変わる */
function megaSlotsOf(roster){ return roster.filter(m=>PC.isMegaForm(m.name)).map(m=>m.name); }
/** メガの切り方を総当たりして、いちばん良い選出を返す。
 *  第一基準＝予想した相手3体への強さ、第二基準＝予想が外れた時に相手6体をどれだけ見れるか。 */
function bestPlan(roster, targets, size, allOpp, fixedMega){
  const slots = megaSlotsOf(roster);
  /* ★社長が手でメガ枠を決めているなら、その前提だけで選出を組む。
     これをやっていなかったので「メガ=メガクチート なのに選出3体にクチートがいない」
     という矛盾した提案が出ていた（2026-08-19 の指摘）。 */
  const choices = fixedMega ? [fixedMega] : (slots.length>1 ? slots : [null]);
  const pool = [];
  choices.forEach(ch=>{
    const rc = rosterForCalc(roster, ch);
    const sug = PC.suggestPicks(rc, targets, Math.min(size, rc.length));
    sug.top.forEach(c=>{
      // 選んだメガが選出に入っていない案は、メガを切る意味がないので除外
      if(ch && !c.members.includes(ch)) return;
      // メガ枠が1枚だけの構築でも、それが選出に入るなら「そこに切る」と明示する
      const mega = ch || (slots.length===1 && c.members.includes(slots[0]) ? slots[0] : null);
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
      pool.push({plan:c, mega, rc, backup, blind});
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
      return t.length?`<div class="pick-card" style="border-color:var(--red);background:var(--redsoft)">
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
  BT.sel=null; BT.me=null; BT.matrix=null;
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
let BT = { opp:[], picks:[], mega:null, megaFixed:null, matrix:null, sel:null, me:null, hp:{}, oppHp:{}, obs:{}, guardGone:{}, board:{} };

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
  BT.tsel = BT.tsel || [];
  const btTypeRender = ()=>{
    $('#btTypePick').innerHTML = PC.TYPES.map(t=>{
      const on = BT.tsel.includes(t);
      return `<button class="qb mini ${on?'on':'off'}" data-bt="${t}"
        style="${on?`border-color:${PC.TYPE_COLOR[t]};background:${PC.TYPE_COLOR[t]}22`:''}">
        <i style="background:${PC.TYPE_COLOR[t]};width:15px;height:15px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;margin-right:3px">${typeIcon(t)}</i>${t}</button>`;
    }).join('');
    $$('#btTypePick [data-bt]').forEach(b=> b.onclick=()=>{
      const t=b.dataset.bt, i=BT.tsel.indexOf(t);
      if(i>=0) BT.tsel.splice(i,1); else { BT.tsel.push(t); if(BT.tsel.length>2) BT.tsel.shift(); }
      btTypeRender();
    });
    const out = $('#btTypeOut');
    if(!BT.tsel.length){ out.innerHTML=''; return; }
    // 選んだタイプを「全部持っている」種を出す。使用率順→なければ図鑑順
    const rank = n =>{ const u = PC.oppUsage(n); return u ? u.r : 999; };
    const hit = Object.keys(PC.SPECIES)
      .filter(n=> !BT.opp.includes(n) && BT.tsel.every(t=> PC.SPECIES[n].types.includes(t)))
      .sort((a,b)=> rank(a)-rank(b) || a.length-b.length).slice(0,14);
    out.innerHTML = hit.length
      ? `<div class="small muted" style="width:100%">${BT.tsel.join('・')} を持つ ${hit.length}体（使用率順）</div>`
        + hit.map(n=>`<button class="qb mini" data-bto="${esc(n)}">${typeDots(n)}${esc(n)}${rank(n)<999?`<span class="muted"> ${rank(n)}位</span>`:''}</button>`).join('')
      : '<span class="small muted">この組み合わせのポケモンはいません</span>';
    $$('#btTypeOut [data-bto]').forEach(b=> b.onclick=()=>{
      if(BT.opp.length>=6) return toast('6匹までです',true);
      BT.opp.push(b.dataset.bto); BT.tsel=[];
      btCompute(); btRender();
    });
  };
  btTypeRender();

  /* 名前で探して即タップ。候補に無いポケモンを入れるとき、
     フルネームを打ってから「足す」を押すのは遅すぎる（選出は90秒）。 */
  const btSearchRender = ()=>{
    const q = ($('#btSearch').value||'').trim();
    const box = $('#btSearchOut');
    if(!q){ box.innerHTML=''; return; }
    const kana = t => t.replace(/[ぁ-ん]/g, c=>String.fromCharCode(c.charCodeAt(0)+0x60))
                       .replace(/[ー－]/g,'').replace(/[ァィゥェォャュョッ]/g,'');
    const k = kana(q);
    const hit = Object.keys(PC.SPECIES)
      .filter(n=> !BT.opp.includes(n) && kana(n).includes(k))
      .sort((a,b)=> kana(a).indexOf(k)-kana(b).indexOf(k) || a.length-b.length)
      .slice(0,10);
    box.innerHTML = hit.length
      ? hit.map(n=>`<button class="qb mini" data-bs="${esc(n)}">${typeDots(n)}${esc(n)}</button>`).join('')
      : '<span class="small muted">見つかりません</span>';
    $$('#btSearchOut [data-bs]').forEach(b=> b.onclick=()=>{
      if(BT.opp.length>=6) return toast('6匹までです',true);
      BT.opp.push(b.dataset.bs); $('#btSearch').value='';
      btCompute(); btRender(); $('#btSearch').focus();
    });
  };
  $('#btSearch').oninput = btSearchRender;

  $('#btVoiceRun').onclick = ()=> safe('実戦', ()=>{
    const r = PC.parseBattleText($('#btVoice').value.trim());
    btAddNames([...r.opp_team, ...r.my_pick]);        // 相手/自分の切り分けは不要。全部相手として扱う
  }, '#btGrid');
  // やり直しても、相手の技の観測だけは残す（次の試合でも同じ相手に当たるので価値がある）
  $('#btReset').onclick = ()=>{
    const obs = BT.obs;
    BT={opp:[],picks:[],mega:null,matrix:null,sel:null,me:null,hp:{},obs:obs||{}};
    PC.clearMatchupCache(); $('#btVoice').value=''; btRender(); saveBtDraft();
  };
  loadBtDraft();
}

/** 相手6体が決まった時点で、全部の対面を先に計算しておく */
function btCompute(){
  const roster = currentRoster();
  if(!roster.length || !BT.opp.length){ BT.matrix=null; return; }
  const size = $('#fRule').value==='double' ? 4 : 3;
  const bp = bestPlan(roster, BT.opp, size, BT.opp, BT.megaFixed);
  BT.picks = bp.plan ? bp.plan.members : roster.slice(0,size).map(m=>m.name);
  BT.mega  = bp.mega;
  // メガ枠が選出に入っていなければ、そのメガは切れない。嘘を出さないよう必ず外す
  if(BT.mega && !BT.picks.includes(BT.mega)) BT.mega = null;
  // メガ枠を手で変えたら、その姿で全部計算し直す（bp.rc は提案時のもの）
  const rc = (BT.megaFixed ? rosterForCalc(roster, BT.mega) : (bp.rc || rosterForCalc(roster, BT.mega)));
  BT.matrix = {};
  BT.opp.forEach(o=>{
    const knownOf = BT.obs && BT.obs[o] ? BT.obs[o] : null;
    BT.matrix[o] = roster.map(m=>{
      const me = rc.find(r=>r.label===m.name) || {name:m.name};
      const c = PC.callIt(me, effOpp(o), {known:knownOf, st:BT.board||{}});
      return { name:m.name, mu: c ? c.mu : PC.matchup(me,{name:effOpp(o), known:knownOf}), call:c };
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
  $('#btOppChips').innerHTML = BT.opp.length
    ? BT.opp.map((n,i)=>`<span class="pk mini">${typeDots(n)}<b>${esc(n)}</b><span class="x" data-bx="${i}">×</span></span>`).join('')
    : '<span class="pk ghost">下から6体を選んでください</span>';
  $$('#btOppChips [data-bx]').forEach(x=> x.onclick=()=>{ BT.opp.splice(+x.dataset.bx,1); btCompute(); btRender(); });

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
  $('#btQuick').innerHTML = why + list.filter(n=>!BT.opp.includes(n)).slice(0,12)
      .map(n=>`<button class="qb mini" data-bq="${esc(n)}">${typeDots(n)}${esc(n)}</button>`).join('');
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
    <summary class="cardsum" style="border-color:var(--red);background:var(--redsoft)">
      <span>選出 <b>${BT.picks.map(n=>esc(dispName(rc,n))).join(' / ')}</b>${BT.mega?`<span class="muted"> ・メガ=${esc(BT.mega)}</span>`:'<span class="muted"> ・メガは切らない</span>'}</span>
    </summary>
    <div class="card" style="border-color:var(--red);background:var(--redsoft)">
    ${(()=>{ const slots = megaSlotsOf(roster);
      if(slots.length<=1) return BT.mega?`<div class="small">メガは <b>${esc(BT.mega)}</b> に切る</div>`:'';
      return `<div class="small" style="margin-top:6px">メガをどれに切るか（変えると全部の判定が変わります）</div>
        <div class="quick" style="margin-top:4px">${slots.map(sl=>
          `<button class="qb ${BT.mega===sl?'on':'off'}" data-btmega="${esc(sl)}">${esc(sl)}</button>`).join('')}</div>`;
    })()}
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
  <button class="btn ghost btn-full" id="btToRec" style="margin-bottom:14px">試合が終わった → 記録に送る</button>`;

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
  const host = $('#btNow'); if(!host) return;
  const roster = currentRoster();
  if(!roster.length || !BT.opp.length){ host.innerHTML=''; return; }
  const rc = rosterForCalc(roster, BT.mega);

  // 相手：既定は先頭。自分：既定は「その相手にいちばん強い選出内の駒」
  if(!BT.sel || !BT.opp.includes(BT.sel)) BT.sel = BT.opp[0];
  const o = effOpp(BT.sel);
  const inPick = r => BT.picks.includes(r.label) || BT.picks.includes(r.name);
  const mine = [...rc].sort((a,b)=> (inPick(b)?1:0)-(inPick(a)?1:0));
  if(!BT.me || !mine.some(m=>m.label===BT.me)){
    const best = mine.filter(inPick).map(m=>({m, c:PC.callIt(m,o,{})})).filter(x=>x.c)
      .sort((a,b)=> b.c.mu.score - a.c.mu.score)[0];
    BT.me = best ? best.m.label : mine[0].label;
  }
  const me = mine.find(m=>m.label===BT.me) || mine[0];
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
  const pickRoster = rc.filter(inPick);
  BT.board = BT.board || {};
  const st = BT.board;
  const c = me.stats ? PC.callIt(me, o, {roster: pickRoster.length?pickRoster:rc,
                                         myHP:hp, oppHPPct:oppPct/100, known:seen, guardGone:gGone, st}) : null;
  const rd = c && c.read;

  /* 相手が交代してきた時の答え。試合中いちばん聞かれる択なので、画面と音声の両方に出す。
     いま出ている相手を除いた残りのうち、こちらがいちばん困る1体を選ぶ。 */
  let swIn = null;
  if(c){
    const others = BT.opp.filter(n=> n!==BT.sel);
    const cand = others.map(n=>{
      const cc = PC.callIt(me, effOpp(n), {roster: pickRoster.length?pickRoster:rc,
                                           myHP:hp, known:(BT.obs&&BT.obs[n])||[], guardGone:gGone, st});
      return cc ? {name:n, c:cc} : null;
    }).filter(Boolean).sort((a,b)=> a.c.mu.score - b.c.mu.score);
    swIn = cand[0] || null;
  }

  // 試合中はスクロールが命取りになるので、タイプは小さい丸だけにして1行に複数入れる
  const oppChips = BT.opp.map(n=>`<button class="qb mini ${n===BT.sel?'on':'off'}" data-btopp="${esc(n)}">${typeDots(n)}${esc(n)}</button>`).join('');
  const myChips  = mine.map(m=>`<button class="qb mini ${m.label===BT.me?'on':'off'}" data-btme="${esc(m.label)}">${typeDots(m.name)}${esc(m.disp||m.label)}${m.demoted?'<span class="muted"> メガ無</span>':''}${inPick(m)?'':'<span class="muted"> 控</span>'}</button>`).join('');

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
  <div class="card" style="border-color:${c?`var(--${c.cls==='ok'?'grn':c.cls==='ng'?'red':'org'})`:'var(--line)'}">
    <h2>いまの対面<span class="sub">相手/自分をタップで切替</span></h2>
    <div class="hpwrap">
      <button class="btn ${window.VOICE&&VOICE.isOn()?'':'ghost'} sm" id="btSpeakBtn">${window.VOICE&&VOICE.isOn()?'🔊 音声ON':'🔇 音声OFF'}</button>
      <span class="small muted">マナーモードのままで鳴ります</span>
    </div>

    <div class="small muted">相手</div>
    <div class="quick" style="margin-top:4px">${oppChips}</div>
    ${(()=>{ const ti = PC.teamItemsOf(PC.toBase(BT.sel)) || [];
      return ti.length ? `<details><summary class="small muted" style="cursor:pointer;margin-top:4px">上位構築での持ち物</summary>
        <div class="small muted">${ti.map(x=>`${esc(x.name)} ${x.rate}%`).join('・')}</div></details>` : ''; })()}
    <div class="hpwrap">
      <span class="small muted">相手の残りHP</span>
      <div class="seg" id="btOppHp">
        ${[100,75,50,25,10].map(v=>`<button class="${oppPct===v?'on':''}" data-btop="${v}">${v}%</button>`).join('')}
      </div>
    </div>

    <div class="small muted" style="margin-top:12px">自分</div>
    <div class="quick" style="margin-top:4px">${myChips}</div>
    <div class="hpwrap">
      <span class="small muted">自分の残りHP</span>
      <input id="btHp" type="number" inputmode="numeric" min="0" max="${maxHP}" value="${hp}">
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
      ${c.to?`<div class="small" style="margin-top:6px">引くなら → <b>${esc((mine.find(x=>x.name===c.to.name)||{}).disp || c.to.name)}</b>（${c.to.c.mark} ${esc(c.to.c.why)}）</div>`:''}
      ${swIn?`<div class="small" style="margin-top:6px">${esc(swIn.name)}に交代されたら → <b>${swIn.c.mark} ${esc(swIn.c.head)}</b>${swIn.c.to?`（${esc(swIn.c.to.name)}へ）`:''}</div>`:''}
    </div>
    ${(c.todo&&c.todo.length)?`<div class="card" style="margin-top:8px;padding:11px 13px;border-color:var(--blue);background:var(--bluesoft)">
      <div class="small" style="font-weight:800;margin-bottom:4px">引く前にやること</div>
      ${c.todo.map(d=>`<div class="small" style="margin:3px 0">・${d.t}</div>`).join('')}
    </div>`:''}
    <div class="small" style="margin-top:10px">
      ${c.detail.map(d=>`<div style="margin:3px 0;color:${d.k==='bad'?'var(--red)':d.k==='good'?'var(--grn)':d.k==='warn'?'var(--org)':d.k==='role'?'var(--blue)':'inherit'}">・${d.t}</div>`).join('')}
    </div>`:''}
    ${btBoardCard(st)}
    ${readBlock}
  </div>
  ${btSeenCard(BT.sel, seen)}`;

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

  $$('#btNow [data-btopp]').forEach(b=> b.onclick=()=>{
    /* ★相手を変えても自分の選択は変えない（社長の指摘 2026-08-20）。
       以前は BT.me=null にして「その相手にいちばん強い駒」を勝手に選び直していた。
       画面には「殴る」と出ているのに、出ているのは場にいない別の駒、という事故が起きて
       実際に負けている。自動選択は最初の1回だけ（BT.me が未設定のとき）に限る。 */
    BT.sel=b.dataset.btopp;
    const pb=$('.planbox'); if(pb) pb.open=false;          // 試合が始まったら選出カードは畳む
    const iw=$('#btInputWrap'); if(iw) iw.open=false;
    btNowRender();
  });
  $$('#btNow [data-btme]').forEach(b=> b.onclick=()=>{ BT.me=b.dataset.btme; btNowRender(); });
  $$('#btNow [data-btop]').forEach(b=> b.onclick=()=>{ BT.oppHp[BT.sel]=+b.dataset.btop; btNowRender(); saveBtDraft(); });
  $$('#btNow [data-bthp]').forEach(b=> b.onclick=()=>{ BT.hp[BT.me]=maxHP; btNowRender(); saveBtDraft(); });
  $$('#btNow [data-btguard]').forEach(b=> b.onclick=()=>{
    BT.guardGone[BT.me] = b.dataset.btguard==='1'; PC.clearMatchupCache(); btNowRender(); saveBtDraft(); });
  const inp=$('#btHp');
  if(inp) inp.oninput=()=>{ BT.hp[BT.me]=Math.max(0,Math.min(maxHP,+inp.value|0));
    const pos=inp.selectionStart; btNowRender(); const i2=$('#btHp');
    if(i2){ i2.focus(); try{i2.setSelectionRange(pos,pos);}catch(e){} } saveBtDraft(); };
  btBindSeen(); btBindBoard();
}

/* ---------- 盤面の状態 ----------
   積み技・天候・状態異常・壁・設置技。計算エンジンは前から対応していたのに、
   画面から渡していなかったので数字が嘘になっていた（2026-08-19 の棚卸しで判明）。
   例：相手がつるぎのまいを1回積むだけで被ダメージは 46〜73% → 93〜143% に変わる。
   試合中にタップ数を増やさないよう、既定は閉じておき、使う時だけ開く。 */
const BOARD_RANKS = [-2,-1,0,1,2,3,4,5,6];
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
      ${rankRow('相手の攻撃','opAtkRank')}
      ${rankRow('相手の素早さ','opSpeRank')}
      ${rankRow('自分の攻撃','myAtkRank')}
      ${rankRow('自分の防御','myDefRank')}
      <div class="hpwrap"><span class="small muted" style="min-width:96px">天候</span>
        <div class="quick">${['','にほんばれ','あめ','すなあらし','ゆき'].map(w=>
          chip(w||'なし','weather',w,(st.weather||'')===w)).join('')}</div></div>
      <div class="hpwrap"><span class="small muted" style="min-width:96px">状態異常</span>
        <div class="quick">
          ${chip('相手がやけど','opBurn',1,!!st.opBurn)}
          ${chip('相手がまひ','opParalysis',1,!!st.opParalysis)}
          ${chip('自分がやけど','myBurn',1,!!st.myBurn)}
          ${chip('自分がまひ','myParalysis',1,!!st.myParalysis)}</div></div>
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
  $$('#btNow [data-bbstep]').forEach(b=> b.onclick=()=>{
    const k=b.dataset.bbstep, d=+b.dataset.bv;
    const cur = BT.board[k]||0;
    BT.board[k] = d===0 ? 0 : Math.max(-6, Math.min(6, cur + d));   // 真ん中を押すと0に戻る
    if(!BT.board[k]) delete BT.board[k];
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  });
  $$('#btNow [data-bb]').forEach(b=> b.onclick=()=>{
    const k=b.dataset.bb, raw=b.dataset.bv;
    const v = (k==='weather') ? raw : (+raw);
    if(k==='weather') BT.board[k] = (BT.board[k]===v ? '' : v);
    else if(BOARD_RANKS.includes(v) && /Rank$/.test(k)) BT.board[k] = v;
    else BT.board[k] = BT.board[k] ? 0 : 1;          // トグル
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  });
  const r=$('#btNow [data-bbreset]');
  if(r) r.onclick=()=>{ BT.board={}; PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft(); };
}

/* ---------- 相手が使ってきた技をワンタップで記録 ----------
   社長の要望：「相手が採用してそうな技を10個くらい出して、打ってきた技を記録していく」
   技は4つまでなので、4つ記録できた時点で「それ以外は飛んでこない」が確定し、判定が一気に正確になる。 */
function btSeenCard(oppName, seen){
  const o = effOpp(oppName);
  const ch = PC.oppMoveChoices(o);
  const extra = seen.filter(m=> !ch.some(c=>c.name===m));
  const n = seen.length, conf = n>=4;
  if(!ch.length && !extra.length) return '';
  return `<div class="card">
    <h2>相手が使ってきた技<span class="sub">タップで記録 ${n}/4</span></h2>
    <div class="small ${conf?'':'muted'}" style="margin-bottom:8px">
      ${conf ? '<b style="color:var(--grn)">4つ確定。これ以外は飛んできません。上の判定はこの4つだけで計算しています。</b>'
             : `記録するほど判定が正確になります。あと${4-n}つで確定。`}
    </div>
    <div class="quick">
      ${ch.map(c=>`<button class="qb ${seen.includes(c.name)?'on':'off'}" data-btseen="${esc(c.name)}">${esc(c.name)}<span class="muted"> ${c.rate}%</span></button>`).join('')}
      ${extra.map(m=>`<button class="qb on" data-btseen="${esc(m)}">${esc(m)}<span class="muted"> 手入力</span></button>`).join('')}
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
  return `<div class="small muted" style="margin-top:10px">
    自分の対戦での実績：${obs.map(x=>`${esc(x.move)}(${x.count}回)`).join('・')}</div>`;
}
function btBindSeen(){
  const key = BT.sel; if(!key) return;
  const set = m =>{
    BT.obs = BT.obs || {};
    const cur = BT.obs[key] = BT.obs[key] || [];
    const i = cur.indexOf(m);
    if(i>=0) cur.splice(i,1); else cur.push(m);
    if(!cur.length) delete BT.obs[key];
    PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft();
  };
  $$('#btNow [data-btseen]').forEach(b=> b.onclick=()=> set(b.dataset.btseen));
  const add=$('#btSeenAdd'), inp=$('#btSeenOther');
  if(add) add.onclick=()=>{ const v=(inp.value||'').trim(); if(!v) return;
    if(!PC.MOVES[v]) return toast('その技名は見つかりません',true); set(v); };
  const clr=$('#btSeenClear');
  if(clr) clr.onclick=()=>{ delete BT.obs[key]; PC.clearMatchupCache(); btCompute(); btRender(); saveBtDraft(); };
}
/** 実戦モードの観測・HPは、次に開いたときも残す */
function saveBtDraft(){
  try{ localStorage.setItem('pokechan_bt', JSON.stringify({obs:BT.obs, opp:BT.opp, hp:BT.hp, oppHp:BT.oppHp, megaFixed:BT.megaFixed, guardGone:BT.guardGone, board:BT.board})); }catch(e){}
}
function loadBtDraft(){
  try{ const d=JSON.parse(localStorage.getItem('pokechan_bt')||'{}');
    if(d.obs) BT.obs=d.obs; if(d.hp) BT.hp=d.hp; if(d.oppHp) BT.oppHp=d.oppHp;
    if(d.megaFixed) BT.megaFixed=d.megaFixed; if(d.guardGone) BT.guardGone=d.guardGone; if(d.board) BT.board=d.board; }catch(e){}
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

  ${warn.length?`<div class="card" style="border-color:var(--red);background:var(--redsoft)">
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
  autocomplete('#sfName','#sfNameSug', q=>{
    const hit=n=>!q||n.includes(q);
    return Object.keys(PC.SPECIES).filter(hit).sort((a,b)=>a.indexOf(q)-b.indexOf(q)||a.length-b.length).slice(0,12);
  }, n=>{ $('#sfName').value=n; sfSolveShow(); });
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
  fillTeamSelects(); renderOpp(); renderTeams(); renderHist(); renderStats();
  safe('対面', ()=>{ renderVsPickers(); renderVs(); }, '#vsOut');
  safe('実戦', ()=>{ btCompute(); btRender(); }, '#btGrid');
  if(!$('#mvlist2')){const dl2=document.createElement('datalist');dl2.id='mvlist2';
    dl2.innerHTML=MOVE_NAMES.map(m=>`<option value="${esc(m)}">`).join('');document.body.appendChild(dl2);}
}
boot();
