import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client with service role for cleanup operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET() {
  try {
    // Find duplicates in BOTH grades and grade_history tables
    
    // 1. Check grades table
    const { data: allGrades, error: gradesError } = await supabaseAdmin
      .from('grades')
      .select('*')
      .order('created_at', { ascending: false });

    if (gradesError) {
      return NextResponse.json({ error: gradesError.message }, { status: 500 });
    }

    // 2. Check grade_history table
    const { data: allHistory, error: historyError } = await supabaseAdmin
      .from('grade_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    // Find duplicates in grades
    const gradesSeen = new Map<string, any>();
    const gradesDuplicates: any[] = [];

    for (const grade of allGrades || []) {
      const key = `${grade.student_id}-${grade.course_id}-${grade.quarter_id}`;
      
      if (gradesSeen.has(key)) {
        gradesDuplicates.push(grade);
      } else {
        gradesSeen.set(key, grade);
      }
    }

    // Find duplicates in grade_history
    // A duplicate is same student_id, course_id, quarter_id, from_grade, to_grade
    const historySeen = new Map<string, any>();
    const historyDuplicates: any[] = [];

    for (const history of allHistory || []) {
      const key = `${history.student_id}-${history.course_id}-${history.quarter_id}-${history.from_grade}-${history.to_grade}`;
      
      if (historySeen.has(key)) {
        historyDuplicates.push(history);
      } else {
        historySeen.set(key, history);
      }
    }

    return NextResponse.json({
      grades: {
        total: allGrades?.length || 0,
        unique: gradesSeen.size,
        duplicatesFound: gradesDuplicates.length,
        duplicates: gradesDuplicates.slice(0, 50).map(d => ({
          id: d.id,
          student_id: d.student_id,
          course_id: d.course_id,
          quarter_id: d.quarter_id,
          grade: d.grade,
          created_at: d.created_at
        }))
      },
      gradeHistory: {
        total: allHistory?.length || 0,
        unique: historySeen.size,
        duplicatesFound: historyDuplicates.length,
        duplicates: historyDuplicates.slice(0, 50).map(d => ({
          id: d.id,
          student_id: d.student_id,
          course_id: d.course_id,
          quarter_id: d.quarter_id,
          from_grade: d.from_grade,
          to_grade: d.to_grade,
          created_at: d.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    let gradesDeleted = 0;
    let historyDeleted = 0;

    // 1. Clean up grades table
    const { data: allGrades, error: gradesError } = await supabaseAdmin
      .from('grades')
      .select('*')
      .order('created_at', { ascending: false });

    if (!gradesError && allGrades) {
      const gradesSeen = new Map<string, any>();
      const gradesDuplicateIds: string[] = [];

      for (const grade of allGrades) {
        const key = `${grade.student_id}-${grade.course_id}-${grade.quarter_id}`;
        
        if (gradesSeen.has(key)) {
          gradesDuplicateIds.push(grade.id);
        } else {
          gradesSeen.set(key, grade);
        }
      }

      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < gradesDuplicateIds.length; i += batchSize) {
        const batch = gradesDuplicateIds.slice(i, i + batchSize);
        const { error } = await supabaseAdmin
          .from('grades')
          .delete()
          .in('id', batch);

        if (!error) {
          gradesDeleted += batch.length;
        }
      }
    }

    // 2. Clean up grade_history table
    const { data: allHistory, error: historyError } = await supabaseAdmin
      .from('grade_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (!historyError && allHistory) {
      const historySeen = new Map<string, any>();
      const historyDuplicateIds: string[] = [];

      for (const history of allHistory) {
        const key = `${history.student_id}-${history.course_id}-${history.quarter_id}-${history.from_grade}-${history.to_grade}`;
        
        if (historySeen.has(key)) {
          historyDuplicateIds.push(history.id);
        } else {
          historySeen.set(history, history);
        }
      }

      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < historyDuplicateIds.length; i += batchSize) {
        const batch = historyDuplicateIds.slice(i, i + batchSize);
        const { error } = await supabaseAdmin
          .from('grade_history')
          .delete()
          .in('id', batch);

        if (!error) {
          historyDeleted += batch.length;
        }
      }
    }

    return NextResponse.json({
      message: 'Duplicates removed successfully',
      gradesDeleted,
      historyDeleted,
      totalDeleted: gradesDeleted + historyDeleted
    });
  } catch (error) {
    console.error('Error removing duplicates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
