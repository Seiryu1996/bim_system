import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { setSelectedObject, setObjectProperties, updateObjectProperties } from '../store/projectSlice';
import { forgeService } from '../services/forgeService';

interface ForgeViewerProps {
  fileId: string;
  projectId: number;
}

declare global {
  interface Window {
    Autodesk: any;
  }
}

// URN生成関数
const generateURN = (fileId: string): string => {
  // すでにURN形式の場合はそのまま返す
  if (fileId.startsWith('urn:')) {
    return fileId;
  }

  // Autodesk公式サンプルURNかチェック
  if (fileId === 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Zm9yZ2UtanMtc2FtcGxlLWFwcC1idWNrZXQvZXhkZTQwZWM0My0xYTE1LTQ1NGQtOGY3Ni0yNmFmMGI4N2QxMjNfcnZpdC56aXA%3D') {
    return `urn:${fileId}`;
  }

  // Base64エンコードのURNかチェック（50文字以上でURLセーフ文字のみ）
  if (fileId.length > 50 && /^[A-Za-z0-9+/=_%]+$/.test(fileId)) {
    return `urn:${fileId}`;
  }

  // 短いfileIdの場合はサンプルURNを使用
  if (fileId.length < 20) {
    console.warn('短いfileIdのためサンプルURNを使用します:', fileId);
    return 'urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Zm9yZ2UtanMtc2FtcGxlLWFwcC1idWNrZXQvZXhkZTQwZWM0My0xYTE1LTQ1NGQtOGY3Ni0yNmFmMGI4N2QxMjNfcnZpdC56aXA%3D';
  }

  // その他の場合はファイル名からURNを生成
  const bucketName = 'bim-system-bucket';
  const objectKey = encodeURIComponent(fileId);
  const objectId = `adsk.objects:os.object:${bucketName}/${objectKey}`;
  const base64ObjectId = btoa(objectId);
  
  return `urn:${base64ObjectId}`;
};

