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
