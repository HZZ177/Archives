import React, { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ModuleStructureNode } from '../../types/modules';
import { fetchModuleTree, fetchModuleContent } from '../../apis/moduleService';
import { Tooltip, Button, Spin, Slider } from 'antd';
import './ModuleGraph.css';
import { AimOutlined, LinkOutlined, InfoCircleOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, SettingOutlined } from '@ant-design/icons';
import { message } from 'antd';

// 为window.d3添加类型声明
declare global {
  interface Window {
    d3: any; // d3库会被react-force-graph-2d自动注入到window对象中
  }
}

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
const ALPHA_TRANSITION_DURATION = 100; // 透明度过渡时间 (ms)
const NODE_DIM_ALPHA = 0.15;
const LINK_DIM_ALPHA = 0.08;

const DEFAULT_CHARGE = 40; // 斥力默认值（正数，UI展示）
const DEFAULT_CENTER_STRENGTH = 0.6; // 引力默认值
const DEFAULT_LINK_DISTANCE = 30; // 链接长度默认值

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

  // 新增：状态用于存储节点的动画透明度
  const [animatedNodeAlphas, setAnimatedNodeAlphas] = useState<{ [id: number]: number }>({});
  const [animatedLinkAlphas, setAnimatedLinkAlphas] = useState<{ [key: string]: number }>({});
  const alphaAnimationRef = useRef<number>();

  // 新增：可调节参数状态
  const [chargeStrength, setChargeStrength] = useState(DEFAULT_CHARGE);
  const [centerStrength, setCenterStrength] = useState(DEFAULT_CENTER_STRENGTH);
  const [linkDistance, setLinkDistance] = useState(DEFAULT_LINK_DISTANCE);

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
        // 新增：数据加载后立即定位
        setTimeout(() => {
          const containerElem = document.querySelector('.module-graph-wrapper');
          if (containerElem && graphRef.current) {
            const width = containerElem.clientWidth;
            const height = containerElem.clientHeight;
            const centerX = width / 2;
            const centerY = height / 2;
            graphRef.current.centerAt(centerX + 80, centerY + 60, 0);
          }
        }, 0);
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

  // 配置力布局参数（用可调节参数）
  useEffect(() => {
    if (graphRef.current && graphRef.current.d3Force) {
      const containerElem = document.querySelector('.module-graph-wrapper');
      let centerX = 0, centerY = 0;
      if (containerElem) {
        const width = containerElem.clientWidth;
        const height = containerElem.clientHeight;
        centerX = width / 2;
        centerY = height / 2;
      }
      // 设置斥力（取负值）
      const charge = graphRef.current.d3Force('charge');
      if (charge) {
        charge.strength(-chargeStrength).distanceMax(50);
      }
      // 设置中心引力
      const center = graphRef.current.d3Force('center');
      if (center) {
        center.x(centerX).y(centerY).strength(centerStrength);
      }
      // 设置链条长度
      const link = graphRef.current.d3Force('link');
      if (link) {
        link.distance(linkDistance);
      }
      
      // 添加径向力约束，防止节点被无限推远
      try {
        // 尝试获取或创建径向力
        let radial = graphRef.current.d3Force('radial');
        
        // 如果径向力不存在，尝试添加一个
        if (!radial && window.d3) {
          const radius = Math.min(containerElem ? containerElem.clientWidth : 300, containerElem ? containerElem.clientHeight : 300) / 2;
          radial = window.d3.forceRadial(radius * 0.8, centerX, centerY).strength(0.05);
          graphRef.current.d3Force('radial', radial);
          
          // 创建节点连接映射，识别孤立节点
          const nodeConnections = new Map();
          graphData.nodes.forEach(node => nodeConnections.set(node.id, 0));
          
          graphData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
            const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
            nodeConnections.set(sourceId, (nodeConnections.get(sourceId) || 0) + 1);
            nodeConnections.set(targetId, (nodeConnections.get(targetId) || 0) + 1);
          });
          
          // 为孤立节点设置更强的径向力
          radial.strength((node: any) => {
            const connections = nodeConnections.get(node.id) || 0;
            return connections === 0 ? 0.12 : 0.05; // 孤立节点使用更强的径向力
          });
        }
      } catch (error) {
        console.error("添加径向力失败:", error);
      }
    }
    // 新增：参数变化后主动重启仿真
    if (graphRef.current && graphRef.current.d3ReheatSimulation) {
      graphRef.current.d3ReheatSimulation();
    }
  }, [graphData, chargeStrength, centerStrength, linkDistance]);

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

  // 只自适应缩放，不做定位
  const zoomToFit = useCallback((duration = 400) => {
    if (graphRef.current && filteredGraphData.nodes.length > 0) {
      const nodes = filteredGraphData.nodes;
      const containerElem = document.querySelector('.module-graph-wrapper');
      if (!containerElem) {
        // 如果找不到容器，使用默认缩放
        graphRef.current.zoom(1, duration);
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
      if (validNodes === 0 || !isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        graphRef.current.zoom(1, duration);
        return;
      }
      // 计算图谱的宽高
      const graphWidth = maxX - minX || 1;
      const graphHeight = maxY - minY || 1;
      // 计算合适的缩放比例
      const widthRatio = graphWidth / containerWidth;
      const heightRatio = graphHeight / containerHeight;
      let baseRatio = Math.max(widthRatio, heightRatio);
      // 基础padding比例，容器尺寸的百分比
      let paddingRatio = 0.1;
      if (nodes.length <= 3) {
        paddingRatio = 0.15;
      } else if (nodes.length <= 10) {
        paddingRatio = 0.12;
      } else if ((validNodes / (graphWidth * graphHeight)) > 0.0001) {
        paddingRatio = 0.08;
      }
      const minDimension = Math.min(containerWidth, containerHeight);
      let padding = minDimension * paddingRatio;
      // 计算缩放倍率（只考虑缩放，不做平移）
      let scale = 1 / (baseRatio + (padding / minDimension));
      // 限制缩放范围
      scale = Math.max(0.5, Math.min(2.5, scale));
      graphRef.current.zoom(scale, duration);
    } else if (graphRef.current) {
      graphRef.current.zoom(1, duration);
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
  
  // 新增：当图数据变化时，重置动画透明度为1.0
  useEffect(() => {
    const initialNodes: { [id: number]: number } = {};
    graphData.nodes.forEach(node => initialNodes[node.id] = 1.0);
    setAnimatedNodeAlphas(initialNodes);

    const initialLinks: { [key: string]: number } = {};
    graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as GraphNode).id : link.source as number;
        const targetId = typeof link.target === 'object' && link.target !== null ? (link.target as GraphNode).id : link.target as number;
        initialLinks[`${sourceId}-${targetId}`] = 1.0;
    });
    setAnimatedLinkAlphas(initialLinks);
  }, [graphData.nodes, graphData.links]);

  // 新增：当高亮节点或链接变化时，启动透明度动画
  useEffect(() => {
    const currentAnimatedNodeAlphas = { ...animatedNodeAlphas };
    const currentAnimatedLinkAlphas = { ...animatedLinkAlphas };

    let startTime: number | null = null;

    const animateAlphas = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const progress = Math.min(elapsedTime / ALPHA_TRANSITION_DURATION, 1);

      const newAlphasNodes: { [id: number]: number } = {};
      graphData.nodes.forEach(node => {
        const isNodeHighlighted = highlightedNodeIds.size === 0 || highlightedNodeIds.has(node.id);
        const targetAlpha = highlightedNodeIds.size === 0 ? 1.0 : (isNodeHighlighted ? 1.0 : NODE_DIM_ALPHA);
        const initialAlpha = currentAnimatedNodeAlphas[node.id] !== undefined ? currentAnimatedNodeAlphas[node.id] : 1.0;
        newAlphasNodes[node.id] = initialAlpha + (targetAlpha - initialAlpha) * progress;
      });

      const newAlphasLinks: { [key: string]: number } = {};
      graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as GraphNode).id : link.source as number;
        const targetId = typeof link.target === 'object' && link.target !== null ? (link.target as GraphNode).id : link.target as number;
        const key = `${sourceId}-${targetId}`;
        const isLinkHighlightedForAnim = highlightedLinkKeys.size === 0 || highlightedLinkKeys.has(key);
        const targetAlpha = highlightedLinkKeys.size === 0 ? 1.0 : (isLinkHighlightedForAnim ? 1.0 : LINK_DIM_ALPHA);
        const initialAlpha = currentAnimatedLinkAlphas[key] !== undefined ? currentAnimatedLinkAlphas[key] : 1.0;
        newAlphasLinks[key] = initialAlpha + (targetAlpha - initialAlpha) * progress;
      });

      setAnimatedNodeAlphas(newAlphasNodes);
      setAnimatedLinkAlphas(newAlphasLinks);

      if (progress < 1) {
        alphaAnimationRef.current = requestAnimationFrame(animateAlphas);
      } else {
        // Ensure final state is set precisely after animation
        const finalNodes: { [id: number]: number } = {};
         graphData.nodes.forEach(node => {
            const isNodeHighlighted = highlightedNodeIds.size === 0 || highlightedNodeIds.has(node.id);
            finalNodes[node.id] = highlightedNodeIds.size === 0 ? 1.0 : (isNodeHighlighted ? 1.0 : NODE_DIM_ALPHA);
        });
        setAnimatedNodeAlphas(finalNodes);

        const finalLinks: { [key: string]: number } = {};
        graphData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as GraphNode).id : link.source as number;
            const targetId = typeof link.target === 'object' && link.target !== null ? (link.target as GraphNode).id : link.target as number;
            const key = `${sourceId}-${targetId}`;
            const isLinkHighlightedForAnim = highlightedLinkKeys.size === 0 || highlightedLinkKeys.has(key);
            finalLinks[key] = highlightedLinkKeys.size === 0 ? 1.0 : (isLinkHighlightedForAnim ? 1.0 : LINK_DIM_ALPHA);
        });
        setAnimatedLinkAlphas(finalLinks);
      }
    };

    if (alphaAnimationRef.current) {
      cancelAnimationFrame(alphaAnimationRef.current);
    }
    alphaAnimationRef.current = requestAnimationFrame(animateAlphas);

    return () => {
      if (alphaAnimationRef.current) {
        cancelAnimationFrame(alphaAnimationRef.current);
      }
    };
  }, [highlightedNodeIds, highlightedLinkKeys, graphData.nodes, graphData.links]); // Removed animatedNodeAlphas, animatedLinkAlphas from deps to avoid re-triggering

  // 自定义节点渲染
  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12/globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

    // 使用动画透明度
    ctx.globalAlpha = animatedNodeAlphas[node.id] !== undefined ? animatedNodeAlphas[node.id] : 1.0;

    // 脉冲高亮动画
    if (node.id === highlightedNodeId) {
      const t = (pulseFrame % 1000) / 1000;
      const pulseRadius = 5 + 5 * Math.abs(Math.sin(t * Math.PI));
      const pulseAlpha = 0.5 + 0.3 * Math.abs(Math.sin(t * Math.PI));
      // Preserve current animated alpha for pulse, then restore
      const currentGlobalAlpha = ctx.globalAlpha;
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, pulseRadius, 0, 2 * Math.PI, false);
      ctx.strokeStyle = '#faad14';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffd666';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = pulseAlpha * currentGlobalAlpha; // Modulate pulse alpha with base animated alpha
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = currentGlobalAlpha; // Restore base animated alpha
    }

    // 设置节点样式
    ctx.fillStyle = node.isCurrentModule ? '#1890ff' :
                   node.isTopLevel ? '#722ed1' :  // 顶级节点使用紫色
                   node.isContentPage ? '#52c41a' : '#d9d9d9';
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, 5, 0, 2 * Math.PI, false);
    ctx.fill();

    const minScale = 1.2;
    const maxScale = 2;
    let textAlpha = 0;
    if (globalScale >= maxScale) {
        textAlpha = 1;
    } else if (globalScale > minScale) {
        textAlpha = (globalScale - minScale) / (maxScale - minScale);
    }
    
    if (textAlpha > 0) {
        const baseNodeAlpha = animatedNodeAlphas[node.id] !== undefined ? animatedNodeAlphas[node.id] : 1.0;
        // 移除背景色绘制
        // ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * textAlpha * baseNodeAlpha})`;
        // ctx.fillRect(
        //     node.x! - bckgDimensions[0] / 2,
        //     node.y! + 8,
        //     bckgDimensions[0],
        //     bckgDimensions[1]
        // );
        ctx.fillStyle = `rgba(0, 0, 0, ${textAlpha * baseNodeAlpha})`;
        ctx.fillText(
            label,
            node.x!,
            node.y! + 8 + bckgDimensions[1] / 2
        );
    }
    
    ctx.globalAlpha = 1; // Reset for next node by ForceGraph2D convention
  }, [highlightedNodeId, pulseFrame, animatedNodeAlphas]); // Added animatedNodeAlphas

  // 自定义连接渲染
  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const { source, target, isRelated } = link as any;
    const start = { x: source.x, y: source.y };
    const end = { x: target.x, y: target.y };
    const key = `${source.id}-${target.id}`;
    
    // 使用动画透明度
    ctx.globalAlpha = animatedLinkAlphas[key] !== undefined ? animatedLinkAlphas[key] : 1.0;
    ctx.strokeStyle = isRelated ? '#1890ff' : '#d9d9d9';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    ctx.globalAlpha = 1; // Reset for next link
  }, [animatedLinkAlphas]); // Added animatedLinkAlphas

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
      if (graphRef.current) {
        // 同时设置缩放和中心位置，使用相同的动画持续时间
        graphRef.current.zoom(3.5, 600); // 缩放到350%
        graphRef.current.centerAt(currentNode.x + 50, currentNode.y + 60, 500); // 不指定缩放比例
      }
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
  
  // 辅助函数：检查链路是否高亮
  const isLinkHighlighted = useCallback((link: any) => {
    // 安全地获取source和target的id
    const sourceId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
    const key = `${sourceId}-${targetId}`;
    return highlightedLinkKeys.size === 0 || highlightedLinkKeys.has(key);
  }, [highlightedLinkKeys]);
  


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
      {/* 参数调节面板 */}
      <div className="graph-param-panel">
        <div className="param-row">
          <span className="param-label">
            斥力
            <Tooltip title="斥力强度，数值越大节点越分散。">
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#888', cursor: 'pointer' }} />
            </Tooltip>
          </span>
          <Slider
            min={10}
            max={200}
            step={1}
            value={chargeStrength}
            onChange={setChargeStrength}
            style={{ width: 120 }}
          />
          <span className="param-value">{chargeStrength}</span>
        </div>
        <div className="param-row">
          <span className="param-label">
            引力
            <Tooltip title="控制所有节点向中心靠拢的强度，越大越集中。">
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#888', cursor: 'pointer' }} />
            </Tooltip>
          </span>
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={centerStrength}
            onChange={setCenterStrength}
            style={{ width: 120 }}
          />
          <span className="param-value">{centerStrength}</span>
        </div>
        <div className="param-row">
          <span className="param-label">
            链长
            <Tooltip title="控制节点之间连线的理想长度，越大节点间距越远。">
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#888', cursor: 'pointer' }} />
            </Tooltip>
          </span>
          <Slider
            min={10}
            max={200}
            step={1}
            value={linkDistance}
            onChange={setLinkDistance}
            style={{ width: 120 }}
          />
          <span className="param-value">{linkDistance}</span>
        </div>
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
            d3AlphaDecay={0.02}
            // 增加速度衰减，使节点稳定性更好
            d3VelocityDecay={0.5}
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
                  // 只做缩放，不再centerAt
                  zoomToFit(500);
                  hasAutoFitted.current = true;
                } else {
                  zoomToFit(500);
                  hasAutoFitted.current = true;
                }
              }
            }}
            linkDirectionalParticles={link => isLinkHighlighted(link) ? 2 : 1} // 高亮2个粒子，非高亮1个
            linkDirectionalParticleSpeed={0.003}
            linkDirectionalParticleWidth={link => isLinkHighlighted(link) ? 4 : 2} // 高亮粒子更大
            linkDirectionalParticleColor={link => {
              const isHighlighted = isLinkHighlighted(link);
              const baseColor = (link as any).isRelated ? '#1890ff' : '#d9d9d9';
              
              // 如果没有高亮状态或当前链路被高亮，使用完全不透明的颜色
              if (isHighlighted) {
                return baseColor;
              }
              
              // 否则，返回半透明的颜色
              // 将颜色转换为rgba格式，设置透明度为0.3
              return baseColor === '#1890ff' ? 'rgba(24, 144, 255, 0.5)' : 'rgba(217, 217, 217, 0.5)';
            }}
          />
          {/* 图例 */}
          <div className="module-graph-legend">
            <div className="legend-title">图例</div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-blue"></span>
              当前节点
            </div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-green"></span>
              内容页
            </div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-purple"></span>
              顶级节点
            </div>
            <div className="legend-row">
              <span className="legend-dot legend-dot-gray"></span>
              普通节点
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
          {/* 缩放控制面板 */}
          <div className="zoom-controls">
            <Tooltip title="缩小">
              <Button className="control-button" icon={<ZoomOutOutlined />} onClick={zoomOut} />
            </Tooltip>
            <span className="zoom-scale-display">{(currentScale * 100).toFixed(0)}%</span>
            <Tooltip title="放大">
              <Button className="control-button" icon={<ZoomInOutlined />} onClick={zoomIn} />
            </Tooltip>
            <Tooltip title="适应屏幕">
              <Button className="control-button" icon={<FullscreenOutlined />} onClick={resetZoom} />
            </Tooltip>
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