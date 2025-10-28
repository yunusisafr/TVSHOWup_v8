/*
  # AI Feedback and Training System

  1. New Tables
    - `ai_query_feedback`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references ai_chat_conversations)
      - `message_id` (uuid, references ai_chat_messages)
      - `user_id` (uuid, references auth.users, nullable)
      - `session_id` (text, nullable)
      - `query` (text) - The original user query
      - `extracted_params` (jsonb) - What AI extracted
      - `feedback_type` (text) - 'positive', 'negative', 'correction'
      - `corrected_params` (jsonb, nullable) - User's correction if any
      - `results_count` (integer) - Number of results returned
      - `user_comment` (text, nullable) - Optional user comment
      - `created_at` (timestamptz)

    - `ai_training_patterns`
      - `id` (uuid, primary key)
      - `query_pattern` (text) - The pattern extracted from queries
      - `expected_params` (jsonb) - Expected parameters for this pattern
      - `confidence_score` (numeric) - How confident we are in this pattern
      - `success_count` (integer) - Number of successful matches
      - `feedback_count` (integer) - Number of feedback received
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can insert their own feedback
    - Only authenticated users can view their feedback
    - Training patterns are read-only for users
*/

-- Create ai_query_feedback table
CREATE TABLE IF NOT EXISTS ai_query_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES ai_chat_messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  query text NOT NULL,
  extracted_params jsonb NOT NULL DEFAULT '{}',
  feedback_type text NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'correction')),
  corrected_params jsonb,
  results_count integer DEFAULT 0,
  user_comment text,
  created_at timestamptz DEFAULT now()
);

-- Create ai_training_patterns table
CREATE TABLE IF NOT EXISTS ai_training_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_pattern text UNIQUE NOT NULL,
  expected_params jsonb NOT NULL DEFAULT '{}',
  confidence_score numeric(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  success_count integer DEFAULT 0,
  feedback_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_feedback_conversation ON ai_query_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_query_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_session ON ai_query_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_query_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON ai_query_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_training_pattern ON ai_training_patterns(query_pattern);
CREATE INDEX IF NOT EXISTS idx_ai_training_confidence ON ai_training_patterns(confidence_score DESC);

-- Enable Row Level Security
ALTER TABLE ai_query_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_patterns ENABLE ROW LEVEL SECURITY;

-- Policies for ai_query_feedback

-- Allow authenticated users to insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON ai_query_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow anonymous users to insert feedback with session_id
CREATE POLICY "Anonymous users can insert feedback"
  ON ai_query_feedback FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);

-- Allow users to view their own feedback
CREATE POLICY "Users can view own feedback"
  ON ai_query_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow service role full access for training
CREATE POLICY "Service role full access to feedback"
  ON ai_query_feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for ai_training_patterns

-- Allow everyone to read training patterns
CREATE POLICY "Everyone can read training patterns"
  ON ai_training_patterns FOR SELECT
  TO public
  USING (true);

-- Only service role can modify training patterns
CREATE POLICY "Service role can modify training patterns"
  ON ai_training_patterns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update training patterns based on feedback
CREATE OR REPLACE FUNCTION update_training_pattern_from_feedback()
RETURNS TRIGGER AS $$
BEGIN
  -- If positive feedback, increase success count
  IF NEW.feedback_type = 'positive' THEN
    INSERT INTO ai_training_patterns (query_pattern, expected_params, success_count, feedback_count)
    VALUES (NEW.query, NEW.extracted_params, 1, 1)
    ON CONFLICT (query_pattern) DO UPDATE SET
      success_count = ai_training_patterns.success_count + 1,
      feedback_count = ai_training_patterns.feedback_count + 1,
      confidence_score = LEAST(1.0, (ai_training_patterns.success_count + 1.0) / (ai_training_patterns.feedback_count + 1.0)),
      updated_at = now();

  -- If negative or correction, just increase feedback count
  ELSIF NEW.feedback_type IN ('negative', 'correction') THEN
    INSERT INTO ai_training_patterns (query_pattern, expected_params, feedback_count)
    VALUES (NEW.query, COALESCE(NEW.corrected_params, NEW.extracted_params), 1)
    ON CONFLICT (query_pattern) DO UPDATE SET
      feedback_count = ai_training_patterns.feedback_count + 1,
      confidence_score = ai_training_patterns.success_count::numeric / (ai_training_patterns.feedback_count + 1.0),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update training patterns
DROP TRIGGER IF EXISTS update_training_on_feedback ON ai_query_feedback;
CREATE TRIGGER update_training_on_feedback
  AFTER INSERT ON ai_query_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_training_pattern_from_feedback();
