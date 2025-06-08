import React, { useState, useEffect } from 'react';
import { Table, Switch, message, Button, Space, Card, Tag } from 'antd';
import { DragOutlined, ReloadOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { updateModuleSectionConfig, getModuleSectionConfig } from '../../../apis/moduleService';
import './ModuleSectionConfig.css';

// 模块类型枚举
enum ModuleType {
  DEFAULT = 0,
  MARKDOWN = 1,
  MINDMAP = 2,
  DIAGRAM = 3,
  CODE = 4,
  TABLE = 5,
  DATABASE_TABLE = 6,
  API_INTERFACE = 7,
  MODULE_RELATION = 8,
  REFERENCE_LIST = 9,
  GLOSSARY = 10
}

interface ModuleSection {
  id: number;
  section_key: string;
  section_name: string;
  section_icon: string;
  section_type: number;
  is_enabled: boolean;
  display_order: number;
}

// 筛选类型: 'all' | 'enabled' | 'disabled'
type FilterType = 'all' | 'enabled' | 'disabled';

// 模块类型映射
const moduleTypeMap: Record<number, { label: string; color: string }> = {
  [ModuleType.DEFAULT]: { label: '默认', color: 'default' },
  [ModuleType.MARKDOWN]: { label: 'Markdown', color: 'blue' },
  [ModuleType.MINDMAP]: { label: '脑图', color: 'green' },
  [ModuleType.DIAGRAM]: { label: '流程图', color: 'purple' },
  [ModuleType.CODE]: { label: '代码', color: 'magenta' },
  [ModuleType.TABLE]: { label: '表格', color: 'orange' },
  [ModuleType.DATABASE_TABLE]: { label: '数据库表', color: 'cyan' },
  [ModuleType.API_INTERFACE]: { label: 'API接口', color: 'geekblue' },
  [ModuleType.MODULE_RELATION]: { label: '模块关系', color: 'gold' },
  [ModuleType.REFERENCE_LIST]: { label: '引用列表', color: 'lime' },
  [ModuleType.GLOSSARY]: { label: '术语表', color: 'volcano' }
};

const ModuleSectionConfig: React.FC = () => {
  const [sections, setSections] = useState<ModuleSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await getModuleSectionConfig();
      setSections(response.data.data || []);
      // 重置筛选状态
      setFilterType('all');
    } catch (error) {
      message.error('加载模块配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          display_order: index + 1
        }));

        // 保存新的顺序
        saveConfig(newItems);
        
        return newItems;
      });
    }
  };

  const handleToggle = async (id: number, checked: boolean) => {
    try {
      const newSections = sections.map(section => 
        section.id === id ? { ...section, is_enabled: checked } : section
      );
      
      await saveConfig(newSections);
      setSections(newSections);
      message.success('更新成功');
    } catch (error) {
      message.error('更新失败');
    }
  };

  const saveConfig = async (newSections: ModuleSection[]) => {
    try {
      await updateModuleSectionConfig(newSections);
      // 更新本地存储
      localStorage.setItem('moduleSections', JSON.stringify(newSections));
    } catch (error) {
      message.error('保存配置失败');
    }
  };

  // 处理标签点击筛选
  const handleFilterChange = (type: FilterType) => {
    setFilterType(type);
  };

  // 根据筛选类型过滤数据
  const filteredSections = sections.filter(section => {
    if (filterType === 'all') return true;
    if (filterType === 'enabled') return section.is_enabled;
    if (filterType === 'disabled') return !section.is_enabled;
    return true;
  });

  // 计算已启用和禁用的模块数量
  const enabledCount = sections.filter(section => section.is_enabled).length;
  const disabledCount = sections.length - enabledCount;

  // 获取模块类型显示信息
  const getModuleTypeInfo = (type: number) => {
    return moduleTypeMap[type] || { label: '未知', color: 'default' };
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sort',
      width: 80,
      className: 'drag-visible',
      align: 'center' as 'center',
      render: () => <DragOutlined className="drag-handle" />,
    },
    {
      title: '模块名称',
      dataIndex: 'section_name',
      key: 'section_name',
      width: '25%',
      ellipsis: true,
    },
    {
      title: '模块标识',
      dataIndex: 'section_key',
      key: 'section_key',
      width: '20%',
      ellipsis: true,
    },
    {
      title: '模块类型',
      dataIndex: 'section_type',
      key: 'section_type',
      width: '15%',
      align: 'center' as 'center',
      render: (type: number) => {
        const typeInfo = getModuleTypeInfo(type);
        return <Tag color={typeInfo.color}>{typeInfo.label}</Tag>;
      },
    },
    {
      title: '图标',
      dataIndex: 'section_icon',
      key: 'section_icon',
      width: '10%',
      align: 'center' as 'center',
      render: (icon: string) => <span className="module-icon">{icon}</span>,
    },
    {
      title: '启用状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: '10%',
      align: 'center' as 'center',
      render: (_: any, record: ModuleSection) => (
        <Switch
          checked={record.is_enabled}
          onChange={(checked) => handleToggle(record.id, checked)}
        />
      ),
    },
  ];

  const SortableItem = ({ children, ...props }: any) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: props['data-row-key'] });

    const style: React.CSSProperties = {
      ...props.style,
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      background: isDragging ? '#fafafa' : undefined,
    };

    return (
      <tr {...props} ref={setNodeRef} style={style} {...attributes}>
        {React.Children.map(children, (child) => {
          if (child.props.className?.includes('drag-visible')) {
            return React.cloneElement(child, {
              ...child.props,
              children: (
                <div {...listeners} style={{ cursor: 'move', touchAction: 'none' }}>
                  <DragOutlined />
                </div>
              ),
            });
          }
          return child;
        })}
      </tr>
    );
  };

  return (
    <div className="module-section-config">
      <Card className="config-card">
        <div className="config-header">
          <div>
            <h2>页面模块配置</h2>
            <div className="module-summary">
              <Tag 
                color={filterType === 'all' ? 'blue' : 'default'} 
                style={{ cursor: 'pointer' }}
                onClick={() => handleFilterChange('all')}
              >
                总计: {sections.length}
              </Tag>
              <Tag 
                color={filterType === 'enabled' ? 'success' : 'default'} 
                style={{ cursor: 'pointer' }}
                onClick={() => handleFilterChange(filterType === 'enabled' ? 'all' : 'enabled')}
              >
                已启用: {enabledCount}
              </Tag>
              <Tag 
                color={filterType === 'disabled' ? 'error' : 'default'} 
                style={{ cursor: 'pointer' }}
                onClick={() => handleFilterChange(filterType === 'disabled' ? 'all' : 'disabled')}
              >
                已禁用: {disabledCount}
              </Tag>
            </div>
          </div>
        </div>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={sections.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table
              components={{
                body: {
                  row: SortableItem,
                },
              }}
              rowKey="id"
              columns={columns}
              dataSource={filteredSections}
              loading={loading}
              pagination={false}
              size="middle"
              bordered
              className="module-table"
              rowClassName={(record, index) => index % 2 === 0 ? 'even-row' : 'odd-row'}
            />
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
};

export default ModuleSectionConfig; 