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
          
          return (
            <div
              key={snapshot.id}
              className="card rounded-xl p-4 border cursor-pointer hover:border-[#624c9a] transition"
              onClick={() => setSelectedSnapshot(snapshot.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
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
              
              {snapshot.notes && (
                <p className="text-sm text-gray-500 truncate mb-2">{snapshot.notes}</p>
              )}
              
              <div className="text-xs text-gray-400">
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
            className="modal-content p-6 max-w-4xl w-full mx-4"
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

            <div className="text-sm text-gray-500 mb-4">
              Skapad: {selectedSnapshotData.created_at 
                ? new Date(selectedSnapshotData.created_at).toLocaleString('sv-SE')
                : '-'
              }
            </div>

            <button
              onClick={() => setSelectedSnapshot(null)}
              className="btn-primary px-6 py-2 rounded-lg"
            >
              Stäng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

