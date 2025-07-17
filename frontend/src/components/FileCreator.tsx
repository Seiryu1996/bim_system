import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';

interface FileCreatorProps {
  onFileCreated: (file: File) => void;
  onClose: () => void;
}

interface ModelConfig {
  type: 'building' | 'room' | 'furniture';
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  material: string;
  color: string;
}

const FileCreator: React.FC<FileCreatorProps> = ({ onFileCreated, onClose }) => {
  const [config, setConfig] = useState<ModelConfig>({
    type: 'building',
    dimensions: { width: 10, height: 3, depth: 8 },
    material: 'concrete',
    color: '#cccccc'
  });

  // 材質に応じたデフォルト色
  const materialColors = {
    concrete: '#8d8d8d',
    steel: '#b8b8b8',
    wood: '#8b4513',
    glass: '#87ceeb',
    brick: '#b22222'
  };
  
  const previewRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);

  const modelTypes = [
    { value: 'building', label: '建物', icon: '🏢' },
    { value: 'room', label: '部屋', icon: '🏠' },
    { value: 'furniture', label: '家具', icon: '🪑' }
  ];

  const materials = [
    { value: 'concrete', label: 'コンクリート' },
    { value: 'steel', label: 'スチール' },
    { value: 'wood', label: '木材' },
    { value: 'glass', label: 'ガラス' },
    { value: 'brick', label: 'レンガ' }
  ];

  // プレビュー描画関数
  const updatePreview = () => {
    if (!previewRef.current || !showPreview) return;

    // 既存のコンテンツをクリア
    previewRef.current.innerHTML = '';

    // Three.jsシーンセットアップ
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 300 / 200, 0.1, 1000);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(300, 200);
    rendererRef.current = renderer;
    previewRef.current.appendChild(renderer.domElement);

    // ライティング
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);

    // モデルタイプごとに3Dオブジェクト作成
    const material = new THREE.MeshLambertMaterial({ color: config.color });
    let mainObject: THREE.Object3D;

    switch (config.type) {
      case 'building':
        // 建物：複数階構造
        mainObject = createBuildingModel(config, material);
        break;
      case 'room':
        // 部屋：空洞構造（壁のみ）
        mainObject = createRoomModel(config, material);
        break;
      case 'furniture':
        // 家具：椅子の形状
        mainObject = createFurnitureModel(config, material);
        break;
      default:
        mainObject = new THREE.Mesh(
          new THREE.BoxGeometry(
            config.dimensions.width / 5,
            config.dimensions.height / 5,
            config.dimensions.depth / 5
          ),
          material
        );
    }
    
    scene.add(mainObject);
    objectRef.current = mainObject;

    // カメラ位置設定（ズームレベル適用）
    const maxDim = Math.max(config.dimensions.width, config.dimensions.height, config.dimensions.depth);
    const distance = (maxDim / 2) / zoomLevel;
    camera.position.set(distance, distance, distance);
    camera.lookAt(0, 0, 0);

    // アニメーション
    const animate = () => {
      requestAnimationFrame(animate);
      if (mainObject) {
        mainObject.rotation.y += 0.01;
      }
      renderer.render(scene, camera);
    };
    animate();
  };

  // 建物モデル生成関数
  const createBuildingModel = (config: ModelConfig, material: THREE.Material) => {
    const group = new THREE.Group();
    const { width, height, depth } = config.dimensions;
    const scale = 1 / 5;
    
    // 複数階を表現（3階建て）
    const floors = 3;
    const floorHeight = (height / floors) * scale;
    
    for (let i = 0; i < floors; i++) {
      const floorGeometry = new THREE.BoxGeometry(width * scale, floorHeight, depth * scale);
      const floor = new THREE.Mesh(floorGeometry, material);
      floor.position.y = (i * floorHeight) - (height * scale / 2) + (floorHeight / 2);
      
      // 各階に少し異なるサイズ（上に行くほど小さく）
      const floorScale = 1 - (i * 0.1);
      floor.scale.set(floorScale, 1, floorScale);
      
      group.add(floor);
    }
    
    return group;
  };

  // 部屋モデル生成関数（空洞構造）
  const createRoomModel = (config: ModelConfig, material: THREE.Material) => {
    const group = new THREE.Group();
    const { width, height, depth } = config.dimensions;
    const scale = 1 / 5;
    const wallThickness = 0.2 * scale;
    
    // 床
    const floorGeometry = new THREE.BoxGeometry(width * scale, wallThickness, depth * scale);
    const floor = new THREE.Mesh(floorGeometry, material);
    floor.position.y = -(height * scale / 2);
    group.add(floor);
    
    // 天井
    const ceiling = new THREE.Mesh(floorGeometry, material);
    ceiling.position.y = (height * scale / 2) - wallThickness;
    group.add(ceiling);
    
    // 4つの壁
    const wallHeight = (height - wallThickness * 2) * scale;
    
    // 前壁・後壁
    const frontWallGeometry = new THREE.BoxGeometry(width * scale, wallHeight, wallThickness);
    const frontWall = new THREE.Mesh(frontWallGeometry, material);
    frontWall.position.z = (depth * scale / 2) - (wallThickness / 2);
    group.add(frontWall);
    
    const backWall = new THREE.Mesh(frontWallGeometry, material);
    backWall.position.z = -(depth * scale / 2) + (wallThickness / 2);
    group.add(backWall);
    
    // 左壁・右壁
    const sideWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, depth * scale);
    const leftWall = new THREE.Mesh(sideWallGeometry, material);
    leftWall.position.x = -(width * scale / 2) + (wallThickness / 2);
    group.add(leftWall);
    
    const rightWall = new THREE.Mesh(sideWallGeometry, material);
    rightWall.position.x = (width * scale / 2) - (wallThickness / 2);
    group.add(rightWall);
    
    return group;
  };

  // 家具モデル生成関数（椅子）
  const createFurnitureModel = (config: ModelConfig, material: THREE.Material) => {
    const group = new THREE.Group();
    const { width, height, depth } = config.dimensions;
    const scale = 1 / 5;
    
    // 座面
    const seatH = height * scale * 0.5; // 座面の高さ
    const seatThickness = height * scale * 0.05; // 座面の厚さ
    const seatGeometry = new THREE.BoxGeometry(width * scale, seatThickness, depth * scale * 0.8);
    const seat = new THREE.Mesh(seatGeometry, material);
    seat.position.y = seatH - (seatThickness / 2);
    group.add(seat);
    
    // 背もたれ
    const backHeight = height * scale * 0.4; // 背もたれの高さ
    const backThickness = depth * scale * 0.05; // 背もたれの厚さ
    const backrestGeometry = new THREE.BoxGeometry(width * scale, backHeight, backThickness);
    const backrest = new THREE.Mesh(backrestGeometry, material);
    backrest.position.z = -(depth * scale * 0.4);
    backrest.position.y = seatH + (backHeight / 2);
    group.add(backrest);
    
    // 4本の脚
    const legThickness = width * scale * 0.05; // 脚の太さ
    const legHeight = seatH - seatThickness; // 脚の高さ
    const legGeometry = new THREE.BoxGeometry(legThickness, legHeight, legThickness);
    
    const legPositions = [
      [-width * scale * 0.4, legHeight / 2, -depth * scale * 0.3],
      [width * scale * 0.4, legHeight / 2, -depth * scale * 0.3],
      [-width * scale * 0.4, legHeight / 2, depth * scale * 0.3],
      [width * scale * 0.4, legHeight / 2, depth * scale * 0.3]
    ];
    
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeometry, material);
      leg.position.set(x, y, z);
      group.add(leg);
    });
    
    return group;
  };

  // 材質変更時に色を自動設定
  const handleMaterialChange = (material: string) => {
    setConfig(prev => ({
      ...prev,
      material,
      color: materialColors[material as keyof typeof materialColors] || prev.color
    }));
  };

  // ズーム制御
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.5, Math.min(5, zoomLevel + delta));
    setZoomLevel(newZoom);
  };

  // ズームレベル変更時にカメラ位置更新
  useEffect(() => {
    if (cameraRef.current && rendererRef.current && sceneRef.current) {
      const maxDim = Math.max(config.dimensions.width, config.dimensions.height, config.dimensions.depth);
      const distance = (maxDim / 2) / zoomLevel;
      cameraRef.current.position.set(distance, distance, distance);
      cameraRef.current.lookAt(0, 0, 0);
    }
  }, [zoomLevel, config.dimensions]);

  // プレビュー更新
  useEffect(() => {
    if (showPreview) {
      setTimeout(updatePreview, 100); // DOMが準備されるまで少し待つ
    }
  }, [config, showPreview]);

  const generateOBJContent = (): string => {
    const { width, height, depth } = config.dimensions;
    const materialName = `${config.material}_material`;

    let objContent = `# ${config.type} model created by BIM System\n`;
    objContent += `# Material: ${config.material}\n`;
    objContent += `# Dimensions: ${width}x${height}x${depth}\n\n`;
    
    // マテリアルを使用する宣言
    objContent += `usemtl ${materialName}\n\n`;

    switch (config.type) {
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

  const generateBuildingOBJ = (width: number, height: number, depth: number): string => {
    const w = width / 2;
    const h = height;
    const d = depth / 2;

    let content = '';
    
    // 複数階の建物（3階建て）
    const floors = 3;
    const floorHeight = h / floors;
    
    for (let floor = 0; floor < floors; floor++) {
      const floorScale = 1 - (floor * 0.1); // 上に行くほど小さく
      const fw = w * floorScale;
      const fd = d * floorScale;
      const y1 = floor * floorHeight;
      const y2 = (floor + 1) * floorHeight;
      
      // 各階の8つの頂点
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
    
    // 各階の面
    for (let floor = 0; floor < floors; floor++) {
      const base = floor * 8 + 1; // OBJファイルの頂点インデックスは1から開始
      content += `f ${base} ${base + 1} ${base + 2} ${base + 3}\n`; // 底面
      content += `f ${base + 4} ${base + 7} ${base + 6} ${base + 5}\n`; // 上面
      content += `f ${base} ${base + 4} ${base + 5} ${base + 1}\n`; // 前面
      content += `f ${base + 2} ${base + 6} ${base + 7} ${base + 3}\n`; // 後面
      content += `f ${base} ${base + 3} ${base + 7} ${base + 4}\n`; // 左面
      content += `f ${base + 1} ${base + 5} ${base + 6} ${base + 2}\n`; // 右面
    }
    
    return content;
  };

  const generateRoomOBJ = (width: number, height: number, depth: number): string => {
    const w = width / 2;
    const h = height;
    const d = depth / 2;
    const wallThickness = 0.2;

    let content = '';
    
    // 床の4つの頂点
    content += `v -${w} 0 -${d}\n`;
    content += `v ${w} 0 -${d}\n`;
    content += `v ${w} 0 ${d}\n`;
    content += `v -${w} 0 ${d}\n`;
    
    // 天井の4つの頂点
    content += `v -${w} ${h} -${d}\n`;
    content += `v ${w} ${h} -${d}\n`;
    content += `v ${w} ${h} ${d}\n`;
    content += `v -${w} ${h} ${d}\n`;
    
    content += '\n';
    
    // 床と天井
    content += `f 1 2 3 4\n`; // 床
    content += `f 5 8 7 6\n`; // 天井
    
    // 壁（外側のみ、内側は空洞）
    content += `f 1 5 6 2\n`; // 前壁
    content += `f 3 7 8 4\n`; // 後壁
    content += `f 1 4 8 5\n`; // 左壁
    content += `f 2 6 7 3\n`; // 右壁
    
    return content;
  };

  const generateFurnitureOBJ = (width: number, height: number, depth: number): string => {
    let content = '';
    const w = width / 2;
    const h = height;
    const d = depth / 2;
    
    // 椅子の形状
    const seatH = h * 0.5; // 座面の高さ
    const seatThickness = h * 0.05; // 座面の厚さ
    const backHeight = h * 0.4; // 背もたれの高さ
    const backThickness = d * 0.05; // 背もたれの厚さ
    const legThickness = w * 0.05; // 脚の太さ
    
    // === 座面 ===
    // 座面下面
    content += `v -${w} ${seatH - seatThickness} -${d * 0.8}\n`; // 1
    content += `v ${w} ${seatH - seatThickness} -${d * 0.8}\n`; // 2
    content += `v ${w} ${seatH - seatThickness} ${d * 0.8}\n`; // 3
    content += `v -${w} ${seatH - seatThickness} ${d * 0.8}\n`; // 4
    
    // 座面上面
    content += `v -${w} ${seatH} -${d * 0.8}\n`; // 5
    content += `v ${w} ${seatH} -${d * 0.8}\n`; // 6
    content += `v ${w} ${seatH} ${d * 0.8}\n`; // 7
    content += `v -${w} ${seatH} ${d * 0.8}\n`; // 8
    
    // === 背もたれ ===
    // 背もたれ前面下
    content += `v -${w} ${seatH} -${d}\n`; // 9
    content += `v ${w} ${seatH} -${d}\n`; // 10
    
    // 背もたれ前面上
    content += `v -${w} ${seatH + backHeight} -${d}\n`; // 11
    content += `v ${w} ${seatH + backHeight} -${d}\n`; // 12
    
    // 背もたれ後面下
    content += `v -${w} ${seatH} -${d + backThickness}\n`; // 13
    content += `v ${w} ${seatH} -${d + backThickness}\n`; // 14
    
    // 背もたれ後面上
    content += `v -${w} ${seatH + backHeight} -${d + backThickness}\n`; // 15
    content += `v ${w} ${seatH + backHeight} -${d + backThickness}\n`; // 16
    
    // === 脚（4本） ===
    const legPositions = [
      [-w * 0.8, -d * 0.6], // 左前
      [w * 0.8, -d * 0.6],  // 右前
      [-w * 0.8, d * 0.6],  // 左後
      [w * 0.8, d * 0.6]    // 右後
    ];
    
    let vertexIndex = 17;
    legPositions.forEach(([x, z]) => {
      // 脚下面
      content += `v ${x - legThickness} 0 ${z - legThickness}\n`; // 下面1
      content += `v ${x + legThickness} 0 ${z - legThickness}\n`; // 下面2
      content += `v ${x + legThickness} 0 ${z + legThickness}\n`; // 下面3
      content += `v ${x - legThickness} 0 ${z + legThickness}\n`; // 下面4
      
      // 脚上面
      content += `v ${x - legThickness} ${seatH - seatThickness} ${z - legThickness}\n`; // 上面1
      content += `v ${x + legThickness} ${seatH - seatThickness} ${z - legThickness}\n`; // 上面2
      content += `v ${x + legThickness} ${seatH - seatThickness} ${z + legThickness}\n`; // 上面3
      content += `v ${x - legThickness} ${seatH - seatThickness} ${z + legThickness}\n`; // 上面4
      
      vertexIndex += 8;
    });
    
    content += '\n';
    
    // === 面の定義 ===
    // 座面
    content += `f 1 2 3 4\n`; // 座面下
    content += `f 5 8 7 6\n`; // 座面上
    content += `f 1 5 6 2\n`; // 座面前
    content += `f 3 7 8 4\n`; // 座面後
    content += `f 1 4 8 5\n`; // 座面左
    content += `f 2 6 7 3\n`; // 座面右
    
    // 背もたれ
    content += `f 9 10 12 11\n`; // 背もたれ前面
    content += `f 13 16 14 15\n`; // 背もたれ後面（修正）
    content += `f 9 11 15 13\n`; // 背もたれ左面
    content += `f 10 14 16 12\n`; // 背もたれ右面
    content += `f 11 12 16 15\n`; // 背もたれ上面
    
    // 脚
    let faceIndex = 17;
    for (let i = 0; i < 4; i++) {
      const base = faceIndex + i * 8;
      content += `f ${base} ${base + 1} ${base + 2} ${base + 3}\n`; // 脚下面
      content += `f ${base + 4} ${base + 7} ${base + 6} ${base + 5}\n`; // 脚上面
      content += `f ${base} ${base + 4} ${base + 5} ${base + 1}\n`; // 脚前面
      content += `f ${base + 2} ${base + 6} ${base + 7} ${base + 3}\n`; // 脚後面
      content += `f ${base} ${base + 3} ${base + 7} ${base + 4}\n`; // 脚左面
      content += `f ${base + 1} ${base + 5} ${base + 6} ${base + 2}\n`; // 脚右面
    }
    
    return content;
  };

  const generateSimpleBoxOBJ = (width: number, height: number, depth: number): string => {
    const w = width / 2;
    const h = height;
    const d = depth / 2;

    let content = '';
    
    // 建物（立方体）
    content += `v -${w} 0 -${d}\n`;
    content += `v ${w} 0 -${d}\n`;
    content += `v ${w} 0 ${d}\n`;
    content += `v -${w} 0 ${d}\n`;
    content += `v -${w} ${h} -${d}\n`;
    content += `v ${w} ${h} -${d}\n`;
    content += `v ${w} ${h} ${d}\n`;
    content += `v -${w} ${h} ${d}\n\n`;

    content += `f 1 2 3 4\n`; // 底面
    content += `f 5 8 7 6\n`; // 上面
    content += `f 1 5 6 2\n`; // 前面
    content += `f 3 7 8 4\n`; // 後面
    content += `f 1 4 8 5\n`; // 左面
    content += `f 2 6 7 3\n`; // 右面
    
    return content;
  };

  // MTLファイル内容を生成
  const generateMTLContent = (): string => {
    const materialName = `${config.material}_material`;
    
    let mtlContent = `# MTL file created by BIM System\n`;
    mtlContent += `# Material: ${config.material}\n\n`;
    
    mtlContent += `newmtl ${materialName}\n`;
    mtlContent += `Ka 0.2 0.2 0.2\n`; // アンビエント色
    mtlContent += `Kd ${hexToRgb(config.color)}\n`; // ディフューズ色（メインカラー）
    mtlContent += `Ks 0.8 0.8 0.8\n`; // スペキュラー色
    mtlContent += `Ns 100.0\n`; // スペキュラー指数
    
    // 材質に応じた追加プロパティ
    switch (config.material) {
      case 'glass':
        mtlContent += `d 0.7\n`; // 透明度
        mtlContent += `Tr 0.3\n`; // 透過率
        break;
      case 'steel':
        mtlContent += `Ks 0.9 0.9 0.9\n`; // 高反射
        mtlContent += `Ns 200.0\n`; // 高スペキュラー
        break;
      case 'wood':
        mtlContent += `Ns 50.0\n`; // 低スペキュラー
        break;
    }
    
    return mtlContent;
  };

  // HEX色をRGB文字列に変換
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16) / 255;
      const g = parseInt(result[2], 16) / 255;
      const b = parseInt(result[3], 16) / 255;
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
    }
    return '0.5 0.5 0.5'; // デフォルト色
  };

  const createFile = async () => {
    const objContent = generateOBJContent();
    const mtlContent = generateMTLContent();
    const baseName = `${config.type}_${config.dimensions.width}x${config.dimensions.height}x${config.dimensions.depth}`;
    
    // OBJファイルにMTLファイル参照を追加
    const objWithMtl = `mtllib ${baseName}.mtl\n${objContent}`;
    
    // まずOBJファイルを作成
    const objFile = new File([objWithMtl], `${baseName}.obj`, { type: 'text/plain' });
    
    // 次にMTLファイルを作成してアップロード
    const mtlFile = new File([mtlContent], `${baseName}.mtl`, { type: 'text/plain' });
    
    // MTLファイルを先にアップロード
    try {
      await uploadMTLFile(mtlFile);
      // MTLアップロード成功後、OBJファイルを処理
      onFileCreated(objFile);
    } catch (error) {
      // MTLファイルのアップロードが失敗してもOBJファイルは作成
      onFileCreated(objFile);
    }
  };

  // MTLファイルをアップロード
  const uploadMTLFile = async (mtlFile: File) => {
    const formData = new FormData();
    formData.append('file', mtlFile);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/api/forge/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('MTL file upload failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">3Dモデルファイルを作成</h2>
        
        {/* モデルタイプ選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">モデルタイプ</label>
          <div className="grid grid-cols-3 gap-2">
            {modelTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setConfig(prev => ({ ...prev, type: type.value as any }))}
                className={`p-3 border rounded-md text-center transition-colors ${
                  config.type === type.value
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                }`}
              >
                <div className="text-lg">{type.icon}</div>
                <div className="text-xs mt-1">{type.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 寸法設定 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">寸法 (メートル)</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-600">幅</label>
              <input
                type="number"
                value={config.dimensions.width}
                onChange={(e) => setConfig(prev => ({
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
                value={config.dimensions.height}
                onChange={(e) => setConfig(prev => ({
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
                value={config.dimensions.depth}
                onChange={(e) => setConfig(prev => ({
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
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">材質</label>
          <select
            value={config.material}
            onChange={(e) => handleMaterialChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            {materials.map((material) => (
              <option key={material.value} value={material.value}>
                {material.label}
              </option>
            ))}
          </select>
        </div>

        {/* 色選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">色</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={config.color}
              onChange={(e) => setConfig(prev => ({ ...prev, color: e.target.value }))}
              className="w-12 h-8 border rounded"
            />
            <input
              type="text"
              value={config.color}
              onChange={(e) => setConfig(prev => ({ ...prev, color: e.target.value }))}
              className="flex-1 px-3 py-1 border rounded text-sm"
              placeholder="#cccccc"
            />
          </div>
        </div>

        {/* プレビューボタン */}
        <div className="mb-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
          >
            {showPreview ? '3Dプレビューを非表示' : '3Dプレビューを表示'}
          </button>
        </div>

        {/* 3Dプレビュー */}
        {showPreview && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">3Dプレビュー:</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => handleZoom(-0.5)}
                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  title="ズームアウト"
                >
                  ➖
                </button>
                <span className="px-2 py-1 text-xs bg-white rounded border">
                  {(zoomLevel * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => handleZoom(0.5)}
                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  title="ズームイン"
                >
                  ➕
                </button>
              </div>
            </div>
            <div 
              ref={previewRef}
              className="w-full h-48 bg-white border rounded flex items-center justify-center"
              style={{ minHeight: '200px' }}
            >
              <span className="text-gray-500">プレビュー読み込み中...</span>
            </div>
          </div>
        )}

        {/* プレビュー情報 */}
        <div className="mb-6 p-3 bg-gray-50 rounded">
          <h3 className="text-sm font-medium mb-2">作成されるファイル:</h3>
          <p className="text-sm text-gray-600">
            ファイル名: {config.type}_{config.dimensions.width}x{config.dimensions.height}x{config.dimensions.depth}.obj
          </p>
          <p className="text-sm text-gray-600">
            形式: OBJ (Wavefront 3D)
          </p>
          <p className="text-sm text-gray-600">
            材質: {materials.find(m => m.value === config.material)?.label}
          </p>
        </div>

        {/* ボタン */}
        <div className="flex gap-2">
          <button
            onClick={createFile}
            className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors"
          >
            ファイルを作成
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileCreator;