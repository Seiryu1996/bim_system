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
  - Autodesk Forge Viewer統合
  - 3Dモデル表示
  - インタラクティブなオブジェクト選択
  - リアルタイムプロパティ編集
  - Redux Toolkit状態管理
  - Tailwind CSSによるレスポンシブデザイン

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

### フロントエンド
- `VITE_API_URL`: バックエンドAPI URL (デフォルト: http://localhost:8080)
- `VITE_FORGE_CLIENT_ID`: Autodesk Forge クライアントID
- `VITE_FORGE_CLIENT_SECRET`: Autodesk Forge クライアントシークレット

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

### ヘルスチェック
- `GET /health` - ヘルスチェックエンドポイント

## 開発

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
```bash
# 標準のDockerfileを使用
docker-compose build

# チェックサムエラーが発生する場合、シンプルなDockerfileを使用
docker-compose -f docker-compose.yml build

# コンテナを起動
docker-compose up -d
```

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
│   ├── Dockerfile       # バックエンドコンテナ
│   ├── go.mod           # Goモジュール
│   └── main.go          # アプリケーションエントリーポイント
├── frontend/
│   ├── src/
│   │   ├── components/  # Reactコンポーネント
│   │   ├── services/    # APIサービス
│   │   ├── store/       # Reduxストアとスライス
│   │   ├── types/       # TypeScript型定義
│   │   └── utils/       # ユーティリティ関数
│   ├── public/          # 静的アセット
│   ├── Dockerfile       # フロントエンドコンテナ
│   ├── package.json     # Node.js依存関係
│   └── vite.config.ts   # Vite設定
├── docker-compose.yml   # 開発環境
├── render.yaml          # Renderデプロイ設定
└── README.md           # このファイル
```