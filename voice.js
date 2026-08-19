/* 音声サポート。
   ★前提（2026-08-19 iPhone iOS 18.7 実機で確認済み）
     ・iOSのマナーモード（消音スイッチ）は speechSynthesis と Web Audio を鳴らさない。
       社長は「ポケモンの音がうるさいのでマナーモードは解除できない」。
     ・<audio> のメディア再生は消音スイッチの影響を受けず、バックグラウンドでも鳴り続ける。
       実測: 裏に回っても6秒間隔で22秒以上、再生が途切れなかった。
   → 読み上げは使わない。事前に作った音声ファイル(app/voice/clips)を順番に鳴らす。
   → 声を変えたい時は tools/make-voice.sh を VOICE= で回し直すだけ。ここは無改修。 */
const VOICE = (()=>{
  let map=null, ready=false, on=false, keepEl=null, el=null, q=[], playing=false, lastKey='';

  const load = async ()=>{
    if(map) return map;
    try{
      const r = await fetch('voice/manifest.json', {cache:'force-cache'});
      const j = await r.json(); map = j.map || {};
    }catch(e){ map = {}; }
    return map;
  };

  /* 音声はユーザーの指タップから始めないとiOSが鳴らさない。
     さらに「無音ループを先に鳴らして、メディア再生中の状態を作る」と裏で切れにくい。 */
  const start = async ()=>{
    if(!el){
      el = new Audio(); el.preload='auto'; el.playsInline=true;
      el.addEventListener('ended', next);
      el.addEventListener('error', next);      // 1つ壊れても後続を止めない
    }
    if(!keepEl){
      keepEl = new Audio('voice/keepalive.m4a');
      keepEl.loop=true; keepEl.preload='auto'; keepEl.playsInline=true; keepEl.volume=0.02;
    }
    await load();
    try{ await keepEl.play(); }catch(e){}
    ready = true;
  };

  const next = ()=>{
    playing=false;
    if(!q.length) return;
    const id = q.shift();
    playing=true;
    el.src = 'voice/clips/'+id+'.m4a';
    el.play().catch(()=>{ playing=false; setTimeout(next,0); });
  };

  /* 文の配列を順に鳴らす。map に無い文は黙って飛ばす（読み上げにフォールバックしても
     マナーモードでは鳴らないので、無い＝作り忘れとして扱い、静かに落とす）。 */
  const say = (lines)=>{
    if(!on || !ready || !map) return;
    const ids = (lines||[]).filter(Boolean).map(t=> map[t]).filter(Boolean);
    if(!ids.length) return;
    q = ids;                       // 古い指示は捨てる。試合中に前の結論が流れ続けるのは害
    if(el){ try{ el.pause(); }catch(e){} }
    playing=false; next();
  };

  /* 同じ結論を何度も繰り返さない。画面の再描画は頻繁に起きるため。 */
  const sayIfChanged = (key, lines)=>{
    if(key===lastKey) return;
    lastKey = key; say(lines);
  };

  return {
    isOn: ()=> on,
    isReady: ()=> ready,
    missing: (lines)=> map ? (lines||[]).filter(t=> t && !map[t]) : [],
    async toggle(v){
      on = (v==null) ? !on : !!v;
      if(on && !ready) await start();
      if(!on){ q=[]; lastKey=''; if(el){ try{ el.pause(); }catch(e){} } if(keepEl){ try{ keepEl.pause(); }catch(e){} } }
      return on;
    },
    say, sayIfChanged,
    reset(){ lastKey=''; }
  };
})();

/* callIt() の結果を「喋る文」に変換する。
   ★試合中の選択は45秒しかない。長く喋らせるのは害なので、必ず短い順に3文まで。
     1文目 結論（＋撃つ技／引き先）
     2文目 一撃を取られる警告
     3文目 相手が交代してきた時の答え */
function voiceLines(c, opts){
  opts = opts || {};
  if(!c) return [];
  const out = [];
  const head = c.head;
  const myMove = c.mu && c.mu.myMove;

  if(head==='引く' || head==='居座らない'){
    const to = c.to && c.to.name;
    // 引き先の名前は「自分の6体」なので専用の1文がある
    out.push(to ? `${head}。${to}へ` : head);
  }else if((head==='殴る' || head==='削る') && myMove){
    out.push(head);
    out.push(`${myMove}でいく`);
  }else{
    out.push(head);
  }

  // 一撃を取られる技（採用率がいちばん高いもの1つだけ）
  const ko = (c.koMoves||[])[0];
  if(ko && ko.move) out.push(`注意。${ko.move}で一撃`);
  else if(c.mu && c.mu.noOffense) out.push('打点が無い');

  // 相手が交代してきたら、の答え（いちばん危ない1体だけ）
  const sw = opts.switchIn;
  if(sw && sw.name && sw.head){ out.push(`${sw.name}が来たら`); out.push(sw.head); }

  return out;
}

if(typeof window!=='undefined'){ window.VOICE=VOICE; window.voiceLines=voiceLines; }
