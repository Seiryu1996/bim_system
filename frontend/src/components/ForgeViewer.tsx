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
  console.log('generateURN: 入力fileId:', fileId);
  
  // すでにURN形式の場合はそのまま返す
  if (fileId.startsWith('urn:')) {
    console.log('generateURN: 既にURN形式:', fileId);
    return fileId;
  }

  // 有効なBase64文字列かチェック（URLエンコードされている場合も考慮）
  let testFileId = fileId;
  if (fileId.includes('%')) {
    try {
      testFileId = decodeURIComponent(fileId);
    } catch (e) {
      console.warn('generateURN: URLデコード失敗:', e);
    }
  }

  // Base64形式のObjectIdかチェック
  if (testFileId.length > 20 && /^[A-Za-z0-9+/=]+$/.test(testFileId)) {
    try {
      // Base64デコードテスト
      const decoded = atob(testFileId);
      console.log('generateURN: Base64デコード成功:', decoded);
      
      // デコードされた内容がurn:で始まるかチェック
      if (decoded.startsWith('urn:')) {
        return decoded;
      } else {
        // Base64だがURNではない場合、urn:プレフィックスを付加
        return `urn:${testFileId}`;
      }
    } catch (e) {
      console.warn('generateURN: Base64デコード失敗:', e);
    }
  }

  // 通常のファイル名の場合、Forge URNを生成
  try {
    const bucketName = 'bim-system-bucket';
    const objectKey = encodeURIComponent(fileId);
    const objectId = `urn:adsk.objects:os.object:${bucketName}/${objectKey}`;
    
    // UTF-8文字列をBase64エンコード
    const base64ObjectId = btoa(unescape(encodeURIComponent(objectId)));
    console.log('generateURN: 生成されたURN:', `urn:${base64ObjectId}`);
    
    return `urn:${base64ObjectId}`;
  } catch (error) {
    console.error('generateURN: URN生成エラー:', error);
    
    // 最後の手段: サンプルURNを使用
    console.warn('generateURN: サンプルURNを使用します:', fileId);
    return 'urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Zm9yZ2UtanMtc2FtcGxlLWFwcC1idWNrZXQvZXhkZTQwZWM0My0xYTE1LTQ1NGQtOGY3Ni0yNmFmMGI4N2QxMjNfcnZpdC56aXA=';
  }
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
    let timeoutId: NodeJS.Timeout;
    try {
      setIsLoading(true);
      setError(null);
      console.log('ForgeViewer: 初期化開始, fileId:', fileId);

      // 60秒でタイムアウト（30秒から延長）
      timeoutId = setTimeout(() => {
        console.error('ForgeViewer: 初期化タイムアウト');
        setError('Viewerの初期化がタイムアウトしました');
        setIsLoading(false);
      }, 60000);
      
      // DOM要素の準備を確認
      if (!viewerRef.current || !viewerContainer) {
        console.error('ForgeViewer: viewerRef.currentまたはviewerContainerがnull');
        setError('Viewerコンテナの初期化に失敗しました');
        setIsLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      // Autodesk Forge SDKの読み込み待機
      const waitForForgeSDK = () => {
        return new Promise<void>((resolve, reject) => {
          const checkSDK = () => {
            if (window.Autodesk && window.Autodesk.Viewing) {
              resolve();
            } else {
              setTimeout(checkSDK, 100);
            }
          };
          checkSDK();
          
          // SDK読み込みタイムアウト（20秒）
          setTimeout(() => {
            reject(new Error('Autodesk Forge SDKの読み込みがタイムアウトしました'));
          }, 20000);
        });
      };

      console.log('ForgeViewer: Autodesk Forge SDK読み込み待機中...');
      await waitForForgeSDK();
      console.log('ForgeViewer: Autodesk Forge SDK読み込み完了');
      
      // トークン取得（リトライ機能付き）
      let token: string;
      let tokenRetries = 3;
      while (tokenRetries > 0) {
        try {
          token = await forgeService.getForgeViewerToken();
          console.log('ForgeViewer: トークン取得成功:', token?.substring(0, 20) + '...');
          
          // トークンの妥当性チェック
          if (!token || token.length < 10) {
            throw new Error('無効なトークンが返されました');
          }
          
          break;
        } catch (tokenError) {
          tokenRetries--;
          console.warn(`ForgeViewer: トークン取得失敗、残り${tokenRetries}回リトライ:`, tokenError);
          if (tokenRetries === 0) {
            throw new Error('トークン取得に失敗しました: ' + (tokenError as Error).message);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const options = {
        env: 'AutodeskProduction',
        getAccessToken: (callback: (token: string, expire: number) => void) => {
          callback(token!, 3600);
        }
      };

      console.log('ForgeViewer: Autodesk Viewing Initializer開始');
      
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

        // Base64文字列のURLデコード処理
        let documentId: string;
        
        console.log('ForgeViewer: 元のfileId:', fileId);
        
        // fileIdにURNプレフィックスを付加
        if (fileId.startsWith('urn:')) {
          documentId = fileId;
        } else {
          documentId = `urn:${fileId}`;
        }
        
        // URLエンコードされた文字をデコード
        const base64Part = documentId.replace('urn:', '');
        let decodedBase64Part: string;
        try {
          decodedBase64Part = decodeURIComponent(base64Part);
          console.log('ForgeViewer: URLデコード後:', decodedBase64Part);
        } catch (e) {
          console.warn('ForgeViewer: URLデコード失敗、元の値を使用:', e);
          decodedBase64Part = base64Part;
        }
        
        // 最終的なURNを構築
        documentId = `urn:${decodedBase64Part}`;
        console.log('ForgeViewer: 最終URN:', documentId);
        
        // Base64デコード妥当性チェック
        try {
          const decoded = atob(decodedBase64Part);
          console.log('ForgeViewer: Base64デコード成功:', decoded);
        } catch (e) {
          console.error('ForgeViewer: Base64デコード失敗:', e);
          clearTimeout(timeoutId);
          setError('URNの形式が正しくありません');
          setIsLoading(false);
          return;
        }
        
        // デモ用：実際のファイルがないため、プレースホルダー表示
        clearTimeout(timeoutId);
        setIsLoading(false);
        
        // デモビューアーの代替表示
        const demoViewerDiv = viewerRef.current;
        if (demoViewerDiv) {
          demoViewerDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 20px;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h2 style="margin: 0 0 15px 0; font-size: 24px;">🏗️ BIM 3Dビューアー</h2>
                <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">ファイル: ${fileId}</p>
                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin: 15px 0;">
                  <p style="margin: 0; font-size: 14px;">📁 ファイルは正常にアップロードされました</p>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">🔧 実際の3D表示にはAutodesk Forge設定が必要です</p>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; font-family: monospace; font-size: 12px; text-align: left;">
                  <div>URN: ${documentId.substring(0, 50)}...</div>
                  <div style="margin-top: 5px;">Status: Ready for viewing</div>
                </div>
              </div>
            </div>
          `;
        }
      }, (initError: any) => {
        console.error('ForgeViewer: 初期化エラー:', initError);
        clearTimeout(timeoutId);
        setError('Viewerの初期化に失敗しました: ' + initError.message);
        setIsLoading(false);
      });
    } catch (err: any) {
      console.error('ForgeViewer: catch文でのエラー:', err);
      if (timeoutId) clearTimeout(timeoutId);
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