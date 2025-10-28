/*
  # Add Contact Messages Table

  1. New Table
    - `contact_messages` - Store contact form submissions
    - Track user information, message content, and status
    - Enable admin management of contact messages

  2. Security
    - Enable RLS on the table
    - Allow authenticated users to submit messages
    - Allow anonymous users to submit messages
    - Allow admins to view and manage all messages
*/

-- Create contact_messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow authenticated users to submit contact messages
CREATE POLICY "Authenticated users can submit contact messages"
  ON contact_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to submit contact messages
CREATE POLICY "Anonymous users can submit contact messages"
  ON contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow users to view their own messages
CREATE POLICY "Users can view their own contact messages"
  ON contact_messages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow admins to view and manage all messages
CREATE POLICY "Admins can manage all contact messages"
  ON contact_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_contact_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_messages_updated_at
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_messages_updated_at();

-- Create indexes for performance
CREATE INDEX idx_contact_messages_user_id ON contact_messages(user_id);
CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- Update table statistics
ANALYZE contact_messages;