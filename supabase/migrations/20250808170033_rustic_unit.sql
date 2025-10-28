/*
  # Clean unused views and optimize database

  1. Remove Unused Views
    - Drop `content_availability` view (not used in code)
    - Drop `tv_show_networks` view (not used in code)
    - Drop `duplicate_providers` view (not used in code)
    - Drop `provider_categorization_analysis` view (not used in code)

  2. Optimize Existing Views
    - Keep `all_content_providers` view (actively used)
    - Keep `user_country_providers` view (actively used)

  3. Performance Improvements
    - Add missing indexes for better query performance
    - Update existing indexes if needed

  This migration removes unused database objects that are causing confusion
  and potential performance issues while keeping the essential views that
  the application actually uses.
*/

-- Remove unused views that are not referenced in the codebase
DROP VIEW IF EXISTS content_availability CASCADE;
DROP VIEW IF EXISTS tv_show_networks CASCADE;
DROP VIEW IF EXISTS duplicate_providers CASCADE;
DROP VIEW IF EXISTS provider_categorization_analysis CASCADE;

-- Ensure we have proper indexes for the views we actually use
CREATE INDEX IF NOT EXISTS idx_content_providers_all_lookup 
ON content_providers (content_id, content_type, country_code, provider_id);

CREATE INDEX IF NOT EXISTS idx_content_providers_country_provider 
ON content_providers (country_code, provider_id, monetization_type);

-- Add index for provider name searches (used in admin)
CREATE INDEX IF NOT EXISTS idx_providers_name_search 
ON providers USING gin (to_tsvector('english', name));

-- Optimize the all_content_providers view query performance
CREATE INDEX IF NOT EXISTS idx_providers_active_type 
ON providers (is_active, provider_type) WHERE is_active = true;

-- Add comment to document which views are actually used
COMMENT ON VIEW all_content_providers IS 'Main view for content provider data - ACTIVELY USED in application';
COMMENT ON VIEW user_country_providers IS 'User-specific provider view - ACTIVELY USED in application';

-- Update statistics for better query planning
ANALYZE content_providers;
ANALYZE providers;