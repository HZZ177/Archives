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

// 调试工具函数
const DEBUG = true; // 设置为 false 可以禁用所有调试输出
function debug(message: string, data?: any) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // 获取时:分:秒
  if (data) {
    console.log(`[${timestamp}] [DiagramEditor] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [DiagramEditor] ${message}`);
  }
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
  const [hoveredTable, setHoveredTable] = useState<DatabaseTable | null>(null);
  const [selectedTable, setSelectedTable] = useState<DatabaseTable | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const excalApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const previewApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  // 在 useEffect 中添加日志
  useEffect(() => {
    console.log('DiagramEditor 组件加载，参数:', { moduleId, isEditable, diagramType });
    loadDiagramData();
    if (diagramType === 'tableRelation') {
      console.log('检测到表关系图类型，准备加载数据库表');
      loadDatabaseTables();
    }
  }, [moduleId, diagramType]); // 添加diagramType作为依赖项

  // 加载数据库表数据
  const loadDatabaseTables = async () => {
    try {
      console.log('开始加载数据库表数据，moduleId:', moduleId, '图表类型:', diagramType);
      const moduleContent = await fetchModuleContent(moduleId);
      console.log('获取到模块内容:', moduleContent);
      
      // 修正：直接从 moduleContent 中获取 database_tables_json
      if (moduleContent && (moduleContent as any).database_tables_json) {
        console.log('找到数据库表:', (moduleContent as any).database_tables_json);
        setDatabaseTables((moduleContent as any).database_tables_json);
      } else {
        console.log('未找到数据库表数据，moduleContent结构:', moduleContent);
        // 如果没有找到数据库表，尝试创建一个测试表以验证组件渲染
        if (diagramType === 'tableRelation') {
          const testTable: DatabaseTable = {
            table_name: '测试表',
            description: '这是一个测试表，用于验证组件渲染',
            columns: [
              {
                field_name: 'id',
                field_type: 'int',
                nullable: false,
                is_primary_key: true,
                is_unique: true,
                is_index: false
              },
              {
                field_name: 'name',
                field_type: 'varchar',
                length: 255,
                nullable: true,
                is_primary_key: false,
                is_unique: false,
                is_index: true,
                description: '名称字段'
              }
            ]
          };
          console.log('创建测试表数据:', testTable);
          setDatabaseTables([testTable]);
        }
      }
    } catch (error) {
      console.error('加载数据库表失败:', error);
      message.error('加载数据库表失败');
    }
  };

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
      // 确保在阅读模式下强制设置视图模式
      const appState = {
        ...diagramData.state,
        // 在阅读模式下强制启用视图模式和禅模式
        viewModeEnabled: !isEditable ? true : diagramData.state.viewModeEnabled,
        zenModeEnabled: !isEditable ? true : diagramData.state.zenModeEnabled
      };
      
      previewApiRef.current.updateScene({
        elements: diagramData.elements,
        appState: appState
      });
      
      // 额外确认视图模式设置
      if (!isEditable) {
        console.log('强制设置预览画布为阅读模式');
        setTimeout(() => {
          if (previewApiRef.current) {
            const currentState = previewApiRef.current.getAppState();
            if (!currentState.viewModeEnabled) {
              previewApiRef.current.updateScene({
                appState: {
                  ...currentState,
                  viewModeEnabled: true,
                  zenModeEnabled: true,
                  editingTextElement: null
                }
              });
            }
          }
        }, 200);
      }
    }
  }, [diagramData, isEditable]);

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
    console.log('打开预览弹窗，编辑模式:', isEditable);
    setPreviewVisible(true);
    
    // 在弹窗打开时同步数据到预览画布
    setTimeout(() => {
      syncPreviewData();
      
      // 额外确认预览画布的视图模式设置
      if (!isEditable && previewApiRef.current) {
        console.log('强制确认预览画布为阅读模式');
        const currentState = previewApiRef.current.getAppState();
        previewApiRef.current.updateScene({
          appState: {
            ...currentState,
            viewModeEnabled: true,
            zenModeEnabled: true,
            editingTextElement: null
          }
        });
      }
    }, 100);
  }, [syncPreviewData, isEditable]);

  // 处理弹窗关闭
  const handlePreviewClose = useCallback(() => {
    console.log('关闭预览弹窗，编辑模式:', isEditable);
    
    // 只在编辑模式下同步数据到主画布
    if (isEditable && previewApiRef.current) {
      console.log('编辑模式：同步预览画布数据到主画布');
      const elements = previewApiRef.current.getSceneElementsIncludingDeleted();
      const state = previewApiRef.current.getAppState();
      setDiagramData({ elements: elements as ExcalidrawElement[], state });
      setTimeout(syncMainData, 100);
    } else {
      console.log('阅读模式：不同步预览画布数据到主画布');
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
      if (!excalApiRef.current || payload.button !== "up") return;
      
      const { x, y } = payload.pointer;
      const elements = excalApiRef.current.getSceneElements();
      
      // 检查鼠标是否悬停在数据库表卡片上
      const hoveredElement = elements.find(element => {
        if (element.customData?.tableName || element.customData?.tableData) {
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
      
      if (hoveredElement) {
        if (hoveredElement.customData?.tableData) {
          // 兼容旧版本
          const tableData = JSON.parse(hoveredElement.customData.tableData);
          setHoveredTable(tableData);
        } else if (hoveredElement.customData?.tableName) {
          // 新版本，从数据库表列表中查找匹配的表
          const tableName = hoveredElement.customData.tableName;
          const table = databaseTables.find(t => t.table_name === tableName);
          if (table) {
            setHoveredTable(table);
          }
        }
      } else {
        setHoveredTable(null);
      }
    },
    [databaseTables]
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
                debug('解析表数据成功', { tableName: tableData.table_name });
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
              const table = databaseTables.find(t => t.table_name === tableName);
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
            debug('解析表数据成功', { tableName: tableData.table_name });
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
          const table = databaseTables.find(t => t.table_name === tableName);
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
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      debug('开始处理拖放事件');
      
      if (!excalApiRef.current) {
        console.error('Excalidraw API 引用不可用');
        debug('Excalidraw API 引用不可用');
        return;
      }
      
      try {
        console.log('处理拖放开始');
        const tableData = JSON.parse(event.dataTransfer.getData('application/json'));
        debug('解析的表数据', tableData);
        
        // 获取画布坐标系中的放置位置
        const { clientX, clientY } = event;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) {
          console.error('无法获取容器边界矩形');
          debug('无法获取容器边界矩形');
          return;
        }
        
        const appState = excalApiRef.current.getAppState();
        const scrollX = appState.scrollX;
        const scrollY = appState.scrollY;
        const zoom = appState.zoom.value;
        
        // 转换为画布坐标
        const x = (clientX - rect.left - scrollX) / zoom;
        const y = (clientY - rect.top - scrollY) / zoom;
        debug('计算的画布坐标', { x, y, zoom, scrollX, scrollY });
        
        // 生成唯一ID
        const elementId = Math.random().toString(36).substring(2, 10);
        debug('生成的ID', { elementId });
        
        // 创建表示数据库表的矩形元素
        const tableElement = {
          id: elementId,
          type: "rectangle" as const,
          x,
          y,
          width: 200,
          height: 120,
          backgroundColor: "#f0f9ff",
          strokeColor: "#1890ff",
          strokeWidth: 1,
          fillStyle: "solid" as const,
          strokeStyle: "solid" as const,
          roughness: 0,
          opacity: 100,
          angle: 0,
          seed: Math.floor(Math.random() * 1000000),
          groupIds: [],
          boundElements: [],
          link: null,
          locked: false,
          isDeleted: false,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1000000),
          updated: Date.now(),
          roundness: { type: 3 as const, value: 10 },
          // 添加文本
          text: `${tableData.table_name}\n\n${tableData.description || '无描述'}\n\n字段数量: ${tableData.columns?.length || 0}`,
          fontSize: 16,
          fontFamily: 1,
          textAlign: "center" as const,
          verticalAlign: "middle" as const,
          baseline: 18,
          originalText: `${tableData.table_name}\n\n${tableData.description || '无描述'}\n\n字段数量: ${tableData.columns?.length || 0}`,
          // 自定义数据
          customData: {
            tableName: tableData.table_name,
            columnsCount: tableData.columns?.length || 0
          }
        } as unknown as ExcalidrawElement;
        
        debug('元素创建完成');
        
        // 将元素添加到画布
        try {
          const elements = excalApiRef.current.getSceneElements();
          debug('当前画布元素数量', elements.length);
          
          const newElements = [...elements, tableElement];
          debug('准备添加新元素', { 
            currentCount: elements.length, 
            newCount: newElements.length 
          });
          
          excalApiRef.current.updateScene({
            elements: newElements as ExcalidrawElement[]
          });
          
          debug('元素已添加到画布', { elementId });
          message.success('表已添加到画布');
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
    []
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

  // 在 render 部分添加日志
  console.log('渲染 DiagramEditor，状态:', { 
    databaseTablesCount: databaseTables.length,
    isTableRelation: diagramType === 'tableRelation',
    isEditable,
    shouldShowPanel: diagramType === 'tableRelation' && isEditable,
    sidebarCollapsed
  });

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
        
        {/* 悬停预览 Popover */}
        <Popover
          open={!!hoveredTable}
          title={null}
          content={hoveredTable && <DatabaseTableDetail table={hoveredTable} simple={true} />}
          placement="right"
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        </Popover>
        
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
        <div ref={previewContainerRef} style={{ width: '100%', height: '85vh' }}>
          <Excalidraw
            excalidrawAPI={onPreviewExcalidrawAPI}
            initialData={initialData ? { 
              elements: initialData.elements,
              appState: {
                ...initialData.state,
                viewModeEnabled: !isEditable,
                zenModeEnabled: !isEditable
              }
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
      </Modal>
      
      {/* 数据库表详情弹窗 */}
      <Modal
        title={selectedTable?.table_name}
        visible={detailModalVisible}
        footer={null}
        onCancel={() => setDetailModalVisible(false)}
        width={700}
      >
        {selectedTable && <DatabaseTableDetail table={selectedTable} />}
      </Modal>
    </div>
  );
});

export default DiagramEditor; 