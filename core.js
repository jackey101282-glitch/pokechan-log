/* =========================================================
   ポケチャン バトルログ — 計算エンジン
   ・種族データ / 技データの読み込み
   ・実数値計算（Lv50・個体値31固定・SP制）
   ・タイプ相性
   ・ダメージ計算（第9世代準拠）
   ・選出スコアリング
   ========================================================= */
(function(global){
'use strict';

/* ---------- タイプ ---------- */
const TYPES = ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];

// 表示用カラー（白基調に合わせた淡いトーン）
/* ★タイプの配色（2026-08-21・v73）。社長の要望で**ポケモン本編と同じ配色**に合わせた。
   「エスパーとかフェアリーが分からなくなる瞬間がある。色とアイコンを統一したい」
   出典の画像そのもの（ポケモン社の著作物）は使わず、**配色と形だけを合わせた自作SVG**にしてある。
   公開リポジトリに置くため、画像アセットのコピーは避ける。 */
const TYPE_COLOR = {
  ノーマル:'#9299a1', ほのお:'#f5892f', みず:'#3d9ae0', でんき:'#f5cf35', くさ:'#5cb95c',
  こおり:'#79d4d4', かくとう:'#e4526a', どく:'#a95fd0', じめん:'#d98a45', ひこう:'#8fb8ea',
  エスパー:'#f0788c', むし:'#9dc22a', いわ:'#cbbd93', ゴースト:'#6a6ab5', ドラゴン:'#3f8fdb',
  あく:'#4f5259', はがね:'#3fa5bd', フェアリー:'#f199d6'
};

// タイプアイコン（12x12 viewBox の SVG パス。外部画像を使わず自己完結）
/* タイプアイコン（12x12 viewBox の SVG パス。外部画像を使わず自己完結）。
   ★2026-08-21 に本編のシルエットへ寄せて描き直した。
   とくに社長が挙げた **エスパー（渦）** と **フェアリー（四方の輝き）** は形で区別できるようにしてある。 */
/* タイプアイコン（12x12 viewBox の SVG パス。外部画像を使わず自己完結）。
   ★2026-08-21 v74：本編（ソード/シールド・GO）のシルエットに寄せて描き直した。
   **公式の画像そのものは使わない**（著作物・公開リポジトリのため）。形と配色だけを合わせる。
   白1色のグリフ＋丸バッジ、という構成も本編と同じにしてある。 */
const TYPE_ICON = {
  // ノーマル：太いドーナツ
  ノーマル:'M6 1.15A4.85 4.85 0 1 0 6 10.85 4.85 4.85 0 0 0 6 1.15Zm0 2.9a1.95 1.95 0 1 1 0 3.9 1.95 1.95 0 0 1 0-3.9Z',
  // ほのお：外炎＋内炎（本編は炎が二重に見える）
  ほのお:'M6.55.6c.5 2.05-.55 2.9-1.6 3.9C3.85 5.55 3.1 6.5 3.1 7.75A2.9 2.9 0 0 0 6 11.4a2.9 2.9 0 0 0 2.9-3.65c-.05-1.15-.6-1.9-1.15-2.7-.25.6-.6 1-1.05 1.25C7.3 4.25 7 2.25 6.55.6Z',
  // みず：しずく（上が尖り下が丸い）
  みず:'M6 .75C3.9 3.5 2.6 5.3 2.6 7.05A3.4 3.4 0 0 0 6 10.5a3.4 3.4 0 0 0 3.4-3.45C9.4 5.3 8.1 3.5 6 .75Z',
  // でんき：稲妻
  でんき:'M8.1.6 2.75 6.85h2.6L4.15 11.4 9.5 4.9H6.9L8.1.6Z',
  // くさ：葉＋葉脈
  くさ:'M10.8.95C5.6.6 2.05 2.6 1.65 6.35c-.2 2 .65 3.55 2 4.6.3-2.95 1.8-5.15 4.45-6.4-2.2 1.5-3.7 3.5-4 6.65 4.3.75 7.05-3.15 6.7-10.25Z',
  // こおり：6方向の結晶＋先端の枝
  こおり:'M5.3 1.4H6.7V10.6H5.3ZM7.69 10.33L8.91 9.63L4.31 1.67L3.09 2.37ZM3.09 9.63L4.31 10.33L8.91 2.37L7.69 1.67Z',
  // かくとう：拳（指の割れ目つき）
  かくとう:'M2.9 5.4c0-.5.4-.95.9-.95h4.4c.5 0 .9.45.9.95v1.5A3.3 3.3 0 0 1 6 10.2 3.3 3.3 0 0 1 2.9 6.9V5.4ZM3.9 2.6c0-.4.3-.7.7-.7s.7.3.7.7v1.85H3.9V2.6ZM5.6 2.1c0-.4.3-.7.7-.7s.7.3.7.7v2.35H5.6V2.1ZM7.3 2.9c0-.4.3-.7.7-.7s.7.3.7.7v1.55H7.3V2.9ZM2.35 6.05c-.35 0-.65.3-.65.7s.3.7.65.7h.55v-1.4h-.55Z',
  // どく：毒のしずく（丸い本体＋垂れ）
  どく:'M6 1.1c-1.9 0-3.4 1.5-3.4 3.35 0 1.55 1.05 2.85 2.5 3.25v.6c0 .3.25.55.55.55h.7c.3 0 .55-.25.55-.55v-.6c1.45-.4 2.5-1.7 2.5-3.25C9.4 2.6 7.9 1.1 6 1.1Zm-1.35 2.2c.5 0 .9.45.9 1s-.4 1-.9 1-.9-.45-.9-1 .4-1 .9-1Zm2.7 0c.5 0 .9.45.9 1s-.4 1-.9 1-.9-.45-.9-1 .4-1 .9-1ZM6 9.35c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1Z',
  // じめん：3つの山
  じめん:'M6 2 8.65 6.5H3.35L6 2Zm-3.1 5.3h6.2L11 10.3H1l1.9-3Z',
  // ひこう：翼
  ひこう:'M.9 6.75c2.55-.35 4.25-1.4 5.5-3.1.55-.75 1.5-1.2 2.5-1.2.95 0 1.7.5 1.7 1.2 0 .6-.5 1.05-1.15 1.15.5.2.85.6.85 1.15 0 .95-.95 1.6-2.25 1.6-.6 0-1.2-.15-1.7-.4-.85.85-2.1 1.45-3.8 1.65L.9 6.75Z',
  // エスパー：渦（内側に巻き込む）
  エスパー:'M6 .95A5.05 5.05 0 0 0 .95 6c0 2 1.6 3.6 3.6 3.6 1.6 0 2.9-1.3 2.9-2.9 0-1.3-1.05-2.35-2.35-2.35-1 0-1.8.8-1.8 1.8 0 .75.6 1.35 1.35 1.35.3 0 .55-.1.75-.3-.1.55-.6.95-1.2.95-.95 0-1.7-.75-1.7-1.7 0-1.4 1.1-2.5 2.5-2.5 1.75 0 3.15 1.4 3.15 3.15 0 2-1.6 3.6-3.6 3.6h-.2A5.05 5.05 0 1 0 6 .95Z',
  // むし：虫（触角＋胴＋節）
  むし:'M3.75 1.05l.9-.6 1.25 1.75-.9.6-1.25-1.75ZM8.25 1.05l-.9-.6-1.25 1.75.9.6 1.25-1.75ZM6 2.15a1.35 1.35 0 1 1 0 2.7 1.35 1.35 0 0 1 0-2.7ZM6 4.5c-1.4 0-2.5 1.25-2.5 3v.7c0 1.75 1.1 3 2.5 3s2.5-1.25 2.5-3v-.7c0-1.75-1.1-3-2.5-3Z',
  // いわ：角ばった岩の重なり
  いわ:'M4.3 2.2h3.4l1.9 2.5-1.1 1.2H3.5L2.4 4.7 4.3 2.2Zm-1.8 4.5h7l1.6 3.1H.9l1.6-3.1Z',
  // ゴースト：おばけ
  ゴースト:'M6 .95A4 4 0 0 0 2 4.95v5.85l1.35-1.15 1.3 1.15L6 9.65l1.35 1.15 1.3-1.15L10 10.8V4.95a4 4 0 0 0-4-4ZM4.6 3.95c.45 0 .8.45.8 1s-.35 1-.8 1-.8-.45-.8-1 .35-1 .8-1Zm2.8 0c.45 0 .8.45.8 1s-.35 1-.8 1-.8-.45-.8-1 .35-1 .8-1Z',
  // ドラゴン：竜の頭（角＋牙）
  ドラゴン:'M10.6 1.5c-1.2.15-2.25.6-3.1 1.35L6 1.35 4.5 2.85C3.4 2.1 2.2 1.65.9 1.5c.5 1.25 1.35 2.3 2.5 3.05-.4.65-.6 1.4-.6 2.2A3.6 3.6 0 0 0 6.4 10.35 3.6 3.6 0 0 0 10 6.75c0-.7-.2-1.35-.55-1.9 1.1-.7 1.9-1.8 2.35-3.05-.4-.15-.8-.25-1.2-.3ZM4.8 5.6c.45 0 .8.4.8.9s-.35.9-.8.9-.8-.4-.8-.9.35-.9.8-.9Zm1.6 2.55 1.5 1.05H4.9l1.5-1.05Z',
  // あく：三日月
  あく:'M8.6 1.05a4.95 4.95 0 1 0 1.35 9.05 4.05 4.05 0 0 1-1.35-9.05Z',
  // はがね：六角ナット（外六角＋内六角）
  はがね:'M6 .9 1.75 3.45v5.1L6 11.1l4.25-2.55v-5.1L6 .9Zm0 2.55 2.15 1.3v2.5L6 8.55 3.85 7.25v-2.5L6 3.45Z',
  // フェアリー：四方の輝き
  フェアリー:'M6 .8 7.15 3.5 9.9 2.1 8.5 4.85 11.2 6l-2.7 1.15 1.4 2.75-2.75-1.4L6 11.2 4.85 8.5 2.1 9.9l1.4-2.75L.8 6l2.7-1.15L2.1 2.1l2.75 1.4L6 .8Zm0 3.4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z'
};

// 攻撃タイプ → {防御タイプ: 倍率}
const CHART = {};
(function(){
  const spec = {
    'ノーマル':      [[],['いわ','はがね'],['ゴースト']],
    'ほのお':        [['くさ','こおり','むし','はがね'],['ほのお','みず','いわ','ドラゴン'],[]],
    'みず':          [['ほのお','じめん','いわ'],['みず','くさ','ドラゴン'],[]],
    'でんき':        [['みず','ひこう'],['でんき','くさ','ドラゴン'],['じめん']],
    'くさ':          [['みず','じめん','いわ'],['ほのお','くさ','どく','ひこう','むし','ドラゴン','はがね'],[]],
    'こおり':        [['くさ','じめん','ひこう','ドラゴン'],['ほのお','みず','こおり','はがね'],[]],
    'かくとう':      [['ノーマル','こおり','いわ','あく','はがね'],['どく','ひこう','エスパー','むし','フェアリー'],['ゴースト']],
    'どく':          [['くさ','フェアリー'],['どく','じめん','いわ','ゴースト'],['はがね']],
    'じめん':        [['ほのお','でんき','どく','いわ','はがね'],['くさ','むし'],['ひこう']],
    'ひこう':        [['くさ','かくとう','むし'],['でんき','いわ','はがね'],[]],
    'エスパー':      [['かくとう','どく'],['エスパー','はがね'],['あく']],
    'むし':          [['くさ','エスパー','あく'],['ほのお','かくとう','どく','ひこう','ゴースト','はがね','フェアリー'],[]],
    'いわ':          [['ほのお','こおり','ひこう','むし'],['かくとう','じめん','はがね'],[]],
    'ゴースト':      [['エスパー','ゴースト'],['あく'],['ノーマル']],
    'ドラゴン':      [['ドラゴン'],['はがね'],['フェアリー']],
    'あく':          [['エスパー','ゴースト'],['かくとう','あく','フェアリー'],[]],
    'はがね':        [['こおり','いわ','フェアリー'],['ほのお','みず','でんき','はがね'],[]],
    'フェアリー':    [['かくとう','ドラゴン','あく'],['ほのお','どく','はがね'],[]]
  };
  TYPES.forEach(a=>{
    CHART[a] = {}; TYPES.forEach(d=> CHART[a][d] = 1);
    const [x2,h,z] = spec[a];
    x2.forEach(d=>CHART[a][d]=2); h.forEach(d=>CHART[a][d]=0.5); z.forEach(d=>CHART[a][d]=0);
  });
})();

/** 攻撃タイプが防御側タイプ配列に対して何倍か */
function effectiveness(atkType, defTypes){
  if(!CHART[atkType]) return 1;
  return (defTypes||[]).reduce((m,t)=> m * (CHART[atkType][t]!==undefined ? CHART[atkType][t] : 1), 1);
}

/* ---------- 性格（能力補正） ---------- */
const NATURES = {
  'がんばりや':[null,null],'すなお':[null,null],'てれや':[null,null],'まじめ':[null,null],'きまぐれ':[null,null],
  'さみしがり':['a','b'],'ゆうかん':['a','s'],'いじっぱり':['a','c'],'やんちゃ':['a','d'],
  'ずぶとい':['b','a'],'のんき':['b','s'],'わんぱく':['b','c'],'のうてんき':['b','d'],
  'ひかえめ':['c','a'],'おっとり':['c','b'],'れいせい':['c','s'],'うっかりや':['c','d'],
  'おだやか':['d','a'],'おとなしい':['d','b'],'しんちょう':['d','c'],'なまいき':['d','s'],
  'おくびょう':['s','a'],'せっかち':['s','b'],'ようき':['s','c'],'むじゃき':['s','d']
};

/* ---------- 種族・技データ ---------- */
const SPECIES = {};   // 名前 -> {name, types:[], base:{h,a,b,c,d,s}}
const MOVES   = {};   // 名前 -> {name, type, cat:'物|特|変', power, acc, pp, contact}

function loadData(){
  (global.SPECIES_CSV||'').split('\n').forEach(line=>{
    const p = line.split(','); if(p.length < 8) return;
    SPECIES[p[0]] = { name:p[0], types:p[1].split('/'),
      base:{h:+p[2], a:+p[3], b:+p[4], c:+p[5], d:+p[6], s:+p[7]} };
  });
  (global.MOVES_CSV||'').split('\n').forEach(line=>{
    const p = line.split(','); if(p.length < 7) return;
    MOVES[p[0]] = { name:p[0], type:p[1], cat:p[2],
      power: p[3]==='-' ? null : +p[3],
      acc:   p[4]==='-' ? null : +p[4],
      pp:+p[5], contact: p[6]==='1' };
  });
  Object.assign(USAGE, global.USAGE_M5 || {});
  Object.assign(TEAMSTOP, global.TEAMS_TOP || {});
  buildMegaMap();
}

/* ---------- 上位構築の同居データ ----------
   出典: champs.pokedb.tokyo の公開データ（M-4・M-3 シングル 計517構築）。app/data/teams.js
   使い道は2つ。
   ① 相手6体の入力を速くする（選出は90秒しかない）
   ② まだ見えていない枠を予測する（見せ合いで全部見えていても、型の想定に効く） */
const TEAMSTOP = {};
function teamData(name){ return TEAMSTOP[name] || TEAMSTOP[BASE_OF[name]] || null; }
/** そのポケモンと一緒に使われやすい相手（同居率%つき） */
function partnersOf(name){
  const t = teamData(name); if(!t) return [];
  return t.w.map(([n,r])=>({name:n, rate:r}));
}
/** 上位構築での持ち物分布（構築文脈込み） */
function teamItemsOf(name){
  const t = teamData(name); if(!t) return [];
  return t.i.map(([n,r])=>({name:n, rate:r}));
}
/** すでに見えている相手から、残りの枠に来そうなポケモンを予測する。
 *  スコア＝見えている各体との同居率の合計（すでに見えているものは除く）。 */
function predictRest(seen, limit){
  const have = new Set((seen||[]).map(n=> BASE_OF[n] || n));
  const sc = {};
  (seen||[]).forEach(n=>{
    partnersOf(n).forEach(p=>{
      const key = p.name;
      if(have.has(key) || have.has(BASE_OF[key]||key)) return;
      sc[key] = (sc[key]||0) + p.rate;
    });
  });
  return Object.entries(sc).sort((a,b)=> b[1]-a[1]).slice(0, limit||8)
    .map(([name, score])=>({ name, score: Math.round(score),
      // 見えている何体と同居しやすいか
      with: (seen||[]).filter(n=> partnersOf(n).some(p=>p.name===name)) }));
}

/* ---------- 相手の実データ（シーズンM-5 シングル使用率） ----------
   出典: https://champs.pokedb.tokyo/pokemon/show/<id>?rule=0（app/data/usage.js）
   ここが無かったせいで、相手の打点を「タイプ一致・威力90」で見積もっていた。
   カイリューの最多採用技は かえんほうしゃ63.8% / りゅうせいぐん54.7% で、
   どちらもタイプ一致・威力90ではない。2026-08-19 に3体を一撃で失った直接原因。 */
const USAGE = {};
/** 相手の使用率データ。メガは元の姿のデータを引く（メガカイリュー -> カイリュー） */
/* ★試合中に見えた相手の持ち物を「確定」として扱う（2026-08-21・v79・社長の要望）。
   「相手がいのちのたまとかせんせいのツメとか持ってたりして計算が狂う時がある。
     毎回じゃないけど登録できたらいいな」
   ＝ 持ち物は使用率からの**推測**でしかなく、外れると打数がまるごとズレる。
     いのちのたまなら×1.3、こだわりスカーフなら素早さ×1.5、タスキなら1発耐える。

   ★仕掛けは1か所だけ。`oppUsage()` が返す持ち物リスト `i` を差し替える。
     こうすると oppOffenseItem / oppTypeItem / oppOneHitGuard / oppScarfRate /
     oppItemCandidates / assumedSpreads(スカーフ型) が**全部まとめて**確定側で動く
     （同じ判定を何か所にも書かない＝鉄則⑤）。
   ★状態を持つので、**画面ごとに必ず setOppItems() で宣言し直すこと。**
     実戦タブは BT.oppItem を、対面タブ・ダメージ計算タブは空を入れる。 */
let ITEM_FIX = {}, _itemUsageCache = {};
/** map = {相手名: '持ち物' or 'なし'}。画面ごとに丸ごと入れ替える */
function setOppItems(map){
  ITEM_FIX = map || {};
  _itemUsageCache = {};
}
function oppItemFixed(name){ return ITEM_FIX[name] || ITEM_FIX[BASE_OF[name]] || null; }
/** 確定を無視した、素の持ち物採用率。ボタンの候補を作るのに使う（確定側を見ると1件になってしまう） */
function oppItemsRaw(name){
  const u = USAGE[name] || USAGE[BASE_OF[name]] || null;
  return (u && u.i) ? u.i.map(([n,r])=>({name:n, rate:r})) : [];
}
function oppUsage(name){
  const u = USAGE[name] || USAGE[BASE_OF[name]] || null;
  if(!u) return null;
  const fix = oppItemFixed(name);
  if(!fix) return u;
  const key = name + '|' + fix;
  if(_itemUsageCache[key]) return _itemUsageCache[key];       // 同一性を保つ（毎回作り直さない）
  return _itemUsageCache[key] = {...u, i: (fix==='なし' ? [] : [[fix, 100]])};
}
/** 相手が実際に撃ってくる攻撃技（採用率つき）。無ければ null */
function oppMoves(name, minRate){
  const u = oppUsage(name); if(!u) return null;
  const th = minRate==null ? 10 : minRate;
  const list = u.m.filter(m=> m[3]!=='変' && m[4] > 0 && m[1] >= th)
    .map(m=>({ name:m[0], rate:m[1], type:m[2], cat:m[3], power:m[4],
               contact: (MOVES[m[0]] ? MOVES[m[0]].contact : false) }));
  return list.length ? list : null;
}
/** 試合中に観測した「相手が実際に撃ってきた技」を、計算に使える形にする。
 *  技は最大4つなので、4つ観測できたら full=true（それ以外の技は存在しない）。 */
function confirmedMoves(oppName, known){
  if(!known || !known.length) return null;
  const list = known.map(n=>{
    const m = MOVES[n]; if(!m || !m.power || m.cat==='変') return null;
    return { name:m.name, type:m.type, cat:m.cat, power:m.power, contact:m.contact, rate:null, confirmed:true };
  }).filter(Boolean);
  // 変化技も「技枠を1つ使った」事実としては効くので、枠数は観測した技の総数で数える
  return { list, full: known.length >= 4, count: known.length };
}
function dedupeMoves(list){
  const seen = new Set(), out = [];
  list.forEach(m=>{ if(seen.has(m.name)) return; seen.add(m.name); out.push(m); });
  return out;
}

/** 試合中に「相手が撃ってきた技」をワンタップで記録するための選択肢。
 *  変化技も含めた採用率上位（＝実際に使われている技）をそのまま返す。 */
function oppMoveChoices(name){
  const u = oppUsage(name);
  if(!u) return [];
  return u.m.map(m=>({ name:m[0], rate:m[1], type:m[2], cat:m[3], power:m[4] }))
           .sort((a,b)=> b.rate - a.rate);
}

/* ---------- 役割の推定 ----------
   社長の要望（2026-08-19）：
   「この特性でこの振り方をしているこのポケモンは大体この技を覚えているよねとか、
     このパーティーの中のこのポケモンはこういう戦い方・役割を持っているよねが分かってくると、
     対策がよりしやすくなる」
   採用率の実データ（技・持ち物・SP振り）から機械的に出す。推測ではなく、根拠の数字を必ず添える。 */
const ROLE_RULES = [
  { role:'起点作り',   why:'場を作ってから後続につなぐ', moves:['ステルスロック','まきびし','どくびし','ねばねばネット','おいかぜ','リフレクター','ひかりのかべ','オーロラベール'] },
  { role:'流し役',     why:'こちらの積みを流す・眠らせる', moves:['あくび','ふきとばし','ドラゴンテール','ほえる','ともえなげ','うずしお'] },
  { role:'受け',       why:'回復して居座る。削り切れないと粘られる', moves:['じこさいせい','ねがいごと','はねやすめ','なまける','つきのひかり','タマゴうみ','ミルクのみ','ねむる','ソフトボール'] },
  { role:'積みエース', why:'1回積まれると止まらなくなる', moves:['つるぎのまい','りゅうのまい','めいそう','わるだくみ','てっぺき','ビルドアップ','からをやぶる','ちょうのまい','コットンガード','のろい','ロックカット'] },
  { role:'サイクル',   why:'殴って引く。有利対面を作り直してくる', moves:['とんぼがえり','ボルトチェンジ','クイックターン','しおふき'] },
  { role:'搦め手',     why:'状態異常で機能停止させてくる', moves:['どくどく','おにび','でんじは','キノコのほうし','ちょうはつ','アンコール','みがわり'] },
  { role:'先制技持ち', why:'瀕死圏で殴ると持っていかれる', moves:['ふいうち','かげうち','しんそく','バレットパンチ','マッハパンチ','こおりのつぶて','アクアジェット','でんこうせっか'] }
];
/** その相手の「役割」を実データから推定する。根拠（技名と採用率）つき */
function rolesOf(name){
  const u = oppUsage(name); if(!u) return [];
  const out = [];
  ROLE_RULES.forEach(rule=>{
    const hit = (u.m||[]).filter(m=> rule.moves.includes(m[0]) && m[1] >= 20)
                         .map(m=>({move:m[0], rate:m[1]}))
                         .sort((a,b)=> b.rate - a.rate);
    if(hit.length) out.push({ role:rule.role, why:rule.why, evidence:hit,
                              // いちばん採用率の高い根拠technique＝その役割の確からしさ
                              rate: hit[0].rate });
  });
  // 持ち物からも足す
  const it = (u.i||[]);
  const has = (n,th)=> it.some(x=> x[0]===n && x[1]>= (th||20));
  if(has('こだわりスカーフ',20)) out.push({role:'スカーフで上を取る', why:'素早さの想定がひっくり返る',
    evidence:[{move:'こだわりスカーフ', rate: it.find(x=>x[0]==='こだわりスカーフ')[1]}],
    rate: it.find(x=>x[0]==='こだわりスカーフ')[1]});
  if(has('きあいのタスキ',20)) out.push({role:'タスキで1発耐える', why:'確定1発が確定2発になる',
    evidence:[{move:'きあいのタスキ', rate: it.find(x=>x[0]==='きあいのタスキ')[1]}],
    rate: it.find(x=>x[0]==='きあいのタスキ')[1]});
  if(has('とつげきチョッキ',20)) out.push({role:'チョッキで特殊を受ける', why:'特殊技が通らない',
    evidence:[{move:'とつげきチョッキ', rate: it.find(x=>x[0]==='とつげきチョッキ')[1]}],
    rate: it.find(x=>x[0]==='とつげきチョッキ')[1]});
  return out.sort((a,b)=> b.rate - a.rate);
}

/** 相手の持ち物のうち、その分類の打点をいちばん上げるもの（採用率 minRate% 以上）。
 *  メガシンカ後はメガストーンを持っているので打点アイテムは無い。 */
const OFFENSE_ITEMS = { 'こだわりハチマキ':'物', 'こだわりメガネ':'特', 'いのちのたま':'両', 'たつじんのおび':'両' };
/* タイプ強化アイテム（そのタイプの技だけ×1.2）。実データで採用率が高いものだけ載せる。
   例: ドドゲザン くろいメガネ51.5% / ダイケンキ(ヒスイ) くろいメガネ46.4% */
const TYPE_ITEMS = {
  'くろいメガネ':'あく','しんぴのしずく':'みず','ようせいのハネ':'フェアリー','もくたん':'ほのお',
  'きせきのタネ':'くさ','まがったスプーン':'エスパー','とけないこおり':'こおり','じしゃく':'でんき',
  'するどいくちばし':'ひこう','どくバリ':'どく','やわらかいすな':'じめん','かたいいし':'いわ',
  'ぎんのこな':'むし','のろいのおふだ':'ゴースト','りゅうのキバ':'ドラゴン','メタルコート':'はがね',
  'くろおび':'かくとう','シルクのスカーフ':'ノーマル'
};
/** 相手の持ち物のうち、その技のタイプを強化するもの（採用率25%以上） */
function oppTypeItem(name, moveType, minRate){
  if(name.startsWith('メガ')) return '';
  const u = oppUsage(name); if(!u) return '';
  const th = minRate==null ? 25 : minRate;
  const hit = (u.i||[]).find(([it,rate])=> rate>=th && TYPE_ITEMS[it]===moveType);
  return hit ? hit[0] : '';
}
function oppOffenseItem(name, cat, minRate){
  if(name.startsWith('メガ')) return '';
  const u = oppUsage(name); if(!u) return '';
  const th = minRate==null ? 25 : minRate;
  let best='', rank=-1;
  const power = { 'こだわりハチマキ':3, 'こだわりメガネ':3, 'いのちのたま':2, 'たつじんのおび':1 };
  (u.i||[]).forEach(([it,rate])=>{
    const k = OFFENSE_ITEMS[it]; if(!k || rate < th) return;
    if(k!=='両' && k!==cat) return;
    if(power[it] > rank){ rank = power[it]; best = it; }
  });
  return best;
}
/** こだわりスカーフの採用率(%)。行動順がひっくり返るので型の想定に足す */
/* ★連続技（2026-08-21 追加・v55）。
   これを入れていなかったせいで、実戦2敗の原因を作った。
   マスカーニャの トリプルアクセル を「威力20の1発」として計算していたため、
   カイリュー vs マスカーニャ が「◎殴る（負ける型が無い）」と表示されていた。
   実際は 20→40→60 の3連撃（合計120相当）で、こおり4倍のカイリューは一撃で落ちる。
   社長は試合3でカバルドンとカイリューを同時に失っている。
   ゲッコウガの みずしゅりけん（威力15×2〜5回＋先制）も同じ理由で3分の1に過小評価していた。

   avg = 実戦で期待できる合計威力の倍率／max = 全段当たったときの倍率（一撃判定に使う）
   2〜5回の技は 2:35% 3:35% 4:15% 5:15% なので期待値3.1回。
   ネズミざん は10連撃だが1段ごとに命中90%判定なので期待値は約5.9回（0.9の累積）。

   ★もう一つ重要な性質：連続技は1段目で
     きあいのタスキ／ばけのかわ／がんじょう／マルチスケイル(満タン) を剥がし、
     残りの段でそのまま殴ってくる。「1発耐える」は連続技には通用しない。 */
const MULTI_HIT = {
  'トリプルアクセル':{avg:6.0, max:6.0, n:3,  why:'3連撃（威力20→40→60）'},
  'みずしゅりけん': {avg:3.1, max:5.0, n:'2〜5', why:'2〜5連撃・先制'},
  'つららばり':     {avg:3.1, max:5.0, n:'2〜5', why:'2〜5連撃'},
  'タネマシンガン': {avg:3.1, max:5.0, n:'2〜5', why:'2〜5連撃'},
  'ミサイルばり':   {avg:3.1, max:5.0, n:'2〜5', why:'2〜5連撃'},
  'ロックブラスト': {avg:3.1, max:5.0, n:'2〜5', why:'2〜5連撃'},
  'ボーンラッシュ': {avg:3.1, max:5.0, n:'2〜5', why:'2〜5連撃'},
  'スイープビンタ': {avg:3.1, max:5.0, n:'2〜5', why:'2〜5連撃'},
  'ネズミざん':     {avg:5.9, max:10.0,n:'最大10', why:'最大10連撃'},
  /* ★2026-08-21 追加。**v55 で連続技を直したときの登録漏れ**。
     威力50の単発として計算されていたため、カイリュー（マルチスケイル）に対して
     28〜33% と表示していた。実際は83〜99%＝ほぼ一撃。
     社長は「◎殴る」と言われて初手カイリューを出し、先制ドラゴンアローで即死している。 */
  'ドラゴンアロー': {avg:2.0, max:2.0, n:2,  why:'2連撃'},
  'ダブルウイング': {avg:2.0, max:2.0, n:2,  why:'2連撃'},
  'ダブルアタック': {avg:2.0, max:2.0, n:2,  why:'2連撃'}
};
/** 連続技ならその情報を返す。単発技なら null */
function multiHitOf(name){ return (name && MULTI_HIT[name]) || null; }

/** 相手が「1発耐える」手段を持っている割合。
 *  社長の実戦（2026-08-20）：
 *   ・トリデプス（がんじょう80.5%）にカイリューのじしんが1残り → そのターンで返り討ち
 *   ・マンムー（きあいのタスキ83.9%）にルカリオのインファイトが1残り → じしんを食らう
 *  こちら側のタスキ／がんじょうは `myOneHitGuard` で見ていたのに、
 *  **相手側は一切見ていなかった**。「1発で落とせる」は嘘になり、そこで試合が壊れる。 */
function oppOneHitGuard(name){
  if(name.startsWith('メガ')) return null;      // メガはメガストーン固定なのでタスキを持てない
  const u = oppUsage(name); if(!u) return null;
  const sash = (u.i||[]).find(x=> x[0]==='きあいのタスキ');
  const ab   = (u.a||[]).find(x=> x[0]==='がんじょう');
  const cand = [];
  if(sash && sash[1] >= 20) cand.push({name:'きあいのタスキ', rate:sash[1]});
  if(ab   && ab[1]   >= 20) cand.push({name:'がんじょう',   rate:ab[1]});
  if(!cand.length) return null;
  return cand.sort((a,b)=> b.rate-a.rate)[0];
}
/* ★相手の「攻撃に効く特性」（2026-08-21 追加・v56）。
   これまで bestThreat は attacker.ability に空文字を渡していた。つまり
   **相手の攻撃特性を一度も計算に入れていなかった**。影響が大きいのは次の3つ：
     ・へんげんじざい … 撃った技がそのままタイプ一致になる（×1.5）。
       マスカーニャ(80.2%)・ゲッコウガ(88.1%)。社長がいちばん苦しんでいる2体がこれ。
       マスカーニャの トリプルアクセル は こおり技＝本来は一致しないので、丸ごと1.5倍を落としていた。
     ・てきおうりょく … タイプ一致が ×1.5 → ×2。イダイトウ♂(96.2%)・ドラミドロ(69.5%)
     ・テクニシャン … 威力60以下が ×1.5。ハッサム(98.7%)・イッカネズミ(95.1%)。
       イッカネズミの ネズミざん(威力20・最大10連撃) は、テクニシャンと連続技の両方を落としていた。
   採用率20%以上のものだけを見る。根拠として名前と採用率を返す。 */
const OFF_ABILITY = ['へんげんじざい','リベロ','てきおうりょく','テクニシャン','スナイパー','ちからずく'];
function oppAtkAbility(name){
  const u = oppUsage(name); if(!u || !u.a) return null;
  const hit = (u.a||[]).filter(x=> OFF_ABILITY.includes(x[0]) && x[1] >= 20)
                       .sort((a,b)=> b[1]-a[1])[0];
  return hit ? {name:hit[0], rate:hit[1]} : null;
}
/* ★「見えていない技」を、ツール自身に申告させる（2026-08-21・v56）。
   社長は試合6で、マスカーニャの **かわらわり** でメガルカリオを失っている。
   ところが使用率データにあるマスカーニャの技は7つで、かわらわりは入っていない。
   つまりツールは「負ける型が無い＝◎」と、**見えていない技を無いものとして**言い切っていた。

   採用率の合計は「4スロット×100%＝400%」が上限なので、
   400% − (載っている技の採用率合計) が「データに載っていない技スロットの個数」になる。
   マスカーニャは 0.43個、エモンガは 0.81個ぶんが見えていない。

   これを消すことはできない（データの上限）ので、**言い切らないための材料として出す**。
   とくに へんげんじざい／リベロ の相手は、見えていない技もタイプ一致になるので危険度が上がる。 */
function unknownMoveSlots(name){
  const u = oppUsage(name); if(!u || !u.m) return null;
  const sum = u.m.reduce((a,b)=> a + (b[1]||0), 0);
  return Math.max(0, 4 - sum/100);
}
/* ★天候で素早さが2倍になる特性（2026-08-21・v58）。**丸ごと見ていなかった。**
   社長がハカドッグに負けた試合で表面化した。ハカドッグは **すなかき 67.1%**。
   そして社長の軸は **カバルドン（すなおこし）＝出た瞬間に砂が降る**。
   つまり **自分で相手を加速させている**のに、ツールは相手の素早さを砂なしのまま出していた。
   ハカドッグ S132 → 砂で **264**。メガルカリオ(164)は抜かれる。
   該当（採用率20%以上）：
     すなかき … ハカドッグ67.1%／ドリュウズ28.8%
     ようりょくそ … ウツボット94.6%／リーフィア90%／フシギバナ70.1%
     すいすい … ツンベアー38.5% */
/* 倒れた味方の数で威力が上がる技。データは初期威力しか持っていない */
const GRAVE_MOVES = {
  'おはかまいり':'倒れた味方1体につき威力+50（初期50）',
  'しっぺがえし':'後攻なら威力2倍'
};
/** おはかまいり系の実効威力。fallen = 相手側で倒れている数（0〜5） */
function graveMovePower(name, base, fallen){
  if(name !== 'おはかまいり') return base;
  return base + 50 * Math.max(0, Math.min(5, fallen||0));
}
/* ★積み技が何を何段上げるか（2026-08-21・v66・社長の要望）。
   「相手に何回積まれたかを加味できたら、結構戦いやすくなる」
   盤面には最初からランクの欄があったが、**手で数えて手で入れる**必要があった。
   相手の技をタップで記録する導線があるので、そこに積み技が入ったら**自動でランクに乗せる**。
   下げる方（からをやぶるの B/D −1 など）も入れないと過大評価になるので、まとめて持つ。 */
const STAT_UP = {
  'つるぎのまい':  {a:2},
  'りゅうのまい':  {a:1, s:1},
  'ビルドアップ':  {a:1, b:1},
  'めいそう':      {c:1, d:1},
  'ちょうのまい':  {c:1, d:1},
  'からをやぶる':  {a:2, c:2, s:2, b:-1, d:-1},
  'こうそくいどう':{s:2},
  'ロックカット':  {s:2},
  'てっぺき':      {b:2},
  'とける':        {b:2},
  'まるくなる':    {b:1},
  'とぐろをまく':  {a:1, b:1},
  'めいそう＋':    {c:1, d:1},
  'わるだくみ':    {c:2},
  'しっぽをふる':  {},
  'つめとぎ':      {a:1},
  'きあいだめ':    {},
  'にほんばれ':    {}
};
/** 積み技なら、盤面のランク（相手側）に足す差分を返す */
function statUpOf(move){ const u = STAT_UP[move]; return (u && Object.keys(u).length) ? u : null; }

/* ★こちらの技が「相手の特性で無効になる」可能性を、採用率つきで出す（2026-08-21・v71）。
   社長の要望：
   「自分がカバルドンのじしんを撃つとき、相手にふゆうを持たれてたら効かないよねとか、
     もらいび・ちょすいを持たれてたらこの技効かないよねとか。**可能性の話でいいので**
     それがあるかもって思うだけで戦い方を変えられる」
   これまでは `worstDefAbility()` で**最悪の1つ**を決め打ちして「無効」と出すだけで、
   **どのくらいの確率でそうなのか**を出していなかった。採用率つきで返す。 */
function moveBlockers(moveType, oppName){
  if(!moveType) return [];
  const u = oppUsage(toBase(oppName));
  const list = (u && u.a) ? u.a : (OPP_ABILITY[toBase(oppName)]||[]).map(a=>[a,null]);
  return list
    .filter(x=> IMMUNE_BY_ABILITY[x[0]] === moveType)
    .map(x=>({ability:x[0], rate:x[1]}))
    .sort((a,b)=> (b.rate||0)-(a.rate||0));
}
/** 相手6体のうち、このタイプの技を無効化する特性を持つ相手を集める */
function whoBlocks(moveType, oppNames){
  const out = [];
  (oppNames||[]).forEach(n=>{
    moveBlockers(moveType, n).forEach(b=> out.push({opp:n, ...b}));
  });
  return out.sort((a,b)=> (b.rate||0)-(a.rate||0));
}

const WEATHER_SPEED = {
  'すなあらし':'すなかき', 'にほんばれ':'ようりょくそ', 'あめ':'すいすい', 'ゆき':'ゆきかき'
};
/** その天候で素早さが2倍になる特性を持っているか。使用率データから採用率つきで返す */
function weatherSpeedAbility(name, weather){
  const want = WEATHER_SPEED[weather]; if(!want) return null;
  const u = oppUsage(name);
  if(u && u.a){
    const hit = (u.a||[]).find(x=> x[0]===want && x[1] >= 20);
    return hit ? {name:want, rate:hit[1]} : null;
  }
  // 使用率データが無い種は、既知の特性表で見る（採用率は出せない）
  const list = OPP_ABILITY[toBase(name)] || [];
  return list.includes(want) ? {name:want, rate:null} : null;
}

/* ★いかく（2026-08-21・v60）。**自動では効いていなかった。**
   盤面の「相手の攻撃 −1」を社長が手で押したときしか反映していなかったが、
   いかくは**場に出た瞬間に必ず発動する**。天候と同じで推測ではない。
   社長はギャラドス（いかく）を先発に置いて勝ち出しており、ツールの評価だけが低いままだった
   （実際に出てきた相手に対する「勝てる割合」が6匹中いちばん低い34%）。

   ただし2つの例外を必ず見る：
     ・無効化 … せいしんりょく（ブラッキー68.5%・ルカリオ87.2%）／どんかん（マンムー44.2%）
     ・**逆用** … まけんき／かちき は**攻撃が2段階上がる**。
       タイレーツ89.7%・エンペルト81.3%・ミロカロス70.4%・コノヨザル60.8%・ドドゲザン11.1%。
       ここにギャラドスを投げると、いかくのつもりが**相手を強化して**しまう。 */
const INTIMIDATE_BLOCK = ['せいしんりょく','どんかん','マイペース','あくしゅう'];
const INTIMIDATE_REVERSE = ['まけんき','かちき'];
/** いかくがこの相手にどう働くか。{kind:'down'|'none'|'up', ability, rate} */
function intimidateEffect(oppName){
  const u = oppUsage(oppName);
  const list = (u && u.a) ? u.a : (OPP_ABILITY[toBase(oppName)]||[]).map(a=>[a,null]);
  const rev = list.find(x=> INTIMIDATE_REVERSE.includes(x[0]) && (x[1]==null || x[1] >= 10));
  if(rev) return {kind:'up', ability:rev[0], rate:rev[1]};
  const blk = list.find(x=> INTIMIDATE_BLOCK.includes(x[0]) && (x[1]==null || x[1] >= 50));
  if(blk) return {kind:'none', ability:blk[0], rate:blk[1]};
  return {kind:'down'};
}

function oppScarfRate(name){
  if(name.startsWith('メガ')) return 0;
  const u = oppUsage(name); if(!u) return 0;
  const hit = (u.i||[]).find(x=> x[0]==='こだわりスカーフ');
  return hit ? hit[1] : 0;
}

/* ---------- 実数値計算 ----------
   本作は Lv50固定・個体値31固定・能力ポイント(SP)は実数値へ+1
   HP  = floor((種族値*2+31)/2) + 60 + SP
   他  = floor( (floor((種族値*2+31)/2) + 5 + SP) * 性格補正 )
   ※05_マイ構築の実数値と検算して一致を確認済み                       */
function statHP(base, sp){ return Math.floor((base*2+31)/2) + 60 + (sp||0); }
function statOther(base, sp, natureMod){
  return Math.floor((Math.floor((base*2+31)/2) + 5 + (sp||0)) * (natureMod||1));
}
function natureMods(nature){
  const m = {a:1,b:1,c:1,d:1,s:1};
  const n = NATURES[nature];
  if(n && n[0]){ m[n[0]] = 1.1; m[n[1]] = 0.9; }
  return m;
}
/** roster entry -> 実数値 {h,a,b,c,d,s} */
function realStats(name, sp, nature){
  const sp2 = sp||{}, sc = SPECIES[name];
  if(!sc) return null;
  const nm = natureMods(nature);
  return {
    h: statHP(sc.base.h, sp2.h),
    a: statOther(sc.base.a, sp2.a, nm.a),
    b: statOther(sc.base.b, sp2.b, nm.b),
    c: statOther(sc.base.c, sp2.c, nm.c),
    d: statOther(sc.base.d, sp2.d, nm.d),
    s: statOther(sc.base.s, sp2.s, nm.s)
  };
}
/** 相手の型が不明なときの想定値。kind: 'max'(補正+32振り) / 'none'(無振り) / 'hp'(H32)
 *  ※単一の能力を見るとき用。複数の能力を同時に'max'にすると
 *    SP合計66の上限を超えた「存在しない個体」になるので、
 *    相性判定には下の assumedSpreads() を使うこと。 */
function assumedStat(name, key, kind){
  const sc = SPECIES[name]; if(!sc) return null;
  if(key==='h') return statHP(sc.base.h, kind==='none'?0:32);
  const sp = (kind==='none') ? 0 : 32;
  const nm = (kind==='max') ? 1.1 : 1;
  return statOther(sc.base[key], sp, nm);
}

/* ---------- 相手の型の想定（SP合計66・1能力32が上限） ----------
   本作のSPは「合計66・1能力32」が上限（01_ゲーム基礎仕様）。
   6能力すべてを32振りにするのは物理的に不可能なので、
   現実にありうる2通りだけを想定し、両方で判定する。

   ・攻撃型：攻撃32(+性格補正) / S32 / 余り2をHへ
   ・耐久型：H32 / B17 / D17（補正は種族値の高い防御側）

   ふとん氏の実構築6匹（A32/B2/S32、H32/A2/B17/D15 など）とも整合する。
   ここを「全能力ぶっぱ」で見積もると相手の耐久を最大4割過大評価し、
   「押し切れない」という誤った結論が出るため、実戦の判断が歪む。 */
const SP_TOTAL = 66, SP_MAX = 32;

function spreadStats(name, sp, mod){
  const sc = SPECIES[name]; if(!sc) return null;
  return {
    h: statHP(sc.base.h, sp.h),
    a: statOther(sc.base.a, sp.a, mod.a),
    b: statOther(sc.base.b, sp.b, mod.b),
    c: statOther(sc.base.c, sp.c, mod.c),
    d: statOther(sc.base.d, sp.d, mod.d),
    s: statOther(sc.base.s, sp.s, mod.s)
  };
}

/** 種族値から「攻撃型らしさ」を 0〜1 で返す。どちらの想定を主に見せるかの判断だけに使う */
function attackerLikeness(name){
  const sc = SPECIES[name]; if(!sc) return 0.5;
  const b = sc.base;
  const atkiness = Math.max(b.a, b.c) + b.s * 0.8;
  const definess = (b.h + (b.b + b.d) / 2) * 0.9;
  return 1 / (1 + Math.exp(-(atkiness - definess) / 15));
}

/** 相手1体について、ありうる型（実数値つき）を返す。
 *  攻撃型は「攻撃に補正」と「素早さに補正（最速）」で行動順が変わるので分けて持つ。
 *  ふとん氏の6匹でも 攻撃補正3 : 素早さ補正2 に割れている。 */
/** 相手が物理型か特殊型か。使用率のSP振り・性格の実データを最優先し、無ければ種族値で判断。
 *  カイリューは種族値だとA134>C100で「物理」だが、実データは CS 51.6% / AS 10.5%、
 *  性格も ひかえめ41.7% で明確に特殊。ここを種族値で決めていたのが誤判定の根にあった。 */
function usagePhysical(name){
  const u = oppUsage(name);
  if(u){
    let a=0, c=0;
    (u.s||[]).forEach(([k,r])=>{ const t=k.split('+')[0]; if(t.includes('A')) a+=r; if(t.includes('C')) c+=r; });
    if(a+c >= 10) return a >= c;
    (u.n||[]).forEach(([k,r])=>{ const n=NATURES[k]; if(!n||!n[0]) return;
      if(n[0]==='a'||n[1]==='c') a+=r; if(n[0]==='c'||n[1]==='a') c+=r; });
    if(a+c >= 10) return a >= c;
  }
  const b = SPECIES[name].base;
  return b.a >= b.c;
}

function assumedSpreads(name){
  const sc = SPECIES[name]; if(!sc) return [];
  const b = sc.base;
  const phys   = usagePhysical(name);
  const atkKey = phys ? 'a' : 'c', dumpKey = phys ? 'c' : 'a';
  const A = phys ? 'A' : 'C';

  const aSp  = {h:2,a:0,b:0,c:0,d:0,s:SP_MAX};  aSp[atkKey] = SP_MAX;
  const aMod = {a:1,b:1,c:1,d:1,s:1};           aMod[atkKey] = 1.1; aMod[dumpKey] = 0.9;
  const sMod = {a:1,b:1,c:1,d:1,s:1.1};         sMod[dumpKey] = 0.9;

  const defKey = b.b >= b.d ? 'b' : 'd';
  const dSp  = {h:SP_MAX,a:0,b:17,c:0,d:17,s:0};
  const dMod = {a:1,b:1,c:1,d:1,s:1};           dMod[defKey] = 1.1; dMod[dumpKey] = 0.9;

  const w = attackerLikeness(name);

  /* 攻撃実数値は「技の分類ごと」に持つ。
     相手の技は実データで見るので、特殊技を撃たれるならその相手はCに振っている個体である。
     A32とC32を同時には振れないが、ここで見たいのは「その技を撃つ個体の打点」なので分けて持つのが正しい。 */
  const inv = k => statOther(b[k], SP_MAX, 1.1);   // その能力に振った個体
  const raw = k => statOther(b[k], 0, 1);          // 振っていない個体（耐久型）
  const atkFull = { '物': inv('a'), '特': inv('c') };
  const atkNone = { '物': raw('a'), '特': raw('c') };

  const out = [
    { kind:'atk',  label:`攻撃型（${A}32/S32・${A}補正）`, physical:phys,
      stats:spreadStats(name, aSp, aMod), atk:atkFull, weight:w * 0.6 },
    { kind:'fast', label:`最速型（${A}32/S32・S補正）`,    physical:phys,
      stats:spreadStats(name, aSp, sMod), atk:atkFull, weight:w * 0.4 },
    { kind:'def',  label:'耐久型（H32/B17/D17）',          physical:phys,
      stats:spreadStats(name, dSp, dMod), atk:atkNone, weight:1 - w }
  ].filter(s=>s.stats);

  /* こだわりスカーフ（採用率15%以上）は行動順をひっくり返すので独立した型として持つ。
     ガブリアスは19.7%がスカーフ。これを見ていないと「先に落とせる」が嘘になる。 */
  const scarf = oppScarfRate(name);
  if(scarf >= 15){
    const st = spreadStats(name, aSp, sMod);
    if(st){ out.push({ kind:'scarf', label:`スカーフ型（採用率${scarf}%）`, physical:phys,
      stats:{...st, s: Math.floor(st.s * 1.5)}, atk:atkFull, item:'こだわりスカーフ',
      weight: w * (scarf/100) }); }
  }
  return out;
}

/* ---------- ランク補正 ---------- */
function rankMul(stage, isAccEva){
  const s = Math.max(-6, Math.min(6, stage|0));
  if(isAccEva) return s>=0 ? (3+s)/3 : 3/(3-s);
  return s>=0 ? (2+s)/2 : 2/(2-s);
}

/* ---------- ダメージ計算 ----------
   opts = {
     attacker:{name, level:50, atkStat, types, ability, item, rank, hpRatio},
     defender:{name, defStat, types, ability, item, rank, hpRatio},
     move:{name,type,cat,power,contact},
     field:{weather:'', reflect:false, lightscreen:false, burn:false},
     flags:{critical:false, adaptability:false, ...}
   }
   戻り値: {min,max,rolls,eff,pctMin,pctMax,ko,note[]}            */
function calcDamage(o){
  const notes = [];
  const mv = o.move;
  if(!mv || !mv.power || mv.cat==='変') return { error:'この技はダメージ計算の対象外です（変化技／固定ダメージ／威力可変）' };

  const defTypes = o.defender.types || [];
  const eff = effectiveness(mv.type, defTypes);
  if(eff === 0) return { eff:0, min:0, max:0, rolls:[], pctMin:0, pctMax:0, note:['タイプ相性で無効'] };

  /* ★おはかまいりは倒れた味方の数で威力が上がる（v62）。
     社長は相手の3体目（＝2体落ちている＝威力150）に一撃で落とされている。
     威力50のまま計算していたので、3分の1に過小評価していた。 */
  let power = graveMovePower(mv.name, mv.power, (o.field && o.field.oppFallen) || 0);
  let atk = o.attacker.atkStat;
  let def = o.defender.defStat;

  // 能力ランク
  atk = Math.floor(atk * rankMul(o.attacker.rank||0));
  def = Math.floor(def * rankMul(o.defender.rank||0));

  const ab = o.attacker.ability || '';
  const dab = o.defender.ability || '';

  // 威力補正
  let powMod = 1;
  if(ab==='テクニシャン' && mv.power<=60){ powMod*=1.5; notes.push('テクニシャン ×1.5'); }
  if(ab==='かたいツメ' && mv.contact){ powMod*=1.3; notes.push('かたいツメ ×1.3'); }
  if(ab==='フェアリーオーラ' && mv.type==='フェアリー'){ powMod*=1.33; notes.push('フェアリーオーラ ×1.33'); }
  if(o.attacker.item==='いのちのたま'){ powMod*=1.3; notes.push('いのちのたま ×1.3'); }
  if(o.attacker.item==='たつじんのおび' && eff>1){ powMod*=1.2; notes.push('たつじんのおび ×1.2'); }
  if(o.attacker.item==='タイプ強化アイテム'){ powMod*=1.2; notes.push('タイプ強化 ×1.2'); }
  const lowHp = (o.attacker.hpRatio!=null && o.attacker.hpRatio<=1/3);
  if(lowHp && ((ab==='もうか'&&mv.type==='ほのお')||(ab==='げきりゅう'&&mv.type==='みず')||
               (ab==='しんりょく'&&mv.type==='くさ')||(ab==='むしのしらせ'&&mv.type==='むし'))){
    powMod*=1.5; notes.push(ab+' ×1.5');
  }
  power = Math.max(1, Math.round(power * powMod));

  // 攻撃補正
  let atkMod = 1;
  if(o.attacker.item==='こだわりハチマキ' && mv.cat==='物'){ atkMod*=1.5; notes.push('ハチマキ ×1.5'); }
  if(o.attacker.item==='こだわりメガネ' && mv.cat==='特'){ atkMod*=1.5; notes.push('メガネ ×1.5'); }
  if(ab==='ちからもち'||ab==='ヨガパワー'){ if(mv.cat==='物'){ atkMod*=2; notes.push(ab+' ×2'); } }
  if(o.attacker.intimidated && mv.cat==='物'){ atkMod*=2/3; notes.push('いかく ×2/3'); }
  atk = Math.floor(atk * atkMod);

  // 防御補正
  let defMod = 1;
  if(o.defender.item==='とつげきチョッキ' && mv.cat==='特'){ defMod*=1.5; notes.push('とつげきチョッキ ×1.5'); }
  if(o.field && o.field.weather==='すなあらし' && mv.cat==='特' && defTypes.includes('いわ')){
    defMod*=1.5; notes.push('砂嵐でいわのD ×1.5');
  }
  // ゆき：こおりタイプの物理防御が1.5倍（第9世代準拠）。
  // 画面の天候メニューに「ゆき」があるのにここで処理していなかった＝選んでも結果が変わらないバグ
  if(o.field && o.field.weather==='ゆき' && mv.cat==='物' && defTypes.includes('こおり')){
    defMod*=1.5; notes.push('ゆきでこおりのB ×1.5');
  }
  def = Math.floor(def * defMod);

  // 基礎ダメージ（Lv50）
  let base = Math.floor(Math.floor(Math.floor(22 * power * atk / def) / 50) + 2);

  // 天候
  if(o.field){
    if(o.field.weather==='にほんばれ'){
      if(mv.type==='ほのお'){ base=Math.floor(base*1.5); notes.push('晴れ ×1.5'); }
      if(mv.type==='みず'){ base=Math.floor(base*0.5); notes.push('晴れでみず ×0.5'); }
    }
    if(o.field.weather==='あめ'){
      if(mv.type==='みず'){ base=Math.floor(base*1.5); notes.push('雨 ×1.5'); }
      if(mv.type==='ほのお'){ base=Math.floor(base*0.5); notes.push('雨でほのお ×0.5'); }
    }
  }
  if(o.flags && o.flags.critical){ base=Math.floor(base*1.5); notes.push('急所 ×1.5'); }

  // 乱数16通り → タイプ一致 → タイプ相性 → やけど → その他
  const stab = o.attacker.stab===false ? 1
    : (o.attacker.types||[]).includes(mv.type)
      ? (ab==='てきおうりょく' ? 2 : 1.5)
      : (ab==='へんげんじざい' ? 1.5 : 1);
  if(stab>1) notes.push('タイプ一致 ×'+stab);

  let otherMod = 1, msMod = 1;
  if(dab==='マルチスケイル' && (o.defender.hpRatio==null || o.defender.hpRatio>=1)){
    /* ★マルチスケイルは「満タンのときの1発」にしか効かない。
       連続技には1段目で剥がされ、2段目以降はフルで入る（この表の上のコメント参照）。
       ばけのかわ・がんじょう・タスキは打数側（oppOneHitGuard 等）で
       `multiHitOf` を見て処理していたのに、**マルチスケイルだけ倍率なので漏れていた**。
       ここで倍率を分けて持ち、下の連続技の合算で1段ぶんにだけ掛ける。 */
    msMod = 0.5; otherMod *= msMod; notes.push('マルチスケイル ×0.5');
  }
  if(dab==='ハードロック'||dab==='フィルター'||dab==='プリズムアーマー'){
    if(eff>1){ otherMod*=0.75; notes.push(dab+' ×0.75'); }
  }
  // オーロラベールは物理・特殊の両方を半減する（リフレクター＋ひかりのかべを1枚で兼ねる）
  if(o.field && o.field.auroraveil){
    otherMod*=0.5; notes.push('オーロラベール ×0.5');
  } else if(o.field && ((o.field.reflect && mv.cat==='物') || (o.field.lightscreen && mv.cat==='特'))){
    otherMod*=0.5; notes.push((mv.cat==='物'?'リフレクター':'ひかりのかべ')+' ×0.5');
  }
  if(o.defender.item==='オボンのみ') notes.push('※オボンのみは計算に含めていません');

  const burnMod = (o.field && o.field.burn && mv.cat==='物' && ab!=='こんじょう') ? 0.5 : 1;
  if(burnMod<1) notes.push('やけど ×0.5');

  const rolls = [];
  const rollsNoMS = [];                    // マルチスケイルを外したぶん（連続技の2段目以降）
  const otherNoMS = msMod<1 ? otherMod/msMod : otherMod;
  for(let r=85;r<=100;r++){
    let d = Math.floor(base * r / 100);
    d = Math.floor(d * stab);
    d = Math.floor(d * eff);
    d = Math.floor(d * burnMod);
    rollsNoMS.push(Math.max(1, Math.floor(d * otherNoMS)));
    d = Math.floor(d * otherMod);
    rolls.push(Math.max(1, d));
  }
  let min = rolls[0], max = rolls[rolls.length-1];
  /* ★連続技はここで合計ぶんに引き伸ばす。
     min には期待回数、max には全段当たった場合をかける（＝一撃で落ちるかは max で見る）。
     ★avg/max は「1段目の威力を1」とした合計倍率なので、**1段ぶんを引いた残り**が
       マルチスケイルの切れている段になる（トリプルアクセルなら 20 と 40+60）。 */
  const mh = multiHitOf(mv.name);
  if(mh){
    if(msMod < 1){
      min = Math.floor(min + rollsNoMS[0] * (mh.avg - 1));
      max = Math.floor(max + rollsNoMS[rollsNoMS.length-1] * (mh.max - 1));
      notes.push('マルチスケイルが効くのは1段目だけ（連続技で剥がれる）');
    }else{
      min = Math.floor(min * mh.avg);
      max = Math.floor(max * mh.max);
    }
    notes.push(`${mv.name} は${mh.why}（合計で計算）`);
  }
  const hp = o.defender.hp || 1;
  const pctMin = min/hp*100, pctMax = max/hp*100;

  // 確定数。連続技は1ターンぶんが min〜max なので、乱数の並びも同じ倍率で見る
  const rollsEff = !mh ? rolls
    : (msMod<1 ? rolls.map((v,i)=> Math.floor(v + rollsNoMS[i] * (mh.avg - 1)))
               : rolls.map(v=> Math.floor(v * mh.avg)));
  let ko = '';
  for(let n=1;n<=6;n++){
    if(min*n >= hp){ ko = `確定${n}発`; break; }
    if(max*n >= hp){
      const cnt = rollsEff.filter(v=> v*n >= hp).length;
      ko = `乱数${n}発（${Math.round(cnt/16*100)}%）`; break;
    }
  }
  if(!ko) ko = '7発以上';

  return { eff, min, max, rolls, pctMin, pctMax, ko, note:notes, multi: mh ? mv.name : null };
}

/* ---------- メガシンカの対応表 ----------
   相手のパーティを見た段階では「どれがメガになるか」は分からないので、
   相手側は必ずベースフォルムで扱い、メガはバトル中のイベントとして記録する。 */
const MEGA_OF = {};   // ベース名 -> [メガ名, ...]
const BASE_OF = {};   // メガ名   -> ベース名
const MEGA_BASE_OVERRIDE = { 'メガフラエッテ':'フラエッテ(えいえん)' };
function buildMegaMap(){
  Object.keys(SPECIES).forEach(n=>{
    if(!n.startsWith('メガ')) return;
    let base = MEGA_BASE_OVERRIDE[n];
    if(!base){
      const c1 = n.slice(2);                       // メガハッサム -> ハッサム
      const c2 = c1.replace(/[XY]$/,'');           // メガリザードンX -> リザードン
      base = SPECIES[c1] ? c1 : (SPECIES[c2] ? c2 : null);
    }
    if(!base || !SPECIES[base]) return;            // 「メガニウム」等の誤検出を弾く
    BASE_OF[n] = base;
    (MEGA_OF[base] = MEGA_OF[base] || []).push(n);
  });
}
function isMegaForm(name){ return !!BASE_OF[name]; }
function megaFormsOf(name){ return MEGA_OF[name] || []; }
function canMega(name){ return (MEGA_OF[name]||[]).length > 0; }
/** 相手側に見せる用：メガ名で来たらベースに戻す */
function toBase(name){ return BASE_OF[name] || name; }

/* ---------- ★へんげんじざい／リベロで変わったタイプ（2026-08-21・v76） ----------
   社長の要望：「相手の特性が変幻自在だったりするときに、タイプが変わるから効果が変わる。
     変幻自在をした後、**このタイプになった**ってなったら、これで変わりよ、というのがある」
   ＝ マスカーニャが トリプルアクセル を撃った瞬間、**こおり単タイプ**になる。
     こちらの「どの技が通るか」も「何を食らうと痛いか」も、その瞬間から全部変わる。

   ★やり方はメガシンカと同じにした。**タイプだけ差し替えた別個体を SPECIES に登録して、
     相手の名前をそれに差し替える。** こうすればダメージ計算・危ないタイプ・引き先の判断まで
     エンジン全体が自動で新しいタイプで動く（同じ計算を2か所に書かない＝鉄則⑤）。
     `BASE_OF[新名] = 元の名前` にしてあるので、使用率・持ち物・特性・同居率は
     **元のポケモンのものをそのまま見る**（そこは変わらないため）。

   ★攻撃側のタイプ一致は calcDamage が「へんげんじざいなら常に×1.5」で見ているので、
     ここで二重にはならない（if/else で片方しか通らない）。 */
const PROTEAN_ABILITY = ['へんげんじざい','リベロ'];
/* ★合成した個体の登録簿。**種族名を並べる場所からは必ず外すこと。**
   外さないと「相手6体を入れる」の検索やタイプ絞り込みに
   「マスカーニャ〈こおり〉」が候補として出てきて、そのまま登録できてしまう
   （誤登録で3敗している。同じ穴を開けない）。 */
const TYPE_FORMS = new Set();
function isTypeForm(name){ return TYPE_FORMS.has(name); }
/** その相手が へんげんじざい／リベロ を持ちうるか */
function hasProtean(name){
  const u = oppUsage(name);
  const list = (u && u.a) ? u.a.map(x=>x[0]) : (OPP_ABILITY[toBase(name)]||[]);
  return PROTEAN_ABILITY.some(a=> list.includes(a));
}
/** 「マスカーニャ」＋「こおり」→「マスカーニャ〈こおり〉」。無ければその場で作る。 */
function typeFormName(name, type){
  if(!type || !SPECIES[name] || !CHART[type]) return name;
  const cur = SPECIES[name].types;
  if(cur.length===1 && cur[0]===type) return name;      // すでにそのタイプ単体なら作る必要が無い
  const synth = name + '〈' + type + '〉';
  if(!SPECIES[synth]){
    SPECIES[synth] = {...SPECIES[name], types:[type]};
    TYPE_FORMS.add(synth);
    /* ★元を「その名前そのもの」にする。toBase(合成名)＝元の名前 になるので、
       使用率・特性・持ち物・同居率の参照が、変身前とまったく同じ経路で解決する。 */
    BASE_OF[synth] = name;
    if(OPP_ABILITY[name]) OPP_ABILITY[synth] = OPP_ABILITY[name];
  }
  return synth;
}
/* ★相手の技で「こちらのタイプを変えられる」技（2026-08-21・v80）。
   社長の実戦（ハラバリー戦）：
     「あくびうち、みずびたし打たれる。じしんで全然削れない（なぜ）」
   ＝ みずびたし で カバルドンが みず になり、**じしんのタイプ一致(×1.5)が消えていた**。
     そこにやけど(×0.5)が重なって、素の 1/3 まで落ちていた。ツールは 50〜59% と表示したまま。
   ★ハラバリーの みずびたし 採用率は **93.8%**。事故ではなく、必ず来る型。

   ★そして社長の指摘の本体：**このタイプ変更は交代すると元に戻る。**
     「引き先が残っているかどうか」で価値がまるごと変わる＝チーム戦。
     だからツールは「いま何タイプか」だけでなく「引けば戻る」ことも出さないといけない。 */
const TYPE_CHANGE_MOVES = { 'みずびたし':'みず', 'マジックパウダー':'エスパー' };
/* ハロウィン（ゴースト）・もりののろい（くさ）は**追加**なので置換とは別物。ここには入れない。 */
function typeChangeOf(move){ return TYPE_CHANGE_MOVES[move] || null; }

/** 「マスカーニャ〈こおり〉」→「こおり」。合成でなければ null */
function typeFormOf(name){ const m = /〈(.+)〉$/.exec(name||''); return m ? m[1] : null; }
/** 合成名から元の表示名へ戻す（「マスカーニャ〈こおり〉」→「マスカーニャ」） */
function stripTypeForm(name){ return (name||'').replace(/〈.+〉$/, ''); }

/* ★「このタイプの技が通る」を出すための表（2026-08-21・v76・社長の要望）。
   「普通に**このタイプの技がいいよ**っていう書き方の方が助かる。それが両立していると
     ありがたい」＝ 技名だけだと、相手のタイプが変わった瞬間に読み替えられない。
   タイプで持っておけば、変身しても・知らない相手が出てきても、社長自身が判断できる。 */
function typeAdvice(oppName, mine){
  const os = SPECIES[oppName]; if(!os) return null;
  const ab  = worstDefAbility(oppName);
  const imm = immuneType(ab);
  const best = {};                     // タイプ -> こちらが持っている、そのタイプで一番強い攻撃技
  (((mine||{}).moves)||[]).forEach(n=>{
    const m = MOVES[n];
    if(!m || !m.power || m.cat==='変') return;
    if(!best[m.type] || (MOVES[best[m.type]].power||0) < m.power) best[m.type] = n;
  });
  const rows = TYPES.map(t=>{
    const byAbility = (t===imm) ? ab : null;
    return { type:t, eff: byAbility ? 0 : effectiveness(t, os.types),
             byAbility, mine: best[t] || null };
  });
  return { types: os.types, ability: ab, rows,
           /* こちらが持っている技のうち、いちばん相性が良いタイプ */
           bestMine: rows.filter(r=>r.mine && r.eff>0).sort((a,b)=> b.eff-a.eff)[0] || null };
}

/* ---------- 先発の読み ----------
   ①自分の記録（同じ相手が実際に何を初手に置いたか）を最優先
   ②記録が足りない分は、上位勢が実際に語っている「初手に置かれやすい枠」で補う */
const LEAD_PRIOR = {
  // 起点作り（ステロ・どくびし・あくび）＝初手の定番
  'キラフロル':0.60,'カバルドン':0.55,'ブリジュラス':0.40,'ガブリアス':0.40,'マスカーニャ':0.45,
  // 天候・場作り
  'ペリッパー':0.55,'ユキノオー':0.50,'コータス':0.50,'エルフーン':0.50,
  // 構築記事・解説で「初手に置かれやすい」と名指しされているもの
  'ウツボット':0.65,        // ふとん氏「ほとんどのウツボット使いが初手にウツボットを出す」
  'フラエッテ(えいえん)':0.60, // ふとん氏「大体初手にフラエッテが来る」
  'イダイトウ♂':0.45,       // ふとん氏「初手スカーフイダイトウを置くプレイヤーが多かった」
  // 高速アタッカー（タスキ・スカーフ想定）
  'ドラパルト':0.35,'ゲッコウガ':0.30,'プテラ':0.35,'アーマーガア':0.30
};
/** 相手の「選出3体」を予想する。
 *  ①相手の駒が自分の6匹にどれだけ刺さるか（相手は自分に刺さる駒を選ぶ）
 *  ②実測：過去に同じ駒が実際に選出された割合
 *  ③使用率上位＝軸になりやすい、という弱い事前分布                      */
function predictPicks(oppNames, battles, myRoster, size, usageRank){
  size = size || 3;
  const stats = {};
  (battles||[]).forEach(b=>{
    (b.opp_team||[]).forEach(n=>{ const k=toBase(n); stats[k]=stats[k]||{sel:0,seen:0}; stats[k].seen++; });
    (b.opp_pick||[]).forEach(n=>{ const k=toBase(n); stats[k]=stats[k]||{sel:0,seen:0}; stats[k].sel++; });
  });

  const rows = oppNames.map(raw=>{
    const n = toBase(raw);
    const st = stats[n] || {sel:0, seen:0};
    const why = [];

    // ① 自分の6匹に対する刺さり（-1〜+1 に潰す）
    let fit = 0;
    if(myRoster && myRoster.length){
      const scores = myRoster.map(m=>{
        const mu = matchup(m, {name:n});
        return mu ? -mu.score : 0;          // 自分視点のスコアを反転＝相手視点
      });
      fit = scores.reduce((a,b)=>a+b,0)/scores.length;
      fit = Math.max(-1, Math.min(1, fit/2));
      if(fit > 0.25) why.push('こちらに刺さっている');
      if(fit < -0.25) why.push('こちらが有利');
    }

    // ② 実測
    const obsRate = st.seen ? st.sel/st.seen : 0;
    const obsW    = st.seen>=3 ? Math.min(0.75, st.seen/12) : 0;
    if(st.seen>=3) why.push(`実測 ${st.sel}/${st.seen}戦で選出`);

    // ③ 使用率（順位が上ほど軸になりやすい）
    const idx = usageRank ? usageRank.indexOf(n) : -1;
    const usage = idx>=0 ? Math.max(0, 0.35 - idx*0.012) : 0.1;

    const base = 0.5 + fit*0.5;                       // ①だけで 0〜1
    const score = obsW*obsRate + (1-obsW)*(base*0.75 + usage);
    return { name:n, score, why, fit, obs:st };
  }).sort((a,b)=> b.score - a.score);

  const total = rows.reduce((a,r)=>a+r.score,0) || 1;
  const withPct = rows.map(r=>({...r, pct:r.score/total}));
  return { ranked: withPct, picks: withPct.slice(0, size).map(r=>r.name) };
}

/** 選出予想の的中率を、過去ログの時系列で検証する（列を増やさずに測る） */
function backtestPicks(battles, myRoster, size, usageRank){
  size = size || 3;
  let hit=0, total=0, exact=0;
  const list = [...(battles||[])].reverse();          // 古い順
  list.forEach((b,i)=>{
    const team=(b.opp_team||[]).map(toBase), act=(b.opp_pick||[]).map(toBase);
    if(team.length<size || act.length<size) return;
    const past = list.slice(0,i).reverse();
    const {picks} = predictPicks(team, past, myRoster, size, usageRank);
    const inter = picks.filter(p=>act.includes(p)).length;
    hit += inter; total += size;
    if(inter===size) exact++;
  });
  return { hit, total, exact, games: total/size };
}

/** 相手6匹から先発候補を確率つきで返す */
function predictLead(oppNames, battles){
  const stats = {};   // 名前 -> {lead, seen}
  (battles||[]).forEach(b=>{
    const team = b.opp_team||[]; if(!team.length) return;
    // 実際の初手＝ターン記録の1手目に相手が場に出していたポケモン
    const actual = (b.turns||[])[0] ? toBase((b.turns[0].oppMon)||'') : null;
    team.forEach(n=>{ const k=toBase(n); stats[k]=stats[k]||{lead:0,seen:0}; stats[k].seen++; });
    if(actual){ stats[actual]=stats[actual]||{lead:0,seen:0}; stats[actual].lead++; }
  });

  const rows = oppNames.map(raw=>{
    const n = toBase(raw);
    const sc = SPECIES[n];
    const st = stats[n] || {lead:0, seen:0};

    // ①実測（母数が増えるほど信頼する）
    const obsRate = st.seen ? st.lead/st.seen : 0;
    const obsW    = st.seen>=3 ? Math.min(0.8, st.seen/10) : 0;

    // ②事前分布：定番枠 ＋ 素早さ
    const prior = LEAD_PRIOR[n] !== undefined ? LEAD_PRIOR[n]
                : (sc ? Math.min(0.35, sc.base.s/400) : 0.15);

    const score = obsW*obsRate + (1-obsW)*prior;
    const why = [];
    if(st.seen>=3) why.push(`実測 ${st.lead}/${st.seen}戦で初手`);
    if(LEAD_PRIOR[n]!==undefined) why.push('初手の定番枠');
    else if(sc && sc.base.s>=110) why.push('素早さが高い');
    return { name:n, score, obs:st, why };
  });
  const total = rows.reduce((a,r)=>a+r.score,0) || 1;
  return rows.map(r=>({...r, pct: r.score/total})).sort((a,b)=> b.pct - a.pct);
}

/* ---------- 相手の特性 ----------
   出典: 02_環境分析_レギュMB.md の使用率TOP25表（yakkun 2026/08/13）＋ GameWith個別ページ。
   ここが空だったせいで、選出判定が相手の特性を完全に無視していた。
   実戦で「カイリュー・ブリジュラス・ミミッキュ・シャンデラが重い」という体感と、
   ツールの「◎対処できる」判定がズレていた原因。 */
const OPP_ABILITY = {
  'ガブリアス':['すながくれ','さめはだ'], 'アシレーヌ':['げきりゅう','うるおいボイス'],
  'マスカーニャ':['しんりょく','へんげんじざい'], 'ブリジュラス':['じきゅうりょく','がんじょう','すじがねいり'],
  'ミミッキュ':['ばけのかわ'], 'カバルドン':['すなおこし','すなのちから'],
  'メガギャラドス':['かたやぶり'], 'メガカイリュー':['マルチスケイル'], 'カイリュー':['せいしんりょく','マルチスケイル'],
  'メガメタグロス':['かたいツメ'], 'メタグロス':['クリアボディ'], 'メガマフォクシー':['ふゆう'],
  'メガリザードンY':['ひでり'], 'メガハッサム':['テクニシャン'],
  'アーマーガア':['プレッシャー','きんちょうかん','ミラーアーマー'],
  'イダイトウ♂':['すいすい','てきおうりょく','かたやぶり'], 'イダイトウ♀':['すいすい','てきおうりょく','かたやぶり'],
  'キラフロル':['どくげしょう','ふしょく'], 'サザンドラ':['ふゆう'],
  'メガゲッコウガ':['へんげんじざい'], 'メガゲンガー':['かげふみ'],
  'ダイケンキ(ヒスイ)':['げきりゅう','きれあじ'], 'メガライチュウY':['ノーガード'],
  'ギルガルド(シールド)':['バトルスイッチ'], 'ギルガルド(ブレード)':['バトルスイッチ'],
  'サーフゴー':['おうごんのからだ'], 'ウルガモス':['ほのおのからだ','むしのしらせ'],
  'メガバシャーモ':['かそく'], 'ドドゲザン':['まけんき','そうだいしょう','プレッシャー'],
  'メガフラエッテ':['フェアリーオーラ'],
  'シャンデラ':['もらいび','ほのおのからだ','すりぬけ'],     // すりぬけ＝みがわり/壁を無視
  'メガシャンデラ':['もらいび','ほのおのからだ','すりぬけ'],
  'ヌメルゴン(ヒスイ)':['ぬめぬめ','そうしょく','シェルアーマー'],
  'イルカマン(マイティ)':['マイティチェンジ'], 'マニューラ':['プレッシャー','わるいてぐせ'],
  'メガユキノオー':['ゆきふらし'], 'ユキノオー':['ゆきふらし'], 'バイバニラ':['ゆきふらし','アイスボディ']
};
/* 相手が持っている可能性が高い「変化技・妨害技」。
   出典は末尾に明記。ここに無い＝存在しないではなく「まだ裏を取っていない」の意味。
   これを知らずに殴り続けて起点にされる（あくびで眠る等）のが一番の負け筋なので、
   確度の高いものだけを載せる。 */
const OPP_TRICKS = {
  /* ★2026-08-20 追加：状態異常を「攻撃技の追加効果」で撒いてくる相手。
     変化技だけを警戒表示していたため、フェイタルクロー(オオニューラ 採用93.5%)のような
     攻撃技の追加効果を一切警告できていなかった。社長はこれで眠らされて1戦落としている。 */
  'オオニューラ':  [['フェイタルクロー','攻撃技だが毒・まひ・眠りのどれかにされる。悠長に積むと事故る'],['ねこだまし','初手にひるまされる。積みの1ターンを潰される'],['インファイト','はがね・こおり・あく等に2倍。ルカリオは一撃で落ちる']],
  'マニューラ':    [['ねこだまし','初手にひるまされる']],
  'ミミロップ':    [['ねこだまし','初手にひるまされる']],
  'ピクシー':      [['あくび','眠らされる。打たれた次のターンの終わりに眠るので、その1ターンで必ず引く'],['でんじは','まひ']],
  'メガピクシー':  [['あくび','眠らされる。1ターン以内に引く'],['バトンタッチ','積んでから後続に渡してくる']],
  'ブラッキー':    [['ねがいごと','次のターンに大回復。削り切れないと無限に粘られる'],['どくどく','猛毒。長期戦が全部相手のものになる'],['イカサマ','こちらの攻撃力で殴られる。物理アタッカーほど痛い'],['まもる','ねがいごとの回復ターンを稼がれる']],
  'カバルドン':    [['あくび','眠らされる。1ターン以内に引く'],['ステルスロック','後続が削られる'],['ふきとばし','強制交代させられる。積んでも流される']],
  'ニンフィア':    [['あくび','眠らされる。1ターン以内に引く']],
  'マスカーニャ':  [['どくびし','後続が毒になる'],['ふいうち','先制。瀕死圏で殴ると読まれる']],
  'ガブリアス':    [['ステルスロック','後続が削られる'],['ドラゴンテール','強制交代。積みが流される']],
  'キラフロル':    [['どくびし','特性どくげしょうで、殴っただけでも撒かれる']],
  'エルフーン':    [['おいかぜ','相手全体の素早さが2倍。抜かれる'],['がむしゃら','こちらのHPを相手と同じまで削られる'],['いたずらごころ','変化技が先制で飛んでくる']],
  'ギャラドス':    [['ちょうはつ','変化技を封じられる']],
  'メガギャラドス':[['りゅうのまい','積まれると手が付けられない']],
  'ドドゲザン':    [['つるぎのまい','積まれたら択に勝つしかなくなる'],['ふいうち','先制']],
  'ミミッキュ':    [['つるぎのまい','ばけのかわを盾に積んでくる'],['かげうち','先制']],
  'メガライチュウY':[['でんじほう','特性ノーガードで必中＝確定でまひ']],
  'アシレーヌ':    [['アンコール','同じ技に固定される。積み技を打った直後が危ない']],
  'イッカネズミ(3びき)':[['ネズミざん','最大10連撃。きあいのタスキもばけのかわも貫通される']],
  'アーマーガア':  [['ビルドアップ','積まれると物理が通らなくなる'],['はねやすめ','回復されて削り切れない']],
  'ブリジュラス':  [['てっぺき','積まれると物理が通らない'],['ボディプレス','防御で殴ってくる']],
  'クエスパトラ':  [['ルミナコリジョン','特防を下げられる']],
  'メガフラエッテ':[['めいそう','積まれると特殊では抜けなくなる']]
};
/* 出典: 05_マイ構築_紫電アマガライチュウ.md ／ 02_環境分析_レギュMB.md ／
   yakkun n8279 の構築記事 ／ GameWith 各ポケモンの技使用率(M-5 8/17集計) ／
   ピクシーのあくびは 2026-08-19 の実戦で社長が被弾して確認。
   イッカネズミのネズミざんは社長の報告。 */
function oppTricks(name){ return OPP_TRICKS[name] || []; }

/** その相手が持ちうる特性のうち、防御面でいちばん厄介なものを1つ返す */
const DEF_ABILITY_RANK = ['ばけのかわ','マルチスケイル','がんじょう','ハードロック','フィルター','プリズムアーマー',
                          'ふゆう','もらいび','ちょすい','よびみず','かんそうはだ','ちくでん','ひらいしん','でんきエンジン','そうしょく'];
function worstDefAbility(name){
  const list = OPP_ABILITY[name] || [];
  for(const a of DEF_ABILITY_RANK) if(list.includes(a)) return a;
  return '';
}
/** 1発は耐えてしまう特性（実質、こちらの必要打数が1増える） */
function survivesOneHit(name){
  const list = OPP_ABILITY[name] || [];
  return list.includes('ばけのかわ') || list.includes('がんじょう');
}

/* ---------- 特性によるタイプ無効 ---------- */
const IMMUNE_BY_ABILITY = {
  'ふゆう':'じめん','もらいび':'ほのお','ちょすい':'みず','よびみず':'みず','かんそうはだ':'みず',
  'ちくでん':'でんき','ひらいしん':'でんき','でんきエンジン':'でんき','そうしょく':'くさ',
  'ぼうじん':null,'ぼうおん':null
};
function immuneType(ability){ return IMMUNE_BY_ABILITY[ability] || null; }

/* ---------- 選出スコアリング（ダメージ計算ベース） ----------
   自分側は登録済みの実数値・技・特性・持ち物を使う。
   相手側は型不明なので「ぶっぱ想定（H32/耐久32/攻撃32＋補正）」で見積もる。 */
const REP_POWER = 90;   // 相手のタイプ一致技の代表威力

/** 自分の最大打点（相手のHPに対する割合 0〜1）と技名。opp は assumedSpreads() の1要素 */
/* ---------- 技の優先度（先制技） ----------
   社長の要望（2026-08-20）：
   「バレットパンチ・ふいうち・かげうちのような先制技を考慮したい。
     素早さが近くて残りHPも近いなら、先に出せる技を選ぶべき」
   MOVES データに優先度が無かったので、ここに持たせる。出典は本作の技仕様。
   ※ふいうちは「相手が攻撃技を選んでいるときだけ成功」する条件つき。数字だけで決めない。 */
const MOVE_PRIORITY = {
  'まもる':4, 'みきり':4, 'こらえる':4, 'ファストガード':3, 'ねこだまし':3,
  'しんそく':2, 'ふいうち':1, 'かげうち':1, 'バレットパンチ':1, 'こおりのつぶて':1,
  'マッハパンチ':1, 'みずしゅりけん':1, 'アクアジェット':1, 'でんこうせっか':1,
  'つぶらなひとみ':1, 'アクセルロック':1, 'ジェットパンチ':1, 'しんくうは':1, 'グラススライダー':1,
  'ふきとばし':-6, 'ドラゴンテール':-6, 'ともえなげ':-6, 'ほえる':-6, 'ゆうわく':-6, 'トリックルーム':-7
};
const PRIORITY_NOTE = {
  'ふいうち':'相手が攻撃技を選んでいるときだけ成功。交代・変化技を選ばれると不発',
  'ねこだまし':'出したターンだけ。相手をひるませる',
  'ドラゴンテール':'後攻。当てると相手を強制交代させる',
  'ふきとばし':'後攻。相手を強制交代させる（積みを流せる）'
};
function movePriority(name){ return MOVE_PRIORITY[name] || 0; }

/** いま撃てる技を1つずつ比べる。
 *  社長の要望（2026-08-20）：
 *  「どっちの技を打つべきか。相手に引っ込められることまで考えて選びたい。
 *    こっちを打ったらこのくらい、こっちならこのくらい、が知りたい」
 *  @param others 相手の控え（交代されたときに、その技が通るかを見る）
 */
/* ★設置技と あくび の「いま押す価値」を実数で出す（2026-08-21・v57）。
   きっかけは上位プレイヤーの座談会（シーズン3 上位10人の振り返り）。
   「カバルドンやっぱ一番圧倒的に多い。でもカバルドン使ったら勝てますとは言えない。
     **技選択がマジでむずい**。一生設置してるわけじゃなくて対面操作もする。
     じしんを打つタイミングとかステロを打つタイミングとかね」
   ＝ カバルドン軸の勝敗は「選出」ではなく「毎ターン何を押すか」で決まる、という共通見解。
   社長の負け方もこれと一致している：
     試合16「あくびとステロを撒こうとしたらラムのみで回復されアンコール。ステロが撒けず何も出来なかった」
     試合14「ステロを撒いてふきとばし → ムクホークがステロで落ちた」＝ 効いた側の例
   これまでツールは変化技を「変化技」としか表示していなかった。押す根拠を出す。 */

/** ステルスロック等が、相手6体にどれだけ効くか。戻り値は表示用の1行 */
function hazardValue(moveName, oppTeam){
  const team = (oppTeam||[]).map(toBase).filter(n=> SPECIES[n]);
  if(!team.length) return null;
  if(moveName === 'ステルスロック'){
    const rows = team.map(n=>({n, e: effectiveness('いわ', SPECIES[n].types)}));
    const pct = r => Math.round(12.5 * r.e * 10) / 10;
    const big = rows.filter(r=> r.e >= 2).map(r=> `${r.n} ${pct(r)}%`);
    const total = Math.round(rows.reduce((a,r)=> a + 12.5*r.e, 0));
    return `交代のたび：${big.length ? big.join('・') : '2倍以上の相手なし'}`
         + `（6体合計 ${total}%ぶん）`;
  }
  if(moveName === 'まきびし' || moveName === 'ねばねばネット'){
    const ng = team.filter(n=> SPECIES[n].types.includes('ひこう') || worstDefAbility(n)==='ふゆう');
    return `効かない相手：${ng.length ? ng.join('・') : 'なし'}（${team.length-ng.length}/${team.length}体に効く）`;
  }
  if(moveName === 'どくびし'){
    const ng = team.filter(n=> SPECIES[n].types.includes('ひこう') || SPECIES[n].types.includes('はがね')
                            || worstDefAbility(n)==='ふゆう');
    return `効かない相手：${ng.length ? ng.join('・') : 'なし'}（${team.length-ng.length}/${team.length}体に効く）`;
  }
  return null;
}

/** あくび・状態異常が「通らない」条件を、根拠つきで返す */
const YAWN_ABILITY = ['ふみん','やるき','スイートベール','ぜったいねむり'];
function statusBlockers(moveName, oppName, st){
  st = st || {};
  const out = [];
  const u = oppUsage(oppName);
  const mv = (u && u.m) || [];
  const has = n => mv.find(x=> x[0]===n);
  const cure = ((u && u.i)||[]).find(x=> x[0]==='ラムのみ' || x[0]==='カゴのみ');
  const ab = ((u && u.a)||[]).filter(x=> YAWN_ABILITY.includes(x[0]) && x[1] >= 10);

  if(moveName === 'あくび'){
    if(st.opSleep || st.opParalysis || st.opBurn || st.opPoison || st.opFreeze)
      out.push('相手はすでに状態異常＝あくびは入らない');
    ab.forEach(a=> out.push(`${a[0]}（${a[1]}%）で眠らない`));
    if(cure) out.push(`${cure[0]}（${cure[1]}%）で即回復される`);
    const t = has('ちょうはつ'); if(t) out.push(`ちょうはつ（${t[1]}%）で止められる`);
    const s = has('みがわり');   if(s) out.push(`みがわり（${s[1]}%）で無効`);
  }
  if(['どくどく','でんじは','おにび','キノコのほうし'].includes(moveName)){
    if(cure) out.push(`${cure[0]}（${cure[1]}%）で即回復される`);
    const t = has('ちょうはつ'); if(t) out.push(`ちょうはつ（${t[1]}%）で止められる`);
    if(moveName==='どくどく' && (SPECIES[oppName]||{types:[]}).types.some(x=> x==='どく'||x==='はがね'))
      out.push('どく・はがねには効かない');
    if(moveName==='でんじは' && (SPECIES[oppName]||{types:[]}).types.includes('じめん'))
      out.push('じめんには効かない');
    if(moveName==='おにび' && (SPECIES[oppName]||{types:[]}).types.includes('ほのお'))
      out.push('ほのおには効かない');
  }
  if(moveName === 'ふきとばし'){
    const su = has('みがわり'); if(su) out.push(`みがわり（${su[1]}%）の裏では失敗する`);
  }
  return out;
}

/* ★「この技で先に動けるか」を型ごとに出す（2026-08-21・v72・社長の要望）。
   「相手の素早さを警戒して、こっちが優先できそうだけど威力の弱い技を出したときに、
     実はこの技でも通った、本当はこの技を出したかったけど出せなかった、ということがある。
     それを瞬時に計算できない」
   ＝ 先制技を使うべき場面と、**素早さで足りているので強い技を撃ってよい場面**を分けたい。
   相手の素早さは型で大きく違う（最速・スカーフ・耐久）ので、**型ごとに**出す。
   採用率が分かるスカーフは率も添える。 */
function speedCheck(mine, oppName, st){
  st = st || {};
  const ms = mine.stats ? mine.stats.s
           : spreadStats(mine.name,{h:2,a:0,b:0,c:0,d:0,s:32},{a:1,b:1,c:1,d:1,s:1}).s;
  let myS = Math.floor(ms * rankMul(st.mySpeRank||0)) * (st.myParalysis?0.5:1) * (st.myTailwind?2:1);
  const WM = {'すなおこし':'すなあらし','ひでり':'にほんばれ','あめふらし':'あめ','ゆきふらし':'ゆき'};
  const eff = st.weather || WM[mine.ability||''] || '';
  if(eff && WEATHER_SPEED[eff] === (mine.ability||'')) myS *= 2;
  myS = Math.floor(myS);

  const ws = weatherSpeedAbility(oppName, eff);
  const rows = (assumedSpreads(oppName)||[]).map(sp=>{
    let s = Math.floor(sp.stats.s * rankMul(st.opSpeRank||0)) * (st.opParalysis?0.5:1) * (st.opTailwind?2:1);
    if(ws) s *= 2;
    s = Math.floor(s);
    return { label: sp.label || sp.kind, s, faster: myS > s,
             weight: sp.weight!=null ? Math.round(sp.weight*100) : null };
  }).sort((a,b)=> b.s-a.s);
  return {
    myS, rows,
    allSlower: rows.every(r=> r.faster),      // どの型より速い＝素早さで足りている
    allFaster: rows.every(r=> !r.faster),     // どの型にも抜かれる
    scarfRate: oppScarfRate(oppName),
    /* ★せんせいのツメ（v79）。20%で先制されるので「先に動ける」を言い切れなくなる。
       使用率データに載らないことが多いので、**社長が見て確定させたときだけ**出す。 */
    quickClaw: oppItemFixed(oppName)==='せんせいのツメ',
    weatherBoost: ws || null
  };
}

function movePlan(mine, oppName, opts){
  opts = opts || {};
  const st = opts.st || {};
  const os = SPECIES[oppName]; if(!os || !mine.stats) return null;
  const spreads = assumedSpreads(oppName);
  const oppAb = worstDefAbility(oppName);
  const oppImm = immuneType(oppAb);
  const leftPct = (opts.oppHPPct!=null) ? Math.max(0.01, Math.min(1, opts.oppHPPct)) : 1;
  /* 設置済みかどうかは rows を作る前に要る（下の PLACED と同じ内容） */
  const PLACED_NOW = { 'ステルスロック': st.opRocks, 'まきびし': st.opSpikes,
                       'どくびし': st.opTSpikes, 'ねばねばネット': st.opSticky };

  const spd = speedCheck(mine, oppName, st);      // ★型ごとの先手判定（v72）
  const rows = (mine.moves||[]).map(name=>{
    const mv = MOVES[name];
    if(!mv) return null;
    const pri = movePriority(name);
    if(!mv.power || mv.cat==='変'){
      /* ★変化技は「変化技」としか出していなかった。押す根拠を出す（v57） */
      const placedNow = PLACED_NOW[name];
      const hz = placedNow ? `もう撒いてあります` : hazardValue(name, opts.others);
      const bl = statusBlockers(name, oppName, st);
      const note = [hz, bl.length ? '通らない条件：' + bl.join('／') : '', PRIORITY_NOTE[name]||'']
                     .filter(Boolean).join(' ／ ');
      return { name, type:mv.type, cat:mv.cat, power:0, acc:mv.acc||100, pri,
               status:true, placed:!!placedNow, blockers:bl, note };
    }
    if(mv.type === oppImm) return { name, type:mv.type, cat:mv.cat, power:mv.power, acc:mv.acc||100,
                                    pri, immune:true, note:`${oppAb}で無効` };
    // 相手の3つの想定型すべてで計算し、いちばん硬い型を基準にする（過大評価しない）
    let lo=1e9, hi=1e9, effV=1;
    spreads.forEach(sp=>{
      const def = mv.cat==='物' ? sp.stats.b : sp.stats.d;
      const r = calcDamage({
        attacker:{name:mine.name, atkStat: mv.cat==='物'? mine.stats.a : mine.stats.c,
                  types:SPECIES[mine.name].types, ability:mine.ability||'', item:mine.item||'',
                  rank: mv.cat==='物'? (st.myAtkRank||0) : (st.mySpaRank||0), hpRatio:1,
                  intimidated: !!st.myIntimidated},
        defender:{name:oppName, defStat:def, hp:sp.stats.h, types:os.types, ability:oppAb, item:'',
                  rank: mv.cat==='物'? (st.opDefRank||0) : (st.opSpdRank||0), hpRatio:1},
        move:mv, field:{ weather:st.weather||'', reflect:!!st.opReflect, lightscreen:!!st.opLightscreen,
                         auroraveil:!!st.opAuroraveil, burn: mv.cat==='物' && !!st.myBurn,
                         oppFallen: st.myFallen||0 }, flags:{}
      });
      if(r.error) return;
      effV = r.eff;
      const l = r.min/sp.stats.h, h = r.max/sp.stats.h;
      if(l < lo) lo = l;                       // いちばん硬い型＝いちばん低い割合
      if(h < hi) hi = h;
    });
    if(lo===1e9) return { name, type:mv.type, cat:mv.cat, power:mv.power, acc:mv.acc||100, pri, immune:true };
    const hits = hi>0 ? Math.ceil(leftPct/hi) : 99;
    /* 優先度が正なら（相手も同じ優先度の技を撃たない限り）必ず先。
       優先度0同士は素早さ勝負なので、型ごとの判定をそのまま渡す。 */
    const first = pri>0 ? 'always' : (spd.allSlower ? 'always' : spd.allFaster ? 'never' : 'depends');
    return { name, type:mv.type, cat:mv.cat, power:mv.power, acc:mv.acc||100, pri, eff:effV,
             lo, hi, hits, koNow: hi >= leftPct, first, note:PRIORITY_NOTE[name]||'' };
  }).filter(Boolean);

  /* 相手が引っ込めることを想定する。控えの誰に通るかを技ごとに見る。 */
  const others = (opts.others||[]).filter(n=> n!==oppName && SPECIES[n]);
  rows.forEach(r=>{
    if(r.status || r.immune || !r.hi){ r.through = []; return; }
    r.through = others.filter(n=>{
      const o2 = assumedSpreads(n)[0]; if(!o2) return false;
      const ab2 = worstDefAbility(n);
      if(MOVES[r.name] && MOVES[r.name].type === immuneType(ab2)) return false;
      return effectiveness(MOVES[r.name].type, SPECIES[n].types) >= 1;
    });
  });

  // 撃つべき技を決める
  const dmg = rows.filter(r=> !r.status && !r.immune && r.hi>0);
  const koPri = dmg.filter(r=> r.koNow && r.pri>0).sort((a,b)=> b.pri-a.pri || b.hi-a.hi)[0];
  const koAny = dmg.filter(r=> r.koNow).sort((a,b)=> b.acc-a.acc || b.hi-a.hi)[0];
  const top   = dmg.sort((a,b)=> b.hi-a.hi)[0];
  /* ★相手に引っ込められることを想定する（社長の要望 2026-08-20）。
     こちらが有利で、しかも1発で落とせないなら、相手は高い確率で交代してくる。
     そこに中途半端な攻撃を当てても、交代先が受けて終わり＝1ターンを捨てることになる。
     その1ターンは、設置技や状態異常に使う方が、試合全体では得。 */
  const PLACED = { 'ステルスロック': st.opRocks, 'まきびし': st.opSpikes,
                   'どくびし': st.opTSpikes, 'ねばねばネット': st.opSticky };
  /* ★三項演算子の優先順位を間違えて、設置技が一度も選ばれない式になっていた（2026-08-20 修正）。
     PLACED[name] は「未設置なら undefined」なので、素直に否定するだけでよい。 */
  const HAZ = ['ステルスロック','まきびし','どくびし','ねばねばネット'];
  const hazard = rows.find(r=> r.status && HAZ.includes(r.name) && !PLACED[r.name]);
  /* ★通らないと分かっている技を推さない（v58）。
     ステロ済みの盤面で「あくび」を勧めながら、同じ行に
     「相手はすでに状態異常＝あくびは入らない」と書いていた。推奨と根拠が矛盾していた。 */
  const sleeper = rows.find(r=> r.status
    && ['あくび','キノコのほうし','おにび','どくどく','でんじは'].includes(r.name)
    && !(r.blockers||[]).length);

  let best = null, why = '';
  /* ★相手が眠っている間に何をするか（2026-08-21・v58）。社長の質問そのもの：
     「あくびで相手が眠り、じしんで削れる時、削り切るべきなのか、
       ふきとばしでステロを当ててまた眠らせに行くべきかが分からない」
     眠りは起きるまで数ターン。その数ターンで**何ができるか**で決める。
       ・2発以内で落とせる → 眠っている間に落とせる。**削り切るのが最も確実**
       ・3発以上かかる → 起きて反撃される。その前に**設置を置く**。置き終わっていれば
         **ふきとばしで流す**（交代先が設置を踏む＝眠っている相手を無傷で逃がさない） */
  const opAsleep = !!(st.opSleep || st.opFreeze);
  const phaze = rows.find(r=> r.status && ['ふきとばし','ドラゴンテール','ほえる'].includes(r.name));
  if(opAsleep && top && top.hi>0){
    const n = Math.ceil(leftPct/top.hi);
    if(n <= 2){
      best = top;
      why = `相手は動けません。<b>${top.name}なら${n}発</b>で落とせます。`
          + `起きる前に落とし切るのがいちばん確実です`;
    }else if(hazard){
      best = hazard;
      why = `相手は動けませんが、<b>${top.name}では${n}発</b>かかります（起きて反撃されます）。`
          + `この動けないターンは<b>${hazard.name}</b>に使ってください`;
    }else if(phaze){
      best = phaze;
      why = `相手は動けず、設置も置き終わっています。<b>${phaze.name}</b>で流すと、`
          + `出てくる駒が設置を踏みます（眠っている相手を無傷で逃がさない）`;
    }
  }
  if(!best && koPri){ best = koPri; why = `先制技で確実に落とせる（優先度+${koPri.pri}）`; }
  else if(!best && koAny){ best = koAny; why = koAny.acc<100 ? `1発で落とせる（命中${koAny.acc}%）` : '1発で落とせる'; }
  else if(!best && opts.likelySwitch && hazard){
    best = hazard;
    why = `1発では落とせず、この対面なら相手は<b>交代してくる</b>。中途半端に殴るより${hazard.name}を置く方が得`;
  }
  /* ★打点が薄い（3発以上かかる）なら、殴るより設置。
     相手6体に効き続ける設置の方が、1回17%の攻撃より明らかに得になる（v57）。
     上位勢の座談会「一生設置してるわけじゃなく、じしんとステロの押し所が難しい」への回答。 */
  else if(!best && hazard && top && top.hi>0 && Math.ceil(leftPct/top.hi) >= 3){
    best = hazard;
    /* ★2026-08-22：ここは movePlan の数字＝「いちばん硬い型」基準。
        callIt 側の myHits は「型の平均」基準なので、同じ技が 5発 と 4発 で並んでいた。
        数字は変えず、どちらの前提かを必ず書く。 */
    why = `いちばん硬い型で見ると、いちばん強い技でも${Math.ceil(leftPct/top.hi)}発かかります。`
        + `殴るより<b>${hazard.name}</b>の方が、相手6体に効き続けるぶん得`;
  }
  else if(!best && opts.likelySwitch && sleeper){
    best = sleeper;
    why = `1発では落とせず、相手は<b>交代してくる</b>。${sleeper.name}を入れて次につなぐ方が得`;
  }
  else if(!best && top){
    best = top;
    why = `いちばん削れる（${Math.round(top.lo*100)}〜${Math.round(top.hi*100)}%）`;
    // 交代されても通る技が別にあるなら、そこも伝える
    const wide = dmg.filter(r=> r!==top && r.through && r.through.length > (top.through||[]).length)
                    .sort((a,b)=> b.through.length-a.through.length)[0];
    if(wide) why += `。交代を読むなら<b>${wide.name}</b>（控え${wide.through.length}体に通る）`;
  }
  /* ★打点が1つも無い対面では best が null になり、「撃つ技」が空欄になっていた。
     引く判断でも、引く前の1ターンに何を置くかは必ず要る（社長が試合16で詰まった場面）。 */
  if(!best){
    const hz = rows.find(r=> r.status && HAZ.includes(r.name) && !PLACED[r.name] && !(r.blockers||[]).length);
    /* ★2026-08-22 修正：ここで**もう撒いてある設置技**を拾っていた。
       同じ行に「もう撒いてあります」と書きながら、見出しでは「撃つ技…ステルスロック」と
       推し続けていた（疑似対戦で実際に踏んだ）。placed は blockers とは別物なので明示的に外す。 */
    const sl = rows.find(r=> r.status && !r.placed && !(r.blockers||[]).length);
    best = hz || sl || rows.find(r=> r.status && !r.placed) || rows.find(r=> r.status) || rows[0] || null;
    if(best) why = hz ? `攻撃が通らない対面。引く前に<b>${best.name}</b>を置いておくと、この1ターンが無駄にならない`
                      : `攻撃が通りません。<b>${best.name}</b>で次につなぐか、引くこと`;
  }
  return { rows, best, why, speed:spd };
}

function bestOffense(mine, oppName, opp, st){
  st = st || {};
  const os = SPECIES[oppName]; if(!os) return {rate:0, move:null};
  const hp = opp.stats.h;
  const oppAb = worstDefAbility(oppName);          // 相手の特性（マルチスケイル等）
  const oppImm = immuneType(oppAb);                // ふゆう・もらいび等で無効化されるタイプ
  const myStats = mine.stats || spreadStats(mine.name, {h:2,a:32,b:0,c:32,d:0,s:32}, {a:1,b:1,c:1,d:1,s:1});
  const moves = (mine.moves||[]).map(m=>MOVES[m]).filter(m=>m && m.power && m.cat!=='変');
  // 技が未登録ならタイプ一致の代表技で見積もる
  const cands = moves.length ? moves
    : SPECIES[mine.name].types.map(t=>({name:'（'+t+'技）', type:t, cat: (myStats.a>=myStats.c?'物':'特'), power:REP_POWER, contact:false}));
  let best={rate:0, move:null};
  cands.forEach(mv=>{
    if(mv.type === oppImm) return;                  // 相手の特性でタイプごと無効
    const atk = mv.cat==='物' ? myStats.a : myStats.c;
    const def = mv.cat==='物' ? opp.stats.b : opp.stats.d;
    const r = calcDamage({
      attacker:{name:mine.name, atkStat:atk, types:SPECIES[mine.name].types, ability:mine.ability||'',
                item:mine.item||'', rank: mv.cat==='物'? (st.myAtkRank||0) : (st.mySpaRank||0),
                hpRatio:1, intimidated: !!st.myIntimidated},
      defender:{name:oppName, defStat:def, hp, types:os.types, ability:oppAb, item:'',
                rank: mv.cat==='物'? (st.opDefRank||0) : (st.opSpdRank||0), hpRatio:1},
      move:mv, field:{ weather:st.weather||'', reflect:!!st.opReflect, lightscreen:!!st.opLightscreen,
                       auroraveil:!!st.opAuroraveil, burn: mv.cat==='物' && !!st.myBurn }, flags:{}
    });
    if(r.error || r.eff===0) return;
    const rate = ((r.min + r.max)/2) / hp;
    if(rate > best.rate) best = {rate, move:mv.name};
  });
  return best;
}
/** 相手の最大打点（自分のHPに対する割合）。opp は assumedSpreads() の1要素
 *
 *  ★2026-08-19 全面書き直し。旧実装には致命的な2つの誤りがあった：
 *    (1) 相手の「タイプ一致技」しか計算していなかった
 *        → カイリュー(ドラゴン/ひこう)の ほのお技 を1度も計算していない。
 *          実データではカイリューの最多採用技は かえんほうしゃ 63.8%。半数以上が持つ技を無視していた。
 *    (2) 威力を一律90で見積もっていた
 *        → りゅうせいぐん130 / だいもんじ110 / オーバーヒート130 を大幅に過小評価。
 *    結果、メガクチートが受けるだいもんじを「28〜37%」と表示（実際は最大130%＝一撃死）。
 *
 *  いまは app/data/usage.js の実採用技をそのまま撃たせる。データが無い種だけ従来方式にフォールバック。
 *  返り値の rate は平均乱数、rateHi は最大乱数（一撃で落ちるかの判定はこちらで見る）。 */
function bestThreat(oppName, mine, opp, known, st){
  st = st || {};
  const os = SPECIES[oppName], ms = SPECIES[mine.name];
  if(!os || !ms) return {rate:0, rateHi:0, type:null, move:null};
  const myStats = mine.stats || spreadStats(mine.name, {h:32,a:0,b:17,c:0,d:17,s:0}, {a:1,b:1,c:1,d:1,s:1});
  const imm = immuneType(mine.ability);

  const real = oppMoves(oppName);
  /* ★試合中に「この技を撃ってきた」と記録した技があれば、それを最優先で使う。
     ポケモンの技は4つまでなので、4つ確定したら他の技は撃たれない＝想定を確定に置き換えられる。 */
  const conf = confirmedMoves(oppName, known);
  let cands, estimated = false;
  if(conf && conf.full){
    cands = conf.list;                     // 4つ確定＝これ以外は飛んでこない
  }else if(real){
    cands = conf ? dedupeMoves(conf.list.concat(real)) : real;
  }else{
    // 実データが無い種：従来どおりタイプ一致・代表威力で見積もる（あくまで暫定値）
    estimated = true;
    const physical = opp.stats.a >= opp.stats.c;
    cands = os.types.map(t=>({ name:'（'+t+'技）', type:t, cat: physical?'物':'特',
                               power:REP_POWER, contact:false, rate:null }));
    if(conf) cands = dedupeMoves(conf.list.concat(cands));
  }

  const atkOf = cat => (opp.atk && opp.atk[cat] != null) ? opp.atk[cat]
                     : (cat==='物' ? opp.stats.a : opp.stats.c);

  /* ★2026-08-19 追記：採用率を判定に入れる。
     以前は「いちばん痛い技」だけで結論を出していたので、
     ギャラドス vs ガブリアス で「どの型でも不利・引く」と表示していた。
     しかし実際は 主力の じしん(採用99.3%) は ひこうタイプに無効で、
     不利判定を出していたのは げきりん(採用30.2%)＝7割のガブリアスは持っていない技だった。
     → 「ほぼ確実に食らう技(60%以上)」と「持っていれば痛い技(それ未満)」を分けて返す。 */
  const SURE = 60;                                   // これ以上の採用率＝ほぼ全個体が持っている
  const atkAb = oppAtkAbility(oppName);   // ★攻撃に効く特性。ここを渡していなかった（v56）
  const rows = [], immune = [];
  cands.forEach(mv=>{
    if(mv.type === imm) return;                       // こちらの特性でタイプごと無効
    // 採用率25%以上の打点アイテムだけ乗せる。タイプ強化アイテムはそのタイプの技にだけ効く
    const item = oppOffenseItem(oppName, mv.cat)
              || (oppTypeItem(oppName, mv.type) ? 'タイプ強化アイテム' : '');
    const r = calcDamage({
      attacker:{name:oppName, atkStat: atkOf(mv.cat), types:os.types, ability:(atkAb?atkAb.name:''), item,
                rank: mv.cat==='物'? (st.opAtkRank||0) : (st.opSpaRank||0), hpRatio:1,
                intimidated: mv.cat==='物' && !!st.opIntimidated},
      defender:{name:mine.name, defStat: mv.cat==='物'?myStats.b:myStats.d, hp:myStats.h,
                types:ms.types, ability:mine.ability||'', item:mine.item||'',
                rank: mv.cat==='物'? (st.myDefRank||0) : (st.mySpdRank||0), hpRatio:1},
      move:mv, field:{ weather:st.weather||'', reflect:!!st.myReflect, lightscreen:!!st.myLightscreen,
                       auroraveil:!!st.myAuroraveil, burn: mv.cat==='物' && !!st.opBurn,
                       oppFallen: st.opFallen||0 }, flags:{}
    });
    if(r.error) return;
    if(r.eff===0){                                    // タイプ相性で無効＝この技には出し得る
      immune.push({ move:mv.name, type:mv.type, rateOf:(mv.rate==null?100:mv.rate) });
      return;
    }
    rows.push({ rate:((r.min + r.max)/2)/myStats.h, rateHi: r.max/myStats.h,
                type:mv.type, move:mv.name, rateOf: (mv.rate==null?100:mv.rate),
                confirmed: !!mv.confirmed, item });
  });
  const pick = list => list.reduce((a,b)=>
    (b.rate > a.rate + 1e-9 || (Math.abs(b.rate-a.rate)<1e-9 && b.rateOf > a.rateOf)) ? b : a,
    list[0]);

  const empty = {rate:0, rateHi:0, type:null, move:null, rateOf:null, item:''};
  immune.sort((a,b)=> b.rateOf - a.rateOf);
  if(!rows.length) return {...empty, estimated, sure:{...empty}, threatRate:0, hitting:[], rows:[], immune};

  const best = pick(rows);                                   // 最悪ケース（低採用率の技も含む）
  // 観測で確定した技があるなら、それは採用率100%として扱う
  const sureRows = rows.filter(r=> r.confirmed || r.rateOf >= SURE);
  const sure = sureRows.length ? pick(sureRows) : {...empty};

  return { ...best, estimated, sure,
    // その相手のうち「こちらに有効打(3割以上)を持っている型」の最大採用率。
    // これが低いほど「持っていれば痛いが、たいてい持っていない」
    threatRate: Math.max(0, ...rows.filter(r=> r.rate >= 0.3).map(r=> r.rateOf)),
    hitting: rows.filter(r=> r.rate >= 0.25).sort((a,b)=> b.rate-a.rate)
                 .map(r=>({move:r.move, rateOf:r.rateOf, lo:r.rate, hi:r.rateHi})),
    rows: rows.slice().sort((a,b)=> b.rate-a.rate), atkAbility: atkAb,
    /* こちらのタイプ／特性で完全に無効化できる相手の技。
       ギャラドスはガブリアスの じしん(採用99.3%) を無効化できる＝この技に交代で合わせられる。
       これは「不利かどうか」とは別の、実戦で最も使える情報なので必ず持ち回る。 */
    immune };
}

/** こちら側が「1発だけ耐える」手段を持っているか。
 *  きあいのタスキ（HP満タンから）／ばけのかわ／がんじょう は、相手の必要打数を実質+1する。
 *  ここを見ていないと、タスキゲッコウガやミミッキュが全部「一撃で落ちる」と出てしまう。 */
function myOneHitGuard(mine){
  if(mine.guardGone) return '';      // 試合中に「もう剥がれた／使った」と指定された
  if(mine.item === 'きあいのタスキ') return 'きあいのタスキ';
  if(mine.ability === 'ばけのかわ')  return 'ばけのかわ';
  if(mine.ability === 'がんじょう')  return 'がんじょう';
  return '';
}

/** 自分1体 × 相手の想定1通り を採点 */
function matchupVs(mine, oppName, opp, known, st){
  st = st || {};
  let myS = mine.stats ? mine.stats.s : spreadStats(mine.name,{h:2,a:0,b:0,c:0,d:0,s:32},{a:1,b:1,c:1,d:1,s:1}).s;
  let opS = opp.stats.s;
  // 積み・まひ・おいかぜは行動順をひっくり返すので、素早さにも必ず効かせる
  myS = Math.floor(myS * rankMul(st.mySpeRank||0)) * (st.myParalysis?0.5:1) * (st.myTailwind?2:1);
  opS = Math.floor(opS * rankMul(st.opSpeRank||0)) * (st.opParalysis?0.5:1) * (st.opTailwind?2:1);
  /* ★天候で素早さが2倍になる特性（v58）。ここを見ていなかったので、
     砂を撒いた瞬間にハカドッグ(すなかき)に抜かれることを一度も警告できていなかった。
     こちら側にも同じ規則を当てる（構築に該当者がいれば効く）。 */
  /* ★この駒の特性が天候を作るなら、天候は「確実に起きる」ので織り込む（推測ではない）。
     カバルドン（すなおこし）は場に出た時点で砂が降る。
     以前は st.weather が空だと砂なしで計算していたので、
     カバルドン vs ハカドッグ(すなかき67.1%) を「◎」と言い切っていた。 */
  const WEATHER_MAKER = {'すなおこし':'すなあらし','ひでり':'にほんばれ','あめふらし':'あめ','ゆきふらし':'ゆき'};
  const effWeather = st.weather || WEATHER_MAKER[mine.ability||''] || '';
  const opWS = weatherSpeedAbility(oppName, effWeather);
  if(opWS) opS *= 2;
  const myWA = mine.ability || '';
  if(effWeather && WEATHER_SPEED[effWeather] === myWA) myS *= 2;
  myS = Math.floor(myS); opS = Math.floor(opS);
  const faster = myS > opS;

  /* ★いかくは場に出た瞬間に必ず発動する。盤面の手入力を待たずに効かせる（v60）。
     まけんき／かちき の相手は逆に攻撃が上がるので、その場合は相手の攻撃ランクを+2する。 */
  let intim = null;
  if((mine.ability||'') === 'いかく'){
    intim = intimidateEffect(oppName);
    if(intim.kind === 'down' && !st.opIntimidated) st = {...st, opIntimidated:true};
    if(intim.kind === 'up')  st = {...st, opAtkRank:(st.opAtkRank||0)+2, opSpaRank:(st.opSpaRank||0)+2};
  }
  const off = bestOffense(mine, oppName, opp, st);      // 自分→相手 のダメージ割合
  const thr = bestThreat(oppName, mine, opp, known, st); // 相手→自分 のダメージ割合

  // 何発で落とせるか / 落とされるか
  let myHits = off.rate>0 ? Math.ceil(1/off.rate) : 99;
  let opHits = thr.rate>0 ? Math.ceil(1/thr.rate) : 99;
  // 相手の最大乱数で何発か。ここを見ていなかったので「2発耐える」が実際は一撃だった
  let opHitsHi = thr.rateHi>0 ? Math.ceil(1/thr.rateHi) : 99;
  const guard = myOneHitGuard(mine);
  /* ★連続技はタスキ／ばけのかわ／がんじょうを1段目で剥がし、残りの段で殴ってくる。
     ここで無条件に +1 していたので、タスキのキラフロルもミミッキュも実際より安全に見えていた。 */
  const guardBroken = !!multiHitOf(thr.move);
  if(guard && !guardBroken){ if(opHits<99) opHits += 1; if(opHitsHi<99) opHitsHi += 1; }
  // ばけのかわ／がんじょうは1発を確実に無効化する＝必要打数が1増える
  if(myHits<99 && survivesOneHit(oppName)) myHits += 1;

  // 先に落とせるか（同じ発数なら速い方が勝ち）
  const winsRace = myHits < opHits || (myHits === opHits && faster);
  const guardEff = (guard && !guardBroken) ? guard : '';   // 実際に効いている1発耐え

  /* ★「受けられる」ことの価値。
     相手の打点が薄くて4発以上かかるなら、こちらが殴り切れなくてもその対面は"止まっている"。
     回復技があれば実質無限に受けられるので、さらに価値が上がる。
     ここを入れていなかったので、受け・起点作りの駒が選出に一度も出てこなかった。 */
  const role = myRoles(mine);
  const wallsIt = opHits >= 4;                       // 相手はこちらを落とすのに4発以上かかる
  const stallsIt = wallsIt && !!role.recover;        // 回復があるので受け切れる
  let wallBonus = 0;
  if(wallsIt)  wallBonus += 0.7;
  if(stallsIt) wallBonus += 0.9;
  if(wallsIt && (role.status || role.phase)) wallBonus += 0.4;   // 受けながら機能停止/流しができる

  // スコア：発数差 ＋ 速さ ＋ 打点の厚み ＋ 受けられることの価値
  const score = (opHits - myHits) * 0.9 + (faster ? 0.35 : -0.2) + (off.rate - thr.rate) * 1.1 + wallBonus;

  // 明確に不利＝初手に置いてはいけない対面
  // 相手の最大乱数で一撃で落ちるなら、先制できても「1回でも読み負けたら終わり」なので危険扱い
  const danger = (!winsRace && thr.rate >= 0.5) || (opHits <= 2 && myHits >= 4)
              || (!guard && thr.rateHi >= 1.0 && myHits >= 2);

  // 「ほぼ確実に持っている技(採用60%以上)」だけで見た場合の必要打数
  const sureDmg  = thr.sure ? thr.sure.rate : 0;
  const sureHits = sureDmg>0 ? Math.ceil(1/sureDmg) + ((guard && !multiHitOf(thr.sure&&thr.sure.move))?1:0) : 99;
  const winsRaceSure = myHits < sureHits || (myHits === sureHits && faster);

  return { kind:opp.kind, label:opp.label, weight:opp.weight, oppItem:opp.item||'',
           faster, myS, opS, score, winsRace, danger,
           myDmg:off.rate, myMove:off.move, myHits,
           opDmg:thr.rate, opDmgHi:thr.rateHi, opType:thr.type, opMove:thr.move,
           opMoveRate:thr.rateOf, opMoveItem:thr.item, opEstimated:thr.estimated,
           opSureDmg:sureDmg, opSureDmgHi: thr.sure?thr.sure.rateHi:0,
           opSureMove: thr.sure?thr.sure.move:null, opSureRate: thr.sure?thr.sure.rateOf:null,
           wallsIt, stallsIt, roles:role,
           sureHits, winsRaceSure, threatRate: thr.threatRate||0, hitting: thr.hitting||[],
           oppRows: thr.rows||[], immuneMoves: thr.immune||[], opAtkAbility: thr.atkAbility||null,
           opHits, opHitsHi, guard: guardEff, guardRaw: guard, guardBroken, opWeatherSpeed: opWS, effWeather, intimidate: intim,
           opMultiHit: multiHitOf(thr.move) ? thr.move : null };
}

/* 同じ (自分の個体 × 相手) の組み合わせは何度も出てくるので結果を使い回す */
const _muCache = new Map();
function _muKey(mine, oppName, known, board){
  const sv = mine.stats ? [mine.stats.h,mine.stats.a,mine.stats.b,mine.stats.c,mine.stats.d,mine.stats.s].join('.') : '-';
  return [mine.name, sv, (mine.moves||[]).join('/'), mine.ability||'', mine.item||'', oppName,
          (known||[]).join(','), mine.guardGone?'g0':'',
          board ? JSON.stringify(board) : ''].join('|');
}

/** 自分1体 vs 相手1体。相手の型は「攻撃型」「耐久型」の2通りで見て、
 *  主想定（種族値から見てありそうな方）の結論を返しつつ、
 *  もう一方と結論が割れたら split=true で知らせる。 */
function matchup(mine, theirs){
  const ms = SPECIES[mine.name], ts = SPECIES[theirs.name];
  if(!ms || !ts) return null;
  const known = theirs.known || null;          // 試合中に観測した相手の技
  const st = theirs.st || null;               // 盤面の状態（積み・天候・状態異常・壁）
  const key = _muKey(mine, theirs.name, known, st);
  const hit = _muCache.get(key); if(hit) return hit;

  const spreads = assumedSpreads(theirs.name);
  if(!spreads.length) return null;
  const views = spreads.map(sp=> matchupVs(mine, theirs.name, sp, known, st));

  // 主想定＝ありそうな方。表示する結論はこちらに合わせる
  const primary = views.reduce((a,b)=> b.weight > a.weight ? b : a);
  const other   = views.find(v=> v !== primary) || primary;

  // 型が割れると結論が変わるか
  const split = views.some(v=> v.winsRace !== primary.winsRace)
             || views.some(v=> v.danger   !== primary.danger);

  const wsum = views.reduce((s,v)=> s + v.weight, 0) || 1;
  const wavg = f => views.reduce((s,v)=> s + v.weight * f(v), 0) / wsum;

  const out = {
    ...primary,
    // 行動順は外すと致命的なので、いちばん速い型を基準にする（全部より速い時だけ「先制」）
    faster: views.every(v=>v.faster),
    fasterAny: views.some(v=>v.faster),
    opS: Math.max(...views.map(v=>v.opS)),
    // スカーフ想定は行動順を大きく変えるので、素の最大値と分けて持つ（画面で「253」だけ出すと嘘になる）
    opSNoScarf: Math.max(...views.filter(v=>v.kind!=='scarf').map(v=>v.opS)),
    opSScarf: (views.find(v=>v.kind==='scarf')||{}).opS || null,
    score: wavg(v=>v.score),
    myDmg: wavg(v=>v.myDmg),
    opDmg: wavg(v=>v.opDmg),
    myDmgLo: Math.min(...views.map(v=>v.myDmg)), myDmgHi: Math.max(...views.map(v=>v.myDmg)),
    opDmgLo: Math.min(...views.map(v=>v.opDmg)), opDmgHi: Math.max(...views.map(v=>v.opDmgHi)),
    opMove: primary.opMove, opMoveRate: primary.opMoveRate, opEstimated: primary.opEstimated,
    /* 「ほぼ確実に持っている技」だけで見た結論。採用率の低い技1本で
       『どの型でも不利』と言い切っていた誤りを防ぐために分けて持つ。 */
    opSureDmg: wavg(v=>v.opSureDmg),
    opSureDmgHi: Math.max(...views.map(v=>v.opSureDmgHi)),
    opSureMove: primary.opSureMove, opSureRate: primary.opSureRate,
    winsAllSure: views.every(v=>v.winsRaceSure),
    threatRate: primary.threatRate,        // こちらに有効打を持つ型の最大採用率(%)
    hitting: primary.hitting,              // 通ってくる技の一覧（採用率つき）
    oppRows: primary.oppRows,              // 相手の技ごとの被ダメージ（採用率つき）
    immuneMoves: primary.immuneMoves,      // こちらに完全に効かない相手の技
    // 主力（採用率の高い技）が1つも通らない＝相性で受けられている
    wallsMain: primary.opSureDmg === 0 && primary.opDmg > 0,
    // 一撃で落とされうる型がひとつでもあるか（最大乱数基準）
    // 一撃で落とされうるか（最大乱数基準）。タスキ・ばけのかわで耐えるなら false にする
    opOHKO: !primary.guard && views.some(v=> v.opDmgHi >= 1.0),
    opOHKOMove: (views.find(v=> v.opDmgHi >= 1.0)||{}).opMove || null,
    opOHKORate: (views.find(v=> v.opDmgHi >= 1.0)||{}).opMoveRate,
    guard: primary.guard,
    split, views, primary, other,
    // 「どの型でも勝てる／どの型でも負ける」は選出の判断に直結するので別に持つ
    winsAll:  views.every(v=>v.winsRace),
    dangerAll:views.every(v=>v.danger),
    // どの型が相手でも受けられる＝殴り切れなくてもその相手は止まっている
    wallsAll: views.every(v=>v.wallsIt),
    stallsAll:views.every(v=>v.stallsIt),
    roles: primary.roles
  };
  /* ★決め手があるか。
     最大の乱数でも3発かかる＝実戦では回復・交代・積みで必ず巻き返される。
     ここを見ていなかったせいで「ギャラドス vs ユキノオー(最大28%)」が▲、
     「ゲッコウガ vs ブラッキー(最大33%)」が◎と表示され、実戦で1戦落とした。 */
  out.noOffense = out.myDmgHi < 0.34;
  out.noDefense = out.opDmgHi >= 1.0;        // 相手の最大打点(最大乱数)で一撃で落ちる
  if(out.opOHKO){ out.winsAll = false; }     // 一撃で落とされうるなら「どの型でも勝てる」は嘘
  if(out.noOffense){ out.winsAll = false; }  // 打点が無いなら「勝てる」とは言わせない
  _muCache.set(key, out);
  return out;
}

/* ---------- 実戦中の逆算：残りHPを入れるだけで全部答える ----------
   試合の1手は45秒しかない。技名を選ばせている時間は無いので、
   相手の実採用技をこちらで全部試して「どれが当たったか」を機械が特定する。
   出るもの：撃たれた技の候補／否定できた技・型・持ち物／あと何発耐えるか／いま殴るか引くか。 */

/** 相手が持ちうる持ち物のうち、ダメージ計算に影響するものを実データから拾う */
function oppItemCandidates(oppName){
  if(oppName.startsWith('メガ')) return [''];        // メガストーン固定
  const u = oppUsage(oppName);
  const list = [''];
  (u ? (u.i||[]) : []).forEach(([it,rate])=>{
    if(rate < 3) return;
    if(OFFENSE_ITEMS[it] || TYPE_ITEMS[it]) list.push(it);
  });
  return [...new Set(list)];
}
/** calcDamage に渡す item 名へ変換（タイプ強化アイテムは技タイプが合う時だけ効く） */
function itemForCalc(item, moveType){
  if(!item) return '';
  if(OFFENSE_ITEMS[item]) return item;
  if(TYPE_ITEMS[item]) return TYPE_ITEMS[item]===moveType ? 'タイプ強化アイテム' : '';
  return '';
}

/** @param mine  自分の駒（stats付き）
 *  @param oppName 相手
 *  @param hpNow 自分の残りHP（実数値）
 *  @param field {weather, reflect, lightscreen, auroraveil} 任意 */
/** 盤面の状態を calcDamage の field 形に変換する */
function boardField(st){
  st = st || {};
  return { weather: st.weather||'', reflect: !!st.myReflect, lightscreen: !!st.myLightscreen,
           auroraveil: !!st.myAuroraveil, burn: !!st.opBurn };
}
function readDamage(mine, oppName, hpNow, field, known, st){
  st = st || {};
  const ms = SPECIES[mine.name], os = SPECIES[oppName];
  if(!ms || !os || !mine.stats) return null;
  const maxHP = mine.stats.h;
  hpNow = Math.max(0, Math.min(maxHP, hpNow|0));
  const taken = maxHP - hpNow;
  const conf = confirmedMoves(oppName, known);
  const usage = (conf && conf.full) ? conf.list
              : (conf ? dedupeMoves(conf.list.concat(oppMoves(oppName)||[])) : oppMoves(oppName));
  const items = oppItemCandidates(oppName);
  const spreads = assumedSpreads(oppName);
  const imm = immuneType(mine.ability);

  /* 与えられた技リストで総当たりし、受けたダメージに一致する組み合わせを返す */
  const roll = (moveList)=>{
    const all = [];
    moveList.forEach(mv=>{
      if(mv.type === imm) return;
      spreads.forEach(sp=>{
        items.forEach(it=>{
          const item = itemForCalc(it, mv.type);
          if(it && !item) return;
          const atk = (sp.atk && sp.atk[mv.cat]!=null) ? sp.atk[mv.cat]
                    : (mv.cat==='物' ? sp.stats.a : sp.stats.c);
          const r = calcDamage({
            attacker:{name:oppName, atkStat:atk, types:os.types, ability:'', item,
                      rank: mv.cat==='物'? (st.opAtkRank||0) : (st.opSpaRank||0), hpRatio:1,
                      intimidated: mv.cat==='物' && !!st.opIntimidated},
            defender:{name:mine.name, defStat: mv.cat==='物'?mine.stats.b:mine.stats.d, hp:maxHP,
                      types:ms.types, ability:mine.ability||'', item:mine.item||'',
                      rank: mv.cat==='物'? (st.myDefRank||0) : (st.mySpdRank||0), hpRatio:1},
            move:mv, field:field||{}, flags:{}
          });
          if(r.error || r.eff===0) return;
          all.push({ move:mv.name, rate:mv.rate, type:mv.type, cat:mv.cat, power:mv.power,
                     spread:sp.label, item: it||'持ち物なし', min:r.min, max:r.max,
                     lo:r.min/maxHP, hi:r.max/maxHP });
        });
      });
    });
    return all;
  };
  const group = rows =>{
    const by = {};
    rows.forEach(r=>{ const b = by[r.move] = by[r.move] || {name:r.move, rate:r.rate, cat:r.cat,
        type:r.type, power:r.power, spreads:new Set(), items:new Set(), lo:1, hi:0};
      b.spreads.add(r.spread); b.items.add(r.item); b.lo=Math.min(b.lo,r.lo); b.hi=Math.max(b.hi,r.hi); });
    return Object.values(by).map(b=>({...b, spreads:[...b.spreads], items:[...b.items]}))
      .sort((a,b)=> (b.rate||0)-(a.rate||0) || b.power-a.power);
  };

  const base = usage || os.types.map(t=>({ name:'（'+t+'技）', type:t,
    cat:(os.base.a>=os.base.c?'物':'特'), power:REP_POWER, contact:false, rate:null }));
  const all = roll(base);
  if(!all.length){
    // 相手の技が1つも通らない（全部タイプ相性で無効）。left が無いと呼び出し側が落ちるので必ず返す
    const g = myOneHitGuard(mine);
    return { maxHP, hpNow, taken, takenPct: taken/maxHP, empty:true,
             notHitYet: taken<=0, candidates:[], others:[],
             ruledOut:{moves:[],items:[],spreads:[]}, fromFullList:false,
             left:{ worst:99, worstMove:null, worstPct:0, diesNext:false, guard:g, guardAlive:!!g } };
  }

  /* あと何発耐えるか。タスキ／ばけのかわ／がんじょうは満タンからの1発を無効化する。 */
  const worstRow = all.reduce((a,b)=> b.max>a.max ? b : a, all[0]);
  const guard = myOneHitGuard(mine);
  /* ★連続技は1段目で剥がすので「あと1発耐える」は成立しない（v55） */
  const guardAlive = !!guard && !multiHitOf(worstRow.move)
                     && (guard!=='きあいのタスキ' ? hpNow>0 : hpNow>=maxHP);
  const survives = dmg => dmg<=0 ? 99 : Math.max(0, Math.ceil(hpNow / dmg)) + (guardAlive?1:0);

  const out = {
    maxHP, hpNow, taken, takenPct: taken/maxHP,
    notHitYet: taken <= 0,
    candidates: [], others: [], ruledOut: { moves:[], items:[], spreads:[] }, fromFullList:false,
    left: {
      worst: survives(worstRow.max), worstMove: worstRow.move, worstPct: worstRow.max/maxHP,
      diesNext: hpNow>0 && !guardAlive && worstRow.max >= hpNow,
      guard, guardAlive
    }
  };
  if(out.notHitYet) return out;                 // まだ殴られていない＝逆算しない

  const hit = all.filter(r=> taken >= r.min-1 && taken <= r.max+1);
  const uniq = (arr,k)=> [...new Set(arr.map(x=>x[k]))];
  out.candidates = group(hit);
  out.ruledOut = {
    moves:   uniq(all,'move').filter(m=> !out.candidates.some(c=>c.name===m)),
    items:   uniq(all,'item').filter(i=> !hit.some(h=>h.item===i)),
    spreads: uniq(all,'spread').filter(l=> !hit.some(h=>h.spread===l))
  };
  /* 一致する技が候補に無い＝採用率10%未満の技（社長が食らった だいもんじ がこれ）。
     全497技から探し直すが、ノイズを避けるため
     「相手が実際に使っているタイプ」か「タイプ一致」の技だけに絞り、自爆技は外す。 */
  if(!out.candidates.length){
    const usedTypes = new Set((usage||[]).map(m=>m.type));
    const SELF_KO = ['だいばくはつ','じばく','ミストバースト','いのちがけ','クロスサンダー','クロスフレイム'];
    const full = Object.values(MOVES).filter(m=> m.power && m.cat!=='変'
      && (usedTypes.has(m.type) || os.types.includes(m.type)) && !SELF_KO.includes(m.name));
    const hit2 = roll(full).filter(r=> taken >= r.min-1 && taken <= r.max+1);
    out.others = group(hit2).sort((a,b)=>{
      const sc = x => (usedTypes.has(x.type)?4:0) + (os.types.includes(x.type)?2:0);
      return sc(b)-sc(a) || b.power-a.power;
    }).slice(0,4);
    out.fromFullList = true;
  }
  // 今のダメージ源が続いた場合に何発耐えるか
  const src = out.candidates.length ? out.candidates : out.others;
  if(src.length){
    const srcMax = Math.max(...src.map(c=> Math.round(c.hi*maxHP)));
    out.left.sameMove = survives(srcMax);
    out.left.sameMoveName = src[0].name;
    out.left.diesNextToSame = hpNow>0 && !guardAlive && srcMax >= hpNow;
  }
  return out;
}

/* ---------- 結論を出す唯一の場所 ----------
   選出画面・対面画面・実戦モードで別々に判定していたため、同じ対面なのに言うことが違っていた。
   さらに「採用率の低い技1本」で不利判定を出していた（ギャラドス vs ガブリアス：
   主力の じしん99.3% は ひこうに無効なのに、げきりん30.2% で『どの型でも不利』と表示）。
   ここに一本化し、採用率を必ず添える。 */
const SURE_RATE = 60;   // これ以上の採用率＝ほぼ全個体が持っている前提で判定してよい

/** 対面ひとつの結論。すべての画面はこれを使うこと。
 *  ★判定は「技1本の採用率」ではなく「こちらに勝てる技を持っている型の合計採用率」で出す。
 *    ミミッキュ vs ドラパルト は ゴーストダイブ27.1% と シャドーボール44.7% の
 *    どちらでも落とされるので、合わせて約72%が一撃を持っている。
 *    単一技の採用率だけを見ると「44.7%だから半々」と誤る。 */
function callIt(mine, oppName, opts){
  opts = opts || {};
  const known = opts.known || null;
  const st = opts.st || null;                 // 盤面（積み・天候・状態異常・壁・設置）
  // ばけのかわ・タスキが「もう無い」状態を指定できる（剥がれた後は判定が別物になる）
  if(opts.guardGone) mine = {...mine, guardGone:true};
  const mu = matchup(mine, {name:oppName, known, st});
  if(!mu) return null;
  const hpNow = (opts.myHP!=null && mine.stats) ? opts.myHP : null;
  const rd = hpNow!=null ? readDamage(mine, oppName, hpNow, boardField(st), known, st) : null;

  // 相手の残りHP(%)が分かっていれば、あと何発で落とせるかを補正する
  const oppLeft = (opts.oppHPPct!=null) ? Math.max(0.01, Math.min(1, opts.oppHPPct)) : 1;
  let myHits = mu.myDmg>0 ? Math.max(1, Math.ceil(oppLeft / mu.myDmg)) : 99;
  /* ★相手のきあいのタスキ／がんじょうは、HP満タンからの1発を必ず耐える。
     満タン(oppLeft>=1)のときだけ効くので、削れている相手には適用しない。 */
  let opGuard = (oppLeft >= 1) ? oppOneHitGuard(oppName) : null;
  /* ★先制技で「低乱数でも」落とせるか。結論より先に要る（下の priKO の枝で使う）。
     movePlan をここで一度回す。likelySwitch は結論が決まってからでないと渡せないので、
     ここでは渡さない（この呼び出しは koNow の判定だけに使い、best は下の本番の呼び出しで決める）。 */
  let priKO = null;
  try{
    const pre = movePlan(mine, oppName, {st, oppHPPct:opts.oppHPPct, others:opts.oppTeam||[]});
    priKO = (pre && pre.rows ? pre.rows : [])
      .filter(r=> !r.status && !r.immune && r.pri>0 && r.lo >= oppLeft && (r.acc||100) >= 100)
      .sort((a,b)=> b.pri-a.pri || b.lo-a.lo)[0] || null;
  }catch(e){ priKO = null; }
  /* ★こちらの打点が連続技なら、相手のタスキ／がんじょうは1段目で剥がれる。
     v54で相手の「1発耐える」を入れた裏返しで、ここを見ないと逆に過大に警戒することになる。 */
  if(opGuard && multiHitOf(mu.myMove)) opGuard = null;
  if(opGuard && myHits <= 1) myHits = 2;
  // こちらの残りHPが分かっていれば、その割合で相手の必要打数を計算する
  const myLeft = (rd && rd.maxHP) ? rd.hpNow/rd.maxHP : 1;
  /* ★1発耐える手段は「技ごと」に判定する（v55の修正）。
     連続技だけがタスキ／ばけのかわ／がんじょうを貫通する。
     ここを技ごとにせず一律で消したところ、トリプルアクセルを持つ相手に対して
     ばけのかわが単発技にも効かない扱いになり、ミミッキュが不当に✕になった。 */
  const rows = (mu.oppRows||[]).map(r=>{
    const gN = (mu.guardRaw && !multiHitOf(r.move)) ? 1 : 0;
    const hits = r.rate>0 ? Math.ceil(myLeft / r.rate) + gN : 99;
    const beats = hits < myHits || (hits === myHits && !mu.faster);
    const ohko  = r.rateHi >= myLeft && gN===0;
    return {...r, hits, beats, ohko, piercesGuard: gN===0 && !!mu.guardRaw};
  });
  const guardN = mu.guard ? 1 : 0;
  // 採用率の合計。小数の誤差が出るので必ず丸める（71.80000000000001% と出ていた）
  const sumRate = list => Math.round(Math.min(100, list.reduce((a,b)=> a + (b.rateOf||0), 0)));
  const pLose = sumRate(rows.filter(r=> r.beats));      // 負ける型の割合
  const pOHKO = sumRate(rows.filter(r=> r.ohko));       // 一撃を持っている型の割合
  const koMoves = rows.filter(r=> r.ohko).sort((a,b)=> b.rateOf-a.rateOf);
  const badMoves = rows.filter(r=> r.beats).sort((a,b)=> b.rateOf-a.rateOf);

  /* ★引き先を計算するときは、いま場にいる駒の「自分側の状態」を持ち込まない（2026-08-20 修正）。
     眠り・こおり・こんらん・やけど・まひ・もうどく・自分のランク変化は、
     **その駒個人のもの**であって、交代で出す控えには引き継がれない。
     ここを丸ごと渡していたため、こちらが眠らされていると引き先まで「眠っている前提」で
     評価され、「△様子見」などの誤った引き先が出ていた。
     場に残るもの（天候・壁・設置・おいかぜ・相手の状態）はそのまま引き継ぐ。 */
  const benchSt = (()=>{
    if(!st) return st;
    const o = {...st};
    ['mySleep','myFreeze','myConfuse','myBurn','myParalysis','myToxic','myAtkRank','myDefRank','mySpeRank']
      .forEach(k=> delete o[k]);
    return o;
  })();
  const bench = (opts.roster||[]).filter(r=> r.name!==mine.name)
    .map(r=>({ r, c:callIt(r, oppName, {roster:null, known, st:benchSt, oppHPPct:opts.oppHPPct}) }))
    .filter(x=> x.c && x.c.head!=='引く' && x.c.head!=='居座らない')
    .sort((a,b)=> b.c.mu.score - a.c.mu.score);

  const pc = x => Math.round(x*100);
  const detail = [];
  if((mu.immuneMoves||[]).length){
    const im = mu.immuneMoves.filter(x=>x.rateOf>=10);
    if(im.length) detail.push({k:'good',
      t:`${im.map(x=>`${x.move}(採用${x.rateOf}%)`).join('・')}は<b>無効</b>。この技に合わせて交代で出せる`});
  }
  if(koMoves.length) detail.push({k:'bad',
    t:`一撃で落とされる：${koMoves.slice(0,3).map(r=>`${r.move}(${r.rateOf}%)`).join('・')}　→ <b>およそ${pOHKO}%</b>の型が持っている`});
  /* 自分の被ダメージは実数でも出す。ゲーム内の自分のHPは数字表記なので、
     %だけだと画面の数字と突き合わせられない（社長の指摘 2026-08-19）。 */
  const myMax = mine.stats ? mine.stats.h : 0;
  const dmgTxt = r => myMax
    ? `${Math.round(r.rate*myMax*0.94)}〜${Math.round(r.rateHi*myMax)}<span class="muted">(${pc(r.rate)}〜${pc(r.rateHi)}%)</span>`
    : `${pc(r.rate)}〜${pc(r.rateHi)}%`;
  /* ★使用率データに無い相手は「（ドラゴン技）」のような推定しか出ない。
     それを黙って出すと、社長が「技が何も登録されていない」と驚く（2026-08-20 ヌメルゴンで発生）。
     判定の確からしさが落ちていることを、必ず本人に伝える。 */
  if(mu.opEstimated) detail.push({k:'warn',
    t:`<b>この相手は使用率データにありません</b>（あまり使われていない相手）。技はタイプ一致で推定しているだけなので<b>判定は目安</b>です。撃たれた技をタップで記録すると精度が上がります`});
  const others = rows.filter(r=> !r.ohko && r.rate>=0.25).slice(0,4);
  if(others.length) detail.push({k:'info',
    t:`飛んでくる技：${others.map(r=>`${r.move}(${r.rateOf}%) ${dmgTxt(r)}`).join('、')}`});
  if(mu.guard) detail.push({k:'good', t:`${mu.guard}で1発は耐える`});
  if(mu.wallsAll) detail.push({k:'good',
    t: mu.opDmg>0
       ? `相手はこちらを落とすのに<b>${mu.opHits}発</b>かかる。急いで殴らなくていい対面`
       : `<b>相手の技はこちらに通りません</b>（無効・または効果が薄い）。好きなだけ仕事ができる対面`});
  if(mu.roles && mu.roles.hazard && mu.wallsAll) detail.push({k:'good',
    t:`ここで<b>設置技</b>を置くと、相手6体すべてに効き続ける`});
  if(!mu.faster && mu.fasterAny && oppScarfRate(oppName)>=15)
    detail.push({k:'bad', t:`こだわりスカーフ採用${oppScarfRate(oppName)}%。持たれていると抜かれる`});
  /* ★いかくの結果を必ず言う（v60）。とくに「逆に上がる」は事故に直結する。 */
  if(mu.intimidate){
    if(mu.intimidate.kind === 'up') detail.push({k:'bad',
      t:`<b>${oppName}は${mu.intimidate.ability}</b>`
        + (mu.intimidate.rate!=null?`（採用${mu.intimidate.rate}%）`:'')
        + `。<b>いかくで相手の攻撃が2段階上がります</b>。この相手にこの駒を投げないこと`});
    else if(mu.intimidate.kind === 'none') detail.push({k:'warn',
      t:`相手は<b>${mu.intimidate.ability}</b>`
        + (mu.intimidate.rate!=null?`（採用${mu.intimidate.rate}%）`:'')
        + `。<b>いかくが効きません</b>（この判定は攻撃を下げずに出しています）`});
    else detail.push({k:'good',
      t:`<b>いかく</b>で相手の物理攻撃を1段階下げた前提で計算しています`});
  }
  /* ★天候で相手が2倍速になる（v58）。社長がハカドッグに負けた原因。 */
  if(mu.opWeatherSpeed){
    detail.push({k:'bad',
      t:`いまの天候で相手は<b>${mu.opWeatherSpeed.name}</b>`
        + (mu.opWeatherSpeed.rate!=null?`（採用${mu.opWeatherSpeed.rate}%）`:'')
        + `。素早さが<b>2倍＝${mu.opS}</b>になっています（こちら ${mu.myS}）`});
  }else{
    /* まだ天候が出ていなくても、**この駒を出した瞬間に自分で天候を作る**なら先に言う。
       カバルドン（すなおこし）は場に出ただけで砂が降る＝自分で相手を加速させる。 */
    const MAKER = {'すなおこし':'すなあらし','ひでり':'にほんばれ','あめふらし':'あめ','ゆきふらし':'ゆき'};
    const w = MAKER[mine.ability||''];
    const ws = w ? weatherSpeedAbility(oppName, w) : null;
    if(ws){
      detail.push({k:'bad',
        t:`<b>${mine.ability}</b>で${w}になります。相手は<b>${ws.name}</b>`
          + (ws.rate!=null?`（採用${ws.rate}%）`:'')
          + `なので、<b>出した瞬間に相手の素早さが2倍</b>になります。この相手の前にこの駒を置かないこと`});
    }
  }
  if(opGuard) detail.push({k:'bad',
    t:`相手は<b>${opGuard.name}</b>（採用${opGuard.rate}%）で<b>満タンからの1発を耐えます</b>。1発で落とせる計算でも1残ることを前提に動くこと`});
  /* ★倒れた味方の数で威力が上がる技（v58）。データ上は威力50の固定なので、
     終盤ほど大幅に過小評価する。盤面の「何体落ちたか」はツールが持っていないので、
     数字は出さずに**仕組みだけ必ず伝える**（推測で数字を出さない）。 */
  (mu.oppRows||[]).filter(r=> GRAVE_MOVES[r.move] && r.rateOf>=20).forEach(r=>{
    const f = (st && st.opFallen) || 0;
    detail.push({k:'bad',
      t:`<b>${r.move}</b>（採用${Math.round(r.rateOf)}%）は<b>${GRAVE_MOVES[r.move]}</b>。`
        + (f>0
            ? `相手は<b>${f}体</b>落ちているので<b>威力${graveMovePower(r.move,50,f)}</b>で計算しています（${pc(r.rate)}〜${pc(r.rateHi)}%）`
            : `いまは<b>0体</b>落ちている前提（威力50）です。`
              + `<b>相手が落ちるたびに盤面の「相手が落ちた数」を上げてください</b>。上げないとこの数字は嘘になります`)});
  });
  /* ★連続技（v55）。1発ぶんで計算していたせいで実戦2敗している。
     ただし2〜5連撃は「全段当たったとき」を最悪ケースとして出しているので、
     何連撃を見た数字なのかを必ず併記する（鉄則⑥：確度を落として根拠を出す）。 */
  (mu.oppRows||[]).filter(r=> multiHitOf(r.move) && r.rateOf>=20).slice(0,2).forEach(r=>{
    const mh = multiHitOf(r.move);
    const g = myOneHitGuard(mine);
    detail.push({k:'bad',
      t:`<b>${r.move}</b>（採用${Math.round(r.rateOf)}%）は<b>${mh.why}</b>。合計で ${pc(r.rate)}〜${pc(r.rateHi)}%`
        + `（上は全段当たった場合）`
        + (g ? `。<b>${g}は1段目で剥がされます</b>` : '')});
  });
  if(mu.myMove) detail.push({k:'info',
    t:`こちらの最大打点：<b>${mu.myMove}</b> ${pc(mu.myDmgLo)}〜${pc(mu.myDmgHi)}%（型の平均で${myHits}発）`});
  /* こちら側に置かれた設置技。「引く」と言っても、これがあると引き先が削れて次で落ちる。 */
  if(st && (st.myRocks || st.mySpikes)){
    const parts = [];
    if(st.myRocks) parts.push('ステルスロック');
    if(st.mySpikes) parts.push('まきびし'+(st.mySpikes>1?`(${st.mySpikes}回)`:''));
    detail.push({k:'bad', t:`こちらの場に <b>${parts.join('・')}</b>。交代するたびに削られる`});
  }
  // 相手の役割（実データからの推定。根拠の採用率つき）
  const roles = rolesOf(oppName);
  if(roles.length) detail.push({k:'role', t:`相手の役割：${roles.slice(0,3).map(r=>
    `<b>${r.role}</b><span class="muted">(${r.evidence[0].move} ${r.evidence[0].rate}%)</span>`).join('、')}`});
  /* 相手の変化技（実採用率）。あくび・回復・積みは、殴り合いの計算だけ見ていると必ず読み落とす。 */
  const chg = (oppMoveChoices(oppName)||[]).filter(m=> m.cat==='変' && m.rate>=15);
  if(chg.length){
    const note = {};
    (OPP_TRICKS[toBase(oppName)]||OPP_TRICKS[oppName]||[]).forEach(([mv,why])=> note[mv]=why);
    detail.push({k:'warn', t:`相手の変化技：${chg.map(m=>
      `<b>${m.name}</b>(${m.rate}%)${note[m.name]?`<span class="muted"> — ${note[m.name]}</span>`:''}`).join('、')}`});
  }

  /* ---- 状態異常で「そもそも動けるか」が変わる ----
     社長の指摘（2026-08-20）：
     「フェイタルクローで眠らされたら、これに交代、みたいな具体的な指示が欲しい」
     ★これまで盤面はまひ(素早さ半減)とやけど(物理半減)しか見ておらず、
       **眠り・こおり・こんらんという『行動できるかどうか』を一切見ていなかった。**
       殴り合いの計算は、動けることが大前提なので、ここが抜けていると結論ごと間違える。 */
  const myStuck  = !!(st && (st.mySleep || st.myFreeze));
  const opStuck  = !!(st && (st.opSleep || st.opFreeze));
  const myConf   = !!(st && st.myConfuse);
  const myStuckName = (st && st.mySleep) ? 'ねむり' : (st && st.myFreeze) ? 'こおり' : '';
  const opStuckName = (st && st.opSleep) ? 'ねむり' : (st && st.opFreeze) ? 'こおり' : '';

  if(myStuck) detail.unshift({k:'bad',
    t:`<b>こちらは${myStuckName}で動けません。</b>殴り合いの計算は「動けること」が前提です。下の打点は当てにできません`});
  if(opStuck) detail.unshift({k:'good',
    t:`<b>相手は${opStuckName}で動けません。</b>ここは無償のターンです`});
  if(myConf) detail.unshift({k:'bad',
    t:`<b>こちらはこんらん中。</b>3回に1回は自分を殴ります。読み合いに賭けず、確実な行動を`});
  // もうどくは相手が勝手に落ちていく。受け側の判断が変わる
  if(st && st.opToxic) detail.unshift({k:'good',
    t:`相手は<b>もうどく</b>。放っておいても削れます。無理に殴らず、受けと交代で回すのが有利`});
  if(st && st.myToxic) detail.unshift({k:'bad',
    t:`こちらは<b>もうどく</b>。ターンが進むほど不利になります。長引かせず決めにいくこと`});

  // ---- 結論 ----
  let head, cls, mark, why;
  const diesNow = (rd && rd.left) ? rd.left.diesNext : (pOHKO>=SURE_RATE);
  if(myStuck && !opStuck){
    /* 動けない駒は、居座っても仕事をしない。
       ただし相手の打点が薄いなら「起きるまで耐える」方が、交代で1体削られるより得。 */
    /* 控えにこの相手を1発で落とせる駒がいるなら、寝たまま粘るより交代が明確に上。
       動けない駒は何ターン居座っても仕事をしないため。 */
    const rescuer = bench[0];
    const canKO = rescuer && rescuer.c.myHits<=1;
    if(canKO){
      head='引く'; cls='ng'; mark='✕';
      why=`${myStuckName}で動けない。${rescuer.r.name}なら1発で落とせるので、寝たまま粘るより交代が上`;
    }else if(mu.opHits<=2 || diesNow){
      head='引く'; cls='ng'; mark='✕';
      why=`${myStuckName}で動けない。相手は${mu.opHits}発で落としてくるので、起きる前に落ちる`;
    }else{
      head='様子見'; cls='wn'; mark='△';
      why=`${myStuckName}で動けないが、相手は落とすのに${mu.opHits}発かかる。交代で1体削られるより、起きるまで粘る方が得`;
    }
  }else if(priKO){
    /* ★先制技で確実に落とせるなら、素早さ負けも「一撃されうる」も関係ない（2026-08-22・疑似対戦で発見）。
       実戦41戦目：相手ガブリアス残り1%、こちらメガルカリオ（遅い・じしんで一撃される）。
       「撃つ技」は しんそく に切り替わっていたのに、**結論だけ「✕引く」のまま**だった。
       社長はしんそくで倒して正解＝ツールに従っていたら1体損していた。
       ★低乱数でも落とせる（lo >= 残りHP）ときだけ言い切る。最大乱数で足りるだけなら言わない（鉄則⑥）。 */
    head='殴る'; cls='ok'; mark='◎';
    why=`<b>${priKO.name}</b>（優先度+${priKO.pri}）で先に落とせる。相手は残り${Math.round(oppLeft*100)}%なので、`
      + `素早さ負けも一撃されることも関係ない`;
  }else if(opStuck){
    // 相手が動けない＝無償のターン。積めるなら積む、落とせるなら落とす
    const upNow = ['つるぎのまい','りゅうのまい','めいそう','わるだくみ','てっぺき','ビルドアップ','からをやぶる','ちょうのまい']
      .filter(m=> (mine.moves||[]).includes(m))[0];
    if(myHits<=1){ head='殴る'; cls='ok'; mark='◎'; why=`相手は${opStuckName}で動けない。${mu.myMove}で落とす`; }
    else if(upNow){ head='積む'; cls='ok'; mark='◎'; why=`相手は${opStuckName}で動けない。${upNow}を積む絶好の機会`; }
    else { head='殴る'; cls='ok'; mark='◎'; why=`相手は${opStuckName}で動けない。無償で${mu.myMove}を入れられる`; }
  }else if(mu.noOffense && !mu.wallsAll && myHits > 1){
    /* 打点が無く、しかも受けられもしない＝いる意味がない
       ★2026-08-22 修正（疑似対戦で発見）：`noOffense` は **相手が満タんの前提**で出しているので、
         削れている相手に対しても「打点が無い＝引く」と言い続けていた。
         実戦41戦目：相手ガブリアスが残り1%、こちらメガルカリオ。
         「撃つ技」は しんそく に切り替わっていたのに、結論だけ「✕引く」のまま。
         社長はしんそくで倒して正解だった＝**ツールに従っていたら負けていた場面**。
       → いま出しているHPで1発で落とせるなら、この枝には入らない（下の myHits<=1 の枝で判定する）。 */
    head='引く'; cls='ng'; mark='✕';
    why = mu.myDmg>0 ? `打点が無い（型の平均で${mu.myHits}発かかる）`
                     : `技がまったく通らない（無効・または効果が薄い）`;
  }else if(myHits<=1 && mu.faster && !(diesNow && !mu.faster)){
    head='殴る'; cls='ok'; mark='◎'; why=`${mu.myMove}で先に落とせる`;
  }else if(myHits<=1 && mu.fasterAny && !(diesNow && !mu.faster)){
    /* ★2026-08-20 修正（実戦での敗因）。
       以前はここも「◎ 殴る・先に落とせる」と言い切っていた。
       だが fasterAny は「3つの想定型のうち**どれか1つ**より速い」でしかない。
       メガルカリオ(S164) vs マスカーニャ は、遅い耐久型(S143)にだけ速く、
       最速型(S192)とスカーフ型(S288・採用49.7%)には**倍近く抜かれる**。
       それを「先に落とせる」と表示していたため、社長はルカリオを投げて一撃で失った。
       → 1発で落とせるのは事実なので「殴る」は残すが、**言い切らない**。
         抜かれる可能性と、その根拠（スカーフ採用率）を必ず添える。 */
    const sc = oppScarfRate(oppName);
    head='殴る'; cls='wn'; mark='△';
    why = `${mu.myMove}なら1発。ただし相手が最速なら先に動かれる`
        + (sc>=10 ? `（こだわりスカーフ採用${sc}%）` : '')
        + `。こちら${mu.myS} 対 相手${mu.opS}`;
  }else if(pOHKO >= SURE_RATE){
    head='引く'; cls='ng'; mark='✕';
    why=`${koMoves[0].move}などで一撃。およそ${pOHKO}%の型が一撃技を持っている`;
  }else if(pOHKO >= 25){
    head='居座らない'; cls='wn'; mark='△';
    why=`${koMoves[0].move}(採用${koMoves[0].rateOf}%)を持っていたら一撃。${pOHKO}%の型が該当`;
  }else if(pLose >= SURE_RATE){
    head='引く'; cls='ng'; mark='✕';
    why=`${badMoves.length?badMoves[0].move+'などで':''}${myHits}発 対 ${badMoves[0]?badMoves[0].hits:mu.opHits}発。およそ${pLose}%の型に負ける`;
  }else if(pLose >= 25){
    head='様子見'; cls='wn'; mark='△';
    why=`${badMoves[0].move}(採用${badMoves[0].rateOf}%)を持っていると負ける。${pLose}%の型が該当。1発もらってから決める`;
  }else if(mu.stallsAll){
    /* 殴り切れないが、相手の打点も通らず、こちらは回復を持っている＝受け切れる。
       ここを「打点なし＝引く」と切っていたので、受けの駒が選出に出てこなかった。 */
    head='受ける'; cls='ok'; mark='○';
    why= mu.opDmg>0 ? `相手はこちらを落とすのに${mu.opHits}発かかる。回復で受け切れる`
                    : `相手の技がこちらに通らない。回復で受け切れる`;
  }else if(mu.wallsAll && (mu.roles&&(mu.roles.hazard||mu.roles.status||mu.roles.phase))){
    head='盤面を作る'; cls='ok'; mark='○';
    why=`${mu.opDmg>0?`相手の打点が薄い（${mu.opHits}発）`:'相手の技が通らない'}。殴り合わず${
      mu.roles.hazard?'設置':mu.roles.status?'状態異常':'流し'}で仕事をする`;
  }else if(myHits >= 5){
    // 5発以上＝実戦では回復・交代・積みで必ず巻き返される
    head='引く'; cls='ng'; mark='✕'; why=`${myHits}発かかる。押し切れない`;
  }else if(myHits === 4){
    head= mu.wallsAll ? '削る' : '様子見'; cls='wn'; mark='△';
    why= mu.wallsAll ? `4発かかるが、相手の打点も薄い（${mu.opHits}発）。急がず削る`
                     : `落とすのに4発かかる。回復技を持たれていたら押し切れない`;
  }else{
    head='殴る'; cls='ok'; mark= pLose>0 ? '○' : '◎';
    why= pLose>0 ? `${myHits}発で落とせる。負けるのは${pLose}%の型だけ`
                 : `${myHits}発で落とせる。負ける型が無い`;
  }

  /* ---- この対面で「やること」 ----
     社長の指摘（2026-08-20）：
     「3対3のゲームなのに、この対面をどう倒すかに寄りすぎている。
       今は相性が悪いけど最低限これだけはやって引いた方がいい、
       ステルスロックはせめて撒いてから交代した方がいい、
       一発これ食らわしたら次これが一撃で入る、
       多分相手はこれを打ってくるからそれだけ受けて交代した方がいい、が欲しい」
     → 勝てない対面でも「何を残して引くか」を出す。試合中に読むので最大3件。 */
  const myMoves = new Set(mine.moves||[]);
  const todo = [];
  // この相手の攻撃を1発は耐えるか。耐えないなら「引く前に何かする」は成立しない
  // 動けない（ねむり・こおり）なら、そもそも何もできない。やることを出さない
  const survives = !diesNow && pOHKO < SURE_RATE && !myStuck;

  // ① 未設置の設置技。撒いてから引くのが3対3では最大の仕事
  const PLACED = { 'ステルスロック': st&&st.opRocks, 'まきびし': st&&st.opSpikes,
                   'どくびし': st&&st.opTSpikes, 'ねばねばネット': st&&st.opSticky };
  if(survives){
    const yet = ['ステルスロック','まきびし','どくびし','ねばねばネット']
      .filter(m=> myMoves.has(m) && !PLACED[m]);
    if(yet.length) todo.push({k:'do', t:`<b>${yet[0]}</b> を置いてから引ける（この相手の攻撃は耐える）`});
  }

  // ② 引く前に入れられる状態異常・妨害
  if(survives){
    const st2 = ['キノコのほうし','おにび','どくどく','でんじは','ちょうはつ','アンコール','あくび']
      .filter(m=> myMoves.has(m));
    if(st2.length && todo.length<3) todo.push({k:'do', t:`<b>${st2[0]}</b> を入れてから引ける`});
  }

  /* ③ 「1発入れれば次が一撃圏」。控えの打点と、いま入るこちらのダメージを突き合わせる。
        ★1発入れるには「こちらが速い」か「相手の攻撃を耐える」かのどちらかが要る。
          先に落とされる対面で「1発入れれば」と言うのは、そのまま無償で1体失う指示になる。 */
  if(mu.myDmgLo > 0 && opts.roster && (mu.faster || survives)){
    const after = 1 - mu.myDmgLo;                       // 低乱数で殴った後の相手の残り（保守的に見る）
    const reach = (opts.roster||[]).filter(r=> r.name!==mine.name).map(r=>{
      const m2 = matchup(r, {name:oppName, known, st});
      return m2 ? {name:r.name, hi:m2.myDmgHi, move:m2.myMove} : null;
    }).filter(x=> x && x.hi>0 && x.hi<1 && x.hi>=after)
      .sort((a,b)=> b.hi-a.hi)[0];
    if(reach && todo.length<3)
      todo.push({k: survives?'good':'bad',
        t:`いま1発入れれば、<b>${reach.name}</b>の<b>${reach.move}</b>が一撃圏（相手を${Math.round(reach.hi*100)}%以下にすればよい）`
          + (survives ? '' : '　<b>※こちらは落ちる。1体と引き換え</b>')});
  }

  // ④ 引く判定のとき、いちばん飛んでくる技を受けてから引けるか
  if((head==='引く'||head==='居座らない'||head==='様子見') && survives && todo.length<3){
    const top = (rows||[]).filter(r=>r.rateOf>=20).sort((a,b)=> b.rateOf-a.rateOf)[0];
    if(top) todo.push({k:'info',
      t:`いちばん来るのは <b>${top.move}</b>(${top.rateOf}%)。${pc(top.rateHi)}%なので<b>受けてから引ける</b>`});
  }

  /* ⑤ 積み技。
     ★2026-08-20 修正（社長がこの助言で1戦落としている）。
       以前は「相手が2発以上かかるなら積める」としていたため、
       **1発で落とせる相手にも「積める」と出していた**。
       カイリュー vs オオニューラで「じしんなら1発」と言いながら「りゅうのまいを積める」と表示し、
       社長は積んで1ターンを渡し、フェイタルクロー(採用93.5%)の追加効果で眠らされて敗着になった。
       → **1発で落とせるなら積まない。** 積みは「押し切れないが、相手の打点も薄い」ときだけ。 */
  const up = ['つるぎのまい','りゅうのまい','めいそう','わるだくみ','てっぺき','ビルドアップ','からをやぶる','ちょうのまい']
    .filter(m=> myMoves.has(m))[0];
  if(up && todo.length<3 && !myStuck){
    if(myHits<=1){
      todo.push({k:'bad', t:`<b>${up}は積まない。</b>${mu.myMove||'最大打点'}で1発なので、積む1ターンは相手に無償で渡すだけです`});
    }else if(mu.opHits>=3 && survives){
      /* ★積みターンは相手に無償の1回を渡す。相手が状態異常を撒いてくるなら、その1回が敗着になる。
         社長はカイリュー vs オオニューラでこれをやり、フェイタルクロー(93.5%)の追加効果で眠らされて負けた。
         → 状態異常・妨害を高採用率で持つ相手には、積みを勧めない。 */
      const risky = (oppTricks(oppName)||[]).map(x=>x[0]);
      const statusMv = (oppMoveChoices(oppName)||[])
        .filter(m=> m.rate>=20 && ['あくび','キノコのほうし','でんじは','おにび','どくどく','アンコール','ちょうはつ'].includes(m.name))
        .map(m=>m.name);
      const danger = [...new Set([...risky, ...statusMv])];
      if(danger.length){
        todo.push({k:'warn', t:`<b>${up}は勧めません。</b>相手の<b>${danger.slice(0,2).join('・')}</b>で、積んだ1ターンがそのまま敗着になります`});
      }else{
        todo.push({k:'good', t:`<b>${up}</b> を積める（こちら${myHits}発／相手は落とすのに${mu.opHits}発かかる）`});
      }
    }
  }

  /* 技ごとの比較（どれを撃つか）。相手が引くことも織り込む */
  const moves = movePlan(mine, oppName, {
    st, oppHPPct:opts.oppHPPct, others:opts.oppTeam||[],
    /* 相手が引いてくる／殴り合いにならない対面では、設置技や状態異常の方が価値が高い。
       「盤面を作る」「受ける」と結論しておきながら攻撃技を勧めるのは矛盾なので、ここも含める。 */
    likelySwitch: ((head==='殴る' || head==='削る') && myHits>=2)
                  || head==='盤面を作る' || head==='受ける' || head==='様子見'
  });

  /* ★見えていない技の申告（v56）。mark が確定してから積む。
     「負ける型が無い」と言い切る場面ほど危ないので、結論が◎／○のときだけ出す。
     社長は試合6で、データに載っていないマスカーニャの かわらわり でルカリオを失っている。 */
  {
    const uk = unknownMoveSlots(oppName);
    const pro = (mu.opAtkAbility && /へんげんじざい|リベロ/.test(mu.opAtkAbility.name)) ? mu.opAtkAbility : null;
    const uu = oppUsage(oppName);
    if(uk != null && uk >= 0.35 && (mark==='◎' || mark==='○')){
      detail.push({k:'warn',
        t:`この判定は<b>データにある${((uu&&uu.m)||[]).length}技</b>だけで出しています。`
          + `<b>約${uk.toFixed(1)}枠ぶん</b>は載っていない技です`
          + (pro ? `。しかも<b>${pro.name}</b>（${pro.rate}%）なので、載っていない技もタイプ一致で飛んできます` : '')
          + `。<b>言い切れる対面ではありません</b>`});
    }
  }
  return { head, cls, mark, why, detail, todo, moves, mu, read:rd, myHits, pLose, pOHKO,
           koMoves, badMoves, rows, immune: mu.immuneMoves||[],
           to: bench.length ? {name:bench[0].r.name, c:bench[0].c} : null,
           bench: bench.slice(0,3).map(x=>({name:x.r.name, c:x.c})) };
}

/** 実戦中の1手の結論。readDamage の結果と対面の判定を突き合わせて「殴る／引く」を1行で返す。 */
function actionNow(mine, oppName, roster, hpNow, field, known){
  const mu = matchup(mine, {name:oppName, known});
  if(!mu) return null;
  const rd = (hpNow!=null && mine.stats) ? readDamage(mine, oppName, hpNow, field, known) : null;
  const dies = rd ? rd.left.diesNext : mu.opOHKO;
  const canKill = mu.myHits <= 1 && mu.fasterAny;      // 先に落とせるなら殴っていい

  // 引き先：いま出せる控えの中で、その相手にいちばん強い駒
  const bench = (roster||[]).filter(r=> r.name!==mine.name)
    .map(r=>({ r, mu:matchup(r,{name:oppName, known}) })).filter(x=>x.mu && !x.mu.opOHKO && !x.mu.noOffense)
    .sort((a,b)=> b.mu.score - a.mu.score);

  let verdict, why;
  if(canKill && !(dies && !mu.faster)){ verdict='殴る'; why=`${mu.myMove||'最大打点'}で先に落とせる`; }
  else if(dies){ verdict='引く'; why= rd ? `次の${rd.left.worstMove}で落ちる（残り${rd.hpNow}）` : `${mu.opOHKOMove||'相手の技'}で一撃`; }
  else if(mu.noOffense){ verdict='引く'; why= mu.myDmg>0 ? `打点が無い（型の平均で${mu.myHits}発）` : `技がまったく通らない`; }
  else if(mu.winsRace){ verdict='殴る'; why=`${mu.myHits}発 対 ${mu.opHits}発で勝てる`; }
  else { verdict='引く'; why=`${mu.opHits}発で落とされる`; }

  return { verdict, why, mu, read:rd,
           to: bench.length ? { name:bench[0].r.name, mu:bench[0].mu } : null,
           bench: bench.slice(0,3).map(x=>({name:x.r.name, mu:x.mu})) };
}

/** ある技を「他にどのポケモンが持っているか」を実使用率から逆に引く。
 *  社長の要望（2026-08-20）：
 *  「この技でやられた、という記録が溜まったら、同じことをやってきそうな他のポケモンにも対策したい」
 *  → 1回の負けを、その技を持つ環境全体への対策に広げるための引き当て。 */
function whoElseHas(move, minRate){
  minRate = (minRate==null) ? 10 : minRate;
  const out = [];
  Object.entries(USAGE_M5||{}).forEach(([name, u])=>{
    (u.m||[]).forEach(m=>{
      if(m[0]===move && m[1]>=minRate) out.push({name, rate:m[1], rank:u.r, cat:m[3], power:m[4]});
    });
  });
  return out.sort((a,b)=> b.rate-a.rate);
}

/** 観測技が増えると同じ組み合わせでも結果が変わるので、キャッシュを捨てられるようにしておく */
function clearMatchupCache(){ _muCache.clear(); }

/** この3体で戦うとき、「落とされると一気に苦しくなる駒」を返す。
 *  社長の要望（2026-08-19）：
 *  「相手との有利対面が多いポケモンがすぐ死ぬと一気に不利になる。
 *    この3対3だとこのポケモンがいなくなるときつい、という場合だけ教えてほしい」
 *  → 毎回は出さない。その駒が居なくなると "答えが無くなる" 相手が2体以上いる時だけ返す。 */
function keyPieces(picks, oppNames, opts){
  opts = opts || {};
  // 「その相手を見れる」＝殴り勝てる、受け切れる、盤面を作れる のいずれか。
  // 殴るだけを数えていたので、受けの駒が「唯一の答え」として出てこなかった。
  const OKHEAD = ['殴る','受ける','盤面を作る'];
  const canBeat = (m, o)=>{
    const c = callIt(m, o, {known: (opts.known||{})[o] || null});
    return c && OKHEAD.includes(c.head);
  };
  const cover = {};                                  // 相手 -> 見れる駒の一覧
  oppNames.forEach(o=>{ cover[o] = picks.filter(m=> canBeat(m, o)).map(m=> m.label || m.name); });

  const out = [];
  picks.forEach(m=>{
    const nm = m.label || m.name;
    // その駒が唯一の答えになっている相手
    const only = oppNames.filter(o=> cover[o].length===1 && cover[o][0]===nm);
    // その駒を抜くと「誰も見れない相手」が何体増えるか
    if(only.length >= 2) out.push({ name:nm, only, n:only.length });
  });
  // 誰も見れない相手（この時点で穴）
  const uncovered = oppNames.filter(o=> cover[o].length===0);
  return { keys: out.sort((a,b)=> b.n-a.n), uncovered, cover };
}

/* ---------- 実数値から「性格＋SP振り」を逆算する ----------
   ゲームの画面に出るのは実数値（H193 A160 …）であって、SPでも性格でもない。
   社長の要望「パーティのスクショで技・能力値・持ち物を全部登録したい」を実現するには、
   まずここが要る。スクショOCRを付けたときも、読み取った6つの数字をこれに渡すだけになる。
     HP  = floor((種2+31)/2) + 60 + SP
     他  = floor( (floor((種2+31)/2) + 5 + SP) * 性格補正 )
   SPは合計66・1能力32が上限。候補が複数出たら全部返す（画面で選ばせる）。 */
function solveSpread(name, real){
  const sc = SPECIES[name]; if(!sc || !real) return [];
  const b = sc.base;
  const baseOf = k => Math.floor((b[k]*2+31)/2);

  // HP は性格に影響されないので先に確定
  const spH = real.h - baseOf('h') - 60;
  if(spH < 0 || spH > SP_MAX) return [];

  const keys = ['a','b','c','d','s'];
  const out = [];
  Object.keys(NATURES).forEach(nat=>{
    const mod = natureMods(nat);
    const sp = {h:spH};
    for(const k of keys){
      const base = baseOf(k);
      let found = null;
      for(let v=0; v<=SP_MAX; v++){
        if(Math.floor((base + 5 + v) * mod[k]) === real[k]){ found = v; break; }
      }
      if(found === null) return;                 // この性格ではその実数値を作れない
      sp[k] = found;
    }
    const total = Object.values(sp).reduce((x,y)=>x+y,0);
    if(total > SP_TOTAL) return;                 // SP合計66を超える＝ありえない
    out.push({ nature:nat, sp, total, neutral: !NATURES[nat][0] });
  });
  // 補正のある性格を優先。無補正（がんばりや等）は同じ結果になるので1つに畳む
  const withMod = out.filter(o=>!o.neutral);
  const neutral = out.filter(o=>o.neutral).slice(0,1);
  return [...withMod, ...neutral];
}

/** 自分6 × 相手6 のマトリクス */
function buildMatrix(myRoster, oppNames){
  return myRoster.map(m=> oppNames.map(o=> matchup(m, {name:o})));
}

/* ---------- こちら側の駒の「役割」 ----------
   社長の指摘（2026-08-19）：
   「ドラパルトの出番がなさすぎる。そもそもの役割は殴るんじゃなくて守る役割だと思う。
     相手を殴ることが重視されていて、負けない立ち回りが考慮されていないのでは？
     一見遠回りに感じることが実は最短、みたいなのを評価してほしい」
   → 完全に正しかった。選出スコアは「先に落とせるか」しか見ていなかった。
     受け・起点作り・流し・状態異常・サイクルは1つも点数に入っていなかったので、ここで足す。 */
const MY_ROLE_MOVES = {
  recover: ['じこさいせい','ねがいごと','はねやすめ','なまける','つきのひかり','タマゴうみ','ミルクのみ',
            'ソフトボール','あさのひざし','こうごうせい','ねむる','ドレインパンチ','ギガドレイン','スワンプ'],
  hazard:  ['ステルスロック','まきびし','どくびし','ねばねばネット'],
  status:  ['おにび','どくどく','でんじは','キノコのほうし','あくび','ちょうはつ','アンコール','いばる'],
  phase:   ['ドラゴンテール','ともえなげ','ふきとばし','ほえる'],
  pivot:   ['とんぼがえり','ボルトチェンジ','クイックターン'],
  screen:  ['リフレクター','ひかりのかべ','オーロラベール','しんぴのまもり'],
  setup:   ['つるぎのまい','りゅうのまい','めいそう','わるだくみ','てっぺき','ビルドアップ','からをやぶる','ちょうのまい']
};
/** 自分の駒が持っている支援系の役割。登録した技から判定する（推測ではなく実際の技） */
function myRoles(mine){
  const mv = new Set(mine.moves||[]);
  const out = {};
  Object.entries(MY_ROLE_MOVES).forEach(([k, list])=>{ if(list.some(m=>mv.has(m))) out[k] = true; });
  return out;
}
/** 支援の厚み。受け・起点・流し・状態異常を持つ駒は、殴れなくても盤面を作れる */
function supportValue(mine){
  const r = myRoles(mine);
  return (r.recover?1:0) + (r.hazard?1:0) + (r.status?1:0) + (r.phase?0.5:0) + (r.pivot?0.5:0) + (r.screen?0.5:0);
}

/** その駒の打点が物理寄りか特殊寄りか。登録した技から判定し、無ければ実数値のA/Cで。
 *  選出が片方に寄り切ると、鬼火・いかく／ひかりのかべ・チョッキ 1枚でまとめて止まる。 */
function offenseCat(mine){
  const mvs = (mine.moves||[]).map(m=>MOVES[m]).filter(m=>m && m.power && m.cat!=='変');
  if(mvs.length){
    const p = mvs.filter(m=>m.cat==='物').length;
    if(p && p<mvs.length) return 'both';
    return p ? '物' : '特';
  }
  const st = mine.stats || (SPECIES[mine.name] ? {a:SPECIES[mine.name].base.a, c:SPECIES[mine.name].base.c} : null);
  if(!st) return 'both';
  return st.a >= st.c ? '物' : '特';
}
/** 並びの打点が片寄っていれば '物理' / '特殊' を返す。割れていれば null */
function offenseBias(entries){
  const k = entries.map(offenseCat);
  if(k.every(x=>x==='物')) return '物理';
  if(k.every(x=>x==='特')) return '特殊';
  return null;
}

/** 選出3体を提案（相手6体をできるだけ「見れる」組み合わせを貪欲に探す） */
function suggestPicks(myRoster, oppNames, size){
  size = size || 3;
  const n = myRoster.length, m = oppNames.length;
  const mat = buildMatrix(myRoster, oppNames);
  const idx = [...Array(n).keys()];
  const combos = [];
  (function comb(start, cur){
    if(cur.length===size){ combos.push([...cur]); return; }
    for(let i=start;i<n;i++){ cur.push(i); comb(i+1,cur); cur.pop(); }
  })(0,[]);

  const scored = combos.map(c=>{
    let cover = 0, total = 0, worst = 0;
    const uncovered = [];
    for(let j=0;j<m;j++){
      const best = Math.max(...c.map(i=> mat[i][j] ? mat[i][j].score : -9));
      /* ★「見れる」＝先に落とせる、だけではない。
         相手の打点が通らず受け切れるなら、その相手も止まっている。
         ここを winsRace だけで数えていたので、受けの駒が選出に一度も出なかった。 */
      const anyWin = c.some(i=> mat[i][j] && (mat[i][j].winsRace || mat[i][j].stallsAll
                                              || (mat[i][j].wallsAll && !mat[i][j].dangerAll)));
      total += best;
      if(anyWin) cover++; else uncovered.push(oppNames[j]);
      worst = Math.min(worst, best);
    }
    // 3体が同じタイプに一貫して弱いとマイナス
    const weak = {};
    c.forEach(i=>{
      const st = SPECIES[myRoster[i].name]; if(!st) return;
      TYPES.forEach(t=>{ if(effectiveness(t, st.types) >= 2) weak[t] = (weak[t]||0)+1; });
    });
    const shared = Object.entries(weak).filter(([,v])=> v>=size).map(([t])=>t);
    // 打点が物理／特殊のどちらかに寄り切った並びは、相手の1枚でまとめて止まる
    const bias = offenseBias(c.map(i=> myRoster[i]));
    /* アタッカー3枚だけの並びは、1回止められると崩れる。
       受け・起点・状態異常を1枚以上入れた並びを評価する（社長の「負けない立ち回り」）。 */
    const support = c.reduce((a,i)=> a + supportValue(myRoster[i]), 0);
    const supportBonus = Math.min(1.5, support * 0.5);
    const penalty = shared.length * 1.2 + (bias ? 0.8 : 0) - supportBonus;
    return { members:c.map(i=> myRoster[i].label || myRoster[i].name), cover, total: total - penalty,
             worst, uncovered, sharedWeak: shared, bias, support };
  }).sort((a,b)=> b.cover - a.cover || b.total - a.total);

  return { top: scored.slice(0,10), matrix: mat };
}

/** 初手に置いてはいけない対面を洗い出す（くろこの原則②） */
function leadCheck(pickNames, oppNames, myRoster){
  return pickNames.map(name=>{
    const mine = myRoster.find(r=>r.name===name) || {name};
    const bad = oppNames.map(o=>({o, mu:matchup(mine,{name:o})}))
      .filter(x=> x.mu && x.mu.danger).map(x=>x.o);
    const good = oppNames.map(o=>({o, mu:matchup(mine,{name:o})}))
      .filter(x=> x.mu && x.mu.score > 0.5).map(x=>x.o);
    return { name, danger:bad, good, safe: bad.length===0 };
  });
}

/* ---------- 音声メモの解析 ----------
   OSのキーボードの音声入力で喋った文章から、対戦記録を組み立てる。
   語彙が「313種のポケモン名」という閉じた集合なので、
   外部のAI(API)を呼ばなくても文字列照合だけで実用になる＝料金は一切かからない。
   音声入力は名前を高確率で誤変換する（ガブリアス→ガブリエス、アーマーガア→アーマーガー 等）ので、
   表記ゆれを吸収したうえで、確信が持てないものは uncertain として呼び出し側に返し、
   画面側で必ず人が確認できるようにする。 */

/** 照合用の正規化：カタカナ→ひらがな／小文字・濁点のゆれを潰す。長音は残す（潰すと別名と衝突する） */
function normKana(s){
  let t = String(s||'').replace(/[\u30a1-\u30f6]/g, c=>String.fromCharCode(c.charCodeAt(0)-0x60));
  t = t.normalize('NFD').replace(/[\u3099\u309a]/g,'').normalize('NFC');
  const small = {'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','ゃ':'や','ゅ':'ゆ','ょ':'よ','っ':'つ','ゎ':'わ'};
  return t.replace(/[ぁぃぅぇぉゃゅょっゎ]/g, c=>small[c]).replace(/[ｰ－—]/g,'ー');
}
/* ★種族名の検索を1本にまとめる（2026-08-21・v58）。
   社長が「ハカドッグが検索で出てこなかった」で1敗した。原因は**濁点**。
   「ハカドッ**ク**」と打つと出てこない。見せ合いの小さい文字では グ／ク を読み違える。
   しかも同じ用途の検索が**3か所に別実装**であった（鉄則⑤の違反）：
     ①対戦タブ … ひらがな→カタカナ＋ローマ字。濁点は見ていない
     ②記録タブ・構築タブ … `name.includes(q)` だけ。ひらがなで打つと1件も出ない
     ③core.js の `normKana()`＋`editDistance()` … いちばん正しいのに、音声メモでしか使っていなかった
   → ③を全部の入口で使う。313種で濁点を落としても**名前の衝突は0件**であることを確認済み。 */

/** ローマ字化（訓令式）。app側と同じ規則をcoreに置き、検索を1本にする */
const ROMA_TBL = {
  'キャ':'kya','キュ':'kyu','キョ':'kyo','シャ':'sya','シュ':'syu','ショ':'syo',
  'チャ':'tya','チュ':'tyu','チョ':'tyo','ニャ':'nya','ニュ':'nyu','ニョ':'nyo',
  'ヒャ':'hya','ヒュ':'hyu','ヒョ':'hyo','ミャ':'mya','ミュ':'myu','ミョ':'myo',
  'リャ':'rya','リュ':'ryu','リョ':'ryo','ギャ':'gya','ギュ':'gyu','ギョ':'gyo',
  'ジャ':'zya','ジュ':'zyu','ジョ':'zyo','ビャ':'bya','ビュ':'byu','ビョ':'byo',
  'ピャ':'pya','ピュ':'pyu','ピョ':'pyo','ヂャ':'zya','ヂュ':'zyu','ヂョ':'zyo',
  'ア':'a','イ':'i','ウ':'u','エ':'e','オ':'o','カ':'ka','キ':'ki','ク':'ku','ケ':'ke','コ':'ko',
  'サ':'sa','シ':'si','ス':'su','セ':'se','ソ':'so','タ':'ta','チ':'ti','ツ':'tu','テ':'te','ト':'to',
  'ナ':'na','ニ':'ni','ヌ':'nu','ネ':'ne','ノ':'no','ハ':'ha','ヒ':'hi','フ':'hu','ヘ':'he','ホ':'ho',
  'マ':'ma','ミ':'mi','ム':'mu','メ':'me','モ':'mo','ヤ':'ya','ユ':'yu','ヨ':'yo',
  'ラ':'ra','リ':'ri','ル':'ru','レ':'re','ロ':'ro','ワ':'wa','ヲ':'wo','ン':'n',
  'ガ':'ga','ギ':'gi','グ':'gu','ゲ':'ge','ゴ':'go','ザ':'za','ジ':'zi','ズ':'zu','ゼ':'ze','ゾ':'zo',
  'ダ':'da','ヂ':'zi','ヅ':'zu','デ':'de','ド':'do','バ':'ba','ビ':'bi','ブ':'bu','ベ':'be','ボ':'bo',
  'パ':'pa','ピ':'pi','プ':'pu','ペ':'pe','ポ':'po',
  'ァ':'a','ィ':'i','ゥ':'u','ェ':'e','ォ':'o','ャ':'ya','ュ':'yu','ョ':'yo','ー':''
};
function toRomaji(name){
  const kata = String(name||'').replace(/[ぁ-ん]/g, ch=>String.fromCharCode(ch.charCodeAt(0)+0x60));
  let out='';
  for(let i=0;i<kata.length;i++){
    const one = kata[i];
    if(one==='ッ'){                       // 促音は次の子音を重ねる（gekkouga）
      const nx = ROMA_TBL[kata.slice(i+1,i+3)] || ROMA_TBL[kata[i+1]] || '';
      if(nx && !'aiueo'.includes(nx[0])) out += nx[0];
      continue;
    }
    const two = kata.slice(i,i+2);
    if(ROMA_TBL[two]!==undefined){ out+=ROMA_TBL[two]; i++; continue; }
    out += (ROMA_TBL[one]!==undefined) ? ROMA_TBL[one] : '';
  }
  return out;
}
/** ローマ字の揺れを1つに寄せる。ヘボン式／訓令式／長音／促音の揺れ、そして**濁点**まで吸収する */
function romajiKey(s){
  return String(s||'').toLowerCase()
    .replace(/shi/g,'si').replace(/chi/g,'ti').replace(/tsu/g,'tu')
    .replace(/fu/g,'hu').replace(/ji/g,'zi')
    .replace(/sha/g,'sya').replace(/shu/g,'syu').replace(/sho/g,'syo')
    .replace(/cha/g,'tya').replace(/chu/g,'tyu').replace(/cho/g,'tyo')
    .replace(/ja/g,'zya').replace(/ju/g,'zyu').replace(/jo/g,'zyo')
    .replace(/[^a-z]/g,'')
    .replace(/([aiueo])\1+/g,'$1').replace(/ou/g,'o')   // 長音の揺れ
    .replace(/([kstnhmyrwgzdbp])\1+/g,'$1')             // 促音の揺れ（hakkadoggu も当たる）
    .replace(/[gz]/g,c=> c==='g'?'k':'s')                 // ★濁点を落とす
    .replace(/[db]/g,c=> c==='d'?'t':'h')
    .replace(/p/g,'h').replace(/v/g,'u');
}
/** 検索用のキー。濁点・小書き・長音・ひらがな／カタカナの違いを全部潰す */
function nameKey(s){
  return normKana(s).replace(/[ー]/g,'');
}
const _keyCache = new Map();
function keysOf(name){
  if(!_keyCache.has(name)) _keyCache.set(name, {k:nameKey(name), r:romajiKey(toRomaji(name))});
  return _keyCache.get(name);
}

/** 種族名を探す。全部の入口（対戦タブ・記録タブ・構築タブ）はこれを使うこと。
 *  戻り値: {list:[名前], fuzzy:boolean}  fuzzy=true は「もしかして」候補 */
function searchSpecies(query, opts){
  opts = opts || {};
  const q = String(query||'').trim();
  const all = Object.keys(SPECIES)
    .filter(n=> !isTypeForm(n))                    // へんげんじざいの合成個体は候補に出さない
    .filter(n=> !(opts.noMega && isMegaForm(n)))
    .filter(n=> !(opts.exclude||[]).includes(n));
  if(!q) return {list: all.slice(0, opts.limit||12), fuzzy:false};

  const isRoma = /^[A-Za-z]+$/.test(q);
  const qk = isRoma ? romajiKey(q) : nameKey(q);
  const keyOf = n => isRoma ? keysOf(n).r : keysOf(n).k;

  const hit = all.filter(n=> keyOf(n).includes(qk))
    .sort((a,b)=> keyOf(a).indexOf(qk)-keyOf(b).indexOf(qk) || a.length-b.length);
  if(hit.length) return {list: hit.slice(0, opts.limit||12), fuzzy:false};

  /* ★0件で終わらせない。1〜2文字の打ち間違いを拾って「もしかして」を出す。
     「見つかりません」で終わると、社長は登録をあきらめるか、別のポケモンを入れてしまう（実際に3敗している）。 */
  const near = all.map(n=>({n, d: editDistance(qk, keyOf(n))}))
    .filter(x=> x.d <= Math.max(1, Math.min(2, Math.floor(qk.length/3))))
    .sort((a,b)=> a.d-b.d || a.n.length-b.n.length);
  if(near.length) return {list: near.slice(0, opts.limit||8).map(x=>x.n), fuzzy:true};

  /* それでも0件なら、打ちかけ（頭3文字以上が一致）だけ拾う。
     ★ここを2文字にしていたら、でたらめな入力に無関係な候補が10件出た。
     **間違った候補を出すのは、0件で返すより悪い**（社長が違うポケモンを登録して負けている）。 */
  const part = qk.length>=3
    ? all.filter(n=> keyOf(n).startsWith(qk.slice(0,3))).sort((a,b)=> a.length-b.length)
    : [];
  return {list: part.slice(0, 5), fuzzy: part.length>0};
}

function editDistance(a,b){
  const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
  let prev=[...Array(n+1).keys()], cur=new Array(n+1);
  for(let i=1;i<=m;i++){ cur[0]=i;
    for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1));
    [prev,cur]=[cur,prev];
  }
  return prev[n];
}
let _normIndex=null;
function speciesIndex(){
  if(_normIndex) return _normIndex;
  const out=[];
  Object.keys(SPECIES).forEach(n=>{
    if(isTypeForm(n)) return;                      // 合成個体は名前検索に出さない
    out.push({name:n, key:normKana(n), alias:false});
    // 「ギルガルド(シールド)」「イダイトウ♂」「ダイケンキ(ヒスイ)」など、
    // 口では言わない添え字を落とした短い呼び方でも当たるようにする
    const short = n.replace(/[（(].*?[）)]/g,'').replace(/[♂♀]/g,'').trim();
    if(short && short!==n) out.push({name:n, key:normKana(short), alias:true});
  });
  _normIndex = out.sort((a,b)=> b.key.length-a.key.length);
  return _normIndex;
}

