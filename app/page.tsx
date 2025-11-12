import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="gradient-bg text-white py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-6xl mb-6">⚡</div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            AI YouTube Chapters
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90 max-w-3xl mx-auto">
            Instantly add chapters to any YouTube video. Earn free credits by sharing with others.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Add to Chrome - Free
            </a>
            <Link
              href="#how-it-works"
              className="border-2 border-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white hover:text-purple-600 transition-all"
            >
              Learn More
            </Link>
          </div>

          <div className="flex flex-wrap gap-6 justify-center text-sm opacity-90">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✓</span>
              <span>5 Free Credits on Signup</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✓</span>
              <span>Earn Credits by Sharing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✓</span>
              <span>Instant Results</span>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">See It In Action</h2>
          <div className="aspect-video bg-gray-200 rounded-xl flex items-center justify-center">
            <p className="text-gray-500">[Demo video placeholder]</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="text-2xl font-bold mb-3">1. Watch Video</h3>
              <p className="text-gray-600">
                Find any YouTube video you want to chapterize
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold mb-3">2. Click Chapterize</h3>
              <p className="text-gray-600">
                AI analyzes the video and creates perfect chapters in seconds
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-2xl font-bold mb-3">3. Share & Earn</h3>
              <p className="text-gray-600">
                Post as a comment and earn +2 credits back!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Credit Economy */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Smart Credit Economy</h2>
          <p className="text-center text-gray-600 mb-16 text-lg">
            Use credits to chapterize videos. Earn them back by sharing!
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold mb-6 gradient-text">Cost to Chapterize</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Short videos (&lt;15 min)</span>
                  <span className="font-bold text-xl">1 credit</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg">Medium videos (15-60 min)</span>
                  <span className="font-bold text-xl">2 credits</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg">Long videos (60+ min)</span>
                  <span className="font-bold text-xl">3 credits</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold mb-6 gradient-text">Earn Free Credits</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Sign up bonus</span>
                  <span className="font-bold text-xl text-green-600">+5 credits</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg">Post chapter comment</span>
                  <span className="font-bold text-xl text-green-600">+2 credits</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg">Referral signup</span>
                  <span className="font-bold text-xl text-green-600">+10 credits</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg text-gray-700 mb-6">
              💡 <strong>Viral Loop:</strong> Chapterize (spend 1-3) → Post comment (earn +2) = Net positive or break even!
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Need More Credits?</h2>
          <p className="text-center text-gray-600 mb-16 text-lg">
            Purchase credit packages for unlimited chapterizing
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 hover:border-purple-500 transition-all">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <div className="text-3xl font-bold mb-2">$5</div>
              <div className="text-gray-600 mb-4">25 credits</div>
              <div className="text-sm text-gray-500">~10 hours of content</div>
            </div>

            <div className="bg-white p-6 rounded-xl border-4 border-purple-500 relative transform scale-105">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                MOST POPULAR
              </div>
              <h3 className="text-xl font-bold mb-2">Popular</h3>
              <div className="text-3xl font-bold mb-2">$10</div>
              <div className="text-gray-600 mb-4">60 credits</div>
              <div className="text-sm text-gray-500">~25 hours of content</div>
            </div>

            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 hover:border-purple-500 transition-all">
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-2">$25</div>
              <div className="text-gray-600 mb-4">150 credits</div>
              <div className="text-sm text-gray-500">~60 hours of content</div>
            </div>

            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 hover:border-purple-500 transition-all">
              <h3 className="text-xl font-bold mb-2">Ultimate</h3>
              <div className="text-3xl font-bold mb-2">$50</div>
              <div className="text-gray-600 mb-4">350 credits</div>
              <div className="text-sm text-gray-500">~140 hours of content</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Why Chaptr?</h2>

          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-3">Instant Results</h3>
              <p className="text-gray-600">
                Already chapterized videos load instantly from our cache. No waiting!
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold mb-3">AI-Powered</h3>
              <p className="text-gray-600">
                Advanced AI analyzes transcripts to create perfect chapter breakpoints
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-xl font-bold mb-3">Viral Growth</h3>
              <p className="text-gray-600">
                Every comment you post helps others discover Chaptr and earns you credits
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold mb-3">Earn Free Credits</h3>
              <p className="text-gray-600">
                Unlimited earning potential by sharing chapters with the community
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-3">Perfect Accuracy</h3>
              <p className="text-gray-600">
                Smart chapter detection finds natural topic transitions in any video
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-bold mb-3">Works Everywhere</h3>
              <p className="text-gray-600">
                Simple Chrome extension that works on any YouTube video page
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-bg text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Start Chapterizing Today
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of users creating better YouTube experiences
          </p>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-purple-600 px-10 py-5 rounded-lg font-bold text-xl hover:shadow-2xl transition-all transform hover:scale-105"
          >
            Add to Chrome - Free
          </a>
          <p className="mt-6 text-sm opacity-80">
            Get 5 free credits instantly • No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-bold text-lg mb-2">Chaptr</h3>
              <p className="text-sm text-gray-400">AI YouTube Chapters</p>
            </div>

            <div>
              <h4 className="font-bold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#how-it-works">How It Works</Link></li>
                <li><Link href="/credits">Pricing</Link></li>
                <li><Link href="/welcome">Get Started</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/docs">Documentation</Link></li>
                <li><Link href="/support">Support</Link></li>
                <li><Link href="/blog">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 Chaptr. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
