import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store';
import { logout } from './store/authSlice';
import { setCurrentProject } from './store/projectSlice';
import Login from './components/Login';
import ProjectList from './components/ProjectList';
import ForgeViewer from './components/ForgeViewer';

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { currentProject } = useSelector((state: RootState) => state.project);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(setCurrentProject(null));
  };

  const handleBackToProjects = () => {
    dispatch(setCurrentProject(null));
  };

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">BIM管理システム</h1>
              {currentProject && (
                <span className="ml-4 text-gray-600">
                  / {currentProject.name}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">ようこそ、{user?.username}さん</span>
              {currentProject && (
                <button
                  onClick={handleBackToProjects}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  プロジェクト一覧に戻る
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {currentProject ? (
          <ForgeViewer 
            fileId={currentProject.file_id} 
            projectId={currentProject.id}
          />
        ) : (
          <ProjectList />
        )}
      </main>
    </div>
  );
}

export default App;