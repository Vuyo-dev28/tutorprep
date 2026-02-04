import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';
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
import { 
  Edit, 
  Trash2, 
  Eye, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Copy,
  ArrowUp,
  ArrowDown,
  Folder,
  BookOpen,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { MarkdownContent } from '@/app/components/MarkdownContent';
import { generateCapsMathLessons, type QuizQuestion } from '@/lib/geminiService';

type Lesson = {
  id: string;
  title: string;
  type: 'video' | 'notes' | 'example';
  content: string;
  duration: string | null;
  sort_order: number;
  topic_id: string;
  topic?: {
    name: string;
    subject?: {
      name: string;
      id: string;
    };
  };
};

type SubjectRow = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
};

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  subject_id: string;
  grade?: number;
  is_assessment?: boolean;
};

type GroupedContent = {
  subject: SubjectRow;
  topics: {
    topic: TopicRow;
    lessons: Lesson[];
  }[];
}[];

export function ContentManagement() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'date' | 'topic'>('date');
  const [isLoading, setIsLoading] = useState(true);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState<'notes' | 'example'>('notes');
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string>('');
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  
  // Topic/Subject management
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicRow | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [topicForm, setTopicForm] = useState({
    name: '',
    grade: '',
    subjectId: '',
    curriculum: 'CAPS' as 'CAPS' | 'IEB',
    isAssessment: false,
  });
  const [subjectForm, setSubjectForm] = useState({ name: '', icon: '', color: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'lesson' | 'topic' | 'subject'; id: string; name: string } | null>(null);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);

  useEffect(() => {
    loadSubjects();
    loadAllTopics();
    loadLessons();
  }, []);

  const loadSubjects = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('subjects')
      .select('id, name, slug, icon, color')
      .order('sort_order');
    setSubjects(data || []);
  };

  const loadAllTopics = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('topics')
      .select('id, name, slug, subject_id, grade, is_assessment')
      .order('sort_order');
    setTopics(data || []);
  };

  const getNextAssessmentNumber = (subjectId: string, grade: string): number => {
    if (!subjectId || !grade) return 1;
    const gradeNum = parseInt(grade);
    const assessmentTopics = topics.filter(
      t => t.subject_id === subjectId && 
           t.grade === gradeNum && 
           t.is_assessment &&
           t.name.match(/Term Revision and Assessment \d+/)
    );
    if (assessmentTopics.length === 0) return 1;
    const numbers = assessmentTopics
      .map(t => {
        const match = t.name.match(/Term Revision and Assessment (\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  };

  const loadLessons = async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .order('sort_order');

      if (lessonsError) throw lessonsError;

      if (!lessonsData || lessonsData.length === 0) {
        setLessons([]);
        setIsLoading(false);
        return;
      }

      const topicIds = [...new Set(lessonsData.map((l) => l.topic_id))];
      const { data: topicsData } = await supabase
        .from('topics')
        .select(`
          id,
          name,
          subject_id,
          subject:subjects(
            id,
            name
          )
        `)
        .in('id', topicIds);

      const topicMap = new Map();
      (topicsData || []).forEach((topic: any) => {
        topicMap.set(topic.id, {
          name: topic.name,
          subject: topic.subject ? { id: topic.subject.id, name: topic.subject.name } : null,
        });
      });

      const transformedLessons = lessonsData.map((lesson: any) => ({
        ...lesson,
        topic: topicMap.get(lesson.topic_id) || null,
      }));

      setLessons(transformedLessons);
    } catch (error) {
      console.error('Error loading lessons:', error);
      setLoadError('Failed to load lessons');
    } finally {
      setIsLoading(false);
    }
  };

  const groupedContent = useMemo<GroupedContent>(() => {
    const filtered = lessons.filter(lesson => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!lesson.title.toLowerCase().includes(query) && 
            !lesson.content.toLowerCase().includes(query) &&
            !lesson.topic?.name.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (selectedSubject !== 'all') {
        if (!lesson.topic?.subject?.id || lesson.topic.subject.id !== selectedSubject) {
          return false;
        }
      }
      if (selectedType !== 'all' && lesson.type !== selectedType) {
        return false;
      }
      if (selectedGrade !== 'all') {
        const topic = topics.find(t => t.id === lesson.topic_id);
        if (!topic || topic.grade?.toString() !== selectedGrade) {
          return false;
        }
      }
      return true;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'topic':
          return (a.topic?.name || '').localeCompare(b.topic?.name || '');
        case 'date':
        default:
          return b.sort_order - a.sort_order;
      }
    });

    // Group by subject and topic
    const grouped = new Map<string, { subject: SubjectRow; topics: Map<string, { topic: TopicRow; lessons: Lesson[] }> }>();

    // First, add all lessons to their topics
    sorted.forEach(lesson => {
      if (!lesson.topic?.subject) return;
      
      const subjectId = lesson.topic.subject.id;
      const topicId = lesson.topic_id;

      if (!grouped.has(subjectId)) {
        const subject = subjects.find(s => s.id === subjectId);
        if (!subject) return;
        grouped.set(subjectId, { subject, topics: new Map() });
      }

      const subjectGroup = grouped.get(subjectId)!;
      if (!subjectGroup.topics.has(topicId)) {
        const topic = topics.find(t => t.id === topicId);
        if (!topic) return;
        subjectGroup.topics.set(topicId, { topic, lessons: [] });
      }

      subjectGroup.topics.get(topicId)!.lessons.push(lesson);
    });

    // Then, add topics that don't have any lessons (if they pass the filters)
    topics.forEach(topic => {
      // Check if topic passes grade filter
      if (selectedGrade !== 'all' && topic.grade?.toString() !== selectedGrade) {
        return;
      }

      // Check if topic passes subject filter
      if (selectedSubject !== 'all' && topic.subject_id !== selectedSubject) {
        return;
      }

      // Check if topic passes search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!topic.name.toLowerCase().includes(query)) {
          return;
        }
      }

      const subject = subjects.find(s => s.id === topic.subject_id);
      if (!subject) return;

      // Initialize subject group if it doesn't exist
      if (!grouped.has(topic.subject_id)) {
        grouped.set(topic.subject_id, { subject, topics: new Map() });
      }

      const subjectGroup = grouped.get(topic.subject_id)!;
      
      // Only add if topic doesn't already exist (meaning it has no lessons)
      if (!subjectGroup.topics.has(topic.id)) {
        subjectGroup.topics.set(topic.id, { topic, lessons: [] });
      }
    });

    return Array.from(grouped.values()).map(({ subject, topics }) => ({
      subject,
      topics: Array.from(topics.values()),
    }));
  }, [lessons, subjects, topics, searchQuery, selectedSubject, selectedType, selectedGrade, sortBy]);

  const handleSelectLesson = (lessonId: string) => {
    const newSelected = new Set(selectedLessons);
    if (newSelected.has(lessonId)) {
      newSelected.delete(lessonId);
    } else {
      newSelected.add(lessonId);
    }
    setSelectedLessons(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLessons.size === filteredLessons.length) {
      setSelectedLessons(new Set());
    } else {
      setSelectedLessons(new Set(filteredLessons.map(l => l.id)));
    }
  };

  const filteredLessons = useMemo(() => {
    return groupedContent.flatMap(group => 
      group.topics.flatMap(t => t.lessons)
    );
  }, [groupedContent]);

  const handleBulkDelete = async () => {
    if (!supabase || selectedLessons.size === 0) return;
    if (!confirm(`Delete ${selectedLessons.size} lesson(s)?`)) return;

    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .in('id', Array.from(selectedLessons));

      if (error) throw error;
      setSelectedLessons(new Set());
      loadLessons();
    } catch (error) {
      console.error('Error deleting lessons:', error);
      alert('Failed to delete lessons');
    }
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditContent(lesson.content);
    setEditType(lesson.type === 'video' ? 'notes' : (lesson.type as 'notes' | 'example'));
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!supabase || !editingLesson) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('lessons')
        .update({
          title: editTitle,
          content: editContent,
          type: editType,
        })
        .eq('id', editingLesson.id);

      if (error) throw error;

      setIsEditDialogOpen(false);
      setEditingLesson(null);
      loadLessons();
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('Failed to save lesson');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (lessonId: string, lessonTitle: string) => {
    setDeleteConfirm({ type: 'lesson', id: lessonId, name: lessonTitle });
  };

  const confirmDelete = async () => {
    if (!supabase || !deleteConfirm) return;

    try {
      if (deleteConfirm.type === 'lesson') {
        const { error } = await supabase
          .from('lessons')
          .delete()
          .eq('id', deleteConfirm.id);
        if (error) throw error;
        loadLessons();
      } else if (deleteConfirm.type === 'topic') {
        const { error } = await supabase
          .from('topics')
          .delete()
          .eq('id', deleteConfirm.id);
        if (error) throw error;
        loadAllTopics();
        loadLessons();
      } else if (deleteConfirm.type === 'subject') {
        const { error } = await supabase
          .from('subjects')
          .delete()
          .eq('id', deleteConfirm.id);
        if (error) throw error;
        loadSubjects();
        loadAllTopics();
        loadLessons();
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    }
  };

  const handleDuplicate = async (lesson: Lesson) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('lessons')
        .insert({
          topic_id: lesson.topic_id,
          title: `${lesson.title} (Copy)`,
          type: lesson.type,
          content: lesson.content,
          duration: lesson.duration,
          sort_order: lesson.sort_order + 1,
        });

      if (error) throw error;
      loadLessons();
    } catch (error) {
      console.error('Error duplicating lesson:', error);
      alert('Failed to duplicate lesson');
    }
  };

  const handleReorder = async (lessonId: string, direction: 'up' | 'down') => {
    if (!supabase) return;

    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    const sameTopicLessons = lessons
      .filter(l => l.topic_id === lesson.topic_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const currentIndex = sameTopicLessons.findIndex(l => l.id === lessonId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sameTopicLessons.length) return;

    const otherLesson = sameTopicLessons[newIndex];
    const tempOrder = lesson.sort_order;
    const otherOrder = otherLesson.sort_order;

    try {
      await Promise.all([
        supabase.from('lessons').update({ sort_order: otherOrder }).eq('id', lessonId),
        supabase.from('lessons').update({ sort_order: tempOrder }).eq('id', otherLesson.id),
      ]);
      loadLessons();
    } catch (error) {
      console.error('Error reordering:', error);
      alert('Failed to reorder lesson');
    }
  };

  const handleCreateTopic = async () => {
    if (!supabase || !topicForm.name || !topicForm.subjectId || !topicForm.grade) return;

    try {
      const slug = topicForm.name.toLowerCase().replace(/\s+/g, '-');
      const { data: newTopic, error } = await supabase
        .from('topics')
        .insert({
          subject_id: topicForm.subjectId,
          name: topicForm.name,
          slug,
          grade: parseInt(topicForm.grade),
          difficulty: 'beginner',
          curriculum: topicForm.curriculum,
          is_assessment: topicForm.isAssessment,
        })
        .select()
        .single();

      if (error) throw error;
      
      // If it's an assessment topic, auto-generate lessons and quiz
      if (topicForm.isAssessment && newTopic) {
        setIsGeneratingAssessment(true);
        try {
          const subject = subjects.find(s => s.id === topicForm.subjectId);
          const subjectName = subject?.name || 'Mathematics';
          
          // Generate lessons and questions
          const generated = await generateCapsMathLessons(
            parseInt(topicForm.grade),
            subjectName,
            topicForm.name,
            true // isAssessment
          );

          // Save lessons
          if (generated.lessons && generated.lessons.length > 0) {
            const lessonsToInsert = generated.lessons.map((lesson, index) => ({
              topic_id: newTopic.id,
              title: lesson.title,
              type: lesson.type,
              content: lesson.content,
              duration: null,
              sort_order: index,
            }));

            const { error: lessonsError } = await supabase
              .from('lessons')
              .insert(lessonsToInsert);

            if (lessonsError) {
              console.error('Error saving generated lessons:', lessonsError);
              throw new Error(`Failed to save lessons: ${lessonsError.message}`);
            }
          }

          // Save quiz questions
          if (generated.questions && generated.questions.length > 0) {
            const questionsToInsert = generated.questions.map((q) => ({
              topic_id: newTopic.id,
              question: q.question,
              options: [q.correct_answer],
              correct_answer: 0,
              explanation: `${q.correct_answer}|${q.explanation}`,
            }));

            const { error: questionsError } = await supabase
              .from('questions')
              .insert(questionsToInsert);

            if (questionsError) {
              console.error('Error saving generated questions:', questionsError);
              throw new Error(`Failed to save questions: ${questionsError.message}`);
            }
          }

          alert(`Assessment topic created successfully! Generated ${generated.lessons?.length || 0} lessons and ${generated.questions?.length || 0} quiz questions.`);
        } catch (genError) {
          console.error('Error generating assessment content:', genError);
          alert(`Topic created, but failed to generate content: ${genError instanceof Error ? genError.message : 'Unknown error'}. You can generate content manually from the Upload Content tab.`);
        } finally {
          setIsGeneratingAssessment(false);
        }
      }

      setIsTopicDialogOpen(false);
      setTopicForm({ name: '', grade: '', subjectId: '', curriculum: 'CAPS', isAssessment: false });
      loadAllTopics();
      loadLessons();
    } catch (error) {
      console.error('Error creating topic:', error);
      alert(`Failed to create topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGeneratingAssessment(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!supabase || !subjectForm.name) return;

    try {
      const slug = subjectForm.name.toLowerCase().replace(/\s+/g, '-');
      const { error } = await supabase
        .from('subjects')
        .insert({
          name: subjectForm.name,
          slug,
          icon: subjectForm.icon || '📚',
          color: subjectForm.color || 'from-blue-500 to-purple-500',
        });

      if (error) throw error;
      setIsSubjectDialogOpen(false);
      setSubjectForm({ name: '', icon: '', color: '' });
      loadSubjects();
    } catch (error) {
      console.error('Error creating subject:', error);
      alert('Failed to create subject');
    }
  };

  const toggleSubject = (subjectId: string) => {
    const newExpanded = new Set(expandedSubjects);
    if (newExpanded.has(subjectId)) {
      newExpanded.delete(subjectId);
    } else {
      newExpanded.add(subjectId);
    }
    setExpandedSubjects(newExpanded);
  };

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Content Management</h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage subjects, topics, and lessons
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSubjectDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Subject
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsTopicDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Topic
            </Button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          <div className="md:col-span-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="search"
                placeholder="Search lessons, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="filter-subject">Subject</Label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger id="filter-subject" className="mt-2">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-grade">Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger id="filter-grade" className="mt-2">
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {[8, 9, 10, 11, 12].map((grade) => (
                  <SelectItem key={grade} value={grade.toString()}>
                    Grade {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-type">Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id="filter-type" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="notes">Notes</SelectItem>
                <SelectItem value="example">Example</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sort">Sort By</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger id="sort" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="topic">Topic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedLessons.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg mb-4">
            <span className="text-sm font-medium">
              {selectedLessons.size} lesson(s) selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={viewMode === 'tree' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('tree')}
          >
            <Folder className="w-4 h-4 mr-2" />
            Tree View
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            List View
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {loadError}
        </div>
      )}

      {/* Content Display */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : viewMode === 'tree' ? (
        <div className="space-y-4">
          {groupedContent.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No content found. Create a subject and topic to get started.
            </div>
          ) : (
            groupedContent.map((group) => (
              <div key={group.subject.id} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSubject(group.subject.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {expandedSubjects.has(group.subject.id) ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <h4 className="font-semibold text-lg">{group.subject.name}</h4>
                    <Badge variant="secondary">{group.topics.length} topics</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm({ type: 'subject', id: group.subject.id, name: group.subject.name })}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>

                {expandedSubjects.has(group.subject.id) && (
                  <div className="ml-8 space-y-3">
                    {group.topics.map(({ topic, lessons: topicLessons }) => (
                      <div key={topic.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleTopic(topic.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                              disabled={topicLessons.length === 0}
                            >
                              {expandedTopics.has(topic.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <h5 className="font-medium">{topic.name}</h5>
                            {topic.is_assessment && (
                              <Badge variant="default" className="bg-purple-600 text-white">
                                Assessment
                              </Badge>
                            )}
                            {topicLessons.length === 0 ? (
                              <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300">
                                ⚠️ Please add lessons
                              </Badge>
                            ) : (
                              <Badge variant="outline">{topicLessons.length} lessons</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm({ type: 'topic', id: topic.id, name: topic.name })}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>

                        {expandedTopics.has(topic.id) && (
                          <div className="ml-6 space-y-2">
                            {topicLessons.length === 0 ? (
                              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-sm text-orange-700 font-medium mb-1">
                                  ⚠️ No lessons found
                                </p>
                                <p className="text-xs text-orange-600">
                                  This topic needs lessons. Use the "Upload Content" tab to generate lessons for this topic.
                                </p>
                              </div>
                            ) : (
                              topicLessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <Checkbox
                                    checked={selectedLessons.has(lesson.id)}
                                    onCheckedChange={() => handleSelectLesson(lesson.id)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h6 className="font-medium text-sm">{lesson.title}</h6>
                                      <Badge variant="outline" className="text-xs">
                                        {lesson.type}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-1">
                                      {lesson.content.substring(0, 100)}...
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleReorder(lesson.id, 'up')}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleReorder(lesson.id, 'down')}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDuplicate(lesson)}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(lesson)}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(lesson.id, lesson.title)}
                                    >
                                      <Trash2 className="w-3 h-3 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLessons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No lessons found</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedLessons.size === filteredLessons.length ? (
                    <CheckSquare className="w-4 h-4 mr-2" />
                  ) : (
                    <Square className="w-4 h-4 mr-2" />
                  )}
                  Select All
                </Button>
                <span className="text-sm text-gray-500">
                  {filteredLessons.length} lesson(s)
                </span>
              </div>
              {filteredLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedLessons.has(lesson.id)}
                      onCheckedChange={() => handleSelectLesson(lesson.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{lesson.title}</h4>
                        <Badge variant="outline">{lesson.type}</Badge>
                        {lesson.topic && (
                          <span className="text-xs text-gray-500">
                            {lesson.topic.subject?.name} → {lesson.topic.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                        {lesson.content}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(lesson)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(lesson)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(lesson.id, lesson.title)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Edit Lesson Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              {editingLesson?.topic && `${editingLesson.topic.subject?.name} → ${editingLesson.topic.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="edit-type">Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as any)}>
                <SelectTrigger id="edit-type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="example">Example</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="mt-2 min-h-[400px] font-mono text-sm"
              />
            </div>

            <div>
              <Label>Preview</Label>
              <div className="mt-2 p-4 border border-gray-200 rounded-lg bg-gray-50 min-h-[200px]">
                <MarkdownContent content={editContent} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingLesson(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Topic Dialog */}
      <Dialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Subject</Label>
              <Select value={topicForm.subjectId} onValueChange={(v) => {
                const nextNum = topicForm.isAssessment && topicForm.grade 
                  ? getNextAssessmentNumber(v, topicForm.grade)
                  : 1;
                setTopicForm({ 
                  ...topicForm, 
                  subjectId: v,
                  name: topicForm.isAssessment && topicForm.grade 
                    ? `Term Revision and Assessment ${nextNum}` 
                    : topicForm.name
                });
              }}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Grade</Label>
              <Select value={topicForm.grade} onValueChange={(v) => {
                const nextNum = topicForm.isAssessment && topicForm.subjectId
                  ? getNextAssessmentNumber(topicForm.subjectId, v)
                  : 1;
                setTopicForm({ 
                  ...topicForm, 
                  grade: v,
                  name: topicForm.isAssessment && topicForm.subjectId
                    ? `Term Revision and Assessment ${nextNum}` 
                    : topicForm.name
                });
              }}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {[8, 9, 10, 11, 12].map(g => (
                    <SelectItem key={g} value={g.toString()}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Curriculum</Label>
              <Select
                value={topicForm.curriculum}
                onValueChange={(v) => setTopicForm({ ...topicForm, curriculum: v as 'CAPS' | 'IEB' })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select curriculum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAPS">CAPS</SelectItem>
                  <SelectItem value="IEB">IEB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="is-assessment"
                checked={topicForm.isAssessment}
                onCheckedChange={(checked) => {
                  const isAssessment = checked === true;
                  if (isAssessment && topicForm.subjectId && topicForm.grade) {
                    const nextNum = getNextAssessmentNumber(topicForm.subjectId, topicForm.grade);
                    setTopicForm({ 
                      ...topicForm, 
                      isAssessment,
                      name: `Term Revision and Assessment ${nextNum}`
                    });
                  } else {
                    setTopicForm({ ...topicForm, isAssessment, name: '' });
                  }
                }}
              />
              <Label htmlFor="is-assessment" className="cursor-pointer">
                Mark as Assessment (50 questions)
              </Label>
            </div>
            <div>
              <Label>Topic Name</Label>
              <Input
                value={topicForm.name}
                onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                className="mt-2"
                placeholder={topicForm.isAssessment ? "Term Revision and Assessment 1" : "e.g., Algebra Basics"}
                disabled={topicForm.isAssessment}
              />
              {topicForm.isAssessment && (
                <p className="text-xs text-gray-500 mt-1">
                  Assessment name will be auto-generated as "Term Revision and Assessment X"
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsTopicDialogOpen(false)}
                disabled={isGeneratingAssessment}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTopic}
                disabled={isGeneratingAssessment}
              >
                {isGeneratingAssessment 
                  ? (topicForm.isAssessment ? 'Generating Assessment...' : 'Creating...') 
                  : 'Create Topic'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Subject Dialog */}
      <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Subject Name</Label>
              <Input
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="mt-2"
                placeholder="e.g., Mathematics"
              />
            </div>
            <div>
              <Label>Icon (emoji)</Label>
              <Input
                value={subjectForm.icon}
                onChange={(e) => setSubjectForm({ ...subjectForm, icon: e.target.value })}
                className="mt-2"
                placeholder="📐"
              />
            </div>
            <div>
              <Label>Color (Tailwind gradient)</Label>
              <Input
                value={subjectForm.color}
                onChange={(e) => setSubjectForm({ ...subjectForm, color: e.target.value })}
                className="mt-2"
                placeholder="from-blue-500 to-purple-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsSubjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSubject}>Create Subject</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
              {deleteConfirm?.type === 'topic' && ' All lessons in this topic will also be deleted.'}
              {deleteConfirm?.type === 'subject' && ' All topics and lessons in this subject will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