const ForgeViewer: React.FC<ForgeViewerProps> = ({ fileId, projectId }) => {
  const dispatch = useDispatch();
  const { selectedObject, objectProperties } = useSelector((state: RootState) => state.project);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false); // 初期状態をfalseに変更
  const [error, setError] = useState<string | null>(null);
  const [viewerContainer, setViewerContainer] = useState<HTMLDivElement | null>(null);

  // コールバックrefを使用してDOMが確実に準備されてから初期化
  const setViewerRef = (element: HTMLDivElement | null) => {
    console.log('ForgeViewer setViewerRef: element =', !!element);
    viewerRef.current = element;
    setViewerContainer(element);
  };

  useEffect(() => {
    console.log('ForgeViewer useEffect: viewerContainer =', !!viewerContainer, 'fileId =', fileId);
    if (viewerContainer && fileId) {
      // 少し遅延を入れてからViewer初期化
      const timer = setTimeout(() => {
        initializeViewer();
      }, 100);
      return () => clearTimeout(timer);
    }
    return () => {
      if (viewer) {
        viewer.finish();
      }
    };
  }, [viewerContainer, fileId]);

  const initializeViewer = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('ForgeViewer: 初期化開始, fileId:', fileId);

      // 30秒でタイムアウト
      const timeoutId = setTimeout(() => {
        console.error('ForgeViewer: 初期化タイムアウト');
        setError('Viewerの初期化がタイムアウトしました');
        setIsLoading(false);
      }, 30000);
      
      const token = await forgeService.getForgeViewerToken();
      console.log('ForgeViewer: トークン取得成功');
      
      if (!viewerRef.current || !viewerContainer) {
        console.error('ForgeViewer: viewerRef.currentまたはviewerContainerがnull');
        setError('Viewerコンテナの初期化に失敗しました');
        setIsLoading(false);
        return;
      }

      const options = {
        env: 'AutodeskProduction',
        getAccessToken: (callback: (token: string, expire: number) => void) => {
          callback(token, 3600);
        }
      };

      console.log('ForgeViewer: Autodesk Viewing Initializer開始');
      console.log('ForgeViewer: window.Autodesk:', window.Autodesk);
      console.log('ForgeViewer: window.Autodesk.Viewing:', window.Autodesk?.Viewing);
      
      if (!window.Autodesk || !window.Autodesk.Viewing) {
        setError('Autodesk Forge SDKが読み込まれていません');
        setIsLoading(false);
        return;
      }
      
      window.Autodesk.Viewing.Initializer(options, () => {
        console.log('ForgeViewer: Viewer初期化成功');
        const viewerDiv = viewerRef.current;
        if (!viewerDiv) {
          console.error('ForgeViewer: viewerDiv取得失敗');
          return;
        }

        const viewerConfig = {
          extensions: ['Autodesk.DocumentBrowser']
        };

        const newViewer = new window.Autodesk.Viewing.GuiViewer3D(viewerDiv, viewerConfig);
        
        newViewer.start();
        setViewer(newViewer);
        console.log('ForgeViewer: Viewer作成・開始完了');

        // ファイルIDからURNを自動生成
        const documentId = generateURN(fileId);
        console.log('ForgeViewer: 生成されたURN:', documentId);
        
        window.Autodesk.Viewing.Document.load(documentId, (doc: any) => {
          console.log('ForgeViewer: ドキュメント読み込み成功');
          const viewables = doc.getRoot().getDefaultGeometry();
          console.log('ForgeViewer: viewables取得:', viewables);
          
          newViewer.loadDocumentNode(doc, viewables).then(() => {
            console.log('ForgeViewer: モデル読み込み完了');
            clearTimeout(timeoutId);
            setIsLoading(false);
            setupEventListeners(newViewer);
          }).catch((loadError: any) => {
            console.error('ForgeViewer: モデル読み込みエラー:', loadError);
            clearTimeout(timeoutId);
            setError('モデルの読み込みに失敗しました: ' + loadError.message);
            setIsLoading(false);
          });
        }, (error: any) => {
          console.error('ForgeViewer: ドキュメント読み込みエラー:', error);
          clearTimeout(timeoutId);
          let errorMessage = 'ドキュメントの読み込みに失敗しました';
          if (error === 7) {
            errorMessage = 'ファイルが見つかりません。有効なAutodesk Forge URNを指定してください。';
          } else if (error.message) {
            errorMessage += ': ' + error.message;
          }
          setError(errorMessage);
          setIsLoading(false);
        });
      }, (initError: any) => {
        console.error('ForgeViewer: 初期化エラー:', initError);
        clearTimeout(timeoutId);
        setError('Viewerの初期化に失敗しました: ' + initError.message);
        setIsLoading(false);
      });
    } catch (err: any) {
      console.error('ForgeViewer: catch文でのエラー:', err);
      setError('Failed to initialize viewer: ' + err.message);
      setIsLoading(false);
    }
  };

  const setupEventListeners = (viewer: any) => {
    viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event: any) => {
      const selection = event.dbIdArray;
      if (selection.length > 0) {
        const dbId = selection[0];
        handleObjectSelection(viewer, dbId);
      } else {
        dispatch(setSelectedObject(null));
        dispatch(setObjectProperties({}));
      }
    });
  };

  const handleObjectSelection = (viewer: any, dbId: number) => {
    viewer.getProperties(dbId, (properties: any) => {
      dispatch(setSelectedObject({ dbId, ...properties }));
      
      const props: Record<string, any> = {};
      properties.properties.forEach((prop: any) => {
        props[prop.displayName] = prop.displayValue;
      });
      dispatch(setObjectProperties(props));
    });
  };

  const handlePropertyUpdate = (key: string, value: any) => {
    if (!selectedObject) return;
    
    const updatedProperties = {
      ...objectProperties,
      [key]: value
    };
    
    dispatch(updateObjectProperties({
      projectId,
      objectId: selectedObject.dbId.toString(),
      properties: updatedProperties
    }));
  };

  console.log('ForgeViewer render: isLoading =', isLoading, 'error =', error);

  return (
    <div className="flex h-screen">
      <div className="flex-1 relative">
        {/* 常にViewer要素を表示 */}
        <div 
          ref={setViewerRef} 
          className="w-full h-full"
          style={{ minHeight: '500px' }}
        />
        
        {/* ローディングオーバーレイ */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="text-lg">3Dモデルを読み込み中...</div>
          </div>
        )}
        
        {/* エラーオーバーレイ */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="text-red-500">エラー: {error}</div>
          </div>
        )}
      </div>
      
      {selectedObject && (
        <div className="w-80 p-4 border-l bg-gray-50 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">オブジェクトプロパティ</h3>
          <div className="space-y-3">
            {Object.entries(objectProperties).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  {key}
                </label>
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => handlePropertyUpdate(key, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-2">選択されたオブジェクト情報</h4>
            <p className="text-sm text-blue-600">
              オブジェクトID: {selectedObject.dbId}
            </p>
            <p className="text-sm text-blue-600">
              名前: {selectedObject.name || '不明'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForgeViewer;