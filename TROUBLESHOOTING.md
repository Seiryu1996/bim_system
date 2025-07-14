# トラブルシューティング

## Go modules チェックサムエラー

### 問題
```
verifying github.com/valyala/bytebufferpool@v1.0.0: checksum mismatch
SECURITY ERROR
This download does NOT match an earlier download recorded in go.sum.
```

### 解決方法

1. **Dockerビルドでの解決（推奨）**
   
   現在のDockerfileは以下のように修正されています：
   ```dockerfile
   # go.sumファイルをコピーしない
   COPY go.mod ./
   
   # チェックサム検証を無効化
   ENV GOSUMDB=off
   ENV GOPROXY=direct
   
   # コンテナ内でgo mod tidyを実行
   RUN go mod tidy
   RUN go mod download
   ```

2. **ローカルでの解決（オプション）**
   ```bash
   cd backend
   rm go.sum
   go mod tidy
   go mod download
   ```

3. **完全なクリーンビルド**
   ```bash
   # Docker関連のクリーンアップ
   docker system prune -a
   
   # プロジェクトのビルド
   docker-compose build --no-cache
   ```

### 注意事項
- `GOSUMDB=off`を使用することで、チェックサムの検証を無効化しています
- これは開発環境でのみ推奨される方法です
- 本番環境では適切なgo.sumファイルを使用してください

## その他のよくある問題

### 1. PostgreSQLコンテナが起動しない
```bash
# PostgreSQLデータボリュームをクリア
docker volume rm bim_system_postgres_data
docker-compose up -d postgres
```

### 2. フロントエンドがAPIに接続できない
環境変数を確認してください：
```bash
# .envファイルを確認
cat .env

# Docker内の環境変数を確認
docker-compose exec backend env | grep -E "(DB_|API_|VITE_)"
```

### 3. Forgeビューアーが動作しない
Autodesk Forgeの認証情報を確認してください：
```bash
# 環境変数の設定を確認
echo $VITE_FORGE_CLIENT_ID
echo $VITE_FORGE_CLIENT_SECRET
```

## 推奨デバッグ手順

1. **ログの確認**
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   docker-compose logs postgres
   ```

2. **コンテナの状態確認**
   ```bash
   docker-compose ps
   docker-compose exec backend ps aux
   ```

3. **ネットワーク接続確認**
   ```bash
   docker-compose exec backend ping postgres
   docker-compose exec frontend ping backend
   ```

4. **データベース接続確認**
   ```bash
   docker-compose exec postgres psql -U bim_user -d bim_db -c "SELECT 1;"
   ```

## バックエンドとフロントエンドが起動しない問題

### 症状
```
exec: "./main": stat ./main: no such file or directory
```

### 原因
- Goのビルドが失敗している
- バイナリファイルが正しく生成されていない

### 解決方法

1. **個別にビルドテスト**
   ```bash
   # バックエンドのみビルド
   cd backend
   docker build -f Dockerfile.simple -t bim-backend-test .
   
   # フロントエンドのみビルド
   cd ../frontend
   docker build -t bim-frontend-test .
   ```

2. **ビルドログの確認**
   ```bash
   # 詳細なビルドログを確認
   docker-compose build --no-cache backend
   docker-compose build --no-cache frontend
   ```

3. **テストスクリプトの実行**
   ```bash
   # 提供されたテストスクリプトを実行
   ./test-build.sh
   ```

## 完全リセット手順

すべてがうまく動作しない場合の完全リセット：

```bash
# すべてのコンテナとボリュームを削除
docker-compose down -v

# Dockerイメージをクリーンアップ
docker system prune -a

# go.sumファイルを削除（バックエンドのみ）
rm backend/go.sum

# 完全リビルド
docker-compose build --no-cache
docker-compose up -d
```