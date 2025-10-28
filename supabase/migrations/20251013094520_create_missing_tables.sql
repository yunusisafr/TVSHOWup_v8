/*
  # Create Missing Critical Tables

  1. New Tables
    - `share_lists` - User-created content lists
    - `share_list_items` - Items in share lists
    - `static_pages` - CMS static pages
    - `admin_users` - Admin user management
    - `contact_messages` - Contact form submissions

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies
*/

-- Share Lists table
CREATE TABLE IF NOT EXISTS share_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  slug VARCHAR(255) UNIQUE,
  name_translations JSONB,
  description_translations JSONB,
  auto_translate BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Share List Items table
CREATE TABLE IF NOT EXISTS share_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES share_lists(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  order_index INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, content_id, content_type)
);

-- Static Pages table
CREATE TABLE IF NOT EXISTS static_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  meta_description TEXT,
  is_published BOOLEAN DEFAULT false,
  title_translations JSONB,
  content_translations JSONB,
  meta_description_translations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Admin Users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'editor',
  permissions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE share_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE static_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for share_lists
CREATE POLICY "Users can view their own lists"
  ON share_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published public lists"
  ON share_lists FOR SELECT
  TO public
  USING (is_public = true AND is_published = true);

CREATE POLICY "Users can create their own lists"
  ON share_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON share_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
  ON share_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for share_list_items
CREATE POLICY "Users can view items in their lists"
  ON share_list_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM share_lists
    WHERE share_lists.id = share_list_items.list_id
    AND share_lists.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can view items in published public lists"
  ON share_list_items FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM share_lists
    WHERE share_lists.id = share_list_items.list_id
    AND share_lists.is_public = true
    AND share_lists.is_published = true
  ));

CREATE POLICY "Users can add items to their lists"
  ON share_list_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM share_lists
    WHERE share_lists.id = share_list_items.list_id
    AND share_lists.user_id = auth.uid()
  ));

CREATE POLICY "Users can update items in their lists"
  ON share_list_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM share_lists
    WHERE share_lists.id = share_list_items.list_id
    AND share_lists.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM share_lists
    WHERE share_lists.id = share_list_items.list_id
    AND share_lists.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their lists"
  ON share_list_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM share_lists
    WHERE share_lists.id = share_list_items.list_id
    AND share_lists.user_id = auth.uid()
  ));

-- RLS Policies for static_pages
CREATE POLICY "Anyone can view published pages"
  ON static_pages FOR SELECT
  TO public
  USING (is_published = true);

CREATE POLICY "Admins can manage all pages"
  ON static_pages FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

-- RLS Policies for admin_users
CREATE POLICY "Admins can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Admins can manage admin users"
  ON admin_users FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND role = 'admin'
  ));

-- RLS Policies for contact_messages
CREATE POLICY "Users can create contact messages"
  ON contact_messages FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can view all contact messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Admins can update contact messages"
  ON contact_messages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_share_lists_user_id ON share_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_share_lists_public ON share_lists(is_public, is_published) WHERE is_public = true AND is_published = true;
CREATE INDEX IF NOT EXISTS idx_share_lists_slug ON share_lists(slug);
CREATE INDEX IF NOT EXISTS idx_share_list_items_list_id ON share_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_share_list_items_content ON share_list_items(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_static_pages_slug ON static_pages(slug);
CREATE INDEX IF NOT EXISTS idx_static_pages_published ON static_pages(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);