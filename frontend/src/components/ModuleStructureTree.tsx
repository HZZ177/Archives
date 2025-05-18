import React, { useState, useEffect, useRef } from 'react';
import { Tree, Spin } from 'antd';
import { FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { ModuleStructureNode } from '../types/modules';
import { fetchModuleTree } from '../apis/moduleService';
import { Key } from 'rc-tree/lib/interface';

// localStorage键名常量，用于保存树的展开状态
const STORAGE_EXPANDED_KEYS = 'module_structure_tree_expanded_keys';

// 从localStorage获取存储的展开状态
const getStoredExpandedKeys = (): Key[] => {
  try {
    const storedKeys = localStorage.getItem(STORAGE_EXPANDED_KEYS);
    return storedKeys ? JSON.parse(storedKeys) : [];
  } catch (error) {
    console.error('读取展开状态失败:', error);
    return [];
  }
};

// 保存展开状态到localStorage
const saveExpandedKeysToStorage = (keys: Key[]) => {
  try {
    localStorage.setItem(STORAGE_EXPANDED_KEYS, JSON.stringify(keys));
  } catch (error) {
    console.error('保存展开状态失败:', error);
  }
};

interface TreeDataNode {
  key: string;
  title: string;
  isLeaf: boolean;
  icon: React.ReactNode;
  children?: TreeDataNode[];
  originNode?: ModuleStructureNode;
}

// 递归查找节点路径
const findNodePath = (nodes: TreeDataNode[], targetKey: string): string[] => {
  const path: string[] = [];
  const findPath = (node: TreeDataNode): boolean => {
    if (node.key === targetKey) {
      path.push(node.key);
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (findPath(child)) {
          path.unshift(node.key);
          return true;
        }
      }
    }
    return false;
  };
  for (const node of nodes) {
    if (findPath(node)) {
      break;
    }
  }
  return path;
};

const convertToTreeData = (nodes: ModuleStructureNode[]): TreeDataNode[] => {
  return nodes.map(node => ({
    key: node.id.toString(),
    title: node.name,
    isLeaf: node.is_content_page,
    icon: node.is_content_page ? <FileTextOutlined /> : <FolderOutlined />,
    children: node.children && node.children.length > 0 
      ? convertToTreeData(node.children) 
      : undefined,
    originNode: node
  }));
};

const ModuleStructureTree: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>(getStoredExpandedKeys());
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [hasAutoLocated, setHasAutoLocated] = useState<boolean>(false); // 标志位，防止重复自动定位
  const navigate = useNavigate();
  const location = useLocation();
  const lastLocatedKeyRef = useRef<string | null>(null); // 记录上一次定位的key，避免重复

  // 获取模块结构树
  const loadModuleTree = async () => {
    try {
      setLoading(true);
      const response = await fetchModuleTree();
      const modules = Array.isArray(response) ? response : response.items || [];
      const treeNodes = convertToTreeData(modules);
      setTreeData(treeNodes);
      // 如果localStorage中没有存储的展开状态，默认展开所有节点
      if (expandedKeys.length === 0) {
        const allKeys = getAllKeys(treeNodes);
        setExpandedKeys(allKeys);
        saveExpandedKeysToStorage(allKeys);
      }
      setLoading(false);
    } catch (error) {
      console.error('加载模块结构树失败:', error);
      setLoading(false);
    }
  };

  // 获取所有节点的key
  const getAllKeys = (nodes: TreeDataNode[]): Key[] => {
    let keys: Key[] = [];
    nodes.forEach(node => {
      keys.push(node.key);
      if (node.children) {
        keys = [...keys, ...getAllKeys(node.children)];
      }
    });
    return keys;
  };

  // 处理树节点展开/折叠
  const handleExpand = (expandedKeys: Key[]) => {
    setExpandedKeys(expandedKeys);
    saveExpandedKeysToStorage(expandedKeys);
    setHasAutoLocated(true); // 用户手动操作后，关闭自动定位
  };

  // 处理树节点点击
  const handleSelect = (selectedKeys: Key[], info: any) => {
    const nodeId = selectedKeys[0]?.toString();
    if (nodeId) {
      // 如果是内容页面，导航到模块内容页
      if (info.node.isLeaf) {
        navigate(`/module-content/${nodeId}`);
      } else {
        // 如果是文件夹节点，可以选择导航到结构管理页面
        // 或者展开/折叠该节点，这里我们选择导航到结构管理并传递nodeId参数
        navigate(`/structure-management?nodeId=${nodeId}`);
      }
    }
    setHasAutoLocated(true); // 用户手动操作后，关闭自动定位
  };

  // 自动定位并展开到目标节点
  const autoLocateAndExpandToNode = () => {
    const path = location.pathname;
    const moduleIdMatch = path.match(/\/module-content\/(\d+)/);
    if (moduleIdMatch && treeData.length > 0) {
      const moduleId = moduleIdMatch[1];
      if (lastLocatedKeyRef.current === moduleId && hasAutoLocated) return;
      const nodePath = findNodePath(treeData, moduleId);
      if (nodePath.length > 0) {
        const newExpandedKeys = [...new Set([...expandedKeys, ...nodePath])];
        setSelectedKeys([moduleId]);
        setExpandedKeys(newExpandedKeys);
        saveExpandedKeysToStorage(newExpandedKeys);
        setHasAutoLocated(true);
        lastLocatedKeyRef.current = moduleId;
      }
    }
  };

  // 监听全局刷新事件
  useEffect(() => {
    const handleRefreshEvent = () => {
      loadModuleTree();
      setHasAutoLocated(false); // 刷新后允许重新自动定位
    };
    window.addEventListener('refreshModuleTree', handleRefreshEvent);
    return () => {
      window.removeEventListener('refreshModuleTree', handleRefreshEvent);
    };
  }, []);

  // 初始加载
  useEffect(() => {
    loadModuleTree();
    setHasAutoLocated(false); // 加载新数据时允许自动定位
  }, []);

  // treeData变化或URL变化时，尝试自动定位
  useEffect(() => {
    if (!hasAutoLocated) {
      autoLocateAndExpandToNode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeData, location.pathname]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '8px' }}>
      <Spin spinning={loading}>
        <Tree
          showIcon
          expandedKeys={expandedKeys}
          selectedKeys={selectedKeys}
          onExpand={handleExpand}
          onSelect={handleSelect}
          treeData={treeData}
        />
      </Spin>
    </div>
  );
};

export default ModuleStructureTree; 