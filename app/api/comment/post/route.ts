import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { postComment, formatChapterComment } from '@/lib/youtube';

const COMMENT_CREDIT_REWARD = 2;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { video_id, user_id, chapters, youtube_token } = body;

    // Validate inputs
    if (!video_id || !user_id || !chapters || !youtube_token) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already posted comment for this video
    const { data: interaction } = await supabaseAdmin
      .from('user_video_interactions')
      .select('comment_posted')
      .eq('user_id', user_id)
      .eq('video_id', video_id)
      .single();

    if (interaction?.comment_posted) {
      return NextResponse.json(
        { error: 'You already posted a comment for this video' },
        { status: 400 }
      );
    }

    // Format comment text
    const commentText = formatChapterComment(chapters);

    // Post comment to YouTube
    await postComment(video_id, commentText, youtube_token);

    // Award credits using transaction function
    const { data: txResult, error: txError } = await supabaseAdmin
      .rpc('record_credit_transaction', {
        p_user_id: user_id,
        p_amount: COMMENT_CREDIT_REWARD,
        p_transaction_type: 'comment_posted',
        p_video_id: video_id,
        p_metadata: JSON.stringify({
          chapters_count: chapters.length
        })
      });

    if (txError) {
      console.error('Transaction error:', txError);
      // Comment was posted but credit award failed - log for manual review
      console.error(`MANUAL REVIEW NEEDED: User ${user_id} posted comment for video ${video_id} but credit award failed`);
    }

    // Update user interaction
    await supabaseAdmin
      .from('user_video_interactions')
      .upsert({
        user_id,
        video_id,
        comment_posted: true,
        credits_earned: COMMENT_CREDIT_REWARD
      });

    // Update chapterized video stats
    try {
      await supabaseAdmin
        .rpc('increment', {
          table_name: 'chapterized_videos',
          column_name: 'comments_posted',
          filter_column: 'video_id',
          filter_value: video_id
        });
    } catch (err) {
      // Non-critical error, just log
      console.error('Failed to update video comment count:', err);
    }

    return NextResponse.json({
      success: true,
      new_credit_balance: txResult?.new_balance || 0,
      credits_earned: COMMENT_CREDIT_REWARD,
      message: `Comment posted successfully! You earned ${COMMENT_CREDIT_REWARD} credits.`
    });

  } catch (error: any) {
    console.error('Comment post API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post comment' },
      { status: 500 }
    );
  }
}
