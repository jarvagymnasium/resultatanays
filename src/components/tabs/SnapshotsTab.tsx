'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function SnapshotsTab() {
  const {
    snapshots,
    quarters,
    activeQuarter,
    createSnapshot,
    deleteSnapshot,
    fetchSnapshots,
    userCan
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Snapshots</h2>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Skapa snapshot
          </button>
        )}
      </div>

      {/* Info box */}
      <div className="bg-[var(--color-surface-sunken)] rounded-lg p-4 border border-[var(--color-border-subtle)]">
        <h3 className="font-medium text-[var(--color-text)] mb-1">Vad är en snapshot?</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          En snapshot sparar nuvarande betygsdata för det aktiva kvartalet. 
          Använd snapshots för att bevara data innan kvartalsbyte eller för att skapa rapporter.
        </p>
      </div>

      {/* Form */}
      {showForm && canManage && (
        <div className="card p-6">
          <h3 className="font-medium text-[var(--color-text)] mb-4">Skapa ny snapshot</h3>
          
          <div className="bg-[var(--color-warning-soft)] rounded-lg p-3 mb-4">
            <p className="text-sm text-[var(--color-text)]">
              <span className="font-medium">Aktivt kvartal:</span> {activeQuarter?.name || 'Inget'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Snapshot-namn
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
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Anteckningar (valfritt)
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="input"
                rows={3}
                placeholder="Eventuella noteringar om denna snapshot..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !activeQuarter}
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
        </div>
      )}

      {/* Snapshots list */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snapshots.map(snapshot => {
          const quarter = quarters.find(q => q.id === snapshot.quarter_id);
          
          return (
            <div
              key={snapshot.id}
              className="card p-4 cursor-pointer hover:border-[var(--color-primary-soft)] transition-colors"
              onClick={() => setSelectedSnapshot(snapshot.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-medium text-[var(--color-text)]">{snapshot.name}</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">{quarter?.name || 'Okänt kvartal'}</p>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(snapshot.id);
                    }}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded transition-colors"
                    title="Radera"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              
              {snapshot.stats && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[var(--color-surface-sunken)] rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-[var(--color-danger)]">{snapshot.stats.totalFGrades}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">F-betyg</div>
                  </div>
                  <div className="bg-[var(--color-surface-sunken)] rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-[var(--color-success)]">{snapshot.stats.passRate.toFixed(0)}%</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Godkänd</div>
                  </div>
                </div>
              )}
              
              {snapshot.notes && (
                <p className="text-sm text-[var(--color-text-secondary)] truncate mb-2">{snapshot.notes}</p>
              )}
              
              <div className="text-xs text-[var(--color-text-muted)]">
                {snapshot.created_at 
                  ? new Date(snapshot.created_at).toLocaleString('sv-SE')
                  : '-'
                }
              </div>
            </div>
          );
        })}
      </div>

      {snapshots.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)] mb-2">Inga snapshots skapade än</p>
          {canManage && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Klicka på knappen ovan för att skapa en snapshot
            </p>
          )}
        </div>
      )}

      {/* Snapshot Detail Modal */}
      {selectedSnapshotData && (
        <div className="modal-overlay" onClick={() => setSelectedSnapshot(null)}>
          <div 
            className="modal-content p-6 max-w-2xl w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">{selectedSnapshotData.name}</h2>
                <p className="text-[var(--color-text-muted)]">
                  {quarters.find(q => q.id === selectedSnapshotData.quarter_id)?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedSnapshotData.notes && (
              <div className="bg-[var(--color-surface-sunken)] rounded-lg p-4 mb-6">
                <p className="text-sm text-[var(--color-text-secondary)]">{selectedSnapshotData.notes}</p>
              </div>
            )}

            {selectedSnapshotData.stats && (
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-[var(--color-surface-sunken)] rounded-lg p-3 text-center">
                  <div className="text-2xl font-semibold text-[var(--color-danger)]">{selectedSnapshotData.stats.totalFGrades}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">F-betyg</div>
                </div>
                <div className="bg-[var(--color-surface-sunken)] rounded-lg p-3 text-center">
                  <div className="text-2xl font-semibold text-[var(--color-warning)]">{selectedSnapshotData.stats.totalWarnings}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">F-varningar</div>
                </div>
                <div className="bg-[var(--color-surface-sunken)] rounded-lg p-3 text-center">
                  <div className="text-2xl font-semibold text-[var(--color-success)]">{selectedSnapshotData.stats.passRate.toFixed(1)}%</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Godkänd</div>
                </div>
                <div className="bg-[var(--color-surface-sunken)] rounded-lg p-3 text-center">
                  <div className="text-2xl font-semibold text-[var(--color-primary)]">{selectedSnapshotData.data?.students?.length || 0}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Elever</div>
                </div>
              </div>
            )}

            <div className="text-sm text-[var(--color-text-muted)] mb-6">
              Skapad: {selectedSnapshotData.created_at 
                ? new Date(selectedSnapshotData.created_at).toLocaleString('sv-SE')
                : '-'
              }
            </div>

            <button
              onClick={() => setSelectedSnapshot(null)}
              className="btn btn-secondary"
            >
              Stäng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
