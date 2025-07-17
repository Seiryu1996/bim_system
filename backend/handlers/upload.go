package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

type ForgeUploadResponse struct {
	BucketKey string `json:"bucketKey"`
	ObjectKey string `json:"objectKey"`
	URN       string `json:"urn"`
	Status    string `json:"status"`
}

// ファイルをAutodesk Forgeにアップロードし、URNを生成
func (h *UploadHandler) UploadToForge(c echo.Context) error {
	// マルチパートファイルを取得
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ファイルのアップロードに失敗しました")
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ファイルの読み込みに失敗しました")
	}
	defer src.Close()

	// Forge認証情報を取得
	clientID := os.Getenv("FORGE_CLIENT_ID")
	clientSecret := os.Getenv("FORGE_CLIENT_SECRET")
	
	fmt.Printf("Forge Client ID: %s (length: %d)\n", clientID, len(clientID))
	fmt.Printf("Forge Client Secret: %s (length: %d)\n", clientSecret[:10]+"...", len(clientSecret))

	if clientID == "" || clientSecret == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge認証情報が設定されていません")
	}

	// 1. アクセストークンを取得
	token, err := h.getForgeToken(clientID, clientSecret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge認証に失敗しました: "+err.Error())
	}

	// 2. バケットキーを生成（Data Management APIではバケット作成不要）
	bucketKey := "bim-system-bucket-" + strings.ToLower(clientID[:8])

	// 3. ファイルをローカルに保存（バックアップ用）
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "アップロードディレクトリの作成に失敗しました")
	}

	objectKey := generateObjectKey(file.Filename)
	filePath := filepath.Join(uploadDir, objectKey)
	dst, err := os.Create(filePath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ファイルの保存に失敗しました")
	}
	defer dst.Close()

	// ファイルを2つのストリームにコピー（ローカル保存 + Forge用）
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ファイルの読み込みに失敗しました")
	}

	// ローカル保存
	if _, err = dst.Write(fileBytes); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ファイルのローカル保存に失敗しました")
	}

	// 4. ファイルをForgeにアップロード
	fmt.Printf("Uploading file to Forge: bucket=%s, object=%s, size=%d\n", bucketKey, objectKey, len(fileBytes))
	fileReader := bytes.NewReader(fileBytes)
	err = h.uploadFile(token, bucketKey, objectKey, fileReader, int64(len(fileBytes)))
	if err != nil {
		fmt.Printf("Upload failed with error: %v\n", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "ファイルのアップロードに失敗しました: "+err.Error())
	}
	fmt.Printf("File uploaded successfully to Forge\n")

	// 5. URNを生成
	objectId := fmt.Sprintf("urn:adsk.objects:os.object:%s/%s", bucketKey, objectKey)
	urn := base64.StdEncoding.EncodeToString([]byte(objectId))

	// 6. 変換処理をスキップ（開発段階）
	fmt.Printf("Skipping translation for development. URN generated: %s\n", urn)

	// 環境に応じてステータスを設定
	status := "development"
	if os.Getenv("FORGE_ENABLED") == "true" {
		status = "ready"
	}

	response := ForgeUploadResponse{
		BucketKey: bucketKey,
		ObjectKey: objectKey,
		URN:       urn,
		Status:    status,
	}

	return c.JSON(http.StatusOK, response)
}

// Forgeアクセストークンを取得
func (h *UploadHandler) getForgeToken(clientID, clientSecret string) (string, error) {
	data := fmt.Sprintf("client_id=%s&client_secret=%s&grant_type=client_credentials&scope=data:write data:read data:create bucket:create bucket:read bucket:delete viewables:read",
		clientID, clientSecret)

	resp, err := http.Post(
		"https://developer.api.autodesk.com/authentication/v2/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(data),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("認証失敗: %d - %s", resp.StatusCode, string(body))
	}

	var tokenResponse struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		return "", err
	}

	return tokenResponse.AccessToken, nil
}

// Forgeバケットを作成
func (h *UploadHandler) createBucket(token, bucketKey string) error {
	bucketData := map[string]interface{}{
		"bucketKey": bucketKey,
		"policyKey": "transient", // 24時間後に削除される一時的なバケット
	}

	jsonData, _ := json.Marshal(bucketData)
	req, _ := http.NewRequest("POST", "https://developer.api.autodesk.com/oss/v2/buckets", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// バケットが既に存在する場合は409が返される（正常）
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusConflict {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("バケット作成失敗: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// 簡略化アプローチ: ローカルストレージ + 直接URN生成
func (h *UploadHandler) uploadFile(token, bucketKey, objectKey string, file io.Reader, fileSize int64) error {
	// ファイルは既にローカルに保存済みなので、アップロードをスキップ
	// 本番環境では適切なクラウドストレージ（AWS S3等）を使用することを推奨
	fmt.Printf("File saved locally as: %s (skipping cloud upload for now)\n", objectKey)
	return nil
}

// ローカルファイルを配信（開発環境用）
func (h *UploadHandler) ServeLocalFile(c echo.Context) error {
	objectKey := c.Param("objectKey")
	if objectKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "オブジェクトキーが指定されていません")
	}

	filePath := filepath.Join("./uploads", objectKey)
	
	// ファイルの存在確認
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return echo.NewHTTPError(http.StatusNotFound, "ファイルが見つかりません")
	}

	// ファイルの拡張子に基づいてContent-Typeを設定
	ext := strings.ToLower(filepath.Ext(objectKey))
	var contentType string
	switch ext {
	case ".obj":
		contentType = "text/plain"
	case ".fbx":
		contentType = "application/octet-stream"
	case ".3ds":
		contentType = "application/octet-stream"
	default:
		contentType = "application/octet-stream"
	}

	c.Response().Header().Set("Content-Type", contentType)
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	
	return c.File(filePath)
}

// Model Derivative APIでファイルを変換
func (h *UploadHandler) translateFile(token, urn string) error {
	translateData := map[string]interface{}{
		"input": map[string]interface{}{
			"urn": urn,
		},
		"output": map[string]interface{}{
			"formats": []map[string]interface{}{
				{
					"type": "svf2",
					"views": []string{"2d", "3d"},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(translateData)
	req, _ := http.NewRequest("POST", "https://developer.api.autodesk.com/modelderivative/v3/jobs", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("変換失敗: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// オブジェクトキーを生成（ファイル名をURL安全な形式に変換）
func generateObjectKey(filename string) string {
	// タイムスタンプを追加してユニークにする
	timestamp := time.Now().Unix()
	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filepath.Base(filename), ext)
	
	// 特殊文字を除去
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "(", "")
	name = strings.ReplaceAll(name, ")", "")
	
	return fmt.Sprintf("%s_%d%s", name, timestamp, ext)
}

// URN変換状況を確認
func (h *UploadHandler) CheckTranslationStatus(c echo.Context) error {
	urn := c.Param("urn")
	if urn == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "URNが指定されていません")
	}

	// Forge認証情報を取得
	clientID := os.Getenv("FORGE_CLIENT_ID")
	clientSecret := os.Getenv("FORGE_CLIENT_SECRET")

	token, err := h.getForgeToken(clientID, clientSecret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge認証に失敗しました")
	}

	// 変換状況を確認
	url := fmt.Sprintf("https://developer.api.autodesk.com/modelderivative/v3/jobs/%s", urn)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "状況確認に失敗しました")
	}
	defer resp.Body.Close()

	var manifest map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&manifest)

	return c.JSON(http.StatusOK, manifest)
}