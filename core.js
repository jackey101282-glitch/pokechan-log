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
const TYPE_COLOR = {
  ノーマル:'#a8a878', ほのお:'#f0805a', みず:'#6a90da', でんき:'#f4cf4a', くさ:'#77c765',
  こおり:'#7fd0d0', かくとう:'#c8564a', どく:'#ac6ac8', じめん:'#dcb95a', ひこう:'#9aaef0',
  エスパー:'#f4699a', むし:'#a8b840', いわ:'#bfa94a', ゴースト:'#7a6aba', ドラゴン:'#7460e8',
  あく:'#8a6a56', はがね:'#a8a8c0', フェアリー:'#efa0c0'
};

// タイプアイコン（12x12 viewBox の SVG パス。外部画像を使わず自己完結）
const TYPE_ICON = {
  ノーマル:'M6 1.6a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8zm0 2a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z',
  ほのお:'M6 .8C6 3 4 3.6 4 6a2 2 0 001 1.7C4.6 5.9 6 5 6 5s-.6 1.6.5 2.4c.6.5.5 1.3.1 1.8C8 8.9 9 7.6 9 6.1 9 3.6 7.4 3 6 .8z',
  みず:'M6 1C4.2 3.4 3 5 3 6.8A3 3 0 006 10a3 3 0 003-3.2C9 5 7.8 3.4 6 1z',
  でんき:'M7.4 1L3 6.4h2.3L4.6 11 9 5.3H6.6L7.4 1z',
  くさ:'M10 1.6C5.8 1.4 2.6 3 2.2 6.2c-.2 1.7.5 3 1.6 3.9.3-2.4 1.6-4.2 3.7-5.3C5.8 6 4.6 7.6 4.3 10.2c3.6.6 5.9-2.6 5.7-8.6z',
  こおり:'M5.4 1h1.2v3l1.7-1 .6 1-1.7 1 1.7 1-.6 1-1.7-1v3H5.4V8l-1.7 1-.6-1 1.7-1-1.7-1 .6-1 1.7 1V1z',
  かくとう:'M2.6 4.2h4.2c1.4 0 2.4.9 2.4 2.1 0 1.4-1 2.4-2.6 2.4H4.4c-1.1 0-1.8-.6-1.8-1.6V4.2zm.4-2h3.2v1.4H3z',
  どく:'M6 1.4c-2 0-3.4 1.5-3.4 3.3 0 1 .5 1.8 1.2 2.4-.3.3-.5.7-.5 1.2 0 .8.7 1.4 1.6 1.4h2.2c.9 0 1.6-.6 1.6-1.4 0-.5-.2-.9-.5-1.2.7-.6 1.2-1.4 1.2-2.4C9.4 2.9 8 1.4 6 1.4z',
  じめん:'M1.2 7.4l3-3.6 2.2 2 1.6-1.4 2.8 3v2.2H1.2V7.4zM3 2.4a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2z',
  ひこう:'M11 2.2C8.6 2 5.8 2.6 4 4.4 2.6 5.8 1.8 7.6 1.4 9.6c1.2-1.4 2.6-2.3 4.3-2.6-.9.9-1.5 1.8-1.9 2.9 3.4-.7 6.6-3.6 7.2-7.7z',
  エスパー:'M6 1.6C3.4 1.6 1.4 3.4.8 6c.6 2.6 2.6 4.4 5.2 4.4S10.6 8.6 11.2 6C10.6 3.4 8.6 1.6 6 1.6zm0 1.8A2.6 2.6 0 116 8.6a2.6 2.6 0 010-5.2zm0 1.2a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z',
  むし:'M6 3.4a2.8 3.2 0 100 6.4 2.8 3.2 0 000-6.4zM3.4.9l1.8 1.6-.7.8L2.7 1.7zm5.2 0l.7.8-1.8 1.6-.7-.8zM1 5.6h1.8v1H1zm8.2 0H11v1H9.2z',
  いわ:'M2 8.6L4.2 3h3.6L10 8.6l-1.6 1.8H3.6z',
  ゴースト:'M6 1.2c-2 0-3.4 1.6-3.4 3.6v5.2l1.2-1 1.1 1 1.1-1 1.1 1 1.2-1V4.8C9.3 2.8 8 1.2 6 1.2zM4.8 4.2a.8.8 0 110 1.6.8.8 0 010-1.6zm2.4 0a.8.8 0 110 1.6.8.8 0 010-1.6z',
  ドラゴン:'M10.8 1.2C8.4 1.4 6 2.4 4.4 4.2 3 5.8 2 7.8 1.4 10c1-.9 1.9-1.8 2.9-2.4l.5 1.3 1.2-2 1.1 1 .6-1.9 1.7.5-.4-1.7c1.2-.7 2-1.7 1.8-3.6z',
  あく:'M8.6 1.4A4.6 4.6 0 006 10.4a4.6 4.6 0 004.4-3.2 3.6 3.6 0 01-1.8-5.8z',
  はがね:'M6 1L10 3.2v5.6L6 11 2 8.8V3.2L6 1zm0 3a2 2 0 100 4 2 2 0 000-4z',
  フェアリー:'M6 .8l1.4 3.1L10.7 4l-2.4 2.3.7 3.3L6 8l-3 1.6.7-3.3L1.3 4l3.3-.1L6 .8z'
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
  buildMegaMap();
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
function assumedSpreads(name){
  const sc = SPECIES[name]; if(!sc) return [];
  const b = sc.base;
  const phys   = b.a >= b.c;
  const atkKey = phys ? 'a' : 'c', dumpKey = phys ? 'c' : 'a';
  const A = phys ? 'A' : 'C';

  const aSp  = {h:2,a:0,b:0,c:0,d:0,s:SP_MAX};  aSp[atkKey] = SP_MAX;
  const aMod = {a:1,b:1,c:1,d:1,s:1};           aMod[atkKey] = 1.1; aMod[dumpKey] = 0.9;
  const sMod = {a:1,b:1,c:1,d:1,s:1.1};         sMod[dumpKey] = 0.9;

  const defKey = b.b >= b.d ? 'b' : 'd';
  const dSp  = {h:SP_MAX,a:0,b:17,c:0,d:17,s:0};
  const dMod = {a:1,b:1,c:1,d:1,s:1};           dMod[defKey] = 1.1; dMod[dumpKey] = 0.9;

  const w = attackerLikeness(name);
  return [
    { kind:'atk',  label:`攻撃型（${A}32/S32・${A}補正）`, physical:phys,
      stats:spreadStats(name, aSp, aMod), weight:w * 0.6 },
    { kind:'fast', label:`最速型（${A}32/S32・S補正）`,    physical:phys,
      stats:spreadStats(name, aSp, sMod), weight:w * 0.4 },
    { kind:'def',  label:'耐久型（H32/B17/D17）',          physical:phys,
      stats:spreadStats(name, dSp, dMod), weight:1 - w }
  ].filter(s=>s.stats);
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

  let power = mv.power;
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

  let otherMod = 1;
  if(dab==='マルチスケイル' && (o.defender.hpRatio==null || o.defender.hpRatio>=1)){
    otherMod*=0.5; notes.push('マルチスケイル ×0.5');
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
  for(let r=85;r<=100;r++){
    let d = Math.floor(base * r / 100);
    d = Math.floor(d * stab);
    d = Math.floor(d * eff);
    d = Math.floor(d * burnMod);
    d = Math.floor(d * otherMod);
    rolls.push(Math.max(1, d));
  }
  const min = rolls[0], max = rolls[rolls.length-1];
  const hp = o.defender.hp || 1;
  const pctMin = min/hp*100, pctMax = max/hp*100;

  // 確定数
  let ko = '';
  for(let n=1;n<=6;n++){
    if(min*n >= hp){ ko = `確定${n}発`; break; }
    if(max*n >= hp){
      const cnt = rolls.filter(v=> v*n >= hp).length;
      ko = `乱数${n}発（${Math.round(cnt/16*100)}%）`; break;
    }
  }
  if(!ko) ko = '7発以上';

  return { eff, min, max, rolls, pctMin, pctMax, ko, note:notes };
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
function bestOffense(mine, oppName, opp){
  const os = SPECIES[oppName]; if(!os) return {rate:0, move:null};
  const hp = opp.stats.h;
  const myStats = mine.stats || spreadStats(mine.name, {h:2,a:32,b:0,c:32,d:0,s:32}, {a:1,b:1,c:1,d:1,s:1});
  const moves = (mine.moves||[]).map(m=>MOVES[m]).filter(m=>m && m.power && m.cat!=='変');
  // 技が未登録ならタイプ一致の代表技で見積もる
  const cands = moves.length ? moves
    : SPECIES[mine.name].types.map(t=>({name:'（'+t+'技）', type:t, cat: (myStats.a>=myStats.c?'物':'特'), power:REP_POWER, contact:false}));
  let best={rate:0, move:null};
  cands.forEach(mv=>{
    const atk = mv.cat==='物' ? myStats.a : myStats.c;
    const def = mv.cat==='物' ? opp.stats.b : opp.stats.d;
    const r = calcDamage({
      attacker:{name:mine.name, atkStat:atk, types:SPECIES[mine.name].types, ability:mine.ability||'', item:mine.item||'', rank:0, hpRatio:1},
      defender:{name:oppName, defStat:def, hp, types:os.types, ability:'', item:'', rank:0, hpRatio:1},
      move:mv, field:{}, flags:{}
    });
    if(r.error || r.eff===0) return;
    const rate = ((r.min + r.max)/2) / hp;
    if(rate > best.rate) best = {rate, move:mv.name};
  });
  return best;
}
/** 相手の最大打点（自分のHPに対する割合）。opp は assumedSpreads() の1要素 */
function bestThreat(oppName, mine, opp){
  const os = SPECIES[oppName], ms = SPECIES[mine.name];
  if(!os || !ms) return {rate:0, type:null};
  const myStats = mine.stats || spreadStats(mine.name, {h:32,a:0,b:17,c:0,d:17,s:0}, {a:1,b:1,c:1,d:1,s:1});
  const imm = immuneType(mine.ability);
  const physical = opp.stats.a >= opp.stats.c;
  let best={rate:0, type:null};
  os.types.forEach(t=>{
    if(t === imm) return;                       // 特性で無効化
    const mv = {name:'（'+t+'技）', type:t, cat: physical?'物':'特', power:REP_POWER, contact:false};
    const r = calcDamage({
      attacker:{name:oppName, atkStat: physical?opp.stats.a:opp.stats.c, types:os.types, ability:'', item:'', rank:0, hpRatio:1},
      defender:{name:mine.name, defStat: physical?myStats.b:myStats.d, hp:myStats.h,
                types:ms.types, ability:mine.ability||'', item:mine.item||'', rank:0, hpRatio:1},
      move:mv, field:{}, flags:{}
    });
    if(r.error || r.eff===0) return;
    const rate = ((r.min + r.max)/2) / myStats.h;
    if(rate > best.rate) best = {rate, type:t};
  });
  return best;
}

/** 自分1体 × 相手の想定1通り を採点 */
function matchupVs(mine, oppName, opp){
  const myS = mine.stats ? mine.stats.s : spreadStats(mine.name,{h:2,a:0,b:0,c:0,d:0,s:32},{a:1,b:1,c:1,d:1,s:1}).s;
  const opS = opp.stats.s;
  const faster = myS > opS;

  const off = bestOffense(mine, oppName, opp);      // 自分→相手 のダメージ割合
  const thr = bestThreat(oppName, mine, opp);       // 相手→自分 のダメージ割合

  // 何発で落とせるか / 落とされるか
  const myHits = off.rate>0 ? Math.ceil(1/off.rate) : 99;
  const opHits = thr.rate>0 ? Math.ceil(1/thr.rate) : 99;

  // 先に落とせるか（同じ発数なら速い方が勝ち）
  const winsRace = myHits < opHits || (myHits === opHits && faster);

  // スコア：発数差 ＋ 速さ ＋ 打点の厚み
  const score = (opHits - myHits) * 0.9 + (faster ? 0.35 : -0.2) + (off.rate - thr.rate) * 1.1;

  // 明確に不利＝初手に置いてはいけない対面
  const danger = (!winsRace && thr.rate >= 0.5) || (opHits <= 2 && myHits >= 4);

  return { kind:opp.kind, label:opp.label, weight:opp.weight,
           faster, myS, opS, score, winsRace, danger,
           myDmg:off.rate, myMove:off.move, myHits,
           opDmg:thr.rate, opType:thr.type, opHits };
}

/* 同じ (自分の個体 × 相手) の組み合わせは何度も出てくるので結果を使い回す */
const _muCache = new Map();
function _muKey(mine, oppName){
  const st = mine.stats ? [mine.stats.h,mine.stats.a,mine.stats.b,mine.stats.c,mine.stats.d,mine.stats.s].join('.') : '-';
  return [mine.name, st, (mine.moves||[]).join('/'), mine.ability||'', mine.item||'', oppName].join('|');
}

/** 自分1体 vs 相手1体。相手の型は「攻撃型」「耐久型」の2通りで見て、
 *  主想定（種族値から見てありそうな方）の結論を返しつつ、
 *  もう一方と結論が割れたら split=true で知らせる。 */
function matchup(mine, theirs){
  const ms = SPECIES[mine.name], ts = SPECIES[theirs.name];
  if(!ms || !ts) return null;
  const key = _muKey(mine, theirs.name);
  const hit = _muCache.get(key); if(hit) return hit;

  const spreads = assumedSpreads(theirs.name);
  if(!spreads.length) return null;
  const views = spreads.map(sp=> matchupVs(mine, theirs.name, sp));

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
    score: wavg(v=>v.score),
    myDmg: wavg(v=>v.myDmg),
    opDmg: wavg(v=>v.opDmg),
    myDmgLo: Math.min(...views.map(v=>v.myDmg)), myDmgHi: Math.max(...views.map(v=>v.myDmg)),
    opDmgLo: Math.min(...views.map(v=>v.opDmg)), opDmgHi: Math.max(...views.map(v=>v.opDmg)),
    split, views, primary, other,
    // 「どの型でも勝てる／どの型でも負ける」は選出の判断に直結するので別に持つ
    winsAll:  views.every(v=>v.winsRace),
    dangerAll:views.every(v=>v.danger)
  };
  _muCache.set(key, out);
  return out;
}

/** 自分6 × 相手6 のマトリクス */
function buildMatrix(myRoster, oppNames){
  return myRoster.map(m=> oppNames.map(o=> matchup(m, {name:o})));
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
      const anyWin = c.some(i=> mat[i][j] && mat[i][j].winsRace);
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
    const penalty = shared.length * 1.2 + (bias ? 0.8 : 0);
    return { members:c.map(i=> myRoster[i].label || myRoster[i].name), cover, total: total - penalty,
             worst, uncovered, sharedWeak: shared, bias };
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

global.PC = {
  TYPES, TYPE_COLOR, TYPE_ICON, CHART, NATURES, SPECIES, MOVES,
  loadData, effectiveness, statHP, statOther, natureMods, realStats, assumedStat,
  assumedSpreads, spreadStats, attackerLikeness, matchupVs, SP_TOTAL, SP_MAX,
  MEGA_OF, BASE_OF, isMegaForm, megaFormsOf, canMega, toBase, predictLead,
  predictPicks, backtestPicks,
  rankMul, calcDamage, matchup, buildMatrix, suggestPicks, leadCheck, offenseCat, offenseBias,
  bestOffense, bestThreat, immuneType,
  similarBattles, observedMoves
};
})(window);
