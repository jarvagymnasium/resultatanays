'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';

interface DuplicateInfo {
  grades: {
    total: number;
    unique: number;
    duplicatesFound: number;
  };
  gradeHistory: {
    total: number;
    unique: number;
    duplicatesFound: number;
  };
}

export default function GradesTab() {
  const {
    students,
    classes,
    courses,
    grades,
    classCourseMappings,
    setGrade,
    clearGrade,
    userCan,
    activeQuarter,
    fetchGrades
  } = useAppStore();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Duplicate management state
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);

  const canManage = userCan('manage_grades');

  // Find duplicates via API (checks both grades and grade_history tables)
  const findDuplicates = async () => {
    setIsLoadingDuplicates(true);
    
    try {
      const response = await fetch('/api/admin/cleanup-duplicates');
      const data = await response.json();
      
      if (response.ok) {
        setDuplicateInfo(data);
        setShowDuplicates(true);
      } else {
        alert('Kunde inte hämta dubbletter: ' + (data.error || 'Okänt fel'));
      }
    } catch (error) {
      console.error('Error finding duplicates:', error);
      alert('Ett fel uppstod');
    } finally {
      setIsLoadingDuplicates(false);
    }
  };

  // Clean up all duplicates (keep newest)
  const cleanupAllDuplicates = async () => {
    const totalDuplicates = (duplicateInfo?.grades.duplicatesFound || 0) + (duplicateInfo?.gradeHistory.duplicatesFound || 0);
    
    if (!confirm(`Vill du ta bort ${totalDuplicates} dubbletter? Den senaste posten för varje kombination behålls.`)) return;
    
    setIsCleaningUp(true);
    
    try {
      const response = await fetch('/api/admin/cleanup-duplicates', {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Rensning klar!\n\n• Betyg: ${result.gradesDeleted} dubbletter borttagna\n• Betygshistorik: ${result.historyDeleted} dubbletter borttagna\n\nTotalt: ${result.totalDeleted} poster`);
        setDuplicateInfo(null);
        setShowDuplicates(false);
        await fetchGrades();
      } else {
        alert('Kunde inte rensa dubbletter: ' + (result.error || 'Okänt fel'));
      }
    } catch (error) {
      console.error('Error cleaning duplicates:', error);
      alert('Ett fel uppstod vid rensning');
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Get available courses for selected class
  const availableCourses = useMemo(() => {
    if (!selectedClassId) return [];
    
    const courseIds = classCourseMappings
      .filter(m => m.class_id === selectedClassId)
      .map(m => m.course_id);
    
    return courses.filter(c => courseIds.includes(c.id));
  }, [selectedClassId, classCourseMappings, courses]);

  // Get students for selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students
      .filter(s => s.class_id === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedClassId, students]);

  // Get grades for selected class/course
  const studentGrades = useMemo(() => {
    if (!selectedClassId || !selectedCourseId) return {};
    
    const result: Record<string, { grade: string | null; gradeType: 'grade' | 'warning' }> = {};
    
    classStudents.forEach(student => {
      const grade = grades.find(
        g => g.student_id === student.id && g.course_id === selectedCourseId
      );
      result[student.id] = {
        grade: grade?.grade || null,
        gradeType: grade?.grade_type || 'grade'
      };
    });
    
    return result;
  }, [classStudents, grades, selectedCourseId]);

  const handleGradeClick = async (studentId: string, gradeValue: string, gradeType: 'grade' | 'warning' = 'grade') => {
    if (!canManage) return;
    
    setIsUpdating(studentId);
    try {
      const current = studentGrades[studentId];
      const isSameGrade = current?.grade === gradeValue && current?.gradeType === gradeType;
      
      if (isSameGrade) {
        // Clear if clicking same grade
        await clearGrade(studentId, selectedCourseId);
      } else {
        await setGrade(studentId, selectedCourseId, gradeValue, gradeType);
      }
    } catch (error) {
      console.error('Error updating grade:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleClearGrade = async (studentId: string) => {
    if (!canManage) return;
    
    setIsUpdating(studentId);
    try {
      await clearGrade(studentId, selectedCourseId);
    } catch (error) {
      console.error('Error clearing grade:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const gradeOptions = ['A', 'B', 'C', 'D', 'E', 'F'];

  const getGradeColor = (grade: string, isSelected: boolean) => {
    if (!isSelected) return 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600';
    
    switch (grade) {
      case 'A': return 'bg-green-500 text-white';
      case 'B': return 'bg-lime-500 text-white';
      case 'C': return 'bg-yellow-500 text-white';
      case 'D': return 'bg-orange-500 text-white';
      case 'E': return 'bg-red-400 text-white';
      case 'F': return 'bg-red-600 text-white';
      default: return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    let setCount = 0;
    let fGradeCount = 0;
    let fWarningCount = 0;
    
    Object.entries(studentGrades).forEach(([, data]) => {
      if (data.grade) {
        setCount++;
        if (data.grade === 'F') {
          if (data.gradeType === 'warning') {
            fWarningCount++;
          } else {
            fGradeCount++;
          }
        }
      }
    });
    
    return {
      total: classStudents.length,
      set: setCount,
      remaining: classStudents.length - setCount,
      fGradeCount,
      fWarningCount
    };
  }, [classStudents, studentGrades]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Betygsättning</h2>
        <div className="flex items-center gap-4">
          {canManage && (
            <button
              onClick={findDuplicates}
              disabled={isLoadingDuplicates}
              className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
            >
              {isLoadingDuplicates ? (
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )}
              Hantera dubbletter
            </button>
          )}
          {activeQuarter && (
            <div className="text-sm text-gray-500">
              Aktivt kvartal: <span className="font-medium text-[#624c9a]">{activeQuarter.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Duplicates Panel */}
      {showDuplicates && duplicateInfo && (
        <div className="card rounded-xl border overflow-hidden">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                Dubbletthantering
              </h3>
              <p className="text-sm text-amber-600 dark:text-amber-300">
                {(duplicateInfo.grades.duplicatesFound + duplicateInfo.gradeHistory.duplicatesFound) === 0 
                  ? 'Inga dubbletter hittades!' 
                  : `Totalt ${duplicateInfo.grades.duplicatesFound + duplicateInfo.gradeHistory.duplicatesFound} dubbletter hittades`
                }
              </p>
            </div>
            <div className="flex gap-2">
              {(duplicateInfo.grades.duplicatesFound + duplicateInfo.gradeHistory.duplicatesFound) > 0 && (
                <button
                  onClick={cleanupAllDuplicates}
                  disabled={isCleaningUp}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isCleaningUp ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  Rensa alla dubbletter
                </button>
              )}
              <button
                onClick={() => setShowDuplicates(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                Stäng
              </button>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Grades Table Stats */}
            <div className={`p-4 rounded-lg border ${
              duplicateInfo.grades.duplicatesFound > 0 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    duplicateInfo.grades.duplicatesFound > 0 
                      ? 'bg-red-100 dark:bg-red-900/30' 
                      : 'bg-green-100 dark:bg-green-900/30'
                  }`}>
                    <span className="text-xl">📝</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Betyg (grades)</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Aktuella betyg för elever
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {duplicateInfo.grades.duplicatesFound > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{duplicateInfo.grades.duplicatesFound}</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">0</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">dubbletter</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Totalt poster:</span>
                  <span className="ml-2 font-medium">{duplicateInfo.grades.total}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unika:</span>
                  <span className="ml-2 font-medium">{duplicateInfo.grades.unique}</span>
                </div>
              </div>
            </div>

            {/* Grade History Table Stats */}
            <div className={`p-4 rounded-lg border ${
              duplicateInfo.gradeHistory.duplicatesFound > 0 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    duplicateInfo.gradeHistory.duplicatesFound > 0 
                      ? 'bg-red-100 dark:bg-red-900/30' 
                      : 'bg-green-100 dark:bg-green-900/30'
                  }`}>
                    <span className="text-xl">📊</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Betygshistorik (grade_history)</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Utveckling och förbättringar (visas i Utveckling-fliken)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {duplicateInfo.gradeHistory.duplicatesFound > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{duplicateInfo.gradeHistory.duplicatesFound}</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">0</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">dubbletter</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Totalt poster:</span>
                  <span className="ml-2 font-medium">{duplicateInfo.gradeHistory.total}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unika:</span>
                  <span className="ml-2 font-medium">{duplicateInfo.gradeHistory.unique}</span>
                </div>
              </div>
            </div>

            {/* Summary */}
            {(duplicateInfo.grades.duplicatesFound + duplicateInfo.gradeHistory.duplicatesFound) > 0 && (
              <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>⚠️ Sammanfattning:</strong> Det finns totalt{' '}
                  <strong>{duplicateInfo.grades.duplicatesFound + duplicateInfo.gradeHistory.duplicatesFound}</strong>{' '}
                  dubbletter i databasen. Klicka på &quot;Rensa alla dubbletter&quot; för att ta bort dem. 
                  Den senaste posten för varje unik kombination behålls.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection */}
      <div className="card rounded-xl p-4 border">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Klass</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedCourseId('');
              }}
              className="select w-full px-4 py-2 rounded-lg"
            >
              <option value="">Välj klass</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Kurs</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="select w-full px-4 py-2 rounded-lg"
              disabled={!selectedClassId}
            >
              <option value="">Välj kurs</option>
              {availableCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {selectedClassId && selectedCourseId && (
        <div className="grid grid-cols-5 gap-4">
          <div className="card rounded-xl p-3 border text-center">
            <div className="text-2xl font-bold text-[#624c9a]">{stats.total}</div>
            <div className="text-xs text-gray-500">Elever</div>
          </div>
          <div className="card rounded-xl p-3 border text-center">
            <div className="text-2xl font-bold text-green-500">{stats.set}</div>
            <div className="text-xs text-gray-500">Satta</div>
          </div>
          <div className="card rounded-xl p-3 border text-center">
            <div className="text-2xl font-bold text-gray-500">{stats.remaining}</div>
            <div className="text-xs text-gray-500">Kvar</div>
          </div>
          <div className="card rounded-xl p-3 border text-center">
            <div className="text-2xl font-bold text-red-600">{stats.fGradeCount}</div>
            <div className="text-xs text-gray-500">F-betyg</div>
          </div>
          <div className="card rounded-xl p-3 border text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.fWarningCount}</div>
            <div className="text-xs text-gray-500">F-varningar</div>
          </div>
        </div>
      )}

      {/* Legend */}
      {selectedClassId && selectedCourseId && (
        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-gradient-to-r from-amber-500 to-orange-500"></span>
            F-varning = Eleven riskerar F
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-red-600"></span>
            F-betyg = Eleven har underkänt
          </span>
        </div>
      )}

      {/* Grade entry */}
      {selectedClassId && selectedCourseId ? (
        <div className="card rounded-xl border overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b">
            <h3 className="font-semibold">
              {classes.find(c => c.id === selectedClassId)?.name} - {' '}
              {courses.find(c => c.id === selectedCourseId)?.name}
            </h3>
            <p className="text-sm text-gray-500">
              Klicka på ett betyg för att sätta det. Klicka igen för att ta bort.
            </p>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {classStudents.map(student => {
              const data = studentGrades[student.id];
              const currentGrade = data?.grade;
              const currentGradeType = data?.gradeType || 'grade';
              const isLoading = isUpdating === student.id;
              
              const isRegularGrade = currentGrade && currentGradeType === 'grade';
              const isWarning = currentGrade === 'F' && currentGradeType === 'warning';
              
              return (
                <div
                  key={student.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    isLoading ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <span className="font-medium">{student.name}</span>
                    {currentGrade === 'F' && isRegularGrade && (
                      <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded">
                        F-betyg
                      </span>
                    )}
                    {isWarning && (
                      <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-2 py-0.5 rounded">
                        ⚠️ F-varning
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-1 items-center flex-wrap justify-end">
                    {/* Regular grade pills A-F */}
                    {gradeOptions.map(g => {
                      const isSelected = currentGrade === g && currentGradeType === 'grade';
                      return (
                        <button
                          key={g}
                          onClick={() => handleGradeClick(student.id, g, 'grade')}
                          disabled={!canManage || isLoading}
                          className={`w-9 h-9 rounded-lg font-semibold transition grade-pill text-sm ${
                            getGradeColor(g, isSelected)
                          } ${!canManage ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          {g}
                        </button>
                      );
                    })}
                    
                    {/* F-varning button - separate styling */}
                    <button
                      onClick={() => handleGradeClick(student.id, 'F', 'warning')}
                      disabled={!canManage || isLoading}
                      className={`px-3 h-9 rounded-lg font-semibold transition text-sm ml-2 ${
                        isWarning
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                          : 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 text-amber-700 dark:text-amber-300 hover:from-amber-200 hover:to-orange-200'
                      } ${!canManage ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      ⚠️ F-varning
                    </button>
                    
                    {/* Clear button */}
                    {currentGrade && (
                      <button
                        onClick={() => handleClearGrade(student.id)}
                        disabled={!canManage || isLoading}
                        className={`px-2 h-9 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 transition text-sm ml-1 ${
                          !canManage ? 'cursor-not-allowed opacity-50' : ''
                        }`}
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
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">📝</p>
          <p>Välj klass och kurs för att sätta betyg</p>
        </div>
      )}

      {!canManage && selectedClassId && selectedCourseId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center text-sm">
          ⚠️ Du har inte behörighet att ändra betyg
        </div>
      )}
    </div>
  );
}
