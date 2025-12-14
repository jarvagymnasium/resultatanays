'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Bar } from 'react-chartjs-2';

type ComparisonType = 'quarters' | 'classes' | 'courses';

export default function CompareTab() {
  const { quarters, classes, courses, grades, students } = useAppStore();

  const [comparisonType, setComparisonType] = useState<ComparisonType>('quarters');
  const [selectedQuarter1, setSelectedQuarter1] = useState('');
  const [selectedQuarter2, setSelectedQuarter2] = useState('');
  const [selectedClass1, setSelectedClass1] = useState('');
  const [selectedClass2, setSelectedClass2] = useState('');
  const [selectedCourse1, setSelectedCourse1] = useState('');
  const [selectedCourse2, setSelectedCourse2] = useState('');

  // Calculate stats for quarter comparison
  const quarterStats = useMemo(() => {
    if (!selectedQuarter1 || !selectedQuarter2) return null;

    const getQuarterStats = (quarterId: string) => {
      // In a real app, we'd fetch grades for that specific quarter
      // For now, we use current grades as a placeholder
      const quarterGrades = grades.filter(g => g.quarter_id === quarterId);
      const fCount = quarterGrades.filter(g => g.grade === 'F').length;
      const totalGrades = quarterGrades.filter(g => g.grade).length;
      const passRate = totalGrades > 0 ? ((totalGrades - fCount) / totalGrades * 100) : 0;
      
      return { fCount, totalGrades, passRate };
    };

    return {
      quarter1: getQuarterStats(selectedQuarter1),
      quarter2: getQuarterStats(selectedQuarter2),
      quarter1Name: quarters.find(q => q.id === selectedQuarter1)?.name || '',
      quarter2Name: quarters.find(q => q.id === selectedQuarter2)?.name || ''
    };
  }, [selectedQuarter1, selectedQuarter2, grades, quarters]);

  // Calculate stats for class comparison
  const classStats = useMemo(() => {
    if (!selectedClass1 || !selectedClass2) return null;

    const getClassStats = (classId: string) => {
      const classStudents = students.filter(s => s.class_id === classId);
      const studentIds = classStudents.map(s => s.id);
      const classGrades = grades.filter(g => studentIds.includes(g.student_id));
      const fCount = classGrades.filter(g => g.grade === 'F').length;
      const totalGrades = classGrades.filter(g => g.grade).length;
      const passRate = totalGrades > 0 ? ((totalGrades - fCount) / totalGrades * 100) : 0;
      
      return { fCount, totalGrades, passRate, studentCount: classStudents.length };
    };

    return {
      class1: getClassStats(selectedClass1),
      class2: getClassStats(selectedClass2),
      class1Name: classes.find(c => c.id === selectedClass1)?.name || '',
      class2Name: classes.find(c => c.id === selectedClass2)?.name || ''
    };
  }, [selectedClass1, selectedClass2, grades, students, classes]);

  // Calculate stats for course comparison
  const courseStats = useMemo(() => {
    if (!selectedCourse1 || !selectedCourse2) return null;

    const getCourseStats = (courseId: string) => {
      const courseGrades = grades.filter(g => g.course_id === courseId);
      const fCount = courseGrades.filter(g => g.grade === 'F').length;
      const totalGrades = courseGrades.filter(g => g.grade).length;
      const passRate = totalGrades > 0 ? ((totalGrades - fCount) / totalGrades * 100) : 0;
      
      return { fCount, totalGrades, passRate };
    };

    const course1 = courses.find(c => c.id === selectedCourse1);
    const course2 = courses.find(c => c.id === selectedCourse2);

    return {
      course1: getCourseStats(selectedCourse1),
      course2: getCourseStats(selectedCourse2),
      course1Name: course1?.code || course1?.name || '',
      course2Name: course2?.code || course2?.name || ''
    };
  }, [selectedCourse1, selectedCourse2, grades, courses]);

  const chartData = useMemo(() => {
    let labels: string[] = [];
    let data1: number[] = [];
    let data2: number[] = [];
    let label1 = '';
    let label2 = '';

    if (comparisonType === 'quarters' && quarterStats) {
      labels = ['F-betyg', 'Totala betyg', 'Godkänd %'];
      data1 = [quarterStats.quarter1.fCount, quarterStats.quarter1.totalGrades, quarterStats.quarter1.passRate];
      data2 = [quarterStats.quarter2.fCount, quarterStats.quarter2.totalGrades, quarterStats.quarter2.passRate];
      label1 = quarterStats.quarter1Name;
      label2 = quarterStats.quarter2Name;
    } else if (comparisonType === 'classes' && classStats) {
      labels = ['F-betyg', 'Totala betyg', 'Godkänd %', 'Elever'];
      data1 = [classStats.class1.fCount, classStats.class1.totalGrades, classStats.class1.passRate, classStats.class1.studentCount];
      data2 = [classStats.class2.fCount, classStats.class2.totalGrades, classStats.class2.passRate, classStats.class2.studentCount];
      label1 = classStats.class1Name;
      label2 = classStats.class2Name;
    } else if (comparisonType === 'courses' && courseStats) {
      labels = ['F-betyg', 'Totala betyg', 'Godkänd %'];
      data1 = [courseStats.course1.fCount, courseStats.course1.totalGrades, courseStats.course1.passRate];
      data2 = [courseStats.course2.fCount, courseStats.course2.totalGrades, courseStats.course2.passRate];
      label1 = courseStats.course1Name;
      label2 = courseStats.course2Name;
    }

    return {
      labels,
      datasets: [
        {
          label: label1,
          data: data1,
          backgroundColor: 'rgba(98, 76, 154, 0.7)',
          borderColor: 'rgba(98, 76, 154, 1)',
          borderWidth: 1
        },
        {
          label: label2,
          data: data2,
          backgroundColor: 'rgba(67, 189, 227, 0.7)',
          borderColor: 'rgba(67, 189, 227, 1)',
          borderWidth: 1
        }
      ]
    };
  }, [comparisonType, quarterStats, classStats, courseStats]);

  const hasData = (comparisonType === 'quarters' && quarterStats) ||
                  (comparisonType === 'classes' && classStats) ||
                  (comparisonType === 'courses' && courseStats);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Jämförelser</h2>
      </div>

      {/* Comparison type selector */}
      <div className="flex gap-2">
        {(['quarters', 'classes', 'courses'] as ComparisonType[]).map(type => (
          <button
            key={type}
            onClick={() => setComparisonType(type)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              comparisonType === type
                ? 'bg-[#624c9a] text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {type === 'quarters' ? '📅 Kvartal' : type === 'classes' ? '🏫 Klasser' : '📚 Kurser'}
          </button>
        ))}
      </div>

      {/* Selection */}
      <div className="card rounded-xl p-4 border">
        <div className="grid md:grid-cols-2 gap-4">
          {comparisonType === 'quarters' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Kvartal 1</label>
                <select
                  value={selectedQuarter1}
                  onChange={(e) => setSelectedQuarter1(e.target.value)}
                  className="select w-full px-4 py-2 rounded-lg"
                >
                  <option value="">Välj kvartal</option>
                  {quarters.map(q => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Kvartal 2</label>
                <select
                  value={selectedQuarter2}
                  onChange={(e) => setSelectedQuarter2(e.target.value)}
                  className="select w-full px-4 py-2 rounded-lg"
                >
                  <option value="">Välj kvartal</option>
                  {quarters.map(q => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {comparisonType === 'classes' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Klass 1</label>
                <select
                  value={selectedClass1}
                  onChange={(e) => setSelectedClass1(e.target.value)}
                  className="select w-full px-4 py-2 rounded-lg"
                >
                  <option value="">Välj klass</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Klass 2</label>
                <select
                  value={selectedClass2}
                  onChange={(e) => setSelectedClass2(e.target.value)}
                  className="select w-full px-4 py-2 rounded-lg"
                >
                  <option value="">Välj klass</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {comparisonType === 'courses' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Kurs 1</label>
                <select
                  value={selectedCourse1}
                  onChange={(e) => setSelectedCourse1(e.target.value)}
                  className="select w-full px-4 py-2 rounded-lg"
                >
                  <option value="">Välj kurs</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Kurs 2</label>
                <select
                  value={selectedCourse2}
                  onChange={(e) => setSelectedCourse2(e.target.value)}
                  className="select w-full px-4 py-2 rounded-lg"
                >
                  <option value="">Välj kurs</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      {hasData && (
        <div className="card rounded-xl p-4 border">
          <h3 className="font-semibold mb-4">📊 Jämförelsediagram</h3>
          <div className="chart-container" style={{ height: '300px' }}>
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Stats cards */}
      {comparisonType === 'quarters' && quarterStats && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card rounded-xl p-4 border border-[#624c9a]">
            <h4 className="font-semibold mb-3 text-[#624c9a]">{quarterStats.quarter1Name}</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>F-betyg:</span>
                <span className="font-bold text-red-500">{quarterStats.quarter1.fCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Totala betyg:</span>
                <span className="font-bold">{quarterStats.quarter1.totalGrades}</span>
              </div>
              <div className="flex justify-between">
                <span>Godkänd %:</span>
                <span className="font-bold text-green-500">{quarterStats.quarter1.passRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="card rounded-xl p-4 border border-[#43bde3]">
            <h4 className="font-semibold mb-3 text-[#43bde3]">{quarterStats.quarter2Name}</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>F-betyg:</span>
                <span className="font-bold text-red-500">{quarterStats.quarter2.fCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Totala betyg:</span>
                <span className="font-bold">{quarterStats.quarter2.totalGrades}</span>
              </div>
              <div className="flex justify-between">
                <span>Godkänd %:</span>
                <span className="font-bold text-green-500">{quarterStats.quarter2.passRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">⚖️</p>
          <p>Välj två {comparisonType === 'quarters' ? 'kvartal' : comparisonType === 'classes' ? 'klasser' : 'kurser'} att jämföra</p>
        </div>
      )}
    </div>
  );
}

