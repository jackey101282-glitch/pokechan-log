# バトルログDB セットアップ手順（所要 約7分）

やることは3つだけです。**① Supabaseでプロジェクトを作る → ② SQLを貼る → ③ キーを設定ファイルに入れる**

---

## ① Supabaseプロジェクトを作る（3分）

1. https://supabase.com/dashboard を開いてログイン（GitHubアカウントでOK）
2. **New project** を押す
3. 入力する項目
   - **Name**: `pokemon-champions-log`（何でもOK）
   - **Database Password**: 自動生成でOK。**パスワードマネージャに保存**する。
     このアプリでは一切使いません（Postgresへ直接つなぐとき用）。忘れても Settings → Database からリセット可能
   - **Region**: `Northeast Asia (Tokyo)`
4. **Security** のチェック
   | 項目 | 設定 | 理由 |
   |---|---|---|
   | Enable Data API | **✅ ON** | supabase-js から読み書きするのに必須 |
   | Automatically expose new tables | **☐ OFF** | Supabase公式の推奨。今後うっかり作ったテーブルが自動公開されない。必要な2テーブルは `schema.sql` の `grant` で明示的に開ける |
   | Enable automatic RLS | **✅ ON** | 今後テーブルを追加したとき、RLSの付け忘れで丸見えになる事故を構造的に防げる |
5. **Create new project** → 1〜2分待つ

> Miettaやライフプランアプリとは**別プロジェクトにしてください**。本番DBに個人ツールのテーブルを混ぜると、後で片方を触ったときにもう片方を壊しかねません。

---

## ② テーブルを作る（1分）

1. 左メニューの **SQL Editor** を開く
2. **New query**
3. このフォルダの [`schema.sql`](schema.sql) の中身を**全部**コピーして貼り付け
4. **Run**（`Success. No rows returned` と出れば完了）

> このSQLは何度実行しても既存データを消しません。将来カラムを足すときも同じ場所に追記して実行します。

---

## ③ 接続キーを入れる（1分）

1. 左メニュー **Project Settings** → **API**
2. 以下の2つをコピー
   - **Project URL**（`https://xxxxxxxx.supabase.co`）
   - **anon public**（`Publishable key` と表示されている場合もあります）
3. このフォルダの `supabase-config.js` を開いて置き換える

```js
window.SUPA = {
  url: "https://xxxxxxxx.supabase.co",
  key: "eyJhbGciOi...（長い文字列）"
};
```

> ⚠️ **service_role / secret キーは絶対に入れないでください。** anon キーはブラウザに出る前提の公開鍵で、RLS（行レベルセキュリティ）で守られているため公開して問題ありません。

---

## ④ 初回ログイン

1. `index.html` をブラウザで開く（ローカルでもOK）
2. メールアドレスとパスワードを入れて **「はじめて使う（アカウント作成）」**
3. 確認メールが届いたらリンクを開いてからログイン

### 確認メールを省きたい場合
Supabase → **Authentication** → **Sign In / Providers** → Email の
**Confirm email** を **OFF** にすると、作成したその場でログインできます。

### 自分以外に登録されないようにする（推奨）
アカウントを作り終わったら、Supabase → **Authentication** → **Sign In / Providers** →
**Allow new users to sign up** を **OFF** にしてください。
以降は **IDとパスワードを知っている人（＝自分）だけ**がログインできる状態になります。

---

## ⑤ Web公開（スマホから使うため）

ライフプランアプリと同じ流れです。

```bash
cd /Users/yuseiimaoka/ポケモンチャンピオンズ/app
git init && git add -A && git commit -m "battle log v1"
gh repo create pokechan-log --public --source=. --push
```

その後 GitHub の **Settings → Pages → Source: main / (root)** で公開。
数分後に `https://jackey101282-glitch.github.io/pokechan-log/` で開けます。
スマホでそのURLを開き、ホーム画面に追加すればアプリのように使えます。

---

## データが消えないことの保証

| 操作 | データへの影響 |
|---|---|
| ページを更新する | **影響なし**（データはSupabase側） |
| アプリを作り直して再デプロイする | **影響なし**（HTMLとDBは別物） |
| スマホを機種変更する | **影響なし**（同じID/PWでログインすれば全部見える） |
| ブラウザのキャッシュを消す | **影響なし**（消えるのは入力途中の下書きのみ） |
| Supabaseプロジェクトを削除する | **消える**（これだけは絶対にやらない） |

さらに保険として、**履歴タブの「JSONで書き出し」**を月1回押してファイルを保存しておけば完全です。