/** 文章から出てきたポケモンを、原文の出現位置つきで拾う */
function findSpeciesIn(text){
  const raw = String(text||'');
  const norm = normKana(raw);              // normKana は1文字→1文字なので添字が原文と一致する
  const idx = speciesIndex();
  const used = new Array(norm.length).fill(false);
  const hits = [];
  const free = (at,len)=>{ if(at<0||at+len>norm.length) return false;
    for(let i=at;i<at+len;i++) if(used[i]) return false; return true; };
  const take = (name,at,len,extra)=>{ for(let i=at;i<at+len;i++) used[i]=true;
    hits.push(Object.assign({name,at},extra)); };

  // ①完全一致（長い名前から。「メガ○○」が先に当たるので通常形と取り違えない）
  idx.forEach(e=>{
    if(e.key.length<3) return;
    let from=0, at;
    while((at=norm.indexOf(e.key,from))>=0){
      if(free(at,e.key.length)) take(e.name,at,e.key.length,{exact:true, viaAlias:e.alias});
      from=at+1;
    }
  });

  // ②誤変換の救済：区切りに頼らず、名前ごとに窓をずらして総当たりで当てる
  //   （「と」「の」を区切りにするとイダイトウ等が割れるため）
  const cands=[];
  idx.forEach(e=>{
    const L=e.key.length; if(L<4) return;
    const lim = L>=6 ? 2 : 1;
    for(let w=Math.max(3,L-lim); w<=L+lim; w++){
      for(let at=0; at+w<=norm.length; at++){
        if(!free(at,w)) continue;
        const seg=norm.slice(at,w+at);
        if(/[\u4e00-\u9fff\u3000-\u303f、。,.\s]/.test(seg)) continue;   // 漢字や句読点をまたいだ窓は捨てる
        const d=editDistance(seg,e.key);
        if(d<=lim) cands.push({name:e.name, at, len:w, d, heard:seg, alias:e.alias});
      }
    }
  });
  cands.sort((x,y)=> x.d-y.d || y.len-x.len);       // 誤差が小さく、長く当たったものを優先
  cands.forEach(c=>{ if(free(c.at,c.len)) take(c.name,c.at,c.len,{exact:false,dist:c.d,heard:c.heard,viaAlias:c.alias}); });

  // ③「メガ」＋通常形 の言い落とし（例：メガライチュウ）はメガ形に寄せる
  hits.forEach(h=>{
    if(normKana(h.name).startsWith('めか')) return;
    if(norm.slice(Math.max(0,h.at-2), h.at)!=='めか') return;
    const forms = megaFormsOf(h.name);
    if(forms.length===1){ h.heard=h.heard||('メガ'+h.name); h.name=forms[0]; h.note='「メガ」の後ろなのでメガ形にした'; }
    else if(forms.length>1){ h.heard='メガ'+h.name; h.note='メガ形が複数あるので選び直してください（'+forms.join('／')+'）'; }
  });
  return hits.sort((a,b)=>a.at-b.at);
}

