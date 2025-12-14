'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';

export default function ClassesTab() {
  const {
    classes,
    courses,
    students,
    classCourseMappings,
    grades,
    addClass,
    updateClass,
    archiveClass,
    userCan
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = userCan('manage_classes');

  // Calculate stats for each class
  const classesWithStats = useMemo(() => {
    return classes.map(cls => {
      const classStudents = students.filter(s => s.class_id === cls.id);
      const studentIds = classStudents.map(s => s.id);
      const classGrades = grades.filter(g => studentIds.includes(g.student_id));
      const fCount = classGrades.filter(g => g.grade === 'F').length;
      const classCourses = classCourseMappings
        .filter(m => m.class_id === cls.id)
        .map(m => courses.find(c => c.id === m.course_id))
        .filter(Boolean);
      
      return {
        ...cls,
        studentCount: classStudents.length,
        fCount,
        courses: classCourses
      };
    });
  }, [classes, students, grades, classCourseMappings, courses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    
    setIsSubmitting(true);
    try {
      if (editingClass) {
        await updateClass(editingClass, formName, selectedCourses);
      } else {
        await addClass(formName, selectedCourses);
      }
      resetForm();
    } catch (error) {
      console.error('Error saving class:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    
    setEditingClass(classId);
    setFormName(cls.name);
    setSelectedCourses(
      classCourseMappings
        .filter(m => m.class_id === classId)
        .map(m => m.course_id)
    );
    setShowForm(true);
  };

  const handleArchive = async (classId: string) => {
    if (!confirm('Vill du arkivera denna klass?')) return;
    try {
      await archiveClass(classId);
    } catch (error) {
      console.error('Error archiving class:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingClass(null);
    setFormName('');
    setSelectedCourses([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Klasser ({classes.length})</h2>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <span>➕</span> Lägg till klass
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && canManage && (
        <div className="card rounded-xl p-6 border">
          <h3 className="font-semibold mb-4">
            {editingClass ? 'Redigera klass' : 'Ny klass'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Klassnamn</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="input w-full px-4 py-2 rounded-lg"
                placeholder="t.ex. TE20A"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Kurser</label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {courses.map(course => (
                  <label
                    key={course.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCourses([...selectedCourses, course.id]);
                        } else {
                          setSelectedCourses(selectedCourses.filter(id => id !== course.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span>{course.name}</span>
                    <span className="text-sm text-gray-500">({course.code})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Sparar...' : editingClass ? 'Uppdatera' : 'Spara'}
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

      {/* Classes grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classesWithStats.map(cls => (
          <div key={cls.id} className="card rounded-xl p-4 border">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold">{cls.name}</h3>
              {canManage && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(cls.id)}
                    className="p-1.5 text-gray-500 hover:text-[#624c9a] hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Redigera"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleArchive(cls.id)}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Arkivera"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#624c9a]">{cls.studentCount}</div>
                <div className="text-xs text-gray-500">Elever</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#ef772c]">{cls.fCount}</div>
                <div className="text-xs text-gray-500">F-betyg</div>
              </div>
            </div>
            
            <div>
              <span className="text-xs text-gray-500">Kurser:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {cls.courses.slice(0, 5).map(course => (
                  <span
                    key={course!.id}
                    className="text-xs bg-[#624c9a]/10 text-[#624c9a] px-2 py-0.5 rounded"
                  >
                    {course!.code}
                  </span>
                ))}
                {cls.courses.length > 5 && (
                  <span className="text-xs text-gray-500">+{cls.courses.length - 5}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {classes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">🏫</p>
          <p>Inga klasser ännu</p>
          {canManage && <p className="text-sm mt-2">Klicka på knappen ovan för att lägga till en klass</p>}
        </div>
      )}
    </div>
  );
}

