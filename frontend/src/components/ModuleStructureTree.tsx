import React, { useState, useEffect } from 'react';
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

// 将展开状态保存到localStorage
const saveExpandedKeysToStorage = (keys: Key[]) => {
  try {
    localStorage.setItem(STORAGE_EXPANDED_KEYS, JSON.stringify(keys));
  } catch (error) {
    console.error('保存展开状态失败:', error);
  }
};

// 将ModuleStructureNode转换为Tree组件所需的DataNode
interface TreeDataNode {
  key: string;
  title: string;
  isLeaf: boolean;
  icon: React.ReactNode;
  children?: TreeDataNode[];
}

const convertToTreeData = (nodes: ModuleStructureNode[]): TreeDataNode[] => {
  return nodes.map(node => ({
    key: node.id.toString(),
    title: node.name,
    isLeaf: node.is_content_page,
    icon: node.is_content_page ? <FileTextOutlined /> : <FolderOutlined />,
    children: node.children && node.children.length > 0 
      ? convertToTreeData(node.children) 
      : undefined
  }));
};

const ModuleStructureTree: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>(getStoredExpandedKeys());
  const navigate = useNavigate();
  const location = useLocation();

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
  const getAllKeys = (nodes: any[]): Key[] => {
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
  };

  // 监听全局刷新事件
  useEffect(() => {
    const handleRefreshEvent = () => {
      loadModuleTree();
    };
    
    // 添加刷新事件监听器
    window.addEventListener('refreshModuleTree', handleRefreshEvent);
    
    // 清理监听器
    return () => {
      window.removeEventListener('refreshModuleTree', handleRefreshEvent);
    };
  }, []);

  // 初始加载
  useEffect(() => {
    loadModuleTree();
  }, []);

  // 从当前URL中高亮选中的节点
  useEffect(() => {
    const path = location.pathname;
    const moduleIdMatch = path.match(/\/module-content\/(\d+)/);
    
    if (moduleIdMatch) {
      const moduleId = moduleIdMatch[1];
      // 设置选中的节点，但不触发导航
      // 这里只是视觉上的选中效果
      const selectedKeys = [moduleId];
      setSelectedKeys(selectedKeys);
    }
  }, [location]);

  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

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