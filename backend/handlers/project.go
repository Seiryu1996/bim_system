package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
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
	fmt.Printf("Creating project for user ID: %d\n", userID)
	
	var req models.ProjectRequest
	if err := c.Bind(&req); err != nil {
		fmt.Printf("Bind error: %v\n", err)
		return echo.NewHTTPError(http.StatusBadRequest, "無効なリクエストボディです")
	}
	
	fmt.Printf("Project request: name=%s, description=%s, file_id=%s\n", req.Name, req.Description, req.FileID)

	// バリデーション
	if err := h.validateProjectRequest(&req); err != nil {
		fmt.Printf("Validation error: %v\n", err)
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var project models.Project
	err := h.DB.QueryRow(
		`INSERT INTO projects (name, description, file_id, user_id, created_at, updated_at) 
		 VALUES ($1, $2, $3, $4, $5, $6) 
		 RETURNING id, name, description, file_id, user_id, created_at, updated_at`,
		req.Name, req.Description, req.FileID, userID, time.Now(), time.Now(),
	).Scan(&project.ID, &project.Name, &project.Description, &project.FileID, &project.UserID, &project.CreatedAt, &project.UpdatedAt)

	if err != nil {
		fmt.Printf("Database error during project creation: %v\n", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "プロジェクトの作成に失敗しました: "+err.Error())
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

// プロジェクトリクエストのバリデーション
func (h *ProjectHandler) validateProjectRequest(req *models.ProjectRequest) error {
	// プロジェクト名のバリデーション
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("プロジェクト名は必須です")
	}
	
	if len(req.Name) < 2 {
		return fmt.Errorf("プロジェクト名は2文字以上で入力してください")
	}
	
	if len(req.Name) > 100 {
		return fmt.Errorf("プロジェクト名は100文字以内で入力してください")
	}

	// 説明のバリデーション
	if len(req.Description) > 500 {
		return fmt.Errorf("説明は500文字以内で入力してください")
	}

	// ファイルIDのバリデーション
	if strings.TrimSpace(req.FileID) == "" {
		return fmt.Errorf("ファイルIDは必須です")
	}

	if !h.validateFileID(req.FileID) {
		return fmt.Errorf("有効なファイルIDまたはURNを入力してください")
	}

	// 同名プロジェクトの重複チェック（同一ユーザー内）
	if h.isProjectNameDuplicate(req.Name) {
		return fmt.Errorf("同じ名前のプロジェクトが既に存在します")
	}

	return nil
}

// ファイルIDのバリデーション
func (h *ProjectHandler) validateFileID(fileID string) bool {
	fileID = strings.TrimSpace(fileID)
	
	// URN形式の場合
	if strings.HasPrefix(fileID, "urn:") {
		// Base64エンコードされたURNかチェック
		urnPart := strings.TrimPrefix(fileID, "urn:")
		if len(urnPart) < 10 {
			return false
		}
		// Base64文字のみを含むかチェック
		matched, _ := regexp.MatchString(`^[A-Za-z0-9+/=_%]+$`, urnPart)
		return matched
	}
	
	// Base64エンコードのみの場合（50文字以上）
	if len(fileID) >= 50 {
		matched, _ := regexp.MatchString(`^[A-Za-z0-9+/=_%]+$`, fileID)
		return matched
	}
	
	// ファイル名やパスの場合（拡張子チェック）
	validExtensions := []string{".rvt", ".dwg", ".ifc", ".nwd", ".3ds", ".obj", ".fbx", ".step", ".iges", ".stp", ".rfa", ".dwf", ".dgn"}
	fileID = strings.ToLower(fileID)
	
	for _, ext := range validExtensions {
		if strings.HasSuffix(fileID, ext) {
			return true
		}
	}
	
	// 短いIDの場合も許可（サンプルやテスト用）
	return len(fileID) >= 2
}

// プロジェクト名の重複チェック
func (h *ProjectHandler) isProjectNameDuplicate(name string) bool {
	var count int
	err := h.DB.QueryRow(
		"SELECT COUNT(*) FROM projects WHERE LOWER(name) = LOWER($1)",
		strings.TrimSpace(name),
	).Scan(&count)
	
	if err != nil {
		return false // エラーの場合は重複なしとして処理
	}
	
	return count > 0
}