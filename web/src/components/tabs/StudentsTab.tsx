'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';

// ============================================
// Duplicate Detection Utilities
// ============================================

// Normalize a name for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z\s]/g, '')        // Keep only letters and spaces
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
}

// Split name into parts
function getNameParts(name: string): string[] {
  return normalizeName(name).split(' ').filter(Boolean);
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

// Calculate similarity score between 0 and 1
function stringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(str1, str2) / maxLen;
}

// Check if two names might be the same person
interface DuplicateMatch {
  student1Id: string;
  student2Id: string;
  similarity: number;
  reason: string;
}

function analyzeNameSimilarity(name1: string, name2: string): { isSimilar: boolean; similarity: number; reason: string } {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // Exact match after normalization
  if (norm1 === norm2) {
    return { isSimilar: true, similarity: 1, reason: 'Exakt matchning (efter normalisering)' };
  }
  
  const parts1 = getNameParts(name1);
  const parts2 = getNameParts(name2);
  
  // Check if one name is a subset of the other (missing middle name)
  const isSubset = (short: string[], long: string[]): boolean => {
    if (short.length === 0) return false;
    let shortIdx = 0;
    for (const part of long) {
      if (shortIdx < short.length && stringSimilarity(short[shortIdx], part) > 0.8) {
        shortIdx++;
      }
    }
    return shortIdx === short.length;
  };
  
  if (parts1.length !== parts2.length) {
    const [shorter, longer] = parts1.length < parts2.length 
      ? [parts1, parts2] 
      : [parts2, parts1];
    
    if (shorter.length >= 2 && isSubset(shorter, longer)) {
      const similarity = shorter.length / longer.length;
      return { 
        isSimilar: true, 
        similarity: 0.85 + similarity * 0.1, 
        reason: 'Saknat mellannamn - förnamn och efternamn matchar' 
      };
    }
  }
  
  // Check if first and last name match (common case)
  if (parts1.length >= 2 && parts2.length >= 2) {
    const firstName1 = parts1[0];
    const firstName2 = parts2[0];
    const lastName1 = parts1[parts1.length - 1];
    const lastName2 = parts2[parts2.length - 1];
    
    const firstNameSim = stringSimilarity(firstName1, firstName2);
    const lastNameSim = stringSimilarity(lastName1, lastName2);
    
    // Both first and last names are very similar
    if (firstNameSim > 0.85 && lastNameSim > 0.85) {
      return { 
        isSimilar: true, 
        similarity: (firstNameSim + lastNameSim) / 2, 
        reason: 'Förnamn och efternamn är nästan identiska' 
      };
    }
    
    // Same last name and similar first name (typo in first name)
    if (lastNameSim === 1 && firstNameSim > 0.7) {
      return { 
        isSimilar: true, 
        similarity: 0.8 + firstNameSim * 0.15, 
        reason: 'Samma efternamn, liknande förnamn (möjlig stavfel)' 
      };
    }
    
    // Same first name and similar last name (typo in last name)
    if (firstNameSim === 1 && lastNameSim > 0.7) {
      return { 
        isSimilar: true, 
        similarity: 0.8 + lastNameSim * 0.15, 
        reason: 'Samma förnamn, liknande efternamn (möjlig stavfel)' 
      };
    }
  }
  
  // Full string similarity check
  const fullSimilarity = stringSimilarity(norm1, norm2);
  if (fullSimilarity > 0.85) {
    return { 
      isSimilar: true, 
      similarity: fullSimilarity, 
      reason: 'Hög namnlikhet (möjlig stavfel)' 
    };
  }
  
  return { isSimilar: false, similarity: fullSimilarity, reason: '' };
}

interface StudentWithStats {
  id: string;
  name: string;
  class_id: string;
  class?: { id: string; name: string };
  fCount: number;
  warningCount: number;
  totalGrades: number;
}

interface DuplicateGroup {
  students: StudentWithStats[];
  similarity: number;
  reason: string;
}