/** 音声メモ1件 → 対戦記録の下書き */
function parseBattleText(text){
  const raw = String(text||'');
  const hits = findSpeciesIn(raw);

  // 話題の切り替わり。漢字表記（相手／自分）も音声変換のひらがなも両方拾う
  const marks=[];
  const scan=(side,re)=>{ let m; const r=new RegExp(re.source,'g'); while((m=r.exec(raw))) marks.push({at:m.index,side}); };
  scan('opp', /相手|あいて|向こう|むこう|敵|てき/);
  scan('me',  /自分|じぶん|こっち|こちら|うち|僕|ぼく|俺|おれ|味方|みかた/);
  marks.sort((a,b)=>a.at-b.at);
  const sideAt = pos => { let side='opp'; for(const m of marks){ if(m.at<=pos) side=m.side; else break; } return side; };

  const opp=[], mine=[];
  hits.forEach(h=>{
    const arr = sideAt(h.at)==='me' ? mine : opp;
    if(!arr.some(x=>x.name===h.name)) arr.push(h);
  });

  // 勝敗（漢字・ひらがな両対応。「勝てなかった」を先に見る）
  let result=null;
  if(/勝っ|勝ち|勝利|かった|かち|とった|捲っ|まくっ/.test(raw)) result='win';
  if(/負け|まけ|敗北|はいぼく|落とし|やられ|溶け/.test(raw)) result='lose';
  if(/勝てな|かてな|勝てん|かてん/.test(raw)) result='lose';

  // ポケモンが1匹も取れていない文で勝敗だけ付くと誤記録になる（例:「おいしかった」）
  if(!hits.length) result = null;

  return {
    opp_team: opp.slice(0,6).map(h=>h.name),
    my_pick:  mine.slice(0,4).map(h=>h.name),
    result,
    uncertain: hits.filter(h=>!h.exact||h.note).map(h=>({heard:h.heard||h.name, guessed:h.name, dist:h.dist, note:h.note})),
    text: raw
  };
}

