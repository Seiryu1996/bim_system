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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerContainer, setViewerContainer] = useState<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  
  // モデル編集関連の状態
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [modelConfig, setModelConfig] = useState({
    type: 'building',
    dimensions: { width: 10, height: 3, depth: 8 },
    material: 'concrete',
    color: '#8d8d8d'
  });
  
  // プロジェクト編集特有の状態
  const [projectInfo, setProjectInfo] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    lastModified: new Date()
  });
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [newTag, setNewTag] = useState('');

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

  /**
   * モデル編集パネルのトグル
   */
  const toggleEditPanel = () => {
    setShowEditPanel(!showEditPanel);
    if (!showEditPanel) {
      // 編集パネルを開く時に現在のモデル情報を取得
      loadCurrentModelConfig();
    }
  };

  /**
   * 現在のモデル設定を読み込み
   */
  const loadCurrentModelConfig = async () => {
    try {
      // プロジェクト情報からモデル設定を取得
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const project = data.project;
        
        // プロジェクト情報を設定
        setProjectInfo({
          name: project.name || '',
          description: project.description || '',
          tags: [], // TODO: バックエンドからタグ情報を取得
          lastModified: new Date(project.updated_at)
        });
        
        // ファイル名から設定を推測（例: building_10x3x8_1234567890.obj）
        const filename = project.file_id || '';
        const match = filename.match(/([^_]+)_(\d+)x(\d+)x(\d+)/);
        if (match) {
          setModelConfig({
            type: match[1] as any,
            dimensions: {
              width: parseInt(match[2]),
              height: parseInt(match[3]),
              depth: parseInt(match[4])
            },
            material: 'concrete', // デフォルト
            color: '#8d8d8d' // デフォルト
          });
        }
      }
    } catch (error) {
      // エラー時はデフォルト設定を使用
    }
  };

  /**
   * 編集履歴に追加
   */
  const addToEditHistory = (action: string, details: any) => {
    const historyEntry = {
      id: Date.now(),
      action,
      details,
      timestamp: new Date(),
      modelConfig: { ...modelConfig }
    };
    setEditHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // 最新10件まで保持
  };

  /**
   * タグを追加
   */
  const addTag = () => {
    if (newTag.trim() && !projectInfo.tags.includes(newTag.trim())) {
      setProjectInfo(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  /**
   * タグを削除
   */
  const removeTag = (tag: string) => {
    setProjectInfo(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  /**
   * モデル設定の保存（新しいモデルを生成）
   */
  const saveModelChanges = async () => {
    try {
      setIsLoading(true);
      
      // 編集履歴に追加
      addToEditHistory('モデル更新', {
        type: modelConfig.type,
        dimensions: modelConfig.dimensions,
        material: modelConfig.material,
        color: modelConfig.color
      });
      
      // OBJファイル内容を生成
      const objContent = generateUpdatedOBJContent();
      const mtlContent = generateUpdatedMTLContent();
      const baseName = `${modelConfig.type}_${modelConfig.dimensions.width}x${modelConfig.dimensions.height}x${modelConfig.dimensions.depth}_${Date.now()}`;
      
      // OBJファイルを作成
      const objFile = new File([`mtllib ${baseName}.mtl\n${objContent}`], `${baseName}.obj`, { type: 'text/plain' });
      const mtlFile = new File([mtlContent], `${baseName}.mtl`, { type: 'text/plain' });
      
      // ファイルをアップロード
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');
      
      // MTLファイルをアップロード
      const mtlFormData = new FormData();
      mtlFormData.append('file', mtlFile);
      
      await fetch(`${API_URL}/api/forge/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: mtlFormData,
      });
      
      // OBJファイルをアップロード
      const objFormData = new FormData();
      objFormData.append('file', objFile);
      
      const response = await fetch(`${API_URL}/api/forge/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: objFormData,
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // プロジェクトのfile_idを更新
        const updateResponse = await fetch(`${API_URL}/api/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            file_id: result.urn
          }),
        });
        
        if (updateResponse.ok) {
          // 3Dビューを更新
          window.location.reload(); // 簡易的な更新（後で最適化可能）
        }
      }
    } catch (error) {
      setError('モデルの保存に失敗しました');
    } finally {
      setIsLoading(false);
      setShowEditPanel(false);
    }
  };

  /**
   * 更新されたOBJファイル内容を生成
   */
  const generateUpdatedOBJContent = (): string => {
    const { width, height, depth } = modelConfig.dimensions;
    const materialName = `${modelConfig.material}_material`;

    let objContent = `# ${modelConfig.type} model updated\n`;
    objContent += `# Material: ${modelConfig.material}\n`;
    objContent += `# Dimensions: ${width}x${height}x${depth}\n\n`;
    objContent += `usemtl ${materialName}\n\n`;

    switch (modelConfig.type) {
      case 'building':
        objContent += generateBuildingOBJ(width, height, depth);
        break;
      case 'room':
        objContent += generateRoomOBJ(width, height, depth);
        break;
      case 'furniture':
        objContent += generateFurnitureOBJ(width, height, depth);
        break;
      default:
        objContent += generateSimpleBoxOBJ(width, height, depth);
    }

    return objContent;
  };

  /**
   * 更新されたMTLファイル内容を生成
   */
  const generateUpdatedMTLContent = (): string => {
    const materialName = `${modelConfig.material}_material`;
    
    let mtlContent = `# MTL file updated\n`;
    mtlContent += `# Material: ${modelConfig.material}\n\n`;
    
    mtlContent += `newmtl ${materialName}\n`;
    mtlContent += `Ka 0.2 0.2 0.2\n`;
    mtlContent += `Kd ${hexToRgb(modelConfig.color)}\n`;
    mtlContent += `Ks 0.8 0.8 0.8\n`;
    mtlContent += `Ns 100.0\n`;
    
    switch (modelConfig.material) {
      case 'glass':
        mtlContent += `d 0.7\n`;
        mtlContent += `Tr 0.3\n`;
        break;
      case 'steel':
        mtlContent += `Ks 0.9 0.9 0.9\n`;
        mtlContent += `Ns 200.0\n`;
        break;
      case 'wood':
        mtlContent += `Ns 50.0\n`;
        break;
    }
    
    return mtlContent;
  };

  /**
   * HEX色をRGB文字列に変換
   */
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16) / 255;
      const g = parseInt(result[2], 16) / 255;
      const b = parseInt(result[3], 16) / 255;
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
    }
    return '0.5 0.5 0.5';
  };

  // 簡易的なOBJ生成関数（実際のFileCreatorから必要な部分を移植）
  const generateBuildingOBJ = (width: number, height: number, depth: number): string => {
    const w = width / 2;
    const h = height;
    const d = depth / 2;

    let content = '';
    const floors = 3;
    const floorHeight = h / floors;
    
    for (let floor = 0; floor < floors; floor++) {
      const floorScale = 1 - (floor * 0.1);
      const fw = w * floorScale;
      const fd = d * floorScale;
      const y1 = floor * floorHeight;
      const y2 = (floor + 1) * floorHeight;
      
      content += `v -${fw} ${y1} -${fd}\n`;
      content += `v ${fw} ${y1} -${fd}\n`;
      content += `v ${fw} ${y1} ${fd}\n`;
      content += `v -${fw} ${y1} ${fd}\n`;
      content += `v -${fw} ${y2} -${fd}\n`;
      content += `v ${fw} ${y2} -${fd}\n`;
      content += `v ${fw} ${y2} ${fd}\n`;
      content += `v -${fw} ${y2} ${fd}\n`;
    }
    
    content += '\n';
    
    for (let floor = 0; floor < floors; floor++) {
      const base = floor * 8 + 1;
      content += `f ${base} ${base + 1} ${base + 2} ${base + 3}\n`;
      content += `f ${base + 4} ${base + 7} ${base + 6} ${base + 5}\n`;
      content += `f ${base} ${base + 4} ${base + 5} ${base + 1}\n`;
      content += `f ${base + 2} ${base + 6} ${base + 7} ${base + 3}\n`;
      content += `f ${base} ${base + 3} ${base + 7} ${base + 4}\n`;
      content += `f ${base + 1} ${base + 5} ${base + 6} ${base + 2}\n`;
    }
    
    return content;
  };

  const generateRoomOBJ = (width: number, height: number, depth: number): string => {
    const w = width / 2;
    const h = height;
    const d = depth / 2;

    let content = '';
    
    content += `v -${w} 0 -${d}\n`;
    content += `v ${w} 0 -${d}\n`;
    content += `v ${w} 0 ${d}\n`;
    content += `v -${w} 0 ${d}\n`;
    content += `v -${w} ${h} -${d}\n`;
    content += `v ${w} ${h} -${d}\n`;
    content += `v ${w} ${h} ${d}\n`;
    content += `v -${w} ${h} ${d}\n`;
    
    content += '\n';
    
    content += `f 1 2 3 4\n`;
    content += `f 5 8 7 6\n`;
    content += `f 1 5 6 2\n`;
    content += `f 3 7 8 4\n`;
    content += `f 1 4 8 5\n`;
    content += `f 2 6 7 3\n`;
    
    return content;
  };

  const generateFurnitureOBJ = (width: number, height: number, depth: number): string => {
    const w = width / 2;
    const h = height;
    const d = depth / 2;
    
    let content = '';
    const seatH = h * 0.5;
    const seatThickness = h * 0.05;
    
    // 座面
    content += `v -${w} ${seatH - seatThickness} -${d * 0.8}\n`;
    content += `v ${w} ${seatH - seatThickness} -${d * 0.8}\n`;
    content += `v ${w} ${seatH - seatThickness} ${d * 0.8}\n`;
    content += `v -${w} ${seatH - seatThickness} ${d * 0.8}\n`;
    content += `v -${w} ${seatH} -${d * 0.8}\n`;
    content += `v ${w} ${seatH} -${d * 0.8}\n`;
    content += `v ${w} ${seatH} ${d * 0.8}\n`;
    content += `v -${w} ${seatH} ${d * 0.8}\n`;
    
    content += '\n';
    content += `f 1 2 3 4\n`;
    content += `f 5 8 7 6\n`;
    content += `f 1 5 6 2\n`;
    content += `f 3 7 8 4\n`;
    content += `f 1 4 8 5\n`;
    content += `f 2 6 7 3\n`;
    
    return content;
  };

  const generateSimpleBoxOBJ = (width: number, height: number, depth: number): string => {
    const w = width / 2;
    const h = height;
    const d = depth / 2;

    let content = '';
    
    content += `v -${w} 0 -${d}\n`;
    content += `v ${w} 0 -${d}\n`;
    content += `v ${w} 0 ${d}\n`;
    content += `v -${w} 0 ${d}\n`;
    content += `v -${w} ${h} -${d}\n`;
    content += `v ${w} ${h} -${d}\n`;
    content += `v ${w} ${h} ${d}\n`;
    content += `v -${w} ${h} ${d}\n\n`;

    content += `f 1 2 3 4\n`;
    content += `f 5 8 7 6\n`;
    content += `f 1 5 6 2\n`;
    content += `f 3 7 8 4\n`;
    content += `f 1 4 8 5\n`;
    content += `f 2 6 7 3\n`;
    
    return content;
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

        {/* モデル編集ボタン */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          <button
            onClick={toggleEditPanel}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow-lg"
            title="モデルを編集"
          >
            🔧 編集
          </button>
        </div>
        
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
      
      {/* モデル編集パネル */}
      {showEditPanel && (
        <div className="w-96 p-4 border-l bg-white shadow-lg overflow-y-auto max-h-screen">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">プロジェクト編集</h3>
            <button
              onClick={() => setShowEditPanel(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* タブ切り替え */}
          <div className="flex mb-4 border-b">
            <button
              onClick={() => setEditMode(false)}
              className={`px-4 py-2 text-sm font-medium ${!editMode ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              プロジェクト情報
            </button>
            <button
              onClick={() => setEditMode(true)}
              className={`px-4 py-2 text-sm font-medium ${editMode ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              3Dモデル編集
            </button>
          </div>

          {!editMode ? (
            /* プロジェクト情報編集 */
            <div className="space-y-4">
              {/* プロジェクト名 */}
              <div>
                <label className="block text-sm font-medium mb-2">プロジェクト名</label>
                <input
                  type="text"
                  value={projectInfo.name}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="プロジェクト名を入力"
                />
              </div>

              {/* プロジェクト説明 */}
              <div>
                <label className="block text-sm font-medium mb-2">説明</label>
                <textarea
                  value={projectInfo.description}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="プロジェクトの説明を入力"
                />
              </div>

              {/* タグ管理 */}
              <div>
                <label className="block text-sm font-medium mb-2">タグ</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
                    placeholder="新しいタグを入力"
                  />
                  <button
                    onClick={addTag}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                  >
                    追加
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {projectInfo.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-gray-500 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* 編集履歴 */}
              <div>
                <label className="block text-sm font-medium mb-2">編集履歴</label>
                <div className="max-h-32 overflow-y-auto border rounded-md">
                  {editHistory.length > 0 ? (
                    editHistory.map((entry) => (
                      <div key={entry.id} className="p-2 border-b border-gray-100 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{entry.action}</span>
                          <span className="text-gray-500">{entry.timestamp.toLocaleString()}</span>
                        </div>
                        <div className="text-gray-600 mt-1">
                          {JSON.stringify(entry.details, null, 2)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-gray-500 text-center">編集履歴がありません</div>
                  )}
                </div>
              </div>

              {/* プロジェクト情報保存ボタン */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={async () => {
                    try {
                      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
                      const token = localStorage.getItem('token');
                      
                      const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          name: projectInfo.name,
                          description: projectInfo.description,
                          file_id: fileId // 既存のfile_idを保持
                        }),
                      });

                      if (response.ok) {
                        addToEditHistory('プロジェクト情報更新', {
                          name: projectInfo.name,
                          description: projectInfo.description,
                          tags: projectInfo.tags
                        });
                        alert('プロジェクト情報が更新されました');
                      } else {
                        alert('プロジェクト情報の更新に失敗しました');
                      }
                    } catch (error) {
                      alert('プロジェクト情報の更新中にエラーが発生しました');
                    }
                  }}
                  className="flex-1 bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
                >
                  プロジェクト情報を保存
                </button>
              </div>
            </div>
          ) : (
            /* 3Dモデル編集 */
            <div className="space-y-4">
              {/* モデルタイプ選択 */}
              <div>
                <label className="block text-sm font-medium mb-2">モデルタイプ</label>
                <select
                  value={modelConfig.type}
                  onChange={(e) => setModelConfig(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="building">🏢 建物</option>
                  <option value="room">🏠 部屋</option>
                  <option value="furniture">🪑 家具</option>
                </select>
              </div>

              {/* 寸法設定 */}
              <div>
                <label className="block text-sm font-medium mb-2">寸法 (メートル)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">幅</label>
                    <input
                      type="number"
                      value={modelConfig.dimensions.width}
                      onChange={(e) => setModelConfig(prev => ({
                        ...prev,
                        dimensions: { ...prev.dimensions, width: Number(e.target.value) }
                      }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">高さ</label>
                    <input
                      type="number"
                      value={modelConfig.dimensions.height}
                      onChange={(e) => setModelConfig(prev => ({
                        ...prev,
                        dimensions: { ...prev.dimensions, height: Number(e.target.value) }
                      }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">奥行</label>
                    <input
                      type="number"
                      value={modelConfig.dimensions.depth}
                      onChange={(e) => setModelConfig(prev => ({
                        ...prev,
                        dimensions: { ...prev.dimensions, depth: Number(e.target.value) }
                      }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>

              {/* 材質選択 */}
              <div>
                <label className="block text-sm font-medium mb-2">材質</label>
                <select
                  value={modelConfig.material}
                  onChange={(e) => setModelConfig(prev => ({ 
                    ...prev, 
                    material: e.target.value,
                    color: e.target.value === 'concrete' ? '#8d8d8d' : 
                           e.target.value === 'steel' ? '#b8b8b8' :
                           e.target.value === 'wood' ? '#8b4513' :
                           e.target.value === 'glass' ? '#87ceeb' :
                           e.target.value === 'brick' ? '#b22222' : prev.color
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="concrete">コンクリート</option>
                  <option value="steel">スチール</option>
                  <option value="wood">木材</option>
                  <option value="glass">ガラス</option>
                  <option value="brick">レンガ</option>
                </select>
              </div>

              {/* 色選択 */}
              <div>
                <label className="block text-sm font-medium mb-2">色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={modelConfig.color}
                    onChange={(e) => setModelConfig(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-8 border rounded"
                  />
                  <input
                    type="text"
                    value={modelConfig.color}
                    onChange={(e) => setModelConfig(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1 px-3 py-1 border rounded text-sm"
                    placeholder="#8d8d8d"
                  />
                </div>
              </div>

              {/* プレビューボタン */}
              <div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full bg-purple-500 text-white py-2 rounded-md hover:bg-purple-600 transition-colors"
                >
                  {showPreview ? 'プレビューを非表示' : 'プレビューを表示'}
                </button>
              </div>

              {/* 3Dモデル保存ボタン */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={saveModelChanges}
                  disabled={isLoading}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                >
                  {isLoading ? '保存中...' : '3Dモデルを更新'}
                </button>
                <button
                  onClick={() => setShowEditPanel(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* オブジェクトプロパティパネル */}
      {selectedObject && !showEditPanel && (
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