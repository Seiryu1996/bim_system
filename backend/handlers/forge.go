package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
)

type ForgeHandler struct{}

func NewForgeHandler() *ForgeHandler {
	return &ForgeHandler{}
}

type ForgeTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type ForgeTokenRequest struct {
	Scope string `json:"scope"`
}

func (h *ForgeHandler) GetForgeToken(c echo.Context) error {
	var req ForgeTokenRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なリクエストです")
	}

	// スコープが指定されていない場合はデフォルトを使用
	if req.Scope == "" {
		req.Scope = "viewables:read"
	}

	// 環境変数からForgeクライアント情報を取得
	clientID := os.Getenv("FORGE_CLIENT_ID")
	clientSecret := os.Getenv("FORGE_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge認証情報が設定されていません")
	}

	// Forge APIに認証リクエストを送信
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("grant_type", "client_credentials")
	data.Set("scope", req.Scope)

	// データ送信の準備完了

	resp, err := http.Post(
		"https://developer.api.autodesk.com/authentication/v2/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(data.Encode()),
	)
	if err != nil {
		fmt.Printf("ERROR: Forge APIへの接続エラー: %v\n", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge APIへの接続に失敗しました")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// レスポンスボディを読み取ってエラー内容を確認
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("ERROR: Forge API認証失敗 - ステータス: %d, レスポンス: %s\n", resp.StatusCode, string(body))
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Forge API認証に失敗しました: %d", resp.StatusCode))
	}

	var tokenResponse ForgeTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Forge APIレスポンスの解析に失敗しました")
	}

	// アクセストークンのみを返す（セキュリティ上の理由）
	return c.JSON(http.StatusOK, map[string]string{
		"access_token": tokenResponse.AccessToken,
	})
}