# BIM管理システム

Go言語バックエンド、Reactフロントエンド、PostgreSQLデータベースで構築された総合的なBIM（Building Information Modeling）プロジェクト管理システムです。Autodesk Forge Viewerによる3Dモデル表示、JWT認証、リアルタイムオブジェクトプロパティ編集などの機能を提供します。

## 機能

- **バックエンド (Go + Echo)**
  - JWT認証付きRESTful API
  - PostgreSQLデータベース統合
  - プロジェクトCRUD操作
  - オブジェクトプロパティ管理
  - Dockerコンテナ化

- **フロントエンド (React + Vite)**
  - **3Dモデル表示機能**
    - Autodesk Forge Viewer統合（本番環境）
    - Three.js による開発環境での3D表示
    - 環境変数による表示モード切り替え
  - **3Dモデル作成機能**
    - インタラクティブなモデル作成UI
    - 建物・部屋・家具の3種類のモデルタイプ
    - 寸法・材質・色のカスタマイズ
    - OBJ/MTLファイル生成とアップロード
  - **3D表示機能**
    - インタラクティブなオブジェクト選択
    - リアルタイムプロパティ編集
    - ズーム機能（ボタン・マウスホイール対応）
    - 材質と色の正確な反映
    - 3Dプレビュー機能
  - **UI/UX**
    - Redux Toolkit状態管理
    - Tailwind CSSによるレスポンシブデザイン
    - 統一されたエラーメッセージ

- **インフラストラクチャ**
  - ローカル開発用Docker Compose
  - Renderデプロイ設定
  - 環境変数管理
  - ヘルスチェックエンドポイント

## 必要な環境

- Docker および Docker Compose
- Node.js 18+ (ローカル開発用)
- Go 1.21+ (ローカル開発用)
- Autodesk Forge認証情報 (クライアントIDとシークレット)

## クイックスタート

### 開発環境（ホットリロード）- 推奨

1. **リポジトリをクローン**
   ```bash
   git clone <repository-url>
   cd bim_system
   ```

2. **環境変数を設定**
   ```bash
   cp .env.example .env
   # .envファイルを編集して設定を記入
   ```

3. **開発環境をビルド・起動**
   ```bash
   # ホットリロード環境でビルド
   docker-compose -f docker-compose.dev.yml build
   
   # 起動
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **アプリケーションにアクセス**
   - フロントエンド: http://localhost:3000
   - バックエンドAPI: http://localhost:8080
   - データベース: localhost:5432

### 本番環境

1. **リポジトリをクローン**
   ```bash
   git clone <repository-url>
   cd bim_system
   ```

2. **環境変数を設定**
   ```bash
   cp .env.example .env
   # .envファイルを編集して設定を記入
   ```

3. **Docker Composeで起動**
   ```bash
   docker-compose up -d
   ```

4. **アプリケーションにアクセス**
   - フロントエンド: http://localhost:3000
   - バックエンドAPI: http://localhost:8080
   - データベース: localhost:5432

## 環境変数

### バックエンド
- `DB_HOST`: データベースホスト (デフォルト: localhost)
- `DB_PORT`: データベースポート (デフォルト: 5432)
- `DB_NAME`: データベース名 (デフォルト: bim_db)
- `DB_USER`: データベースユーザー (デフォルト: bim_user)
- `DB_PASSWORD`: データベースパスワード (デフォルト: password)
- `JWT_SECRET`: JWT署名秘密鍵
- `PORT`: サーバーポート (デフォルト: 8080)
- `FORGE_CLIENT_ID`: Autodesk Forge クライアントID
- `FORGE_CLIENT_SECRET`: Autodesk Forge クライアントシークレット
- `FORGE_ENABLED`: Forge機能の有効化 (本番: true, 開発: false)

### フロントエンド
- `VITE_API_URL`: バックエンドAPI URL (デフォルト: http://localhost:8080)
- `VITE_FORGE_CLIENT_ID`: Forge クライアントID（フロントエンド用）
- `VITE_FORGE_CLIENT_SECRET`: Forge クライアントシークレット（フロントエンド用）
- `VITE_FORGE_ENABLED`: Forge機能の有効化 (本番: true, 開発: false)

## Forge App設定

### 本番環境でのForge使用（オプション）

1. [Autodesk Forge Console](https://forge.autodesk.com/)でアプリケーションを作成
2. 以下のAPIを有効化:
   - Model Derivative API
   - Data Management API
3. Client IDとClient Secretを`.env`ファイルに設定
4. 環境変数を本番用に設定:
   ```bash
   FORGE_ENABLED=true
   VITE_FORGE_ENABLED=true
   ```

### 開発環境での使用（推奨）

開発環境ではForge不要で、Three.jsによる3D表示が利用できます:
```bash
FORGE_ENABLED=false
VITE_FORGE_ENABLED=false
```

## APIエンドポイント

### 認証
- `POST /auth/register` - ユーザー登録
- `POST /auth/login` - ユーザーログイン

### プロジェクト (認証必須)
- `GET /api/projects` - 全プロジェクト一覧
- `POST /api/projects` - 新規プロジェクト作成
- `GET /api/projects/:id` - プロジェクト詳細取得
- `PUT /api/projects/:id` - プロジェクト更新
- `DELETE /api/projects/:id` - プロジェクト削除
- `PATCH /api/projects/:id/objects/:objectId` - オブジェクトプロパティ更新

### ファイル管理 (認証必須)
- `POST /api/forge/upload` - ファイルアップロード（OBJ/MTLファイル対応）
- `GET /api/files/:objectKey` - ローカルファイル取得（開発モード）

### Forge統合 (認証必須)
- `POST /api/forge/token` - Forge認証トークン取得
- `POST /api/forge/upload` - Forgeファイルアップロード

### ヘルスチェック
- `GET /health` - ヘルスチェックエンドポイント

## 開発

### 開発環境の種類

#### 1. ホットリロード開発環境（推奨）
- **ファイル変更時の自動リロード**
  - バックエンド: Air toolによるGo自動リスタート
  - フロントエンド: Vite HMRによるReact自動更新
- **Docker Compose設定**: `docker-compose.dev.yml`
- **ボリュームマウント**: ソースコードの変更が即座に反映

#### 2. 本番環境
- **最適化されたビルド**: 軽量なコンテナ
- **Docker Compose設定**: `docker-compose.yml`
- **単一バイナリ**: 最小限のリソース使用

### バックエンド開発
```bash
cd backend
go mod tidy
go run main.go
```

### フロントエンド開発
```bash
cd frontend
npm install
npm run dev
```

### Docker開発

#### 本番環境
```bash
# コンテナをビルド
docker-compose build

