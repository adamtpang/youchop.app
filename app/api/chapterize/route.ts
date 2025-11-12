import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chapterizeVideo, calculateCreditCost } from '@/lib/chapterize';
import { getVideoDetails } from '@/lib/youtube';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { video_id, user_id, duration_seconds } = body;

    // Validate inputs
    if (!video_id || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: video_id, user_id' },
        { status: 400 }
      );
    }

    // Check if video is already chapterized (cache hit)
    const { data: cachedVideo, error: cacheError } = await supabaseAdmin
      .from('chapterized_videos')
      .select('*')
      .eq('video_id', video_id)
      .single();

    if (cachedVideo && !cacheError) {
      // Cache hit! Update access stats and return instantly
      await supabaseAdmin
        .from('chapterized_videos')
        .update({
          times_accessed: cachedVideo.times_accessed + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('video_id', video_id);

      // Record user interaction (0 credits spent)
      await supabaseAdmin
        .from('user_video_interactions')
        .upsert({
          user_id,
          video_id,
          chapterized: true,
          credits_spent: 0
        });

      // Get user's current credits
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('credits_balance')
        .eq('id', user_id)
        .single();

      return NextResponse.json({
        success: true,
        chapters: cachedVideo.chapters,
        video_title: cachedVideo.title,
        credits_remaining: user?.credits_balance || 0,
        was_cached: true,
        message: 'Video already chapterized! Loaded instantly from cache.'
      });
    }

    // Cache miss - need to chapterize
    // Get user and check credits
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate credit cost
    const creditCost = calculateCreditCost(duration_seconds);

    // Check if user has enough credits
    if (user.credits_balance < creditCost) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: creditCost,
          current: user.credits_balance,
          needed: creditCost - user.credits_balance
        },
        { status: 402 }
      );
    }

    // Get video details from YouTube API
    let videoTitle = 'Unknown Video';
    let videoDuration = duration_seconds;

    try {
      const videoDetails = await getVideoDetails(video_id);
      videoTitle = videoDetails.title;
      videoDuration = videoDetails.duration;
    } catch (error) {
      console.error('Failed to fetch video details:', error);
      // Continue with provided duration
    }

    // Chapterize the video
    const { chapters, transcript_source } = await chapterizeVideo(
      video_id,
      videoTitle,
      videoDuration
    );

    // Deduct credits using transaction function
    const { data: txResult, error: txError } = await supabaseAdmin
      .rpc('record_credit_transaction', {
        p_user_id: user_id,
        p_amount: -creditCost,
        p_transaction_type: 'chapterize',
        p_video_id: video_id,
        p_metadata: JSON.stringify({
          video_title: videoTitle,
          duration_seconds: videoDuration,
          chapters_count: chapters.length
        })
      });

    if (txError) {
      console.error('Transaction error:', txError);
      throw new Error('Failed to process credit transaction');
    }

    // Save chapterized video to database
    const { error: saveError } = await supabaseAdmin
      .from('chapterized_videos')
      .insert({
        video_id,
        title: videoTitle,
        duration_seconds: videoDuration,
        chapters,
        transcript_source,
        times_accessed: 1,
        comments_posted: 0
      });

    if (saveError) {
      console.error('Failed to save chapterized video:', saveError);
      // Don't fail the request, user already paid credits
    }

    // Record user interaction
    await supabaseAdmin
      .from('user_video_interactions')
      .upsert({
        user_id,
        video_id,
        chapterized: true,
        credits_spent: creditCost
      });

    return NextResponse.json({
      success: true,
      chapters,
      video_title: videoTitle,
      credits_remaining: txResult.new_balance,
      was_cached: false,
      credits_spent: creditCost
    });

  } catch (error: any) {
    console.error('Chapterize API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to chapterize video' },
      { status: 500 }
    );
  }
}
