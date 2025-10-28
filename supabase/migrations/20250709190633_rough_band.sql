/*
  # Static Pages Content Management System

  1. New Tables
    - `static_pages` - Store static page content like About Us, Privacy Policy, etc.
    
  2. Security
    - Enable RLS on static_pages table
    - Add policies for public read access
    - Add policies for admin/editor write access
    
  3. Indexes
    - Add indexes for slug lookups
    - Add full-text search index for content
*/

-- Create static_pages table
CREATE TABLE IF NOT EXISTS static_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  meta_description VARCHAR(255),
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE static_pages ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_static_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_static_pages_updated_at
  BEFORE UPDATE ON static_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_static_pages_updated_at();

-- Create RLS policies
-- Public read access for published pages
CREATE POLICY "Public can read published static pages"
  ON static_pages
  FOR SELECT
  TO public
  USING (is_published = TRUE);

-- Admin users can manage all static pages
CREATE POLICY "Admins can manage static pages"
  ON static_pages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
  );

-- Create indexes
CREATE INDEX idx_static_pages_slug ON static_pages(slug);
CREATE INDEX idx_static_pages_published ON static_pages(is_published);
CREATE INDEX idx_static_pages_search ON static_pages USING gin(to_tsvector('english', title || ' ' || content));

-- Insert default pages
INSERT INTO static_pages (slug, title, content, meta_description, is_published) VALUES
('about-us', 'About Us', '# About TVSHOWup

TVSHOWup is your ultimate destination for discovering where to watch your favorite movies and TV shows across all streaming platforms.

## Our Mission

We aim to simplify the streaming experience by providing a comprehensive database of content availability across multiple streaming services. No more jumping between apps to find what you want to watch!

## How It Works

Our platform aggregates data from various streaming services and presents it in an easy-to-use interface. Simply search for a title, and we''ll show you where it''s available to stream, rent, or buy.

## Contact Us

Have questions or suggestions? [Contact our team](/contact) and we''ll get back to you as soon as possible.', 'Learn about TVSHOWup, your ultimate destination for discovering where to watch movies and TV shows across all streaming platforms.', TRUE),

('privacy-policy', 'Privacy Policy', '# Privacy Policy

Last updated: July 10, 2025

## Introduction

TVSHOWup ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information about you when you use our website and services.

## Information We Collect

### Information You Provide to Us

- **Account Information**: When you create an account, we collect your email address, password, and optional profile information.
- **Content Interactions**: We collect information about your interactions with content, such as adding items to your watchlist or rating movies and TV shows.
- **Communications**: If you contact us directly, we may receive additional information about you, such as your name, email address, and the contents of your message.

### Information We Collect Automatically

- **Usage Information**: We collect information about your interactions with our website, such as the pages you visit and the features you use.
- **Device Information**: We collect information about the device you use to access our website, including the hardware model, operating system, and browser type.
- **Location Information**: We may collect information about your approximate location based on your IP address.

## How We Use Your Information

We use the information we collect to:

- Provide, maintain, and improve our services
- Personalize your experience and provide content recommendations
- Communicate with you about our services
- Monitor and analyze trends, usage, and activities in connection with our website
- Detect, investigate, and prevent fraudulent transactions and other illegal activities

## Contact Us

If you have any questions about this Privacy Policy, please contact us at privacy@TVSHOWup.com.', 'TVSHOWup Privacy Policy - Learn how we collect, use, and protect your personal information.', TRUE),

('terms-of-service', 'Terms of Service', '# Terms of Service

Last updated: July 10, 2025

## Introduction

Welcome to TVSHOWup. By accessing or using our website, you agree to be bound by these Terms of Service.

## Use of Our Services

You may use our services only as permitted by these terms and any applicable laws. You may not use our services:

- In any way that violates any applicable federal, state, local, or international law or regulation
- To transmit, or procure the sending of, any advertising or promotional material, including any "junk mail", "chain letter", "spam", or any other similar solicitation
- To impersonate or attempt to impersonate TVSHOWup, a TVSHOWup employee, another user, or any other person or entity

## User Accounts

When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding the password that you use to access our services and for any activities or actions under your password.

## Content and Licenses

Our website and its entire contents, features, and functionality are owned by TVSHOWup, its licensors, or other providers of such material and are protected by copyright, trademark, and other intellectual property laws.

## Disclaimer of Warranties

Our services are provided "as is" and "as available" without any warranties of any kind, either express or implied.

## Limitation of Liability

In no event will TVSHOWup, its affiliates, or their licensors, service providers, employees, agents, officers, or directors be liable for damages of any kind arising from the use of our services.

## Contact Us

If you have any questions about these Terms, please contact us at terms@TVSHOWup.com.', 'TVSHOWup Terms of Service - Please read these terms carefully before using our website and services.', TRUE),

('contact', 'Contact Us', '# Contact Us

We''d love to hear from you! Whether you have a question about our services, need help with your account, or want to provide feedback, our team is here to assist.

## Get in Touch

**Email**: info@TVSHOWup.com

**Phone**: +1 (555) 123-4567

**Address**: 
TVSHOWup HQ
123 Streaming Avenue
San Francisco, CA 94105
United States

## Customer Support Hours

Monday - Friday: 9:00 AM - 6:00 PM (PST)
Saturday: 10:00 AM - 4:00 PM (PST)
Sunday: Closed

## Feedback

Your feedback helps us improve! If you have suggestions for new features or improvements, please let us know.

## Report Issues

Encountered a bug or technical issue? Please provide as much detail as possible, including:

- The device and browser you were using
- What you were trying to do
- What went wrong
- Any error messages you received

Our technical team will investigate and get back to you as soon as possible.', 'Contact the TVSHOWup team for support, feedback, or inquiries. We''re here to help!', TRUE),

('help', 'Help Center', '# Help Center

Welcome to the TVSHOWup Help Center. Find answers to common questions and learn how to make the most of our platform.

## Frequently Asked Questions

### What is TVSHOWup?
TVSHOWup is a platform that helps you discover where to watch movies and TV shows across multiple streaming services.

### Is TVSHOWup free to use?
Yes, basic features of TVSHOWup are completely free. We may offer premium features in the future.

### How accurate is the streaming information?
We strive to provide the most up-to-date information possible. Our data is regularly synchronized with streaming platforms, but availability can change quickly. If you notice any discrepancies, please let us know.

### How do I create an account?
Click the "Sign In" button in the top right corner, then select "Sign Up" to create a new account.

### How do I add content to my watchlist?
Simply click the "+" button on any movie or TV show card to add it to your watchlist.

## Using TVSHOWup

### Searching for Content
Use the search bar at the top of the page to find movies and TV shows by title, actor, or director.

### Managing Your Watchlist
Access your watchlist by clicking on "My Watchlist" in the navigation menu. From there, you can organize your content and mark items as watched.

### Content Recommendations
Our recommendation system learns from your watchlist and ratings to suggest content you might enjoy.

## Need More Help?

If you couldn''t find the answer you were looking for, please [contact us](/contact) and we''ll be happy to assist you.', 'Get help with using TVSHOWup. Find answers to common questions and learn how to make the most of our platform.', TRUE);

-- Create indexes for performance
CREATE INDEX idx_static_pages_created_at ON static_pages(created_at DESC);
CREATE INDEX idx_static_pages_updated_at ON static_pages(updated_at DESC);

-- Update table statistics
ANALYZE static_pages;