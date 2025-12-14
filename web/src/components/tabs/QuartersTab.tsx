'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

export default function QuartersTab() {
  const {
    quarters,
    activeQuarter,
    addQuarter,
    setActiveQuarter,
    deleteQuarter,
    userCan
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = userCan('manage_quarters');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    
    setIsSubmitting(true);
    try {
      await addQuarter(formName, formStartDate || undefined, formEndDate || undefined);
      resetForm();
    } catch (error) {
      console.error('Error adding quarter:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActive = async (quarterId: string) => {
    if (!canManage) return;
    try {
      await setActiveQuarter(quarterId);
    } catch (error) {
      console.error('Error setting active quarter:', error);
    }
  };

  const handleDelete = async (quarterId: string) => {
    if (!confirm('Vill du ta bort detta kvartal? Alla betyg för kvartalet kommer att raderas.')) return;
    try {
      await deleteQuarter(quarterId);
    } catch (error) {
      console.error('Error deleting quarter:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormStartDate('');
    setFormEndDate('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Kvartal</h2>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <span>➕</span> Lägg till kvartal
          </button>
        )}
      </div>

      {/* Active quarter info */}
      {activeQuarter && (
        <div className="card rounded-xl p-4 border border-[#624c9a] bg-[#624c9a]/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <div className="font-semibold">Aktivt kvartal</div>
              <div className="text-xl font-bold text-[#624c9a]">{activeQuarter.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && canManage && (
        <div className="card rounded-xl p-6 border">
          <h3 className="font-semibold mb-4">Nytt kvartal</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kvartalnamn</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input w-full px-4 py-2 rounded-lg"
                  placeholder="t.ex. VT 2024"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Startdatum (valfritt)</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="input w-full px-4 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Slutdatum (valfritt)</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="input w-full px-4 py-2 rounded-lg"
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

      {/* Quarters list */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quarters.map(quarter => (
          <div
            key={quarter.id}
            className={`card rounded-xl p-4 border ${
              activeQuarter?.id === quarter.id ? 'border-[#624c9a] ring-2 ring-[#624c9a]/20' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">{quarter.name}</h3>
                {activeQuarter?.id === quarter.id && (
                  <span className="text-xs bg-[#624c9a] text-white px-2 py-0.5 rounded-full">
                    Aktivt
                  </span>
                )}
              </div>
              {canManage && (
                <div className="flex gap-1">
                  {activeQuarter?.id !== quarter.id && (
                    <button
                      onClick={() => handleSetActive(quarter.id)}
                      className="px-2 py-1 text-sm bg-[#624c9a]/10 hover:bg-[#624c9a]/20 text-[#624c9a] rounded transition"
                      title="Sätt som aktivt"
                    >
                      Aktivera
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(quarter.id)}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Ta bort"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
            
            {(quarter.start_date || quarter.end_date) && (
              <div className="text-sm text-gray-500">
                {quarter.start_date && (
                  <span>
                    Från: {new Date(quarter.start_date).toLocaleDateString('sv-SE')}
                  </span>
                )}
                {quarter.start_date && quarter.end_date && <span className="mx-2">-</span>}
                {quarter.end_date && (
                  <span>
                    Till: {new Date(quarter.end_date).toLocaleDateString('sv-SE')}
                  </span>
                )}
              </div>
            )}
            
            <div className="mt-3 text-xs text-gray-400">
              Skapad: {quarter.created_at 
                ? new Date(quarter.created_at).toLocaleDateString('sv-SE')
                : '-'
              }
            </div>
          </div>
        ))}
      </div>

      {quarters.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">📅</p>
          <p>Inga kvartal ännu</p>
          {canManage && <p className="text-sm mt-2">Lägg till ett kvartal för att börja registrera betyg</p>}
        </div>
      )}
    </div>
  );
}

