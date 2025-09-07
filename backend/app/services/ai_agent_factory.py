from crewai import Agent, LLM
from typing import Optional
from backend.app.core.logger import logger
from backend.app.schemas.monthly_report import AgentPromptConfig


class AIAgentFactory:
    """AI Agent工厂类"""

    @staticmethod
    def create_defect_analysis_agent(llm: LLM, agent_config: Optional[AgentPromptConfig] = None) -> Agent:
        """创建缺陷分析专家Agent"""

        # 默认配置
        default_role = "线上问题分析专家"
        default_goal = "基于线上缺陷数据撰写专业的月度问题分析报告，为业务团队提供有价值的洞察和改进建议"
        default_backstory = """你是一位经验丰富的线上问题分析专家，在互联网公司有超过8年的质量分析经验。
        你深谙业务运营的痛点，能够从技术问题中洞察业务风险，用通俗易懂的语言向不同层级的同事传达问题的严重性和改进方向。

        你的专长包括：
        • 从海量缺陷数据中快速识别关键问题和趋势变化
        • 将技术问题转化为业务影响，用数据说话
        • 基于根因分析提出系统性的改进方案
        • 撰写清晰易懂的分析报告，帮助团队聚焦核心问题

        你的分析风格务实专业，善于用具体的案例和数据来支撑结论，
        提出的建议总是具体可执行，能够真正帮助团队提升线上质量。"""

        # 使用自定义配置或默认配置（支持部分配置）
        if agent_config:
            role = agent_config.role if agent_config.role else default_role
            goal = agent_config.goal if agent_config.goal else default_goal
            backstory = agent_config.backstory if agent_config.backstory else default_backstory
        else:
            role = default_role
            goal = default_goal
            backstory = default_backstory

        return Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            verbose=True,
            allow_delegation=False,
            llm=llm
        )
    
    @staticmethod
    def create_report_generator_agent(llm: LLM) -> Agent:
        """创建报告生成专家Agent"""
        return Agent(
            role="技术报告生成专家",
            goal="基于分析结果生成专业的月度缺陷分析报告，格式清晰，内容详实",
            backstory="""你是一位专业的技术文档撰写专家，擅长将复杂的技术分析结果转化为
            清晰易懂的报告。你的报告总是结构清晰，逻辑严密，数据准确。
            你特别擅长：
            1. 将数据分析结果转化为可读性强的报告
            2. 使用图表和数据可视化增强报告效果
            3. 提供执行摘要和关键洞察
            4. 确保报告的专业性和实用性""",
            verbose=True,
            allow_delegation=False,
            llm=llm
        )
    
    @staticmethod
    def create_trend_analysis_agent(llm: LLM) -> Agent:
        """创建趋势分析专家Agent"""
        return Agent(
            role="趋势分析专家",
            goal="分析缺陷数据的时间趋势，识别变化模式和异常情况",
            backstory="""你是一位数据分析专家，专门从事时间序列分析和趋势识别。
            你能够从历史数据中发现隐藏的模式，预测未来的发展趋势。
            你的分析总是基于统计学原理，结论可靠。你特别擅长：
            1. 时间序列数据的趋势分析
            2. 异常值检测和解释
            3. 周期性模式识别
            4. 趋势预测和风险评估""",
            verbose=True,
            allow_delegation=False,
            llm=llm
        )
    
    @staticmethod
    def create_root_cause_analysis_agent(llm: LLM) -> Agent:
        """创建根因分析专家Agent"""
        return Agent(
            role="根因分析专家",
            goal="深入分析缺陷的根本原因，识别系统性问题和改进机会",
            backstory="""你是一位根因分析专家，拥有丰富的软件工程和质量管理经验。
            你擅长使用各种分析方法（如5-Why分析、鱼骨图分析等）来识别问题的根本原因。
            你的分析总是深入本质，不停留在表面现象。你特别擅长：
            1. 多层次的根因分析
            2. 系统性问题识别
            3. 流程和工具问题分析
            4. 预防性措施建议""",
            verbose=True,
            allow_delegation=False,
            llm=llm
        )
