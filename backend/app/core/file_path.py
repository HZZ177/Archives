import os

"""项目目录"""
# 后端根目录，指向\backend
project_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

"""一级目录"""
app_path = os.path.abspath(os.path.join(project_path, "app"))  # app根目录
log_path = os.path.abspath(os.path.join(project_path, "logs"))

"""二级目录"""


if __name__ == "__main__":
    print(log_path)
    # pass
