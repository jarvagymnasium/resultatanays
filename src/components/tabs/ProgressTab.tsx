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
import jsPDF from 'jspdf';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

type ModalType = 'improvements' | 'students' | 'courses' | null;
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'grade_asc' | 'grade_desc' | 'count_desc' | 'count_asc';

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
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');

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
    const sorted = [...fImprovements].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    const seen = new Map<string, boolean>();
    const deduplicated = sorted.filter(h => {
      const key = `${h.student_id}-${h.course_id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.set(key, true);
      return true;
    });

    return deduplicated.map(h => {
      const studentFromDb = allStudents.find(s => s.id === h.student_id);
      const courseFromDb = allCourses.find(c => c.id === h.course_id);
      
      const student = studentFromDb || (h.student_snapshot ? {
        id: h.student_id,
        name: `${h.student_snapshot.first_name || ''} ${h.student_snapshot.last_name || ''}`.trim(),
        first_name: h.student_snapshot.first_name,
        last_name: h.student_snapshot.last_name,
        class_id: h.student_snapshot.class_id
      } : null);
      
      const course = courseFromDb || (h.course_snapshot ? {
        id: h.course_id,
        name: h.course_snapshot.name,
        code: h.course_snapshot.code
      } : null);
      
      return { ...h, student, course };
    });
  }, [gradeHistory, allStudents, allCourses, scope, activeQuarter]);

  // Statistics
  const stats = useMemo(() => {
    const totalImprovements = improvements.length;
    const studentsWithImprovements = new Set(improvements.map(i => i.student_id)).size;
    
    // Course counts
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
    
    return { totalImprovements, studentsWithImprovements, mostImprovedCourse, courseCounts };
  }, [improvements, allCourses]);

  // Students with improvements (aggregated)
  const studentsWithImprovementsList = useMemo(() => {
    const studentMap = new Map<string, { 
      student: typeof improvements[0]['student'], 
      improvements: typeof improvements,
      count: number 
    }>();
    
    improvements.forEach(imp => {
      if (!imp.student) return;
      const existing = studentMap.get(imp.student_id);
      if (existing) {
        existing.improvements.push(imp);
        existing.count++;
      } else {
        studentMap.set(imp.student_id, {
          student: imp.student,
          improvements: [imp],
          count: 1
        });
      }
    });
    
    return Array.from(studentMap.values());
  }, [improvements]);

  // Courses with improvements (aggregated)
  const coursesWithImprovementsList = useMemo(() => {
    const courseMap = new Map<string, {
      course: typeof improvements[0]['course'],
      improvements: typeof improvements,
      count: number
    }>();
    
    improvements.forEach(imp => {
      if (!imp.course) return;
      const existing = courseMap.get(imp.course_id);
      if (existing) {
        existing.improvements.push(imp);
        existing.count++;
      } else {
        courseMap.set(imp.course_id, {
          course: imp.course,
          improvements: [imp],
          count: 1
        });
      }
    });
    
    return Array.from(courseMap.values());
  }, [improvements]);

  // Sorted data for modals
  const sortedImprovements = useMemo(() => {
    const sorted = [...improvements];
    switch (sortOption) {
      case 'date_desc':
        return sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      case 'name_asc':
        return sorted.sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || ''));
      case 'name_desc':
        return sorted.sort((a, b) => (b.student?.name || '').localeCompare(a.student?.name || ''));
      case 'grade_asc':
        return sorted.sort((a, b) => (a.to_grade || '').localeCompare(b.to_grade || ''));
      case 'grade_desc':
        return sorted.sort((a, b) => (b.to_grade || '').localeCompare(a.to_grade || ''));
      default:
        return sorted;
    }
  }, [improvements, sortOption]);

  const sortedStudents = useMemo(() => {
    const sorted = [...studentsWithImprovementsList];
    switch (sortOption) {
      case 'count_desc':
        return sorted.sort((a, b) => b.count - a.count);
      case 'count_asc':
        return sorted.sort((a, b) => a.count - b.count);
      case 'name_asc':
        return sorted.sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || ''));
      case 'name_desc':
        return sorted.sort((a, b) => (b.student?.name || '').localeCompare(a.student?.name || ''));
      default:
        return sorted.sort((a, b) => b.count - a.count);
    }
  }, [studentsWithImprovementsList, sortOption]);

  const sortedCourses = useMemo(() => {
    const sorted = [...coursesWithImprovementsList];
    switch (sortOption) {
      case 'count_desc':
        return sorted.sort((a, b) => b.count - a.count);
      case 'count_asc':
        return sorted.sort((a, b) => a.count - b.count);
      case 'name_asc':
        return sorted.sort((a, b) => (a.course?.name || '').localeCompare(b.course?.name || ''));
      case 'name_desc':
        return sorted.sort((a, b) => (b.course?.name || '').localeCompare(a.course?.name || ''));
      default:
        return sorted.sort((a, b) => b.count - a.count);
    }
  }, [coursesWithImprovementsList, sortOption]);

  // PDF Export functions
  const exportImprovementsPDF = () => {
    const doc = new jsPDF();
    const title = `Alla förbättringar - ${scope === 'active' ? activeQuarter?.name : 'Alla kvartal'}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, 14, 28);
    doc.text(`Totalt: ${sortedImprovements.length} förbättringar`, 14, 34);
    
    let y = 45;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Elev', 14, y);
    doc.text('Kurs', 70, y);
    doc.text('Från → Till', 120, y);
    doc.text('Datum', 160, y);
    
    doc.setFont('helvetica', 'normal');
    y += 8;
    
    sortedImprovements.forEach((imp, i) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text((imp.student?.name || 'Okänd').substring(0, 30), 14, y);
      doc.text((imp.course?.code || imp.course?.name || 'Okänd').substring(0, 25), 70, y);
      doc.text(`${imp.from_grade} → ${imp.to_grade}`, 120, y);
      doc.text(imp.created_at ? new Date(imp.created_at).toLocaleDateString('sv-SE') : '-', 160, y);
      y += 6;
    });
    
    doc.save(`forbattringar-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportStudentsPDF = () => {
    const doc = new jsPDF();
    const title = `Elever med förbättringar - ${scope === 'active' ? activeQuarter?.name : 'Alla kvartal'}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, 14, 28);
    doc.text(`Totalt: ${sortedStudents.length} elever`, 14, 34);
    
    let y = 45;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Elev', 14, y);
    doc.text('Klass', 80, y);
    doc.text('Antal förbättringar', 130, y);
    
    doc.setFont('helvetica', 'normal');
    y += 8;
    
    sortedStudents.forEach((item) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const studentClass = classes.find(c => c.id === item.student?.class_id);
      doc.text((item.student?.name || 'Okänd').substring(0, 35), 14, y);
      doc.text((studentClass?.name || '-').substring(0, 25), 80, y);
      doc.text(String(item.count), 130, y);
      y += 6;
    });
    
    doc.save(`elever-forbattringar-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportCoursesPDF = () => {
    const doc = new jsPDF();
    const title = `Kurser med förbättringar - ${scope === 'active' ? activeQuarter?.name : 'Alla kvartal'}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, 14, 28);
    doc.text(`Totalt: ${sortedCourses.length} kurser`, 14, 34);
    
    let y = 45;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Kurskod', 14, y);
    doc.text('Kursnamn', 50, y);
    doc.text('Antal förbättringar', 140, y);
    
    doc.setFont('helvetica', 'normal');
    y += 8;
    
    sortedCourses.forEach((item) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text((item.course?.code || '-').substring(0, 15), 14, y);
      doc.text((item.course?.name || 'Okänd').substring(0, 45), 50, y);
      doc.text(String(item.count), 140, y);
      y += 6;
    });
    
    doc.save(`kurser-forbattringar-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Chart data
  const classChartData = useMemo(() => {
    const classCounts: Record<string, number> = {};
    improvements.forEach(i => {
      const classId = i.student?.class_id || 'unknown';
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
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#10b981'
      }]
    };
  }, [improvements, classes]);

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
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#6366f1'
      }]
    };
  }, [improvements, allCourses]);

  // Modal component
  const Modal = ({ type, onClose }: { type: ModalType, onClose: () => void }) => {
    if (!type) return null;
    
    const getTitle = () => {
      switch (type) {
        case 'improvements': return 'Alla förbättringar';
        case 'students': return 'Elever med förbättringar';
        case 'courses': return 'Kurser med förbättringar';
      }
    };

    const getSortOptions = () => {
      switch (type) {
        case 'improvements':
          return [
            { value: 'date_desc', label: 'Datum (nyast först)' },
            { value: 'date_asc', label: 'Datum (äldst först)' },
            { value: 'name_asc', label: 'Elevnamn (A-Ö)' },
            { value: 'name_desc', label: 'Elevnamn (Ö-A)' },
            { value: 'grade_desc', label: 'Betyg (A-F)' },
            { value: 'grade_asc', label: 'Betyg (F-A)' },
          ];
        case 'students':
        case 'courses':
          return [
            { value: 'count_desc', label: 'Antal (flest först)' },
            { value: 'count_asc', label: 'Antal (minst först)' },
            { value: 'name_asc', label: 'Namn (A-Ö)' },
            { value: 'name_desc', label: 'Namn (Ö-A)' },
          ];
      }
    };

    const handleExport = () => {
      switch (type) {
        case 'improvements': exportImprovementsPDF(); break;
        case 'students': exportStudentsPDF(); break;
        case 'courses': exportCoursesPDF(); break;
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4 overflow-y-auto">
        <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-[var(--border-subtle)] flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">{getTitle()}</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {scope === 'active' ? activeQuarter?.name : 'Alla kvartal'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Controls */}
          <div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap gap-3 items-center justify-between bg-[var(--bg-secondary)]/30">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--text-secondary)]">Sortera:</label>
              <select 
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-sm"
              >
                {getSortOptions()?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportera PDF
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {type === 'improvements' && (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[var(--bg-card)]">
                  <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    <th className="px-4 py-3">Elev</th>
                    <th className="px-4 py-3">Kurs</th>
                    <th className="px-4 py-3 text-center">Från → Till</th>
                    <th className="px-4 py-3">Datum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {sortedImprovements.map(imp => {
                    const studentClass = classes.find(c => c.id === imp.student?.class_id);
                    return (
                      <tr key={imp.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-3">
                          <div className="font-medium">{imp.student?.name || 'Okänd'}</div>
                          {studentClass && <div className="text-xs text-[var(--text-secondary)]">{studentClass.name}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">{imp.course?.code || imp.course?.name || 'Okänd'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">{imp.from_grade}</span>
                            <span>→</span>
                            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-bold">{imp.to_grade}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                          {imp.created_at ? new Date(imp.created_at).toLocaleDateString('sv-SE') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {type === 'students' && (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[var(--bg-card)]">
                  <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    <th className="px-4 py-3">Elev</th>
                    <th className="px-4 py-3">Klass</th>
                    <th className="px-4 py-3 text-center">Antal</th>
                    <th className="px-4 py-3">Kurser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {sortedStudents.map(item => {
                    const studentClass = classes.find(c => c.id === item.student?.class_id);
                    return (
                      <tr key={item.student?.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-3 font-medium">{item.student?.name || 'Okänd'}</td>
                        <td className="px-4 py-3 text-sm">{studentClass?.name || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                            {item.count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                          {item.improvements.map(i => i.course?.code || i.course?.name).join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {type === 'courses' && (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[var(--bg-card)]">
                  <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    <th className="px-4 py-3">Kurskod</th>
                    <th className="px-4 py-3">Kursnamn</th>
                    <th className="px-4 py-3 text-center">Antal</th>
                    <th className="px-4 py-3">Andel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {sortedCourses.map(item => {
                    const percentage = improvements.length > 0 
                      ? Math.round((item.count / improvements.length) * 100) 
                      : 0;
                    return (
                      <tr key={item.course?.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-3 font-medium font-mono">{item.course?.code || '-'}</td>
                        <td className="px-4 py-3 text-sm">{item.course?.name || 'Okänd'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                            {item.count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--text-secondary)] w-10">{percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 text-center text-sm text-[var(--text-secondary)]">
            {type === 'improvements' && `${sortedImprovements.length} förbättringar totalt`}
            {type === 'students' && `${sortedStudents.length} elever med förbättringar`}
            {type === 'courses' && `${sortedCourses.length} kurser med förbättringar`}
          </div>
        </div>
      </div>
    );
  };

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

      {/* Stats KPI Cards - Now Clickable! */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={() => setActiveModal('improvements')}
          className="stat-card group text-left hover:scale-[1.02] transition-transform cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Totala förbättringar</p>
              <div className="text-4xl font-bold text-[var(--color-success)]">
                {stats.totalImprovements}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-green-100 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm text-[var(--text-tertiary)]">
            Klicka för att se alla • Antal betyg höjda från F
          </div>
        </button>

        <button 
          onClick={() => setActiveModal('students')}
          className="stat-card group text-left hover:scale-[1.02] transition-transform cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Elever med förbättring</p>
              <div className="text-4xl font-bold text-[var(--color-info)]">
                {stats.studentsWithImprovements}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm text-[var(--text-tertiary)]">
            Klicka för att se alla • Unika elever
          </div>
        </button>

        <button 
          onClick={() => setActiveModal('courses')}
          className="stat-card group text-left hover:scale-[1.02] transition-transform cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Flest förbättringar</p>
              <div className="text-2xl font-bold text-[var(--color-primary)] truncate" title={stats.mostImprovedCourse?.name}>
                {stats.mostImprovedCourse?.code || stats.mostImprovedCourse?.name || '-'}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-sm text-[var(--text-tertiary)]">
            Klicka för att se alla kurser • Kurs med bäst utveckling
          </div>
        </button>
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

      {/* Modal */}
      {activeModal && <Modal type={activeModal} onClose={() => setActiveModal(null)} />}
    </div>
  );
}
