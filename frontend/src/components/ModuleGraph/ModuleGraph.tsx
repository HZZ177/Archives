import React, { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleTree, fetchModuleContent } from '../../apis/moduleService';
import { Tooltip, Button, Spin } from 'antd';
import './ModuleGraph.css';
import { AimOutlined, LinkOutlined, InfoCircleOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, SettingOutlined } from '@ant-design/icons';
import { message } from 'antd';

interface ModuleGraphProps {
  currentModuleId: number;
  onNodeClick: (moduleId: number) => void;
}

interface GraphNode {
  id: number;
  name: string;
  isCurrentModule: boolean;
  isContentPage: boolean;
  isTopLevel?: boolean;  // 添加顶级节点标识
  overview?: string;
  path?: string;
  val?: number;  // 添加val属性
  x?: number;  // 节点x坐标
  y?: number;  // 节点y坐标
}

interface GraphLink {
  source: number;
  target: number;
  isRelated?: boolean;
}

interface ModuleGraphRef {
  zoomToFit: () => void;
  resetAutoFit: () => void;
}

// 添加平滑缩放配置常量
const ZOOM_TRANSITION_DURATION = 250; // 缩放动画持续时间(ms)，减少以提高响应性
const ZOOM_FACTOR = 1.4; // 每次缩放倍数
const DAMPING_FACTOR = 0.4; // 阻尼系数 - 值越小阻尼感越强

