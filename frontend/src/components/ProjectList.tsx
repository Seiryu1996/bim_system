import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchProjects, createProject, deleteProject, setCurrentProject } from '../store/projectSlice';
import { ProjectRequest } from '../types';

const ProjectList: React.FC = () => {
  const dispatch = useDispatch();
  const { projects, isLoading, error } = useSelector((state: RootState) => state.project);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<ProjectRequest>({
    name: '',
    description: '',
    file_id: ''
  });

  useEffect(() => {
    dispatch(fetchProjects() as any);
  }, [dispatch]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(createProject(formData) as any);
      setShowCreateForm(false);
      setFormData({ name: '', description: '', file_id: '' });
    } catch (error) {
      console.error('Failed to create project:', error);
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
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
        >
          新しいプロジェクトを作成
        </button>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-semibold mb-4">新しいプロジェクトを作成</h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">プロジェクト名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">説明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">ファイルID (URN)</label>
                <input
                  type="text"
                  value={formData.file_id}
                  onChange={(e) => setFormData({ ...formData, file_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
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
        {projects.map((project) => (
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
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">プロジェクトが見つかりません</p>
          <p className="text-gray-400">最初のBIMプロジェクトを作成して開始しましょう</p>
        </div>
      )}
    </div>
  );
};

export default ProjectList;