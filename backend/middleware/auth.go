package middleware

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type JWTClaims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func JWTMiddleware(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "認証ヘッダーが見つかりません")
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				return echo.NewHTTPError(http.StatusUnauthorized, "無効な認証ヘッダー形式です")
			}

			token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})

			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "無効なトークンです")
			}

			if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
				c.Set("user_id", claims.UserID)
				c.Set("username", claims.Username)
				return next(c)
			}

			return echo.NewHTTPError(http.StatusUnauthorized, "無効なトークンクレームです")
		}
	}
}

func CORSMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("Access-Control-Allow-Origin", "*")
			c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
			c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if c.Request().Method == "OPTIONS" {
				return c.NoContent(http.StatusOK)
			}

			return next(c)
		}
	}
}