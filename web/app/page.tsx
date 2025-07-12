"use client";

import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/results/result.csv');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        // Simple CSV parsing
        const rows = text.split('\n').map(row => row.split(','));
        setData(rows);
      } catch (e: any) {
        setError(e.message);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return <div className="p-8">Error: {error}</div>;
  }

  if (data.length === 0) {
    return <div className="p-8">Loading data...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">GitHub Analysis Results</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            {data[0] && (
              <tr>
                {data[0].map((header, index) => (
                  <th key={index} className="py-2 px-4 border-b text-left">
                    {header}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {data.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="py-2 px-4 border-b">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
