import { NextRequest, NextResponse } from 'next/server';
import { findContentById } from '@/infra/supabase/repositories/content.repository';
import { deleteFromR2 } from '@/infra/r2/client';
import { supabase } from '@/infra/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const content = await findContentById(id);

    if (!content) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json(content);
  } catch (error) {
    console.error('Error fetching video:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const content = await findContentById(id);
    if (!content) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // 1. Delete R2 files first
    const r2Keys = [
      content.original_video_r2_key,
      content.processed_video_r2_key,
      content.thumbnail_r2_key,
    ].filter((k): k is string => Boolean(k));

    if (r2Keys.length > 0) {
      await deleteFromR2(r2Keys);
    }

    // 2. Delete from database
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, deletedR2Files: r2Keys.length });
  } catch (error) {
    console.error('Error deleting content:', error);
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
  }
}
