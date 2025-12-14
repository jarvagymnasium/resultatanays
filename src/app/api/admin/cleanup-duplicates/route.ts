import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client with service role for cleanup operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET() {
  try {
    // Find all duplicate grades (same student_id, course_id, quarter_id, grade, grade_type)
    const { data: allGrades, error: fetchError } = await supabaseAdmin
      .from('grades')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Group by unique combination
    const seen = new Map<string, any>();
    const duplicates: any[] = [];

    for (const grade of allGrades || []) {
      const key = `${grade.student_id}-${grade.course_id}-${grade.quarter_id}`;
      
      if (seen.has(key)) {
        // This is a duplicate - mark for deletion (keep the first one we saw, which is newest due to ordering)
        duplicates.push(grade);
      } else {
        seen.set(key, grade);
      }
    }

    return NextResponse.json({
      totalGrades: allGrades?.length || 0,
      uniqueGrades: seen.size,
      duplicatesFound: duplicates.length,
      duplicates: duplicates.map(d => ({
        id: d.id,
        student_id: d.student_id,
        course_id: d.course_id,
        quarter_id: d.quarter_id,
        grade: d.grade,
        created_at: d.created_at
      }))
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Find all grades
    const { data: allGrades, error: fetchError } = await supabaseAdmin
      .from('grades')
      .select('*')
      .order('created_at', { ascending: false }); // Newest first

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Group by unique combination and find duplicates
    const seen = new Map<string, any>();
    const duplicateIds: string[] = [];

    for (const grade of allGrades || []) {
      const key = `${grade.student_id}-${grade.course_id}-${grade.quarter_id}`;
      
      if (seen.has(key)) {
        // This is a duplicate - mark for deletion
        duplicateIds.push(grade.id);
      } else {
        seen.set(key, grade);
      }
    }

    if (duplicateIds.length === 0) {
      return NextResponse.json({
        message: 'No duplicates found',
        deleted: 0
      });
    }

    // Delete duplicates in batches
    let deletedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < duplicateIds.length; i += batchSize) {
      const batch = duplicateIds.slice(i, i + batchSize);
      const { error: deleteError } = await supabaseAdmin
        .from('grades')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error('Error deleting batch:', deleteError);
      } else {
        deletedCount += batch.length;
      }
    }

    return NextResponse.json({
      message: 'Duplicates removed successfully',
      totalBefore: allGrades?.length || 0,
      duplicatesRemoved: deletedCount,
      totalAfter: (allGrades?.length || 0) - deletedCount
    });
  } catch (error) {
    console.error('Error removing duplicates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

