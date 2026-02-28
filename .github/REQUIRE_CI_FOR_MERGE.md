# PR マージ前に CI を必須にする（マージブロック）

PR をマージする前に「CI (format / build / lint) が通ること」を必須にしたい場合、GitHub のブランチ保護で以下を設定してください。

1. リポジトリ → **Settings** → **Branches**
2. **Add branch protection rule**（または保護したいブランチの **Edit**）
3. **Branch name pattern**: `main` または `develop`（CI ワークフローが走るブランチに合わせる）
4. ✅ **Require status checks to pass before merging** をオンにする
5. **Status checks that are required** で次を追加:
   - `format, build, lint`（ci.yml の job 名。表示名で選択）
6. 必要に応じて **Require branches to be up to date before merging** もオンにすると、マージ前に最新の base を取り込む必要があります。

これで、CI が失敗している PR はマージできません。

## CI で使うシークレット

`ci.yml` の Build ステップでは `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を参照しています。  
CI でビルドを通すには、リポジトリの **Settings → Secrets and variables → Actions** にこれらを登録するか、CI 用のダミー値を用意してください。
