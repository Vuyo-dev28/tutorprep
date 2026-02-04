import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Upload, Loader2, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { generateCapsMathLessons, GeneratedLessons, QuizQuestion } from '@/lib/geminiService';
import { MarkdownContent } from '@/app/components/MarkdownContent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';

type SubjectRow = {
  id: string;
  name: string;
  slug: string;
};

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  subject_id: string;
  grade?: number; // Integer grade (8-12) for exact matching
  is_assessment?: boolean;
  curriculum?: 'CAPS' | 'IEB';
};

export function ContentUploadForm() {
  const [curriculum, setCurriculum] = useState<'CAPS' | 'IEB'>('CAPS');
  const [grade, setGrade] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [topicId, setTopicId] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLessons, setGeneratedLessons] = useState<GeneratedLessons | null>(null);
  const [selectedSuggestedTopics, setSelectedSuggestedTopics] = useState<Set<string>>(new Set());
  const [isAddingTopics, setIsAddingTopics] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [contentMode, setContentMode] = useState<'add' | 'replace'>('add');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);
  const [existingLessonsCount, setExistingLessonsCount] = useState(0);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (subjectId && grade) {
      loadTopics(subjectId, grade).catch((err) => {
        console.error('Error in loadTopics:', err);
        setError('Failed to load topics. Please try again.');
      });
      // Clear topic selection when grade or subject changes
      setTopicId('');
    } else {
      setTopics([]);
      setTopicId('');
    }
  }, [subjectId, grade, curriculum]);

  // Check existing lessons count when topic changes
  useEffect(() => {
    const checkExistingLessons = async () => {
      if (!topicId || !supabase) {
        setExistingLessonsCount(0);
        return;
      }

      const { data, error } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('topic_id', topicId);

      if (!error && data) {
        setExistingLessonsCount(data.length);
      } else {
        setExistingLessonsCount(0);
      }
    };

    checkExistingLessons();
  }, [topicId]);

  const loadSubjects = async () => {
    if (!supabase) return;

    const { data } = await supabase
      .from('subjects')
      .select('id, name, slug')
      .order('sort_order');

    setSubjects(data || []);
  };

  const loadTopics = async (subjectId: string, selectedGrade: string) => {
    if (!supabase) {
      console.error('Supabase client not available');
      setTopics([]);
      return;
    }

    try {
      // IMPORTANT: Exact grade matching only - no ranges, no BETWEEN, no >= or <=
      // This ensures topics are only shown for the exact grade selected (e.g., Grade 9 shows only grade 9 topics)
      // Using .eq() for exact match prevents displaying topics from other grades
      const gradeNum = parseInt(selectedGrade);
      
      if (isNaN(gradeNum) || gradeNum < 8 || gradeNum > 12) {
        console.error('Invalid grade:', selectedGrade);
        setTopics([]);
        return;
      }
      
      const { data: topicsData, error } = await supabase
        .from('topics')
        .select('id, name, slug, subject_id, grade, is_assessment, curriculum')
        .eq('subject_id', subjectId) // Filter by subject
        .eq('grade', gradeNum) // Exact grade match only - prevents topics from other grades
        .eq('curriculum', curriculum)
        .order('sort_order', { ascending: true });

      if (error) {
        // If the error is about missing column, try without grade filter as fallback
        if (error.message?.includes('column') || error.code === 'PGRST116' || error.message?.includes('grade')) {
          console.warn('Grade column may not exist, loading all topics for subject:', error);
          const { data: allTopics, error: fallbackError } = await supabase
            .from('topics')
            .select('id, name, slug, subject_id, curriculum')
            .eq('subject_id', subjectId)
            .eq('curriculum', curriculum)
            .order('sort_order', { ascending: true });
          
          if (fallbackError) {
            console.error('Error loading topics (fallback):', fallbackError);
            setError(`Failed to load topics: ${fallbackError.message}`);
            setTopics([]);
            return;
          }
          
          setTopics(allTopics || []);
          return;
        }
        
        console.error('Error loading topics:', error);
        setError(`Failed to load topics: ${error.message}`);
        setTopics([]);
        return;
      }

      // Only topics with exact grade match are returned
      setTopics(topicsData || []);
    } catch (err) {
      console.error('Unexpected error loading topics:', err);
      setError('An unexpected error occurred while loading topics');
      setTopics([]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileContent(text);
      setContent((prev) => (prev ? prev + '\n\n' + text : text));
    };
    reader.readAsText(file);
  };

  const handleGenerateLessons = async () => {
    if (!grade || !subjectId || !topicId || !content.trim()) {
      setError('Please fill in all fields and provide content');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccess('');
    setGeneratedLessons(null);

    try {
      const subject = subjects.find((s) => s.id === subjectId);
      const topic = topics.find((t) => t.id === topicId);

      if (!subject || !topic) {
        throw new Error('Subject or topic not found');
      }

      const result = await generateCapsMathLessons(
        parseInt(grade),
        subject.name,
        topic.name
      );

      setGeneratedLessons(result);
      setSuccess('Lessons generated successfully! Review and save them below.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate lessons');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  const handleAddSelectedTopics = async () => {
    if (!subjectId || !grade || selectedSuggestedTopics.size === 0) {
      setError('Please select a subject and grade, and choose topics to add');
      return;
    }

    if (!supabase) {
      setError('Supabase is not configured');
      return;
    }

    setIsAddingTopics(true);
    setError('');
    setSuccess('');

    try {
      const gradeNum = parseInt(grade);
      if (isNaN(gradeNum) || gradeNum < 8 || gradeNum > 12) {
        throw new Error('Invalid grade');
      }

      // Get the current max sort_order for this subject and grade
      const { data: existingTopics } = await supabase
        .from('topics')
        .select('sort_order')
        .eq('subject_id', subjectId)
        .eq('grade', gradeNum)
        .order('sort_order', { ascending: false })
        .limit(1);

      let nextSortOrder = existingTopics && existingTopics.length > 0
        ? (existingTopics[0].sort_order || 0) + 1
        : 0;

      // Prepare topics to insert
      const topicsToInsert = Array.from(selectedSuggestedTopics).map((topicName, index) => {
        const slug = generateSlug(topicName);
        return {
          subject_id: subjectId,
          slug: slug,
          name: topicName,
          description: `Learn about ${topicName}`,
          difficulty: 'intermediate' as const, // Default difficulty
          grade: gradeNum,
          sort_order: nextSortOrder + index,
        };
      });

      // Check for existing topics first to avoid conflicts
      const slugs = topicsToInsert.map(t => t.slug);
      const { data: existingTopicsData, error: checkError } = await supabase
        .from('topics')
        .select('slug, name')
        .eq('subject_id', subjectId)
        .in('slug', slugs);

      if (checkError) {
        console.error('Error checking existing topics:', checkError);
        throw new Error(`Failed to check existing topics: ${checkError.message}`);
      }

      const existingSlugs = new Set(existingTopicsData?.map(t => t.slug) || []);
      
      // Filter out topics that already exist
      const newTopicsToInsert = topicsToInsert.filter(t => !existingSlugs.has(t.slug));
      const skippedTopics = topicsToInsert.filter(t => existingSlugs.has(t.slug));

      if (newTopicsToInsert.length === 0) {
        setError(`All selected topics already exist for this subject. Skipped: ${skippedTopics.map(t => t.name).join(', ')}`);
        setIsAddingTopics(false);
        return;
      }

      // Insert only new topics
      const { error: insertError } = await supabase
        .from('topics')
        .insert(newTopicsToInsert);

      if (insertError) {
        console.error('Error inserting topics:', insertError);
        throw new Error(`Failed to insert topics: ${insertError.message}`);
      }

      let successMessage = `Successfully added ${newTopicsToInsert.length} topic(s)!`;
      if (skippedTopics.length > 0) {
        successMessage += ` (${skippedTopics.length} topic(s) already existed and were skipped)`;
      }
      setSuccess(successMessage);
      setSelectedSuggestedTopics(new Set());
      
      // Reload topics list
      if (subjectId && grade) {
        await loadTopics(subjectId, grade);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add topics');
    } finally {
      setIsAddingTopics(false);
    }
  };

  const handleSaveLessons = async () => {
    if (!generatedLessons || !topicId) {
      setError('No lessons to save');
      return;
    }

    if (!supabase) {
      setError('Supabase is not configured');
      return;
    }

    // If replace mode and there are existing lessons, show confirmation
    if (contentMode === 'replace' && existingLessonsCount > 0) {
      setShowReplaceConfirm(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    if (!generatedLessons || !topicId || !supabase) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // If replace mode, delete all existing lessons and questions first
      if (contentMode === 'replace') {
        const { error: deleteLessonsError } = await supabase
          .from('lessons')
          .delete()
          .eq('topic_id', topicId);

        if (deleteLessonsError) {
          console.error('Error deleting existing lessons:', deleteLessonsError);
        }

        const { error: deleteQuestionsError } = await supabase
          .from('questions')
          .delete()
          .eq('topic_id', topicId);

        if (deleteQuestionsError) {
          console.error('Error deleting existing questions:', deleteQuestionsError);
        }
      }
      // Get the current max sort_order for this topic (only if adding, not replacing)
      let nextSortOrder = 0;
      let existingLessons: { sort_order: number }[] | null = null;
      
      if (contentMode === 'add') {
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('sort_order')
          .eq('topic_id', topicId)
          .order('sort_order', { ascending: false })
          .limit(1);

        existingLessons = lessonsData;
        nextSortOrder = existingLessons && existingLessons.length > 0 
          ? (existingLessons[0].sort_order || 0) + 1 
          : 0;
      }

      // Check if there's already an introduction lesson (only in add mode, since replace mode deletes everything)
      let existingIntroduction: { id: string; sort_order: number } | null = null;
      if (contentMode === 'add') {
        const { data: introData } = await supabase
          .from('lessons')
          .select('id, sort_order')
          .eq('topic_id', topicId)
          .ilike('title', 'Introduction')
          .maybeSingle();
        
        existingIntroduction = introData;
      }

      // Insert all lessons
      const lessonsToInsert = generatedLessons.lessons.map((lesson, index) => {
        // If this is the Introduction lesson, always give it sort_order 0
        const isIntroduction = lesson.title.toLowerCase() === 'introduction';
        let sortOrder;
        
        if (isIntroduction) {
          sortOrder = 0;
        } else {
          // For non-introduction lessons, calculate sort_order
          // If introduction exists in new lessons, skip it (index - 1), otherwise use index
          const introIndex = generatedLessons.lessons.findIndex(l => l.title.toLowerCase() === 'introduction');
          const adjustedIndex = introIndex >= 0 && introIndex < index ? index - 1 : index;
          sortOrder = existingIntroduction ? (adjustedIndex) : (nextSortOrder + adjustedIndex);
        }
        
        return {
          topic_id: topicId,
          title: lesson.title,
          type: lesson.type,
          content: lesson.content,
          duration: lesson.duration || null,
          sort_order: sortOrder,
        };
      });
      
      // If we're inserting an introduction and there are existing lessons, shift them
      const introductionLesson = lessonsToInsert.find(l => l.title.toLowerCase() === 'introduction');
      if (introductionLesson) {
        if (existingIntroduction) {
          // Update existing introduction
          const { error: updateError } = await supabase
            .from('lessons')
            .update({
              title: introductionLesson.title,
              type: introductionLesson.type,
              content: introductionLesson.content,
            })
            .eq('id', existingIntroduction.id);
          
          if (updateError) {
            console.error('Error updating existing introduction:', updateError);
          }
          
          // Remove introduction from lessonsToInsert since we updated it
          const index = lessonsToInsert.findIndex(l => l.title.toLowerCase() === 'introduction');
          lessonsToInsert.splice(index, 1);
        } else if (contentMode === 'add' && existingLessons && existingLessons.length > 0) {
          // Shift all existing lessons by 1 to make room for introduction
          const { error: shiftError } = await supabase
            .from('lessons')
            .update({ sort_order: supabase.raw('sort_order + 1') })
            .eq('topic_id', topicId)
            .gte('sort_order', 0);
          
          if (shiftError) {
            console.error('Error shifting existing lessons:', shiftError);
          }
        }
      }

      const { error: insertError } = await supabase
        .from('lessons')
        .insert(lessonsToInsert);

      if (insertError) {
        throw insertError;
      }

      // Save quiz questions if they exist
      if (generatedLessons.questions && generatedLessons.questions.length > 0) {
        const questionsToInsert = generatedLessons.questions.map((q: QuizQuestion) => ({
          topic_id: topicId,
          question: q.question,
          options: [q.correct_answer], // Store correct answer as first option for reference
          correct_answer: 0, // Not used for working out questions, but required by schema
          explanation: `${q.correct_answer}|${q.explanation}`, // Store correct answer and explanation separated by |
        }));

        const { error: questionsError } = await supabase
          .from('questions')
          .insert(questionsToInsert);

        if (questionsError) {
          console.error('Error saving questions:', questionsError);
          // Don't throw - lessons are saved, questions are optional
        }
      }

      setSuccess(`Successfully saved ${lessonsToInsert.length} lessons${generatedLessons.questions?.length ? ` and ${generatedLessons.questions.length} quiz questions` : ''}!`);
      setGeneratedLessons(null);
      setContent('');
      setFileContent('');
      setShowReplaceConfirm(false);
      setShowSecondConfirm(false);
      // Refresh existing lessons count
      const { data } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('topic_id', topicId);
      if (data) {
        setExistingLessonsCount(data.length);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lessons');
      setShowReplaceConfirm(false);
      setShowSecondConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-xl font-semibold mb-6">Upload Content & Generate Lessons</h3>

        <div className="space-y-5">
          {/* Curriculum Selection */}
          <div>
            <Label htmlFor="curriculum">Curriculum</Label>
            <Select value={curriculum} onValueChange={(value) => setCurriculum(value as 'CAPS' | 'IEB')}>
              <SelectTrigger id="curriculum" className="mt-2">
                <SelectValue placeholder="Select curriculum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAPS">CAPS</SelectItem>
                <SelectItem value="IEB">IEB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grade Selection */}
          <div>
            <Label htmlFor="grade">Grade Level</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger id="grade" className="mt-2">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {[8, 9, 10, 11, 12].map((g) => (
                  <SelectItem key={g} value={g.toString()}>
                    Grade {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Selection */}
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="subject" className="mt-2">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Topic Selection */}
          <div>
            <Label htmlFor="topic">Topic</Label>
            <Select value={topicId} onValueChange={setTopicId} disabled={!subjectId || !grade}>
              <SelectTrigger id="topic" className="mt-2">
                <SelectValue placeholder={
                  !grade ? 'Select grade first' : 
                  !subjectId ? 'Select subject first' : 
                  'Select topic'
                } />
              </SelectTrigger>
              <SelectContent>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {subjectId && grade && topics.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                No topics found for Grade {grade}. Topics need to have a grade assigned that matches the selected grade.
              </p>
            )}
            {!grade && (
              <p className="text-sm text-gray-400 mt-2">
                Please select a grade first to see available topics.
              </p>
            )}
          </div>

          {/* Content Mode Selection */}
          {topicId && (
            <div>
              <Label>Content Mode</Label>
              <RadioGroup
                value={contentMode}
                onValueChange={(value) => setContentMode(value as 'add' | 'replace')}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="add" id="add" />
                  <Label htmlFor="add" className="font-normal cursor-pointer">
                    Add to existing content
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="replace" />
                  <Label htmlFor="replace" className="font-normal cursor-pointer">
                    Replace all content
                  </Label>
                </div>
              </RadioGroup>
              {contentMode === 'replace' && existingLessonsCount > 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  ⚠️ Warning: This will delete {existingLessonsCount} existing lesson{existingLessonsCount !== 1 ? 's' : ''} and all quiz questions for this topic.
                </p>
              )}
              {contentMode === 'add' && existingLessonsCount > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  New lessons will be added to the existing {existingLessonsCount} lesson{existingLessonsCount !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
          )}

          {/* File Upload */}
          <div>
            <Label htmlFor="file-upload">Upload Content File (Optional)</Label>
            <div className="mt-2">
              <Input
                id="file-upload"
                type="file"
                accept=".txt,.md,.pdf"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: .txt, .md, .pdf (text will be extracted)
              </p>
            </div>
          </div>

          {/* Content Text Area */}
          <div>
            <Label htmlFor="content">Content to Analyze</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type the content you want to convert into lessons. This can be textbook content, notes, or any educational material."
              className="mt-2 min-h-[200px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              {content.length} characters
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {success}
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerateLessons}
            disabled={isGenerating || !grade || !subjectId || !topicId || !content.trim()}
            className="w-full rounded-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating lessons with AI...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Generate Lessons with Gemini AI
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Generated Lessons Preview */}
      {generatedLessons && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Generated Lessons</h3>
            <Button
              onClick={handleSaveLessons}
              disabled={isLoading}
              className="rounded-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save All Lessons
                </>
              )}
            </Button>
          </div>

          {generatedLessons.summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-blue-900 mb-1">Summary:</p>
              <p className="text-sm text-blue-700">{generatedLessons.summary}</p>
            </div>
          )}

          <div className="space-y-8">
            {generatedLessons.lessons.map((lesson, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-2xl p-8 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between mb-6">
                  <h4 className="font-semibold text-xl text-gray-900">{lesson.title}</h4>
                  <span className="text-xs bg-gray-100 px-3 py-1.5 rounded-full font-medium text-gray-700">
                    {lesson.type}
                  </span>
                </div>
                
                {/* Preview Content - matches LessonDetailScreen format with better spacing */}
                <div className="prose max-w-none">
                  {/* Notes type preview */}
                  {lesson.type === 'notes' && (
                    <div className="space-y-4">
                      <div className="p-5 bg-blue-50 rounded-2xl border-l-4 border-blue-500">
                        <h3 className="font-semibold mb-3 text-blue-900 text-base">Key Point</h3>
                        <div className="text-sm text-gray-700 leading-relaxed">
                          <MarkdownContent content={lesson.content} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Example type preview - matches LessonDetailScreen format with better spacing */}
                  {lesson.type === 'example' && lesson.content && (
                    <div className="space-y-6">
                      <div className="p-6 bg-gray-50 rounded-2xl">
                        <div className="space-y-8 text-gray-700">
                          {(() => {
                            // Split content by Example/Problem markers
                            const exampleBlocks = lesson.content.split(/\n(?=Example|Problem)/i);
                            
                            return exampleBlocks.map((exampleBlock, blockIndex) => {
                              if (!exampleBlock.trim()) return null;
                              
                              const lines = exampleBlock.trim().split('\n');
                              const elements: JSX.Element[] = [];
                              let exampleTitle = '';
                              let solveProblem = '';
                              let lastStepIndex = -1;
                              
                              let skipNext = false;
                              lines.forEach((line, lineIndex) => {
                                if (skipNext) {
                                  skipNext = false;
                                  return;
                                }
                                
                                const trimmed = line.trim();
                                if (!trimmed) return;
                                
                                // Example/Problem title
                                const titleMatch = trimmed.match(/^(Example|Problem)\s+\d+:\s*(.+)/i);
                                if (titleMatch) {
                                  exampleTitle = trimmed;
                                  return;
                                }
                                
                                // Solve line
                                if (trimmed.startsWith('Solve:')) {
                                  solveProblem = trimmed.replace(/^Solve:\s*/i, '').trim();
                                  return;
                                }
                                
                                // Step line
                                const stepMatch = trimmed.match(/^Step\s+(\d+):\s*(.+)/i);
                                if (stepMatch) {
                                  lastStepIndex = lineIndex;
                                  // Check if next line is an equation (contains ** or is a math expression)
                                  const nextLine = lines[lineIndex + 1]?.trim();
                                  const isNextLineEquation = nextLine && (
                                    nextLine.includes('**') || 
                                    nextLine.match(/^[a-zA-Z0-9\s+\-×÷=<>≤≥()]+$/) ||
                                    lines[lineIndex + 1]?.startsWith('  ')
                                  );
                                  
                                  if (isNextLineEquation) {
                                    // Combine step and equation
                                    const combined = `${trimmed}\n\n${nextLine}`;
                                    elements.push(
                                      <div key={`step-${lineIndex}`} className="text-sm mb-2 font-medium">
                                        <MarkdownContent content={combined} />
                                      </div>
                                    );
                                    // Skip the next line since we've processed it
                                    skipNext = true;
                                    return;
                                  } else {
                                    elements.push(
                                      <div key={`step-${lineIndex}`} className="text-sm mb-2 font-medium">
                                        <MarkdownContent content={trimmed} />
                                      </div>
                                    );
                                    return;
                                  }
                                }
                                
                                // Answer line
                                if (trimmed.startsWith('✓') || trimmed.match(/^Answer:/i)) {
                                  elements.push(
                                    <div key={`answer-${lineIndex}`} className="text-sm mt-4 text-green-700 font-semibold">
                                      <MarkdownContent content={trimmed} />
                                    </div>
                                  );
                                  return;
                                }
                                
                                // Equation/calculation (indented, appears after a step)
                                if (lastStepIndex >= 0 && lineIndex > lastStepIndex) {
                                  const nextNonEmpty = lines.slice(lineIndex + 1).find(l => l.trim());
                                  if (!nextNonEmpty || (!nextNonEmpty.match(/^Step\s+\d+:/i) && !nextNonEmpty.match(/^Answer:/i) && !nextNonEmpty.startsWith('✓'))) {
                                    elements.push(
                                      <div key={`eq-${lineIndex}`} className="text-sm ml-6 mb-3">
                                        <MarkdownContent content={trimmed} />
                                      </div>
                                    );
                                    return;
                                  }
                                }
                                
                                // Regular text (fallback)
                                elements.push(
                                  <div key={`text-${lineIndex}`} className="text-sm leading-relaxed">
                                    <MarkdownContent content={trimmed} />
                                  </div>
                                );
                              });
                              
                              return (
                                <div key={blockIndex} className={blockIndex > 0 ? 'mt-8 pt-8 border-t-2 border-gray-300' : ''}>
                                  {exampleTitle && (
                                    <h3 className="font-semibold mb-4 text-lg text-gray-900">{exampleTitle}</h3>
                                  )}
                                  
                                  {solveProblem && (
                                    <div className="mb-5">
                                      Solve: <code className="px-4 py-2 bg-white rounded-xl font-mono text-sm font-medium">
                                        <MarkdownContent content={solveProblem} />
                                      </code>
                                    </div>
                                  )}
                                  
                                  <div className="space-y-3">
                                    {elements}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {generatedLessons.suggestedTopics && generatedLessons.suggestedTopics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">Suggested Related Topics:</p>
                {selectedSuggestedTopics.size > 0 && (
                  <Button
                    onClick={handleAddSelectedTopics}
                    disabled={isAddingTopics || !subjectId || !grade}
                    size="sm"
                    className="rounded-full"
                  >
                    {isAddingTopics ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-2" />
                        Add Selected ({selectedSuggestedTopics.size})
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {generatedLessons.suggestedTopics.map((topic, index) => {
                  const isSelected = selectedSuggestedTopics.has(topic);
                  return (
                    <label
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-100 border-2 border-purple-300'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSelected = new Set(selectedSuggestedTopics);
                          if (e.target.checked) {
                            newSelected.add(topic);
                          } else {
                            newSelected.delete(topic);
                          }
                          setSelectedSuggestedTopics(newSelected);
                        }}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 flex-1">{topic}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Double Confirmation Dialogs for Replace Mode */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Replace All Content</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to <strong>replace all existing content</strong> for this topic.
              <br /><br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{existingLessonsCount} existing lesson{existingLessonsCount !== 1 ? 's' : ''}</li>
                <li>All quiz questions for this topic</li>
              </ul>
              <br />
              This action cannot be undone. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowReplaceConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowReplaceConfirm(false);
                setShowSecondConfirm(true);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, I understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSecondConfirm} onOpenChange={setShowSecondConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final Confirmation Required</AlertDialogTitle>
            <AlertDialogDescription>
              This is your <strong>final confirmation</strong>. You are about to permanently delete all existing content and replace it with new content.
              <br /><br />
              <strong>This action cannot be undone.</strong>
              <br /><br />
              Click "Confirm Replace" to proceed, or "Cancel" to abort.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSecondConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSecondConfirm(false);
                performSave();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
