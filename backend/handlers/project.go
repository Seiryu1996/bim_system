package handlers

import (
	"net/http"
	"strconv"
	"time"

	"bim-system/database"
	"bim-system/models"

	"github.com/labstack/echo/v4"
)

type ProjectHandler struct {
	DB *database.DB
}

func NewProjectHandler(db *database.DB) *ProjectHandler {
	return &ProjectHandler{DB: db}
}

func (h *ProjectHandler) CreateProject(c echo.Context) error {
	userID := c.Get("user_id").(int)
	
	var req models.ProjectRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なリクエストボディです")
	}

	var project models.Project
	err := h.DB.QueryRow(
		`INSERT INTO projects (name, description, file_id, user_id, created_at, updated_at) 
		 VALUES ($1, $2, $3, $4, $5, $6) 
		 RETURNING id, name, description, file_id, user_id, created_at, updated_at`,
		req.Name, req.Description, req.FileID, userID, time.Now(), time.Now(),
	).Scan(&project.ID, &project.Name, &project.Description, &project.FileID, &project.UserID, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "プロジェクトの作成に失敗しました")
	}

	response := models.ProjectResponse{
		ID:          project.ID,
		Name:        project.Name,
		Description: project.Description,
		FileID:      project.FileID,
		CreatedAt:   project.CreatedAt,
		UpdatedAt:   project.UpdatedAt,
	}

	return c.JSON(http.StatusCreated, response)
}

func (h *ProjectHandler) GetProjects(c echo.Context) error {
	userID := c.Get("user_id").(int)

	rows, err := h.DB.Query(
		"SELECT id, name, description, file_id, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "プロジェクトの取得に失敗しました")
	}
	defer rows.Close()

	var projects []models.ProjectResponse
	for rows.Next() {
		var project models.ProjectResponse
		err := rows.Scan(&project.ID, &project.Name, &project.Description, &project.FileID, &project.CreatedAt, &project.UpdatedAt)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "プロジェクトの読み込みに失敗しました")
		}
		projects = append(projects, project)
	}

	return c.JSON(http.StatusOK, projects)
}

func (h *ProjectHandler) GetProject(c echo.Context) error {
	userID := c.Get("user_id").(int)
	projectID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なプロジェクトIDです")
	}

	var project models.ProjectResponse
	err = h.DB.QueryRow(
		"SELECT id, name, description, file_id, created_at, updated_at FROM projects WHERE id = $1 AND user_id = $2",
		projectID, userID,
	).Scan(&project.ID, &project.Name, &project.Description, &project.FileID, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "プロジェクトが見つかりません")
	}

	return c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) UpdateProject(c echo.Context) error {
	userID := c.Get("user_id").(int)
	projectID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なプロジェクトIDです")
	}

	var req models.ProjectRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なリクエストボディです")
	}

	var project models.ProjectResponse
	err = h.DB.QueryRow(
		`UPDATE projects 
		 SET name = $1, description = $2, file_id = $3, updated_at = $4 
		 WHERE id = $5 AND user_id = $6 
		 RETURNING id, name, description, file_id, created_at, updated_at`,
		req.Name, req.Description, req.FileID, time.Now(), projectID, userID,
	).Scan(&project.ID, &project.Name, &project.Description, &project.FileID, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "プロジェクトが見つかりません")
	}

	return c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) DeleteProject(c echo.Context) error {
	userID := c.Get("user_id").(int)
	projectID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なプロジェクトIDです")
	}

	result, err := h.DB.Exec("DELETE FROM projects WHERE id = $1 AND user_id = $2", projectID, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "プロジェクトの削除に失敗しました")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "削除確認に失敗しました")
	}

	if rowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "project not found")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *ProjectHandler) UpdateObjectProperties(c echo.Context) error {
	userID := c.Get("user_id").(int)
	projectID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なプロジェクトIDです")
	}

	objectID := c.Param("objectId")
	if objectID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "オブジェクトIDが必要です")
	}

	var properties map[string]interface{}
	if err := c.Bind(&properties); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "無効なリクエストボディです")
	}

	// Check if project belongs to user
	var exists bool
	err = h.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND user_id = $2)", projectID, userID).Scan(&exists)
	if err != nil || !exists {
		return echo.NewHTTPError(http.StatusNotFound, "プロジェクトが見つかりません")
	}

	// Upsert object properties
	_, err = h.DB.Exec(`
		INSERT INTO project_objects (project_id, object_id, properties, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (project_id, object_id) 
		DO UPDATE SET properties = $3, updated_at = $5`,
		projectID, objectID, properties, time.Now(), time.Now(),
	)

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "オブジェクトプロパティの更新に失敗しました")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "オブジェクトプロパティが正常に更新されました",
		"object_id": objectID,
		"properties": properties,
	})
}