'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import type { StudentWithGrades } from '@/lib/types';

interface Props {
  student: StudentWithGrades;
  onClose: () => void;
}

export default function StudentDetailModal({ student, onClose }: Props) {
  const { courses, gradeHistory, userCan, setGrade, clearGrade, activeGradeTypeFilter } = useAppStore();

  // Get F-betyg courses (grade=F, grade_type='grade')
  const fGradeCourses = useMemo(() => {
    return student.grades
      .filter(g => g.grade === 'F' && g.grade_type !== 'warning')
      .map(g => ({
        grade: g,
        course: courses.find(c => c.id === g.course_id)
      }))
      .filter(item => item.course);
  }, [student.grades, courses]);

  // Get F-varning courses (grade=F, grade_type='warning')
  const fWarningCourses = useMemo(() => {
    return student.grades
      .filter(g => g.grade === 'F' && g.grade_type === 'warning')
      .map(g => ({
        grade: g,
        course: courses.find(c => c.id === g.course_id)
      }))
      .filter(item => item.course);
  }, [student.grades, courses]);

  // Combined F courses based on filter
  const displayedFCourses = useMemo(() => {
    if (activeGradeTypeFilter === 'grades') return fGradeCourses;
    if (activeGradeTypeFilter === 'warnings') return fWarningCourses;
    return [...fGradeCourses, ...fWarningCourses];
  }, [activeGradeTypeFilter, fGradeCourses, fWarningCourses]);

  // Get improvement history for this student
  const studentProgress = useMemo(() => {
    return gradeHistory
      .filter(h => h.student_id === student.id && h.change_type === 'improvement')
      .map(h => ({
        ...h,
        course: courses.find(c => c.id === h.course_id)
      }))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [gradeHistory, student.id, courses]);

  // All grades for grade editing
  const allGradeableItems = useMemo(() => {
    return student.grades.map(g => ({
      grade: g,
      course: courses.find(c => c.id === g.course_id)
    })).filter(item => item.course);
  }, [student.grades, courses]);

  const canEditGrades = userCan('manage_grades');

  const handleGradeChange = async (courseId: string, newGrade: string, gradeType: 'grade' | 'warning') => {
    try {
      await setGrade(student.id, courseId, newGrade, gradeType);
    } catch (error) {
      console.error('Error updating grade:', error);
    }
  };

  const handleClearGrade = async (courseId: string) => {
    try {
      await clearGrade(student.id, courseId);
    } catch (error) {
      console.error('Error clearing grade:', error);
    }
  };

  const gradeOptions = ['A', 'B', 'C', 'D', 'E', 'F'];

  const getGradeButtonColor = (g: string, isSelected: boolean) => {
    if (!isSelected) return 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600';
    switch (g) {
      case 'A': return 'bg-green-500 text-white';
      case 'B': return 'bg-lime-500 text-white';
      case 'C': return 'bg-yellow-500 text-white';
      case 'D': return 'bg-orange-500 text-white';
      case 'E': return 'bg-red-400 text-white';
      case 'F': return 'bg-red-600 text-white';
      default: return 'bg-gray-200 dark:bg-gray-700';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content p-6 max-w-2xl w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">{student.name}</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {student.class?.name || 'Ingen klass'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* F-count badges */}
        <div className="flex items-center gap-4 mb-6">
          {fGradeCourses.length > 0 && (
            <div className="bg-red-100 dark:bg-red-900/30 rounded-lg px-4 py-2">
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{fGradeCourses.length}</span>
              <span className="text-sm text-red-600 dark:text-red-400 ml-2">F-betyg</span>
            </div>
          )}
          {fWarningCourses.length > 0 && (
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg px-4 py-2">
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{fWarningCourses.length}</span>
              <span className="text-sm text-orange-600 dark:text-orange-400 ml-2">F-varningar</span>
            </div>
          )}
          {fGradeCourses.length === 0 && fWarningCourses.length === 0 && (
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg px-4 py-2">
              <span className="text-sm text-green-600 dark:text-green-400">🎉 Inga F!</span>
            </div>
          )}
        </div>

        {/* F Courses */}
        {displayedFCourses.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3">📚 Kurser med F</h3>
            <div className="space-y-2">
              {displayedFCourses.map(({ grade, course }) => {
                const isWarning = grade.grade_type === 'warning';
                return (
                  <div
                    key={grade.id}
                    className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                      isWarning 
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500' 
                        : 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{course!.name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                        ({course!.code})
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      isWarning
                        ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                        : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                    }`}>
                      {isWarning ? '⚠️ F-varning' : 'F-betyg'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress History */}
        {studentProgress.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              📈 Betygsutveckling
            </h3>
            <div className="space-y-2">
              {studentProgress.slice(0, 5).map(progress => (
                <div
                  key={progress.id}
                  className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2"
                >
                  <div>
                    <span className="font-medium">{progress.course?.name}</span>
                    {progress.grade_type === 'warning' && (
                      <span className="text-xs text-gray-500 ml-2">(varning)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-medium">{progress.from_grade || '-'}</span>
                    <span>→</span>
                    <span className="text-green-500 font-medium">{progress.to_grade}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grade editing (for teachers/admins) */}
        {canEditGrades && allGradeableItems.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              ✏️ Redigera betyg
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Klicka på ett betyg för att sätta det. Använd F-varning för elever som riskerar F.
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {allGradeableItems.map(({ grade, course }) => {
                const isWarning = grade.grade === 'F' && grade.grade_type === 'warning';
                const hasRegularGrade = !!grade.grade && grade.grade_type !== 'warning';
                
                return (
                  <div
                    key={grade.id}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <span className="font-medium">{course!.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({course!.code})</span>
                      {isWarning && (
                        <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-2 py-0.5 rounded">
                          ⚠️ Varning
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Regular grade buttons */}
                      {gradeOptions.map(g => (
                        <button
                          key={`grade-${g}`}
                          onClick={() => handleGradeChange(course!.id, g, 'grade')}
                          className={`w-7 h-7 rounded text-xs font-medium transition ${
                            getGradeButtonColor(g, hasRegularGrade && grade.grade === g)
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                      
                      {/* F-varning button */}
                      <button
                        onClick={() => handleGradeChange(course!.id, 'F', 'warning')}
                        className={`px-2 h-7 rounded text-xs font-medium transition ml-2 ${
                          isWarning
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                        }`}
                      >
                        ⚠️
                      </button>
                      
                      {/* Clear button */}
                      {grade.grade && (
                        <button
                          onClick={() => handleClearGrade(course!.id)}
                          className="w-7 h-7 rounded text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition ml-1"
                          title="Ta bort betyg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="btn-primary px-6 py-2 rounded-lg"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}
