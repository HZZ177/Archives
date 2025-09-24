from crewai import Agent, Task
from typing import Dict, Any, Optional
from backend.app.core.logger import logger
from backend.app.schemas.monthly_report import TaskPromptConfig
from pydantic import BaseModel


class AnalysisResponse(BaseModel):
    """缺陷分析响应结构"""
    thought: str
    report: str

class AITaskFactory:
    """AI任务工厂类"""

    @staticmethod
    def create_defect_analysis_task(agent: Agent, defect_data: Dict[str, Any], task_config: Optional[TaskPromptConfig] = None) -> Task:
        """创建缺陷分析任务"""

        # 格式化缺陷数据为文本
        formatted_data = AITaskFactory._format_defect_data_for_analysis(defect_data)

        # 默认配置
        default_description = f"""
        # 线上问题月度分析任务

        你需要基于提供的缺陷数据，撰写一份专业的线上问题月度报告。报告应该贴近实际业务场景，用自然的语言描述问题现状和分析结果。

        ## 报告结构要求

        ### 一、现状分布概览
        1. **时间维度**：分析缺陷在各时间段的分布情况，找出高发期，用具体数字和百分比说明趋势
        2. **业务域维度**：按业务模块或功能域分类统计，识别问题集中的业务领域
        3. **缺陷类型**：按问题性质分类（如代码逻辑、配置环境、产品设计等），统计各类型占比

        ### 二、问题分析
        1. **根因归类**：将问题按根本原因分类，计算各类原因的占比，深入分析典型问题
        2. **共性特征**：总结问题的共同特点，识别系统性风险和薄弱环节

        ### 三、整改建议
        针对发现的问题提出具体的改进措施，分测试、开发、运维等不同角度给出建议

        ## 写作要求
        - 使用业务化的语言，避免过于技术化的表述
        - 用具体的数字和百分比支撑分析结论
        - 问题描述要简洁明了，突出关键信息
        - 建议要具体可执行，有明确的责任方
        - 保持客观专业的分析态度
        - 全程使用中文撰写

        ## 缺陷数据(包含缺陷详情，可能有些详情只有字段标题没有内容，自己注意分析)
        {formatted_data}

        ## 参考示例风格
        - 时间分布：如"7月集中爆发，占55%"
        - 业务分类：如"支付/钱包：4起（无感支付、优惠券、小程序钱包、查费缴费）"
        - 根因分析：如"参数/上下文缺失（42%）"
        - 共性特征：如"openid、UnionID等跨系统关键参数缺失或错误"
        - 整改建议：如"构建openid/UnionID缺失、租户上下文缺失三类混沌用例"
        """

        default_expected_output = """
        一份专业的线上问题月度报告，包含：
        一、现状分布概览（时间维度、业务域维度、缺陷类型）
        二、问题分析（根因归类、共性特征）
        三、整改建议（测试、开发、运维等角度的具体措施）

        报告应该用自然的业务语言描述，包含具体的数字统计和百分比分析，问题描述简洁明了，建议具体可执行。
        
        重要！！！你的返回格式必须严格遵循以下格式
        返回内容只有一个单一字典，不能用任何json格式包裹，只是单纯的字典字符串，字段如下：
        {
        "thought": "你的思考过程，所有的思考只能放在这个字段"
        "report": "你的最终报告，不能有任何和报告正文无关的内容"
        }
        除了字典对象本身，不能输出任何其他内容！
        """

        # 使用自定义配置或默认配置（支持部分配置）
        if task_config:
            # 处理description：如果有自定义配置则使用，否则使用默认
            if task_config.description:
                description = task_config.description.replace("{formatted_data}", formatted_data)
            else:
                description = default_description

            # 处理expected_output：如果有自定义配置则使用，否则使用默认
            expected_output = task_config.expected_output if task_config.expected_output else default_expected_output
        else:
            description = default_description
            expected_output = default_expected_output

        return Task(
            description=description,
            agent=agent,
            expected_output=expected_output,
            output_pydantic=AnalysisResponse,   # 该功能可能依赖大模型转换，llm优先级：agent.function_calling_llm > llm > 环境变量 > 默认值(gpt-4o-mini)
        )
    
    @staticmethod
    def _format_defect_data_for_analysis(defect_data: Dict[str, Any]) -> str:
        """格式化缺陷数据为分析用的文本格式"""
        try:
            formatted_text = []
            
            # 基本统计信息
            total_bugs = 0
            if 'bug_details' in defect_data and isinstance(defect_data['bug_details'], list):
                total_bugs = len(defect_data['bug_details'])

            formatted_text.append("### 基本统计信息")
            formatted_text.append(f"- 总缺陷数: {total_bugs}")

            if 'statistics' in defect_data and isinstance(defect_data['statistics'], dict):
                stats = defect_data['statistics']
                formatted_text.append(f"- 新增缺陷: {stats.get('new_bugs', 0)}")
                formatted_text.append(f"- 已解决缺陷: {stats.get('resolved_bugs', 0)}")
                formatted_text.append(f"- 待处理缺陷: {stats.get('pending_bugs', 0)}")
            else:
                # 如果没有统计数据，从bug_details中计算
                if total_bugs > 0:
                    resolved_count = 0
                    pending_count = 0
                    for bug in defect_data['bug_details']:
                        if isinstance(bug, dict):
                            status = bug.get('status_name', '').lower()
                            if status in ['已解决', '已关闭', 'resolved', 'closed']:
                                resolved_count += 1
                            else:
                                pending_count += 1
                    formatted_text.append(f"- 已解决缺陷: {resolved_count}")
                    formatted_text.append(f"- 待处理缺陷: {pending_count}")
            formatted_text.append("")
            
            # 优先级分布
            if 'priority_distribution' in defect_data and isinstance(defect_data['priority_distribution'], dict):
                formatted_text.append("### 优先级分布")
                for priority, count in defect_data['priority_distribution'].items():
                    formatted_text.append(f"- {priority}: {count}个")
                formatted_text.append("")

            # 状态分布
            if 'status_distribution' in defect_data and isinstance(defect_data['status_distribution'], dict):
                formatted_text.append("### 状态分布")
                for status, count in defect_data['status_distribution'].items():
                    formatted_text.append(f"- {status}: {count}个")
                formatted_text.append("")

            # 模块分布
            if 'module_distribution' in defect_data and isinstance(defect_data['module_distribution'], dict):
                formatted_text.append("### 模块分布")
                for module, count in defect_data['module_distribution'].items():
                    formatted_text.append(f"- {module}: {count}个")
                formatted_text.append("")
            
            # 趋势数据
            if 'trend_data' in defect_data and isinstance(defect_data['trend_data'], list):
                formatted_text.append("### 趋势数据")
                for item in defect_data['trend_data']:
                    if isinstance(item, dict):
                        date = item.get('date', '')
                        new_bugs = item.get('newBugs', 0)
                        total_bugs = item.get('totalBugs', 0)
                        formatted_text.append(f"- {date}: 新增{new_bugs}个，累计{total_bugs}个")
                    else:
                        logger.warning(f"趋势数据格式异常，期望字典但得到: {type(item)}")
                formatted_text.append("")
            
            # 详细缺陷列表（如果数据量不大）
            if 'bug_details' in defect_data and isinstance(defect_data['bug_details'], list) and len(defect_data['bug_details']) <= 50:
                formatted_text.append("### 详细缺陷信息")
                for bug in defect_data['bug_details']:
                    # 确保bug是字典类型
                    if isinstance(bug, dict):
                        title = bug.get('name', bug.get('title', '未知'))
                        priority = bug.get('priority', '未指定')
                        status = bug.get('status_name', '未知')
                        description = bug.get('description', '')

                        # 构建缺陷信息，去掉项目名称，增加描述
                        bug_info = f"- [{priority}] {title} ({status})"
                        if description and description.strip():
                            # 限制描述长度，避免过长
                            desc_preview = description.strip()[:100]
                            if len(description.strip()) > 100:
                                desc_preview += "..."
                            bug_info += f" - {desc_preview}"

                        formatted_text.append(bug_info)
                    else:
                        # 如果bug不是字典，记录错误但继续处理
                        logger.warning(f"缺陷数据格式异常，期望字典但得到: {type(bug)}")
                        formatted_text.append(f"- 数据格式异常: {str(bug)[:50]}...")
                formatted_text.append("")
            
            return "\n".join(formatted_text)
            
        except Exception as e:
            logger.error(f"格式化缺陷数据失败: {str(e)}")
            return f"缺陷数据格式化失败: {str(e)}"
