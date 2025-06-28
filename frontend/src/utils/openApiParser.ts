import { ApiParam } from '../types/modules';
import { WorkspaceInterfaceCreate } from '../types/workspace';

// 导入预览的接口项
export interface ImportPreviewItem extends Omit<WorkspaceInterfaceCreate, 'workspace_id'> {
  selected: boolean; // 是否选中导入
}

// 导入结果
export interface ImportResult {
  success: boolean;
  message: string;
  previewList: ImportPreviewItem[];
}

/**
 * 解析OpenAPI格式，转换为系统接口格式
 * @param fileContent OpenAPI文件内容
 * @returns 转换后的接口预览列表
 */
export function parseOpenApi(fileContent: string): ImportResult {
  try {
    const openApiData = JSON.parse(fileContent);
    
    // 检查是否为有效的OpenAPI/Swagger文档
    if (!openApiData.swagger && !openApiData.openapi) {
      return {
        success: false,
        message: '无效的OpenAPI文档格式',
        previewList: []
      };
    }
    
    // 存储所有definitions以便后续引用
    const definitions = openApiData.definitions || openApiData.components?.schemas || {};
    
    const previewList: ImportPreviewItem[] = [];
    
    // 处理paths对象中的每个路径
    if (openApiData.paths) {
      for (const path in openApiData.paths) {
        const pathItem = openApiData.paths[path];
        
        // 处理每个HTTP方法
        for (const method in pathItem) {
          // 跳过非HTTP方法的属性
          if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
            continue;
          }
          
          const operation = pathItem[method];
          
          // 获取内容类型
          const contentType = operation.consumes && operation.consumes.length > 0 
            ? operation.consumes[0] 
            : 'application/json';
          
          // 转换请求参数
          let requestParams: ApiParam[] = [];
          if (operation.parameters) {
            // 先处理所有非body参数
            const nonBodyParams = operation.parameters
              .filter((param: any) => param.in !== 'body')
              .map(convertParameter);
            
            requestParams = [...nonBodyParams];
            
            // 单独处理body参数，保留其层级结构
            const bodyParams = operation.parameters.filter((param: any) => param.in === 'body');
            
            for (const bodyParam of bodyParams) {
              if (bodyParam.schema) {
                // 创建body参数作为父级
                const bodyParamObj: ApiParam = {
                  name: bodyParam.name || 'body',
                  type: 'object',
                  required: !!bodyParam.required,
                  description: bodyParam.description || '请求体数据',
                  children: []
                };
                
                // 解析schema并作为body的子参数
                if (bodyParam.schema.$ref) {
                  // 引用类型，从definitions中获取实际结构
                  const refName = extractRefName(bodyParam.schema.$ref);
                  const refSchema = definitions[refName];
                  
                  if (refSchema) {
                    // 解析引用schema的子参数
                    bodyParamObj.children = extractSchemaProperties(refSchema, definitions);
                  }
                } else if (bodyParam.schema.properties) {
                  // 直接定义的对象类型
                  bodyParamObj.children = extractSchemaProperties(bodyParam.schema, definitions);
                }
                
                // 添加到请求参数列表
                requestParams.push(bodyParamObj);
              }
            }
          }
          
          // 转换响应参数
          let responseParams: ApiParam[] = [];
          if (operation.responses && operation.responses['200']) {
            const okResponse = operation.responses['200'];
            
            if (okResponse.schema) {
              // 判断是否为标准的BaseResponse格式
              if (okResponse.schema.$ref) {
                const refName = extractRefName(okResponse.schema.$ref);
                
                // 检查是否为BaseResponse类型
                if (refName.includes('BaseResponse') || refName.includes('«') && refName.includes('»')) {
                  // 这是一个通用响应格式，处理BaseResponse
                  responseParams = handleBaseResponse(refName, definitions);
                } else {
                  // 普通引用类型
                  const refSchema = definitions[refName];
                  if (refSchema) {
                    responseParams = extractSchemaProperties(refSchema, definitions);
                  }
                }
              } else if (okResponse.schema.properties) {
                // 直接定义的响应对象
                responseParams = extractSchemaProperties(okResponse.schema, definitions);
              }
            }
          }
          
          // 创建预览项
          previewList.push({
            path,
            method: method.toUpperCase(),
            description: operation.summary || operation.description || '',
            content_type: contentType,
            request_params_json: requestParams,
            response_params_json: responseParams,
            selected: true // 默认选中
          });
        }
      }
    }
    
    if (previewList.length === 0) {
      return {
        success: false,
        message: '未在文档中找到任何有效的API接口',
        previewList: []
      };
    }
    
    return {
      success: true,
      message: `成功解析 ${previewList.length} 个API接口`,
      previewList
    };
  } catch (error) {
    console.error('解析OpenAPI文件失败:', error);
    return {
      success: false,
      message: '解析OpenAPI文件失败，请确保文件格式正确',
      previewList: []
    };
  }
}

