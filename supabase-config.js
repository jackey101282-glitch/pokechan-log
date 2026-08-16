/* ポケモンチャンピオンズ バトルログDB - 接続設定
   このキーはブラウザに出る前提の公開鍵（publishable / anon）なので、公開リポジトリに置いて問題ありません。
   実際に見えるデータは Supabase 側の RLS が「ログイン中の本人の行だけ」に絞ります。
   ※ sb_secret_ / service_role で始まるキーは絶対にここに入れないこと。
*/
window.SUPA = {
  url: "https://bilgytbofvudlhqjfstk.supabase.co",
  key: "sb_publishable_wR2DAkwz2UWeEUuVBHWI7g_FViKyRXZ"
};
