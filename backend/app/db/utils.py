import datetime


def get_local_time():
    """
    获取当前本地时间，用于数据库时间字段的默认值
    替代原来的 datetime.datetime.utcnow 函数
    """
    return datetime.datetime.now() 