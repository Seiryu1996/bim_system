import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import axios from 'axios';

const TestPage: React.FC = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { projects, isLoading, error } = useSelector((state: RootState) => state.project);
  const [apiStatus, setApiStatus] = useState<string>('未確認');

  useEffect(() => {
    const checkAPI = async () => {
      try {
        const response = await axios.get('http://localhost:8080/health');
        setApiStatus(`接続成功: ${response.data.status}`);
      } catch (error) {
        setApiStatus(`接続失敗: ${error}`);
      }
    };
    
    checkAPI();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">テストページ</h1>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">API接続状態</h2>
        <p>バックエンドAPI: {apiStatus}</p>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">認証状態</h2>
        <p>認証済み: {isAuthenticated ? 'はい' : 'いいえ'}</p>
        <p>ユーザー: {user?.username || 'なし'}</p>
        <p>トークン: {localStorage.getItem('token') ? '存在' : '不在'}</p>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">プロジェクト状態</h2>
        <p>読み込み中: {isLoading ? 'はい' : 'いいえ'}</p>
        <p>エラー: {error || 'なし'}</p>
        <p>プロジェクト数: {projects?.length || 0}</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">プロジェクト一覧</h2>
        {projects?.length > 0 ? (
          <ul>
            {projects.map((project) => (
              <li key={project.id} className="mb-2">
                {project.name} - {project.description}
              </li>
            ))}
          </ul>
        ) : (
          <p>プロジェクトがありません</p>
        )}
      </div>
    </div>
  );
};

export default TestPage;