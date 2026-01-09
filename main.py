from dotenv import load_dotenv
from google.cloud import bigquery
from datetime import datetime, timedelta
import requests
import pandas as pd
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import time

load_dotenv() # 加载 .env 文件中的环境变量

# Construct a BigQuery client object.
client = bigquery.Client(project='gen-lang-client-0730994553')

# 获取今天的日期和前一天的日期
today = datetime.today()
yesterday = today - timedelta(days=1)

# 将日期格式化为 BigQuery 查询需要的格式 (YYYYMMDD)
today_str = today.strftime('%Y%m%d')
yesterday_str = yesterday.strftime('%Y%m%d')

# 构建查询字符串
query = f"""
WITH watch_data AS (
  -- 查询最近一天的 WatchEvent 事件
  SELECT 
    repo.name AS repo_name
  FROM 
    `githubarchive.day.{today_str}`
  WHERE 
    type = 'WatchEvent'
  
  UNION ALL
  
  -- 查询前一天的 WatchEvent 事件
  SELECT 
    repo.name AS repo_name
  FROM 
    `githubarchive.day.{yesterday_str}`
  WHERE 
    type = 'WatchEvent'
)

SELECT 
  repo_name,
  COUNT(*) AS star_count
FROM 
  watch_data
GROUP BY 
  repo_name
ORDER BY 
  star_count DESC
LIMIT 1000
"""

# 执行查询并等待结果
rows = client.query(query)  # 执行查询
results = rows.result().to_dataframe()  # 等待查询结果

# GitHub GraphQL API URL
GRAPHQL_URL = "https://api.github.com/graphql"

# GitHub Token (硬编码)
# 警告：将敏感信息硬编码到代码中存在严重安全风险。
# 强烈建议使用环境变量或 GitHub Secrets 来管理此类信息。
TOKEN = os.environ.get("GH_TOKEN")

# 设置请求头
HEADERS = {
    "Authorization": f"bearer {TOKEN}",
    "Content-Type": "application/json"
}

# 构建 GraphQL 查询模板
GRAPHQL_QUERY_TEMPLATE = """
query {{
  repository(owner: "{repo_owner}", name: "{repo_name}") {{
    createdAt
    stargazerCount
  }}
}}
"""

# 请求函数，获取仓库信息
def fetch_repo_details(repo_name):
    """
    使用 GitHub GraphQL API 获取仓库的创建日期和 star 总数。
    """
    if "/" not in repo_name:
        return None, None  # 无效的 repo_name
    
    repo_owner, repo_name_only = repo_name.split("/", 1)
    
    query = GRAPHQL_QUERY_TEMPLATE.format(repo_owner=repo_owner, repo_name=repo_name_only)
    
    # 发送请求
    try:
        response = requests.post(
            GRAPHQL_URL,
            json={"query": query},
            headers=HEADERS
        )
        # 检查请求是否成功
        if response.status_code == 200:
            data = response.json()
            # 确保 data 和 repository 存在且有效
            if "data" in data and "repository" in data["data"]:
                repo_data = data["data"]["repository"]
                if repo_data is not None:
                    return repo_data.get("createdAt"), repo_data.get("stargazerCount")
                else:
                    print(f"Repository data is None for {repo_name}")
            else:
                print(f"Missing 'data' or 'repository' for {repo_name}")
        else:
            print(f"Failed to fetch data for {repo_name}: {response.status_code}, {response.text}")
    except requests.exceptions.RequestException as e:
        # 捕获请求中的异常
        print(f"Request failed for {repo_name}: {str(e)}")
    
    # 出现问题时返回 None
    return None, None

# 处理并行化请求
def fetch_repo_details_parallel(df):
    results = []

    # 使用 ThreadPoolExecutor 进行并行化
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_repo_details, row["repo_name"]): index for index, row in df.iterrows()}

        # 显示进度条
        for future in tqdm(as_completed(futures), total=len(futures), desc="Fetching repo details"):
            index = futures[future]
            created_at, stargazer_count = future.result()
            df.at[index, "created_at"] = created_at
            df.at[index, "current_star_count"] = stargazer_count

    return df

# AI 总结函数（使用 OpenRouter）
def summarize_with_openrouter(repo_name, star_count, created_at, current_stars):
    """
    使用 OpenRouter API 生成项目总结
    """
    from openai import OpenAI

    api_key = os.environ.get("OPENROUTER_API_KEY", "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")
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    prompt = f"""请分析以下 GitHub 项目，用简洁的中文总结（100字以内）：

项目名称：{repo_name}
最近新增星标：{star_count}
当前总星标：{current_stars}
创建时间：{created_at}

请回答：
1. 这个项目是做什么的？（推测）
2. 为什么值得关注？

输出格式：直接输出总结内容，不要标题。"""

    try:
        response = client.chat.completions.create(
            model="xiaomi/mimo-v2-flash:free",
            messages=[
                {"role": "system", "content": "你是一个技术分析师，擅长分析 GitHub 项目。请用简洁的中文回答。"},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OpenRouter API exception for {repo_name}: {str(e)}")
        return None

# 批量生成总结（为前 N 个项目生成）
def generate_summaries(df, top_n=50):
    """
    为前 top_n 个项目生成 AI 总结（并发）
    """
    df["ai_summary"] = None

    def process_single_repo(index):
        row = df.iloc[index]
        repo_name = row["repo_name"]
        star_count = row["star_count"]
        created_at = row["created_at"]
        current_stars = row["current_star_count"]

        # 跳过无效数据
        if pd.isna(created_at) or current_stars is None:
            return index, None

        summary = summarize_with_openrouter(repo_name, star_count, created_at, current_stars)
        return index, summary

    # 使用 ThreadPoolExecutor 并发处理
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_single_repo, i): i for i in range(min(top_n, len(df)))}

        for future in tqdm(as_completed(futures), total=len(futures), desc="Generating AI summaries"):
            index, summary = future.result()
            df.at[df.index[index], "ai_summary"] = summary

    return df

# 假设你已经得到了如下的 DataFrame
df = results  # BigQuery 查询的结果 DataFrame

# 添加两列：创建日期和 star 总数
df["created_at"] = None
df["current_star_count"] = None

# 执行并行化的获取仓库信息
df = fetch_repo_details_parallel(df)

# 生成 AI 总结（为前 50 个项目）
df = generate_summaries(df, top_n=50)

# 确保 created_at 是 datetime 类型
df["created_at"] = pd.to_datetime(df["created_at"])

# 按照 created_at 升序排序
df_sorted = df.sort_values(by="created_at", ascending=False)
# 获取当前日期并格式化
current_date = datetime.now().strftime('%Y-%m-%d')
output_filename = f"result_{current_date}.csv"
output_dir = "result"

# 创建 result 文件夹（如果不存在）
os.makedirs(output_dir, exist_ok=True)

# 构建完整的文件路径
output_filepath = os.path.join(output_dir, output_filename)

# 保存到 CSV 文件
df_sorted.to_csv(output_filepath, index=False)

# 将生成的 CSV 文件复制到 web/public/results/result.csv
import shutil
web_public_results_dir = "web/public/results"
os.makedirs(web_public_results_dir, exist_ok=True)
shutil.copy(output_filepath, os.path.join(web_public_results_dir, "result.csv"))