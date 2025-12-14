'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Snapshot } from '@/lib/types';

// Dynamic import for jsPDF
const loadJsPDF = async () => {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
};

interface AnalysisState {
  [snapshotId: string]: {
    isLoading: boolean;
    analysis: string | null;
    error: string | null;
  };
}

export default function SnapshotsTab() {
  const {
    snapshots,
    quarters,
    activeQuarter,
    createSnapshot,
    deleteSnapshot,
    fetchSnapshots,
    saveSnapshotAnalysis,
    userCan,
    gradeHistory
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({});

  const canManage = userCan('manage_quarters');

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    
    setIsSubmitting(true);
    try {
      await createSnapshot(formName, formNotes || undefined);
      resetForm();
    } catch (error) {
      console.error('Error creating snapshot:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    if (!confirm('Vill du radera denna snapshot?')) return;
    try {
      await deleteSnapshot(snapshotId);
    } catch (error) {
      console.error('Error deleting snapshot:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormNotes('');
  };

  const getSnapshot = (id: string) => snapshots.find(s => s.id === id);
  const selectedSnapshotData = selectedSnapshot ? getSnapshot(selectedSnapshot) : null;

  // Build analysis data logic (Restored from previous working version)
  const buildAnalysisData = useCallback((snapshot: Snapshot) => {
    const quarter = quarters.find(q => q.id === snapshot.quarter_id);
    const snapshotGrades = snapshot.data?.grades || [];
    const gradedSnapshotGrades = snapshotGrades.filter(g => g.grade !== null);
    const snapshotStudents = snapshot.data?.students || [];
    const snapshotCourses = snapshot.data?.courses || [];
    const snapshotClasses = snapshot.data?.classes || [];

    const studentsWithAnyGrade = new Set(gradedSnapshotGrades.map(g => g.student_id));
    const totalStudentsAll = snapshotStudents.length;
    const totalStudentsWithGrades = studentsWithAnyGrade.size;
    const coveragePct = totalStudentsAll > 0 ? (totalStudentsWithGrades / totalStudentsAll) * 100 : 0;

    // Class breakdown
    const classBreakdown = snapshotClasses.map(cls => {
      const classStudentIdsAll = snapshotStudents
        .filter(s => s.class_id === cls.id)
        .map(s => s.id);
      
      const classStudentIdsWithGrades = classStudentIdsAll.filter(id => studentsWithAnyGrade.has(id));
      const classGrades = gradedSnapshotGrades.filter(g => classStudentIdsWithGrades.includes(g.student_id));
      const fCount = classGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
      const fWarningCount = classGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;

      return {
        className: cls.name,
        studentCount: classStudentIdsWithGrades.length,
        totalStudentsInClass: classStudentIdsAll.length,
        fCount,
        fWarningCount
      };
    }).filter(c => c.studentCount > 0);

    // Course breakdown
    const courseBreakdown = snapshotCourses.map(course => {
      const courseGrades = gradedSnapshotGrades.filter(g => g.course_id === course.id);
      const fCount = courseGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
      const fWarningCount = courseGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;
      const studentsWithGradesInCourse = new Set(courseGrades.map(g => g.student_id)).size;

      return {
        courseCode: course.code || course.name,
        courseName: course.name,
        studentCount: studentsWithGradesInCourse,
        fCount,
        fWarningCount
      };
    }).filter(c => c.fCount > 0 || c.fWarningCount > 0);

    // Students at risk
    const studentFCounts: Record<string, number> = {};
    gradedSnapshotGrades.forEach(g => {
      if (g.grade === 'F' && g.grade_type !== 'warning') {
        studentFCounts[g.student_id] = (studentFCounts[g.student_id] || 0) + 1;
      }
    });

    const studentsAtRisk = {
      with1F: Object.values(studentFCounts).filter(c => c === 1).length,
      with2F: Object.values(studentFCounts).filter(c => c === 2).length,
      with3PlusF: Object.values(studentFCounts).filter(c => c >= 3).length
    };

    const totalImprovements = gradeHistory.filter(
      h => h.from_grade === 'F' && h.quarter_id === snapshot.quarter_id
    ).length;

    const totalFGrades = gradedSnapshotGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
    const totalFWarnings = gradedSnapshotGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;
    const passRate = gradedSnapshotGrades.length > 0
      ? ((gradedSnapshotGrades.length - totalFGrades) / gradedSnapshotGrades.length) * 100
      : 0;

    return {
      name: snapshot.name,
      quarterName: quarter?.name || 'Okänt kvartal',
      snapshotDate: snapshot.created_at 
        ? new Date(snapshot.created_at).toLocaleDateString('sv-SE')
        : new Date().toLocaleDateString('sv-SE'),
      stats: {
        totalStudents: totalStudentsWithGrades,
        totalStudentsAll,
        coveragePct,
        totalGrades: gradedSnapshotGrades.length,
        totalFGrades,
        totalFWarnings,
        passRate,
        totalImprovements
      },
      classBreakdown,
      courseBreakdown,
      studentsAtRisk
    };
  }, [quarters, gradeHistory]);

  const generateAnalysis = async (snapshotId: string) => {
    const snapshot = getSnapshot(snapshotId);
    if (!snapshot) return;
    if (snapshot.analysis && snapshot.analysis.trim()) return;

    setAnalysisState(prev => ({
      ...prev,
      [snapshotId]: { isLoading: true, analysis: null, error: null }
    }));

    try {
      const snapshotData = buildAnalysisData(snapshot);
      
      const response = await fetch('/api/ai/analyze-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotData })
      });

      if (!response.ok) {
        throw new Error('Kunde inte generera analys');
      }

      const data = await response.json();
      if (!data?.analysis) throw new Error('Ingen analys returnerades');

      await saveSnapshotAnalysis(snapshotId, data.analysis);
      
      setAnalysisState(prev => ({
        ...prev,
        [snapshotId]: { isLoading: false, analysis: data.analysis, error: null }
      }));
    } catch (error) {
      console.error('Error generating analysis:', error);
      setAnalysisState(prev => ({
        ...prev,
        [snapshotId]: { 
          isLoading: false, 
          analysis: null, 
          error: error instanceof Error ? error.message : 'Ett fel uppstod'
        }
      }));
    }
  };

  const downloadAnalysisPDF = async (snapshotId: string) => {
    const snapshot = getSnapshot(snapshotId);
    const state = analysisState[snapshotId];
    if (!snapshot) return;

    const analysisText = state?.analysis || snapshot.analysis;
    if (!analysisText) return;

    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();
      
      const quarter = quarters.find(q => q.id === snapshot.quarter_id);
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      
      // Clean Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Resultatanalys', margin, 20);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Järva Gymnasium', margin, 27);
      
      // Divider
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, 35, pageWidth - margin, 35);
      
      // Snapshot Info
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(snapshot.name, margin, 50);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Kvartal: ${quarter?.name || 'Okänt'}`, margin, 57);
      doc.text(`Genererad: ${new Date().toLocaleString('sv-SE')}`, margin, 62);
      
      // Content
      doc.setTextColor(0, 0, 0);
      const sanitizeForPdf = (input: string) => {
        return input
          .replace(/[^\x09\x0A\x0D\x20-\x7E\u00C0-\u017F]/g, '') // Basic Latin + Swedish
          .replace(/\*\*/g, ''); // Remove markdown bold markers
      };

      const lines = sanitizeForPdf(analysisText).split('\n');
      let yPosition = 80;

      const ensureSpace = (needed: number) => {
        if (yPosition > doc.internal.pageSize.getHeight() - needed) {
          doc.addPage();
          yPosition = 20;
        }
      };

      for (const line of lines) {
        if (!line.trim()) {
          yPosition += 4;
          continue;
        }

        // Headings
        if (line.startsWith('###')) {
          ensureSpace(20);
          yPosition += 4;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(line.replace(/#/g, '').trim(), margin, yPosition);
          yPosition += 6;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          continue;
        }

        // Bullets
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          ensureSpace(10);
          const text = line.replace(/^[-•]\s*/, '').trim();
          const wrapped = doc.splitTextToSize(text, maxWidth - 5);
          doc.text('•', margin, yPosition);
          doc.text(wrapped, margin + 5, yPosition);
          yPosition += wrapped.length * 5 + 2;
          continue;
        }

        // Normal text
        ensureSpace(10);
        const wrapped = doc.splitTextToSize(line, maxWidth);
        doc.text(wrapped, margin, yPosition);
        yPosition += wrapped.length * 5;
      }
      
      doc.save(`analys-${snapshot.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Kunde inte skapa PDF.');
    }
  };

  return (
    <div className="space-y-8 animate-enter">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="heading-lg mb-1">Snapshots</h2>
          <p className="text-subtle">Spara och analysera betygsläget över tid.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Skapa ny snapshot
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && canManage && (
        <div className="card p-6 mb-8 border-[var(--color-primary-light)] ring-1 ring-[var(--color-primary-subtle)]">
          <h3 className="heading-md mb-4 text-lg">Skapa ny snapshot</h3>
          
          <div className="bg-[var(--color-primary-subtle)]/30 rounded-lg p-3 mb-6 border border-[var(--color-primary-subtle)]">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">Aktivt kvartal:</span> {activeQuarter?.name || 'Inget'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1.5 block">
                Namn
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="input"
                placeholder="t.ex. VT 2024 - Vecka 10"
                required
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1.5 block">
                Anteckningar
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="input min-h-[100px]"
                placeholder="Valfri beskrivning..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !activeQuarter}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Sparar...' : 'Spara snapshot'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-ghost"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {snapshots.map(snapshot => {
          const quarter = quarters.find(q => q.id === snapshot.quarter_id);
          const hasAnalysis = snapshot.analysis || analysisState[snapshot.id]?.analysis;
          
          // Calculate stats from data if stats is missing or incomplete
          const calculateStats = () => {
            // First try to use existing stats if valid
            if (snapshot.stats && typeof snapshot.stats.totalFGrades === 'number' && snapshot.stats.totalFGrades > 0) {
              return snapshot.stats;
            }
            
            // Otherwise calculate from data
            const grades = snapshot.data?.grades || [];
            console.log(`Snapshot ${snapshot.name}: data has ${grades.length} grades`);
            
            if (grades.length === 0) {
              return { totalFGrades: 0, totalWarnings: 0, passRate: 0 };
            }
            
            const totalFGrades = grades.filter((g: any) => g.grade === 'F' && g.grade_type !== 'warning').length;
            const totalWarnings = grades.filter((g: any) => g.grade === 'F' && g.grade_type === 'warning').length;
            const gradedCount = grades.filter((g: any) => g.grade).length;
            const passRate = gradedCount > 0 
              ? ((gradedCount - totalFGrades) / gradedCount) * 100 
              : 0;
            
            console.log(`Snapshot ${snapshot.name}: calculated F=${totalFGrades}, warnings=${totalWarnings}, passRate=${passRate.toFixed(1)}%`);
            return { totalFGrades, totalWarnings, passRate };
          };
          
          const snapshotStats = calculateStats();
          
          return (
            <div
              key={snapshot.id}
              className="card p-5 cursor-pointer hover:border-[var(--color-primary)] transition-all group flex flex-col h-full"
              onClick={() => setSelectedSnapshot(snapshot.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                    {snapshot.name}
                  </h3>
                  <p className="text-sm text-[var(--text-tertiary)]">{quarter?.name || 'Okänt kvartal'}</p>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(snapshot.id);
                    }}
                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Radera"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Always show stats - calculated from data if needed */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[var(--bg-hover)] rounded-lg p-3 text-center border border-[var(--border-subtle)]">
                  <div className="text-xl font-bold text-[var(--color-danger)]">{snapshotStats.totalFGrades}</div>
                  <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">F-betyg</div>
                </div>
                <div className="bg-[var(--bg-hover)] rounded-lg p-3 text-center border border-[var(--border-subtle)]">
                  <div className="text-xl font-bold text-[var(--color-success)]">{snapshotStats.passRate.toFixed(0)}%</div>
                  <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Godkända</div>
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-[var(--border-subtle)] flex justify-between items-center text-xs text-[var(--text-tertiary)]">
                <span>
                  {snapshot.created_at ? new Date(snapshot.created_at).toLocaleDateString('sv-SE') : '-'}
                </span>
                {hasAnalysis && (
                  <span className="flex items-center gap-1 text-[var(--color-primary)] font-medium bg-[var(--color-primary-subtle)]/30 px-2 py-0.5 rounded">
                    Analys klar
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {snapshots.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-[var(--border-strong)] rounded-xl">
          <p className="text-[var(--text-secondary)] mb-2">Inga snapshots skapade än</p>
          {canManage && (
            <p className="text-sm text-[var(--text-tertiary)]">
              Använd knappen ovan för att spara din första snapshot
            </p>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSnapshotData && (
        <div className="modal-overlay" onClick={() => setSelectedSnapshot(null)}>
          <div 
            className="modal-content p-0 max-w-3xl w-full mx-4 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-page)] flex justify-between items-start">
              <div>
                <h2 className="heading-md mb-1">{selectedSnapshotData.name}</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {quarters.find(q => q.id === selectedSnapshotData.quarter_id)?.name} • {selectedSnapshotData.created_at ? new Date(selectedSnapshotData.created_at).toLocaleDateString('sv-SE') : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors border border-[var(--border-subtle)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto bg-[var(--bg-card)]">
              {selectedSnapshotData.notes && (
                <div className="bg-[var(--bg-hover)] rounded-xl p-4 mb-8 border border-[var(--border-subtle)]">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Anteckningar</h4>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{selectedSnapshotData.notes}</p>
                </div>
              )}

              {/* Stats - calculated from data if stats is missing */}
              {(() => {
                const grades = selectedSnapshotData.data?.grades || [];
                const modalStats = selectedSnapshotData.stats || {
                  totalFGrades: grades.filter((g: any) => g.grade === 'F' && g.grade_type !== 'warning').length,
                  totalWarnings: grades.filter((g: any) => g.grade === 'F' && g.grade_type === 'warning').length,
                  passRate: grades.filter((g: any) => g.grade).length > 0 
                    ? ((grades.filter((g: any) => g.grade).length - grades.filter((g: any) => g.grade === 'F' && g.grade_type !== 'warning').length) / grades.filter((g: any) => g.grade).length) * 100 
                    : 0
                };
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="stat-card p-4 text-center bg-[var(--bg-page)]">
                      <div className="text-2xl font-bold text-[var(--color-danger)]">{modalStats.totalFGrades}</div>
                      <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">F-betyg</div>
                    </div>
                    <div className="stat-card p-4 text-center bg-[var(--bg-page)]">
                      <div className="text-2xl font-bold text-[var(--color-warning)]">{modalStats.totalWarnings}</div>
                      <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">Varningar</div>
                    </div>
                    <div className="stat-card p-4 text-center bg-[var(--bg-page)]">
                      <div className="text-2xl font-bold text-[var(--color-success)]">{modalStats.passRate.toFixed(1)}%</div>
                      <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">Godkända</div>
                    </div>
                    <div className="stat-card p-4 text-center bg-[var(--bg-page)]">
                      <div className="text-2xl font-bold text-[var(--color-primary)]">{selectedSnapshotData.data?.students?.length || 0}</div>
                      <div className="text-xs font-medium text-[var(--text-secondary)] uppercase mt-1">Elever</div>
                    </div>
                  </div>
                );
              })()}

              {/* AI Analysis Section */}
              <div className="border-t border-[var(--border-subtle)] pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="heading-md text-lg">Analys</h3>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {!(analysisState[selectedSnapshotData.id]?.analysis || selectedSnapshotData.analysis) && (
                      <button
                        onClick={() => generateAnalysis(selectedSnapshotData.id)}
                        disabled={analysisState[selectedSnapshotData.id]?.isLoading}
                        className="btn btn-primary py-2 px-4 text-sm"
                      >
                        {analysisState[selectedSnapshotData.id]?.isLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Genererar...
                          </span>
                        ) : 'Generera analys'}
                      </button>
                    )}
                    
                    {(analysisState[selectedSnapshotData.id]?.analysis || selectedSnapshotData.analysis) && (
                      <button
                        onClick={() => downloadAnalysisPDF(selectedSnapshotData.id)}
                        className="btn btn-secondary py-2 px-4 text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Ladda ner PDF
                      </button>
                    )}
                  </div>
                </div>

                {/* Analysis Content */}
                {(analysisState[selectedSnapshotData.id]?.analysis || selectedSnapshotData.analysis) ? (
                  <div className="prose prose-sm max-w-none text-[var(--text-primary)] bg-[var(--bg-page)] p-6 rounded-xl border border-[var(--border-subtle)]">
                    <div className="whitespace-pre-wrap font-sans leading-relaxed">
                      {analysisState[selectedSnapshotData.id]?.analysis || selectedSnapshotData.analysis}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-[var(--bg-page)] rounded-xl border border-dashed border-[var(--border-strong)]">
                    <p className="text-[var(--text-secondary)] mb-2">Ingen analys genererad än.</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Klicka på knappen ovan för att skapa en AI-driven analys av datan.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-page)] flex justify-end">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="btn btn-secondary"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
