'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import type { Snapshot } from '@/lib/types';
import Header from '@/components/Header';
import LoginScreen from '@/components/LoginScreen';

// Dynamic import for jsPDF
const loadJsPDF = async () => {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
};

export default function SnapshotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const snapshotId = params.id as string;

  const {
    snapshots,
    quarters,
    grades,
    students,
    courses,
    classes,
    gradeHistory,
    fetchSnapshots,
    fetchAll,
    saveSnapshotAnalysis,
    userCan,
    deleteSnapshot,
    user,
    isAuthenticated,
    isLoading: storeLoading
  } = useAppStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [localAnalysis, setLocalAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) return;
      await fetchAll();
      await fetchSnapshots();
      setIsLoading(false);
    };
    loadData();
  }, [fetchAll, fetchSnapshots, isAuthenticated]);

  const snapshot = snapshots.find(s => s.id === snapshotId);
  const quarter = snapshot ? quarters.find(q => q.id === snapshot.quarter_id) : null;
  const otherSnapshots = snapshots.filter(s => s.id !== snapshotId);

  // Calculate stats from grades table via quarter_id
  const calculateStats = useCallback(() => {
    if (!snapshot) return { totalFGrades: 0, totalWarnings: 0, passRate: 0, totalStudents: 0 };
    
    const quarterGrades = grades.filter(g => g.quarter_id === snapshot.quarter_id);
    if (quarterGrades.length === 0) {
      return { totalFGrades: 0, totalWarnings: 0, passRate: 0, totalStudents: 0 };
    }
    
    const totalFGrades = quarterGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
    const totalWarnings = quarterGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;
    const gradedCount = quarterGrades.filter(g => g.grade).length;
    const passRate = gradedCount > 0 
      ? ((gradedCount - totalFGrades) / gradedCount) * 100 
      : 0;
    
    // Count unique students with grades in this quarter
    const studentsWithGrades = new Set(quarterGrades.map(g => g.student_id)).size;
    
    return { totalFGrades, totalWarnings, passRate, totalStudents: studentsWithGrades };
  }, [snapshot, grades]);

  const stats = calculateStats();

  // Generate AI analysis
  const generateAnalysis = async () => {
    if (!snapshot) return;
    
    setIsGenerating(true);
    try {
      const quarterGrades = grades.filter(g => g.quarter_id === snapshot.quarter_id);
      const gradedGrades = quarterGrades.filter(g => g.grade !== null);
      
      const snapshotStudents = (snapshot.data?.students?.length > 0) ? snapshot.data.students : students;
      const snapshotCourses = (snapshot.data?.courses?.length > 0) ? snapshot.data.courses : courses;
      const snapshotClasses = (snapshot.data?.classes?.length > 0) ? snapshot.data.classes : classes;

      const studentsWithAnyGrade = new Set(gradedGrades.map(g => g.student_id));
      const totalStudentsAll = snapshotStudents.length;
      const totalStudentsWithGrades = studentsWithAnyGrade.size;
      const coveragePct = totalStudentsAll > 0 ? (totalStudentsWithGrades / totalStudentsAll) * 100 : 0;

      const classBreakdown = snapshotClasses.map(cls => {
        const classStudentIds = snapshotStudents.filter(s => s.class_id === cls.id).map(s => s.id);
        const classGrades = gradedGrades.filter(g => classStudentIds.includes(g.student_id));
        return {
          className: cls.name,
          studentCount: new Set(classGrades.map(g => g.student_id)).size,
          fCount: classGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length,
          fWarningCount: classGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length
        };
      }).filter(c => c.studentCount > 0);

      const courseBreakdown = snapshotCourses.map(course => {
        const courseGrades = gradedGrades.filter(g => g.course_id === course.id);
        return {
          courseCode: course.code || course.name,
          courseName: course.name,
          studentCount: new Set(courseGrades.map(g => g.student_id)).size,
          fCount: courseGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length,
          fWarningCount: courseGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length
        };
      }).filter(c => c.fCount > 0 || c.fWarningCount > 0);

      const studentFCounts: Record<string, number> = {};
      gradedGrades.forEach(g => {
        if (g.grade === 'F' && g.grade_type !== 'warning') {
          studentFCounts[g.student_id] = (studentFCounts[g.student_id] || 0) + 1;
        }
      });

      const totalFGrades = gradedGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
      const totalFWarnings = gradedGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;
      const passRate = gradedGrades.length > 0
        ? ((gradedGrades.length - totalFGrades) / gradedGrades.length) * 100
        : 0;

      const snapshotData = {
        name: snapshot.name,
        quarterName: quarter?.name || 'Okänt kvartal',
        snapshotDate: snapshot.created_at 
          ? new Date(snapshot.created_at).toLocaleDateString('sv-SE')
          : new Date().toLocaleDateString('sv-SE'),
        stats: {
          totalStudents: totalStudentsWithGrades,
          totalStudentsAll,
          coveragePct,
          totalGrades: gradedGrades.length,
          totalFGrades,
          totalFWarnings,
          passRate,
          totalImprovements: gradeHistory.filter(h => h.from_grade === 'F' && h.quarter_id === snapshot.quarter_id).length
        },
        classBreakdown,
        courseBreakdown,
        studentsAtRisk: {
          with1F: Object.values(studentFCounts).filter(c => c === 1).length,
          with2F: Object.values(studentFCounts).filter(c => c === 2).length,
          with3PlusF: Object.values(studentFCounts).filter(c => c >= 3).length
        }
      };

      const response = await fetch('/api/ai/analyze-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotData })
      });

      if (!response.ok) throw new Error('Failed to generate analysis');

      const result = await response.json();
      setLocalAnalysis(result.analysis);
      await saveSnapshotAnalysis(snapshot.id, result.analysis);
    } catch (error) {
      console.error('Error generating analysis:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download PDF
  const downloadPDF = async () => {
    const analysis = localAnalysis || snapshot?.analysis;
    if (!analysis || !snapshot) return;

    const jsPDF = await loadJsPDF();
    const doc = new jsPDF();
    
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(snapshot.name, margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${quarter?.name || 'Okänt kvartal'} - ${snapshot.created_at ? new Date(snapshot.created_at).toLocaleDateString('sv-SE') : ''}`, margin, y);
    y += 15;

    doc.setTextColor(0);
    doc.setFontSize(10);

    const lines = analysis.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        y += 5;
        continue;
      }

      if (trimmed.startsWith('### ')) {
        y += 8;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const text = trimmed.replace(/^### /, '').replace(/[^\w\såäöÅÄÖ.,!?:;()\-–]/g, '');
        doc.text(text, margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      } else if (trimmed.startsWith('## ')) {
        y += 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const text = trimmed.replace(/^## /, '').replace(/[^\w\såäöÅÄÖ.,!?:;()\-–]/g, '');
        doc.text(text, margin, y);
        y += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      } else if (trimmed.startsWith('# ')) {
        y += 12;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const text = trimmed.replace(/^# /, '').replace(/[^\w\såäöÅÄÖ.,!?:;()\-–]/g, '');
        doc.text(text, margin, y);
        y += 12;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.substring(2).replace(/[^\w\såäöÅÄÖ.,!?:;()\-–%]/g, '');
        const wrapped = doc.splitTextToSize(`• ${bulletText}`, maxWidth - 5);
        for (const wline of wrapped) {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          doc.text(wline, margin + 5, y);
          y += 6;
        }
      } else {
        const cleanText = trimmed.replace(/\*\*/g, '').replace(/[^\w\såäöÅÄÖ.,!?:;()\-–%]/g, '');
        const wrapped = doc.splitTextToSize(cleanText, maxWidth);
        for (const wline of wrapped) {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          doc.text(wline, margin, y);
          y += 6;
        }
      }
    }

    doc.save(`${snapshot.name.replace(/[^a-zA-Z0-9åäöÅÄÖ]/g, '_')}_analys.pdf`);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!snapshot) return;
    if (!confirm('Vill du radera denna snapshot?')) return;
    
    await deleteSnapshot(snapshot.id);
    router.push('/');
  };

  // Calculate stats for other snapshots
  const getOtherSnapshotStats = (s: Snapshot) => {
    const quarterGrades = grades.filter(g => g.quarter_id === s.quarter_id);
    const totalFGrades = quarterGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
    const gradedCount = quarterGrades.filter(g => g.grade).length;
    const passRate = gradedCount > 0 ? ((gradedCount - totalFGrades) / gradedCount) * 100 : 0;
    return { totalFGrades, passRate };
  };

  // Show login if not authenticated
  if (!isAuthenticated && !storeLoading) {
    return <LoginScreen />;
  }

  // Loading state
  if (isLoading || storeLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <Header />
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[var(--text-secondary)]">Laddar snapshot...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Snapshot not found
  if (!snapshot) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <Header />
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Snapshot hittades inte</h1>
            <p className="text-[var(--text-secondary)] mb-6">Den begärda snapshot finns inte eller har raderats.</p>
            <button
              onClick={() => router.push('/')}
              className="btn btn-primary"
            >
              Tillbaka till startsidan
            </button>
          </div>
        </main>
      </div>
    );
  }

  const analysis = localAnalysis || snapshot.analysis;
  const canManage = userCan('manage_quarters');

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <button 
            onClick={() => router.push('/')}
            className="text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Startsida
          </button>
          <span className="text-[var(--text-tertiary)]">/</span>
          <button 
            onClick={() => {
              useAppStore.getState().setActiveTab('snapshots');
              router.push('/');
            }}
            className="text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Snapshots
          </button>
          <span className="text-[var(--text-tertiary)]">/</span>
          <span className="text-[var(--text-primary)] font-medium">{snapshot.name}</span>
        </nav>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="card p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{snapshot.name}</h1>
                  <p className="text-[var(--text-secondary)]">
                    {quarter?.name} • {snapshot.created_at ? new Date(snapshot.created_at).toLocaleDateString('sv-SE', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : ''}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={handleDelete}
                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-lg transition-colors"
                    title="Radera snapshot"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Notes */}
              {snapshot.notes && (
                <div className="bg-[var(--bg-hover)] rounded-xl p-4 border border-[var(--border-subtle)]">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Anteckningar</h4>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{snapshot.notes}</p>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-[var(--color-danger)]">{stats.totalFGrades}</div>
                <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">F-betyg</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-[var(--color-warning)]">{stats.totalWarnings}</div>
                <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">Varningar</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-[var(--color-success)]">{stats.passRate.toFixed(1)}%</div>
                <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">Godkända</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-[var(--color-primary)]">{stats.totalStudents}</div>
                <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">Elever</div>
              </div>
            </div>

            {/* Analysis Section */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Analys</h2>
                <div className="flex gap-3">
                  {!analysis && (
                    <button
                      onClick={generateAnalysis}
                      disabled={isGenerating}
                      className="btn btn-primary"
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          Genererar...
                        </span>
                      ) : 'Generera analys'}
                    </button>
                  )}
                  {analysis && (
                    <button
                      onClick={downloadPDF}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Ladda ner PDF
                    </button>
                  )}
                </div>
              </div>

              {analysis ? (
                <div className="prose prose-sm max-w-none text-[var(--text-primary)] bg-[var(--bg-page)] p-6 rounded-xl border border-[var(--border-subtle)]">
                  <div className="whitespace-pre-wrap font-sans leading-relaxed">
                    {analysis}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-[var(--bg-page)] rounded-xl border border-dashed border-[var(--border-strong)]">
                  <svg className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-[var(--text-secondary)] mb-2">Ingen analys genererad än</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Klicka på knappen ovan för att skapa en AI-driven analys</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Other Snapshots */}
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Andra snapshots</h3>
              
              {otherSnapshots.length > 0 ? (
                <div className="space-y-3">
                  {otherSnapshots.map(s => {
                    const sQuarter = quarters.find(q => q.id === s.quarter_id);
                    const sStats = getOtherSnapshotStats(s);
                    
                    return (
                      <button
                        key={s.id}
                        onClick={() => router.push(`/snapshots/${s.id}`)}
                        className="w-full text-left p-4 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--color-primary)] hover:bg-[var(--bg-hover)] transition-all group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                              {s.name}
                            </h4>
                            <p className="text-xs text-[var(--text-tertiary)]">{sQuarter?.name}</p>
                          </div>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {s.created_at ? new Date(s.created_at).toLocaleDateString('sv-SE') : ''}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-[var(--color-danger)] font-medium">{sStats.totalFGrades} F</span>
                          <span className="text-[var(--color-success)] font-medium">{sStats.passRate.toFixed(0)}% godkända</span>
                        </div>
                        {s.analysis && (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--color-primary)] bg-[var(--color-primary-subtle)]/30 px-2 py-0.5 rounded">
                            Analys klar
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-8">
                  Inga andra snapshots
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Snabbåtgärder</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    useAppStore.getState().setActiveTab('snapshots');
                    router.push('/');
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Visa alla snapshots
                </button>
                <button
                  onClick={() => {
                    useAppStore.getState().setActiveTab('warnings');
                    router.push('/');
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Gå till översikt
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

