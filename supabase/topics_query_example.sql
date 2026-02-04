-- PostgreSQL Query for Exact Grade Matching
-- This query ensures topics are fetched for ONE exact grade only (e.g., Grade 9)
-- Using grade = :grade (exact match) prevents topics from other grades from appearing

SELECT 
  id,
  subject_id,
  slug,
  name,
  description,
  difficulty,
  grade,
  sort_order
FROM public.topics
WHERE subject_id = :subjectId  -- Filter by subject
  AND grade = :grade          -- Exact grade match only - prevents topics from other grades
ORDER BY sort_order;

-- Why grade = value is required:
-- 1. Ensures only topics for the selected grade are returned
-- 2. Prevents accidental display of topics from adjacent grades
-- 3. Maintains data integrity and user experience
-- 4. No ranges, no BETWEEN, no >= or <= - only exact matches
