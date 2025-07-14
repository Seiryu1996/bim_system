package handlers

import (
	"net/http"
	"time"

	"bim-system/database"
	"bim-system/middleware"
	"bim-system/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB        *database.DB
	JWTSecret string
}

func NewAuthHandler(db *database.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		DB:        db,
		JWTSecret: jwtSecret,
	}
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req models.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なリクエストボディです")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "パスワードのハッシュ化に失敗しました")
	}

	var userID int
	err = h.DB.QueryRow(
		"INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id",
		req.Username, req.Email, string(hashedPassword),
	).Scan(&userID)

	if err != nil {
		return echo.NewHTTPError(http.StatusConflict, "ユーザーが既に存在します")
	}

	token, err := h.generateToken(userID, req.Username)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "トークンの生成に失敗しました")
	}

	user := models.User{
		ID:       userID,
		Username: req.Username,
		Email:    req.Email,
	}

	return c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なリクエストボディです")
	}

	var user models.User
	err := h.DB.QueryRow(
		"SELECT id, username, email, password FROM users WHERE username = $1",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Password)

	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "無効な認証情報です")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "無効な認証情報です")
	}

	token, err := h.generateToken(user.ID, user.Username)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "トークンの生成に失敗しました")
	}

	user.Password = ""

	return c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func (h *AuthHandler) generateToken(userID int, username string) (string, error) {
	claims := &middleware.JWTClaims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.JWTSecret))
}