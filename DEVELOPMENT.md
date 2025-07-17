# BIM管理システム - 開発ガイド

## 開発環境の選択

### ホットリロード開発環境（推奨）

**メリット:**
- ファイル変更時の即座な反映
- 開発効率の大幅な向上
- デバッグの容易さ

**ファイル構成:**
- `docker-compose.dev.yml` - 開発用Docker Compose設定
- `backend/Dockerfile.dev` - バックエンド開発用コンテナ
- `frontend/Dockerfile.dev` - フロントエンド開発用コンテナ
- `backend/.air.toml` - Go Hot Reload設定

## セットアップ手順

### 1. 必要なツール

- Docker Desktop
- WSL2 (Windows環境の場合)
- Git

### 2. 環境変数設定

```bash
# .env.example をコピー
cp .env.example .env

# .env ファイルを編集
# 最低限必要な設定:
# - JWT_SECRET=your-secret-key-here
# - VITE_FORGE_CLIENT_ID=your-forge-client-id
# - VITE_FORGE_CLIENT_SECRET=your-forge-client-secret
```

### 3. 開発環境起動

```bash
# 開発用コンテナをビルド
docker-compose -f docker-compose.dev.yml build

# 開発環境を起動
docker-compose -f docker-compose.dev.yml up -d

# ログを確認
docker-compose -f docker-compose.dev.yml logs -f
```

### 4. アクセス確認

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8080
- **データベース**: localhost:5432
- **ヘルスチェック**: http://localhost:8080/health

## ホットリロード機能

### バックエンド (Go + Air)

**設定ファイル**: `backend/.air.toml`

**機能:**
- Go ファイルの変更を検知
- 自動でコンパイルとサーバー再起動
- エラーログの表示

**監視対象:**
- `.go` ファイル
- テンプレートファイル (`.tpl`, `.tmpl`, `.html`)

**除外対象:**
- テストファイル (`*_test.go`)
- `tmp/` ディレクトリ
- `vendor/` ディレクトリ

### フロントエンド (React + Vite HMR)

**設定ファイル**: `frontend/vite.config.ts`

**機能:**
- React コンポーネントの変更を検知
- 状態を保持したまま即座に更新
- TypeScript の型チェック

## 開発ワークフロー

### 1. 日常的な開発

```bash
# 開発環境を起動
docker-compose -f docker-compose.dev.yml up -d

# ログを監視
docker-compose -f docker-compose.dev.yml logs -f

# 開発作業...
# ファイルを編集すると自動的にリロード

# 開発終了時
docker-compose -f docker-compose.dev.yml down
```

### 2. 新しい依存関係の追加

**バックエンド (Go):**
```bash
# コンテナ内で実行
docker-compose -f docker-compose.dev.yml exec backend go get <package>
docker-compose -f docker-compose.dev.yml exec backend go mod tidy

# または、コンテナを再ビルド
docker-compose -f docker-compose.dev.yml build backend
```

**フロントエンド (Node.js):**
```bash
# コンテナ内で実行
docker-compose -f docker-compose.dev.yml exec frontend npm install <package>

# または、コンテナを再ビルド
docker-compose -f docker-compose.dev.yml build frontend
```

### 3. データベースの操作

```bash
# PostgreSQL コンテナに接続
docker-compose -f docker-compose.dev.yml exec postgres psql -U bim_user -d bim_db

# データベースリセット
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. go.sum ファイルが見つからない

**エラー:**
```
COPY go.mod go.sum ./: "/go.sum": not found
```

**解決方法:**
- `backend/Dockerfile.dev` で `go mod tidy` を自動実行
- `GOSUMDB=off` と `GOPROXY=direct` で依存関係の問題を回避

#### 2. ポートが使用中

**エラー:**
```
Error starting userland proxy: listen tcp 0.0.0.0:3000: bind: address already in use
```

**解決方法:**
```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :8080

# プロセスを終了
kill -9 <PID>

# または、異なるポートを使用
# docker-compose.dev.yml のポート設定を変更
```

#### 3. Docker Desktop の WSL2 統合

**設定確認:**
1. Docker Desktop > Settings > General > "Use WSL 2 based engine" を有効化
2. Docker Desktop > Settings > Resources > WSL Integration でディストリビューションを選択

#### 4. Air がファイル変更を検知しない

**解決方法:**
```bash
# .air.toml の設定を確認
# poll = true に変更（WSL2環境で有効）

# または、手動でコンテナを再起動
docker-compose -f docker-compose.dev.yml restart backend
```

## パフォーマンス最適化

### 1. ビルド時間の短縮

- Docker レイヤーキャッシュの活用
- 不要なファイルの除外 (`.dockerignore`)
- 依存関係の事前ダウンロード

### 2. 開発体験の向上

- 適切なログレベル設定
- エラーハンドリングの改善
- デバッグツールの活用

## 本番環境への移行

開発完了後は以下のコマンドで本番環境をテスト:

```bash
# 本番環境をビルド
docker-compose build

# 本番環境で起動
docker-compose up -d

# 動作確認
curl http://localhost:8080/health
```

## 新機能の開発

### 3Dモデル作成機能の拡張

現在実装されている3Dモデル作成機能の拡張方法:

1. **新しいモデルタイプの追加**
   - `FileCreator.tsx` の `modelTypes` 配列に新しいタイプを追加
   - 対応する3D形状生成関数を実装
   - OBJファイル生成関数も追加

2. **新しい材質の追加**
   - `materialColors` オブジェクトに新しい材質を追加
   - MTLファイル生成で材質固有のプロパティを設定

### デバッグとテスト

```bash
# 3Dモデル作成のテスト
# 1. モデル作成UIで各パラメータを調整
# 2. プレビューで形状を確認
# 3. ファイル作成後、プロジェクトに反映されることを確認

# APIエンドポイントのテスト
curl -X POST http://localhost:8080/api/forge/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test_model.obj"
```

## 関連ドキュメント

- [README.md](./README.md) - 基本的な使用方法
- [API.md](./API.md) - バックエンドAPIの詳細
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - トラブルシューティング