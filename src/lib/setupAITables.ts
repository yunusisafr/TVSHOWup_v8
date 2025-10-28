import { supabase } from './supabase';

export async function setupAITables() {
  console.log('🔧 Setting up AI chat tables...');

  try {
    // Note: These SQL commands will be executed by the service role key
    // For production, you should run these migrations through Supabase CLI
    // This is a temporary workaround for development

    const setupSQL = `
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
`;

    console.log('⚠️ AI chat tables need to be created manually in Supabase Dashboard');
    console.log('📝 Please run the migration file: supabase/migrations/20251016160000_create_ai_discovery_chat_schema.sql');
    console.log('Or copy the SQL from the console and run it in Supabase SQL Editor');

    return {
      success: false,
      message: 'Tables need to be created via Supabase Dashboard or CLI',
      sql: setupSQL
    };
  } catch (error) {
    console.error('Error setting up AI tables:', error);
    throw error;
  }
}
