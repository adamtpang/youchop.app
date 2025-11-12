import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }

    // Get user data
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('credits_balance, total_credits_earned, total_credits_spent, videos_chapterized, comments_posted')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      balance: user.credits_balance,
      earned_lifetime: user.total_credits_earned,
      spent_lifetime: user.total_credits_spent,
      videos_chapterized: user.videos_chapterized,
      comments_posted: user.comments_posted
    });

  } catch (error: any) {
    console.error('Get credits API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}
