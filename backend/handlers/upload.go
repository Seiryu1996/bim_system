package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
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

	if clientID == "" || clientSecret == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge認証情報が設定されていません")
	}

	// 1. アクセストークンを取得
	token, err := h.getForgeToken(clientID, clientSecret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge認証に失敗しました: "+err.Error())
	}

	// 2. バケットを作成または確認
	bucketKey := "bim-system-bucket-" + strings.ToLower(clientID[:8])
	err = h.createBucket(token, bucketKey)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "バケットの作成に失敗しました: "+err.Error())
	}

	// 3. ファイルをアップロード
	objectKey := generateObjectKey(file.Filename)
	err = h.uploadFile(token, bucketKey, objectKey, src, file.Size)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ファイルのアップロードに失敗しました: "+err.Error())
	}

	// 4. URNを生成
	objectId := fmt.Sprintf("urn:adsk.objects:os.object:%s/%s", bucketKey, objectKey)
	urn := base64.StdEncoding.EncodeToString([]byte(objectId))

	// 5. Model Derivative APIでファイルを変換
	err = h.translateFile(token, urn)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ファイルの変換に失敗しました: "+err.Error())
	}

	response := ForgeUploadResponse{
		BucketKey: bucketKey,
		ObjectKey: objectKey,
		URN:       urn,
		Status:    "translating",
	}

	return c.JSON(http.StatusOK, response)
}

// Forgeアクセストークンを取得
func (h *UploadHandler) getForgeToken(clientID, clientSecret string) (string, error) {
	data := fmt.Sprintf("client_id=%s&client_secret=%s&grant_type=client_credentials&scope=data:write data:read bucket:create bucket:read",
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
		return "", fmt.Errorf("認証失敗: %d", resp.StatusCode)
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
		return fmt.Errorf("バケット作成失敗: %d", resp.StatusCode)
	}

	return nil
}

// ファイルをForgeにアップロード
func (h *UploadHandler) uploadFile(token, bucketKey, objectKey string, file multipart.File, fileSize int64) error {
	url := fmt.Sprintf("https://developer.api.autodesk.com/oss/v2/buckets/%s/objects/%s", bucketKey, objectKey)

	req, _ := http.NewRequest("PUT", url, file)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/octet-stream")
	req.ContentLength = fileSize

	client := &http.Client{Timeout: 30 * time.Minute} // 大きなファイル用にタイムアウトを延長
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ファイルアップロード失敗: %d", resp.StatusCode)
	}

	return nil
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
	req, _ := http.NewRequest("POST", "https://developer.api.autodesk.com/modelderivative/v2/designdata/job", bytes.NewBuffer(jsonData))
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
	url := fmt.Sprintf("https://developer.api.autodesk.com/modelderivative/v2/designdata/%s/manifest", urn)
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