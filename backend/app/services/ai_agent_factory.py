from crewai import Agent, LLM
from backend.app.core.logger import logger


class AIAgentFactory:
    """AI Agent工厂类"""
    
    @staticmethod
    def create_defect_analysis_agent(llm: LLM) -> Agent:
        """创建缺陷分析专家Agent"""
        return Agent(
            role="缺陷分析专家",
            goal="分析现网缺陷数据，识别问题模式和根本原因，生成专业的分析报告",
            backstory="""你是一位资深的软件质量分析专家，拥有超过10年的软件缺陷分析经验。
            你擅长从大量的缺陷数据中识别问题模式，分析根本原因，并提供切实可行的改进建议。
            你的分析总是基于数据驱动，逻辑清晰，结论准确。你特别擅长：
            1. 识别缺陷在时间和模块维度的分布规律
            2. 分析缺陷类型和根本原因
            3. 发现重复出现的问题模式
            4. 提供针对性的改进建议""",
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
