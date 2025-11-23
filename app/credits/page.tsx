'use client';

import { useState } from 'react';
import Link from 'next/link';

const PACKAGES = [
  { id: 'starter', credits: 25, price: 5, hours: 10, name: 'Starter' },
  { id: 'popular', credits: 60, price: 10, hours: 25, name: 'Popular', featured: true },
  { id: 'pro', credits: 150, price: 25, hours: 60, name: 'Pro' },
  { id: 'ultimate', credits: 350, price: 50, hours: 140, name: 'Ultimate' },
];

export default function CreditsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    setLoading(packageId);

    try {
      // Get user ID from extension storage or auth
      // For now, redirect to installation if not authenticated
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageId,
          user_id: 'USER_ID_HERE' // TODO: Get from auth
        })
      });

      const data = await response.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold gradient-text">
            ⚡ Chaptr
          </Link>
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Purchase Credits</h1>
          <p className="text-xl text-gray-600">
            Choose the perfect credit package for your needs
          </p>
        </div>

        {/* Credit Packages */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-xl p-8 ${
                pkg.featured
                  ? 'border-4 border-purple-500 relative transform scale-105 shadow-xl'
                  : 'border-2 border-gray-200 shadow-lg'
              }`}
            >
              {pkg.featured && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-6 py-1 rounded-full text-sm font-bold">
                  MOST POPULAR
                </div>
              )}

              <h3 className="text-2xl font-bold mb-4">{pkg.name}</h3>
              <div className="text-4xl font-bold mb-2">${pkg.price}</div>
              <div className="text-xl text-gray-600 mb-1">{pkg.credits} credits</div>
              <div className="text-sm text-gray-500 mb-6">~{pkg.hours} hours of content</div>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={loading === pkg.id}
                className={`w-full py-3 rounded-lg font-bold transition-all ${
                  pkg.featured
                    ? 'gradient-bg text-white hover:shadow-xl'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {loading === pkg.id ? 'Processing...' : 'Purchase'}
              </button>
            </div>
          ))}
        </div>

        {/* Earning Section */}
        <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center">
            💡 Or Earn Credits FREE
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-5xl mb-3">🎁</div>
              <h3 className="text-xl font-bold mb-2">Sign Up Bonus</h3>
              <div className="text-3xl font-bold text-green-600 mb-2">+5 credits</div>
              <p className="text-gray-600">Get started instantly with free credits</p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-3">💬</div>
              <h3 className="text-xl font-bold mb-2">Post Comments</h3>
              <div className="text-3xl font-bold text-green-600 mb-2">+2 credits each</div>
              <p className="text-gray-600">Unlimited earning by sharing chapters</p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-3">🤝</div>
              <h3 className="text-xl font-bold mb-2">Refer Friends</h3>
              <div className="text-3xl font-bold text-green-600 mb-2">+10 credits</div>
              <p className="text-gray-600">For each friend who signs up</p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-2">How long do credits last?</h3>
              <p className="text-gray-600">
                Credits never expire! Use them whenever you need.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2">Can I earn unlimited free credits?</h3>
              <p className="text-gray-600">
                Yes! Every time you post chapters as a YouTube comment, you earn +2 credits back.
                There&apos;s no limit to how many you can earn.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2">What if a video is already chapterized?</h3>
              <p className="text-gray-600">
                Great news! If someone already chapterized a video, you can view those chapters
                instantly for FREE. No credits charged!
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2">How do I get my referral code?</h3>
              <p className="text-gray-600">
                Your unique referral code is available in the extension popup. Share it with
                friends and earn +10 credits when they sign up!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
