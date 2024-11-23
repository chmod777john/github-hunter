我通过大数据分析，找到了一个潜在的种子项目。我的时效性绝对优于 99% 的科技媒体，（手动喊话量子位+机器之心+新智元+HelloGithub）。我建议这方面的从业者都来看看这篇文章。

下面这个仓库是我在 北京时间 2024.11.16 凌晨 4.22 发现的，距离它首次公开仅 17小时。发现它的时候只有 200 多个 star，而今天它已经有 1.4k star

![image](https://github.com/user-attachments/assets/33187bbc-f6af-460d-9433-75ea07d89595)


[magic-quill/MagicQuill: Official Implementations for Paper - MagicQuill: An Intelligent Interactive Image Editing System](https://github.com/magic-quill/MagicQuill)

通常我们要分析找到当天最火热的 Github 项目，都是通过看 Github Trending。但是 Github Trending 只展示十几条记录，而且上了 Trending 的仓库，一般都已经积累了很多赞，对我们来说构不成信息差。

我的办法可以遍历一遍所有的 Github 仓库，火热程度从高到低排序，可以不重不漏、任意个数地找到最近几天的火热项目。

首先开通一个 Google BigQuery 账号，在控制台中执行

```sql
-- 提取最近两天的 WatchEvent 事件信息
WITH watch_data AS (
  SELECT 
    repo.name AS repo_name
  FROM 
    `githubarchive.day.20241107`  -- 这里替换为具体日期，例如2024年11月6日
  WHERE 
    type = 'WatchEvent'
  
  UNION ALL
  
  SELECT 
    repo.name AS repo_name
  FROM 
    `githubarchive.day.20241106`  -- 这里替换为具体日期，例如2024年11月5日
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
  star_count DESC;
```
就能把所有 Github 仓库，按照最近两天获得的 stars 数量排序了。可以保证不会漏掉任何一个仓库。任何一个媒体人，如果你们的行当就是搬运每日最新的 Github AI 项目，把它们的 demo 做点简介拼在一起，就成为今天的稿件的话，你最好使用这个方法。人人都报道的项目那就烂大街了，只有这种方法可以找到公布时间不长，但 star 增长非常快的种子项目。

--------------------------------

注：怎么确保我不是吹牛的，我是不是真的那么早就发掘出了前面提到的那个项目？

为了让各位看官相信我并非胡说八道，当天我已经把证据写到区块链上了。
我写了一份文档，存储在 Walrus 上，校验链接：https://walruscan.com/testnet/blob/lLv2o4NNyroFcFjrLUiH0LW0tHj4_ulaSYyZ4H_K_sE 从这个链接可以看到创建时间。
文件内容在 https://app.ardrive.io/#/file/554684f0-47e8-431c-b949-fc30e8f85758/view
请下载文件内容后，使用 `walrus --blob-id <the-file-name>` 校验一下，你会发现 blob-id 跟lLv2o4NNyroFcFjrLUiH0LW0tHj4_ulaSYyZ4H_K_sE一致。
文档内容里面还附带了我的 ETH 地址，作为唯一身份证明。

