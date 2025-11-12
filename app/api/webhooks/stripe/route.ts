import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'payment_intent.succeeded': {
        console.log('Payment succeeded:', event.data.object.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        console.log('Payment failed:', event.data.object.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle completed checkout session
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { user_id, credits } = session.metadata as { user_id: string; credits: string };

  if (!user_id || !credits) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  const creditsAmount = parseInt(credits);

  // Award credits using transaction function
  const { error: txError } = await supabaseAdmin
    .rpc('record_credit_transaction', {
      p_user_id: user_id,
      p_amount: creditsAmount,
      p_transaction_type: 'purchase',
      p_stripe_payment_id: session.payment_intent as string,
      p_metadata: JSON.stringify({
        session_id: session.id,
        amount_paid: session.amount_total,
        currency: session.currency
      })
    });

  if (txError) {
    console.error('Failed to award purchased credits:', txError);
    // Log for manual review
    console.error(`MANUAL REVIEW NEEDED: User ${user_id} paid for ${creditsAmount} credits (session: ${session.id}) but credit award failed`);
    return;
  }

  console.log(`Successfully awarded ${creditsAmount} credits to user ${user_id} for payment ${session.payment_intent}`);
}
