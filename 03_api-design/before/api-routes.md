# TaskFlow API ルート一覧（手作業版）

急ぎで書いたAPI設計。動くには動くが、REST原則から外れた箇所が散在している。
研修ではこのファイルを受講者に見せ、何が問題か議論してから AI による改善に進む。

---

## 認証

```
POST /api/login
  body: { email, password }
  response: { token: "xxx", user: { id, name, email } }

POST /api/register
  body: { name, email, password }
  response: { message: "登録しました" }
```

違反 1 -- レスポンス形式の不統一
  login は token + user を返すのに、register は message だけ。
  登録直後にログイン状態にできない設計になっている。

違反 2 -- トークンリフレッシュが存在しない
  accessToken の有効期限が切れたらログインし直すしかない。

違反 3 -- 認証ヘッダーの独自仕様
  補足欄に「token: xxx」とあるが、標準は Authorization: Bearer xxx。
  独自ヘッダーはクライアントライブラリとの互換性を壊す。

---

## プロジェクト

```
GET /api/getProjects
  response: [{ id, name, description, status, created_at }]

GET /api/getProject?id=xxx
  response: { id, name, description, status, created_at, members: [...] }

POST /api/createProject
  body: { name, description }
  response: { success: true, data: { id, name } }

POST /api/updateProject
  body: { id, name, description }
  response: { success: true }

POST /api/deleteProject
  body: { id }
  response: { success: true }

GET /api/getProjectMembers?projectId=xxx
  response: [{ userId, name, role }]

POST /api/addMember
  body: { projectId, userId, role }
  response: { ok: true }

POST /api/removeMember
  body: { projectId, userId }
  response: { ok: true }
```

違反 4 -- URLに動詞が入っている
  /api/getProjects, /api/createProject, /api/deleteProject ...
  RESTではリソース名（名詞）をパスに置き、操作はHTTPメソッドで表す。
  正しくは GET /api/projects, POST /api/projects, DELETE /api/projects/:id。

違反 5 -- HTTPメソッドの誤用
  更新も削除もすべてPOST。PATCHやDELETEが使われていない。
  deleteProject が POST で body に id を渡す設計は、キャッシュやべき等性の観点で問題がある。

違反 6 -- リソースIDの渡し方が不統一
  getProject はクエリパラメータ ?id=xxx で渡す。
  パスパラメータ /projects/:id のほうが意味的に正しく、OpenAPI定義も書きやすい。

違反 7 -- レスポンスエンベロープの不統一
  { success: true, data: {...} } / { success: true } / { ok: true } が混在。
  クライアント側で3パターンのパーサーを書く羽目になる。

違反 8 -- ページネーション未対応
  getProjects は全件返却。プロジェクトが1000件あっても全部返す。
  一覧系エンドポイントにはページネーション（cursor + limit）が必須。

違反 9 -- リソースの階層構造が欠落
  メンバーはプロジェクトに従属するリソースだが、/api/addMember は親子関係を表現していない。
  /api/projects/:projectId/members とすべき。

---

## タスク

```
GET /api/tasks/getAll?projectId=xxx
  response: [{ id, title, status, priority, assignee, ... }]
  ※ 全件返却。件数が多くても全部返す

GET /api/getTask?id=xxx
  response: { id, title, description, status, ... }

POST /api/createTask
  body: { projectId, title, description, priority, assigneeId }
  response: { result: "ok", taskId: "xxx" }

POST /api/updateTask
  body: { id, title, description, priority }
  response: { result: "ok" }

POST /api/changeStatus
  body: { taskId, newStatus }
  response: { result: "ok" }
  ※ どのステータスにも遷移可能（バリデーションなし）

POST /api/assignTask
  body: { taskId, userId }
  response: { done: true }

POST /api/deleteTask
  body: { taskId }
  response: { deleted: true }
```

違反 10 -- パス命名規則の不統一
  /api/tasks/getAll と /api/getTask で、動詞の位置が揺れている。
  /api/tasks/getAll は名詞+動詞の混在で、/api/getTask は動詞+名詞。
  統一されたパス設計が存在しない。

違反 11 -- ステータス遷移のバリデーション欠如
  changeStatus は任意のステータスへ遷移できる。
  done から直接 cancelled に飛べてしまい、仕様書のステータス遷移ルールが無視されている。

違反 12 -- 更新後のリソースが返らない
  updateTask の応答は { result: "ok" } だけ。更新後のタスク内容がわからない。
  クライアントは直後にGETを叩いて最新状態を取りに行く必要が出る。
  PATCH /tasks/:id は更新後のリソースを返すのがRESTの慣行。

