'use client';

import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { StudentWithGrades, Class, Course, GradeHistory } from './types';

// ============================================
// PDF Export Functions
// ============================================

export function exportWarningsToPDF(
  students: StudentWithGrades[],
  classes: Class[],
  courses: Course[],
  title: string = 'F-varningar Rapport'
) {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(98, 76, 154); // Primary color
  doc.text(title, 20, 20);
  
  // Date
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text(`Genererad: ${new Date().toLocaleString('sv-SE')}`, 20, 28);
  
  // Summary
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const totalF = students.reduce((sum, s) => sum + s.fCount, 0);
  doc.text(`Totalt antal F-betyg: ${totalF}`, 20, 40);
  doc.text(`Antal elever med F: ${students.length}`, 20, 48);
  
  // Table header
  let y = 60;
  doc.setFontSize(10);
  doc.setFillColor(98, 76, 154);
  doc.rect(20, y - 5, 170, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('Elev', 22, y);
  doc.text('Klass', 72, y);
  doc.text('Antal F', 102, y);
  doc.text('Kurser', 130, y);
  
  // Table content
  y += 10;
  doc.setTextColor(0, 0, 0);
  
  students.forEach((student, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 5, 170, 8, 'F');
    }
    
    doc.text(student.name.substring(0, 25), 22, y);
    doc.text(student.class?.name || '-', 72, y);
    doc.setTextColor(239, 68, 68); // Red for F count
    doc.text(student.fCount.toString(), 107, y);
    doc.setTextColor(0, 0, 0);
    
    // F courses
    const fCourseNames = student.grades
      .filter(g => g.grade === 'F')
      .map(g => courses.find(c => c.id === g.course_id)?.code || '')
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    doc.text(fCourseNames.substring(0, 30), 130, y);
    
    y += 8;
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Järva Gymnasium - Resultatanalys | Sida ${i} av ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }
  
  doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportProgressToPDF(
  improvements: (GradeHistory & { student?: { name: string; class_id?: string }; course?: Course })[],
  classes: Class[],
  title: string = 'Betygsutveckling Rapport'
) {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(34, 197, 94); // Green
  doc.text(title, 20, 20);
  
  // Date
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text(`Genererad: ${new Date().toLocaleString('sv-SE')}`, 20, 28);
  
  // Summary
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Totalt antal förbättringar: ${improvements.length}`, 20, 40);
  
  // Table header
  let y = 55;
  doc.setFontSize(10);
  doc.setFillColor(34, 197, 94);
  doc.rect(20, y - 5, 170, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('Elev', 22, y);
  doc.text('Kurs', 72, y);
  doc.text('Från', 120, y);
  doc.text('Till', 140, y);
  doc.text('Datum', 160, y);
  
  // Table content
  y += 10;
  doc.setTextColor(0, 0, 0);
  
  improvements.forEach((improvement, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    if (index % 2 === 0) {
      doc.setFillColor(245, 255, 245);
      doc.rect(20, y - 5, 170, 8, 'F');
    }
    
    doc.text((improvement.student?.name || '').substring(0, 25), 22, y);
    doc.text((improvement.course?.code || '').substring(0, 20), 72, y);
    
    doc.setTextColor(239, 68, 68);
    doc.text(improvement.from_grade || '-', 122, y);
    doc.setTextColor(34, 197, 94);
    doc.text(improvement.to_grade, 142, y);
    doc.setTextColor(0, 0, 0);
    
    const date = improvement.created_at 
      ? new Date(improvement.created_at).toLocaleDateString('sv-SE')
      : '-';
    doc.text(date, 160, y);
    
    y += 8;
  });
  
  doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ============================================
// Excel Export Functions
// ============================================

export function exportWarningsToExcel(
  students: StudentWithGrades[],
  classes: Class[],
  courses: Course[],
  filename: string = 'F-varningar'
) {
  const data = students.map(student => {
    const fCourses = student.grades
      .filter(g => g.grade === 'F')
      .map(g => courses.find(c => c.id === g.course_id)?.code || '')
      .filter(Boolean)
      .join(', ');
    
    return {
      'Elev': student.name,
      'Klass': student.class?.name || '-',
      'Antal F-betyg': student.fCount,
      'Antal F-varningar': student.warningCount,
      'Kurser med F': fCourses
    };
  });
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'F-varningar');
  
  // Auto-fit columns
  const colWidths = [
    { wch: 30 }, // Elev
    { wch: 15 }, // Klass
    { wch: 15 }, // Antal F-betyg
    { wch: 18 }, // Antal F-varningar
    { wch: 50 }, // Kurser med F
  ];
  ws['!cols'] = colWidths;
  
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportProgressToExcel(
  improvements: (GradeHistory & { student?: { name: string; class_id?: string }; course?: Course })[],
  classes: Class[],
  filename: string = 'Betygsutveckling'
) {
  const data = improvements.map(improvement => {
    const studentClass = classes.find(c => c.id === improvement.student?.class_id);
    
    return {
      'Elev': improvement.student?.name || '-',
      'Klass': studentClass?.name || '-',
      'Kurs': improvement.course?.name || '-',
      'Kurskod': improvement.course?.code || '-',
      'Från betyg': improvement.from_grade || '-',
      'Till betyg': improvement.to_grade,
      'Typ': improvement.grade_type === 'grade' ? 'Betyg' : 'Varning',
      'Datum': improvement.created_at 
        ? new Date(improvement.created_at).toLocaleDateString('sv-SE')
        : '-'
    };
  });
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Betygsutveckling');
  
  ws['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
  ];
  
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportAllDataToExcel(
  students: StudentWithGrades[],
  classes: Class[],
  courses: Course[],
  filename: string = 'Resultatanalys_Export'
) {
  const wb = XLSX.utils.book_new();
  
  // Students sheet
  const studentsData = students.map(s => ({
    'Namn': s.name,
    'Klass': s.class?.name || '-',
    'Antal F-betyg': s.fCount,
    'Antal F-varningar': s.warningCount,
    'Totalt antal betyg': s.grades.length
  }));
  const studentsWs = XLSX.utils.json_to_sheet(studentsData);
  XLSX.utils.book_append_sheet(wb, studentsWs, 'Elever');
  
  // Classes sheet
  const classesData = classes.map(c => ({
    'Klassnamn': c.name,
    'Antal elever': students.filter(s => s.class_id === c.id).length
  }));
  const classesWs = XLSX.utils.json_to_sheet(classesData);
  XLSX.utils.book_append_sheet(wb, classesWs, 'Klasser');
  
  // Courses sheet
  const coursesData = courses.map(c => ({
    'Kursnamn': c.name,
    'Kurskod': c.code,
    'Poäng': c.points || '-'
  }));
  const coursesWs = XLSX.utils.json_to_sheet(coursesData);
  XLSX.utils.book_append_sheet(wb, coursesWs, 'Kurser');
  
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