# システムを起動
docker-compose up -d

# ログを確認
docker-compose logs -f

# 停止
docker-compose down
```

#### ホットリロード開発環境（推奨）
```bash
# 開発環境をビルド
docker-compose -f docker-compose.dev.yml build

# ホットリロードで起動
docker-compose -f docker-compose.dev.yml up -d

# ログを確認
docker-compose -f docker-compose.dev.yml logs -f

# 停止
docker-compose -f docker-compose.dev.yml down
```

**ホットリロード機能:**
- **バックエンド**: Goファイルを変更すると自動でサーバーが再起動
- **フロントエンド**: React/TypeScriptファイルを変更すると即座にブラウザに反映
- **開発効率**: コードの変更が即座に確認できるため開発速度が向上

**トラブルシューティング:**
- go.sumファイルが見つからない場合: `go mod tidy`を自動実行
- 依存関係エラー: `GOSUMDB=off`と`GOPROXY=direct`を設定済み

## デプロイ

### Renderデプロイ

1. **Renderでサービスを作成**
   - バックエンド: DockerによるWebサービス
   - フロントエンド: DockerによるWebサービス
   - データベース: PostgreSQLサービス

2. **環境変数を設定**
   - Renderダッシュボードで環境変数を設定
   - 提供された`render.yaml`を使用してInfrastructure as Codeを実現

3. **デプロイ**
   ```bash
   # GitHubにプッシュしてRenderに接続
   git push origin main
   ```

## プロジェクト構造

```
bim_system/
├── backend/
│   ├── config/          # 設定管理
│   ├── database/        # データベース接続とマイグレーション
│   ├── handlers/        # HTTPハンドラー
│   ├── middleware/      # 認証およびCORSミドルウェア
│   ├── models/          # データモデル
│   ├── migrations/      # データベースマイグレーション
│   ├── uploads/         # アップロードされたファイル（OBJ/MTL）
│   ├── tmp/             # Air一時ファイル
│   ├── .air.toml        # Air設定（ホットリロード）
│   ├── Dockerfile       # 本番用コンテナ
│   ├── Dockerfile.dev   # 開発用コンテナ（ホットリロード）
│   ├── Dockerfile.simple # 簡易ビルド用
│   ├── go.mod           # Goモジュール
│   └── main.go          # アプリケーションエントリーポイント
├── frontend/
│   ├── src/
│   │   ├── components/  # Reactコンポーネント
│   │   │   ├── FileCreator.tsx    # 3Dモデル作成機能
│   │   │   ├── ForgeViewer.tsx    # 3Dモデル表示機能
│   │   │   ├── ProjectList.tsx    # プロジェクト一覧
│   │   │   └── ...
│   │   ├── services/    # APIサービス
│   │   ├── store/       # Reduxストアとスライス
│   │   ├── types/       # TypeScript型定義
│   │   └── utils/       # ユーティリティ関数
│   ├── public/          # 静的アセット
│   ├── Dockerfile       # 本番用コンテナ
│   ├── Dockerfile.dev   # 開発用コンテナ（ホットリロード）
│   ├── package.json     # Node.js依存関係
│   └── vite.config.ts   # Vite設定
├── docker-compose.yml   # 本番環境
├── docker-compose.dev.yml # 開発環境（ホットリロード）
├── render.yaml          # Renderデプロイ設定
├── README.md           # このファイル
├── DEVELOPMENT.md      # 開発ガイド
└── TROUBLESHOOTING.md  # トラブルシューティング
```