/* ---------- 類似パーティ検索 ---------- */
/** 過去の対戦から、相手6匹が近いものを返す（共通3体以上） */
function similarBattles(battles, oppNames, minShared){
  minShared = minShared || 3;
  const set = new Set(oppNames);
  return battles.map(b=>{
    const shared = (b.opp_team||[]).filter(x=> set.has(x));
    return { b, shared: shared.length, sharedNames: shared };
  }).filter(x=> x.shared >= minShared)
    .sort((a,b)=> b.shared - a.shared);
}

/* ---------- 相手の技の蓄積（観測ベース） ---------- */
/** 過去のターンログから「このポケモンがよく使う技」を集計 */
function observedMoves(battles){
  const acc = {};   // pokemon -> {move: count}
  battles.forEach(b=>{
    (b.turns||[]).forEach(t=>{
      const p = t.oppMon, a = t.oppAct;
      if(!p || !a) return;
      if(a.type==='move' && a.move){
        acc[p] = acc[p] || {}; acc[p][a.move] = (acc[p][a.move]||0)+1;
      }
    });
  });
  const out = {};
  Object.entries(acc).forEach(([p,mv])=>{
    const total = Object.values(mv).reduce((a,b)=>a+b,0);
    out[p] = Object.entries(mv).map(([m,c])=>({move:m, count:c, rate:c/total}))
      .sort((a,b)=> b.count-a.count);
  });
  return out;
}

