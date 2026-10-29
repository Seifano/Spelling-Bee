import React, { useState } from 'react';
import { Trophy, Download, Trash2, Award, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { LeaderboardRecord } from '../types';
import { CLASSES_BY_GRADE } from '../data/defaultWords';

interface ResultsLeaderboardProps {
  records: LeaderboardRecord[];
  onClearRecords: () => void;
  onOpenCertificate: (name: string, classSec: string, score: number, total: number) => void;
}

export const ResultsLeaderboard: React.FC<ResultsLeaderboardProps> = ({
  records,
  onClearRecords,
  onOpenCertificate,
}) => {
  const [filterClass, setFilterClass] = useState('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Group and rank records
  // Sort by score desc, then time asc
  const sortedRecords = [...records].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.time - b.time;
  });

  // Track rank within class
  const classCounts: Record<string, number> = {};
  const recordsWithRank = sortedRecords.map(rec => {
    classCounts[rec.classSec] = (classCounts[rec.classSec] || 0) + 1;
    const rankInClass = classCounts[rec.classSec];
    const isQualifier = rankInClass <= 3;
    return {
      ...rec,
      rankInClass,
      isQualifier,
    };
  });

  const displayedRecords =
    filterClass === 'ALL'
      ? recordsWithRank
      : recordsWithRank.filter(r => r.classSec === filterClass);

  const handleExportResultsCSV = () => {
    const headers = ['Rank In Class', 'Student Name', 'Class', 'Score', 'Total Seconds', 'Words Attempted', 'Timestamp'];
    const rows = displayedRecords.map(r => [
      r.rankInClass,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.classSec}"`,
      `"${r.score}/${r.totalWords}"`,
      r.time,
      `"${(r.results || []).map(x => `${x.word}:${x.pass ? 'PASS' : 'MISS'}`).join('; ')}"`,
      `"${r.timestamp}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `spelling_bee_results_${filterClass.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Competition Standings & Finals Qualifiers
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ranked by highest score, then fastest time. Top 3 students in each class advance to the Finals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Class Filter */}
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Classes Combined</option>
            {Object.entries(CLASSES_BY_GRADE).map(([grade, sections]) => (
              <optgroup key={grade} label={`Grade ${grade}`}>
                {sections.map(sec => (
                  <option key={`${grade}-${sec}`} value={`${grade}-${sec}`}>
                    Grade {grade} - {sec}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportResultsCSV}
            disabled={displayedRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Clear Leaderboard */}
          <button
            onClick={() => {
              if (confirmReset) {
                onClearRecords();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 3500);
              }
            }}
            disabled={records.length === 0}
            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors text-xs font-semibold disabled:opacity-40"
            title="Reset leaderboard records"
          >
            {confirmReset ? 'Click to confirm reset' : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800 uppercase font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4 w-16">Rank</th>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4 w-28">Class</th>
              <th className="py-3 px-4 w-24">Score</th>
              <th className="py-3 px-4 w-24">Time</th>
              <th className="py-3 px-4 w-36">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {displayedRecords.length > 0 ? (
              displayedRecords.map(rec => {
                const isExpanded = expandedId === rec.id;
                return (
                  <React.Fragment key={rec.id}>
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                            rec.rankInClass === 1
                              ? 'bg-amber-400 text-amber-950 font-extrabold shadow-sm'
                              : rec.rankInClass === 2
                              ? 'bg-slate-300 text-slate-800 font-extrabold'
                              : rec.rankInClass === 3
                              ? 'bg-amber-700/80 text-white font-extrabold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {rec.rankInClass}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-sm text-slate-900 dark:text-white">
                        {rec.name}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">
                        {rec.classSec}
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                        {rec.score} <span className="text-xs text-slate-400 font-normal">/ {rec.totalWords}</span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                        {rec.time}s
                      </td>
                      <td className="py-3 px-4">
                        {rec.isQualifier ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                            ★ Qualifier (Top 3)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Participant
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenCertificate(rec.name, rec.classSec, rec.score, rec.totalWords)}
                            title="Print Certificate"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                          >
                            <Award className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
                            title="View word details"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60">
                        <td colSpan={7} className="p-4">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Spelling Attempt Breakdown:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {(rec.results || []).map((res, i) => (
                                <div
                                  key={i}
                                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-slate-900 dark:text-white">
                                      {res.word}
                                    </span>
                                    {res.pass ? (
                                      <span className="text-emerald-600 flex items-center gap-0.5">
                                        <Check className="w-3.5 h-3.5" /> Pass
                                      </span>
                                    ) : (
                                      <span className="text-rose-600 flex items-center gap-0.5">
                                        <X className="w-3.5 h-3.5" /> Miss
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-slate-500">
                                    Spelled: <span className="font-mono font-medium">{res.spelled}</span>
                                  </div>
                                  <div className="text-slate-400 font-mono text-[11px]">
                                    Time: {res.time}s {res.level ? `· ${res.level}` : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                  No competition records registered yet. Complete a student round in the Compete tab!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
