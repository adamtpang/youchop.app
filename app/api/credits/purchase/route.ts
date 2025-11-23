import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Credit packages
const CREDIT_PACKAGES = {
  starter: { credits: 25, price: 500, name: 'Starter Pack - 25 credits (~10 hours)' },
  popular: { credits: 60, price: 1000, name: 'Popular Pack - 60 credits (~25 hours)' },
  pro: { credits: 150, price: 2500, name: 'Pro Pack - 150 credits (~60 hours)' },
  ultimate: { credits: 350, price: 5000, name: 'Ultimate Pack - 350 credits (~140 hours)' }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { package_id, user_id } = body;

    // Validate inputs
    if (!package_id || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: package_id, user_id' },
        { status: 400 }
      );
    }

    // Get package details
    const packageInfo = CREDIT_PACKAGES[package_id as keyof typeof CREDIT_PACKAGES];

    if (!packageInfo) {
      return NextResponse.json(
        { error: 'Invalid package_id' },
        { status: 400 }
      );
    }

    // Get user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user_id
        }
      });

      customerId = customer.id;

      // Update user with Stripe customer ID
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: packageInfo.name,
              description: `Get ${packageInfo.credits} credits for Chaptr`,
              images: ['https://chaptr.app/logo.png']
            },
            unit_amount: packageInfo.price
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits`,
      metadata: {
        user_id: user_id,
        package_id: package_id,
        credits: packageInfo.credits.toString()
      }
    });

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error: any) {
    console.error('Purchase API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
