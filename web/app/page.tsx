"use client";

import { useEffect, useState } from 'react';

interface RepoData {
  name: string;
  stars: string;
  createdAt: string;
  currentStars: string;
  summary?: string;
}

export default function Home() {
  const [data, setData] = useState<RepoData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/results/result.csv');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        // Parse CSV handling quoted fields
        const parseCSV = (text: string) => {
          const rows: string[][] = [];
          let currentRow: string[] = [];
          let currentField = '';
          let inQuotes = false;

          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              currentRow.push(currentField);
              currentField = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
              if (currentField || currentRow.length > 0) {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
              }
              if (char === '\r' && nextChar === '\n') i++;
            } else {
              currentField += char;
            }
          }

          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField);
            rows.push(currentRow);
          }

          return rows;
        };

        const rows = parseCSV(text).filter(row => row.some(cell => cell.trim()));
        const repoData: RepoData[] = rows.slice(1).map(row => ({
          name: row[0] || '',
          stars: row[1] || '0',
          createdAt: row[2] || '',
          currentStars: row[3] || '0',
          summary: row[4] || '',
        })).filter(r => r.name);
        setData(repoData);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleSummary = (repoName: string) => {
    setExpandedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(repoName)) {
        newSet.delete(repoName);
      } else {
        newSet.add(repoName);
      }
      return newSet;
    });
  };

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  if (loading) {
    return <div className="p-8">Loading data...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">GitHub 热门项目预测器</h1>
        <p className="text-gray-600 mb-6">基于最近 2 天 star 增长分析的潜力项目，AI 智能总结</p>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-3 px-2 md:px-4 text-left text-xs md:text-sm font-semibold text-gray-700">排名</th>
                  <th className="py-3 px-2 md:px-4 text-left text-xs md:text-sm font-semibold text-gray-700">项目名称</th>
                  <th className="py-3 px-2 md:px-4 text-left text-xs md:text-sm font-semibold text-gray-700">新增</th>
                  <th className="py-3 px-2 md:px-4 text-left text-xs md:text-sm font-semibold text-gray-700">总 Star</th>
                  <th className="py-3 px-2 md:px-4 text-left text-xs md:text-sm font-semibold text-gray-700 hidden md:table-cell">创建时间</th>
                  <th className="py-3 px-2 md:px-4 text-left text-xs md:text-sm font-semibold text-gray-700">AI 总结</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((repo, index) => (
                  <>
                    <tr key={repo.name} className="hover:bg-gray-50">
                      <td className="py-3 px-2 md:px-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="py-3 px-2 md:px-4">
                        <a
                          href={`https://github.com/${repo.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs md:text-sm"
                        >
                          {repo.name}
                        </a>
                      </td>
                      <td className="py-3 px-2 md:px-4 text-sm text-gray-900">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          +{repo.stars}
                        </span>
                      </td>
                      <td className="py-3 px-2 md:px-4 text-sm text-gray-600">{repo.currentStars}</td>
                      <td className="py-3 px-2 md:px-4 text-sm text-gray-600 hidden md:table-cell">
                        {new Date(repo.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-3 px-2 md:px-4">
                        {repo.summary ? (
                          <button
                            onClick={() => toggleSummary(repo.name)}
                            className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                          >
                            {expandedSummaries.has(repo.name) ? '收起' : '查看'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                    {repo.summary && expandedSummaries.has(repo.name) && (
                      <tr key={`${repo.name}-summary`}>
                        <td colSpan={6} className="py-4 px-2 md:px-4 bg-blue-50">
                          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {repo.summary}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs md:text-sm text-gray-500">
          数据更新时间: {new Date().toLocaleString('zh-CN')}
        </p>
      </div>
    </div>
  );
}
