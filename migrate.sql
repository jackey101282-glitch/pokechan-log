alter table public.teams   add column if not exists roster    jsonb not null default '[]';
alter table public.teams   add column if not exists plans     jsonb not null default '{}';
alter table public.teams   add column if not exists note      text;
alter table public.battles add column if not exists turns     jsonb not null default '[]';
alter table public.battles add column if not exists mega      text;
alter table public.battles add column if not exists opp_mega  text;
alter table public.battles add column if not exists pred_lead text;

-- ---------- 2026-08-20 追加：敗因をざっくり残すための列 ----------
-- 社長の要望：「一手ずつ全部記録するのはハードルが高い。負けた試合の敗因が溜まればいい」
-- 勝ち試合は2タップ、負け試合でも数タップで終わるようにするための最小限の構造化。
alter table public.battles add column if not exists lose_cause text;  -- 構築相性/選出/技相性/プレイング/事故/不明
alter table public.battles add column if not exists pain_mon   text;  -- いちばんきつかった相手
alter table public.battles add column if not exists pain_move  text;  -- やられた技
alter table public.battles add column if not exists pain_my    text;  -- やられたこちらの駒
