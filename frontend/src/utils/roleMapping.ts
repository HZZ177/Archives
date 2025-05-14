/**
 * 角色映射工具
 * 
 * 前端和后端角色值映射关系：
 * 前端显示角色 -> 后端存储的access_level
 * owner -> owner （所有者）
 * admin -> admin （管理员）
 * member -> write （成员，可编辑内容但不能修改设置）
 * guest -> read （访客，只读权限）
 */

// 前端角色配置（用于显示）
export const roleConfig = [
  { value: 'owner', label: '所有者', color: 'gold', description: '完全控制权限，可以管理所有内容和设置' },
  { value: 'admin', label: '管理员', color: 'red', description: '可以管理大多数内容和设置，但无法删除工作区' },
  { value: 'member', label: '成员', color: 'blue', description: '可以查看和编辑内容，但无法更改关键设置' },
  { value: 'guest', label: '访客', color: 'green', description: '仅可查看权限，无法编辑内容' }
];

// 前端角色选项（用于下拉选择）
export const roleOptions = roleConfig.map(role => ({ value: role.value, label: role.label }));

// 前端角色 -> 后端access_level的映射
export const roleToAccessLevel: Record<string, 'owner' | 'admin' | 'write' | 'read'> = {
  'owner': 'owner',
  'admin': 'admin',
  'member': 'write',  // 成员对应write权限
  'guest': 'read'     // 访客对应read权限
};

// 后端access_level -> 前端角色的映射
export const accessLevelToRole: Record<string, 'owner' | 'admin' | 'member' | 'guest'> = {
  'owner': 'owner',
  'admin': 'admin',
  'write': 'member',  // write权限对应成员
  'read': 'guest'     // read权限对应访客
};

// 获取角色标签颜色
export const getRoleColor = (role: string): string => {
  const roleInfo = roleConfig.find(r => r.value === role);
  return roleInfo?.color || 'default';
};

// 获取角色显示名称
export const getRoleLabel = (role: string): string => {
  const roleInfo = roleConfig.find(r => r.value === role);
  return roleInfo?.label || role;
};

// 获取角色描述
export const getRoleDescription = (role: string): string => {
  const roleInfo = roleConfig.find(r => r.value === role);
  return roleInfo?.description || '';
};

// 获取有效角色（处理API返回的数据，确保前端显示一致）
export const getEffectiveRole = (record: any): string => {
  // 如果有role字段，优先使用
  if (record.role) {
    // 如果role是后端access_level格式，则转换为前端角色格式
    if (['write', 'read'].includes(record.role)) {
      return accessLevelToRole[record.role];
    }
    return record.role;
  }
  
  // 如果有access_level字段，转换为前端角色格式
  if (record.access_level) {
    return accessLevelToRole[record.access_level] || 'guest';
  }
  
  // 默认返回访客角色
  return 'guest';
}; 