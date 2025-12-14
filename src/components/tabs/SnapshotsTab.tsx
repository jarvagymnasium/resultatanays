'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function SnapshotsTab() {
  const router = useRouter();
  const {
    snapshots,
    quarters,
    activeQuarter,
    createSnapshot,
    deleteSnapshot,
    fetchSnapshots,
    userCan,
    grades
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = userCan('manage_quarters');

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    if (!activeQuarter) {
      alert('Inget aktivt kvartal valt. Välj ett kvartal först under Statistik → Kvartal.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createSnapshot(formName, formNotes || undefined);
      resetForm();
    } catch (error) {
      console.error('Error creating snapshot:', error);
      alert('Kunde inte skapa snapshot. Försök igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, snapshotId: string) => {
    e.stopPropagation();
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

  // Navigate to snapshot detail page
  const openSnapshot = (snapshotId: string) => {
    router.push(`/snapshots/${snapshotId}`);
  };

  // Calculate stats for a snapshot from grades table via quarter_id
  const getSnapshotStats = (quarterId: string) => {
    const quarterGrades = grades.filter(g => g.quarter_id === quarterId);
    
    if (quarterGrades.length === 0) {
      return { totalFGrades: 0, totalWarnings: 0, passRate: 0 };
    }
    
    const totalFGrades = quarterGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
    const totalWarnings = quarterGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;
    const gradedCount = quarterGrades.filter(g => g.grade).length;
    const passRate = gradedCount > 0 
      ? ((gradedCount - totalFGrades) / gradedCount) * 100 
      : 0;
    
    return { totalFGrades, totalWarnings, passRate };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Snapshots</h1>
          <p className="text-[var(--text-secondary)] mt-1">Spara och analysera betygsläget över tid</p>
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

      {/* Create Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Ny snapshot</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Namn *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="T.ex. Vecka 45 - Lägesrapport"
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Anteckningar
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Valfria anteckningar..."
                className="input w-full h-24 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !formName.trim()}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Skapar...' : 'Skapa snapshot'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Avbryt
              </button>
            </div>
          </form>
          
          {activeQuarter && (
            <p className="text-xs text-[var(--text-tertiary)] mt-4">
              Snapshot skapas för aktivt kvartal: <span className="font-medium">{activeQuarter.name}</span>
            </p>
          )}
        </div>
      )}

      {/* Snapshots Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {snapshots.map(snapshot => {
          const quarter = quarters.find(q => q.id === snapshot.quarter_id);
          const stats = getSnapshotStats(snapshot.quarter_id);
          const hasAnalysis = !!snapshot.analysis;
          
          return (
            <div
              key={snapshot.id}
              onClick={() => openSnapshot(snapshot.id)}
              className="card p-6 cursor-pointer hover:border-[var(--color-primary)] transition-all group"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                    {snapshot.name}
                  </h3>
                  <p className="text-sm text-[var(--text-tertiary)]">{quarter?.name || 'Okänt kvartal'}</p>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => handleDelete(e, snapshot.id)}
                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Radera"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[var(--bg-hover)] rounded-lg p-3 text-center border border-[var(--border-subtle)]">
                  <div className="text-xl font-bold text-[var(--color-danger)]">{stats.totalFGrades}</div>
                  <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">F-betyg</div>
                </div>
                <div className="bg-[var(--bg-hover)] rounded-lg p-3 text-center border border-[var(--border-subtle)]">
                  <div className="text-xl font-bold text-[var(--color-success)]">{stats.passRate.toFixed(0)}%</div>
                  <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Godkända</div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex justify-between items-center text-xs text-[var(--text-tertiary)]">
                <span>
                  {snapshot.created_at ? new Date(snapshot.created_at).toLocaleDateString('sv-SE') : '-'}
                </span>
                <div className="flex items-center gap-2">
                  {hasAnalysis && (
                    <span className="flex items-center gap-1 text-[var(--color-primary)] font-medium bg-[var(--color-primary-subtle)]/30 px-2 py-0.5 rounded">
                      Analys klar
                    </span>
                  )}
                  <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--color-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {snapshots.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-[var(--border-strong)] rounded-xl">
          <svg className="w-16 h-16 mx-auto text-[var(--text-tertiary)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-[var(--text-secondary)] mb-2">Inga snapshots skapade än</p>
          {canManage && (
            <p className="text-sm text-[var(--text-tertiary)]">
              Använd knappen ovan för att spara din första snapshot
            </p>
          )}
        </div>
      )}
    </div>
  );
}
