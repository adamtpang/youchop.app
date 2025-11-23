"use client"

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MotionWrapper, StaggerContainer } from '@/components/motion-wrapper';
import { Zap, Video, MessageSquare, Sparkles, Target, Globe, DollarSign, Clock, Check } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet via-sky to-teal py-24 px-6">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-6xl mx-auto text-center text-white z-10">
          <MotionWrapper variant="scaleIn">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-6">
              <Zap className="h-12 w-12" />
            </div>
          </MotionWrapper>

          <MotionWrapper variant="fadeIn" delay={0.1}>
            <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
              YouChop
            </h1>
          </MotionWrapper>

          <MotionWrapper variant="fadeIn" delay={0.2}>
            <p className="text-xl md:text-2xl mb-10 opacity-95 max-w-3xl mx-auto leading-relaxed">
              Chop any YouTube video into AI-powered chapters. Instant navigation, perfect timestamps.
            </p>
          </MotionWrapper>

          <MotionWrapper variant="fadeIn" delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button
                asChild
                size="lg"
                className="bg-white text-violet hover:bg-white/90 hover:scale-105 transition-transform text-lg px-8 py-6 h-auto"
              >
                <a
                  href="https://chrome.google.com/webstore"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Zap className="mr-2 h-5 w-5" />
                  Add to Chrome - Free
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-2 border-white text-white hover:bg-white hover:text-violet transition-colors text-lg px-8 py-6 h-auto"
              >
                <Link href="#how-it-works">
                  Learn More
                </Link>
              </Button>
            </div>
          </MotionWrapper>

          <MotionWrapper variant="fadeIn" delay={0.4}>
            <div className="flex flex-wrap gap-6 justify-center text-sm">
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 px-4 py-2">
                <Check className="mr-2 h-4 w-4" />
                5 Free Credits on Signup
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 px-4 py-2">
                <Check className="mr-2 h-4 w-4" />
                Earn Credits by Sharing
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 px-4 py-2">
                <Check className="mr-2 h-4 w-4" />
                Instant Results
              </Badge>
            </div>
          </MotionWrapper>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <MotionWrapper variant="fadeIn">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-900">See It In Action</h2>
          </MotionWrapper>
          <MotionWrapper variant="scaleIn" delay={0.1}>
            <Card className="overflow-hidden border-2 shadow-2xl">
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Demo video coming soon</p>
                </div>
              </div>
            </Card>
          </MotionWrapper>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <MotionWrapper variant="fadeIn">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-6 text-gray-900">How It Works</h2>
            <p className="text-center text-gray-700 mb-16 text-lg max-w-2xl mx-auto">
              Three simple steps to transform any YouTube video with AI-powered chapters
            </p>
          </MotionWrapper>

          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            <MotionWrapper variant="fadeIn">
              <Card className="h-full text-center hover:shadow-xl transition-shadow border-2 hover:border-sky">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 bg-sky/10 rounded-xl flex items-center justify-center mb-4">
                    <Video className="h-8 w-8 text-sky" />
                  </div>
                  <Badge className="mb-4 mx-auto bg-sky text-white">Step 1</Badge>
                  <CardTitle className="text-2xl">Watch Video</CardTitle>
                  <CardDescription className="text-base">
                    Find any YouTube video you want to chapterize
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="fadeIn">
              <Card className="h-full text-center hover:shadow-xl transition-shadow border-2 hover:border-violet">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 bg-violet/10 rounded-xl flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-violet" />
                  </div>
                  <Badge className="mb-4 mx-auto bg-violet text-white">Step 2</Badge>
                  <CardTitle className="text-2xl">Click Chapterize</CardTitle>
                  <CardDescription className="text-base">
                    AI analyzes the video and creates perfect chapters in seconds
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="fadeIn">
              <Card className="h-full text-center hover:shadow-xl transition-shadow border-2 hover:border-teal">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 bg-teal/10 rounded-xl flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-teal" />
                  </div>
                  <Badge className="mb-4 mx-auto bg-teal text-white">Step 3</Badge>
                  <CardTitle className="text-2xl">Share & Earn</CardTitle>
                  <CardDescription className="text-base">
                    Post as a comment and earn +2 credits back instantly
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>
          </StaggerContainer>
        </div>
      </section>

      {/* Credit Economy */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <MotionWrapper variant="fadeIn">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-gray-900">Smart Credit Economy</h2>
            <p className="text-center text-gray-700 mb-16 text-lg max-w-2xl mx-auto">
              Use credits to chapterize videos. Earn them back by sharing with the community!
            </p>
          </MotionWrapper>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <MotionWrapper variant="slideInFromLeft">
              <Card className="h-full border-2 hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-coral/10 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-coral" />
                    </div>
                    <CardTitle className="text-2xl">Cost to Chapterize</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <span className="text-lg">Short videos (&lt;15 min)</span>
                    </div>
                    <Badge className="bg-coral text-white">1 credit</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <span className="text-lg">Medium (15-60 min)</span>
                    </div>
                    <Badge className="bg-coral text-white">2 credits</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <span className="text-lg">Long videos (60+ min)</span>
                    </div>
                    <Badge className="bg-coral text-white">3 credits</Badge>
                  </div>
                </CardContent>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="slideInFromRight">
              <Card className="h-full border-2 hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-teal/10 rounded-lg flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-teal" />
                    </div>
                    <CardTitle className="text-2xl">Earn Free Credits</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-lg">Sign up bonus</span>
                    <Badge className="bg-teal text-white">+5 credits</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-lg">Post chapter comment</span>
                    <Badge className="bg-teal text-white">+2 credits</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-lg">Referral signup</span>
                    <Badge className="bg-teal text-white">+10 credits</Badge>
                  </div>
                </CardContent>
              </Card>
            </MotionWrapper>
          </div>

          <MotionWrapper variant="fadeIn">
            <Card className="bg-gradient-to-r from-amber/10 to-amber/5 border-2 border-amber">
              <CardContent className="pt-6">
                <p className="text-lg text-center">
                  <Sparkles className="inline h-6 w-6 text-amber mr-2" />
                  <strong>Viral Loop:</strong> Chapterize (spend 1-3) → Post comment (earn +2) = Net positive or break even!
                </p>
              </CardContent>
            </Card>
          </MotionWrapper>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto">
          <MotionWrapper variant="fadeIn">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-900">Why YouChop?</h2>
          </MotionWrapper>

          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            <MotionWrapper variant="fadeIn">
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-sky/10 rounded-lg flex items-center justify-center mb-4">
                    <Zap className="h-6 w-6 text-sky" />
                  </div>
                  <CardTitle>Instant Results</CardTitle>
                  <CardDescription>
                    Already chapterized videos load instantly from our cache. No waiting!
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="fadeIn">
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-violet/10 rounded-lg flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-violet" />
                  </div>
                  <CardTitle>AI-Powered</CardTitle>
                  <CardDescription>
                    Advanced AI analyzes transcripts to create perfect chapter breakpoints
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="fadeIn">
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-teal/10 rounded-lg flex items-center justify-center mb-4">
                    <MessageSquare className="h-6 w-6 text-teal" />
                  </div>
                  <CardTitle>Viral Growth</CardTitle>
                  <CardDescription>
                    Every comment you post helps others discover YouChop and earns you credits
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="fadeIn">
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-amber/10 rounded-lg flex items-center justify-center mb-4">
                    <DollarSign className="h-6 w-6 text-amber" />
                  </div>
                  <CardTitle>Earn Free Credits</CardTitle>
                  <CardDescription>
                    Unlimited earning potential by sharing chapters with the community
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="fadeIn">
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-coral/10 rounded-lg flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-coral" />
                  </div>
                  <CardTitle>Perfect Accuracy</CardTitle>
                  <CardDescription>
                    Smart chapter detection finds natural topic transitions in any video
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>

            <MotionWrapper variant="fadeIn">
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-sky/10 rounded-lg flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6 text-sky" />
                  </div>
                  <CardTitle>Works Everywhere</CardTitle>
                  <CardDescription>
                    Simple Chrome extension that works on any YouTube video page
                  </CardDescription>
                </CardHeader>
              </Card>
            </MotionWrapper>
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet via-sky to-teal py-24 px-6">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-4xl mx-auto text-center text-white z-10">
          <MotionWrapper variant="scaleIn">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Start Chapterizing Today
            </h2>
          </MotionWrapper>
          <MotionWrapper variant="fadeIn" delay={0.1}>
            <p className="text-xl mb-10 opacity-95 max-w-2xl mx-auto">
              Join thousands of users creating better YouTube experiences
            </p>
          </MotionWrapper>
          <MotionWrapper variant="fadeIn" delay={0.2}>
            <Button
              asChild
              size="lg"
              className="bg-white text-violet hover:bg-white/90 hover:scale-105 transition-transform text-xl px-12 py-8 h-auto"
            >
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Zap className="mr-3 h-6 w-6" />
                Add to Chrome - Free
              </a>
            </Button>
          </MotionWrapper>
          <MotionWrapper variant="fadeIn" delay={0.3}>
            <p className="mt-6 text-sm opacity-90">
              Get 5 free credits instantly • No credit card required
            </p>
          </MotionWrapper>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-violet to-sky rounded-lg flex items-center justify-center">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-xl">YouChop</h3>
              </div>
              <p className="text-sm text-gray-400">AI YouTube Chapters</p>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-lg">Product</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                <li><Link href="/credits" className="hover:text-white transition-colors">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-lg">Extension</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Chrome Web Store</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-lg">Connect</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="text-gray-500">Coming soon</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 YouChop. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