違反 13 -- フィルタリング・ソート機能がない
  仕様書にはステータス、優先度、担当者、ラベル、期限日、キーワードでの絞り込みが求められている。
  現状はprojectIdだけ。クライアント側で全件フィルタする設計は破綻する。

違反 14 -- レスポンスの成功フラグが4種類
  { result: "ok" }, { done: true }, { deleted: true }, { success: true }。
  HTTPステータスコード200/201/204がその役割を果たすので、独自フラグは不要。

---

## ラベル

```
GET /api/label/list?projectId=xxx
  response: { labels: [{ id, name, color }] }

POST /api/label/create
  body: { projectId, name, color }
  response: { id: "xxx" }

POST /api/label/update
  body: { id, name, color }
  response: { updated: true }

POST /api/label/delete
  body: { id }
  response: { deleted: true }

POST /api/task/addLabel
  body: { taskId, labelId }
  response: { ok: 1 }

POST /api/task/removeLabel
  body: { taskId, labelId }
  response: { ok: 1 }
```

違反 15 -- 単数形/複数形の混乱
  /api/label/list は単数形。一覧を返すなら /api/labels が自然。
  RESTのURLは複数形の名詞で統一する（/projects, /tasks, /labels）。

違反 16 -- レスポンスのラッパー名が不統一
  label の一覧だけ { labels: [...] } とキー名を独自に付けている。
  他のリソースは配列を直接返す。統一エンベロープ { data: [...], meta: {...} } がない。

違反 17 -- 成功フラグの型が文字列と数値で混在
  { ok: true } と { ok: 1 } が同居している。
  JavaScript では truthy 評価で動くが、静的型付けの言語では別の型。

---

## コメント

```
GET /api/getComments?taskId=xxx
  response: [{ id, body, userId, createdAt }]

POST /api/postComment
  body: { taskId, body }
  response: { commentId: "xxx" }

POST /api/editComment
  body: { commentId, body }
  response: { success: 1 }

POST /api/deleteComment
  body: { commentId }
  response: { success: 1 }
```

違反 18 -- コメントがタスクの子リソースとして表現されていない
  /api/getComments?taskId=xxx ではなく、
  /projects/:projectId/tasks/:taskId/comments とすべき。
  リソースの所属関係がURLに現れないと、権限チェックの実装も複雑になる。

---

## 補足

- 認証はヘッダーに token を入れる: `token: xxx`
- エラーのときは `{ error: "なんかエラー" }` を返す（ステータスコードは500）
- 日時の形式は統一してない。created_at のところもあれば createdAt のところもある
- ページネーションは後で対応予定

違反 19 -- エラーハンドリングの設計放棄
  全エラーがステータスコード500で { error: "なんかエラー" }。
  400（バリデーション）、401（未認証）、403（権限不足）、404（存在しない）、409（競合）を使い分けないと、
  クライアントはエラーの原因を判別できない。

違反 20 -- 命名規約の不統一（snake_case と camelCase の混在）
  created_at と createdAt が共存。JSON のフィールド名は camelCase で統一すべき。
  サーバー側のDB列名（snake_case）がそのまま漏れている証拠。

---

## 違反まとめ（20件）

| # | カテゴリ | 内容 |
|---|----------|------|
| 1 | レスポンス設計 | 登録時にトークンを返さない |
| 2 | 認証設計 | トークンリフレッシュ機構がない |
| 3 | 認証設計 | 独自ヘッダー（標準のBearerを使っていない） |
| 4 | URL設計 | パスに動詞が含まれている |
| 5 | メソッド設計 | 更新・削除にもPOSTを使用 |
| 6 | URL設計 | リソースIDの渡し方が不統一 |
| 7 | レスポンス設計 | エンベロープ形式がバラバラ |
| 8 | ページネーション | 一覧系で全件返却 |
| 9 | URL設計 | 親子リソースの階層が未表現 |
| 10 | URL設計 | パス命名規則の不統一 |
| 11 | バリデーション | ステータス遷移ルール無視 |
| 12 | レスポンス設計 | 更新後のリソースが返らない |
| 13 | フィルタリング | 検索・絞り込み機能がない |
| 14 | レスポンス設計 | 成功フラグが4パターン |
| 15 | URL設計 | 単数形/複数形が混在 |
| 16 | レスポンス設計 | ラッパーキー名が不統一 |
| 17 | 型安全 | 成功フラグの型がboolean/numberで混在 |
| 18 | URL設計 | 子リソースが親から独立している |
| 19 | エラー設計 | 全エラーが500、構造未定義 |
| 20 | 命名規約 | snake_case と camelCase の混在 |
