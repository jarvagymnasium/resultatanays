import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gradeId = searchParams.get('id');

    if (!gradeId) {
      return NextResponse.json({ error: 'Grade ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('grades')
      .delete()
      .eq('id', gradeId);

    if (error) {
      console.error('Error deleting grade:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: gradeId });
  } catch (error) {
    console.error('Error in delete-grade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

