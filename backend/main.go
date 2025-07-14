package main

import (
	"log"

	"bim-system/config"
	"bim-system/database"
	"bim-system/handlers"
	"bim-system/middleware"

	"github.com/labstack/echo/v4"
)

func main() {
	cfg := config.Load()

	db, err := database.New(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := db.CreateTables(); err != nil {
		log.Fatal("Failed to create tables:", err)
	}

	e := echo.New()

	// Middleware
	e.Use(middleware.CORSMiddleware())

	// Handlers
	authHandler := handlers.NewAuthHandler(db, cfg.JWTSecret)
	projectHandler := handlers.NewProjectHandler(db)

	// Auth routes
	e.POST("/auth/register", authHandler.Register)
	e.POST("/auth/login", authHandler.Login)

	// Protected routes
	api := e.Group("/api")
	api.Use(middleware.JWTMiddleware(cfg.JWTSecret))

	// Project routes
	api.POST("/projects", projectHandler.CreateProject)
	api.GET("/projects", projectHandler.GetProjects)
	api.GET("/projects/:id", projectHandler.GetProject)
	api.PUT("/projects/:id", projectHandler.UpdateProject)
	api.DELETE("/projects/:id", projectHandler.DeleteProject)
	api.PATCH("/projects/:id/objects/:objectId", projectHandler.UpdateObjectProperties)

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	log.Printf("Server starting on port %s", cfg.Port)
	log.Fatal(e.Start(":" + cfg.Port))
}