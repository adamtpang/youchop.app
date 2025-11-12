import { NextRequest, NextResponse } from 'next/server';
import { calculateCreditCost } from '@/lib/chapterize';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const durationParam = searchParams.get('video_duration_seconds');

    if (!durationParam) {
      return NextResponse.json(
        { error: 'Missing video_duration_seconds parameter' },
        { status: 400 }
      );
    }

    const durationSeconds = parseInt(durationParam);

    if (isNaN(durationSeconds) || durationSeconds <= 0) {
      return NextResponse.json(
        { error: 'Invalid duration value' },
        { status: 400 }
      );
    }

    const creditsRequired = calculateCreditCost(durationSeconds);

    // Calculate hours of content per credit for pricing info
    const hoursPerCredit = durationSeconds / 3600 / creditsRequired;

    return NextResponse.json({
      credits_required: creditsRequired,
      duration_seconds: durationSeconds,
      duration_minutes: Math.round(durationSeconds / 60),
      hours_of_content_per_credit: hoursPerCredit.toFixed(2)
    });

  } catch (error: any) {
    console.error('Estimate API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate estimate' },
      { status: 500 }
    );
  }
}
