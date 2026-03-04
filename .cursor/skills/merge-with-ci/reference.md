# Reference: gh コマンドとマージまわり

## gh pr checks

- `gh pr checks [<number>]`: PR のステータスチェック一覧。`--watch` で完了まで待機。
- チェックがまだない場合や branch protection で必須のチェックが未設定の場合は、マージ可能と出ることがある。その場合は「CI が走り終わるまで待つ」運用にする。

## gh pr merge

- `gh pr merge <number> --merge`: マージコミットでマージ。
- `--delete-branch`: リモートのブランチを削除。
- branch protection で「Require status checks」が有効な場合、CI が通るまでマージは失敗する。そのときは CI 通過後に再度 `gh pr merge` を実行する。

## gh run list / gh run view

- `gh run list -b develop -L 5`: develop ブランチの直近のワークフロー実行一覧。
- `--json databaseId,status,conclusion,name`: プログラムで扱いやすい形式。
- `status`: "in_progress" | "completed" | ...
- `conclusion`: "success" | "failure" | "cancelled" | null（未完了時）.
- マージ直後は push トリガーの Deploy がまだ `queued` のことがある。数十秒待ってから `gh run list -b develop -L 1` で確認する。

## マージ後の CI 検知の流れ

1. `gh pr merge` でマージ。
2. 数秒〜数十秒待つ（push が GitHub に反映されワークフローがキックされるまで）。
3. `gh run list -b develop -L 3` で直近の run を確認。一番上がマージ push による Deploy の可能性が高い。
4. `status` が "completed" かつ `conclusion` が "success" なら成功。 "failure" ならユーザーに報告し、`gh run view <id>` の URL を伝える。

## 権限まわり

- `gh pr create` や `gh pr merge` が権限エラーになる場合: 手動でブラウザから PR 作成・マージし、マージ後の確認だけ `gh run list` で行う。
- 手動 PR 作成 URL: `https://github.com/Masuda-1246/wingfox/pull/new/<branch-name>`

## スクリプトで CI 通過を待つ（Option B の補足）

`gh pr checks` の出力は環境により異なるため、確実に待つ場合は `gh pr view <pr-number> --json statusCheckRollup` で全チェックの `status` / `conclusion` を確認する。最も簡単なのは `gh pr checks <number> --watch` をそのまま使うこと。
