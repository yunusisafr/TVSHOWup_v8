/*
  # Remove unused tv_show_networks view

  1. Changes
    - Drop tv_show_networks view (unused in application)
    - This view was causing errors and is not used anywhere in the codebase
    
  2. Impact
    - No impact on application functionality
    - Removes potential source of database errors
*/

-- Drop the unused tv_show_networks view
DROP VIEW IF EXISTS tv_show_networks;