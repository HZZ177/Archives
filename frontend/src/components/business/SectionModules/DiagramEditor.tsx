import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { Button, message, Modal } from 'antd';
import { ZoomInOutlined } from '@ant-design/icons';
import { getDiagram } from '../../../apis/moduleService';
import { DiagramData } from '../../../types/diagram';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

interface DiagramEditorProps {
  moduleId: number;
  isEditable?: boolean;
}

// 定义父组件调用的接口
export interface DiagramEditorHandle {
  getDiagramData: () => DiagramData | null;
}

const DiagramEditor = forwardRef<DiagramEditorHandle, DiagramEditorProps>(({
  moduleId,
  isEditable = true,
}, ref) => {
  const [initialData, setInitialData] = useState<DiagramData | null>(null);
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const excalApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const previewApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  // 加载流程图数据
  useEffect(() => {
    loadDiagramData();
  }, [moduleId]);

  // 处理滚轮缩放（使用原生WheelEvent）
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    // 根据事件来源选择正确的 API ref
    const api = event.currentTarget === previewContainerRef.current ? previewApiRef.current : excalApiRef.current;
    if (!api) return;
    const elements = api.getSceneElementsIncludingDeleted();
    const state = api.getAppState();
    const scaleFactor = 1.1;
    const newZoom = state.zoom.value * (event.deltaY < 0 ? scaleFactor : 1 / scaleFactor);
    const newState = { ...state, zoom: { value: newZoom as any } };
    api.updateScene({ elements, appState: newState });
  }, []);

  // 为容器绑定非被动wheel事件监听器
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // 为预览容器绑定非被动wheel事件监听器
  useEffect(() => {
    const el = previewContainerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel, previewVisible]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    getDiagramData: () => diagramData,
  }));

  const loadDiagramData = async () => {
    try {
      const response = await getDiagram(moduleId);
      const diagramRes = response.data;
      if (diagramRes && diagramRes.diagram_data) {
        // 规范化 state.collaborators 为数组，避免内部组件 forEach 调用错误
        const rawData = diagramRes.diagram_data;
        const elements = rawData.elements;
        const rawState = rawData.state || {};
        let normalizedCollaborators: any[] = [];
        if (
          rawState.collaborators &&
          typeof rawState.collaborators === 'object' &&
          !Array.isArray(rawState.collaborators)
        ) {
          normalizedCollaborators = Object.values(rawState.collaborators);
        }
        const normalizedState = { ...rawState, collaborators: normalizedCollaborators };
        // 包含接口返回的版本号，以便Key变化时重置画布
        const dataWithVersion: DiagramData = {
          elements,
          state: normalizedState,
          version: diagramRes.version
        };
        setInitialData(dataWithVersion);
        setDiagramData(dataWithVersion);
      }
    } catch (error) {
      console.error('加载流程图失败:', error);
      message.error('加载流程图失败');
    }
  };

  // 同步预览画布数据
  const syncPreviewData = useCallback(() => {
    if (previewApiRef.current && diagramData) {
      previewApiRef.current.updateScene({
        elements: diagramData.elements,
        appState: diagramData.state
      });
    }
  }, [diagramData]);

  // 同步主画布数据
  const syncMainData = useCallback(() => {
    if (excalApiRef.current && diagramData) {
      excalApiRef.current.updateScene({
        elements: diagramData.elements,
        appState: diagramData.state
      });
    }
  }, [diagramData]);

  // 处理弹窗打开
  const handlePreviewOpen = useCallback(() => {
    setPreviewVisible(true);
    // 在弹窗打开时同步数据到预览画布
    setTimeout(syncPreviewData, 100);
  }, [syncPreviewData]);

  // 处理弹窗关闭
  const handlePreviewClose = useCallback(() => {
    // 在弹窗关闭时同步数据到主画布
    if (previewApiRef.current) {
      const elements = previewApiRef.current.getSceneElementsIncludingDeleted();
      const state = previewApiRef.current.getAppState();
      setDiagramData({ elements, state });
      setTimeout(syncMainData, 100);
    }
    setPreviewVisible(false);
  }, [syncMainData]);

  // 处理画布变化
  const handleChange = useCallback((elements: any, state: any) => {
    const newData: DiagramData = { elements, state };
    setDiagramData(newData);
  }, []);

  // Excalidraw API 引用
  const onExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI | null) => {
    excalApiRef.current = api;
  }, []);

  // 预览画布的 API 引用
  const onPreviewExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI | null) => {
    previewApiRef.current = api;
  }, []);

  // 缓存 UIOptions，避免每次渲染都新建对象
  const uiOptions = useMemo(() => ({
    canvasActions: {
      export: { saveFileToDisk: true },
      loadScene: false,
      clearCanvas: false,
      changeViewBackgroundColor: false,
      toggleTheme: false,
    }
  }), []);

  // 缓存 MainMenu，避免每次渲染都新建对象
  const mainMenu = useMemo(() => (
    <MainMenu>
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.Help />
    </MainMenu>
  ), []);

  return (
    <div>
      <div ref={containerRef} style={{ position: 'relative', height: '600px' }}>
        {/* 放大预览按钮，在阅读模式和编辑模式下都显示 */}
        <Button
          icon={<ZoomInOutlined />}
          size="small"
          style={{
            position: 'absolute',
            top: 17,
            left: 60,
            zIndex: 1000,
            width: 64,
            height: 36,
            padding: 0,
            borderRadius: 4,
            backgroundColor: 'rgba(236,236,244,0.8)',
            border: 'none',
            boxShadow: '0px 1px 3px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={handlePreviewOpen}
        />
        <Excalidraw
          key={initialData ? `diagram-${initialData.version}` : 'diagram-new'}
          excalidrawAPI={onExcalidrawAPI}
          initialData={initialData ? {
            elements: initialData.elements,
            appState: initialData.state
          } : undefined}
          onChange={isEditable ? handleChange : undefined}
          viewModeEnabled={!isEditable}
          zenModeEnabled={!isEditable}
          gridModeEnabled={true}
          theme="light"
          langCode="zh-CN"
          UIOptions={uiOptions}
        >
          {mainMenu}
        </Excalidraw>
      </div>
      {/* 大画布预览弹窗 */}
      <Modal
        visible={previewVisible}
        footer={null}
        onCancel={handlePreviewClose}
        width="90%"
        bodyStyle={{ padding: 0 }}
        style={{ top: 20 }}
      >
        <div ref={previewContainerRef} style={{ width: '100%', height: '85vh' }}>
          <Excalidraw
            excalidrawAPI={onPreviewExcalidrawAPI}
            initialData={initialData ? { elements: initialData.elements, appState: initialData.state } : undefined}
            viewModeEnabled={!isEditable}
            zenModeEnabled={!isEditable}
            gridModeEnabled={true}
            theme="light"
            langCode="zh-CN"
            UIOptions={uiOptions}
            onChange={isEditable ? handleChange : undefined}
          >
            {mainMenu}
          </Excalidraw>
        </div>
      </Modal>
    </div>
  );
});

export default DiagramEditor; 