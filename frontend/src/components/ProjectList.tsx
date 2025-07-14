import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchProjects, createProject, deleteProject, setCurrentProject } from '../store/projectSlice';
import { ProjectRequest } from '../types';
import FileCreator from './FileCreator';

const ProjectList: React.FC = () => {
  const dispatch = useDispatch();
  const { projects, isLoading, error } = useSelector((state: RootState) => state.project);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFileCreator, setShowFileCreator] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<ProjectRequest>({
    name: '',
    description: '',
    file_id: ''
  });

  useEffect(() => {
    console.log('ProjectList: fetchProjects開始');
    dispatch(fetchProjects() as any);
  }, [dispatch]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // プロジェクト名のバリデーション
    if (!formData.name.trim()) {
      errors.name = 'プロジェクト名は必須です';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'プロジェクト名は2文字以上で入力してください';
    } else if (formData.name.length > 100) {
      errors.name = 'プロジェクト名は100文字以内で入力してください';
    }

    // 説明のバリデーション
    if (formData.description.length > 500) {
      errors.description = '説明は500文字以内で入力してください';
    }

    // ファイルIDのバリデーション
    if (!formData.file_id.trim()) {
      errors.file_id = 'ファイルIDは必須です';
    } else if (!validateFileID(formData.file_id)) {
      errors.file_id = '有効なファイルIDまたはURNを入力してください';
    }

    // 重複チェック
    const isDuplicate = projects.some(
      (project: any) => project.name.toLowerCase() === formData.name.trim().toLowerCase()
    );
    if (isDuplicate) {
      errors.name = '同じ名前のプロジェクトが既に存在します';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFileID = (fileId: string): boolean => {
    const trimmedId = fileId.trim();
    
    // URN形式
    if (trimmedId.startsWith('urn:')) {
      const urnPart = trimmedId.substring(4);
      return urnPart.length >= 10 && /^[A-Za-z0-9+/=_%]+$/.test(urnPart);
    }
    
    // Base64エンコード
    if (trimmedId.length >= 50) {
      return /^[A-Za-z0-9+/=_%]+$/.test(trimmedId);
    }
    
    // ファイル名（拡張子チェック）
    const validExtensions = ['.rvt', '.dwg', '.ifc', '.nwd', '.3ds', '.obj', '.fbx', '.step', '.iges', '.stp', '.rfa', '.dwf', '.dgn'];
    const lowerFileId = trimmedId.toLowerCase();
    
    for (const ext of validExtensions) {
      if (lowerFileId.endsWith(ext)) {
        return true;
      }
    }
    
    // 短いIDも許可（2文字以上）
    return trimmedId.length >= 2;
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(createProject(formData) as any);
      setShowCreateForm(false);
      setFormData({ name: '', description: '', file_id: '' });
      setValidationErrors({});
    } catch (error: any) {
      console.error('Failed to create project:', error);
      // サーバーエラーをバリデーションエラーとして表示
      if (error.response?.data?.message) {
        setValidationErrors({ general: error.response.data.message });
      }
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (window.confirm('このプロジェクトを削除してもよろしいですか？')) {
      await dispatch(deleteProject(id) as any);
    }
  };

  const handleViewProject = (project: any) => {
    dispatch(setCurrentProject(project));
  };

  const handleCreateSampleProject = async () => {
    const sampleProject = {
      name: 'サンプル建物モデル',
      description: 'Autodesk Forge公式サンプルモデルを使用したデモプロジェクト',
      file_id: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Zm9yZ2UtanMtc2FtcGxlLWFwcC1idWNrZXQvZXhkZTQwZWM0My0xYTE1LTQ1NGQtOGY3Ni0yNmFmMGI4N2QxMjNfcnZpdC56aXA%3D'
    };

    try {
      await dispatch(createProject(sampleProject) as any);
    } catch (error) {
      console.error('Failed to create sample project:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/forge/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('アップロードに失敗しました');
      }

      const result = await response.json();
      
      // URNをフォームに設定
      setFormData(prev => ({
        ...prev,
        file_id: result.urn,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ''), // 拡張子を除いたファイル名
      }));

      alert('ファイルのアップロードが完了しました。変換には数分かかる場合があります。');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('ファイルのアップロードに失敗しました: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileCreated = async (file: File) => {
    setShowFileCreator(false);
    setIsUploading(true);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/forge/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error('アップロードに失敗しました');
      }

      const result = await response.json();
      
      // URNをフォームに設定
      setFormData(prev => ({
        ...prev,
        file_id: result.urn,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ''), // 拡張子を除いたファイル名
      }));

      setShowCreateForm(true);
      alert('3Dモデルファイルが作成され、アップロードが完了しました。');
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert('ファイルのアップロードに失敗しました: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  console.log('ProjectList: isLoading =', isLoading, 'error =', error, 'projects =', projects);

  if (isLoading) {
    return <div className="text-center py-8">プロジェクトを読み込み中...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">エラー: {error}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">BIMプロジェクト</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleCreateSampleProject()}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
          >
            サンプルプロジェクト
          </button>
          <button
            onClick={() => setShowFileCreator(true)}
            className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors"
          >
            3Dモデルを作成
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
          >
            新しいプロジェクトを作成
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-semibold mb-4">新しいプロジェクトを作成</h2>
            
            {/* 全般的なエラー表示 */}
            {validationErrors.general && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {validationErrors.general}
              </div>
            )}
            
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">プロジェクト名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    validationErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  required
                />
                {validationErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">説明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    validationErrors.description ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  rows={3}
                />
                {validationErrors.description && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.description}</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">ファイル識別子またはファイルアップロード</label>
                
                {/* ファイルアップロード */}
                <div className="mb-3">
                  <input
                    type="file"
                    accept=".rvt,.dwg,.ifc,.nwd,.3ds,.obj,.fbx,.step,.iges"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {isUploading && (
                    <p className="text-sm text-blue-600 mt-2">ファイルをアップロード中...</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    BIMファイル (.rvt, .dwg, .ifc など) をアップロードしてURNを自動生成
                  </p>
                </div>
                
                {/* または手動入力 */}
                <div className="text-center text-sm text-gray-500 mb-3">または</div>
                
                <input
                  type="text"
                  value={formData.file_id}
                  onChange={(e) => setFormData({ ...formData, file_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    validationErrors.file_id ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="例: building-model.rvt, my-project.dwg, または Forge URN"
                  required
                />
                {validationErrors.file_id && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.file_id}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  ファイル名、パス、またはAutodesk Forge URNを手動入力
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors"
                >
                  作成
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects && projects.length > 0 ? projects.map((project) => (
          <div key={project.id} className="bg-white p-6 rounded-lg shadow-md border">
            <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
            <p className="text-gray-600 mb-4">{project.description}</p>
            <div className="text-sm text-gray-500 mb-4">
              <p>作成日: {new Date(project.created_at).toLocaleDateString()}</p>
              <p>更新日: {new Date(project.updated_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleViewProject(project)}
                className="flex-1 bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
              >
                モデル表示
              </button>
              <button
                onClick={() => handleDeleteProject(project.id)}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
              >
                削除
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500 text-lg">プロジェクトが見つかりません</p>
            <p className="text-gray-400">最初のBIMプロジェクトを作成して開始しましょう</p>
          </div>
        )}
      </div>

      {/* ファイル作成モーダル */}
      {showFileCreator && (
        <FileCreator
          onFileCreated={handleFileCreated}
          onClose={() => setShowFileCreator(false)}
        />
      )}
    </div>
  );
};

export default ProjectList;