export default function StudentsTab() {
  const {
    students,
    classes,
    grades,
    addStudent,
    archiveStudent,
    userCan
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);

  const canManage = userCan('manage_students');

  // Calculate stats for each student
  const studentsWithStats = useMemo((): StudentWithStats[] => {
    return students.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      const fCount = studentGrades.filter(g => g.grade === 'F' && g.grade_type !== 'warning').length;
      const warningCount = studentGrades.filter(g => g.grade === 'F' && g.grade_type === 'warning').length;
      const studentClass = classes.find(c => c.id === student.class_id);
      
      return {
        ...student,
        class: studentClass,
        fCount,
        warningCount,
        totalGrades: studentGrades.length
      };
    });
  }, [students, grades, classes]);

  // Filter students
  const filteredStudents = useMemo(() => {
    let result = [...studentsWithStats];
    
    if (filterClassId) {
      result = result.filter(s => s.class_id === filterClassId);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(search));
    }
    
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [studentsWithStats, filterClassId, searchTerm]);

  // Find duplicates
  const findDuplicates = useCallback(() => {
    setIsAnalyzing(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const matches: DuplicateMatch[] = [];
      const studentsList = studentsWithStats;
      
      // Group students by class first (duplicates are usually in same class)
      const studentsByClass = new Map<string, StudentWithStats[]>();
      studentsList.forEach(student => {
        const existing = studentsByClass.get(student.class_id) || [];
        existing.push(student);
        studentsByClass.set(student.class_id, existing);
      });
      
      // Check within each class
      studentsByClass.forEach((classStudents) => {
        for (let i = 0; i < classStudents.length; i++) {
          for (let j = i + 1; j < classStudents.length; j++) {
            const result = analyzeNameSimilarity(
              classStudents[i].name, 
              classStudents[j].name
            );
            
            if (result.isSimilar) {
              matches.push({
                student1Id: classStudents[i].id,
                student2Id: classStudents[j].id,
                similarity: result.similarity,
                reason: result.reason
              });
            }
          }
        }
      });
      
      // Also check across all students for very high similarity (same student in different classes)
      for (let i = 0; i < studentsList.length; i++) {
        for (let j = i + 1; j < studentsList.length; j++) {
          // Skip if same class (already checked)
          if (studentsList[i].class_id === studentsList[j].class_id) continue;
          
          const result = analyzeNameSimilarity(
            studentsList[i].name, 
            studentsList[j].name
          );
          
          // Only flag cross-class duplicates if very high similarity
          if (result.isSimilar && result.similarity > 0.95) {
            matches.push({
              student1Id: studentsList[i].id,
              student2Id: studentsList[j].id,
              similarity: result.similarity,
              reason: result.reason + ' (olika klasser!)'
            });
          }
        }
      }
      
      // Group matches by student
      const processed = new Set<string>();
      const groups: DuplicateGroup[] = [];
      
      // Sort by similarity (highest first)
      matches.sort((a, b) => b.similarity - a.similarity);
      
      matches.forEach(match => {
        const key = [match.student1Id, match.student2Id].sort().join('-');
        if (processed.has(key)) return;
        processed.add(key);
        
        const student1 = studentsList.find(s => s.id === match.student1Id);
        const student2 = studentsList.find(s => s.id === match.student2Id);
        
        if (student1 && student2) {
          groups.push({
            students: [student1, student2],
            similarity: match.similarity,
            reason: match.reason
          });
        }
      });
      
      setDuplicateGroups(groups);
      setShowDuplicates(true);
      setIsAnalyzing(false);
    }, 100);
  }, [studentsWithStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formClassId) return;
    
    setIsSubmitting(true);
    try {
      await addStudent(formName, formClassId);
      resetForm();
    } catch (error) {
      console.error('Error adding student:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (studentId: string) => {
    if (!confirm('Vill du arkivera denna elev?')) return;
    try {
      await archiveStudent(studentId);
      // Remove from duplicate groups
      setDuplicateGroups(prev => 
        prev.filter(group => !group.students.some(s => s.id === studentId))
      );
    } catch (error) {
      console.error('Error archiving student:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormClassId('');
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.95) return 'text-red-600 dark:text-red-400';
    if (similarity >= 0.9) return 'text-orange-600 dark:text-orange-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  const getSimilarityBadge = (similarity: number) => {
    if (similarity >= 0.95) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    if (similarity >= 0.9) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Elever ({students.length})</h2>
        <div className="flex gap-2">
          {canManage && (
            <>
              <button
                onClick={findDuplicates}
                disabled={isAnalyzing}
                className="px-4 py-2 rounded-lg flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin">⏳</span> Analyserar...
                  </>
                ) : (
                  <>
                    <span>🔍</span> Hitta dubbletter
                  </>
                )}
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <span>➕</span> Lägg till elev
              </button>
            </>
          )}
        </div>
      </div>

      {/* Duplicate Detection Results */}
      {showDuplicates && (
        <div className="card rounded-xl border overflow-hidden">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <div>
                <h3 className="font-semibold">Dubblettanalys</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {duplicateGroups.length === 0 
                    ? 'Inga potentiella dubbletter hittades!' 
                    : `${duplicateGroups.length} potentiella dubbletter hittades`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDuplicates(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-2"
            >
              ✕
            </button>
          </div>
          
          {duplicateGroups.length > 0 && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {duplicateGroups.map((group, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-sm font-medium ${getSimilarityColor(group.similarity)}`}>
                      {Math.round(group.similarity * 100)}% likhet
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getSimilarityBadge(group.similarity)}`}>
                      {group.reason}
                    </span>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {group.students.map(student => (
                      <div 
                        key={student.id}
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 relative"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-lg">{student.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Klass: {student.class?.name || 'Okänd'}
                            </p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span>
                                Betyg: <strong>{student.totalGrades}</strong>
                              </span>
                              {student.fCount > 0 && (
                                <span className="text-red-500">
                                  F-betyg: <strong>{student.fCount}</strong>
                                </span>
                              )}
                              {student.warningCount > 0 && (
                                <span className="text-orange-500">
                                  Varningar: <strong>{student.warningCount}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {canManage && (
                            <button
                              onClick={() => handleArchive(student.id)}
                              className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition flex items-center gap-1"
                              title="Arkivera denna elev"
                            >
                              🗑️ Ta bort
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-3 italic">
                    💡 Tips: Jämför antal betyg och F - den med fler betyg är troligen den korrekta posten.
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {duplicateGroups.length === 0 && (
            <div className="p-8 text-center">
              <span className="text-4xl mb-4 block">🎉</span>
              <p className="text-gray-600 dark:text-gray-400">
                Inga potentiella dubbletter hittades bland {students.length} elever.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card rounded-xl p-4 border">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Sök elev..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-1 min-w-[200px] px-4 py-2 rounded-lg"
          />
          
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="select px-4 py-2 rounded-lg"
          >
            <option value="">Alla klasser</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Form */}
      {showForm && canManage && (
        <div className="card rounded-xl p-6 border">
          <h3 className="font-semibold mb-4">Ny elev</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Elevnamn</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input w-full px-4 py-2 rounded-lg"
                  placeholder="Förnamn Efternamn"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Klass</label>
                <select
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                  className="select w-full px-4 py-2 rounded-lg"
                  required
                >
                  <option value="">Välj klass</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
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

      {/* Students table */}
      <div className="card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Namn</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Klass</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">F-betyg</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Varningar</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Betyg</th>
                {canManage && (
                  <th className="px-4 py-3 text-right text-sm font-semibold">Åtgärder</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                    Inga elever matchar sökningen
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className={student.fCount >= 3 ? 'f-count-3plus' : student.fCount === 2 ? 'f-count-2' : ''}>
                    <td className="px-4 py-3 font-medium">{student.name}</td>
                    <td className="px-4 py-3 text-sm">{student.class?.name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {student.fCount > 0 ? (
                        <span className="warning-badge">{student.fCount}</span>
                      ) : (
                        <span className="text-green-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.warningCount > 0 ? (
                        <span className="text-orange-500 font-medium">{student.warningCount}</span>
                      ) : (
                        <span className="text-green-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">
                      {student.totalGrades}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleArchive(student.id)}
                          className="text-gray-500 hover:text-red-500 p-1"
                          title="Arkivera"
                        >
                          🗑️
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500 text-center">
        Visar {filteredStudents.length} av {students.length} elever
      </div>
    </div>
  );
}
