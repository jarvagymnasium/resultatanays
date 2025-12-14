'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

export default function ProgressTab() {
  const { gradeHistory, students, courses, classes, activeQuarter } = useAppStore();
  const [scope, setScope] = useState<'active' | 'all'>('active');

  // Debug: log what's in gradeHistory
  const allImprovements = gradeHistory.filter(h => h.change_type === 'improvement');
  const quarterIds = [...new Set(allImprovements.map(h => h.quarter_id))];
  console.log('gradeHistory total:', gradeHistory.length, 
    'improvements:', allImprovements.length,
    'activeQuarter:', activeQuarter?.id,
    'quarter_ids in improvements:', quarterIds,
    'matches active:', allImprovements.filter(h => h.quarter_id === activeQuarter?.id).length);

  // Get improvements only
  const improvements = useMemo(() => {
    const activeQuarterId = scope === 'active' ? activeQuarter?.id : undefined;
    return gradeHistory
      .filter(h => h.change_type === 'improvement')
      .filter(h => !activeQuarterId || h.quarter_id === activeQuarterId)
      .map(h => ({
        ...h,
        student: students.find(s => s.id === h.student_id),
        course: courses.find(c => c.id === h.course_id)
      }))
      .filter(h => h.student && h.course)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [gradeHistory, students, courses, activeQuarter?.id, scope]);

  const totalImprovementsAllQuarters = useMemo(() => {
    return gradeHistory.filter(h => h.change_type === 'improvement').length;
  }, [gradeHistory]);

  // Statistics
  const stats = useMemo(() => {
    const totalImprovements = improvements.length;
    const studentsWithImprovements = new Set(improvements.map(i => i.student_id)).size;
    
    // Most improved course
    const courseCounts: Record<string, number> = {};
    improvements.forEach(i => {
      courseCounts[i.course_id] = (courseCounts[i.course_id] || 0) + 1;
    });
    
    let mostImprovedCourseId = '';
    let mostImprovedCount = 0;
    Object.entries(courseCounts).forEach(([id, count]) => {
      if (count > mostImprovedCount) {
        mostImprovedCourseId = id;
        mostImprovedCount = count;
      }
    });
    const mostImprovedCourse = courses.find(c => c.id === mostImprovedCourseId);
    
    return { totalImprovements, studentsWithImprovements, mostImprovedCourse };
  }, [improvements, courses]);

  // Chart data - improvements per class
  const classChartData = useMemo(() => {
    const classCounts: Record<string, number> = {};
    
    improvements.forEach(i => {
      const student = i.student;
      if (student?.class_id) {
        classCounts[student.class_id] = (classCounts[student.class_id] || 0) + 1;
      }
    });
    
    const labels: string[] = [];
    const data: number[] = [];
    
    Object.entries(classCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([classId, count]) => {
        const cls = classes.find(c => c.id === classId);
        if (cls) {
          labels.push(cls.name);
          data.push(count);
        }
      });
    
    return {
      labels,
      datasets: [{
        label: 'Förbättringar',
        data,
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
        tension: 0.4
      }]
    };
  }, [improvements, classes]);

  // Chart data - improvements per course
  const courseChartData = useMemo(() => {
    const courseCounts: Record<string, number> = {};
    
    improvements.forEach(i => {
      courseCounts[i.course_id] = (courseCounts[i.course_id] || 0) + 1;
    });
    
    const labels: string[] = [];
    const data: number[] = [];
    
    Object.entries(courseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([courseId, count]) => {
        const course = courses.find(c => c.id === courseId);
        if (course) {
          labels.push(course.code || course.name);
          data.push(count);
        }
      });
    
    return {
      labels,
      datasets: [{
        label: 'Förbättringar',
        data,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4
      }]
    };
  }, [improvements, courses]);

  return (
    <div className="space-y-6">
      {/* Active quarter context */}
      {activeQuarter && scope === 'active' && (
        <div className="card rounded-xl p-4 border border-[#624c9a] bg-[#624c9a]/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <div className="font-semibold">Visar utveckling för</div>
              <div className="text-xl font-bold text-[#624c9a]">{activeQuarter.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Scope toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setScope('active')}
          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
            scope === 'active'
              ? 'bg-[#624c9a] text-white border-[#624c9a]'
              : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}
        >
          Aktivt kvartal
        </button>
        <button
          type="button"
          onClick={() => setScope('all')}
          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
            scope === 'all'
              ? 'bg-[#624c9a] text-white border-[#624c9a]'
              : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}
        >
          Alla kvartal
        </button>
        {scope === 'active' && improvements.length === 0 && totalImprovementsAllQuarters > 0 && (
          <div className="ml-2 text-sm text-gray-500">
            Inga förbättringar i detta kvartal. Prova “Alla kvartal” för att se historik.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card card rounded-xl p-4 border">
          <div className="text-3xl font-bold text-green-500">{stats.totalImprovements}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Totala förbättringar</div>
        </div>
        <div className="stat-card card rounded-xl p-4 border">
          <div className="text-3xl font-bold text-blue-500">{stats.studentsWithImprovements}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Elever med förbättring</div>
        </div>
        <div className="stat-card card rounded-xl p-4 border">
          <div className="text-xl font-bold text-purple-500 truncate">
            {stats.mostImprovedCourse?.code || stats.mostImprovedCourse?.name || '-'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Flest förbättringar (kurs)</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card rounded-xl p-4 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            📈 Utveckling per klass
          </h3>
          <div className="chart-container">
            <Line
              data={classChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
              }}
            />
          </div>
        </div>
        <div className="card rounded-xl p-4 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            📊 Utveckling per kurs
          </h3>
          <div className="chart-container">
            <Line
              data={courseChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
              }}
            />
          </div>
        </div>
      </div>

      {/* Improvements table */}
      <div className="card rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 dark:bg-gray-800">
          <h3 className="font-semibold">📈 Senaste förbättringar</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Elev</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Kurs</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Från</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Till</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Typ</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Datum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {improvements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Inga förbättringar registrerade än
                  </td>
                </tr>
              ) : (
                improvements.slice(0, 50).map(improvement => {
                  const studentClass = classes.find(c => c.id === improvement.student?.class_id);
                  return (
                    <tr key={improvement.id} className="bg-green-50/50 dark:bg-green-900/10">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium">{improvement.student?.name}</span>
                          {studentClass && (
                            <span className="text-xs text-gray-500 ml-2">({studentClass.name})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {improvement.course?.code || improvement.course?.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-red-500 font-medium">
                          {improvement.from_grade || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-500 font-medium">
                          {improvement.to_grade}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          improvement.grade_type === 'grade'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                        }`}>
                          {improvement.grade_type === 'grade' ? 'Betyg' : 'Varning'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {improvement.created_at 
                          ? new Date(improvement.created_at).toLocaleDateString('sv-SE')
                          : '-'
                        }
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

