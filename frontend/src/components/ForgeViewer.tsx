import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { setSelectedObject, setObjectProperties, updateObjectProperties } from '../store/projectSlice';
import { forgeService } from '../services/forgeService';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';

interface ForgeViewerProps {
  fileId: string;
  projectId: number;
}

declare global {
  interface Window {
    Autodesk: any;
  }
}

/**
 * fileIdからForge URNを生成する関数
 * @param fileId - ファイルID（URN、Base64、またはファイル名）
 * @returns 生成されたURN
 */
const generateURN = (fileId: string): string => {
  if (fileId.startsWith('urn:')) {
    return fileId;
  }

  let testFileId = fileId;
  if (fileId.includes('%')) {
    try {
      testFileId = decodeURIComponent(fileId);
    } catch (e) {
      // URLデコード失敗時は元の値を使用
    }
  }

  if (testFileId.length > 20 && /^[A-Za-z0-9+/=]+$/.test(testFileId)) {
    try {
      const decoded = atob(testFileId);
      
      if (decoded.startsWith('urn:')) {
        return decoded;
      } else {
        return `urn:${testFileId}`;
      }
    } catch (e) {
      // Base64デコード失敗時は処理を継続
    }
  }

  try {
    const bucketName = 'bim-system-bucket';
    const objectKey = encodeURIComponent(fileId);
    const objectId = `urn:adsk.objects:os.object:${bucketName}/${objectKey}`;
    
    const base64ObjectId = btoa(unescape(encodeURIComponent(objectId)));
    
    return `urn:${base64ObjectId}`;
  } catch (error) {
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  /**
   * Viewerコンテナの参照を設定
   */
  const setViewerRef = (element: HTMLDivElement | null) => {
    viewerRef.current = element;
    setViewerContainer(element);
  };

  useEffect(() => {
    if (viewerContainer && fileId) {
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

  /**
   * Viewerの初期化処理
   */
  const initializeViewer = async () => {
    let timeoutId: NodeJS.Timeout;
    try {
      setIsLoading(true);
      setError(null);

      const forgeEnabled = import.meta.env.VITE_FORGE_ENABLED === 'true';
      
      if (!forgeEnabled) {
        // 開発モード：Three.jsでローカルファイルを表示
        try {
          const decodedUrn = atob(fileId);
          const parts = decodedUrn.split('/');
          if (parts.length >= 2) {
            const objectKey = parts[parts.length - 1];
            await loadLocalFile(objectKey);
            return;
          }
        } catch (error) {
          await loadLocalFile(fileId);
          return;
        }
      }

      timeoutId = setTimeout(() => {
        setError('Viewerの初期化がタイムアウトしました');
        setIsLoading(false);
      }, 60000);
      
      if (!viewerRef.current || !viewerContainer) {
        setError('Viewerコンテナの初期化に失敗しました');
        setIsLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      /**
       * Autodesk Forge SDKの読み込み待機
       */
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
          
          setTimeout(() => {
            reject(new Error('Autodesk Forge SDKの読み込みがタイムアウトしました'));
          }, 20000);
        });
      };

      await waitForForgeSDK();
      
      // トークン取得（リトライ機能付き）
      let token: string;
      let tokenRetries = 3;
      while (tokenRetries > 0) {
        try {
          token = await forgeService.getForgeViewerToken();
          
          if (!token || token.length < 10) {
            throw new Error('無効なトークンが返されました');
          }
          
          break;
        } catch (tokenError) {
          tokenRetries--;
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

      window.Autodesk.Viewing.Initializer(options, () => {
        const viewerDiv = viewerRef.current;
        if (!viewerDiv) {
          return;
        }

        const viewerConfig = {
          extensions: ['Autodesk.DocumentBrowser']
        };

        const newViewer = new window.Autodesk.Viewing.GuiViewer3D(viewerDiv, viewerConfig);
        
        newViewer.start();
        setViewer(newViewer);

        // URNの処理
        let documentId: string;
        
        if (fileId.startsWith('urn:')) {
          documentId = fileId;
        } else {
          documentId = `urn:${fileId}`;
        }
        
        const base64Part = documentId.replace('urn:', '');
        let decodedBase64Part: string;
        try {
          decodedBase64Part = decodeURIComponent(base64Part);
        } catch (e) {
          decodedBase64Part = base64Part;
        }
        
        documentId = `urn:${decodedBase64Part}`;
        
        try {
          const decoded = atob(decodedBase64Part);
        } catch (e) {
          clearTimeout(timeoutId);
          setError('URNの形式が正しくありません');
          setIsLoading(false);
          return;
        }
        
        try {
          window.Autodesk.Viewing.Document.load(documentId, (doc: any) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            
            newViewer.loadDocumentNode(doc, viewables).then(() => {
              clearTimeout(timeoutId);
              setIsLoading(false);
              setupEventListeners(newViewer);
            }).catch((loadError: any) => {
              clearTimeout(timeoutId);
              setError('モデルの読み込みに失敗しました: ' + loadError.message);
              setIsLoading(false);
            });
          }, (error: any) => {
            clearTimeout(timeoutId);
            let errorMessage = 'ドキュメントの読み込みに失敗しました';
            
            switch (error) {
              case 1:
                errorMessage = 'ネットワークエラー: インターネット接続を確認してください';
                break;
              case 2:
                errorMessage = 'ファイルが見つかりません';
                break;
              case 3:
                errorMessage = 'ファイルが損傷しています';
                break;
              case 4:
                errorMessage = 'ファイル形式がサポートされていません';
                break;
              case 5:
                errorMessage = '3Dモデルを準備中です。しばらくお待ちください。';
                break;
              case 6:
                errorMessage = 'アクセス権限がありません';
                break;
              case 7:
                errorMessage = 'ファイルが見つかりません。変換が完了していない可能性があります';
                break;
              default:
                if (error.message) {
                  errorMessage += ': ' + error.message;
                }
                break;
            }
            
            setError(errorMessage);
            setIsLoading(false);
          });
        } catch (documentLoadError) {
          clearTimeout(timeoutId);
          setError('ドキュメント読み込み処理でエラーが発生しました: ' + (documentLoadError as Error).message);
          setIsLoading(false);
        }
      }, (initError: any) => {
        clearTimeout(timeoutId);
        setError('Viewerの初期化に失敗しました: ' + initError.message);
        setIsLoading(false);
      });
    } catch (err: any) {
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

  /**
   * ズーム制御関数
   * @param delta - ズーム変化量
   */
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.5, Math.min(5, zoomLevel + delta));
    setZoomLevel(newZoom);
    
    if (cameraRef.current) {
      const distance = 20 / newZoom;
      cameraRef.current.position.set(distance, distance, distance);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  /**
   * 開発モード用：ローカルファイルをThree.jsで表示
   * @param objectKey - ファイルオブジェクトキー
   */
  const loadLocalFile = async (objectKey: string) => {
    try {
      setIsLoading(true);
      setError('');

      if (!viewerRef.current) return;

      // Three.jsシーンをセットアップ
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(75, viewerRef.current.clientWidth / viewerRef.current.clientHeight, 0.1, 1000);
      cameraRef.current = camera;
      
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(viewerRef.current.clientWidth, viewerRef.current.clientHeight);
      rendererRef.current = renderer;
      
      viewerRef.current.innerHTML = '';
      viewerRef.current.appendChild(renderer.domElement);

      // ライティングを設定
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      scene.add(directionalLight);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const mtlObjectKey = objectKey.replace('.obj', '.mtl');
      
      // MTLファイルとOBJファイルを読み込み
      const mtlLoader = new MTLLoader();
      mtlLoader.load(
        `${API_URL}/api/files/${mtlObjectKey}`,
        (materials) => {
          materials.preload();
          
          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          
          objLoader.load(
            `${API_URL}/api/files/${objectKey}`,
            (object) => {
              loadObjectIntoScene(object, scene, camera, renderer);
            },
            undefined,
            (error) => {
              loadOBJWithoutMaterials(objectKey, scene, camera, renderer);
            }
          );
        },
        undefined,
        (error) => {
          loadOBJWithoutMaterials(objectKey, scene, camera, renderer);
        }
      );
    } catch (error) {
      setError('ローカルファイルの読み込みに失敗しました');
      setIsLoading(false);
    }
  };

  /**
   * OBJファイルのみを読み込む関数（MTLなし）
   * @param objectKey - オブジェクトキー
   * @param scene - Three.jsシーン
   * @param camera - Three.jsカメラ
   * @param renderer - Three.jsレンダラー
   */
  const loadOBJWithoutMaterials = (objectKey: string, scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const loader = new OBJLoader();
    
    loader.load(
      `${API_URL}/api/files/${objectKey}`,
      (object) => {
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshLambertMaterial({ color: 0x888888 });
          }
        });
        
        loadObjectIntoScene(object, scene, camera, renderer);
      },
      undefined,
      (error) => {
        setError('3Dモデルの読み込みに失敗しました');
        setIsLoading(false);
      }
    );
  };

  /**
   * オブジェクトをシーンに配置する共通関数
   * @param object - Three.jsオブジェクト
   * @param scene - Three.jsシーン
   * @param camera - Three.jsカメラ
   * @param renderer - Three.jsレンダラー
   */
  const loadObjectIntoScene = (object: THREE.Object3D, scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    scene.add(object);

    // カメラ位置を調整（ズームレベル適用）
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = (maxDim * 1.5) / zoomLevel;

    camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    camera.lookAt(center);

    // マウスホイールズーム制御を追加
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.2 : 0.2;
      handleZoom(delta);
    };

    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    // アニメーションループ
    const animate = () => {
      requestAnimationFrame(animate);
      object.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    setIsLoading(false);
  };

  const checkTranslationStatus = async (documentId: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const base64Part = documentId.replace('urn:', '');
      const response = await fetch(`${API_URL}/test/status/${encodeURIComponent(base64Part)}`);
      
      if (response.ok) {
        const status = await response.json();
        
        if (status.status === 'completed') {
          setError('変換が完了しました！ページを再読み込みしてください。');
        } else if (status.status === 'processing') {
          setError(`変換処理中: ${status.progress} - ${status.message}`);
          // 10秒後に再チェック
          setTimeout(() => checkTranslationStatus(documentId), 10000);
        } else if (status.status === 'failed') {
          setError(`変換に失敗しました: ${status.message}`);
        }
      }
    } catch (error) {
      // 変換状況確認エラー時は静寂に処理
    }
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


  return (
    <div className="flex h-screen">
      <div className="flex-1 relative">
        {/* 常にViewer要素を表示 */}
        <div 
          ref={setViewerRef} 
          className="w-full h-full"
          style={{ minHeight: '500px' }}
        />
        
        {/* ズームコントロール（開発モード時のみ表示） */}
        {!isLoading && !error && !import.meta.env.VITE_FORGE_ENABLED && (
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            <button
              onClick={() => handleZoom(0.5)}
              className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-lg"
              title="ズームイン"
            >
              ➕
            </button>
            <div className="px-3 py-2 bg-white rounded-md shadow-lg text-center text-sm">
              {(zoomLevel * 100).toFixed(0)}%
            </div>
            <button
              onClick={() => handleZoom(-0.5)}
              className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-lg"
              title="ズームアウト"
            >
              ➖
            </button>
          </div>
        )}
        
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