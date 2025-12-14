'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { StudentWithGrades, GradeTypeFilter } from '@/lib/types';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import StudentDetailModal from '../modals/StudentDetailModal';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function WarningsTab() {
  const {
    students,
    classes,
    courses,
    grades,
    activeGradeTypeFilter,
    setActiveGradeTypeFilter,
    selectedClassIds,
    setSelectedClassIds,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'class' | 'f_count'>('f_count');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithGrades | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // ... (Calculation logic remains same, skipping for brevity in thought process but will include in write) ...
  const studentsWithGrades = useMemo((): StudentWithGrades[] => {
    return students.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      const studentClass = classes.find(c => c.id === student.class_id);
      
      let fGradeCount = 0;
      let fWarningCount = 0;
      
      studentGrades.forEach(g => {
        if (g.grade === 'F') {
          if (g.grade_type === 'warning') {
            fWarningCount++;
          } else {
            fGradeCount++;
          }
        }
      });
      
      let fCount = 0;
      if (activeGradeTypeFilter === 'grades') {
        fCount = fGradeCount;
      } else if (activeGradeTypeFilter === 'warnings') {
        fCount = fWarningCount;
      } else {
        fCount = fGradeCount + fWarningCount;
      }
      
      return {
        ...student,
        class: studentClass,
        grades: studentGrades,
        fCount,
        warningCount: fWarningCount
      };
    });
  }, [students, grades, classes, activeGradeTypeFilter]);

  const filteredStudents = useMemo(() => {
    return studentsWithGrades
      .filter(s => s.fCount > 0)
      .filter(s => {
        if (selectedClassIds.length > 0 && !selectedClassIds.includes(s.class_id)) {
          return false;
        }
        if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        if (courseFilter) {
          const hasGradeInCourse = s.grades.some(g => {
            if (g.course_id !== courseFilter || g.grade !== 'F') return false;
            
            if (activeGradeTypeFilter === 'grades') {
              return g.grade_type !== 'warning';
            } else if (activeGradeTypeFilter === 'warnings') {
              return g.grade_type === 'warning';
            }
            return true;
          });
          if (!hasGradeInCourse) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name': return a.name.localeCompare(b.name);
          case 'class': return (a.class?.name || '').localeCompare(b.class?.name || '');
          case 'f_count': return b.fCount - a.fCount;
          default: return 0;
        }
      });
  }, [studentsWithGrades, selectedClassIds, searchTerm, courseFilter, sortBy, activeGradeTypeFilter]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, courseFilter, selectedClassIds, activeGradeTypeFilter]);

  // Paginated students (or all if showAll is true)
  const paginatedStudents = useMemo(() => {
    if (showAll) return filteredStudents;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage, showAll]);

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    const totalF = filteredStudents.reduce((sum, s) => sum + s.fCount, 0);
    const studentsWithF = filteredStudents.length;
    
    const courseFCounts: Record<string, number> = {};
    filteredStudents.forEach(s => {
      s.grades.forEach(g => {
        if (g.grade !== 'F') return;
        
        const isGradeMatch = activeGradeTypeFilter === 'grades' && g.grade_type !== 'warning';
        const isWarningMatch = activeGradeTypeFilter === 'warnings' && g.grade_type === 'warning';
        const isBothMatch = activeGradeTypeFilter === 'both';
        
        if (isGradeMatch || isWarningMatch || isBothMatch) {
          courseFCounts[g.course_id] = (courseFCounts[g.course_id] || 0) + 1;
        }
      });
    });
    
    let worstCourseId = '';
    let worstCourseCount = 0;
    Object.entries(courseFCounts).forEach(([id, count]) => {
      if (count > worstCourseCount) {
        worstCourseId = id;
        worstCourseCount = count;
      }
    });
    const worstCourse = courses.find(c => c.id === worstCourseId);
    
    const classFCounts: Record<string, number> = {};
    filteredStudents.forEach(s => {
      if (s.class_id) {
        classFCounts[s.class_id] = (classFCounts[s.class_id] || 0) + s.fCount;
      }
    });
    
    let worstClassId = '';
    let worstClassCount = 0;
    Object.entries(classFCounts).forEach(([id, count]) => {
      if (count > worstClassCount) {
        worstClassId = id;
        worstClassCount = count;
      }
    });
    const worstClass = classes.find(c => c.id === worstClassId);
    
    return { totalF, studentsWithF, worstCourse, worstClass, courseFCounts, classFCounts };
  }, [filteredStudents, courses, classes, activeGradeTypeFilter]);

  // Updated colors for Modern Tech palette
  const classChartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];
    
    Object.entries(stats.classFCounts)
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
        label: activeGradeTypeFilter === 'warnings' ? 'F-varningar' : 'F-betyg',
        data,
        backgroundColor: activeGradeTypeFilter === 'warnings' 
          ? '#f59e0b' // Amber 500
          : '#ef4444', // Red 500
        borderRadius: 6,
        barThickness: 32,
      }]
    };
  }, [stats.classFCounts, classes, activeGradeTypeFilter]);

  const courseChartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];
    
    // Modern palette sequence
    const backgroundColors = [
      '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', // Indigo to Pink
      '#f43f5e', '#f97316', '#f59e0b', '#84cc16'  // Rose to Lime
    ];
    
    Object.entries(stats.courseFCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([courseId, count], i) => {
        const course = courses.find(c => c.id === courseId);
        if (course) {
          labels.push(course.code || course.name);
          data.push(count);
        }
      });
    
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderWidth: 0,
        hoverOffset: 15
      }]
    };
  }, [stats.courseFCounts, courses]);

  const getRowClass = (fCount: number) => {
    // Subtle background tints for high risk
    if (fCount >= 3) return 'bg-red-50/50';
    if (fCount === 2) return 'bg-orange-50/50';
    return '';
  };

  return (
    <div className="space-y-8 animate-enter">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="heading-lg mb-1">Resultatöversikt</h2>
          <p className="text-subtle">Analysera F-betyg och varningar i realtid.</p>
        </div>

        {/* Filter Tabs - Segmented Control Style */}
        <div className="inline-flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-strong)] shadow-sm">
          {(['grades', 'warnings', 'both'] as GradeTypeFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => setActiveGradeTypeFilter(filter)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeGradeTypeFilter === filter
                  ? 'bg-[var(--color-primary)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {filter === 'grades' ? 'F-betyg' : filter === 'warnings' ? 'F-varningar' : 'Alla'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card group">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Totalt antal</p>
            <div className="text-4xl font-bold text-[var(--text-primary)]">
              {stats.totalF}
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeGradeTypeFilter === 'warnings' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              {activeGradeTypeFilter === 'warnings' ? 'Varningar' : 'Underkända'}
            </span>
          </div>
        </div>

        <div className="stat-card group">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Berörda elever</p>
            <div className="text-4xl font-bold text-[var(--color-primary)]">
              {stats.studentsWithF}
            </div>
          </div>
          <div className="mt-4 text-sm text-[var(--text-tertiary)]">
            {(stats.studentsWithF / (students.length || 1) * 100).toFixed(1)}% av totalen
          </div>
        </div>

        <div className="stat-card group">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Kurs med flest</p>
            <div className="text-2xl font-bold text-[var(--text-primary)] truncate" title={stats.worstCourse?.name}>
              {stats.worstCourse?.code || stats.worstCourse?.name || '-'}
            </div>
          </div>
          <div className="mt-auto pt-2 text-xs text-[var(--text-tertiary)]">
            Behöver uppmärksamhet
          </div>
        </div>

        <div className="stat-card group">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Klass med flest</p>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.worstClass?.name || '-'}
            </div>
          </div>
          <div className="mt-auto pt-2 text-xs text-[var(--text-tertiary)]">
            Insats krävs
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column: Charts & Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Controls Card */}
          <div className="card p-5">
            <h3 className="heading-md mb-4 text-lg">Filtrering</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1.5 block">Sök</label>
                <input
                  type="text"
                  placeholder="Namn eller personnummer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input"
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1.5 block">Kurs</label>
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="select"
                >
                  <option value="">Alla kurser</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.code || course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1.5 block">Sortering</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="select"
                >
                  <option value="f_count">Antal F (Fallande)</option>
                  <option value="name">Namn (A-Ö)</option>
                  <option value="class">Klass (A-Ö)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Chart Card - Classes */}
          <div className="card p-5">
            <h3 className="heading-md mb-4 text-lg">Fördelning per klass</h3>
            <div className="h-[250px] w-full">
              <Bar
                data={classChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { 
                      beginAtZero: true, 
                      grid: { color: '#f1f5f9' },
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

          {/* Chart Card - Courses */}
          <div className="card p-5">
            <h3 className="heading-md mb-4 text-lg">Fördelning per kurs</h3>
            <div className="h-[280px] w-full flex items-center justify-center">
              {courseChartData.labels.length > 0 ? (
                <Pie
                  data={courseChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          boxWidth: 12,
                          padding: 8,
                          font: { size: 11 }
                        }
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.label}: ${ctx.raw} st`
                        }
                      }
                    }
                  }}
                />
              ) : (
                <p className="text-[var(--text-tertiary)] text-sm">Ingen data att visa</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Table */}
        <div className="lg:col-span-2">
          <div className="card h-full flex flex-col">
            <div className="p-5 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
              <h3 className="heading-md text-lg">Detaljerad lista</h3>
              <div className="flex items-center gap-3">
                <span className="badge bg-[var(--bg-active)] text-[var(--text-secondary)]">
                  {filteredStudents.length} elever
                </span>
                {totalPages > 1 && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    Sida {currentPage} av {totalPages}
                  </span>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-secondary)]/50">
                    <th className="px-6 py-4">Elev</th>
                    <th className="px-6 py-4">Klass</th>
                    <th className="px-6 py-4 text-center">Antal</th>
                    <th className="px-6 py-4">Kurser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[var(--text-tertiary)]">
                        Inga resultat matchar dina filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map(student => {
                      const fCourses = student.grades
                        .filter(g => {
                          if (g.grade !== 'F') return false;
                          if (activeGradeTypeFilter === 'grades') return g.grade_type !== 'warning';
                          if (activeGradeTypeFilter === 'warnings') return g.grade_type === 'warning';
                          return true;
                        })
                        .map(g => ({
                          course: courses.find(c => c.id === g.course_id),
                          isWarning: g.grade_type === 'warning'
                        }))
                        .filter(item => item.course);
                      
                      return (
                        <tr key={student.id} className={`hover:bg-[var(--bg-hover)] transition-colors group ${getRowClass(student.fCount)}`}>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedStudent(student)}
                              className="font-medium text-[var(--text-primary)] hover:text-[var(--color-primary)] transition-colors"
                            >
                              {student.name}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                            {student.class?.name || '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              student.fCount >= 3 
                                ? 'bg-red-100 text-red-700' 
                                : student.fCount === 2 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-slate-100 text-slate-700'
                            }`}>
                              {student.fCount}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {fCourses.slice(0, 3).map(({ course, isWarning }, idx) => (
                                <span
                                  key={`${course!.id}-${idx}`}
                                  className={`text-[10px] px-2 py-1 rounded border font-medium ${
                                    isWarning
                                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                                      : 'bg-red-50 border-red-200 text-red-700'
                                  }`}
                                >
                                  {course!.code || course!.name}
                                </span>
                              ))}
                              {fCourses.length > 3 && (
                                <span className="text-[10px] px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-500 font-medium">
                                  +{fCourses.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {(totalPages > 1 || showAll) && (
              <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
                <div className="text-sm text-[var(--text-tertiary)]">
                  {showAll 
                    ? `Visar alla ${filteredStudents.length} elever`
                    : `Visar ${((currentPage - 1) * ITEMS_PER_PAGE) + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)} av ${filteredStudents.length}`
                  }
                </div>
                <div className="flex items-center gap-2">
                  {/* Show All / Paginate Toggle */}
                  <button
                    onClick={() => {
                      setShowAll(!showAll);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                      showAll 
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' 
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {showAll ? 'Paginera' : 'Visa alla'}
                  </button>
                  
                  {/* Page navigation - only show when not showing all */}
                  {!showAll && (
                    <>
                      <div className="w-px h-6 bg-[var(--border-subtle)] mx-1"></div>
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] transition-colors"
                        title="Första sidan"
                      >
                        ««
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        Föregående
                      </button>
                      
                      {/* Page numbers */}
                      <div className="flex items-center gap-1 mx-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-[var(--color-primary)] text-white'
                                  : 'hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        Nästa
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] transition-colors"
                        title="Sista sidan"
                      >
                        »»
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
