'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';

export default function CoursesTab() {
  const {
    courses,
    classes,
    grades,
    classCourseMappings,
    students,
    addCourse,
    archiveCourse,
    userCan,
    favoriteCourseIds,
    toggleFavoriteCourse,
    courseFilters,
    setCourseFilters
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = userCan('manage_courses');

  // Calculate stats for each course
  const coursesWithStats = useMemo(() => {
    return courses.map(course => {
      const courseGrades = grades.filter(g => g.course_id === course.id);
      const fCount = courseGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
      const warningCount = courseGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;
      
      const courseClasses = classCourseMappings
        .filter(m => m.course_id === course.id)
        .map(m => classes.find(c => c.id === m.class_id))
        .filter(Boolean);
      
      return {
        ...course,
        fCount,
        warningCount,
        totalGrades: courseGrades.length,
        classes: courseClasses
      };
    });
  }, [courses, grades, classCourseMappings, classes]);

  // Filter and sort courses
  const filteredCourses = useMemo(() => {
    let result = [...coursesWithStats];
    
    // Search filter
    if (courseFilters.search) {
      const search = courseFilters.search.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(search) ||
        c.code.toLowerCase().includes(search)
      );
    }
    
    // Class filter
    if (courseFilters.classId) {
      const courseIdsForClass = classCourseMappings
        .filter(m => m.class_id === courseFilters.classId)
        .map(m => m.course_id);
      result = result.filter(c => courseIdsForClass.includes(c.id));
    }
    
    // F-only filter
    if (courseFilters.fOnly) {
      result = result.filter(c => c.fCount > 0);
    }
    
    // Favorites only
    if (courseFilters.onlyFavorites) {
      result = result.filter(c => favoriteCourseIds.has(c.id));
    }
    
    // Sort
    switch (courseFilters.sortBy) {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'code_asc':
        result.sort((a, b) => a.code.localeCompare(b.code));
        break;
      case 'code_desc':
        result.sort((a, b) => b.code.localeCompare(a.code));
        break;
      case 'f_count_desc':
        result.sort((a, b) => b.fCount - a.fCount);
        break;
    }
    
    return result;
  }, [coursesWithStats, courseFilters, classCourseMappings, favoriteCourseIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) return;
    
    setIsSubmitting(true);
    try {
      await addCourse(formName, formCode, formPoints ? parseInt(formPoints) : undefined);
      resetForm();
    } catch (error) {
      console.error('Error adding course:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (courseId: string) => {
    if (!confirm('Vill du arkivera denna kurs?')) return;
    try {
      await archiveCourse(courseId);
    } catch (error) {
      console.error('Error archiving course:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormCode('');
    setFormPoints('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Kurser ({courses.length})</h2>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <span>➕</span> Lägg till kurs
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card rounded-xl p-4 border">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Sök kurs..."
            value={courseFilters.search}
            onChange={(e) => setCourseFilters({ search: e.target.value })}
            className="input flex-1 min-w-[200px] px-4 py-2 rounded-lg"
          />
          
          <select
            value={courseFilters.classId}
            onChange={(e) => setCourseFilters({ classId: e.target.value })}
            className="select px-4 py-2 rounded-lg"
          >
            <option value="">Alla klasser</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
          
          <select
            value={courseFilters.sortBy}
            onChange={(e) => setCourseFilters({ sortBy: e.target.value as typeof courseFilters.sortBy })}
            className="select px-4 py-2 rounded-lg"
          >
            <option value="name_asc">Namn (A-Ö)</option>
            <option value="name_desc">Namn (Ö-A)</option>
            <option value="code_asc">Kod (A-Ö)</option>
            <option value="f_count_desc">Flest F</option>
          </select>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={courseFilters.fOnly}
              onChange={(e) => setCourseFilters({ fOnly: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Endast med F</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={courseFilters.onlyFavorites}
              onChange={(e) => setCourseFilters({ onlyFavorites: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">⭐ Favoriter</span>
          </label>
        </div>
      </div>

      {/* Form */}
      {showForm && canManage && (
        <div className="card rounded-xl p-6 border">
          <h3 className="font-semibold mb-4">Ny kurs</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kursnamn</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input w-full px-4 py-2 rounded-lg"
                  placeholder="t.ex. Matematik 1c"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Kurskod</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="input w-full px-4 py-2 rounded-lg"
                  placeholder="t.ex. MATMAT01c"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Poäng</label>
                <input
                  type="number"
                  value={formPoints}
                  onChange={(e) => setFormPoints(e.target.value)}
                  className="input w-full px-4 py-2 rounded-lg"
                  placeholder="t.ex. 100"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Sparar...' : 'Spara'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Courses grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCourses.map(course => (
          <div key={course.id} className="card rounded-xl p-4 border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold">{course.name}</h3>
                <p className="text-sm text-gray-500">{course.code}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleFavoriteCourse(course.id)}
                  className={`p-1.5 rounded ${
                    favoriteCourseIds.has(course.id) 
                      ? 'text-yellow-500' 
                      : 'text-gray-400 hover:text-yellow-500'
                  }`}
                  title={favoriteCourseIds.has(course.id) ? 'Ta bort favorit' : 'Lägg till favorit'}
                >
                  ⭐
                </button>
                {canManage && (
                  <button
                    onClick={() => handleArchive(course.id)}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Arkivera"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#ef772c]">{course.fCount}</div>
                <div className="text-xs text-gray-500">F-betyg</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-orange-500">{course.warningCount}</div>
                <div className="text-xs text-gray-500">Varningar</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#624c9a]">{course.totalGrades}</div>
                <div className="text-xs text-gray-500">Betyg</div>
              </div>
            </div>
            
            {course.points && (
              <div className="text-sm text-gray-500 mb-2">
                {course.points} poäng
              </div>
            )}
            
            <div>
              <span className="text-xs text-gray-500">Klasser:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {course.classes.slice(0, 4).map(cls => (
                  <span
                    key={cls!.id}
                    className="text-xs bg-[#43bde3]/10 text-[#43bde3] px-2 py-0.5 rounded"
                  >
                    {cls!.name}
                  </span>
                ))}
                {course.classes.length > 4 && (
                  <span className="text-xs text-gray-500">+{course.classes.length - 4}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">📚</p>
          <p>Inga kurser matchar filtret</p>
        </div>
      )}
    </div>
  );
}