/* ★選出の組み立て（2026-08-20 に app.js から移設）。
   ここに置いた理由：画面が無いと選出エンジンを検証できず、実戦記録を機械的に再計算できなかった。
   app.js 側は薄いラッパで呼ぶだけにしてあるので、画面の呼び出し方は変えていない。 */
function rosterForCalc(roster, megaChoice){
  const megaSlots = roster.filter(m=>isMegaForm(m.name)).map(m=>m.name);
  return roster.map(m=>{
    const demote = isMegaForm(m.name) && megaSlots.length>1 && megaChoice && megaChoice!==m.name;
    const calcName = demote ? toBase(m.name) : m.name;
    return {
      label:m.name,                    // 表示・選出の照合はこちら
      name:calcName,                   // 計算に使う姿
      // 画面に出す名前は「実際に計算した姿」。メガ枠を別に切るなら メガ前の名前で出さないと嘘になる
      disp: demote ? toBase(m.name) : m.name,
      demoted:demote,
      stats:realStats(calcName, m.sp, m.nature),
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
function megaSlotsOf(roster){ return roster.filter(m=>isMegaForm(m.name)).map(m=>m.name); }
/** メガの切り方を総当たりして、いちばん良い選出を返す。
 *  第一基準＝予想した相手3体への強さ、第二基準＝予想が外れた時に相手6体をどれだけ見れるか。 */
function bestPlan(roster, targets, size, allOpp, fixedMega, effOpp){
  effOpp = effOpp || (n=>n);   // 相手のメガを反映する関数。画面側から渡す（node検証では素通し）
  const slots = megaSlotsOf(roster);
  /* ★社長が手でメガ枠を決めているなら、その前提だけで選出を組む。
     これをやっていなかったので「メガ=メガクチート なのに選出3体にクチートがいない」
     という矛盾した提案が出ていた（2026-08-19 の指摘）。 */
  const choices = fixedMega ? [fixedMega] : (slots.length>1 ? slots : [null]);
  const pool = [];
  choices.forEach(ch=>{
    const rc = rosterForCalc(roster, ch);
    const sug = suggestPicks(rc, targets, Math.min(size, rc.length));
    sug.top.forEach(c=>{
      // 選んだメガが選出に入っていない案は、メガを切る意味がないので除外
      if(ch && !c.members.includes(ch)) return;
      // メガ枠が1枚だけの構築でも、それが選出に入るなら「そこに切る」と明示する
      const mega = ch || (slots.length===1 && c.members.includes(slots[0]) ? slots[0] : null);
      /* ★予想が外れた場合の保険：相手6体のうち何体を見られるか。
         2026-08-21 修正（社長の指摘）：
         「ギャラドスが6体すべてに有利と出ているのに、選出予想に入っていない」
         原因は**同じ問いを2つの基準で計算していた**こと（鉄則⑤）。
           ・選出エンジン … `matchup().winsRace`（先に落とせるか）だけ
           ・先発候補カード … `callIt()` の ◎○（受け・盤面作りも数える）
         受けや流しで止めている相手を backup が数えていなかったので、
         「6体に広く効く駒」が選出に上がってこなかった。→ callIt に揃える。 */
      let backup = 0, blind = [];
      (allOpp||targets).forEach(o=>{
        const ok = c.members.some(n=>{
          const m = rc.find(r=>r.label===n) || {name:n};
          try{ const cc = callIt(m, effOpp(o), {}); return cc && (cc.mark==='◎' || cc.mark==='○'); }
          catch(e){ const mu = matchup(m,{name:effOpp(o)}); return mu && mu.winsRace; }
        });
        ok ? backup++ : blind.push(o);
      });
      pool.push({plan:c, mega, rc, backup, blind});
    });
  });
  if(!pool.length){
    const rc = rosterForCalc(roster, null);
    const sug = suggestPicks(rc, targets, Math.min(size, rc.length));
    return {plan:sug.top[0], mega:null, rc, backup:0, blind:[], all:sug.top.map(p=>({plan:p,rc,backup:0,blind:[]}))};
  }
  /* ★並べ方（2026-08-20 修正）。
     以前は cover（何体を見られるか）が最優先だったため、
     「広く浅く見られるが、実際に出てくる相手には勝てない3体」が常に1位になっていた。
     → cover が同じなら、**いちばん苦しい対面がマシな案**を上に出す（worst）。
       1体でも「手も足も出ない」対面があると、そこで試合が壊れるため。 */
  /* ★並べ方（2026-08-21 修正）。
     予想3体への強さ(cover)が並んだら、**次は「相手6体をどれだけ見られるか」(backup)**。
     以前は worst（いちばん苦しい対面）を先に見ていたが、worst は 0 で並ぶことが多く、
     実質 total（予想3体への合計点）で決まっていた。
     **選出予想の的中は 18/36＝50% しかない。** 予想が外れたときに効くのは backup の方なので、
     こちらを先に見る。cover は変えていない（点数の設計そのものは触らない）。 */
  pool.sort((a,b)=> b.plan.cover-a.plan.cover
                 || b.backup-a.backup
                 || (b.plan.worst||0)-(a.plan.worst||0)
                 || b.plan.total-a.plan.total);
  // 同じ並びが重複しないように畳む
  const seen=new Set(), uniq=[];
  pool.forEach(p=>{ const k=[...p.plan.members].sort().join('|'); if(seen.has(k))return; seen.add(k); uniq.push(p); });
  return {...uniq[0], all:uniq.slice(0,3)};
}

global.PC = {
  TYPES, TYPE_COLOR, TYPE_ICON, CHART, NATURES, SPECIES, MOVES,
  whoElseHas, movePlan, movePriority, oppOneHitGuard, multiHitOf, MULTI_HIT, oppAtkAbility, unknownMoveSlots, hazardValue, statusBlockers,
  loadData, effectiveness, statHP, statOther, natureMods, realStats, assumedStat,
  assumedSpreads, spreadStats, attackerLikeness, matchupVs, SP_TOTAL, SP_MAX,
  OPP_ABILITY, worstDefAbility, survivesOneHit, OPP_TRICKS, oppTricks,
  setOppItems, oppItemFixed, oppItemsRaw,
  MEGA_OF, BASE_OF, isMegaForm, megaFormsOf, canMega, toBase, predictLead,
  predictPicks, backtestPicks, rosterForCalc, megaSlotsOf, dispName, bestPlan,
  rankMul, calcDamage, matchup, buildMatrix, suggestPicks, leadCheck, offenseCat, offenseBias,
  bestOffense, bestThreat, immuneType, myOneHitGuard, myRoles, supportValue, oppUsage, oppTypeItem,
  readDamage, actionNow, callIt, keyPieces, solveSpread, SURE_RATE, rolesOf, partnersOf, teamItemsOf, predictRest, teamData, oppItemCandidates, confirmedMoves, oppMoveChoices, clearMatchupCache, oppMoves, oppOffenseItem, oppScarfRate, usagePhysical,
  similarBattles, observedMoves, parseBattleText, findSpeciesIn, normKana,
  searchSpecies, toRomaji, romajiKey, nameKey, weatherSpeedAbility, WEATHER_SPEED, intimidateEffect, graveMovePower, GRAVE_MOVES, statUpOf, STAT_UP, moveBlockers, whoBlocks, speedCheck,
  PROTEAN_ABILITY, hasProtean, typeFormName, typeFormOf, stripTypeForm, typeAdvice, isTypeForm,
  TYPE_CHANGE_MOVES, typeChangeOf
};
})(window);