/**
 * 从Schema中提取属性作为参数列表
 * @param schema 对象Schema
 * @param definitions 所有定义
 * @returns 提取的参数列表
 */
function extractSchemaProperties(schema: any, definitions: any): ApiParam[] {
  if (!schema || !schema.properties) {
    return [];
  }
  
  const params: ApiParam[] = [];
  
  // 处理属性
  for (const propName in schema.properties) {
    const property = schema.properties[propName];
    const required = schema.required && schema.required.includes(propName);
    
    // 创建参数对象
    const param: ApiParam = {
      name: propName,
      type: property.type || 'string',
      required: required,
      description: property.description || '',
      example: property.example !== undefined ? String(property.example) : ''
    };
    
    // 处理引用类型
    if (property.$ref) {
      const refName = extractRefName(property.$ref);
      const refSchema = definitions[refName];
      
      param.type = 'object';
      
      if (refSchema && refSchema.properties) {
        param.children = extractSchemaProperties(refSchema, definitions);
      }
    } 
    // 处理数组类型
    else if (property.type === 'array' && property.items) {
      param.type = 'array';
      
      // 处理数组项的类型
      if (property.items.$ref) {
        const refName = extractRefName(property.items.$ref);
        const refSchema = definitions[refName];
        
        if (refSchema && refSchema.properties) {
          // 数组项是对象类型，提取其属性
          const arrayItemParam: ApiParam = {
            name: `${propName}Item`,
            type: 'object',
            required: true,
            description: `${propName}的数组项`,
            children: extractSchemaProperties(refSchema, definitions)
          };
          
          param.children = [arrayItemParam];
        }
      } else if (property.items.type) {
        // 数组项是基本类型
        param.children = [{
          name: `${propName}Item`,
          type: property.items.type,
          required: true,
          description: `${propName}的数组项`
        }];
      }
    } 
    // 处理对象类型
    else if (property.type === 'object' && property.properties) {
      param.children = extractSchemaProperties(property, definitions);
    }
    
    params.push(param);
  }
  
  return params;
}

/**
 * 从引用字符串中提取名称
 * @param ref 引用字符串，例如 #/definitions/SomeModel
 * @returns 提取的名称
 */
function extractRefName(ref: string): string {
  // 支持 OpenAPI 3.0 的引用格式 #/components/schemas/
  return ref.replace('#/definitions/', '').replace('#/components/schemas/', '');
}

/**
 * 处理BaseResponse类型的特殊响应
 * @param refName 引用名称
 * @param definitions 所有定义
 * @returns 处理后的API参数数组
 */
function handleBaseResponse(refName: string, definitions: any): ApiParam[] {
  // 首先尝试从引用名称中提取实际数据类型
  // 例如 BaseResponse«UserVO» 提取 UserVO
  let innerTypeName = '';
  const match = refName.match(/«(.+)»/);
  if (match && match[1]) {
    innerTypeName = match[1];
  }
  
  // 标准响应结构参数
  const params: ApiParam[] = [];
  
  // 添加标准字段
  params.push({
    name: 'requestId',
    type: 'string',
    required: false,
    description: '请求ID'
  });
  
  params.push({
    name: 'resultCode',
    type: 'integer',
    required: false,
    description: '结果代码'
  });
  
  params.push({
    name: 'resultMsg',
    type: 'string',
    required: false,
    description: '结果消息'
  });
  
  // 添加data字段，它是真正的业务数据
  const dataParam: ApiParam = {
    name: 'data',
    type: 'object',
    required: true,
    description: '响应数据'
  };
  
  // 尝试解析data字段的实际类型
  if (innerTypeName) {
    // 如果是嵌套泛型，例如 List«UserVO»
    if (innerTypeName.includes('«')) {
      const listMatch = innerTypeName.match(/List«(.+)»/);
      if (listMatch && listMatch[1]) {
        const itemTypeName = listMatch[1];
        dataParam.type = 'array';
        
        // 获取数组项的类型定义
        const itemTypeSchema = definitions[itemTypeName];
        if (itemTypeSchema) {
          const arrayItemParam: ApiParam = {
            name: 'item',
            type: 'object',
            required: true,
            description: `${itemTypeName}项`,
            children: extractSchemaProperties(itemTypeSchema, definitions)
          };
          
          dataParam.children = [arrayItemParam];
        } else {
          dataParam.children = [{
            name: 'item',
            type: 'object',
            required: true,
            description: `${itemTypeName}项`
          }];
        }
      }
    } else {
      // 普通对象类型
      const innerTypeSchema = definitions[innerTypeName];
      if (innerTypeSchema) {
        dataParam.children = extractSchemaProperties(innerTypeSchema, definitions);
      }
    }
  }
  
  params.push(dataParam);
  return params;
}

/**
 * 转换单个参数
 * @param param 参数定义
 * @returns 转换后的API参数
 */
function convertParameter(param: any): ApiParam {
  return {
    name: param.name,
    type: param.type || 'string',
    required: !!param.required,
    description: param.description || '',
    example: param.example !== undefined ? String(param.example) : ''
  };
} 