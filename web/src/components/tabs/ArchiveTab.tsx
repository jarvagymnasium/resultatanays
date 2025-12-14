'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

type ArchiveSection = 'students' | 'courses' | 'classes';

export default function ArchiveTab() {
  const {
    archivedStudents,
    archivedCourses,
    archivedClasses,
    classes,
    reactivateStudent,
    reactivateCourse,
    reactivateClass,
    permanentDeleteStudent,
    permanentDeleteCourse,
    permanentDeleteClass,
    userCan
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<ArchiveSection>('students');
  const [searchTerm, setSearchTerm] = useState('');

  const canManage = userCan('manage_students');

  const handleReactivate = async (type: ArchiveSection, id: string) => {
    if (!confirm(`Vill du återaktivera denna ${type === 'students' ? 'elev' : type === 'courses' ? 'kurs' : 'klass'}?`)) return;
    
    try {
      switch (type) {
        case 'students':
          await reactivateStudent(id);
          break;
        case 'courses':
          await reactivateCourse(id);
          break;
        case 'classes':
          await reactivateClass(id);
          break;
      }
    } catch (error) {
      console.error('Error reactivating:', error);
    }
  };

  const handlePermanentDelete = async (type: ArchiveSection, id: string) => {
    if (!confirm(`⚠️ VARNING: Detta kommer att PERMANENT radera all data. Fortsätta?`)) return;
    if (!confirm(`Är du HELT säker? Detta kan inte ångras!`)) return;
    
    try {
      switch (type) {
        case 'students':
          await permanentDeleteStudent(id);
          break;
        case 'courses':
          await permanentDeleteCourse(id);
          break;
        case 'classes':
          await permanentDeleteClass(id);
          break;
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const sections: { id: ArchiveSection; label: string; icon: string; count: number }[] = [
    { id: 'students', label: 'Elever', icon: '👥', count: archivedStudents.length },
    { id: 'courses', label: 'Kurser', icon: '📚', count: archivedCourses.length },
    { id: 'classes', label: 'Klasser', icon: '🏫', count: archivedClasses.length },
  ];

  const filteredStudents = archivedStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredCourses = archivedCourses.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredClasses = archivedClasses.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Arkiv</h2>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 border-b">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2 border-b-2 transition ${
              activeSection === section.id
                ? 'border-[#624c9a] text-[#624c9a] font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">{section.icon}</span>
            {section.label}
            <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {section.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card rounded-xl p-4 border">
        <input
          type="text"
          placeholder="Sök i arkiv..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input w-full px-4 py-2 rounded-lg"
        />
      </div>

      {/* Content */}
      {activeSection === 'students' && (
        <div className="card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Namn</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Tidigare klass</th>
                {canManage && (
                  <th className="px-4 py-3 text-right text-sm font-semibold">Åtgärder</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 3 : 2} className="px-4 py-8 text-center text-gray-500">
                    Inga arkiverade elever
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const studentClass = classes.find(c => c.id === student.class_id);
                  return (
                    <tr key={student.id}>
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {studentClass?.name || '-'}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleReactivate('students', student.id)}
                            className="text-green-600 hover:text-green-700 mr-3"
                            title="Återaktivera"
                          >
                            ♻️
                          </button>
                          <button
                            onClick={() => handlePermanentDelete('students', student.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Radera permanent"
                          >
                            ❌
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === 'courses' && (
        <div className="card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Kursnamn</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Kod</th>
                {canManage && (
                  <th className="px-4 py-3 text-right text-sm font-semibold">Åtgärder</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 3 : 2} className="px-4 py-8 text-center text-gray-500">
                    Inga arkiverade kurser
                  </td>
                </tr>
              ) : (
                filteredCourses.map(course => (
                  <tr key={course.id}>
                    <td className="px-4 py-3 font-medium">{course.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{course.code}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleReactivate('courses', course.id)}
                          className="text-green-600 hover:text-green-700 mr-3"
                          title="Återaktivera"
                        >
                          ♻️
                        </button>
                        <button
                          onClick={() => handlePermanentDelete('courses', course.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Radera permanent"
                        >
                          ❌
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === 'classes' && (
        <div className="card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Klassnamn</th>
                {canManage && (
                  <th className="px-4 py-3 text-right text-sm font-semibold">Åtgärder</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 2 : 1} className="px-4 py-8 text-center text-gray-500">
                    Inga arkiverade klasser
                  </td>
                </tr>
              ) : (
                filteredClasses.map(cls => (
                  <tr key={cls.id}>
                    <td className="px-4 py-3 font-medium">{cls.name}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleReactivate('classes', cls.id)}
                          className="text-green-600 hover:text-green-700 mr-3"
                          title="Återaktivera"
                        >
                          ♻️
                        </button>
                        <button
                          onClick={() => handlePermanentDelete('classes', cls.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Radera permanent"
                        >
                          ❌
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

