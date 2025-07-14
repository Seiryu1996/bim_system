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

const ForgeViewer: React.FC<ForgeViewerProps> = ({ fileId, projectId }) => {
  const dispatch = useDispatch();
  const { selectedObject, objectProperties } = useSelector((state: RootState) => state.project);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeViewer();
    return () => {
      if (viewer) {
        viewer.finish();
      }
    };
  }, [fileId]);

  const initializeViewer = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await forgeService.getForgeViewerToken();
      
      if (!viewerRef.current) return;

      const options = {
        env: 'AutodeskProduction',
        getAccessToken: (callback: (token: string, expire: number) => void) => {
          callback(token, 3600);
        }
      };

      window.Autodesk.Viewing.Initializer(options, () => {
        const viewerDiv = viewerRef.current;
        if (!viewerDiv) return;

        const viewerConfig = {
          extensions: ['Autodesk.DocumentBrowser']
        };

        const newViewer = new window.Autodesk.Viewing.GuiViewer3D(viewerDiv, viewerConfig);
        
        newViewer.start();
        setViewer(newViewer);

        const documentId = `urn:${fileId}`;
        
        window.Autodesk.Viewing.Document.load(documentId, (doc: any) => {
          const viewables = doc.getRoot().getDefaultGeometry();
          newViewer.loadDocumentNode(doc, viewables).then(() => {
            setIsLoading(false);
            setupEventListeners(newViewer);
          });
        }, (error: any) => {
          setError('Failed to load document: ' + error.message);
          setIsLoading(false);
        });
      });
    } catch (err: any) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">3Dモデルを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">エラー: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1">
        <div 
          ref={viewerRef} 
          className="w-full h-full"
          style={{ minHeight: '500px' }}
        />
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