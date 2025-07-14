import React, { useState } from 'react';

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

  const generateOBJContent = (): string => {
    const { width, height, depth } = config.dimensions;
    const w = width / 2;
    const h = height;
    const d = depth / 2;

    let objContent = `# ${config.type} model created by BIM System\n`;
    objContent += `# Material: ${config.material}\n`;
    objContent += `# Dimensions: ${width}x${height}x${depth}\n\n`;

    if (config.type === 'building') {
      // 建物（立方体）
      objContent += `v -${w} 0 -${d}\n`;
      objContent += `v ${w} 0 -${d}\n`;
      objContent += `v ${w} 0 ${d}\n`;
      objContent += `v -${w} 0 ${d}\n`;
      objContent += `v -${w} ${h} -${d}\n`;
      objContent += `v ${w} ${h} -${d}\n`;
      objContent += `v ${w} ${h} ${d}\n`;
      objContent += `v -${w} ${h} ${d}\n\n`;

      objContent += `f 1 2 3 4\n`; // 底面
      objContent += `f 5 8 7 6\n`; // 上面
      objContent += `f 1 5 6 2\n`; // 前面
      objContent += `f 3 7 8 4\n`; // 後面
      objContent += `f 1 4 8 5\n`; // 左面
      objContent += `f 2 6 7 3\n`; // 右面

    } else if (config.type === 'room') {
      // 部屋（壁のある立方体）
      const wallThickness = 0.2;
      const wt = wallThickness;
      
      // 外壁
      objContent += `v -${w} 0 -${d}\nv ${w} 0 -${d}\nv ${w} 0 ${d}\nv -${w} 0 ${d}\n`;
      objContent += `v -${w} ${h} -${d}\nv ${w} ${h} -${d}\nv ${w} ${h} ${d}\nv -${w} ${h} ${d}\n`;
      
      // 内壁
      objContent += `v -${w-wt} 0 -${d-wt}\nv ${w-wt} 0 -${d-wt}\nv ${w-wt} 0 ${d-wt}\nv -${w-wt} 0 ${d-wt}\n`;
      objContent += `v -${w-wt} ${h} -${d-wt}\nv ${w-wt} ${h} -${d-wt}\nv ${w-wt} ${h} ${d-wt}\nv -${w-wt} ${h} ${d-wt}\n\n`;

      // 面を定義（壁のみ、床は除外）
      objContent += `f 1 5 6 2\nf 3 7 8 4\nf 1 4 8 5\nf 2 6 7 3\n`; // 外壁
      objContent += `f 13 14 10 9\nf 15 16 12 11\nf 13 9 12 16\nf 14 15 11 10\n`; // 内壁

    } else if (config.type === 'furniture') {
      // 家具（テーブル）
      const legHeight = h * 0.8;
      const topThickness = h * 0.1;
      const legWidth = w * 0.1;
      
      // テーブル天板
      objContent += `v -${w} ${legHeight} -${d}\nv ${w} ${legHeight} -${d}\nv ${w} ${legHeight} ${d}\nv -${w} ${legHeight} ${d}\n`;
      objContent += `v -${w} ${h} -${d}\nv ${w} ${h} -${d}\nv ${w} ${h} ${d}\nv -${w} ${h} ${d}\n`;
      
      objContent += `f 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 3 7 8 4\nf 1 4 8 5\nf 2 6 7 3\n`;
    }

    return objContent;
  };

  const createFile = () => {
    const objContent = generateOBJContent();
    const fileName = `${config.type}_${config.dimensions.width}x${config.dimensions.height}x${config.dimensions.depth}.obj`;
    const file = new File([objContent], fileName, { type: 'text/plain' });
    onFileCreated(file);
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
            onChange={(e) => setConfig(prev => ({ ...prev, material: e.target.value }))}
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