const ModuleGraph = forwardRef<ModuleGraphRef, ModuleGraphProps>(({ currentModuleId, onNodeClick }, ref) => {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [showOnlyRelated, setShowOnlyRelated] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);
  const [pulseFrame, setPulseFrame] = useState(0);
  const [highlightedLinkKeys, setHighlightedLinkKeys] = useState<Set<string>>(new Set());
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<number>>(new Set());
  const graphRef = useRef<any>();
  const hasAutoFitted = useRef(false);
  const pulseAnimRef = useRef<number>();
  const [currentScale, setCurrentScale] = useState<number>(1);
  
  // 坐标系显示状态
  const [showCoordinateSystem, setShowCoordinateSystem] = useState(false);
  const [mousePosition, setMousePosition] = useState<{x: number, y: number} | null>(null);

  // 添加滚轮缩放相关状态
  const lastWheelEventTime = useRef<number>(0);
  const targetZoomScale = useRef<number | null>(null);
  const zoomTransitionActive = useRef<boolean>(false);
  const wheelDeltaAccumulator = useRef<number>(0);

  // 移除鼠标位置跟踪代码，使用内置tooltip

  // 将模块树转换为图形数据
  const convertToGraphData = useCallback(async (modules: ModuleStructureNode[]) => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const processedIds = new Set<number>();

    // 递归处理节点
    const processNode = (node: ModuleStructureNode, parentId?: number, depth: number = 0, index: number = 0, totalSiblings: number = 1) => {
      if (processedIds.has(node.id)) return;
      processedIds.add(node.id);

      // 计算初始位置 - 基于层级和兄弟节点索引
      const initialRadius = 100 + (depth * 50); // 每层半径递增
      const angle = (index / Math.max(1, totalSiblings)) * 2 * Math.PI; // 均匀分布在圆周上
      
      // 添加节点
      nodes.push({
        id: node.id,
        name: node.name,
        isContentPage: node.is_content_page,
        isCurrentModule: node.id === currentModuleId,
        isTopLevel: parentId === undefined,  // 如果没有父节点，则为顶级节点
        val: 1,
        // 初始位置 - 按层级环形布局
        x: Math.cos(angle) * initialRadius,
        y: Math.sin(angle) * initialRadius
      });

      // 如果有父节点，添加连接
      if (parentId !== undefined) {
        links.push({
          source: parentId,
          target: node.id
        });
      }

      // 处理子节点 - 传递深度信息
      if (node.children && node.children.length > 0) {
        node.children.forEach((child, childIndex) => 
          processNode(child, node.id, depth + 1, childIndex, node.children.length));
      }
    };

    // 处理所有顶级节点
    modules.forEach((node, index) => processNode(node, undefined, 0, index, modules.length));

    // 获取关联模块的连接
    if (currentModuleId) {
      try {
        const moduleContent = await fetchModuleContent(currentModuleId);
        const relatedModuleIds = moduleContent.related_module_ids_json || [];
        
        // 为每个关联模块添加连接
        relatedModuleIds.forEach(relatedId => {
          if (!processedIds.has(relatedId)) {
            // 如果关联模块不在当前树中，添加它
            nodes.push({
              id: relatedId,
              name: `模块${relatedId}`,
              isContentPage: true,
              isCurrentModule: false,
              val: 1  // 添加基础大小
            });
          }
          
          // 添加关联连接
          links.push({
            source: currentModuleId,
            target: relatedId,
            isRelated: true
          });
        });
      } catch (error) {
        console.error('获取关联模块失败:', error);
      }
    }

    return { nodes, links };
  }, [currentModuleId]);

  // 加载图形数据
  useEffect(() => {
    let isMounted = true;  // 添加组件挂载状态检查

    const loadGraphData = async () => {
      setLoading(true);
      try {
        const response = await fetchModuleTree();
        if (!isMounted) return;  // 如果组件已卸载，不继续执行
        
        const { nodes, links } = await convertToGraphData(response.items);
        if (!isMounted) return;  // 再次检查组件是否已卸载
        
        setGraphData({ nodes, links });
      } catch (error) {
        console.error('Failed to load graph data:', error);
      } finally {
        if (isMounted) {  // 只在组件仍然挂载时更新状态
          setLoading(false);
        }
      }
    };

    loadGraphData();

    // 清理函数
    return () => {
      isMounted = false;
    };
  }, [convertToGraphData]);

  // 配置力布局参数
  useEffect(() => {
    // 确保graphRef和d3Force可用
    if (graphRef.current && graphRef.current.d3Force) {
      // 获取容器尺寸以设置中心点
      const containerElem = document.querySelector('.module-graph-wrapper');
      let centerX = 0, centerY = 0;
      
      if (containerElem) {
        const width = containerElem.clientWidth;
        const height = containerElem.clientHeight;
        centerX = width / 2;
        centerY = height / 2;
      }

      // 设置charge力（斥力）
      const charge = graphRef.current.d3Force('charge');
      if (charge) {
        charge.strength(-30); // 增强斥力，使节点分布更广
      }
      
      // 设置中心引力 - 关键部分
      const center = graphRef.current.d3Force('center');
      if (center) {
        center.x(centerX).y(centerY).strength(0.1); // 添加适当的中心引力
      }
      
      // 调整link力（连接弹性）
      const link = graphRef.current.d3Force('link');
      if (link) {
        link.distance(70); // 设置连接的目标长度
      }
    }
  }, [graphData]); // 当图数据变化时重新设置

  // 过滤只显示关联节点
  const filteredGraphData = useMemo(() => {
    if (!showOnlyRelated) return graphData;

    const relatedNodeIds = new Set<number>();
    // 兼容source/target为对象或数字
    const getId = (v: any) => (typeof v === 'object' && v !== null ? v.id : v);
    const relatedLinks = graphData.links.filter(link => 
      getId(link.source) === currentModuleId || getId(link.target) === currentModuleId
    );

    relatedLinks.forEach(link => {
      relatedNodeIds.add(getId(link.source));
      relatedNodeIds.add(getId(link.target));
    });

    // 先过滤节点
    const visibleNodes = graphData.nodes.filter(node => 
      relatedNodeIds.has(node.id) && (node.isContentPage || node.id === currentModuleId)
    );
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    // 再过滤连线
    const visibleLinks = relatedLinks.filter(link => 
      visibleNodeIds.has(getId(link.source)) && visibleNodeIds.has(getId(link.target))
    );
    return {
      nodes: visibleNodes,
      links: visibleLinks
    };
  }, [graphData, showOnlyRelated, currentModuleId]);

  // 暴露给父组件的zoomToFit方法，支持自适应缩放
  const zoomToFit = useCallback((duration = 400) => {
    if (graphRef.current && filteredGraphData.nodes.length > 0) {
      const nodes = filteredGraphData.nodes;
      const containerElem = document.querySelector('.module-graph-wrapper');
      
      if (!containerElem) {
        // 如果找不到容器，使用默认padding
        graphRef.current.zoomToFit(duration, 40);
        return;
      }
      
      // 容器尺寸
      const containerWidth = containerElem.clientWidth;
      const containerHeight = containerElem.clientHeight;
      
      // 计算图谱的边界框
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let validNodes = 0;
      
      nodes.forEach(node => {
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x);
          maxY = Math.max(maxY, node.y);
          validNodes++;
        }
      });
      
      // 确保有有效节点坐标
      if (validNodes === 0 || !isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        // 如果没有有效坐标，使用默认padding
        graphRef.current.zoomToFit(duration, 40);
        return;
      }
      
      // 计算图谱的宽高
      const graphWidth = maxX - minX || 1; // 防止除以零
      const graphHeight = maxY - minY || 1;
      
      // 计算图谱与容器的比例
      const widthRatio = graphWidth / containerWidth;
      const heightRatio = graphHeight / containerHeight;
      
      // 计算合适的padding
      // 比例因子：图谱越大相对于容器，padding应该越小
      const baseRatio = Math.max(widthRatio, heightRatio);
      const graphArea = graphWidth * graphHeight;
      const nodeDensity = validNodes / (graphArea > 0 ? graphArea : 1);
      
      // 基础padding比例，容器尺寸的百分比
      let paddingRatio = 0.1; // 10%的容器尺寸
      
      // 根据节点数量和密度调整padding比例
      if (nodes.length <= 3) {
        paddingRatio = 0.15; // 较少节点，稍大padding
      } else if (nodes.length <= 10) {
        paddingRatio = 0.12;
      } else if (nodeDensity > 0.0001) {
        // 节点密度高，减小padding
        paddingRatio = 0.08;
      }
      
      // 最终padding值
      const minDimension = Math.min(containerWidth, containerHeight);
      let padding = minDimension * paddingRatio;
      
      // 为小图谱设置最小padding，避免过大
      if (baseRatio < 0.3) {
        padding = Math.min(padding, minDimension * 0.05);
      }
      
      // 为大图谱设置最大padding，避免过小
      if (baseRatio > 2) {
        padding = Math.max(padding, 30);
      }
      
      // 自适应缩放计算完成
      
      // 使用计算出的padding进行缩放
      graphRef.current.zoomToFit(duration, padding);
      
      // 延迟检查并限制缩放范围
      setTimeout(() => {
        if (graphRef.current) {
          const currentZoom = graphRef.current.zoom();
          
          // 限制最小和最大缩放
          if (currentZoom < 0.5) {
            // 如果缩放太小，设置为最小值
            graphRef.current.zoom(0.5, duration/2);
          } else if (currentZoom > 2.5) {
            // 如果缩放太大，设置为最大值
            graphRef.current.zoom(2.5, duration/2);
          }
        }
      }, duration + 50);
    } else if (graphRef.current) {
      // 没有节点时使用默认缩放
      graphRef.current.zoomToFit(duration, 40);
    }
  }, [filteredGraphData.nodes]);

  // 暴露给父组件的重置方法（可选）
  useImperativeHandle(ref, () => ({
    zoomToFit: () => zoomToFit(400),
    resetAutoFit: () => { hasAutoFitted.current = false; }
  }));

  // 初次加载或图数据变更时重置自动适应状态
  useEffect(() => {
    // 当图数据发生变化时，重置自动适应状态
    hasAutoFitted.current = false;
  }, [graphData]);
  
  // 在数据加载完成后立即定位到中心，不等待力布局计算完成
  useEffect(() => {
    if (!loading && graphData.nodes.length > 0 && graphRef.current) {
      // 短暂延迟确保DOM已完全渲染
      setTimeout(() => {
        const containerElem = document.querySelector('.module-graph-wrapper');
        if (containerElem) {
          const width = containerElem.clientWidth;
          const height = containerElem.clientHeight;
          const centerX = width / 2;
          const centerY = height / 2;
          
          // 立即居中到容器中心，无动画
          graphRef.current.centerAt(centerX, centerY, 0);
          
          // 设置一个适中的初始缩放级别
          graphRef.current.zoom(1.2, 0);
        }
      }, 50);
    }
  }, [loading, graphData.nodes.length]);

  // 脉冲动画驱动
  useEffect(() => {
    if (highlightedNodeId) {
      let start = Date.now();
      const animate = () => {
        setPulseFrame(Date.now() - start);
        pulseAnimRef.current = requestAnimationFrame(animate);
      };
      pulseAnimRef.current = requestAnimationFrame(animate);
      return () => {
        if (pulseAnimRef.current) cancelAnimationFrame(pulseAnimRef.current);
      };
    }
  }, [highlightedNodeId]);

  // 绘制坐标系统的函数
  const drawCoordinateSystem = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (!graphRef.current || !showCoordinateSystem) return;
    
    // 获取画布尺寸
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // 直接使用canvas transform作为缩放比例
    const scale = globalScale;
    
    // 获取中心点坐标 - 假设中心点在画布中央
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // 绘制参数
    const axisColor = 'rgba(255, 0, 0, 0.7)';
    const gridColor = 'rgba(128, 128, 128, 0.15)';
    const textColor = 'rgba(255, 0, 0, 0.8)';
    const gridSpacing = 50; // 网格线间距
    
    // 计算画布范围对应的逻辑坐标范围
    const minX = -centerX / scale;
    const minY = -centerY / scale;
    const maxX = (canvasWidth - centerX) / scale;
    const maxY = (canvasHeight - centerY) / scale;
    
    // 绘制网格线
    ctx.lineWidth = 0.5 / scale;
    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    
    // 水平网格线
    const startGridY = Math.floor(minY / gridSpacing) * gridSpacing;
    for (let y = startGridY; y <= maxY; y += gridSpacing) {
      const canvasY = y * scale + centerY;
      ctx.moveTo(0, canvasY);
      ctx.lineTo(canvasWidth, canvasY);
    }
    
    // 垂直网格线
    const startGridX = Math.floor(minX / gridSpacing) * gridSpacing;
    for (let x = startGridX; x <= maxX; x += gridSpacing) {
      const canvasX = x * scale + centerX;
      ctx.moveTo(canvasX, 0);
      ctx.lineTo(canvasX, canvasHeight);
    }
    ctx.stroke();
    
    // 绘制坐标轴
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    
    // X轴
    const xAxisY = centerY;
    ctx.moveTo(0, xAxisY);
    ctx.lineTo(canvasWidth, xAxisY);
    
    // Y轴
    const yAxisX = centerX;
    ctx.moveTo(yAxisX, 0);
    ctx.lineTo(yAxisX, canvasHeight);
    ctx.stroke();
    
    // 绘制坐标标签
    ctx.fillStyle = textColor;
    ctx.font = `${12 / scale}px Arial`;
    
    // X轴标签
    const labelPadding = 5 / scale;
    for (let x = startGridX; x <= maxX; x += gridSpacing) {
      if (x === 0) continue; // 跳过原点
      const canvasX = x * scale + centerX;
      ctx.fillText(`${x}`, canvasX + labelPadding, xAxisY - labelPadding);
    }
    
    // Y轴标签
    for (let y = startGridY; y <= maxY; y += gridSpacing) {
      if (y === 0) continue; // 跳过原点
      const canvasY = y * scale + centerY;
      ctx.fillText(`${y}`, yAxisX + labelPadding, canvasY - labelPadding);
    }
    
    // 标记原点
    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
    const originPointSize = 4 / scale;
    ctx.beginPath();
    ctx.arc(centerX, centerY, originPointSize, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillText('(0,0)', centerX + labelPadding, centerY - labelPadding);
    
    // 绘制鼠标位置指示器
    if (mousePosition) {
      const x = mousePosition.x;
      const y = mousePosition.y;
      
      // 计算鼠标在逻辑坐标系中的位置
      const logicalX = (x - centerX) / scale;
      const logicalY = (y - centerY) / scale;
      
      // 绘制十字指示器
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(x - 10 / scale, y);
      ctx.lineTo(x + 10 / scale, y);
      ctx.moveTo(x, y - 10 / scale);
      ctx.lineTo(x, y + 10 / scale);
      ctx.stroke();
      
      // 显示鼠标坐标
      ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
      ctx.fillText(`(${logicalX.toFixed(0)}, ${logicalY.toFixed(0)})`, x + 15 / scale, y - 15 / scale);
    }
  }, [showCoordinateSystem, mousePosition]);
  
  // 自定义节点渲染
  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12/globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

    // 高亮/模糊处理
    let isHighlighted = highlightedNodeIds.size === 0 || highlightedNodeIds.has(node.id);
    ctx.globalAlpha = highlightedNodeIds.size === 0 ? 1 : (isHighlighted ? 1 : 0.15);

    // 脉冲高亮动画
    if (node.id === highlightedNodeId) {
      const t = (pulseFrame % 1000) / 1000;
      const pulseRadius = 5 + 5 * Math.abs(Math.sin(t * Math.PI));
      const pulseAlpha = 0.5 + 0.3 * Math.abs(Math.sin(t * Math.PI));
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, pulseRadius, 0, 2 * Math.PI, false);
      ctx.strokeStyle = '#faad14';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffd666';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = pulseAlpha;
      ctx.stroke();
      ctx.restore();
    }

    // 设置节点样式
    ctx.fillStyle = node.isCurrentModule ? '#1890ff' : 
                   node.isTopLevel ? '#722ed1' :  // 顶级节点使用紫色
                   node.isContentPage ? '#52c41a' : '#d9d9d9';
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, 5, 0, 2 * Math.PI, false);
    ctx.fill();

    // 文字透明度渐变区间
    const minScale = 1.2;  // 开始渐变的最小缩放值
    const maxScale = 2;  // 完全显示的最大缩放值
    
    // 计算文字透明度
    let textAlpha = 0;
    if (globalScale >= maxScale) {
        textAlpha = 1;
    } else if (globalScale > minScale) {
        // 在minScale和maxScale之间线性插值
        textAlpha = (globalScale - minScale) / (maxScale - minScale);
    }
    
    // 只在有透明度时绘制文字
    if (textAlpha > 0) {
        // 绘制标签背景
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * textAlpha})`;
        ctx.fillRect(
            node.x! - bckgDimensions[0] / 2,
            node.y! + 8,
            bckgDimensions[0],
            bckgDimensions[1]
        );

        // 绘制标签文本
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(0, 0, 0, ${textAlpha})`;
        ctx.fillText(
            label,
            node.x!,
            node.y! + 8 + bckgDimensions[1] / 2
        );
    }
    
    ctx.globalAlpha = 1;
  }, [highlightedNodeId, pulseFrame, highlightedNodeIds]);

  // 自定义连接渲染
  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const { source, target, isRelated } = link as any;
    const start = { x: source.x, y: source.y };
    const end = { x: target.x, y: target.y };
    const key = `${source.id}-${target.id}`;
    let isHighlighted = highlightedLinkKeys.size === 0 || highlightedLinkKeys.has(key);
    ctx.save();
    ctx.globalAlpha = highlightedLinkKeys.size === 0 ? 1 : (isHighlighted ? 1 : 0.08);
    ctx.strokeStyle = isRelated ? '#1890ff' : '#d9d9d9';
    ctx.lineWidth = 1; // 线条宽度始终为1
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }, [highlightedLinkKeys]);

  // 节点点击事件
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.isContentPage) {
      onNodeClick(node.id);
    }
    // 非内容节点不跳转
  }, [onNodeClick]);

  // 处理节点悬停
  const handleNodeHover = useCallback((node: any, previousNode: any) => {
    setHoveredNode(node);
    
    if (node) {
      const links = graphData.links;
      const descendantLinkKeys = new Set<string>();
      const descendantNodeIds = new Set<number>();
      const ancestorLinkKeys = new Set<string>();
      const ancestorNodeIds = new Set<number>();
      // 下级
      findAllDescendants(node.id, links, descendantLinkKeys, descendantNodeIds);
      // 向上
      findAllAncestors(node.id, links, ancestorLinkKeys, ancestorNodeIds);
      // 合并高亮
      const allLinkKeys = new Set<string>([...descendantLinkKeys, ...ancestorLinkKeys]);
      const allNodeIds = new Set<number>([...descendantNodeIds, ...ancestorNodeIds]);
      setHighlightedLinkKeys(allLinkKeys);
      setHighlightedNodeIds(allNodeIds);
    } else {
      setHighlightedLinkKeys(new Set());
      setHighlightedNodeIds(new Set());
    }
  }, [graphData.links, findAllDescendants, findAllAncestors]);

  // 新增：定位到当前模块节点的方法
  const locateCurrentModule = useCallback(() => {
    // 直接合并缩放与居中动画为一个过程
    const nodes = filteredGraphData.nodes;
    const currentNode = nodes.find(n => n.id === currentModuleId);
    if (currentNode && typeof currentNode.x === 'number' && typeof currentNode.y === 'number') {
      graphRef.current?.centerAt(currentNode.x, currentNode.y, 600, 1.2); // 600ms动画，缩放到1.2倍
    }
    // 高亮当前节点
    setHighlightedNodeId(currentModuleId);
    setTimeout(() => setHighlightedNodeId(null), 2000);
  }, [filteredGraphData.nodes, currentModuleId, zoomToFit]);

  // --- 高亮链路递归查找工具函数 ---
  // 构建节点和链路的映射
  const nodeMap = useMemo(() => {
    const map = new Map<number, GraphNode>();
    graphData.nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [graphData.nodes]);
  const linkMap = useMemo(() => {
    return graphData.links;
  }, [graphData.links]);

  // 查找所有下级链路和节点
  function findAllDescendants(startId: number, links: GraphLink[], visitedLinkKeys: Set<string>, visitedNodes: Set<number>) {
    visitedNodes.add(startId);
    links.forEach((link) => {
      const srcId = typeof (link as any).source === 'object' && (link as any).source !== null ? (link as any).source.id : (link as any).source;
      const tgtId = typeof (link as any).target === 'object' && (link as any).target !== null ? (link as any).target.id : (link as any).target;
      const key = `${srcId}-${tgtId}`;
      if (srcId === startId && !visitedLinkKeys.has(key)) {
        visitedLinkKeys.add(key);
        findAllDescendants(tgtId, links, visitedLinkKeys, visitedNodes);
      }
    });
  }

  // 查找向上到顶级节点的链路和节点
  function findAllAncestors(startId: number, links: GraphLink[], visitedLinkKeys: Set<string>, visitedNodes: Set<number>) {
    visitedNodes.add(startId);
    links.forEach((link) => {
      const srcId = typeof (link as any).source === 'object' && (link as any).source !== null ? (link as any).source.id : (link as any).source;
      const tgtId = typeof (link as any).target === 'object' && (link as any).target !== null ? (link as any).target.id : (link as any).target;
      const key = `${srcId}-${tgtId}`;
      if (tgtId === startId && !visitedLinkKeys.has(key)) {
        visitedLinkKeys.add(key);
        findAllAncestors(srcId, links, visitedLinkKeys, visitedNodes);
      }
    });
  }

  // 处理缩放事件，更新当前缩放比例
  const handleZoom = useCallback(({ k }: { k: number }) => {
    setCurrentScale(k);
  }, []);

  // 平滑缩放到目标比例
  const smoothZoomTo = useCallback((targetScale: number, duration: number = ZOOM_TRANSITION_DURATION) => {
    if (!graphRef.current) return;
    
    // 将目标缩放值限制在minZoom和maxZoom之间
    const boundedScale = Math.max(1, Math.min(targetScale, 8));
    targetZoomScale.current = boundedScale;
    
    // 如果已经接近目标值，直接设置
    if (Math.abs(currentScale - boundedScale) < 0.01) {
      return;
    }
    
    // 不再阻止动画过渡期间的新缩放操作，允许中断前一个动画
    // 标记动画状态为活跃
    zoomTransitionActive.current = true;
    
    // 使用D3的transition实现平滑缩放
    graphRef.current.zoom(boundedScale, duration);
    
    // 动画结束后重置状态
    setTimeout(() => {
      zoomTransitionActive.current = false;
    }, duration);
  }, [currentScale]);
  
  // 处理滚轮事件，实现平滑缩放
  const handleWheel = useCallback((event: Event) => {
    // 将事件转换为WheelEvent类型
    const wheelEvent = event as WheelEvent;
    wheelEvent.preventDefault();
    wheelEvent.stopPropagation();
    
    // 简化处理逻辑，直接使用当前deltaY判断方向
    const deltaY = wheelEvent.deltaY;
    
    // 应用阻尼系数但不进行累积，每次滚轮事件直接响应
    const dampedDelta = deltaY * DAMPING_FACTOR;
    
    // 无需记录时间戳或检查去抖动，始终处理每个滚轮事件
    
    // 计算缩放方向（向上滚动放大，向下滚动缩小）
    const direction = dampedDelta > 0 ? -1 : 1;
    
    // 总是使用最新的目标缩放值作为基础，确保动画连续性
    // 如果有正在进行的动画，使用其目标值；否则使用当前缩放比例
    let baseScale = zoomTransitionActive.current && targetZoomScale.current !== null ? 
                    targetZoomScale.current : currentScale;
    
    // 计算新的目标缩放值
    const targetScale = baseScale * Math.pow(ZOOM_FACTOR, direction);
    
    // 无需重置累积器，因为不再使用累积机制
    
    // 执行平滑缩放
    smoothZoomTo(targetScale);
  }, [currentScale, smoothZoomTo]);
  
  // 添加和移除滚轮事件监听器
  useEffect(() => {
    const canvas = document.querySelector('.module-graph-wrapper canvas');
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  // 缩放控制函数
  const zoomIn = useCallback(() => {
    if (graphRef.current) {
      const newScale = currentScale * ZOOM_FACTOR;
      smoothZoomTo(newScale);
    }
  }, [currentScale, smoothZoomTo]);

  const zoomOut = useCallback(() => {
    if (graphRef.current) {
      const newScale = currentScale / ZOOM_FACTOR;
      smoothZoomTo(newScale);
    }
  }, [currentScale, smoothZoomTo]);

  const resetZoom = useCallback(() => {
    if (graphRef.current) {
      zoomToFit(ZOOM_TRANSITION_DURATION);
    }
  }, [zoomToFit]);
  
  // 切换坐标系显示
  const toggleCoordinateSystem = useCallback(() => {
    setShowCoordinateSystem(prev => !prev);
  }, []);
  
  // 鼠标移动处理函数
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!showCoordinateSystem) return;
    
    // 获取鼠标相对于画布的位置
    const containerElem = event.currentTarget as HTMLElement;
    const rect = containerElem.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    setMousePosition({ x: mouseX, y: mouseY });
  }, [showCoordinateSystem]);
  


  return (
    <div className="module-graph-container">
      <div className="module-graph-controls">
        <Button
          className={`control-button ${showOnlyRelated ? 'active' : ''}`}
          onClick={() => setShowOnlyRelated(!showOnlyRelated)}
          icon={<LinkOutlined />}
        >
          {showOnlyRelated ? "查看所有关联图谱" : "仅查看当前模块关联图谱"}
        </Button>
        <Button
          className="control-button"
          icon={<AimOutlined />}
          onClick={locateCurrentModule}
        >
          定位当前模块
        </Button>

        <Button
          className={`control-button ${showCoordinateSystem ? 'active' : ''}`}
          icon={<SettingOutlined />}
          onClick={toggleCoordinateSystem}
          title="显示/隐藏坐标系"
        >
          坐标系
        </Button>
      </div>
      {loading ? (
        <div className="module-graph-loading">
          <Spin />
        </div>
      ) : (
        <div className="module-graph-wrapper" onMouseMove={handleMouseMove}>
          {/* @ts-ignore */}
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredGraphData}
            nodeCanvasObject={nodeCanvasObject}
            linkCanvasObject={linkCanvasObject}
            nodeRelSize={6}
            linkWidth={1}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            // 禁用原生滚轮事件处理，使用我们自定义的平滑缩放
            enableZoomInteraction={false}
            // 使用内置tooltip
            nodeLabel={(node: GraphNode) => {
              let tooltipContent = node.name;
              if (node.overview) {
                tooltipContent += `\n\n${node.overview}`;
              }
              return tooltipContent;
            }}
            // 降低预热迭代次数，更快完成初始布局
            warmupTicks={50}
            // 降低降温迭代次数，加快布局完成
            cooldownTicks={50}
            // 减少最长运行时间
            cooldownTime={2000}
            // 设置更低的alpha最小值，使模拟更快停止
            d3AlphaMin={0.001}
            // 微调alpha衰减速度，使模拟更快收敛
            d3AlphaDecay={0.015}
            // 增加速度衰减，使节点稳定性更好
            d3VelocityDecay={0.4}
            // 设置最小/最大缩放比例，防止过度缩小/放大
            minZoom={0.5}
            maxZoom={8}
            // 监听缩放事件，更新当前缩放比例
            onZoom={handleZoom}
            // 渲染后执行，用于绘制坐标系
            onRenderFramePost={(ctx, globalScale) => showCoordinateSystem && drawCoordinateSystem(ctx, globalScale)}
            onEngineStop={() => {
              if (!hasAutoFitted.current) {
                // 获取画布容器中心
                const containerElem = document.querySelector('.module-graph-wrapper');
                if (containerElem && graphRef.current) {
                  const width = containerElem.clientWidth;
                  const height = containerElem.clientHeight;
                  const centerX = width / 2;
                  const centerY = height / 2;
                  
                  // 直接居中到容器中心（引力中心）
                  graphRef.current.centerAt(centerX, centerY, 200);
                  
                  // 短暂延迟后再适应视图大小以确保所有节点可见
                  setTimeout(() => {
                    zoomToFit(200);
                    hasAutoFitted.current = true;
                  }, 250);
                } else {
                  // 如果无法获取容器，直接适应视图
                  zoomToFit(200);
                  hasAutoFitted.current = true;
                }
              }
            }}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.003}
            linkDirectionalParticleWidth={4}
            linkDirectionalParticleColor={link => link.isRelated ? '#1890ff' : '#d9d9d9'}
          />
          {/* 图例 */}
          <div className="module-graph-legend">
            <div className="legend-title">图例</div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-blue"></span>
              当前模块
            </div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-green"></span>
              内容页
            </div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-purple"></span>
              顶级模块
            </div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-gray"></span>
              普通模块
            </div>
            <div className="legend-row">
              <span className="legend-line legend-line-blue"></span>
              关联关系
            </div>
            <div className="legend-row">
              <span className="legend-line legend-line-gray"></span>
              层级关系
            </div>
          </div>
          {/* 缩放控制 */}
          <div className="zoom-controls">
            <button className="control-button" onClick={zoomIn} title="放大">
              <ZoomInOutlined />
            </button>
            <div className="zoom-scale-display">
              {(currentScale * 100).toFixed(0)}%
            </div>
            <button className="control-button" onClick={zoomOut} title="缩小">
              <ZoomOutOutlined />
            </button>
            <button className="control-button" onClick={resetZoom} title="重置缩放">
              <FullscreenOutlined />
            </button>
          </div>
          {/* 布局计算指示器 */}
          {!hasAutoFitted.current && !loading && (
            <div className="layout-calculating-overlay">
              <div className="layout-calculating-indicator">
                <Spin size="small" />
                <span>优化布局中...</span>
              </div>
            </div>
          )}
          {/* 使用ForceGraph2D内置tooltip，不需要自定义tooltip */}
        </div>
      )}
    </div>
  );
});

export default ModuleGraph; 