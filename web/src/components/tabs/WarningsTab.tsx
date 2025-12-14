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

// Register ChartJS components
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

  // Calculate students with F grades
  const studentsWithGrades = useMemo((): StudentWithGrades[] => {
    return students.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      const studentClass = classes.find(c => c.id === student.class_id);
      
      let fGradeCount = 0;
      let fWarningCount = 0;
      
      studentGrades.forEach(g => {
        if (g.grade === 'F') {
          // F-betyg = grade_type is 'grade' or undefined/null
          // F-varning = grade_type is 'warning'
          if (g.grade_type === 'warning') {
            fWarningCount++;
          } else {
            fGradeCount++;
          }
        }
      });
      
      // Set fCount based on filter
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

  // Filter students
  const filteredStudents = useMemo(() => {
    return studentsWithGrades
      .filter(s => s.fCount > 0)
      .filter(s => {
        // Class filter
        if (selectedClassIds.length > 0 && !selectedClassIds.includes(s.class_id)) {
          return false;
        }
        // Search filter
        if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        // Course filter
        if (courseFilter) {
          const hasGradeInCourse = s.grades.some(g => {
            if (g.course_id !== courseFilter || g.grade !== 'F') return false;
            
            if (activeGradeTypeFilter === 'grades') {
              return g.grade_type !== 'warning';
            } else if (activeGradeTypeFilter === 'warnings') {
              return g.grade_type === 'warning';
            }
            return true; // 'both'
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

  // Statistics
  const stats = useMemo(() => {
    const totalF = filteredStudents.reduce((sum, s) => sum + s.fCount, 0);
    const studentsWithF = filteredStudents.length;
    
    // Course with most F
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
    
    // Class with most F
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

  // Chart data
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
        label: activeGradeTypeFilter === 'warnings' ? 'Antal F-varningar' : 'Antal F',
        data,
        backgroundColor: activeGradeTypeFilter === 'warnings' 
          ? 'rgba(245, 158, 11, 0.7)' 
          : 'rgba(239, 68, 68, 0.7)',
        borderColor: activeGradeTypeFilter === 'warnings'
          ? 'rgba(245, 158, 11, 1)'
          : 'rgba(239, 68, 68, 1)',
        borderWidth: 1
      }]
    };
  }, [stats.classFCounts, classes, activeGradeTypeFilter]);

  const courseChartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];
    
    const colors = [
      'rgba(239, 68, 68, 0.7)',
      'rgba(245, 158, 11, 0.7)',
      'rgba(234, 179, 8, 0.7)',
      'rgba(132, 204, 22, 0.7)',
      'rgba(34, 197, 94, 0.7)',
      'rgba(59, 130, 246, 0.7)',
      'rgba(139, 92, 246, 0.7)',
      'rgba(236, 72, 153, 0.7)',
    ];
    
    Object.entries(stats.courseFCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([courseId, count], i) => {
        const course = courses.find(c => c.id === courseId);
        if (course) {
          labels.push(course.code || course.name);
          data.push(count);
          backgroundColors.push(colors[i % colors.length]);
        }
      });
    
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderWidth: 0
      }]
    };
  }, [stats.courseFCounts, courses]);

  const getRowClass = (fCount: number) => {
    if (fCount >= 3) return 'f-count-3plus';
    if (fCount === 2) return 'f-count-2';
    return 'f-count-1';
  };

  const handleSelectAllClasses = () => {
    setSelectedClassIds(classes.map(c => c.id));
  };

  const handleClearAllClasses = () => {
    setSelectedClassIds([]);
  };

  // Get label based on filter type
  const getFilterLabel = () => {
    switch (activeGradeTypeFilter) {
      case 'grades': return 'F-betyg';
      case 'warnings': return 'F-varningar';
      case 'both': return 'F (betyg + varningar)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-xl font-bold">F-varningar & Resultatanalys</h2>
      </div>

      {/* Grade type filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">Visa:</span>
        {(['grades', 'warnings', 'both'] as GradeTypeFilter[]).map(filter => (
          <button
            key={filter}
            onClick={() => setActiveGradeTypeFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeGradeTypeFilter === filter
                ? filter === 'warnings' 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-[#624c9a] text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {filter === 'grades' ? '📊 F-betyg' : filter === 'warnings' ? '⚠️ F-varningar' : '📊 Båda'}
          </button>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <p className="mb-2">
          <strong>F-betyg:</strong> Elever som har fått betyget F (underkänt)
        </p>
        <p>
          <strong>F-varningar:</strong> Elever som riskerar att få F i framtiden (tidig identifiering)
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card card rounded-xl p-4 border">
          <div className="text-3xl font-bold" style={{ 
            color: activeGradeTypeFilter === 'warnings' ? '#f59e0b' : '#ef4444' 
          }}>
            {stats.totalF}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Totalt antal {getFilterLabel()}
          </div>
        </div>
        <div className="stat-card card rounded-xl p-4 border">
          <div className="text-3xl font-bold text-[#624c9a]">{stats.studentsWithF}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Elever med {getFilterLabel()}</div>
        </div>
        <div className="stat-card card rounded-xl p-4 border">
          <div className="text-xl font-bold text-[#e72c81] truncate">
            {stats.worstCourse?.code || stats.worstCourse?.name || '-'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Flest {getFilterLabel()} (kurs)</div>
        </div>
        <div className="stat-card card rounded-xl p-4 border">
          <div className="text-xl font-bold text-[#43bde3] truncate">
            {stats.worstClass?.name || '-'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Flest {getFilterLabel()} (klass)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card rounded-xl p-4 border space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Sök elev..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full px-4 py-2 rounded-lg"
            />
          </div>
          
          {/* Course filter */}
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="select px-4 py-2 rounded-lg min-w-[150px]"
          >
            <option value="">Alla kurser</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.code || course.name}
              </option>
            ))}
          </select>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'class' | 'f_count')}
            className="select px-4 py-2 rounded-lg"
          >
            <option value="f_count">Sortera: Flest F</option>
            <option value="name">Sortera: Namn</option>
            <option value="class">Sortera: Klass</option>
          </select>
          
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            {showAdvancedFilters ? 'Dölj filter' : 'Avancerade filter'} ▼
          </button>
        </div>

        {/* Advanced filters - Class checkboxes */}
        {showAdvancedFilters && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-4 mb-3">
              <span className="font-medium">Klasser:</span>
              <button
                onClick={handleSelectAllClasses}
                className="text-sm text-[#624c9a] hover:underline"
              >
                Välj alla
              </button>
              <button
                onClick={handleClearAllClasses}
                className="text-sm text-[#624c9a] hover:underline"
              >
                Rensa alla
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {classes.map(cls => (
                <label
                  key={cls.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition ${
                    selectedClassIds.includes(cls.id)
                      ? 'bg-[#624c9a] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(cls.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClassIds([...selectedClassIds, cls.id]);
                      } else {
                        setSelectedClassIds(selectedClassIds.filter(id => id !== cls.id));
                      }
                    }}
                    className="sr-only"
                  />
                  {cls.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card rounded-xl p-4 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            📊 {getFilterLabel()} per klass
          </h3>
          <div className="chart-container">
            <Bar
              data={classChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
              }}
            />
          </div>
        </div>
        <div className="card rounded-xl p-4 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            🥧 {getFilterLabel()} per kurs
          </h3>
          <div className="chart-container">
            <Pie
              data={courseChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 11 } }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Students table */}
      <div className="card rounded-xl border overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b flex items-center gap-2">
          {activeGradeTypeFilter === 'warnings' ? (
            <span className="text-orange-500">⚠️</span>
          ) : (
            <span className="text-red-500">📊</span>
          )}
          <h3 className="font-semibold">
            Elever med {getFilterLabel()}
          </h3>
          <span className="text-sm text-gray-500">({filteredStudents.length} elever)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Elev</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Klass</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Antal</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Kurser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    🎉 Inga {getFilterLabel().toLowerCase()} att visa!
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const fCourses = student.grades
                    .filter(g => {
                      if (g.grade !== 'F') return false;
                      
                      if (activeGradeTypeFilter === 'grades') {
                        return g.grade_type !== 'warning';
                      } else if (activeGradeTypeFilter === 'warnings') {
                        return g.grade_type === 'warning';
                      }
                      return true; // 'both'
                    })
                    .map(g => ({
                      course: courses.find(c => c.id === g.course_id),
                      isWarning: g.grade_type === 'warning'
                    }))
                    .filter(item => item.course);
                  
                  return (
                    <tr key={student.id} className={getRowClass(student.fCount)}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="student-name font-medium"
                        >
                          {student.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {student.class?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-sm font-semibold ${
                          activeGradeTypeFilter === 'warnings'
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}>
                          {student.fCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {fCourses.slice(0, 5).map(({ course, isWarning }, idx) => (
                            <span
                              key={`${course!.id}-${idx}`}
                              className={`text-xs px-2 py-0.5 rounded ${
                                isWarning
                                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              }`}
                              title={isWarning ? 'F-varning' : 'F-betyg'}
                            >
                              {isWarning && '⚠️ '}{course!.code || course!.name}
                            </span>
                          ))}
                          {fCourses.length > 5 && (
                            <span className="text-xs text-gray-500">
                              +{fCourses.length - 5}
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
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
