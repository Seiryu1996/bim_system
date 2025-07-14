package config

import (
	"os"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	JWTSecret  string
	Port       string
}

func Load() *Config {
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBName:     getEnv("DB_NAME", "bim_db"),
		DBUser:     getEnv("DB_USER", "bim_user"),
		DBPassword: getEnv("DB_PASSWORD", "password"),
		JWTSecret:  getEnv("JWT_SECRET", "default-secret"),
		Port:       getEnv("PORT", "8080"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}