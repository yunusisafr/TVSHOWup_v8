/*
  # Fix editor review index size limit

  1. Changes
    - Remove the problematic B-tree index on editor_review column for tv_shows table
    - Remove the problematic B-tree index on editor_review column for movies table (if exists)
    
  2. Reasoning
    - B-tree indexes have a maximum row size limit (2704 bytes)
    - Editor reviews can be much larger than this limit
    - The index was causing save operations to fail when reviews exceeded the size limit
    - For text search on editor reviews, a full-text search index would be more appropriate
    
  3. Impact
    - Allows saving of longer editor reviews without size restrictions
    - Removes the ability to efficiently query by exact editor_review values (which is rarely needed)
    - If full-text search is needed later, a GIN index on a tsvector column should be used instead
*/

-- Remove the problematic B-tree index on tv_shows.editor_review
DROP INDEX IF EXISTS idx_tv_shows_editor_review;

-- Remove the problematic B-tree index on movies.editor_review (if it exists)
DROP INDEX IF EXISTS idx_movies_editor_review;