import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Excalidraw, MainMenu, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { Button, message, Modal, Popover } from 'antd';
import { ZoomInOutlined } from '@ant-design/icons';
import { getDiagram, fetchModuleContent } from '../../../apis/moduleService';
import { DiagramData } from '../../../types/diagram';
import { DatabaseTable } from '../../../types/modules';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import DatabaseTablePanel from './DatabaseTablePanel';
import DatabaseTableDetail from './DatabaseTableDetail';
import styles from './DiagramEditor.module.css';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

// 调试工具函数
const DEBUG = false; // 设置为 false 禁用所有调试输出
function debug(message: string, data?: any) {
  if (!DEBUG) return;
  // 调试输出已被禁用
}

interface DiagramEditorProps {
  moduleId: number;
  isEditable?: boolean;
  diagramType?: 'business' | 'tableRelation'; // 添加图表类型参数
}

// 定义父组件调用的接口
export interface DiagramEditorHandle {
  getDiagramData: () => DiagramData | null;
}

const DiagramEditor = forwardRef<DiagramEditorHandle, DiagramEditorProps>(({
  moduleId,
  isEditable = true,
  diagramType = 'business', // 默认为业务流程图
}, ref) => {
  const [initialData, setInitialData] = useState<DiagramData | null>(null);
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTable, setSelectedTable] = useState<DatabaseTable | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const excalApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const previewApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const workspace = useWorkspace();

  // 在 useEffect 中添加日志
  useEffect(() => {
    loadDiagramData();
    if (diagramType === 'tableRelation') {
      loadDatabaseTables();
    }
  }, [moduleId, diagramType]); // 添加diagramType作为依赖项

  // 加载数据库表数据
  const loadDatabaseTables = async () => {
    try {
      const moduleContent = await fetchModuleContent(
        moduleId, 
        workspace.currentWorkspace?.id,
        workspace.workspaceTables
      );
      
      // 尝试从多个可能的路径获取数据库表
      let tables = null;
      
      // 1. 尝试从关联表查询返回的完整表对象获取（新的存储方式）
      if (moduleContent && (moduleContent as any).database_tables && Array.isArray((moduleContent as any).database_tables)) {
        tables = (moduleContent as any).database_tables;
      }
      // 2. 尝试从新的路径获取
      else if (moduleContent && moduleContent.content && moduleContent.content.database_tables) {
        tables = moduleContent.content.database_tables;
      } 
      // 3. 尝试从旧的路径获取
      else if (moduleContent && (moduleContent as any).database_tables_json) {
        tables = (moduleContent as any).database_tables_json;
      }
      
      if (tables && tables.length > 0) {
        setDatabaseTables(tables);
      } else {
        // 清空数据库表，显示空状态
        setDatabaseTables([]);
      }
    } catch (error) {
      console.error('加载数据库表失败:', error);
      message.error('加载数据库表失败');
    }
  };

  // 刷新数据库表数据
  const refreshDatabaseTables = useCallback(async () => {
    message.loading({ content: '正在刷新数据库表...', key: 'refreshTables' });
    try {
      await loadDatabaseTables();
      message.success({ content: '数据库表已刷新', key: 'refreshTables' });
    } catch (error) {
      console.error('刷新数据库表失败:', error);
      message.error({ content: '刷新数据库表失败', key: 'refreshTables' });
    }
  }, [moduleId, workspace.currentWorkspace?.id]);

  // 监听编辑模式变化，在进入编辑模式时自动刷新数据库表
  useEffect(() => {
    // 仅当进入编辑模式且为表关系图类型时自动刷新数据库表
    if (isEditable && diagramType === 'tableRelation') {
      refreshDatabaseTables();
    }
  }, [isEditable, diagramType, refreshDatabaseTables]); // 依赖于isEditable、diagramType和refreshDatabaseTables

  // 处理滚轮缩放（使用原生WheelEvent）
  const handleWheel = useCallback((event: WheelEvent) => {
    // 检查事件目标是否在属性面板内
    const target = event.target as HTMLElement;
    
    // Excalidraw 的属性面板通常有这些类名或属性
    // 使用多种可能的选择器来增加匹配的可能性
    const isInPropertyPanel = 
      target.closest('.excalidraw-sidebar') || 
      target.closest('.excalidraw-panel') || 
      target.closest('.App-menu-left') || 
      target.closest('.App-menu__left') || 
      target.closest('[data-sidebar="true"]') || 
      target.closest('[data-testid="sidebar"]') || 
      target.closest('[data-testid="panel"]') ||
      // 颜色选择器和属性面板
      target.closest('.App-toolbar') ||
      target.closest('.color-picker') ||
      target.closest('.popover') ||
      // 通用选择器，匹配可能的属性面板
      target.closest('[class*="sidebar"]') ||
      target.closest('[class*="panel"]') ||
      target.closest('[class*="property"]');
    
    // 如果在属性面板内，不阻止默认行为，让浏览器自己处理滚动
    if (isInPropertyPanel) {
      return;
    }
    
    // 原有的缩放逻辑
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
      // 根据图表类型选择不同的API端点
      const endpoint = diagramType === 'tableRelation' 
        ? `/module-contents/${moduleId}/table-relation-diagram` 
        : `/module-contents/${moduleId}/diagram`;
      
      const response = await getDiagram(moduleId, diagramType);
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
      // 获取主画布的当前状态
      const currentMainState = excalApiRef.current?.getAppState() || diagramData.state;
      
      // 确保在阅读模式下强制设置视图模式，同时保留主画布的其他状态（如缩放级别、滚动位置等）
      const appState = {
        ...currentMainState, // 保留所有原始状态，包括缩放级别、滚动位置等
        // 在阅读模式下强制启用视图模式和禅模式
        viewModeEnabled: !isEditable ? true : currentMainState.viewModeEnabled,
        zenModeEnabled: !isEditable ? true : currentMainState.zenModeEnabled,
        editingTextElement: null, // 确保没有处于编辑状态的文本元素
      };
      
      previewApiRef.current.updateScene({
        elements: diagramData.elements,
        appState: appState
      });
    }
  }, [diagramData, isEditable, excalApiRef]);

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
    setTimeout(() => {
      syncPreviewData();
    }, 100);
  }, [syncPreviewData, isEditable]);

  // 处理弹窗关闭
  const handlePreviewClose = useCallback(() => {
    // 只在编辑模式下同步数据到主画布
    if (isEditable && previewApiRef.current) {
      const elements = previewApiRef.current.getSceneElementsIncludingDeleted();
      const state = previewApiRef.current.getAppState();
      setDiagramData({ elements: elements as ExcalidrawElement[], state });
      setTimeout(syncMainData, 100);
    }
    
    setPreviewVisible(false);
  }, [syncMainData, isEditable]);

  // 处理画布变化
  const handleChange = useCallback((elements: any, state: any) => {
    // 只在编辑模式下更新数据
    if (isEditable) {
      const newData: DiagramData = { elements, state };
      setDiagramData(newData);
    }
  }, [isEditable]);

  // 处理画布指针更新事件（用于悬停检测）
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: "down" | "up"; pointersMap: Map<number, { x: number; y: number }> }) => {
      // 移除了悬停检测逻辑
      // 保留函数框架以便将来可能的扩展
    },
    []
  );

  // 处理画布点击事件
  const handlePointerDown = useCallback(
    (activeTool: any, pointerDownState: any) => {
      // 在编辑模式下不执行弹出弹窗的操作
      if (isEditable || !excalApiRef.current) return;
      
      const { x, y } = pointerDownState.origin;
      debug('处理画布点击事件', { x, y, isEditable });
      
      const elements = excalApiRef.current.getSceneElements();
      
      // 检查是否点击了数据库表卡片
      const clickedElement = elements.find(element => {
        if ((element.customData?.tableName || element.customData?.tableData) && element.type === "rectangle") {
          const { x: elementX, y: elementY, width, height } = element;
          return (
            x >= elementX &&
            x <= elementX + width &&
            y >= elementY &&
            y <= elementY + height
          );
        }
        return false;
      });
      
      // 如果没有直接找到矩形元素，检查是否点击在组内的任何元素上
      if (!clickedElement) {
        debug('未直接找到矩形元素，检查组内元素');
        // 找到鼠标下的任何元素
        const anyClickedElement = elements.find(element => {
          if (element.type === "text" || element.type === "rectangle") {
            const { x: elementX, y: elementY, width, height } = element;
            return (
              x >= elementX &&
              x <= elementX + width &&
              y >= elementY &&
              y <= elementY + height
            );
          }
          return false;
        });
        
        if (anyClickedElement) {
          debug('找到点击的元素', { 
            id: anyClickedElement.id, 
            type: anyClickedElement.type, 
            hasGroupIds: !!anyClickedElement.groupIds,
            groupIdsLength: anyClickedElement.groupIds?.length || 0
          });
        }
        
        if (anyClickedElement && anyClickedElement.groupIds && anyClickedElement.groupIds.length > 0) {
          // 找到同组的矩形元素
          const groupId = anyClickedElement.groupIds[0];
          debug('查找同组的矩形元素', { groupId });
          
          const rectElementInGroup = elements.find(
            element => 
              element.type === "rectangle" && 
              element.groupIds && 
              element.groupIds.includes(groupId) && 
              (element.customData?.tableName || element.customData?.tableData)
          );
          
          if (rectElementInGroup) {
            debug('找到同组的矩形元素', { 
              id: rectElementInGroup.id,
              tableName: rectElementInGroup.customData?.tableName,
              hasTableData: !!rectElementInGroup.customData?.tableData
            });
            
            // 处理找到的矩形元素
            if (rectElementInGroup.customData?.tableData) {
              // 兼容旧版本
              try {
                const tableData = JSON.parse(rectElementInGroup.customData.tableData);
                debug('解析表数据成功', { tableName: tableData.name });
                setSelectedTable(tableData);
                setDetailModalVisible(true);
                return; // 找到了表数据，提前返回
              } catch (error) {
                console.error('解析表数据失败:', error);
                debug('解析表数据失败', { error });
              }
            } else if (rectElementInGroup.customData?.tableName) {
              // 新版本，从数据库表列表中查找匹配的表
              const tableName = rectElementInGroup.customData.tableName;
              debug('查找表', { tableName });
              const table = databaseTables.find(t => t.name === tableName);
              if (table) {
                debug('找到表', { tableName });
                setSelectedTable(table);
                setDetailModalVisible(true);
                return; // 找到了表，提前返回
              } else {
                debug('未找到表', { tableName });
              }
            }
          } else {
            debug('未找到同组的矩形元素');
          }
        }
      }
      
      // 处理直接找到的矩形元素
      if (clickedElement) {
        debug('直接找到矩形元素', { 
          id: clickedElement.id,
          tableName: clickedElement.customData?.tableName,
          hasTableData: !!clickedElement.customData?.tableData
        });
        
        if (clickedElement.customData?.tableData) {
          // 兼容旧版本
          try {
            const tableData = JSON.parse(clickedElement.customData.tableData);
            debug('解析表数据成功', { tableName: tableData.name });
            setSelectedTable(tableData);
            setDetailModalVisible(true);
          } catch (error) {
            console.error('解析表数据失败:', error);
            debug('解析表数据失败', { error });
          }
        } else if (clickedElement.customData?.tableName) {
          // 新版本，从数据库表列表中查找匹配的表
          const tableName = clickedElement.customData.tableName;
          debug('查找表', { tableName });
          const table = databaseTables.find(t => t.name === tableName);
          if (table) {
            debug('找到表', { tableName });
            setSelectedTable(table);
            setDetailModalVisible(true);
          } else {
            debug('未找到表', { tableName });
          }
        }
      } else {
        debug('未找到任何可点击的元素');
      }
    },
    [isEditable, databaseTables]
  );

  // 处理数据库表拖拽开始
  const handleTableDragStart = (table: DatabaseTable, event: React.DragEvent<HTMLDivElement>) => {
    // 仅在编辑模式下允许拖拽
    if (!isEditable) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/json', JSON.stringify(table));
    event.dataTransfer.effectAllowed = 'copy';
  };

  // 处理数据库表拖放到画布上
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, isPreview: boolean = false) => {
      event.preventDefault();
      debug(`开始处理${isPreview ? '预览' : '主'}画布拖放事件`);
      
      // 根据是否为预览模式选择正确的API引用和容器引用
      const api = isPreview ? previewApiRef : excalApiRef;
      const container = isPreview ? previewContainerRef : containerRef;
      
      if (!api.current) {
        debug(`${isPreview ? '预览' : '主'}画布 API 引用不可用`);
        return;
      }
      
      try {
    
        const tableData = JSON.parse(event.dataTransfer.getData('application/json'));
        debug('解析的表数据', tableData);
        
        // 获取画布坐标系中的放置位置
        const { clientX, clientY } = event;
        const rect = container.current?.getBoundingClientRect();
        if (!rect) {
          console.error('无法获取容器边界矩形');
          return;
        }
        
        const appState = api.current.getAppState();
        const scrollX = appState.scrollX;
        const scrollY = appState.scrollY;
        const zoom = appState.zoom.value;
        
        // 转换为画布坐标，并以鼠标位置为中心
        const sceneX = (clientX - rect.left) / zoom - scrollX;
        const sceneY = (clientY - rect.top) / zoom - scrollY;
        
        const elementWidth = 200;
        const elementHeight = 120;

        const x = sceneX - elementWidth / 2;
        const y = sceneY - elementHeight / 2;
        
        debug('计算的画布坐标', { x, y, zoom, scrollX, scrollY });
        
        // 使用 Excalidraw 的元素骨架 API 创建元素
        const elementSkeletons = [
          {
            type: "rectangle" as const,
            x: x,
            y: y,
            width: elementWidth,
            height: elementHeight,
            backgroundColor: "#fff9c4", // 便利贴黄色
            strokeColor: "#000000", // 黑色描边
            strokeWidth: 1,
            fillStyle: "solid" as const, // 实心填充
            strokeStyle: "solid" as const, // 朴素线条
            label: {
              text: `${tableData.name}\n\n${tableData.description || '无描述'}\n\n字段数量: ${tableData.columns?.length || 0}`,
              fontSize: 16,
            },
            customData: {
              tableName: tableData.name,
              columnsCount: tableData.columns?.length || 0,
              tableData: JSON.stringify(tableData) // 保留完整数据以备后用
            }
          }
        ];
        
        debug('元素骨架创建完成');
        
        // 将元素骨架转换为完整的 Excalidraw 元素
        const newElements = convertToExcalidrawElements(elementSkeletons as any);
        debug('元素转换完成', { elementsCount: newElements.length });
        
        // 将元素添加到画布
        try {
          const elements = api.current.getSceneElements();
          debug('当前画布元素数量', elements.length);
          
          const updatedElements = [...elements, ...newElements];
          debug('准备添加新元素', { 
            currentCount: elements.length, 
            newCount: updatedElements.length 
          });
          
          api.current.updateScene({
            elements: updatedElements
          });
          
          debug('元素已添加到画布');
          message.success('表已添加到画布');
          
          // 如果是在预览模式下添加的元素，同步到主数据
          if (isPreview && isEditable) {
            const allElements = api.current.getSceneElementsIncludingDeleted();
            const state = api.current.getAppState();
            setDiagramData({ elements: allElements as ExcalidrawElement[], state });
          }
        } catch (updateError) {
          console.error('更新场景失败:', updateError);
          debug('更新场景失败', { error: updateError });
          message.error('添加元素到画布失败');
        }
      } catch (error) {
        console.error('处理拖放失败:', error);
        debug('处理拖放失败', { error });
        message.error('处理拖放失败');
      }
    },
    [isEditable]
  );

  // 处理预览画布的拖拽事件
  const handlePreviewDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      handleDrop(event, true);
    },
    [handleDrop]
  );

  // 处理拖拽进入画布
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Excalidraw API 引用
  const onExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI | null) => {
    excalApiRef.current = api;
  }, []);

  // 预览画布的 API 引用
  const onPreviewExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI | null) => {
    previewApiRef.current = api;
    
    // 确保在阅读模式下设置正确的视图模式
    if (api && !isEditable) {
      const appState = api.getAppState();
      api.updateScene({
        appState: {
          ...appState,
          viewModeEnabled: true,
          zenModeEnabled: true,
          editingTextElement: null
        }
      });
    }
  }, [isEditable]);

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
    <div className={styles.diagramEditorContainer}>
      {/* 数据库表侧边面板 - 仅在表关系图类型和编辑模式下显示 */}
      {diagramType === 'tableRelation' && isEditable && (
        <DatabaseTablePanel
          databaseTables={databaseTables}
          onDragStart={handleTableDragStart}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          isEditable={isEditable}
          onRefresh={refreshDatabaseTables}
          onTableDetailClick={(table) => {
            
            setSelectedTable(table);
            setDetailModalVisible(true);
          }}
        />
      )}
      
      <div 
        ref={containerRef} 
        style={{ 
          position: 'relative', 
          height: '600px',
          marginLeft: diagramType === 'tableRelation' && isEditable ? 
            (sidebarCollapsed ? '40px' : '250px') : '0',
          transition: 'margin-left 0.3s'
        }}
        onDrop={isEditable ? handleDrop : undefined}
        onDragOver={isEditable ? handleDragOver : undefined}
      >
        {/* 放大预览按钮，在阅读模式和编辑模式下都显示 */}
        <Button
          icon={<ZoomInOutlined />}
          size="small"
          style={{
            position: 'absolute',
            top: 17,
            left: diagramType === 'tableRelation' && isEditable && !sidebarCollapsed ? 60 : 60,
            zIndex: 1000,
            width: diagramType === 'tableRelation' && isEditable && !sidebarCollapsed ? 36 : 64,
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
          key={initialData ? `diagram-${initialData.version}-${diagramType}` : `diagram-new-${diagramType}`}
          excalidrawAPI={onExcalidrawAPI}
          initialData={initialData ? {
            elements: initialData.elements,
            appState: initialData.state
          } : undefined}
          onChange={isEditable ? handleChange : undefined}
          onPointerUpdate={handlePointerUpdate}
          onPointerDown={!isEditable ? handlePointerDown : undefined}
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
        title={`${!isEditable ? "[阅读模式]" : "[编辑模式]"} 图表预览`}
      >
        <div style={{ position: 'relative', width: '100%', height: '85vh', display: 'flex' }}>
          {/* 在弹窗中添加数据库表侧边面板 - 仅在表关系图类型和编辑模式下显示 */}
          {diagramType === 'tableRelation' && isEditable && (
            <DatabaseTablePanel
              databaseTables={databaseTables}
              onDragStart={handleTableDragStart}
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
              isEditable={isEditable}
              onRefresh={refreshDatabaseTables}
              onTableDetailClick={(table) => {
                setSelectedTable(table);
                setDetailModalVisible(true);
              }}
            />
          )}
          
          <div 
            ref={previewContainerRef} 
            style={{ 
              position: 'relative', 
              flex: 1,
              height: '100%',
              marginLeft: diagramType === 'tableRelation' && isEditable ? 
                (sidebarCollapsed ? '40px' : '250px') : '0',
              transition: 'margin-left 0.3s'
            }}
            onDrop={isEditable ? handlePreviewDrop : undefined}
            onDragOver={isEditable ? handleDragOver : undefined}
          >
            <Excalidraw
              excalidrawAPI={onPreviewExcalidrawAPI}
              initialData={diagramData ? { 
                elements: diagramData.elements,
                appState: {
                  ...diagramData.state,
                  viewModeEnabled: !isEditable,
                  zenModeEnabled: !isEditable
                },
                scrollToContent: true
              } : undefined}
              viewModeEnabled={!isEditable}
              zenModeEnabled={!isEditable}
              gridModeEnabled={true}
              theme="light"
              langCode="zh-CN"
              UIOptions={{
                ...uiOptions,
                canvasActions: {
                  ...uiOptions.canvasActions,
                  // 在阅读模式下禁用所有画布操作
                  export: isEditable ? { saveFileToDisk: true } : { saveFileToDisk: true },
                  loadScene: false,
                  clearCanvas: isEditable,
                  changeViewBackgroundColor: isEditable,
                  toggleTheme: false,
                }
              }}
              onChange={isEditable ? handleChange : undefined}
              onPointerUpdate={isEditable ? handlePointerUpdate : undefined}
              onPointerDown={isEditable ? handlePointerDown : undefined}
            >
              {mainMenu}
            </Excalidraw>
          </div>
        </div>
      </Modal>
      
      {/* 数据库表详情弹窗 */}
      <Modal
        title={selectedTable?.name || (selectedTable as any)?.table_name || '表详情'}
        open={detailModalVisible}
        footer={null}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
      >
        {selectedTable && <DatabaseTableDetail table={selectedTable} />}
      </Modal>
    </div>
  );
});

export default DiagramEditor; 