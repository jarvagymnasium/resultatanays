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
          ? 'rgba(201, 160, 103, 0.6)' 
          : 'rgba(184, 112, 112, 0.6)',
        borderColor: activeGradeTypeFilter === 'warnings'
          ? 'rgba(201, 160, 103, 1)'
          : 'rgba(184, 112, 112, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    };
  }, [stats.classFCounts, classes, activeGradeTypeFilter]);

  const courseChartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];
    
    // Muted pastel colors
    const colors = [
      'rgba(184, 112, 112, 0.7)',
      'rgba(201, 160, 103, 0.7)',
      'rgba(169, 169, 107, 0.7)',
      'rgba(107, 158, 124, 0.7)',
      'rgba(107, 140, 158, 0.7)',
      'rgba(140, 107, 158, 0.7)',
      'rgba(158, 107, 140, 0.7)',
      'rgba(158, 140, 107, 0.7)',
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
        <h2 className="text-xl font-semibold text-[var(--color-text)]">F-varningar & Resultatanalys</h2>
      </div>

      {/* Grade type filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Visa:</span>
        {(['grades', 'warnings', 'both'] as GradeTypeFilter[]).map(filter => (
          <button
            key={filter}
            onClick={() => setActiveGradeTypeFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeGradeTypeFilter === filter
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
            }`}
          >
            {filter === 'grades' ? 'F-betyg' : filter === 'warnings' ? 'F-varningar' : 'Båda'}
          </button>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-lg p-4 text-sm">
        <p className="mb-2 text-[var(--color-text)]">
          <span className="font-medium">F-betyg:</span> Elever som har fått betyget F (underkänt)
        </p>
        <p className="text-[var(--color-text)]">
          <span className="font-medium">F-varningar:</span> Elever som riskerar att få F i framtiden (tidig identifiering)
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="text-3xl font-semibold text-[var(--color-danger)]">
            {stats.totalF}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">
            Totalt antal {getFilterLabel()}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-3xl font-semibold text-[var(--color-primary)]">{stats.studentsWithF}</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Elever med {getFilterLabel()}</div>
        </div>
        <div className="stat-card">
          <div className="text-xl font-semibold text-[var(--color-accent)] truncate">
            {stats.worstCourse?.code || stats.worstCourse?.name || '-'}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Flest {getFilterLabel()} (kurs)</div>
        </div>
        <div className="stat-card">
          <div className="text-xl font-semibold text-[var(--color-primary-soft)] truncate">
            {stats.worstClass?.name || '-'}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Flest {getFilterLabel()} (klass)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Sök elev..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
            />
          </div>
          
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="select min-w-[150px]"
          >
            <option value="">Alla kurser</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.code || course.name}
              </option>
            ))}
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'class' | 'f_count')}
            className="select"
          >
            <option value="f_count">Sortera: Flest F</option>
            <option value="name">Sortera: Namn</option>
            <option value="class">Sortera: Klass</option>
          </select>
          
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="btn btn-secondary"
          >
            {showAdvancedFilters ? 'Dölj filter' : 'Fler filter'}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="border-t border-[var(--color-border-subtle)] pt-4 mt-4">
            <div className="flex items-center gap-4 mb-3">
              <span className="font-medium text-[var(--color-text)]">Klasser:</span>
              <button
                onClick={handleSelectAllClasses}
                className="text-sm text-[var(--color-primary)] hover:underline"
              >
                Välj alla
              </button>
              <button
                onClick={handleClearAllClasses}
                className="text-sm text-[var(--color-primary)] hover:underline"
              >
                Rensa alla
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {classes.map(cls => (
                <label
                  key={cls.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    selectedClassIds.includes(cls.id)
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
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
        <div className="card p-4">
          <h3 className="font-medium text-[var(--color-text)] mb-4">
            {getFilterLabel()} per klass
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
        <div className="card p-4">
          <h3 className="font-medium text-[var(--color-text)] mb-4">
            {getFilterLabel()} per kurs
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
      <div className="card overflow-hidden">
        <div className="p-4 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-subtle)]">
          <h3 className="font-medium text-[var(--color-text)]">
            Elever med {getFilterLabel()}
            <span className="text-sm text-[var(--color-text-muted)] ml-2">({filteredStudents.length} elever)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-sunken)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Elev</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Klass</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)]">Antal</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Kurser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    Inga {getFilterLabel().toLowerCase()} att visa
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
                      return true;
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
                      <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                        {student.class?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          activeGradeTypeFilter === 'warnings'
                            ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                            : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
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
                                  ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                                  : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                              }`}
                              title={isWarning ? 'F-varning' : 'F-betyg'}
                            >
                              {course!.code || course!.name}
                            </span>
                          ))}
                          {fCourses.length > 5 && (
                            <span className="text-xs text-[var(--color-text-muted)]">
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

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
