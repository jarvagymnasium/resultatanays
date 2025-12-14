'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Snapshot } from '@/lib/types';

// Dynamic import for jsPDF to avoid SSR issues
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
    userCan,
    classes,
    courses,
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

  // Build analysis data from snapshot
  const buildAnalysisData = useCallback((snapshot: Snapshot) => {
    const quarter = quarters.find(q => q.id === snapshot.quarter_id);
    const snapshotGrades = snapshot.data?.grades || [];
    const snapshotStudents = snapshot.data?.students || [];
    const snapshotCourses = snapshot.data?.courses || [];
    const snapshotClasses = snapshot.data?.classes || [];

    // Calculate class breakdown
    const classBreakdown = snapshotClasses.map(cls => {
      const classStudentIds = snapshotStudents
        .filter(s => s.class_id === cls.id)
        .map(s => s.id);
      
      const classGrades = snapshotGrades.filter(g => classStudentIds.includes(g.student_id));
      const fCount = classGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
      const fWarningCount = classGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;

      return {
        className: cls.name,
        studentCount: classStudentIds.length,
        fCount,
        fWarningCount
      };
    }).filter(c => c.studentCount > 0);

    // Calculate course breakdown
    const courseBreakdown = snapshotCourses.map(course => {
      const courseGrades = snapshotGrades.filter(g => g.course_id === course.id);
      const fCount = courseGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
      const fWarningCount = courseGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;

      return {
        courseCode: course.code || course.name,
        courseName: course.name,
        fCount,
        fWarningCount
      };
    }).filter(c => c.fCount > 0 || c.fWarningCount > 0);

    // Calculate students at risk
    const studentFCounts: Record<string, number> = {};
    snapshotGrades.forEach(g => {
      if (g.grade === 'F' && g.grade_type !== 'warning') {
        studentFCounts[g.student_id] = (studentFCounts[g.student_id] || 0) + 1;
      }
    });

    const studentsAtRisk = {
      with1F: Object.values(studentFCounts).filter(c => c === 1).length,
      with2F: Object.values(studentFCounts).filter(c => c === 2).length,
      with3PlusF: Object.values(studentFCounts).filter(c => c >= 3).length
    };

    // Count improvements for this quarter
    const totalImprovements = gradeHistory.filter(
      h => h.from_grade === 'F' && h.quarter_id === snapshot.quarter_id
    ).length;

    return {
      name: snapshot.name,
      quarterName: quarter?.name || 'Okänt kvartal',
      snapshotDate: snapshot.created_at 
        ? new Date(snapshot.created_at).toLocaleDateString('sv-SE')
        : new Date().toLocaleDateString('sv-SE'),
      stats: {
        totalStudents: new Set(snapshotGrades.map(g => g.student_id)).size,
        totalGrades: snapshotGrades.length,
        totalFGrades: snapshot.stats?.totalFGrades || 0,
        totalFWarnings: snapshot.stats?.totalWarnings || 0,
        passRate: snapshot.stats?.passRate || 0,
        totalImprovements
      },
      classBreakdown,
      courseBreakdown,
      studentsAtRisk
    };
  }, [quarters, gradeHistory]);

  // Generate AI analysis
  const generateAnalysis = async (snapshotId: string) => {
    const snapshot = getSnapshot(snapshotId);
    if (!snapshot) return;

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

  // Download analysis as PDF
  const downloadAnalysisPDF = async (snapshotId: string) => {
    const snapshot = getSnapshot(snapshotId);
    const state = analysisState[snapshotId];
    if (!snapshot || !state?.analysis) return;

    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();
      
      const quarter = quarters.find(q => q.id === snapshot.quarter_id);
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      
      // Header
      doc.setFillColor(98, 76, 154);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Järva Gymnasium', margin, 15);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('AI-Analys av Snapshot', margin, 25);
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Snapshot info
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(snapshot.name, margin, 50);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Kvartal: ${quarter?.name || 'Okänt'}`, margin, 58);
      doc.text(`Genererad: ${new Date().toLocaleString('sv-SE')}`, margin, 65);
      
      // Analysis content
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      
      let yPosition = 80;
      const lineHeight = 5;
      
      // Convert markdown to plain text and split into lines
      const plainText = state.analysis
        .replace(/###\s*/g, '\n')
        .replace(/##\s*/g, '\n')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '');
      
      const lines = plainText.split('\n');
      
      for (const line of lines) {
        // Check if we need a new page
        if (yPosition > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Handle headers (lines that were ### or ##)
        if (line.trim().startsWith('DEL ') || line.trim().match(/^[A-ZÅÄÖ]{2,}/)) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          yPosition += 5;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
        }
        
        // Word wrap
        const wrappedLines = doc.splitTextToSize(line.trim(), maxWidth);
        
        for (const wrappedLine of wrappedLines) {
          if (yPosition > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            yPosition = 20;
          }
          
          if (wrappedLine.trim()) {
            doc.text(wrappedLine, margin, yPosition);
            yPosition += lineHeight;
          }
        }
        
        // Add small spacing after each original line
        yPosition += 2;
      }
      
      // Footer on last page
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Sida ${i} av ${pageCount} | Järva Gymnasium Resultatanalys`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
      
      // Save
      const fileName = `analys-${snapshot.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Kunde inte skapa PDF. Försök igen.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Snapshots</h2>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-accent-orange px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <span>📸</span> Skapa Snapshot
          </button>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📸</span>
          <div>
            <h3 className="font-semibold mb-1">Vad är en Snapshot?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              En snapshot sparar nuvarande betygsdata för det aktiva kvartalet. 
              Använd snapshots för att bevara data innan kvartalsbyte eller för att skapa rapporter.
              Du kan även generera en <strong>AI-analys</strong> av varje snapshot!
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && canManage && (
        <div className="card rounded-xl p-6 border">
          <h3 className="font-semibold mb-4">Skapa ny Snapshot</h3>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            <p className="text-sm">
              <strong>Aktivt kvartal:</strong> {activeQuarter?.name || 'Inget'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Snapshot-namn</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="input w-full px-4 py-2 rounded-lg"
                placeholder="t.ex. VT 2024 - Vecka 10"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Anteckningar (valfritt)</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="input w-full px-4 py-2 rounded-lg"
                rows={3}
                placeholder="Eventuella noteringar om denna snapshot..."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !activeQuarter}
                className="btn-accent-orange px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Skapar...' : '📸 Skapa Snapshot'}
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

      {/* Snapshots list */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snapshots.map(snapshot => {
          const quarter = quarters.find(q => q.id === snapshot.quarter_id);
          const state = analysisState[snapshot.id];
          
          return (
            <div
              key={snapshot.id}
              className="card rounded-xl p-4 border hover:border-[#624c9a] transition"
            >
              <div className="flex justify-between items-start mb-3">
                <div 
                  className="cursor-pointer flex-1"
                  onClick={() => setSelectedSnapshot(snapshot.id)}
                >
                  <h3 className="font-bold">{snapshot.name}</h3>
                  <p className="text-sm text-gray-500">{quarter?.name || 'Okänt kvartal'}</p>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(snapshot.id);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Radera"
                  >
                    🗑️
                  </button>
                )}
              </div>
              
              {snapshot.stats && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-red-500">{snapshot.stats.totalFGrades}</div>
                    <div className="text-xs text-gray-500">F-betyg</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-500">{snapshot.stats.passRate.toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">Godkänd</div>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-400 mb-3">
                {snapshot.created_at 
                  ? new Date(snapshot.created_at).toLocaleString('sv-SE')
                  : '-'
                }
              </div>

              {/* AI Analysis buttons */}
              <div className="border-t pt-3 mt-3 space-y-2">
                {!state?.analysis && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      generateAnalysis(snapshot.id);
                    }}
                    disabled={state?.isLoading}
                    className="w-full px-3 py-2 bg-gradient-to-r from-[#624c9a] to-[#e72c81] text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {state?.isLoading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Genererar analys...
                      </>
                    ) : (
                      <>
                        <span>🤖</span>
                        Ta fram analys
                      </>
                    )}
                  </button>
                )}

                {state?.error && (
                  <div className="text-xs text-red-500 text-center">
                    {state.error}
                  </div>
                )}

                {state?.analysis && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAnalysisPDF(snapshot.id);
                    }}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                  >
                    <span>📥</span>
                    Ladda ner analys (PDF)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {snapshots.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">📸</p>
          <p>Inga snapshots skapade än</p>
          {canManage && <p className="text-sm mt-2">Klicka på knappen ovan för att skapa en snapshot</p>}
        </div>
      )}

      {/* Snapshot Detail Modal */}
      {selectedSnapshotData && (
        <div className="modal-overlay" onClick={() => setSelectedSnapshot(null)}>
          <div 
            className="modal-content p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedSnapshotData.name}</h2>
                <p className="text-gray-500">
                  {quarters.find(q => q.id === selectedSnapshotData.quarter_id)?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedSnapshotData.notes && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <p className="text-sm">{selectedSnapshotData.notes}</p>
              </div>
            )}

            {selectedSnapshotData.stats && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="card rounded-xl p-3 border text-center">
                  <div className="text-2xl font-bold text-red-500">{selectedSnapshotData.stats.totalFGrades}</div>
                  <div className="text-xs text-gray-500">F-betyg</div>
                </div>
                <div className="card rounded-xl p-3 border text-center">
                  <div className="text-2xl font-bold text-orange-500">{selectedSnapshotData.stats.totalWarnings}</div>
                  <div className="text-xs text-gray-500">F-varningar</div>
                </div>
                <div className="card rounded-xl p-3 border text-center">
                  <div className="text-2xl font-bold text-green-500">{selectedSnapshotData.stats.passRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">Godkänd</div>
                </div>
                <div className="card rounded-xl p-3 border text-center">
                  <div className="text-2xl font-bold text-[#624c9a]">{selectedSnapshotData.data?.students?.length || 0}</div>
                  <div className="text-xs text-gray-500">Elever</div>
                </div>
              </div>
            )}

            {/* AI Analysis section in modal */}
            {analysisState[selectedSnapshotData.id]?.analysis && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>🤖</span> AI-Analys
                </h3>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm font-sans">
                      {analysisState[selectedSnapshotData.id].analysis}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-500 mb-4">
              Skapad: {selectedSnapshotData.created_at 
                ? new Date(selectedSnapshotData.created_at).toLocaleString('sv-SE')
                : '-'
              }
            </div>

            <div className="flex gap-2">
              {!analysisState[selectedSnapshotData.id]?.analysis && (
                <button
                  onClick={() => generateAnalysis(selectedSnapshotData.id)}
                  disabled={analysisState[selectedSnapshotData.id]?.isLoading}
                  className="px-4 py-2 bg-gradient-to-r from-[#624c9a] to-[#e72c81] text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {analysisState[selectedSnapshotData.id]?.isLoading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Genererar...
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      Ta fram analys
                    </>
                  )}
                </button>
              )}
              
              {analysisState[selectedSnapshotData.id]?.analysis && (
                <button
                  onClick={() => downloadAnalysisPDF(selectedSnapshotData.id)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                >
                  <span>📥</span>
                  Ladda ner PDF
                </button>
              )}
              
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
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
