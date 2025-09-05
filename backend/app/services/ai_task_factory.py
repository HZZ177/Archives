from crewai import Agent, Task
from typing import Dict, Any
from backend.app.core.logger import logger


class AITaskFactory:
    """AI任务工厂类"""
    
    @staticmethod
    def create_defect_analysis_task(agent: Agent, defect_data: Dict[str, Any]) -> Task:
        """创建缺陷分析任务"""
        
        # 格式化缺陷数据为文本
        formatted_data = AITaskFactory._format_defect_data_for_analysis(defect_data)
        
        return Task(
            description=f"""
            # 缺陷数据分析任务
            
            ## 任务目标
            对提供的月度缺陷数据进行全面分析，识别问题模式、根本原因，并提供改进建议。
            
            ## 分析维度
            请从以下维度进行深入分析：
            
            ### 1. 时间维度分析
            - 分析缺陷在时间上的分布规律
            - 识别缺陷高发时期和原因
            - 对比历史数据，识别趋势变化
            
            ### 2. 模块维度分析
            - 识别缺陷集中的模块和业务域
            - 分析各模块的缺陷密度和严重程度
            - 找出问题热点区域
            
            ### 3. 缺陷类型分析
            - 按优先级、状态等维度分类统计
            - 识别主要的缺陷类型和模式
            - 分析缺陷解决效率
            
            ### 4. 根本原因分析
            - 深入分析缺陷产生的根本原因
            - 识别系统性问题和流程问题
            - 分类归纳常见问题类型
            
            ### 5. 重复问题识别
            - 识别重复出现的问题模式
            - 分析问题复现的原因
            - 评估问题解决的彻底性
            
            ## 输出要求
            请以结构化的方式输出分析结果，包括：
            1. 执行摘要（关键发现和结论）
            2. 详细分析结果（按上述5个维度）
            3. 问题优先级排序
            4. 具体改进建议
            
            ## 缺陷数据
            {formatted_data}
            
            ## 注意事项
            - 分析要基于实际数据，避免主观臆断
            - 结论要有数据支撑，提供具体数字
            - 建议要具体可行，有明确的执行路径
            - 保持客观中立的分析态度
            """,
            agent=agent,
            expected_output="""
            结构化的缺陷分析报告，包含：
            1. 执行摘要
            2. 时间维度分析
            3. 模块维度分析  
            4. 缺陷类型分析
            5. 根本原因分析
            6. 重复问题识别
            7. 改进建议
            """
        )
    
    @staticmethod
    def create_monthly_report_task(agent: Agent, analysis_result: str) -> Task:
        """创建月度报告生成任务"""
        return Task(
            description=f"""
            # 月度缺陷分析报告生成任务
            
            ## 任务目标
            基于缺陷分析结果，生成专业的月度缺陷分析报告。
            
            ## 报告结构要求
            请按照以下结构生成报告：
            
            ### 一、现状分布概览
            1. 时间维度分布（按月统计，突出重点月份）
            2. 业务域维度分布（按模块/功能分类）
            3. 缺陷类型分布（按优先级、状态等分类）
            
            ### 二、问题分析
            1. 根因归类（按问题类型分类分析）
            2. 共性特征识别
            3. 重复问题分析
            
            ### 三、整改建议
            1. 测试改进建议
            2. 开发流程改进建议
            3. 工具和方法改进建议
            
            ## 格式要求
            - 使用清晰的标题层次结构
            - 重要数据用数字和百分比表示
            - 关键发现用要点形式突出
            - 建议要具体可执行
            
            ## 分析结果
            {analysis_result}
            
            ## 输出要求
            生成完整的markdown格式报告，内容专业、数据准确、建议实用。
            """,
            agent=agent,
            expected_output="完整的markdown格式月度缺陷分析报告"
        )
    
    @staticmethod
    def _format_defect_data_for_analysis(defect_data: Dict[str, Any]) -> str:
        """格式化缺陷数据为分析用的文本格式"""
        try:
            formatted_text = []
            
            # 基本统计信息
            if 'statistics' in defect_data:
                stats = defect_data['statistics']
                formatted_text.append("## 基本统计信息")
                formatted_text.append(f"- 总缺陷数: {stats.get('total_bugs', 0)}")
                formatted_text.append(f"- 新增缺陷: {stats.get('new_bugs', 0)}")
                formatted_text.append(f"- 已解决缺陷: {stats.get('resolved_bugs', 0)}")
                formatted_text.append(f"- 待处理缺陷: {stats.get('pending_bugs', 0)}")
                formatted_text.append("")
            
            # 优先级分布
            if 'priority_distribution' in defect_data:
                formatted_text.append("## 优先级分布")
                for priority, count in defect_data['priority_distribution'].items():
                    formatted_text.append(f"- {priority}: {count}个")
                formatted_text.append("")
            
            # 状态分布
            if 'status_distribution' in defect_data:
                formatted_text.append("## 状态分布")
                for status, count in defect_data['status_distribution'].items():
                    formatted_text.append(f"- {status}: {count}个")
                formatted_text.append("")
            
            # 模块分布
            if 'module_distribution' in defect_data:
                formatted_text.append("## 模块分布")
                for module, count in defect_data['module_distribution'].items():
                    formatted_text.append(f"- {module}: {count}个")
                formatted_text.append("")
            
            # 趋势数据
            if 'trend_data' in defect_data:
                formatted_text.append("## 趋势数据")
                for item in defect_data['trend_data']:
                    date = item.get('date', '')
                    new_bugs = item.get('newBugs', 0)
                    total_bugs = item.get('totalBugs', 0)
                    formatted_text.append(f"- {date}: 新增{new_bugs}个，累计{total_bugs}个")
                formatted_text.append("")
            
            # 详细缺陷列表（如果数据量不大）
            if 'bug_details' in defect_data and len(defect_data['bug_details']) <= 50:
                formatted_text.append("## 详细缺陷信息")
                for bug in defect_data['bug_details']:
                    title = bug.get('name', '未知')
                    priority = bug.get('priority', '未指定')
                    status = bug.get('status_name', '未知')
                    module = bug.get('module_name', '未知模块')
                    formatted_text.append(f"- [{priority}] {title} ({status}) - {module}")
                formatted_text.append("")
            
            return "\n".join(formatted_text)
            
        except Exception as e:
            logger.error(f"格式化缺陷数据失败: {str(e)}")
            return f"缺陷数据格式化失败: {str(e)}"
