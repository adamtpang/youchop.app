-- Chaptr Database Schema
-- Migration: Initial schema with credit economy

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE transcript_source_type AS ENUM ('youtube_native', 'whisper_generated');
CREATE TYPE transaction_type AS ENUM ('signup_bonus', 'chapterize', 'comment_posted', 'referral', 'purchase');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  credits_balance INTEGER NOT NULL DEFAULT 5,
  total_credits_earned INTEGER NOT NULL DEFAULT 5,
  total_credits_spent INTEGER NOT NULL DEFAULT 0,
  videos_chapterized INTEGER NOT NULL DEFAULT 0,
  comments_posted INTEGER NOT NULL DEFAULT 0,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  referred_by UUID REFERENCES users(id),
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- Chapterized videos table
CREATE TABLE chapterized_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id VARCHAR(20) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  chapters JSONB NOT NULL,
  transcript_source transcript_source_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  times_accessed INTEGER NOT NULL DEFAULT 1,
  comments_posted INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on video_id for instant lookups
CREATE INDEX idx_chapterized_videos_video_id ON chapterized_videos(video_id);
CREATE INDEX idx_chapterized_videos_created_at ON chapterized_videos(created_at DESC);

-- Credit transactions table
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type transaction_type NOT NULL,
  video_id VARCHAR(20),
  stripe_payment_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transaction queries
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);

-- User video interactions table (tracks which users chapterized which videos)
CREATE TABLE user_video_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) NOT NULL,
  chapterized BOOLEAN DEFAULT FALSE,
  comment_posted BOOLEAN DEFAULT FALSE,
  credits_spent INTEGER DEFAULT 0,
  credits_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, video_id)
);

CREATE INDEX idx_user_video_interactions_user_id ON user_video_interactions(user_id);
CREATE INDEX idx_user_video_interactions_video_id ON user_video_interactions(video_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  -- Generate random 8-character code
  LOOP
    code := UPPER(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  NEW.referral_code := code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code
CREATE TRIGGER generate_user_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL OR NEW.referral_code = '')
  EXECUTE FUNCTION generate_referral_code();

-- Function to handle credit transactions
CREATE OR REPLACE FUNCTION record_credit_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type transaction_type,
  p_video_id VARCHAR(20) DEFAULT NULL,
  p_stripe_payment_id VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Insert transaction record
  INSERT INTO credit_transactions (user_id, amount, transaction_type, video_id, stripe_payment_id, metadata)
  VALUES (p_user_id, p_amount, p_transaction_type, p_video_id, p_stripe_payment_id, p_metadata)
  RETURNING id INTO v_transaction_id;

  -- Update user balance and stats
  UPDATE users
  SET
    credits_balance = credits_balance + p_amount,
    total_credits_earned = total_credits_earned + GREATEST(p_amount, 0),
    total_credits_spent = total_credits_spent + GREATEST(-p_amount, 0),
    videos_chapterized = CASE
      WHEN p_transaction_type = 'chapterize' THEN videos_chapterized + 1
      ELSE videos_chapterized
    END,
    comments_posted = CASE
      WHEN p_transaction_type = 'comment_posted' THEN comments_posted + 1
      ELSE comments_posted
    END
  WHERE id = p_user_id
  RETURNING credits_balance INTO v_new_balance;

  -- Return transaction details
  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get or create chapterized video
CREATE OR REPLACE FUNCTION get_chapterized_video(p_video_id VARCHAR(20))
RETURNS TABLE (
  id UUID,
  video_id VARCHAR(20),
  title TEXT,
  duration_seconds INTEGER,
  chapters JSONB,
  transcript_source transcript_source_type,
  was_cached BOOLEAN,
  times_accessed INTEGER
) AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if video exists
  SELECT EXISTS(SELECT 1 FROM chapterized_videos WHERE chapterized_videos.video_id = p_video_id) INTO v_exists;

  IF v_exists THEN
    -- Update access stats
    UPDATE chapterized_videos
    SET
      times_accessed = times_accessed + 1,
      last_accessed_at = CURRENT_TIMESTAMP
    WHERE chapterized_videos.video_id = p_video_id;

    -- Return cached data
    RETURN QUERY
    SELECT
      cv.id,
      cv.video_id,
      cv.title,
      cv.duration_seconds,
      cv.chapters,
      cv.transcript_source,
      TRUE as was_cached,
      cv.times_accessed
    FROM chapterized_videos cv
    WHERE cv.video_id = p_video_id;
  ELSE
    -- Return empty result indicating need to chapterize
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to award referral bonus
CREATE OR REPLACE FUNCTION award_referral_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- If user was referred, award bonus to referrer
  IF NEW.referred_by IS NOT NULL THEN
    PERFORM record_credit_transaction(
      NEW.referred_by,
      10,
      'referral'::transaction_type,
      NULL,
      NULL,
      jsonb_build_object('referred_user_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to award referral bonus on new user signup
CREATE TRIGGER award_referral_on_signup
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.referred_by IS NOT NULL)
  EXECUTE FUNCTION award_referral_bonus();

-- Insert initial signup bonus transaction for new users
CREATE OR REPLACE FUNCTION record_signup_bonus()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO credit_transactions (user_id, amount, transaction_type)
  VALUES (NEW.id, 5, 'signup_bonus');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record signup bonus
CREATE TRIGGER record_user_signup_bonus
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION record_signup_bonus();

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapterized_videos ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid()::uuid = id);

-- Users can update their own data (except credits, which are managed by functions)
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid()::uuid = id);

-- Users can read their own transactions
CREATE POLICY transactions_select_own ON credit_transactions
  FOR SELECT
  USING (auth.uid()::uuid = user_id);

-- Users can read their own interactions
CREATE POLICY interactions_select_own ON user_video_interactions
  FOR SELECT
  USING (auth.uid()::uuid = user_id);

-- Anyone can read chapterized videos (they're cached for all users)
CREATE POLICY chapterized_videos_select_all ON chapterized_videos
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role has full access (for API operations)
-- This is handled via service role key in backend

-- Create a view for user stats (useful for analytics)
CREATE VIEW user_stats AS
SELECT
  u.id,
  u.email,
  u.credits_balance,
  u.total_credits_earned,
  u.total_credits_spent,
  u.videos_chapterized,
  u.comments_posted,
  u.created_at,
  COUNT(DISTINCT ct.id) as total_transactions,
  COALESCE(SUM(CASE WHEN ct.transaction_type = 'purchase' THEN ct.amount ELSE 0 END), 0) as credits_purchased,
  (SELECT COUNT(*) FROM users WHERE referred_by = u.id) as referrals_made
FROM users u
LEFT JOIN credit_transactions ct ON u.id = ct.user_id
GROUP BY u.id, u.email, u.credits_balance, u.total_credits_earned, u.total_credits_spent,
         u.videos_chapterized, u.comments_posted, u.created_at;

-- Analytics view for video popularity
CREATE VIEW video_stats AS
SELECT
  cv.video_id,
  cv.title,
  cv.duration_seconds,
  cv.times_accessed,
  cv.comments_posted,
  cv.created_at,
  cv.last_accessed_at,
  COUNT(DISTINCT uvi.user_id) as unique_users,
  COALESCE(SUM(uvi.credits_spent), 0) as total_credits_generated
FROM chapterized_videos cv
LEFT JOIN user_video_interactions uvi ON cv.video_id = uvi.video_id
GROUP BY cv.id, cv.video_id, cv.title, cv.duration_seconds, cv.times_accessed,
         cv.comments_posted, cv.created_at, cv.last_accessed_at
ORDER BY cv.times_accessed DESC;
