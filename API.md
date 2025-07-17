# API仕様書

## 概要

BIM管理システムのRESTful API仕様書です。このAPIは、JWT認証を使用したBIMプロジェクトの管理、3Dモデルのアップロード、Autodesk Forge統合などの機能を提供します。

## 認証

### JWT認証
- すべてのAPIエンドポイント（`/auth/*`と`/health`を除く）はJWT認証が必要
- Authorizationヘッダーに`Bearer <token>`形式でトークンを送信

### 認証フロー
1. ユーザー登録またはログイン
2. JWTトークンを取得
3. 以降のAPIリクエストにトークンを含める

## エンドポイント

### 認証 (Auth)

#### POST /auth/register
ユーザー登録

**リクエスト**
```json
{
  "name": "田中太郎",
  "email": "taro@example.com",
  "password": "password123"
}
```

**レスポンス**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "name": "田中太郎",
    "email": "taro@example.com"
  }
}
```

#### POST /auth/login
ユーザーログイン

**リクエスト**
```json
{
  "email": "taro@example.com",
  "password": "password123"
}
```

**レスポンス**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "田中太郎",
    "email": "taro@example.com"
  }
}
```

### プロジェクト (Projects)

#### GET /api/projects
プロジェクト一覧取得

**レスポンス**
```json
{
  "projects": [
    {
      "id": 1,
      "name": "オフィスビル建設プロジェクト",
      "description": "東京都内のオフィスビル建設",
      "file_id": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6...",
      "user_id": 1,
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### POST /api/projects
新規プロジェクト作成

**リクエスト**
```json
{
  "name": "新規プロジェクト",
  "description": "プロジェクトの説明",
  "file_id": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6..."
}
```

**レスポンス**
```json
{
  "message": "Project created successfully",
  "project": {
    "id": 2,
    "name": "新規プロジェクト",
    "description": "プロジェクトの説明",
    "file_id": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6...",
    "user_id": 1,
    "created_at": "2024-01-02T10:00:00Z",
    "updated_at": "2024-01-02T10:00:00Z"
  }
}
```

#### GET /api/projects/:id
プロジェクト詳細取得

**レスポンス**
```json
{
  "project": {
    "id": 1,
    "name": "オフィスビル建設プロジェクト",
    "description": "東京都内のオフィスビル建設",
    "file_id": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6...",
    "user_id": 1,
    "created_at": "2024-01-01T10:00:00Z",
    "updated_at": "2024-01-01T10:00:00Z"
  }
}
```

#### PUT /api/projects/:id
プロジェクト更新

**リクエスト**
```json
{
  "name": "更新されたプロジェクト名",
  "description": "更新された説明",
  "file_id": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6..."
}
```

#### DELETE /api/projects/:id
プロジェクト削除

**レスポンス**
```json
{
  "message": "Project deleted successfully"
}
```

#### PATCH /api/projects/:id/objects/:objectId
オブジェクトプロパティ更新

**リクエスト**
```json
{
  "properties": {
    "Material": "コンクリート",
    "Color": "#888888",
    "Dimensions": "10x3x8"
  }
}
```

### ファイル管理 (File Management)

#### POST /api/forge/upload
ファイルアップロード（OBJ/MTLファイル対応）

**リクエスト**
- Content-Type: multipart/form-data
- フィールド: `file` (ファイル)

**レスポンス**
```json
{
  "message": "File uploaded successfully",
  "urn": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6...",
  "objectKey": "building_10x3x8_1234567890.obj",
  "status": "development"
}
```

#### GET /api/files/:objectKey
ローカルファイル取得（開発モード）

**レスポンス**
- Content-Type: application/octet-stream
- ファイルバイナリデータ

### Forge統合 (Forge Integration)

#### POST /api/forge/token
Forge認証トークン取得

**レスポンス**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IlU3c0dGRldUTzlBekNhSzBqTURUcEREOEJmd1hOQ0VHTURkTWVDZEM4ZFEiLCJ0eXAiOiJKV1QifQ...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### ヘルスチェック (Health Check)

#### GET /health
ヘルスチェックエンドポイント

**レスポンス**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00Z",
  "version": "1.0.0"
}
```

## エラーレスポンス

### 認証エラー (401 Unauthorized)
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing JWT token"
}
```

### 権限エラー (403 Forbidden)
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

### リソース未発見 (404 Not Found)
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### バリデーションエラー (400 Bad Request)
```json
{
  "error": "Validation Error",
  "message": "Invalid input data",
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

### サーバーエラー (500 Internal Server Error)
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## レート制限

- 現在、レート制限は実装されていません
- 将来的に実装予定

## 認証情報

### JWT トークン
- 有効期限: 24時間
- 署名アルゴリズム: HS256
- 秘密鍵: 環境変数 `JWT_SECRET` で設定

### Forge認証
- 本番環境でのみ使用
- 開発環境では `FORGE_ENABLED=false` で無効化可能

## 開発環境特有の機能

### ローカルファイル提供
- 開発環境では `/api/files/:objectKey` エンドポイントで直接ファイルを提供
- Three.js による3D表示をサポート

### 環境変数による機能切り替え
- `FORGE_ENABLED=false` で Forge機能を無効化
- 開発時は Three.js、本番時は Forge Viewer を使用

## 使用例

### プロジェクト作成のフロー
1. ユーザー登録/ログイン
2. JWTトークンを取得
3. 3Dモデルファイルをアップロード
4. アップロードされたファイルのURNを使用してプロジェクト作成

### 3Dモデル表示のフロー
1. プロジェクト一覧から表示したいプロジェクトを選択
2. プロジェクトの `file_id` を使用して3Dモデルを表示
3. 開発環境では Three.js、本番環境では Forge Viewer を使用

## セキュリティ

### CORS設定
- 開発環境: `localhost:3000` からのリクエストを許可
- 本番環境: 適切なオリジンを設定

### 入力サニタイゼーション
- SQLインジェクション防止
- XSS攻撃防止
- ファイルアップロード時のバリデーション

## パフォーマンス

### キャッシュ
- 静的ファイルに対するキャッシュ設定
- Forge トークンのキャッシュ

### 最適化
- データベースクエリの最適化
- 適切なインデックス設定
- ファイルアップロード時の圧縮