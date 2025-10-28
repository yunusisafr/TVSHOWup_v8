/*
  # Add Cookie Policy Page

  1. Changes
    - Add cookie policy static page
    - This page explains how the site uses cookies
    - Provides information required for GDPR and KVKK compliance

  2. Security
    - No changes to existing security policies
    - Page will be publicly accessible like other static pages
*/

-- Insert cookie policy page
INSERT INTO static_pages (slug, title, content, meta_description, is_published) VALUES
('cookie-policy', 'Cookie Policy', '# Cookie Policy

Last updated: July 10, 2025

## Introduction

This Cookie Policy explains how TVSHOWup ("we", "us", or "our") uses cookies and similar technologies on our website. By using our website, you consent to the use of cookies as described in this policy.

## What Are Cookies?

Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit websites. They are widely used to make websites work more efficiently and provide information to the website owners.

## How We Use Cookies

We use cookies for several purposes, including:

- **Essential Cookies**: These cookies are necessary for the website to function properly. They enable core functionality such as security, network management, and account access.

- **Preference Cookies**: These cookies allow us to remember choices you make and provide enhanced, personalized features. They may be set by us or by third-party providers whose services we have added to our pages.

- **Analytics Cookies**: These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our website.

- **Marketing Cookies**: These cookies are used to track visitors across websites. They are set to display targeted advertisements based on your interests and online behavior.

## Types of Cookies We Use

### Essential Cookies
- **Session Cookies**: These temporary cookies are erased when you close your browser. They enable our website to link your actions during a browser session.
- **Authentication Cookies**: These cookies help us identify you when you are logged in to our website.

### Preference Cookies
- **Language Preference**: Remembers your preferred language.
- **Region Preference**: Remembers your country/region for content availability.

### Analytics Cookies
- **Usage Data**: Collects anonymous data about how you use our website, which pages you visit, and how long you stay.

### Marketing Cookies
- **Advertising Cookies**: Used to deliver advertisements relevant to you and your interests.

## Managing Cookies

Most web browsers allow you to control cookies through their settings. You can:

- **Delete Cookies**: You can delete all cookies that are already on your device.
- **Block Cookies**: You can set your browser to prevent new cookies from being placed on your device.
- **Allow Cookies**: You can set your browser to allow all cookies.

Please note that restricting cookies may impact the functionality of our website.

## Your Choices

When you first visit our website, you will be presented with a cookie banner that allows you to accept or decline non-essential cookies.

You can change your cookie preferences at any time by clearing your browser cookies and revisiting our site.

## Updates to This Policy

We may update this Cookie Policy from time to time to reflect changes in technology, regulation, or our business practices. Any changes will be posted on this page with an updated "Last updated" date.

## Contact Us

If you have any questions about our use of cookies, please contact us at info@tvshowup.com.', 'Learn about how TVSHOWup uses cookies and similar technologies, and how you can control them.', TRUE);

-- Update table statistics
ANALYZE static_pages;