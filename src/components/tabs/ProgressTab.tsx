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
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function ProgressTab() {
  const { 
    gradeHistory, 
    students, 
    courses, 
    classes, 
    activeQuarter,
    archivedStudents,
    archivedCourses 
  } = useAppStore();

  const [scope, setScope] = useState<'active' | 'all'>('active');

  // Combine active and archived for lookup
  const allStudents = useMemo(() => [...students, ...archivedStudents], [students, archivedStudents]);
  const allCourses = useMemo(() => [...courses, ...archivedCourses], [courses, archivedCourses]);

  // Get improvements based on scope - with deduplication
  const improvements = useMemo(() => {
    let filteredHistory = gradeHistory;

    // Filter by active quarter if scope is active
    if (scope === 'active' && activeQuarter) {
      filteredHistory = gradeHistory.filter(h => h.quarter_id === activeQuarter.id);
    }

    // Filter to only F -> Passed improvements (not F -> F)
    const fImprovements = filteredHistory.filter(h => h.from_grade === 'F' && h.to_grade !== 'F');
    
    // DEDUPLICATE: Keep only ONE entry per student+course combination
    // This means if a student improved in the same course multiple times,
    // we only count/show the LATEST improvement
    // Sort by created_at DESC first so we keep the newest entry
    const sorted = [...fImprovements].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    const seen = new Map<string, boolean>();
    const deduplicated = sorted.filter(h => {
      // Key is just student+course - one improvement per student per course
      const key = `${h.student_id}-${h.course_id}`;
      if (seen.has(key)) {
        return false; // Skip duplicate - already have newer entry
      }
      seen.set(key, true);
      return true;
    });

    return deduplicated.map(h => {
        // Use snapshot data if available (preserves info even if student/course deleted)
        const studentFromDb = allStudents.find(s => s.id === h.student_id);
        const courseFromDb = allCourses.find(c => c.id === h.course_id);
        
        // Build student object from snapshot or database
        const student = studentFromDb || (h.student_snapshot ? {
          id: h.student_id,
          name: `${h.student_snapshot.first_name || ''} ${h.student_snapshot.last_name || ''}`.trim(),
          first_name: h.student_snapshot.first_name,
          last_name: h.student_snapshot.last_name,
          class_id: h.student_snapshot.class_id
        } : null);
        
        // Build course object from snapshot or database
        const course = courseFromDb || (h.course_snapshot ? {
          id: h.course_id,
          name: h.course_snapshot.name,
          code: h.course_snapshot.code
        } : null);
        
        return {
          ...h,
          student,
          course
        };
      });
  }, [gradeHistory, allStudents, allCourses, scope, activeQuarter]);

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
    const mostImprovedCourse = allCourses.find(c => c.id === mostImprovedCourseId);
    
    return { totalImprovements, studentsWithImprovements, mostImprovedCourse };
  }, [improvements, allCourses]);

  // Chart data - improvements per class
  const classChartData = useMemo(() => {
    const classCounts: Record<string, number> = {};
    
    improvements.forEach(i => {
      const student = i.student;
      // Use student's current class if available, otherwise unknown
      const classId = student?.class_id || 'unknown';
      classCounts[classId] = (classCounts[classId] || 0) + 1;
    });
    
    const labels: string[] = [];
    const data: number[] = [];
    
    Object.entries(classCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([classId, count]) => {
        const cls = classes.find(c => c.id === classId);
        labels.push(cls ? cls.name : (classId === 'unknown' ? 'Ingen klass' : 'Okänd'));
        data.push(count);
      });
    
    return {
      labels,
      datasets: [{
        label: 'Förbättringar',
        data,
        borderColor: '#10b981', // Emerald 500
        backgroundColor: 'rgba(16, 185, 129, 0.1)', // Emerald 500 with opacity
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#10b981'
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
        const course = allCourses.find(c => c.id === courseId);
        labels.push(course ? (course.code || course.name) : 'Okänd kurs');
        data.push(count);
      });
    
    return {
      labels,
      datasets: [{
        label: 'Förbättringar',
        data,
        borderColor: '#6366f1', // Indigo 500
        backgroundColor: 'rgba(99, 102, 241, 0.1)', // Indigo 500 with opacity
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#6366f1'
      }]
    };
  }, [improvements, allCourses]);

  return (
    <div className="space-y-8 animate-enter">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="heading-lg mb-1">Utveckling & Trender</h2>
          <p className="text-subtle">
            {scope === 'active' 
              ? `Visar förbättringar för ${activeQuarter?.name || 'aktivt kvartal'}`
              : 'Visar all historik över tid'
            }
          </p>
        </div>

        {/* Scope Toggle */}
        <div className="inline-flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-strong)] shadow-sm">
          <button
            onClick={() => setScope('active')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              scope === 'active'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            Aktivt kvartal
          </button>
          <button
            onClick={() => setScope('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              scope === 'all'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            Alla kvartal
          </button>
        </div>
      </div>

      {/* Empty State Message */}
      {improvements.length === 0 && scope === 'active' && (
        <div className="bg-[var(--bg-card)] border border-dashed border-[var(--border-strong)] rounded-xl p-8 text-center">
          <p className="text-[var(--text-secondary)]">
            Inga förbättringar (F till Godkänt) registrerade för <strong>{activeQuarter?.name}</strong> än.
          </p>
          <button 
            onClick={() => setScope('all')}
            className="mt-2 text-sm text-[var(--color-primary)] hover:underline font-medium"
          >
            Visa historik för alla kvartal istället
          </button>
        </div>
      )}

      {/* Stats KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card group">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Totala förbättringar</p>
            <div className="text-4xl font-bold text-[var(--color-success)]">
              {stats.totalImprovements}
            </div>
          </div>
          <div className="mt-4 text-sm text-[var(--text-tertiary)]">
            Antal betyg höjda från F
          </div>
        </div>

        <div className="stat-card group">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Elever med förbättring</p>
            <div className="text-4xl font-bold text-[var(--color-info)]">
              {stats.studentsWithImprovements}
            </div>
          </div>
          <div className="mt-4 text-sm text-[var(--text-tertiary)]">
            Unika elever
          </div>
        </div>

        <div className="stat-card group">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Flest förbättringar</p>
            <div className="text-2xl font-bold text-[var(--color-primary)] truncate" title={stats.mostImprovedCourse?.name}>
              {stats.mostImprovedCourse?.code || stats.mostImprovedCourse?.name || '-'}
            </div>
          </div>
          <div className="mt-4 text-sm text-[var(--text-tertiary)]">
            Kurs med bäst utveckling
          </div>
        </div>
      </div>

      {/* Charts */}
      {improvements.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="heading-md mb-4 text-lg">Utveckling per klass</h3>
            <div className="chart-container">
              <Line
                data={classChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { 
                      beginAtZero: true, 
                      grid: { color: 'rgba(0,0,0,0.05)' },
                      border: { display: false } 
                    },
                    x: {
                      grid: { display: false },
                      border: { display: false }
                    }
                  }
                }}
              />
            </div>
          </div>
          <div className="card p-5">
            <h3 className="heading-md mb-4 text-lg">Utveckling per kurs</h3>
            <div className="chart-container">
              <Line
                data={courseChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { 
                      beginAtZero: true, 
                      grid: { color: 'rgba(0,0,0,0.05)' },
                      border: { display: false } 
                    },
                    x: {
                      grid: { display: false },
                      border: { display: false }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Improvements Table */}
      <div className="card h-full flex flex-col">
        <div className="p-5 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
          <h3 className="heading-md text-lg">Senaste förbättringar</h3>
          <span className="badge bg-[var(--bg-active)] text-[var(--text-secondary)]">
            {improvements.length} st
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-secondary)]/50">
                <th className="px-6 py-4">Elev</th>
                <th className="px-6 py-4">Kurs</th>
                <th className="px-6 py-4 text-center">Från</th>
                <th className="px-6 py-4 text-center">Till</th>
                <th className="px-6 py-4">Datum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {improvements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-tertiary)]">
                    Inga förbättringar registrerade än
                  </td>
                </tr>
              ) : (
                improvements.slice(0, 50).map(improvement => {
                  const studentClass = classes.find(c => c.id === improvement.student?.class_id);
                  return (
                    <tr key={improvement.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--text-primary)]">
                            {improvement.student?.name || 'Okänd elev'}
                          </span>
                          {studentClass && (
                            <span className="text-xs text-[var(--text-secondary)]">
                              {studentClass.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                        {improvement.course?.code || improvement.course?.name || 'Okänd kurs'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold">
                          {improvement.from_grade || 'F'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[var(--text-tertiary)]">→</span>
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 text-sm font-bold">
                            {improvement.to_grade}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
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
