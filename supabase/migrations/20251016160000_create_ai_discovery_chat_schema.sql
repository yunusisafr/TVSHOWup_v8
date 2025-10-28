/*
  # AI Discovery Chat System Schema

  1. New Tables
    - `ai_chat_conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable for anonymous users)
      - `session_id` (text, for anonymous session tracking)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ai_chat_messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key)
      - `role` (text: 'user' or 'assistant')
      - `content` (text)
      - `extracted_params` (jsonb, stores parsed movie parameters)
      - `results_count` (integer, number of results returned)
      - `created_at` (timestamptz)

    - `ai_query_cache`
      - `id` (uuid, primary key)
      - `query_hash` (text, unique)
      - `original_query` (text)
      - `extracted_params` (jsonb)
      - `results` (jsonb)
      - `hit_count` (integer)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can read/write their own conversations
    - Public read access to query cache for performance

  3. Indexes
    - Index on user_id for fast conversation lookup
    - Index on session_id for anonymous users
    - Index on query_hash for cache lookups
    - Index on expires_at for cache cleanup
*/

-- Create ai_chat_conversations table
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ai_chat_messages table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  extracted_params jsonb DEFAULT '{}',
  results_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create ai_query_cache table
CREATE TABLE IF NOT EXISTS ai_query_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text UNIQUE NOT NULL,
  original_query text NOT NULL,
  extracted_params jsonb DEFAULT '{}',
  results jsonb DEFAULT '[]',
  hit_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON ai_chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON ai_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON ai_query_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON ai_query_cache(expires_at);

-- Enable RLS
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_query_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_conversations
CREATE POLICY "Users can view own conversations"
  ON ai_chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON ai_chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON ai_chat_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can view own session conversations"
  ON ai_chat_conversations FOR SELECT
  TO anon
  USING (session_id IS NOT NULL);

CREATE POLICY "Anonymous users can create session conversations"
  ON ai_chat_conversations FOR INSERT
  TO anon
  WITH CHECK (session_id IS NOT NULL);

-- RLS Policies for ai_chat_messages
CREATE POLICY "Users can view messages in own conversations"
  ON ai_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON ai_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Anonymous users can view session messages"
  ON ai_chat_messages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.session_id IS NOT NULL
    )
  );

CREATE POLICY "Anonymous users can create session messages"
  ON ai_chat_messages FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_chat_conversations
      WHERE ai_chat_conversations.id = ai_chat_messages.conversation_id
      AND ai_chat_conversations.session_id IS NOT NULL
    )
  );

-- RLS Policies for ai_query_cache (public read for performance)
CREATE POLICY "Anyone can read cache"
  ON ai_query_cache FOR SELECT
  TO public
  USING (expires_at > now());

CREATE POLICY "Service role can manage cache"
  ON ai_query_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_query_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
