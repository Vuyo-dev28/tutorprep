import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Upload, FileText, Trash2, Eye, Loader2, CheckCircle2, XCircle, Sparkles, RefreshCw, Pencil, Minus, ArrowRight, CircleDot, Type, Grid3X3, Move, Undo2, PenLine, Waves, MousePointer2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'motion/react';
import { regeneratePastPaper } from '@/lib/pdfProcessor';

const GEMINI_MIN_INTERVAL_MS = 0;
const geminiQueue = {
  chain: Promise.resolve(),
  lastRequestAt: 0,
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const enqueueGeminiRequest = async <T,>(task: () => Promise<T>) => {
  const run = async () => {
    const now = Date.now();
    const waitFor = Math.max(0, GEMINI_MIN_INTERVAL_MS - (now - geminiQueue.lastRequestAt));
    if (waitFor > 0) {
      await sleep(waitFor);
    }
    const result = await task();
    geminiQueue.lastRequestAt = Date.now();
    return result;
  };

  const next = geminiQueue.chain.then(run, run);
  geminiQueue.chain = next.catch(() => {});
  return next;
};

/** Detect term (1–4) from month keywords in title. SA terms: 1=Jan–Mar, 2=Apr–Jun, 3=Jul–Sep, 4=Oct–Dec. */
function detectTermFromTitle(title: string): number | null {
  if (!title || typeof title !== 'string') return null;
  const lower = title.toLowerCase();
  const termsByMonth: { pattern: RegExp; term: number }[] = [
    { pattern: /\b(january|jan|february|feb|march|mar)\b/, term: 1 },
    { pattern: /\b(april|apr|may|june|jun)\b/, term: 2 },
    { pattern: /\b(july|jul|august|aug|september|sep)\b/, term: 3 },
    { pattern: /\b(october|oct|november|nov|december|dec)\b/, term: 4 },
  ];
  for (const { pattern, term } of termsByMonth) {
    if (pattern.test(lower)) return term;
  }
  return null;
}

/** Detect year from title (e.g. 2023). Prefers the latest valid year found. */
function detectYearFromTitle(title: string): number | null {
  if (!title || typeof title !== 'string') return null;
  const matches = title.match(/\b(19\d{2}|20\d{2})\b/g);
  if (!matches || matches.length === 0) return null;
  const currentYear = new Date().getFullYear();
  const years = matches
    .map((m) => parseInt(m, 10))
    .filter((y) => !Number.isNaN(y) && y >= 2000 && y <= currentYear);
  if (years.length === 0) return null;
  return Math.max(...years);
}

type PastPaper = {
  id: string;
  title: string;
  subject: string;
  subject_name?: string | null;
  grade: number;
  grade_from?: number | null;
  grade_to?: number | null;
  curriculum: 'CAPS' | 'IEB';
  term: number;
  term_id?: string | null;
  past_paper_terms?: { term_number?: number | null } | null;
  year: number;
  exam_type?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  memo_file_url?: string | null;
  memo_file_name?: string | null;
  memo_file_size?: number | null;
  is_visible?: boolean;
  created_at: string;
};

type ErrorReport = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  created_at: string;
  updated_at: string;
};

type DrawObject =
  | { type: 'pencil'; points: { x: number; y: number }[]; color: string; rotation?: number }
  | { type: 'eraser'; points: { x: number; y: number }[]; rotation?: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; rotation?: number }
  | { type: 'vector'; x1: number; y1: number; x2: number; y2: number; color: string; rotation?: number }
  | { type: 'curve'; x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; color: string; rotation?: number }
  | { type: 'sine'; x1: number; y1: number; x2: number; y2: number; amplitude: number; cycles: number; color: string; rotation?: number }
  | { type: 'point'; x: number; y: number; color: string; rotation?: number }
  | { type: 'label'; x: number; y: number; text: string; color: string; rotation?: number }
  | { type: 'axes' }
  | { type: 'grid' };

const HANDLE_R = 8;
const ROTATE_HANDLE_OFFSET = 28;

export function PastPapersManagement() {
  const [papers, setPapers] = useState<PastPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedMemoFile, setSelectedMemoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewingPaper, setViewingPaper] = useState<PastPaper | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [regeneratingPaperId, setRegeneratingPaperId] = useState<string | null>(null);
  const [uploadingMemoPaperId, setUploadingMemoPaperId] = useState<string | null>(null);
  const [regenerationProgress, setRegenerationProgress] = useState(0);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
  } | null>(null);
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const memoReplacePaperRef = useRef<PastPaper | null>(null);
  const memoReplaceInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [regenerationNotice, setRegenerationNotice] = useState<{
    message: string;
    tone: 'success' | 'error' | 'info';
  } | null>(null);
  const [errorReports, setErrorReports] = useState<ErrorReport[]>([]);
  const [isReportsLoading, setIsReportsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'new' | 'read' | 'replied' | 'archived'>('all');
  const [subjectVisibility, setSubjectVisibility] = useState<Record<string, boolean>>({});
  const [subjectVisibilityCurriculum, setSubjectVisibilityCurriculum] = useState<'CAPS' | 'IEB'>('CAPS');
  const [editingPaper, setEditingPaper] = useState<PastPaper | null>(null);
  const [editingHtml, setEditingHtml] = useState('');
  const [isEditingLoading, setIsEditingLoading] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editingInfoPaper, setEditingInfoPaper] = useState<PastPaper | null>(null);
  const [editInfoForm, setEditInfoForm] = useState<{
    title: string;
    subject: string;
    grade: string;
    curriculum: 'CAPS' | 'IEB';
    term: string;
    year: string;
    exam_type: string;
  }>({ title: '', subject: 'Mathematics', grade: '10', curriculum: 'CAPS', term: '1', year: '', exam_type: '' });
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const editorIframeRef = useRef<HTMLIFrameElement>(null);
  const [figurePlaceholders, setFigurePlaceholders] = useState<string[]>([]);
  const [drawingForPlaceholder, setDrawingForPlaceholder] = useState<string | null>(null);
  const [drawTool, setDrawTool] = useState<'pencil' | 'line' | 'eraser' | 'vector' | 'point' | 'label' | 'curve' | 'sine' | 'select'>('pencil');
  const [drawColor, setDrawColor] = useState('#000000');
  const [drawObjects, setDrawObjects] = useState<DrawObject[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [transformMode, setTransformMode] = useState<'move' | 'rotate' | 'resize' | null>(null);
  const resizeHandleIndexRef = useRef<number>(0);
  const transformStartRef = useRef<{ x: number; y: number; angle?: number; obj?: DrawObject } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const lastCurveControlRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [curriculum, setCurriculum] = useState<'CAPS' | 'IEB'>('CAPS');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [examType, setExamType] = useState('');

  // Past paper subjects (admin-managed list)
  const [pastPaperSubjects, setPastPaperSubjects] = useState<{ id: string; name: string; sort_order: number }[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // List controls
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterTerm, setFilterTerm] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterCurriculum, setFilterCurriculum] = useState('all');
  const [filterMemo, setFilterMemo] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    loadPapers();
  }, []);

  const loadPastPaperSubjects = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('past_paper_subjects')
        .select('id, name, sort_order')
        .order('sort_order');
      if (error) throw error;
      setPastPaperSubjects((data as { id: string; name: string; sort_order: number }[]) || []);
    } catch (e) {
      console.error('Error loading past paper subjects:', e);
    }
  };

  useEffect(() => {
    loadPastPaperSubjects();
  }, []);

  useEffect(() => {
    loadErrorReports();
  }, [reportFilter]);

  useEffect(() => {
    loadSubjectVisibility();
  }, [subjectVisibilityCurriculum, papers]);

  const loadErrorReports = async () => {
    if (!supabase) return;

    try {
      let query = supabase
        .from('contact_submissions')
        .select('*')
        .ilike('subject', 'Past Paper Issue%')
        .order('created_at', { ascending: false });

      if (reportFilter !== 'all') {
        query = query.eq('status', reportFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setErrorReports(data || []);
    } catch (error) {
      console.error('Error loading past paper reports:', error);
    } finally {
      setIsReportsLoading(false);
    }
  };

  const openEditor = async (paper: PastPaper) => {
    if (!supabase) return;
    if (!paper.file_url.toLowerCase().endsWith('.html')) {
      alert('This paper is still a PDF. Please regenerate it to HTML before editing.');
      return;
    }

    try {
      setIsEditingLoading(true);
      const { data, error } = await supabase.storage
        .from('past-papers')
        .download(paper.file_url);

      if (error) throw error;
      const text = await data.text();
      setEditingPaper(paper);
      setEditingHtml(text);
      const placeholders = [...text.matchAll(/\[FIGURE:[^\]]+\]/g)].map((m) => m[0]);
      setFigurePlaceholders(placeholders);
    } catch (error) {
      console.error('Error loading editable paper HTML:', error);
      alert('Failed to load paper for editing. Please try again.');
    } finally {
      setIsEditingLoading(false);
    }
  };

  // When editor is open, load HTML into iframe for WYSIWYG editing (view form)
  useEffect(() => {
    if (!editingPaper || !editingHtml || isEditingLoading) return;
    const iframe = editorIframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    const sanitized = editingHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    doc.open();
    doc.write(sanitized);
    doc.close();
    doc.designMode = 'on';
  }, [editingPaper, editingHtml, isEditingLoading]);

  const drawModalJustOpenedRef = useRef(false);
  // Init drawing canvas when draw modal opens: clear objects and canvas
  useEffect(() => {
    if (!drawingForPlaceholder) return;
    drawModalJustOpenedRef.current = true;
    setDrawObjects([]);
    setSelectedIndex(null);
    setTransformMode(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor = drawTool === 'select' ? 'default' : 'crosshair';
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [drawingForPlaceholder]);

  useEffect(() => {
    if (!drawingForPlaceholder) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (transformMode === 'move') canvas.style.cursor = 'grabbing';
    else if (transformMode === 'rotate') canvas.style.cursor = 'crosshair';
    else if (transformMode === 'resize') canvas.style.cursor = 'nwse-resize';
    else if (drawTool === 'select') canvas.style.cursor = 'default';
    else canvas.style.cursor = 'crosshair';
  }, [drawingForPlaceholder, drawTool, transformMode]);

  const figureUploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFigureFor, setUploadingFigureFor] = useState<string | null>(null);
  const [uploadTargetPlaceholder, setUploadTargetPlaceholder] = useState<string | null>(null);

  const INSERT_CHART_AT_CURSOR = '__INSERT_AT_CURSOR__';

  const replacePlaceholderWithImage = (placeholder: string, imageUrl: string) => {
    const doc = editorIframeRef.current?.contentDocument;
    if (!doc) return;
    const imgTag = `<img src="${imageUrl}" alt="Chart" style="max-width:100%;height:auto;" />`;
    doc.body.innerHTML = doc.body.innerHTML.replace(placeholder, imgTag);
    setFigurePlaceholders((prev) => prev.filter((p) => p !== placeholder));
  };

  const insertImageAtCursor = (imageUrl: string) => {
    const doc = editorIframeRef.current?.contentDocument;
    if (!doc) return;
    const imgHtml = `<img src="${imageUrl}" alt="Chart" style="max-width:100%;height:auto;" />`;
    doc.execCommand('insertHTML', false, imgHtml);
  };

  const handleInsertDrawnChart = async (blob: Blob) => {
    if (!supabase || !editingPaper || !drawingForPlaceholder) return;
    try {
      const path = `figures/${editingPaper.id}_${Date.now()}.png`;
      const { error } = await supabase.storage.from('past-papers').upload(path, blob, {
        contentType: 'image/png',
        cacheControl: '3600',
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from('past-papers').createSignedUrl(path, 315360000); // 10 years
      const url = signed?.signedUrl ?? supabase.storage.from('past-papers').getPublicUrl(path).data.publicUrl;
      if (drawingForPlaceholder === INSERT_CHART_AT_CURSOR) {
        insertImageAtCursor(url);
      } else {
        replacePlaceholderWithImage(drawingForPlaceholder, url);
      }
      setDrawingForPlaceholder(null);
    } catch (err) {
      console.error('Error uploading drawn chart:', err);
      alert('Failed to upload chart.');
    }
  };

  const handleFigureFileSelect = async (placeholder: string, file: File) => {
    if (!supabase || !editingPaper) return;
    setUploadingFigureFor(placeholder);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `figures/${editingPaper.id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('past-papers').upload(path, file, {
        cacheControl: '3600',
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from('past-papers').createSignedUrl(path, 315360000); // 10 years
      const url = signed?.signedUrl ?? supabase.storage.from('past-papers').getPublicUrl(path).data.publicUrl;
      if (placeholder === INSERT_CHART_AT_CURSOR) {
        insertImageAtCursor(url);
      } else {
        replacePlaceholderWithImage(placeholder, url);
      }
    } catch (err) {
      console.error('Error uploading figure:', err);
      alert('Failed to upload image.');
    } finally {
      setUploadingFigureFor(null);
      setUploadTargetPlaceholder(null);
      if (figureUploadInputRef.current) figureUploadInputRef.current.value = '';
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  };

  const rotatePoint = (px: number, py: number, cx: number, cy: number, angleRad: number) => {
    const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
    const dx = px - cx, dy = py - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };

  const getCenter = (obj: DrawObject, canvas?: HTMLCanvasElement): { x: number; y: number } => {
    const cw = canvas?.width ?? 600, ch = canvas?.height ?? 400;
    switch (obj.type) {
      case 'line':
      case 'vector':
        return { x: (obj.x1 + obj.x2) / 2, y: (obj.y1 + obj.y2) / 2 };
      case 'curve': {
        const minX = Math.min(obj.x1, obj.cx, obj.x2), maxX = Math.max(obj.x1, obj.cx, obj.x2);
        const minY = Math.min(obj.y1, obj.cy, obj.y2), maxY = Math.max(obj.y1, obj.cy, obj.y2);
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      }
      case 'sine':
        return { x: (obj.x1 + obj.x2) / 2, y: (obj.y1 + obj.y2) / 2 };
      case 'point':
      case 'label':
        return { x: obj.x, y: obj.y };
      case 'pencil':
      case 'eraser': {
        if (obj.points.length === 0) return { x: 0, y: 0 };
        const sx = obj.points.reduce((a, p) => a + p.x, 0);
        const sy = obj.points.reduce((a, p) => a + p.y, 0);
        return { x: sx / obj.points.length, y: sy / obj.points.length };
      }
      case 'axes':
      case 'grid':
        return { x: cw / 2, y: ch / 2 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const getBounds = (obj: DrawObject, canvas?: HTMLCanvasElement): { minX: number; minY: number; maxX: number; maxY: number } => {
    const pad = 4;
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    const push = (x: number, y: number) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };
    switch (obj.type) {
      case 'line':
      case 'vector':
        push(obj.x1, obj.y1); push(obj.x2, obj.y2);
        break;
      case 'curve':
        push(obj.x1, obj.y1); push(obj.cx, obj.cy); push(obj.x2, obj.y2);
        break;
      case 'sine': {
        const dx = obj.x2 - obj.x1, dy = obj.y2 - obj.y1;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len, perpY = dx / len;
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const bx = obj.x1 + t * dx, by = obj.y1 + t * dy;
          const w = obj.amplitude * Math.sin(2 * Math.PI * obj.cycles * t);
          push(bx + perpX * w, by + perpY * w);
        }
        break;
      }
      case 'point':
        push(obj.x - 5, obj.y - 5); push(obj.x + 5, obj.y + 5);
        break;
      case 'label':
        push(obj.x, obj.y); push(obj.x + obj.text.length * 8, obj.y + 16);
        break;
      case 'pencil':
      case 'eraser':
        obj.points.forEach((p) => push(p.x, p.y));
        if (obj.type === 'eraser') { minX -= 12; maxX += 12; minY -= 12; maxY += 12; }
        break;
      case 'axes':
      case 'grid':
        minX = 0; minY = 0; maxX = canvas?.width ?? 600; maxY = canvas?.height ?? 400;
        break;
      default:
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    const rot = 'rotation' in obj ? (obj.rotation ?? 0) : 0;
    if (rot !== 0 && obj.type !== 'axes' && obj.type !== 'grid') {
      const c = getCenter(obj, canvas);
      const corners = [
        rotatePoint(minX, minY, c.x, c.y, rot),
        rotatePoint(maxX, minY, c.x, c.y, rot),
        rotatePoint(maxX, maxY, c.x, c.y, rot),
        rotatePoint(minX, maxY, c.x, c.y, rot),
      ];
      minX = Math.min(...corners.map((p) => p.x)); maxX = Math.max(...corners.map((p) => p.x));
      minY = Math.min(...corners.map((p) => p.y)); maxY = Math.max(...corners.map((p) => p.y));
    }
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  };

  const getHandles = (obj: DrawObject, canvas?: HTMLCanvasElement): { x: number; y: number; kind: 'resize' | 'rotate' }[] => {
    const out: { x: number; y: number; kind: 'resize' | 'rotate' }[] = [];
    if (obj.type === 'axes' || obj.type === 'grid') return out;
    const rot = 'rotation' in obj ? (obj.rotation ?? 0) : 0;
    const c = getCenter(obj, canvas);
    const b = getBounds(obj, canvas);
    const midY = (b.minY + b.maxY) / 2;
    const rotateY = b.minY - ROTATE_HANDLE_OFFSET;
    const rotHandle = rotatePoint(c.x, rotateY, c.x, midY, rot);
    out.push({ x: rotHandle.x, y: rotHandle.y, kind: 'rotate' });
    const rotPt = (x: number, y: number) => (rot !== 0 ? rotatePoint(x, y, c.x, c.y, rot) : { x, y });
    if (obj.type === 'line' || obj.type === 'vector') {
      const p1 = rotPt(obj.x1, obj.y1), p2 = rotPt(obj.x2, obj.y2);
      out.push({ x: p1.x, y: p1.y, kind: 'resize' }, { x: p2.x, y: p2.y, kind: 'resize' });
    } else if (obj.type === 'curve') {
      const p1 = rotPt(obj.x1, obj.y1), pc = rotPt(obj.cx, obj.cy), p2 = rotPt(obj.x2, obj.y2);
      out.push({ x: p1.x, y: p1.y, kind: 'resize' }, { x: pc.x, y: pc.y, kind: 'resize' }, { x: p2.x, y: p2.y, kind: 'resize' });
    } else if (obj.type === 'sine') {
      const p1 = rotPt(obj.x1, obj.y1), p2 = rotPt(obj.x2, obj.y2);
      out.push({ x: p1.x, y: p1.y, kind: 'resize' }, { x: p2.x, y: p2.y, kind: 'resize' });
    } else if (obj.type === 'point') {
      const p = rotPt(obj.x, obj.y);
      out.push({ x: p.x, y: p.y, kind: 'resize' });
    } else if (obj.type === 'label') {
      const p = rotPt(obj.x, obj.y);
      out.push({ x: p.x, y: p.y, kind: 'resize' });
    } else if (obj.type === 'pencil' || obj.type === 'eraser') {
      // move only, no resize handles
    }
    return out;
  };

  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
    const projX = x1 + t * dx, projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  };

  const hitTest = (obj: DrawObject, px: number, py: number, canvas?: HTMLCanvasElement): boolean => {
    const rot = 'rotation' in obj ? (obj.rotation ?? 0) : 0;
    const c = getCenter(obj, canvas);
    const toLocal = (wx: number, wy: number) => rotatePoint(wx, wy, c.x, c.y, -rot);
    const local = toLocal(px, py);
    const lx = local.x, ly = local.y;
    const thresh = 12;
    switch (obj.type) {
      case 'line':
      case 'vector':
        return distToSegment(lx, ly, obj.x1, obj.y1, obj.x2, obj.y2) <= thresh;
      case 'curve': {
        const steps = 40;
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const u = 1 - t;
          const x = u * u * obj.x1 + 2 * u * t * obj.cx + t * t * obj.x2;
          const y = u * u * obj.y1 + 2 * u * t * obj.cy + t * t * obj.y2;
          if (Math.hypot(lx - x, ly - y) <= thresh) return true;
        }
        return false;
      }
      case 'sine': {
        const dx = obj.x2 - obj.x1, dy = obj.y2 - obj.y1;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len, perpY = dx / len;
        const steps = Math.max(10, Math.floor(len / 4));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const bx = obj.x1 + t * dx, by = obj.y1 + t * dy;
          const w = obj.amplitude * Math.sin(2 * Math.PI * obj.cycles * t);
          const sx = bx + perpX * w, sy = by + perpY * w;
          if (Math.hypot(lx - sx, ly - sy) <= thresh) return true;
        }
        return false;
      }
      case 'point':
        return Math.hypot(lx - obj.x, ly - obj.y) <= 14;
      case 'label':
        return lx >= obj.x - 2 && lx <= obj.x + obj.text.length * 8 + 2 && ly >= obj.y - 14 && ly <= obj.y + 4;
      case 'pencil':
      case 'eraser':
        for (let i = 0; i < obj.points.length - 1; i++) {
          if (distToSegment(lx, ly, obj.points[i].x, obj.points[i].y, obj.points[i + 1].x, obj.points[i + 1].y) <= (obj.type === 'eraser' ? 16 : thresh)) return true;
        }
        return false;
      case 'axes':
      case 'grid': {
        const b = getBounds(obj, canvas);
        return px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
      }
      default:
        return false;
    }
  };

  const hitTestHandle = (obj: DrawObject, px: number, py: number, canvas?: HTMLCanvasElement): { index: number; kind: 'resize' | 'rotate' } | null => {
    const handles = getHandles(obj, canvas);
    for (let i = 0; i < handles.length; i++) {
      const h = handles[i];
      if (Math.hypot(px - h.x, py - h.y) <= HANDLE_R) return { index: i, kind: h.kind };
    }
    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e);
    if (!p) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (drawTool === 'select') {
      const sel = selectedIndex;
      const obj = sel !== null ? drawObjects[sel] : null;
      if (obj && hitTestHandle(obj, p.x, p.y, canvas)) {
        const h = hitTestHandle(obj, p.x, p.y, canvas)!;
        if (h.kind === 'rotate') {
          setTransformMode('rotate');
          const c = getCenter(obj, canvas);
          transformStartRef.current = { x: p.x, y: p.y, angle: (obj as { rotation?: number }).rotation ?? 0, obj: { ...obj } };
        } else {
          setTransformMode('resize');
          resizeHandleIndexRef.current = h.index;
          transformStartRef.current = { x: p.x, y: p.y, obj: { ...obj } };
        }
      } else if (obj && hitTest(obj, p.x, p.y, canvas)) {
        setTransformMode('move');
        transformStartRef.current = { x: p.x, y: p.y, obj: JSON.parse(JSON.stringify(obj)) };
      } else {
        let found: number | null = null;
        for (let i = drawObjects.length - 1; i >= 0; i--) {
          if (hitTest(drawObjects[i], p.x, p.y, canvas)) { found = i; break; }
        }
        setSelectedIndex(found);
        if (found !== null) {
          setTransformMode('move');
          transformStartRef.current = { x: p.x, y: p.y, obj: JSON.parse(JSON.stringify(drawObjects[found])) };
        } else {
          setTransformMode(null);
          transformStartRef.current = null;
        }
      }
      return;
    }

    isDrawingRef.current = true;
    drawStartRef.current = p;
    if (drawTool === 'pencil' || drawTool === 'eraser') {
      currentStrokePointsRef.current = [p];
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (drawTool === 'pencil' || drawTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  };

  const redrawCanvasWithPreview = (preview: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawObjects.forEach((obj) => drawOneObject(ctx, canvas, obj));
    preview(ctx);
  };

  const applyMove = (obj: DrawObject, dx: number, dy: number): DrawObject => {
    if (obj.type === 'line' || obj.type === 'vector') return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy };
    if (obj.type === 'curve') return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, cx: obj.cx + dx, cy: obj.cy + dy, x2: obj.x2 + dx, y2: obj.y2 + dy };
    if (obj.type === 'sine') return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy };
    if (obj.type === 'point' || obj.type === 'label') return { ...obj, x: obj.x + dx, y: obj.y + dy };
    if (obj.type === 'pencil' || obj.type === 'eraser') return { ...obj, points: obj.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) };
    return obj;
  };

  const applyResize = (obj: DrawObject, handleIndex: number, x: number, y: number, canvas?: HTMLCanvasElement): DrawObject => {
    const rot = 'rotation' in obj ? (obj.rotation ?? 0) : 0;
    const c = getCenter(obj, canvas);
    const worldToLocal = (wx: number, wy: number) => (rot !== 0 ? rotatePoint(wx, wy, c.x, c.y, -rot) : { x: wx, y: wy });
    const pt = worldToLocal(x, y);
    const px = pt.x, py = pt.y;
    if (obj.type === 'line' || obj.type === 'vector') {
      if (handleIndex === 1) return { ...obj, x1: px, y1: py };
      if (handleIndex === 2) return { ...obj, x2: px, y2: py };
      return obj;
    }
    if (obj.type === 'curve') {
      if (handleIndex === 1) return { ...obj, x1: px, y1: py };
      if (handleIndex === 2) return { ...obj, cx: px, cy: py };
      if (handleIndex === 3) return { ...obj, x2: px, y2: py };
      return obj;
    }
    if (obj.type === 'sine') {
      if (handleIndex === 1) return { ...obj, x1: px, y1: py };
      if (handleIndex === 2) return { ...obj, x2: px, y2: py };
      return obj;
    }
    if (obj.type === 'point' || obj.type === 'label') {
      if (handleIndex === 1) return { ...obj, x: px, y: py };
      return obj;
    }
    return obj;
  };

  const updateCanvasCursor = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (transformMode === 'move') {
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (transformMode === 'rotate') {
      canvas.style.cursor = 'crosshair';
      return;
    }
    if (transformMode === 'resize') {
      canvas.style.cursor = 'nwse-resize';
      return;
    }
    if (drawTool === 'select') {
      const p = getCanvasPoint(e);
      if (!p) {
        canvas.style.cursor = 'default';
        return;
      }
      const sel = selectedIndex;
      const obj = sel !== null ? drawObjects[sel] : null;
      if (obj && hitTestHandle(obj, p.x, p.y, canvas)) {
        const h = hitTestHandle(obj, p.x, p.y, canvas)!;
        canvas.style.cursor = h.kind === 'rotate' ? 'crosshair' : 'nwse-resize';
      } else {
        let overAny = false;
        for (let i = drawObjects.length - 1; i >= 0; i--) {
          if (hitTest(drawObjects[i], p.x, p.y, canvas)) {
            overAny = true;
            break;
          }
        }
        canvas.style.cursor = overAny ? 'grab' : 'default';
      }
      return;
    }
    canvas.style.cursor = 'crosshair';
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e);
    if (!p) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    updateCanvasCursor(e);

    if (transformMode && selectedIndex !== null) {
      const start = transformStartRef.current;
      if (!start || !start.obj) return;
      if (transformMode === 'move') {
        const dx = p.x - start.x, dy = p.y - start.y;
        setDrawObjects((prev) => {
          const next = [...prev];
          next[selectedIndex] = applyMove(start.obj!, dx, dy);
          return next;
        });
        transformStartRef.current = { ...start, x: p.x, y: p.y, obj: applyMove(start.obj, dx, dy) };
      } else if (transformMode === 'rotate') {
        const obj = drawObjects[selectedIndex];
        const c = getCenter(obj, canvas);
        const startAngle = Math.atan2(start.y! - c.y, start.x! - c.x);
        const currentAngle = Math.atan2(p.y - c.y, p.x - c.x);
        const newRotation = (start.angle ?? 0) + (currentAngle - startAngle);
        setDrawObjects((prev) => {
          const next = [...prev];
          const o = next[selectedIndex] as DrawObject & { rotation?: number };
          next[selectedIndex] = { ...o, rotation: newRotation };
          return next;
        });
      } else if (transformMode === 'resize') {
        const idx = resizeHandleIndexRef.current;
        setDrawObjects((prev) => {
          const next = [...prev];
          next[selectedIndex] = applyResize(prev[selectedIndex], idx, p.x, p.y, canvas);
          return next;
        });
      }
      return;
    }

    if (!isDrawingRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const start = drawStartRef.current;

    if (drawTool === 'pencil') {
      currentStrokePointsRef.current.push(p);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 2;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (drawTool === 'eraser') {
      currentStrokePointsRef.current.push(p);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 24;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (start && (drawTool === 'line' || drawTool === 'vector' || drawTool === 'curve' || drawTool === 'sine')) {
      redrawCanvasWithPreview((ctx) => {
        if (drawTool === 'line') {
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (drawTool === 'vector') {
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          drawArrowhead(ctx, start.x, start.y, p.x, p.y, drawColor, 12);
        } else if (drawTool === 'curve') {
          const control = curveControl(start.x, start.y, p.x, p.y, 0.25);
          lastCurveControlRef.current = control;
          drawCurvePreview(ctx, start.x, start.y, p.x, p.y, control, drawColor, 2);
        } else if (drawTool === 'sine') {
          drawSinePreview(ctx, start.x, start.y, p.x, p.y, 25, 3, drawColor, 2);
        }
      });
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e);
    const start = drawStartRef.current;

    if (drawTool === 'line' && start && p) {
      setDrawObjects((prev) => [...prev, { type: 'line', x1: start.x, y1: start.y, x2: p.x, y2: p.y, color: drawColor }]);
    } else if (drawTool === 'vector' && start && p) {
      setDrawObjects((prev) => [...prev, { type: 'vector', x1: start.x, y1: start.y, x2: p.x, y2: p.y, color: drawColor }]);
    } else if (drawTool === 'curve' && start && p) {
      const control = lastCurveControlRef.current ?? curveControl(start.x, start.y, p.x, p.y, 0.25);
      setDrawObjects((prev) => [...prev, { type: 'curve', x1: start.x, y1: start.y, cx: control.x, cy: control.y, x2: p.x, y2: p.y, color: drawColor }]);
    } else if (drawTool === 'sine' && start && p) {
      setDrawObjects((prev) => [...prev, { type: 'sine', x1: start.x, y1: start.y, x2: p.x, y2: p.y, amplitude: 25, cycles: 3, color: drawColor }]);
    } else if (drawTool === 'point' && p) {
      setDrawObjects((prev) => [...prev, { type: 'point', x: p.x, y: p.y, color: drawColor }]);
    } else if (drawTool === 'label' && p) {
      const text = window.prompt('Label text (e.g. A(-3;4), x, f):', '');
      if (text) {
        setDrawObjects((prev) => [...prev, { type: 'label', x: p.x, y: p.y, text, color: drawColor }]);
      }
    } else if (drawTool === 'pencil' && currentStrokePointsRef.current.length > 0) {
      setDrawObjects((prev) => [...prev, { type: 'pencil', points: [...currentStrokePointsRef.current], color: drawColor }]);
    } else if (drawTool === 'eraser' && currentStrokePointsRef.current.length > 0) {
      setDrawObjects((prev) => [...prev, { type: 'eraser', points: [...currentStrokePointsRef.current] }]);
    }

    if (transformMode) {
      setTransformMode(null);
      transformStartRef.current = null;
    }
    isDrawingRef.current = false;
    drawStartRef.current = null;
    currentStrokePointsRef.current = [];
    lastCurveControlRef.current = null;
  };

  const clearDrawingCanvas = () => {
    setDrawObjects([]);
    setSelectedIndex(null);
    setTransformMode(null);
  };

  const curveControl = (x1: number, y1: number, x2: number, y2: number, bulge = 0.25) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const offset = len * bulge;
    return { x: mx + perpX * offset, y: my + perpY * offset };
  };

  const drawCurvePreview = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, control: { x: number; y: number }, color: string, lineWidth = 2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(control.x, control.y, x2, y2);
    ctx.stroke();
  };

  const drawSinePreview = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, amplitude: number, cycles: number, color: string, lineWidth = 2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const perpX = -uy;
    const perpY = ux;
    const steps = Math.max(2, Math.floor(len / 2));
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const baseX = x1 + t * dx;
      const baseY = y1 + t * dy;
      const wave = amplitude * Math.sin(2 * Math.PI * cycles * t);
      ctx.lineTo(baseX + perpX * wave, baseY + perpY * wave);
    }
    ctx.stroke();
  };

  const drawArrowhead = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string, size = 12) => {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - size * Math.cos(angle - 0.4), toY - size * Math.sin(angle - 0.4));
    ctx.lineTo(toX - size * 0.7 * Math.cos(angle), toY - size * 0.7 * Math.sin(angle));
    ctx.lineTo(toX - size * Math.cos(angle + 0.4), toY - size * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  const drawAxes = () => setDrawObjects((prev) => [...prev, { type: 'axes' }]);

  const drawGridOnCanvas = () => setDrawObjects((prev) => [...prev, { type: 'grid' }]);

  const drawOneObject = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, obj: DrawObject) => {
    const rot = 'rotation' in obj ? (obj.rotation ?? 0) : 0;
    if (rot !== 0 && obj.type !== 'axes' && obj.type !== 'grid') {
      const c = getCenter(obj, canvas);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(rot);
      ctx.translate(-c.x, -c.y);
    }
    switch (obj.type) {
      case 'pencil':
        if (obj.points.length < 2) return;
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
        ctx.stroke();
        break;
      case 'eraser':
        if (obj.points.length < 2) return;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
        ctx.stroke();
        break;
      case 'line':
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
        ctx.stroke();
        break;
      case 'vector':
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
        ctx.stroke();
        drawArrowhead(ctx, obj.x1, obj.y1, obj.x2, obj.y2, obj.color, 12);
        break;
      case 'curve':
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.quadraticCurveTo(obj.cx, obj.cy, obj.x2, obj.y2);
        ctx.stroke();
        break;
      case 'sine':
        drawSinePreview(ctx, obj.x1, obj.y1, obj.x2, obj.y2, obj.amplitude, obj.cycles, obj.color, 2);
        break;
      case 'point':
        ctx.fillStyle = obj.color;
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'label':
        ctx.fillStyle = obj.color;
        ctx.font = '14px sans-serif';
        ctx.fillText(obj.text, obj.x, obj.y);
        break;
      case 'axes': {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const margin = 40;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(margin, cy);
        ctx.lineTo(canvas.width - margin, cy);
        ctx.stroke();
        drawArrowhead(ctx, canvas.width - margin - 10, cy, canvas.width - margin, cy, '#333', 10);
        ctx.beginPath();
        ctx.moveTo(cx, canvas.height - margin);
        ctx.lineTo(cx, margin);
        ctx.stroke();
        drawArrowhead(ctx, cx, margin + 10, cx, margin, '#333', 10);
        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        ctx.fillText('x', canvas.width - margin - 20, cy - 10);
        ctx.fillText('y', cx + 10, margin + 20);
        break;
      }
      case 'grid': {
        const step = 40;
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        break;
      }
    }
    if (rot !== 0 && obj.type !== 'axes' && obj.type !== 'grid') ctx.restore();
  };

  const drawSelectionUI = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, obj: DrawObject) => {
    const b = getBounds(obj, canvas);
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.setLineDash([]);
    const handles = getHandles(obj, canvas);
    handles.forEach((h) => {
      ctx.fillStyle = h.kind === 'rotate' ? '#1a73e8' : '#fff';
      ctx.strokeStyle = '#1a73e8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, HANDLE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  };

  // Redraw canvas from drawObjects whenever they change
  useEffect(() => {
    if (!drawingForPlaceholder) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const list = drawModalJustOpenedRef.current ? [] : drawObjects;
    if (drawModalJustOpenedRef.current) drawModalJustOpenedRef.current = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    list.forEach((obj) => drawOneObject(ctx, canvas, obj));
    if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < list.length) {
      drawSelectionUI(ctx, canvas, list[selectedIndex]);
    }
  }, [drawingForPlaceholder, drawObjects, selectedIndex]);

  const saveEditorChanges = async () => {
    if (!supabase || !editingPaper) return;
    try {
      setIsSavingEdit(true);
      // Read edited content from iframe (view form) instead of raw state
      const htmlToSave =
        editorIframeRef.current?.contentDocument?.documentElement?.outerHTML ?? editingHtml;
      const blob = new Blob([htmlToSave], { type: 'text/html' });
      const { error } = await supabase.storage
        .from('past-papers')
        .upload(editingPaper.file_url, blob, {
          upsert: true,
          contentType: 'text/html',
        });
      if (error) throw error;
      alert('Paper changes saved.');
      setEditingPaper(null);
      setEditingHtml('');
    } catch (error) {
      console.error('Error saving edited paper HTML:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const updateReportStatus = async (id: string, status: ErrorReport['status']) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await loadErrorReports();
      if (selectedReport?.id === id) {
        setSelectedReport({ ...selectedReport, status });
      }
    } catch (error) {
      console.error('Error updating report status:', error);
    }
  };

  const loadSubjectVisibility = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('past_paper_subject_visibility')
        .select('subject,is_visible,curriculum')
        .eq('curriculum', subjectVisibilityCurriculum);

      if (error) throw error;
      const visibilityMap: Record<string, boolean> = {};
      (data || []).forEach((row: { subject: string; is_visible: boolean }) => {
        visibilityMap[row.subject] = row.is_visible;
      });
      setSubjectVisibility(visibilityMap);
    } catch (error) {
      console.error('Error loading subject visibility:', error);
    }
  };

  const toggleSubjectVisibility = async (subjectName: string, nextValue: boolean) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('past_paper_subject_visibility')
        .upsert(
          {
            subject: subjectName,
            curriculum: subjectVisibilityCurriculum,
            is_visible: nextValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'subject,curriculum' }
        );
      if (error) throw error;
      setSubjectVisibility((prev) => ({ ...prev, [subjectName]: nextValue }));
    } catch (error) {
      console.error('Error updating subject visibility:', error);
    }
  };

  const addSubject = async () => {
    const name = newSubjectName.trim();
    if (!name || !supabase) return;
    setIsAddingSubject(true);
    try {
      const { error } = await supabase
        .from('past_paper_subjects')
        .insert({ name, sort_order: pastPaperSubjects.length });
      if (error) throw error;
      setNewSubjectName('');
      await loadPastPaperSubjects();
    } catch (e: any) {
      console.error('Error adding subject:', e);
      alert(e?.message?.includes('unique') ? 'A subject with that name already exists.' : 'Failed to add subject.');
    } finally {
      setIsAddingSubject(false);
    }
  };

  const deleteSubject = async (id: string, name: string) => {
    if (!supabase) return;
    const inUse = papers.some((p) => (p.subject || p.subject_name || '').trim() === name.trim());
    if (inUse) {
      alert(`Cannot remove "${name}" because some past papers use it. Change those papers to another subject first.`);
      return;
    }
    if (!confirm(`Remove subject "${name}"?`)) return;
    try {
      const { error } = await supabase.from('past_paper_subjects').delete().eq('id', id);
      if (error) throw error;
      await loadPastPaperSubjects();
    } catch (e: any) {
      console.error('Error deleting subject:', e);
      alert('Failed to remove subject.');
    }
  };

  const getReportStatusBadge = (status: ErrorReport['status']) => {
    const variants = {
      new: { className: 'bg-blue-100 text-blue-700', label: 'New' },
      read: { className: 'bg-gray-100 text-gray-700', label: 'Read' },
      replied: { className: 'bg-green-100 text-green-700', label: 'Replied' },
      archived: { className: 'bg-slate-100 text-slate-700', label: 'Archived' },
    };
    const variant = variants[status];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const subjectOptions = useMemo(() => {
    return pastPaperSubjects.map((s) => s.name);
  }, [pastPaperSubjects]);

  const visibilitySubjectOptions = useMemo(() => pastPaperSubjects.map((s) => s.name), [pastPaperSubjects]);

  const gradeOptions = useMemo(() => {
    return Array.from(new Set(papers.map((paper) => paper.grade))).sort((a, b) => a - b);
  }, [papers]);

  const termOptions = useMemo(() => {
    return Array.from(new Set(papers.map((paper) => paper.term))).sort((a, b) => a - b);
  }, [papers]);

  const yearOptions = useMemo(() => {
    return Array.from(new Set(papers.map((paper) => paper.year))).sort((a, b) => b - a);
  }, [papers]);

  const curriculumOptions = useMemo(() => {
    return Array.from(new Set(papers.map((paper) => paper.curriculum))).sort();
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let result = [...papers];

    if (normalizedQuery) {
      result = result.filter((paper) => {
        const haystack = [
          paper.title,
          paper.subject,
          paper.exam_type,
          paper.file_name,
          paper.memo_file_name,
          paper.year?.toString(),
          paper.grade?.toString(),
          paper.term?.toString(),
          paper.curriculum,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    if (filterSubject !== 'all') {
      result = result.filter((paper) => paper.subject === filterSubject);
    }

    if (filterGrade !== 'all') {
      result = result.filter((paper) => paper.grade.toString() === filterGrade);
    }

    if (filterTerm !== 'all') {
      result = result.filter((paper) => paper.term.toString() === filterTerm);
    }

    if (filterYear !== 'all') {
      result = result.filter((paper) => paper.year.toString() === filterYear);
    }

    if (filterCurriculum !== 'all') {
      result = result.filter((paper) => paper.curriculum === filterCurriculum);
    }

    if (filterMemo !== 'all') {
      result = result.filter((paper) =>
        filterMemo === 'with_memo' ? Boolean(paper.memo_file_url) : !paper.memo_file_url
      );
    }

    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'year_asc':
        result.sort((a, b) => a.year - b.year);
        break;
      case 'year_desc':
        result.sort((a, b) => b.year - a.year);
        break;
      case 'title_asc':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title_desc':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [
    papers,
    searchQuery,
    filterSubject,
    filterGrade,
    filterTerm,
    filterYear,
    filterCurriculum,
    filterMemo,
    sortBy,
  ]);

  const unprocessedPapers = useMemo(
    () => papers.filter((p) => p.file_url.toLowerCase().endsWith('.pdf')),
    [papers]
  );

  const normalizePaper = (row: any): PastPaper => {
    const subjectValue = row.subject ?? row.subject_name ?? 'Mathematics';
    const gradeValue = row.grade ?? row.grade_from ?? row.grade_to ?? 8;
    const termValue = row.term ?? row.past_paper_terms?.term_number ?? 1;
    return {
      ...row,
      subject: subjectValue,
      grade: gradeValue,
      term: termValue,
      is_visible: row.is_visible ?? true,
    } as PastPaper;
  };

  const loadPapers = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('past_papers')
        .select('*, past_paper_terms(term_number)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalized = (data || []).map(normalizePaper);
      setPapers(normalized);
    } catch (error) {
      console.error('Error loading past papers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePaperVisibility = async (paper: PastPaper) => {
    if (!supabase) return;
    const nextValue = !(paper.is_visible ?? true);

    try {
      const { error } = await supabase
        .from('past_papers')
        .update({ is_visible: nextValue, updated_at: new Date().toISOString() })
        .eq('id', paper.id);

      if (error) throw error;
      setPapers((prev) =>
        prev.map((item) => (item.id === paper.id ? { ...item, is_visible: nextValue } : item))
      );
    } catch (error) {
      console.error('Error updating paper visibility:', error);
    }
  };

  const openEditInfo = (paper: PastPaper) => {
    setEditingInfoPaper(paper);
    setEditInfoForm({
      title: paper.title,
      subject: paper.subject_name ?? paper.subject ?? 'Mathematics',
      grade: String(paper.grade_from ?? paper.grade ?? paper.grade_to ?? 10),
      curriculum: paper.curriculum ?? 'CAPS',
      term: String(paper.term ?? paper.past_paper_terms?.term_number ?? 1),
      year: String(paper.year ?? new Date().getFullYear()),
      exam_type: paper.exam_type ?? '',
    });
  };

  const saveEditInfo = async () => {
    if (!supabase || !editingInfoPaper) return;
    const termNumber = parseInt(editInfoForm.term, 10);
    const yearNum = parseInt(editInfoForm.year, 10);
    const gradeNum = parseInt(editInfoForm.grade, 10);
    if (!editInfoForm.title.trim()) {
      alert('Title is required.');
      return;
    }
    if (Number.isNaN(yearNum) || yearNum < 2000 || yearNum > new Date().getFullYear()) {
      alert('Please enter a valid year.');
      return;
    }
    setIsSavingInfo(true);
    try {
      const { data: termData, error: termError } = await supabase
        .from('past_paper_terms')
        .select('id')
        .eq('term_number', termNumber)
        .maybeSingle();
      if (termError) throw termError;
      if (!termData) throw new Error(`Term ${termNumber} not found.`);

      const { error: updateError } = await supabase
        .from('past_papers')
        .update({
          title: editInfoForm.title.trim(),
          subject: editInfoForm.subject,
          subject_name: editInfoForm.subject,
          grade: gradeNum,
          grade_from: gradeNum,
          grade_to: gradeNum,
          curriculum: editInfoForm.curriculum,
          term: termNumber,
          term_id: termData.id,
          year: yearNum,
          exam_type: editInfoForm.exam_type.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingInfoPaper.id);

      if (updateError) throw updateError;
      await loadPapers();
      setEditingInfoPaper(null);
    } catch (error: any) {
      console.error('Error saving paper info:', error);
      alert(error?.message ?? 'Failed to save. Please try again.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const pdfs = files.filter((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      return isPdf;
    });
    const skipped = files.length - pdfs.length;
    if (skipped > 0) {
      alert(`${skipped} file(s) skipped (only PDF is supported). ${pdfs.length} PDF(s) selected.`);
    }
    if (pdfs.length === 0) {
      alert('Please upload PDF files only.');
      return;
    }

    setSelectedFiles(pdfs);
    if (pdfs.length === 1 && !title) {
      const nameWithoutExt = pdfs[0].name.replace(/\.(pdf|doc|docx)$/i, '');
      setTitle(nameWithoutExt);
      const detected = detectTermFromTitle(nameWithoutExt);
      if (detected !== null) setTerm(String(detected));
      const detectedYear = detectYearFromTitle(nameWithoutExt);
      if (detectedYear !== null) setYear(String(detectedYear));
    }
  };

  const handleMemoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const isPdf = fileType === 'application/pdf' || fileName.endsWith('.pdf');

    if (!isPdf) {
      alert('Please upload a PDF memo file (.pdf) only.');
      return;
    }

    setSelectedMemoFile(file);
  };

  const convertWordToPdf = async (file: File): Promise<File> => {
    // Note: This is a placeholder. In production, you would need to:
    // 1. Use a server-side service (like LibreOffice headless, or a cloud service)
    // 2. Or use a client-side library like pdf-lib with mammoth.js to convert Word to PDF
    // For now, we'll show an alert that Word conversion needs server-side processing
    
    // If it's already a PDF, return it
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return file;
    }

    // For Word files, we'll need server-side conversion
    // This is a limitation - Word to PDF conversion typically requires server-side processing
    alert('Word document conversion to PDF requires server-side processing. Please convert the Word document to PDF before uploading, or upload PDF files directly.');
    throw new Error('Word to PDF conversion not implemented client-side');
  };

  const handleUpload = async () => {
    if (!supabase || selectedFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }

    if (!subject || !grade || !term || !year) {
      alert('Please fill in all required fields (Subject, Grade, Term, Year)');
      return;
    }

    const singleUpload = selectedFiles.length === 1;
    if (singleUpload && !title) {
      alert('Please enter a title for the paper');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const termNumber = parseInt(term);
      setUploadStatus('Checking term...');
      const { data: termData, error: termError } = await supabase
        .from('past_paper_terms')
        .select('id')
        .eq('term_number', termNumber)
        .maybeSingle();

      if (termError) throw termError;
      if (!termData) {
        throw new Error(`Term ${termNumber} not found in past_paper_terms table`);
      }

      let termNumberToId: Record<number, string> = { [termNumber]: termData.id };
      if (!singleUpload) {
        const { data: allTerms, error: allTermsError } = await supabase
          .from('past_paper_terms')
          .select('id, term_number');
        if (!allTermsError && allTerms) {
          allTerms.forEach((t: { id: string; term_number: number }) => {
            termNumberToId[t.term_number] = t.id;
          });
        }
      }

      const gradeNum = parseInt(grade);
      const yearNum = parseInt(year);
      const total = selectedFiles.length;
      let successCount = 0;
      let firstInsertedPaper: PastPaper | null = null;
      let firstFileName: string | null = null;
      let firstFile: File | null = null;

      for (let i = 0; i < selectedFiles.length; i++) {
        const fileToUpload = selectedFiles[i];
        const progressBase = (i / total) * 100;
        setUploadProgress(Math.round(progressBase));
        setUploadStatus(`Uploading ${i + 1} of ${total}: ${fileToUpload.name}...`);

        if (!fileToUpload.type.includes('pdf') && !fileToUpload.name.toLowerCase().endsWith('.pdf')) {
          continue;
        }

        const fileExt = 'pdf';
        const fileName = `past-papers/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('past-papers')
          .upload(fileName, fileToUpload, {
            contentType: 'application/pdf',
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        let memoFileName: string | null = null;
        let memoFileSize: number | null = null;
        let memoFileOriginalName: string | null = null;
        if (singleUpload && selectedMemoFile) {
          setUploadStatus(`Uploading memo for ${fileToUpload.name}...`);
          const memoExt = 'pdf';
          memoFileName = `past-papers/memo_${Date.now()}_${Math.random().toString(36).substring(7)}.${memoExt}`;
          const { error: memoUploadError } = await supabase.storage
            .from('past-papers')
            .upload(memoFileName, selectedMemoFile, {
              contentType: 'application/pdf',
              cacheControl: '3600',
            });
          if (memoUploadError) throw memoUploadError;
          memoFileSize = selectedMemoFile.size;
          memoFileOriginalName = selectedMemoFile.name;
        }

        const paperTitle = singleUpload ? title : fileToUpload.name.replace(/\.pdf$/i, '');
        const useTermNum = singleUpload
          ? termNumber
          : (detectTermFromTitle(paperTitle) ?? termNumber);
        const useTermId = termNumberToId[useTermNum] ?? termData.id;
        const useYearNum = singleUpload ? yearNum : (detectYearFromTitle(paperTitle) ?? yearNum);

        const isFirstAndAutoRegen = autoRegenerate && i === 0;
        const insertData: any = {
          title: paperTitle,
          curriculum,
          year: useYearNum,
          exam_type: examType || null,
          file_url: fileName,
          file_name: fileToUpload.name,
          file_size: fileToUpload.size,
          created_by: user.id,
          term_id: useTermId,
          term: useTermNum,
          subject_name: subject || 'Mathematics',
          grade_from: gradeNum,
          grade_to: gradeNum,
          subject,
          grade: gradeNum,
          is_visible: isFirstAndAutoRegen ? false : true,
        };

        if (memoFileName) {
          insertData.memo_file_url = memoFileName;
          insertData.memo_file_name = memoFileOriginalName;
          insertData.memo_file_size = memoFileSize;
        }

        if (autoRegenerate) {
          const { data, error: dbError } = await supabase
            .from('past_papers')
            .insert(insertData)
            .select()
            .single();
          if (dbError) throw dbError;
          const normalized = normalizePaper(data);
          if (i === 0) {
            firstInsertedPaper = normalized;
            firstFileName = fileName;
            firstFile = fileToUpload;
          }
        } else {
          const { error: dbError } = await supabase.from('past_papers').insert(insertData);
          if (dbError) throw dbError;
        }
        successCount++;
      }

      setUploadProgress(95);
      setUploadStatus('Finalizing...');

      if (autoRegenerate && firstInsertedPaper && firstFileName && firstFile) {
        void regenerateContentAfterUpload(
          firstInsertedPaper,
          firstFile,
          firstFileName,
          singleUpload ? selectedMemoFile || undefined : undefined
        ).catch((regenerateError: any) => {
          console.error('Error during regeneration:', regenerateError);
          const message = String(regenerateError?.message || '').toLowerCase();
          const isRateLimit = message.includes('429') || message.includes('too many requests') || message.includes('resource exhausted');
          setRegenerationNotice({
            message: isRateLimit
              ? 'Regeneration delayed due to API rate limits. Please try regenerating later.'
              : 'Regeneration failed. The paper is hidden until regeneration succeeds.',
            tone: isRateLimit ? 'info' : 'error',
          });
        });
      }

      setUploadProgress(100);
      alert(
        total === 1
          ? 'Past paper uploaded successfully!'
          : `${successCount} past paper(s) uploaded successfully!`
      );
      if (autoRegenerate && total >= 1) {
        setRegenerationNotice({ message: 'Regeneration is running in the background for the first paper.', tone: 'info' });
      }

      setSelectedFiles([]);
      setSelectedMemoFile(null);
      setUploadStatus('');
      setTitle('');
      setSubject('');
      setGrade('');
      setTerm('');
      setExamType('');
      setYear(new Date().getFullYear().toString());

      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      const memoInput = document.getElementById('memo-upload') as HTMLInputElement;
      if (memoInput) memoInput.value = '';

      loadPapers().catch((err) => console.error('Error reloading papers:', err));
    } catch (error: any) {
      console.error('Error uploading past paper:', error);
      alert(error.message || 'Failed to upload past paper(s). Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const toBase64 = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let base64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64 += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(base64);
  };

  const generateRegeneratedHtml = async (
    paper: PastPaper,
    file: File,
    kind: 'paper' | 'memo' = 'paper'
  ) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY.');
    }

    const base64 = await toBase64(file);
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const subjectValue = paper.subject_name ?? paper.subject ?? 'Mathematics';
    const gradeValue = paper.grade_from ?? paper.grade ?? paper.grade_to ?? 8;
    const termValue = paper.term ?? paper.past_paper_terms?.term_number ?? 'N/A';

    const documentLabel = kind === 'memo' ? 'memo/marking guideline' : 'past exam paper';
    const regeneratePrompt = `You are an expert educational content creator for South African ${paper.curriculum} curriculum.

Analyze this ${documentLabel} for ${subjectValue}, Grade ${gradeValue}, Term ${termValue}, Year ${paper.year}.

CRITICAL REQUIREMENTS:
1. Remove ALL branding, logos, school names, institution names, and copyright notices
2. Remove any watermarks or identifying marks
3. Create a clean, professional exam paper with NO external branding
4. Preserve ALL academic content EXACTLY as-is:
   - Do NOT change any numbers, values, dates, or figures
   - Do NOT change questions, answers, or mark allocations
   - Do NOT change any data tables, formulas, or diagram descriptions
5. Only rewrite or replace branding/header/footer content
6. Keep the same structure, question numbering, and formatting
7. Format the output as HTML with proper styling for web viewing:
   - Use clean, professional styling
   - Include proper headings, sections, and question numbering
   - Make it suitable for viewing in a web browser
   - Ensure it's print-friendly if needed
   - Use a clean header like "${kind === 'memo' ? 'Memo / Marking Guidelines' : 'Practice Examination Paper'}" instead of any branded title
8. For all math expressions, use LaTeX wrapped in \\( ... \\) or \\[ ... \\] so it can be rendered accurately
   - Example: \\(k=\\frac{1}{x^2+7x+5}\\) and \\(p=\\frac{1}{x^2+7x+7}\\)
9. Take your time and be extremely careful: verify all numbers, symbols, and statements twice
10. If you are uncertain about any content, copy it verbatim from the source rather than modifying it
11. Fully preserve complex notation: fractions, exponents, radicals, functions, subscripts, superscripts, and inequalities
12. Preserve graph/diagram questions and descriptions; keep all labeled points, axes, scales, intercepts, asymptotes, and annotations as written
13. If a question includes a graph, chart, or diagram, DO NOT attempt to redraw it. Instead, insert a clear placeholder in square brackets that describes the original figure, for example: [FIGURE: Cartesian graph of f and g from Question 5, with A(-3;4), C(1;0), vertical asymptote x=-2]. Do not output SVG or <img> tags for diagrams; just describe where the original image should be placed.

Generate the cleaned ${documentLabel} as HTML ready for web viewing WITHOUT changing any academic content.
Include the ENTIRE document: all sections, instructions, all questions, sub-questions, tables, figures, and any appendices. Do NOT omit any part.
Do NOT summarize, truncate, or skip content. The output must reach the end of the source document.`;

    const request = () =>
      model.generateContent([
        regeneratePrompt,
        {
          inlineData: {
            data: base64,
            mimeType: 'application/pdf',
          },
        },
      ]);

    const regenerateResult = await enqueueGeminiRequest(request);
    const regeneratedContent = regenerateResult.response.text();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${paper.title || (kind === 'memo' ? 'Memo / Marking Guidelines' : 'Practice Examination Paper')}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body {
      font-family: 'Times New Roman', serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 {
      color: #1a1a1a;
      margin-top: 1.5em;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .question {
      margin: 20px 0;
      padding: 15px;
      background: #f9f9f9;
      border-left: 4px solid #0066cc;
    }
    .marks {
      font-weight: bold;
      color: #0066cc;
    }
    @media print {
      body { padding: 0; }
      .question { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${kind === 'memo' ? 'Memo / Marking Guidelines' : 'Practice Examination Paper'}</h1>
    <p><strong>Subject:</strong> ${subjectValue}</p>
    <p><strong>Grade:</strong> ${gradeValue} | <strong>Term:</strong> ${termValue} | <strong>Year:</strong> ${paper.year}</p>
    <p><strong>Curriculum:</strong> ${paper.curriculum}</p>
  </div>
  ${regeneratedContent}
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      if (window.renderMathInElement) {
        window.renderMathInElement(document.body, {
          delimiters: [
            { left: "\\\\(", right: "\\\\)", display: false },
            { left: "\\\\[", right: "\\\\]", display: true }
          ],
          throwOnError: false
        });
      }
    });
  </script>
</body>
</html>`;
  };

  // Function to regenerate content automatically after upload
  const regenerateContentAfterUpload = async (
    paper: PastPaper,
    originalFile: File,
    originalFileName: string,
    memoFile?: File
  ) => {
    try {
      const htmlContent = await generateRegeneratedHtml(paper, originalFile, 'paper');

      const regeneratedBlob = new Blob([htmlContent], { type: 'text/html' });
      const regeneratedFileName = `past-papers/processed_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;
      
      const { error: uploadError } = await supabase.storage
        .from('past-papers')
        .upload(regeneratedFileName, regeneratedBlob, {
          contentType: 'text/html',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Update the paper record to use the regenerated file
      const { error: updateError } = await supabase
        .from('past_papers')
        .update({
          file_url: regeneratedFileName,
          file_name: `${(paper.file_name || originalFileName).replace('.pdf', '')}_processed.html`,
          file_size: regeneratedBlob.size,
          is_visible: true,
        })
        .eq('id', paper.id);

      if (updateError) throw updateError;

      if (memoFile && memoFile.size > 0) {
        const memoHtml = await generateRegeneratedHtml(paper, memoFile, 'memo');
        const memoBlob = new Blob([memoHtml], { type: 'text/html' });
        const memoRegeneratedName = `past-papers/memo_processed_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;

        const { error: memoUploadError } = await supabase.storage
          .from('past-papers')
          .upload(memoRegeneratedName, memoBlob, {
            contentType: 'text/html',
            cacheControl: '3600',
          });

        if (memoUploadError) throw memoUploadError;

        const { error: memoUpdateError } = await supabase
          .from('past_papers')
          .update({
            memo_file_url: memoRegeneratedName,
            memo_file_name: `${(memoFile.name || 'memo').replace('.pdf', '')}_processed.html`,
            memo_file_size: memoBlob.size,
            is_visible: true,
          })
          .eq('id', paper.id);

        if (memoUpdateError) throw memoUpdateError;
      }

      setRegenerationNotice({
        message: `Regeneration complete for "${paper.title}".`,
        tone: 'success',
      });

      // Optionally, delete the original file to save space (or keep it as backup)
      // Uncomment if you want to delete originals:
      // await supabase.storage.from('past-papers').remove([originalFileName]);

    } catch (error) {
      console.error('Error in automatic regeneration:', error);
      if (supabase) {
        await supabase
          .from('past_papers')
          .update({ is_visible: false })
          .eq('id', paper.id);
      }
      throw error;
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this past paper?')) return;
    if (!supabase) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('past-papers')
        .remove([fileUrl]);

      if (storageError) console.error('Error deleting file from storage:', storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('past_papers')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      await loadPapers();
    } catch (error) {
      console.error('Error deleting past paper:', error);
      alert('Failed to delete past paper. Please try again.');
    }
  };

  const handleView = async (paper: PastPaper) => {
    if (!supabase) return;

    try {
      // Create a signed URL that expires in 1 hour (prevents direct download)
      const { data, error } = await supabase.storage
        .from('past-papers')
        .createSignedUrl(paper.file_url, 3600); // 1 hour expiry

      if (error) throw error;

      setViewingPaper(paper);
      setViewerUrl(data.signedUrl);
    } catch (error) {
      console.error('Error generating view URL:', error);
      alert('Failed to load paper. Please try again.');
    }
  };

  const handleViewMemo = async (paper: PastPaper) => {
    if (!supabase) return;
    if (!paper.memo_file_url) {
      alert('No memo uploaded for this paper.');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('past-papers')
        .createSignedUrl(paper.memo_file_url, 3600);

      if (error) throw error;

      setViewingPaper(paper);
      setViewerUrl(data.signedUrl);
    } catch (error) {
      console.error('Error generating memo view URL:', error);
      alert('Failed to load memo. Please try again.');
    }
  };

  const handleUploadReplaceMemoClick = (paper: PastPaper) => {
    memoReplacePaperRef.current = paper;
    memoReplaceInputRef.current?.click();
  };

  const uploadAndRegenerateMemo = async (paper: PastPaper, file: File) => {
    if (!supabase) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      alert('Please upload a PDF memo file (.pdf) only.');
      return;
    }
    setUploadingMemoPaperId(paper.id);
    try {
      const memoHtml = await generateRegeneratedHtml(paper, file, 'memo');
      const memoBlob = new Blob([memoHtml], { type: 'text/html' });
      const memoRegeneratedName = `past-papers/memo_processed_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;
      const { error: memoUploadError } = await supabase.storage
        .from('past-papers')
        .upload(memoRegeneratedName, memoBlob, {
          contentType: 'text/html',
          cacheControl: '3600',
        });
      if (memoUploadError) throw memoUploadError;
      const { error: memoUpdateError } = await supabase
        .from('past_papers')
        .update({
          memo_file_url: memoRegeneratedName,
          memo_file_name: `${(file.name || 'memo').replace(/\.pdf$/i, '')}_processed.html`,
          memo_file_size: memoBlob.size,
        })
        .eq('id', paper.id);
      if (memoUpdateError) throw memoUpdateError;
      await loadPapers();
      setRegenerationNotice({ message: `Memo uploaded and regenerated for "${paper.title}".`, tone: 'success' });
    } catch (error: any) {
      console.error('Error uploading/regenerating memo:', error);
      alert(error?.message || 'Failed to upload or regenerate memo. Please try again.');
    } finally {
      setUploadingMemoPaperId(null);
      memoReplacePaperRef.current = null;
      if (memoReplaceInputRef.current) memoReplaceInputRef.current.value = '';
    }
  };

  const handleReplaceMemoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const paper = memoReplacePaperRef.current;
    if (!file || !paper) return;
    await uploadAndRegenerateMemo(paper, file);
  };

  const closeViewer = () => {
    setViewingPaper(null);
    setViewerUrl(null);
  };

  const handleRegenerate = async (paper: PastPaper) => {
    if (!supabase) return;
    if (!confirm(`Are you sure you want to regenerate "${paper.title}"? This will create a new version with AI-generated content.`)) return;

    setRegeneratingPaperId(paper.id);
    setRegenerationProgress(0);

    try {
      await supabase
        .from('past_papers')
        .update({ is_visible: false })
        .eq('id', paper.id);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      setRegenerationProgress(10);

      if (!paper.file_url.toLowerCase().endsWith('.pdf')) {
        throw new Error('Original PDF not available. Please re-upload the PDF to regenerate.');
      }

      // Download the original PDF
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('past-papers')
        .download(paper.file_url);

      if (downloadError) throw downloadError;
      if (!fileData) throw new Error('Failed to download file');

      setRegenerationProgress(20);

      // Convert to File object for Gemini
      const file = new File([fileData], paper.file_name, { type: 'application/pdf' });

      setRegenerationProgress(40);

      const htmlContent = await generateRegeneratedHtml(paper, file, 'paper');
      setRegenerationProgress(80);

      const regeneratedBlob = new Blob([htmlContent], { type: 'text/html' });
      const regeneratedFileName = `past-papers/processed_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;
      
      const { error: uploadError } = await supabase.storage
        .from('past-papers')
        .upload(regeneratedFileName, regeneratedBlob, {
          contentType: 'text/html',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      setRegenerationProgress(95);

      // Update existing paper record to use regenerated file
      const { error: dbError } = await supabase
        .from('past_papers')
        .update({
          file_url: regeneratedFileName,
          file_name: `${paper.file_name.replace('.pdf', '')}_processed.html`,
          file_size: regeneratedBlob.size,
          is_visible: true,
        })
        .eq('id', paper.id);

      if (dbError) throw dbError;

      setRegenerationProgress(90);

      if (paper.memo_file_url && paper.memo_file_url.toLowerCase().endsWith('.pdf')) {
        const { data: memoData, error: memoDownloadError } = await supabase.storage
          .from('past-papers')
          .download(paper.memo_file_url);

        if (memoDownloadError) throw memoDownloadError;
        if (!memoData) throw new Error('Failed to download memo file');

        const memoFile = new File([memoData], paper.memo_file_name || 'memo.pdf', { type: 'application/pdf' });
        const memoHtml = await generateRegeneratedHtml(paper, memoFile, 'memo');
        const memoBlob = new Blob([memoHtml], { type: 'text/html' });
        const memoRegeneratedName = `past-papers/memo_processed_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;

        const { error: memoUploadError } = await supabase.storage
          .from('past-papers')
          .upload(memoRegeneratedName, memoBlob, {
            contentType: 'text/html',
            cacheControl: '3600',
          });

        if (memoUploadError) throw memoUploadError;

        const { error: memoUpdateError } = await supabase
          .from('past_papers')
          .update({
            memo_file_url: memoRegeneratedName,
            memo_file_name: `${(paper.memo_file_name || 'memo.pdf').replace('.pdf', '')}_processed.html`,
            memo_file_size: memoBlob.size,
            is_visible: true,
          })
          .eq('id', paper.id);

        if (memoUpdateError) throw memoUpdateError;
      }

      setRegenerationProgress(100);

      // Reload papers
      await loadPapers();

      setRegenerationNotice({
        message: `Regeneration complete for "${paper.title}".`,
        tone: 'success',
      });
      alert('Past paper regenerated successfully! The paper has been updated.');
    } catch (error: any) {
      console.error('Error regenerating past paper:', error);
      await supabase
        .from('past_papers')
        .update({ is_visible: true })
        .eq('id', paper.id);
      setRegenerationNotice({
        message: error.message || 'Failed to regenerate past paper. Please try again.',
        tone: 'error',
      });
      alert(error.message || 'Failed to regenerate past paper. Please try again.');
    } finally {
      setRegeneratingPaperId(null);
      setRegenerationProgress(0);
    }
  };

  const handleBulkProcess = async () => {
    if (!supabase || unprocessedPapers.length === 0) return;
    if (
      !confirm(
        `AI process ${unprocessedPapers.length} unprocessed paper(s)? This may take a while.`
      )
    )
      return;

    setIsBulkProcessing(true);
    const total = unprocessedPapers.length;

    try {
      for (let i = 0; i < unprocessedPapers.length; i++) {
        const paper = unprocessedPapers[i];
        setBulkProgress({ current: i + 1, total, currentTitle: paper.title });

        await supabase
          .from('past_papers')
          .update({ is_visible: false })
          .eq('id', paper.id);

        if (!paper.file_url.toLowerCase().endsWith('.pdf')) continue;

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('past-papers')
          .download(paper.file_url);
        if (downloadError || !fileData) {
          await supabase.from('past_papers').update({ is_visible: true }).eq('id', paper.id);
          throw new Error(`Failed to download "${paper.title}".`);
        }

        const file = new File([fileData], paper.file_name, { type: 'application/pdf' });
        const htmlContent = await generateRegeneratedHtml(paper, file, 'paper');
        const regeneratedBlob = new Blob([htmlContent], { type: 'text/html' });
        const regeneratedFileName = `past-papers/processed_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;

        const { error: uploadError } = await supabase.storage
          .from('past-papers')
          .upload(regeneratedFileName, regeneratedBlob, {
            contentType: 'text/html',
            cacheControl: '3600',
          });
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('past_papers')
          .update({
            file_url: regeneratedFileName,
            file_name: `${paper.file_name.replace('.pdf', '')}_processed.html`,
            file_size: regeneratedBlob.size,
            is_visible: true,
          })
          .eq('id', paper.id);
        if (dbError) throw dbError;

        if (paper.memo_file_url && paper.memo_file_url.toLowerCase().endsWith('.pdf')) {
          const { data: memoData, error: memoDownloadError } = await supabase.storage
            .from('past-papers')
            .download(paper.memo_file_url);
          if (!memoDownloadError && memoData) {
            const memoFile = new File(
              [memoData],
              paper.memo_file_name || 'memo.pdf',
              { type: 'application/pdf' }
            );
            const memoHtml = await generateRegeneratedHtml(paper, memoFile, 'memo');
            const memoBlob = new Blob([memoHtml], { type: 'text/html' });
            const memoRegeneratedName = `past-papers/memo_processed_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;
            const { error: memoUploadError } = await supabase.storage
              .from('past-papers')
              .upload(memoRegeneratedName, memoBlob, {
                contentType: 'text/html',
                cacheControl: '3600',
              });
            if (!memoUploadError) {
              await supabase
                .from('past_papers')
                .update({
                  memo_file_url: memoRegeneratedName,
                  memo_file_name: `${(paper.memo_file_name || 'memo.pdf').replace('.pdf', '')}_processed.html`,
                  memo_file_size: memoBlob.size,
                })
                .eq('id', paper.id);
            }
          }
        }
      }

      await loadPapers();
      setRegenerationNotice({
        message: `Bulk AI process complete: ${total} paper(s) processed.`,
        tone: 'success',
      });
      alert(`Bulk AI process complete. ${total} paper(s) processed.`);
    } catch (error: any) {
      console.error('Error during bulk process:', error);
      setRegenerationNotice({
        message: error?.message || 'Bulk process failed. Some papers may have been updated.',
        tone: 'error',
      });
      alert(error?.message || 'Bulk process failed. Please try again.');
      await loadPapers();
    } finally {
      setIsBulkProcessing(false);
      setBulkProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center text-gray-500">Loading past papers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Upload Past Paper</h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="file-upload">Files (PDF only) *</Label>
            <div className="mt-2">
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="cursor-pointer"
                disabled={isUploading}
              />
              {selectedFiles.length > 0 && (
                <div className="text-sm text-gray-600 mt-2 space-y-1">
                  <p className="font-medium">{selectedFiles.length} file(s) selected:</p>
                  <ul className="list-disc list-inside text-xs max-h-24 overflow-y-auto">
                    {selectedFiles.map((f, i) => (
                      <li key={i}>
                        {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Select one or multiple PDFs. Same subject, grade, term and year apply to all.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="memo-upload">Memo (PDF only) (Optional)</Label>
            <div className="mt-2">
              <Input
                id="memo-upload"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleMemoSelect}
                className="cursor-pointer"
                disabled={isUploading || selectedFiles.length > 1}
              />
              {selectedMemoFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected memo: {selectedMemoFile.name} ({(selectedMemoFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {selectedFiles.length > 1
                  ? 'Memo only available when uploading a single paper.'
                  : 'Upload the memo/marking guideline for this paper.'}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                const v = e.target.value;
                setTitle(v);
                const detected = detectTermFromTitle(v);
                if (detected !== null) setTerm(String(detected));
                const detectedYear = detectYearFromTitle(v);
                if (detectedYear !== null) setYear(String(detectedYear));
              }}
              placeholder={selectedFiles.length > 1 ? "Used for single upload only" : "e.g., Mathematics Term 1 Test 2023"}
              disabled={isUploading}
            />
            {selectedFiles.length > 1 && (
              <p className="text-xs text-gray-500 mt-1">
                Each file will use its filename as the title.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Term is auto-detected from month in title (e.g. March → Term 1, June → Term 2).
            </p>
            <p className="text-xs text-gray-500">
              Year is auto-detected from a 4-digit year in the title (e.g. 2023).
            </p>
          </div>

          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Select value={subject} onValueChange={setSubject} disabled={isUploading}>
              <SelectTrigger id="subject">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {pastPaperSubjects.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="grade">Grade *</Label>
            <Select value={grade} onValueChange={setGrade} disabled={isUploading}>
              <SelectTrigger id="grade">
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

          <div>
            <Label htmlFor="curriculum">Curriculum *</Label>
            <Select value={curriculum} onValueChange={(v) => setCurriculum(v as 'CAPS' | 'IEB')} disabled={isUploading}>
              <SelectTrigger id="curriculum">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAPS">CAPS</SelectItem>
                <SelectItem value="IEB">IEB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="term">Term *</Label>
            <Select value={term} onValueChange={setTerm} disabled={isUploading}>
              <SelectTrigger id="term">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Term 1</SelectItem>
                <SelectItem value="2">Term 2</SelectItem>
                <SelectItem value="3">Term 3</SelectItem>
                <SelectItem value="4">Term 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="year">Year *</Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min="2000"
              max={new Date().getFullYear()}
              disabled={isUploading}
            />
          </div>

          <div>
            <Label htmlFor="exam-type">Exam Type (Optional)</Label>
            <Input
              id="exam-type"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              placeholder="e.g., Test, Exam, Final Exam"
              disabled={isUploading}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <input
            id="auto-regenerate"
            type="checkbox"
            checked={autoRegenerate}
            onChange={(e) => setAutoRegenerate(e.target.checked)}
            disabled={isUploading}
          />
          <Label htmlFor="auto-regenerate">Auto-regenerate after upload</Label>
          <span className="text-xs text-gray-500">(can take a few minutes for large PDFs)</span>
        </div>
        {regenerationNotice && (
          <p
            className={`mt-2 text-sm ${
              regenerationNotice.tone === 'success'
                ? 'text-emerald-700'
                : regenerationNotice.tone === 'error'
                ? 'text-rose-700'
                : 'text-amber-700'
            }`}
          >
            {regenerationNotice.message}
          </p>
        )}

        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {uploadStatus || 'Uploading...'} {uploadProgress}%
            </p>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={isUploading || selectedFiles.length === 0}
          className="mt-4 w-full md:w-auto"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Paper
            </>
          )}
        </Button>
      </div>

      {/* Manage subjects */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-xl font-semibold mb-2">Manage subjects</h3>
        <p className="text-sm text-gray-500 mb-4">
          Add or remove subjects for past papers. These appear in the upload form and on the student dashboard.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="New subject name"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSubject()}
            className="max-w-xs"
          />
          <Button onClick={addSubject} disabled={!newSubjectName.trim() || isAddingSubject}>
            {isAddingSubject ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add subject'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {pastPaperSubjects.map((s) => (
            <div
              key={s.id}
              className="inline-flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="font-medium">{s.name}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => deleteSubject(s.id, s.name)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        {pastPaperSubjects.length === 0 && (
          <p className="text-sm text-gray-500">No subjects yet. Add one above or run the migration to seed defaults.</p>
        )}
      </div>

      {/* Visibility Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-semibold">Visibility Controls</h3>
            <p className="text-sm text-gray-500 mt-1">
              Hide or show subjects and individual papers on the student dashboard
            </p>
          </div>
          <Select
            value={subjectVisibilityCurriculum}
            onValueChange={(value) => setSubjectVisibilityCurriculum(value as 'CAPS' | 'IEB')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CAPS">CAPS</SelectItem>
              <SelectItem value="IEB">IEB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {visibilitySubjectOptions.length === 0 ? (
          <div className="text-sm text-gray-500">Upload papers to manage subject visibility.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibilitySubjectOptions.map((subjectName) => {
              const isVisible = subjectVisibility[subjectName] ?? true;
              return (
                <div key={subjectName} className="flex items-center justify-between border rounded-xl px-4 py-3">
                  <div className="font-medium">{subjectName}</div>
                  <div className="flex items-center gap-2">
                    {isVisible ? (
                      <Badge className="bg-green-100 text-green-700">Visible</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-700">Hidden</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleSubjectVisibility(subjectName, !isVisible)}
                    >
                      {isVisible ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Papers List */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-xl font-semibold">Past Papers</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-500">
                Showing {filteredPapers.length} of {papers.length}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkProcess}
                disabled={isBulkProcessing || unprocessedPapers.length === 0}
                className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              >
                {isBulkProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Bulk AI process unprocessed ({unprocessedPapers.length})
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, subject, year, exam type..."
            />
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjectOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {gradeOptions.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    Grade {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTerm} onValueChange={setFilterTerm}>
              <SelectTrigger>
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {termOptions.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    Term {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {yearOptions.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCurriculum} onValueChange={setFilterCurriculum}>
              <SelectTrigger>
                <SelectValue placeholder="Curriculum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All curricula</SelectItem>
                {curriculumOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMemo} onValueChange={setFilterMemo}>
              <SelectTrigger>
                <SelectValue placeholder="Memo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All memos</SelectItem>
                <SelectItem value="with_memo">With memo</SelectItem>
                <SelectItem value="without_memo">Without memo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="year_desc">Year (high to low)</SelectItem>
                <SelectItem value="year_asc">Year (low to high)</SelectItem>
                <SelectItem value="title_asc">Title (A-Z)</SelectItem>
                <SelectItem value="title_desc">Title (Z-A)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setFilterSubject('all');
                setFilterGrade('all');
                setFilterTerm('all');
                setFilterYear('all');
                setFilterCurriculum('all');
                setFilterMemo('all');
                setSortBy('newest');
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>

        {papers.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No past papers uploaded yet</p>
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No papers match your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={memoReplaceInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              aria-hidden
              onChange={handleReplaceMemoFileSelected}
            />
            {filteredPapers.map((paper) => (
              <motion.div
                key={paper.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h4 className="font-semibold">{paper.title}</h4>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-600 mt-1">
                    <span>{paper.subject}</span>
                    <span>•</span>
                    <span>Grade {paper.grade}</span>
                    <span>•</span>
                    <span>{paper.curriculum}</span>
                    <span>•</span>
                    <span>Term {paper.term}</span>
                    <span>•</span>
                    <span>{paper.year}</span>
                    {paper.exam_type && (
                      <>
                        <span>•</span>
                        <span>{paper.exam_type}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(paper.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs mt-1">
                    {regeneratingPaperId === paper.id ? (
                      <span className="text-purple-600 font-medium">Processing with AI…</span>
                    ) : paper.file_url.toLowerCase().endsWith('.html') ? (
                      <span className="text-emerald-600 font-medium">Processed</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Not processed yet</span>
                    )}
                    {paper.memo_file_url && (
                      <span className="ml-2 text-gray-500">
                        Memo: {paper.memo_file_url.toLowerCase().endsWith('.html') ? 'processed' : 'PDF only'}
                      </span>
                    )}
                  </p>
                  {paper.is_visible === false && (
                    <p className="text-xs text-amber-600 mt-1">Hidden from students</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => togglePaperVisibility(paper)}
                    className={paper.is_visible === false ? 'border-emerald-200 text-emerald-700' : 'border-slate-200'}
                  >
                    {paper.is_visible === false ? 'Show' : 'Hide'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(paper)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewMemo(paper)}
                    disabled={!paper.memo_file_url}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Memo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUploadReplaceMemoClick(paper)}
                    disabled={uploadingMemoPaperId === paper.id}
                  >
                    {uploadingMemoPaperId === paper.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {paper.memo_file_url ? 'Replace memo' : 'Upload memo'}
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerate(paper)}
                    disabled={regeneratingPaperId === paper.id}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                  >
                    {regeneratingPaperId === paper.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Regenerate
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditInfo(paper)}
                  >
                    Edit info
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditor(paper)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(paper.id, paper.file_url)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Errors & Questions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Errors & Questions</h3>
            <p className="text-sm text-gray-500 mt-1">
              Reports submitted by students for past papers
            </p>
          </div>
          <Button onClick={loadErrorReports} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {(['all', 'new', 'read', 'replied', 'archived'] as const).map((status) => (
            <Button
              key={status}
              variant={reportFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'new' && errorReports.filter((r) => r.status === 'new').length > 0 && (
                <Badge className="ml-2 bg-blue-600 text-white">
                  {errorReports.filter((r) => r.status === 'new').length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {isReportsLoading ? (
          <div className="text-center text-gray-500 py-8">Loading reports...</div>
        ) : errorReports.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No reports found</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {errorReports.map((report) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedReport?.id === report.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedReport(report);
                    if (report.status === 'new') {
                      updateReportStatus(report.id, 'read');
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{report.name}</h4>
                      <p className="text-xs text-gray-500">{report.email}</p>
                    </div>
                    {getReportStatusBadge(report.status)}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                    {report.subject}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </div>
            <div className="border rounded-xl p-4 bg-gray-50">
              {selectedReport ? (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-lg">{selectedReport.subject}</h4>
                      <p className="text-sm text-gray-500">
                        {selectedReport.name} • {selectedReport.email}
                      </p>
                    </div>
                    {getReportStatusBadge(selectedReport.status)}
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap border rounded-lg p-3 bg-white">
                    {selectedReport.message}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => updateReportStatus(selectedReport.id, 'read')}>
                      Mark read
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateReportStatus(selectedReport.id, 'replied')}>
                      Mark replied
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateReportStatus(selectedReport.id, 'archived')}>
                      Archive
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">Select a report to view details.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Regeneration Progress Modal */}
      {regeneratingPaperId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-600" />
              <h3 className="text-xl font-semibold mb-2">Regenerating Past Paper</h3>
              <p className="text-gray-600 mb-4">AI is processing and regenerating the content...</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-purple-600 h-3 rounded-full transition-all"
                  style={{ width: `${regenerationProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{regenerationProgress}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk process progress modal */}
      {bulkProgress && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-600" />
              <h3 className="text-xl font-semibold mb-2">Bulk AI process</h3>
              <p className="text-gray-600 mb-2">
                Processing paper {bulkProgress.current} of {bulkProgress.total}
              </p>
              <p className="text-sm font-medium text-purple-700 truncate px-2" title={bulkProgress.currentTitle}>
                {bulkProgress.currentTitle}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
                <div
                  className="bg-purple-600 h-3 rounded-full transition-all"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit paper info modal */}
      {editingInfoPaper && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit paper info</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => !isSavingInfo && setEditingInfoPaper(null)}
                disabled={isSavingInfo}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="edit-info-title">Title *</Label>
                <Input
                  id="edit-info-title"
                  value={editInfoForm.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    const detected = detectTermFromTitle(v);
                    const detectedYear = detectYearFromTitle(v);
                    setEditInfoForm((f) => ({
                      ...f,
                      title: v,
                      ...(detected !== null && { term: String(detected) }),
                      ...(detectedYear !== null && { year: String(detectedYear) }),
                    }));
                  }}
                  placeholder="e.g., Mathematics Term 1 Test 2023"
                  disabled={isSavingInfo}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Term auto-detected from month in title.</p>
                <p className="text-xs text-gray-500">Year auto-detected from a 4-digit year in title.</p>
              </div>
              <div>
                <Label htmlFor="edit-info-subject">Subject *</Label>
                <Select
                  value={editInfoForm.subject}
                  onValueChange={(v) => setEditInfoForm((f) => ({ ...f, subject: v }))}
                  disabled={isSavingInfo}
                >
                  <SelectTrigger id="edit-info-subject" className="mt-1">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastPaperSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-info-grade">Grade *</Label>
                <Select
                  value={editInfoForm.grade}
                  onValueChange={(v) => setEditInfoForm((f) => ({ ...f, grade: v }))}
                  disabled={isSavingInfo}
                >
                  <SelectTrigger id="edit-info-grade" className="mt-1">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {[8, 9, 10, 11, 12].map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        Grade {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-info-curriculum">Curriculum *</Label>
                <Select
                  value={editInfoForm.curriculum}
                  onValueChange={(v) => setEditInfoForm((f) => ({ ...f, curriculum: v as 'CAPS' | 'IEB' }))}
                  disabled={isSavingInfo}
                >
                  <SelectTrigger id="edit-info-curriculum" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAPS">CAPS</SelectItem>
                    <SelectItem value="IEB">IEB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-info-term">Term *</Label>
                <Select
                  value={editInfoForm.term}
                  onValueChange={(v) => setEditInfoForm((f) => ({ ...f, term: v }))}
                  disabled={isSavingInfo}
                >
                  <SelectTrigger id="edit-info-term" className="mt-1">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Term 1</SelectItem>
                    <SelectItem value="2">Term 2</SelectItem>
                    <SelectItem value="3">Term 3</SelectItem>
                    <SelectItem value="4">Term 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-info-year">Year *</Label>
                <Input
                  id="edit-info-year"
                  type="number"
                  value={editInfoForm.year}
                  onChange={(e) => setEditInfoForm((f) => ({ ...f, year: e.target.value }))}
                  min={2000}
                  max={new Date().getFullYear()}
                  disabled={isSavingInfo}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-info-exam-type">Exam type (optional)</Label>
                <Input
                  id="edit-info-exam-type"
                  value={editInfoForm.exam_type}
                  onChange={(e) => setEditInfoForm((f) => ({ ...f, exam_type: e.target.value }))}
                  placeholder="e.g., Test, Exam, Final Exam"
                  disabled={isSavingInfo}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditingInfoPaper(null)} disabled={isSavingInfo}>
                Cancel
              </Button>
              <Button onClick={saveEditInfo} disabled={isSavingInfo}>
                {isSavingInfo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Simple HTML Editor Modal for admins */}
      {editingPaper && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-5xl w-full h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Edit Paper</h3>
                <p className="text-sm text-gray-500">
                  {editingPaper.title} &middot; Grade {editingPaper.grade} &middot; Term {editingPaper.term} &middot;{' '}
                  {editingPaper.year}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!isSavingEdit) {
                    setEditingPaper(null);
                    setEditingHtml('');
                  }
                }}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Close
              </Button>
            </div>

            {isEditingLoading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading editable content...
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  Edit the paper below. Click inside the document to change text. Use the Charts panel to draw or upload
                  images for <code className="px-1 py-0.5 bg-gray-100 rounded">[FIGURE: ...]</code> placeholders.
                </p>
                <div className="flex flex-1 gap-4 min-h-0">
                  <div className="flex-1 flex flex-col min-w-0">
                    <iframe
                      ref={editorIframeRef}
                      title="Edit paper content"
                      className="flex-1 w-full min-h-[300px] border rounded-lg bg-white"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                  <div className="w-72 shrink-0 border rounded-xl p-3 bg-gray-50 overflow-auto">
                    <h4 className="font-semibold text-sm mb-2">Charts / Figures</h4>
                    <p className="text-xs text-gray-500 mb-3">
                      Click in the document where you want the chart, then add one below.
                    </p>
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-gray-600">Add chart anywhere</p>
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="text-xs"
                          onClick={() => setDrawingForPlaceholder(INSERT_CHART_AT_CURSOR)}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Draw chart
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={!!uploadingFigureFor}
                          onClick={() => {
                            setUploadTargetPlaceholder(INSERT_CHART_AT_CURSOR);
                            figureUploadInputRef.current?.click();
                          }}
                        >
                          {uploadingFigureFor === INSERT_CHART_AT_CURSOR ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3 mr-1" />
                          )}
                          Upload image
                        </Button>
                      </div>
                    </div>
                    {figurePlaceholders.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-gray-600 mt-3 mb-1">Replace placeholders</p>
                        <ul className="space-y-2">
                          {figurePlaceholders.map((ph) => (
                            <li key={ph} className="text-xs border rounded-lg p-2 bg-white">
                              <span className="block truncate text-gray-600 mb-2" title={ph}>
                                {ph}
                              </span>
                              <div className="flex gap-1 flex-wrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => setDrawingForPlaceholder(ph)}
                                >
                                  <Pencil className="w-3 h-3 mr-1" />
                                  Draw
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  disabled={uploadingFigureFor === ph}
                                  onClick={() => {
                                    setUploadTargetPlaceholder(ph);
                                    figureUploadInputRef.current?.click();
                                  }}
                                >
                                  {uploadingFigureFor === ph ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="w-3 h-3 mr-1" />
                                  )}
                                  Upload
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
                <input
                  ref={figureUploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (uploadTargetPlaceholder && file) {
                      handleFigureFileSelect(uploadTargetPlaceholder, file);
                      setUploadTargetPlaceholder(null);
                    }
                    e.target.value = '';
                  }}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!isSavingEdit) {
                        setEditingPaper(null);
                        setEditingHtml('');
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveEditorChanges} disabled={isSavingEdit}>
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Draw chart modal */}
      {drawingForPlaceholder && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Draw chart</h3>
              <Button variant="ghost" size="sm" onClick={() => setDrawingForPlaceholder(null)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {drawingForPlaceholder === INSERT_CHART_AT_CURSOR
                ? 'Chart will be inserted at the cursor position in the document.'
                : `Replacing: ${drawingForPlaceholder}`}
            </p>
            <div className="space-y-2 mb-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-gray-500 mr-1">Draw:</span>
                <Button
                  size="sm"
                  variant={drawTool === 'select' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('select')}
                  title="Select: click to select, then drag to move or use handles to rotate/resize"
                >
                  <MousePointer2 className="w-4 h-4 mr-1" />
                  Select
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'pencil' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('pencil')}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Pencil
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'line' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('line')}
                  title="Line: drag from start to end (preview while dragging)"
                >
                  <Minus className="w-4 h-4 mr-1" />
                  Line
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'vector' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('vector')}
                  title="Vector (arrow): drag from start to end"
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  Vector
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'curve' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('curve')}
                  title="Curve: drag from start to end (preview while dragging)"
                >
                  <PenLine className="w-4 h-4 mr-1" />
                  Curve
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'sine' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('sine')}
                  title="Sine wave: drag from start to end"
                >
                  <Waves className="w-4 h-4 mr-1" />
                  Sine
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'point' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('point')}
                  title="Point: click to place"
                >
                  <CircleDot className="w-4 h-4 mr-1" />
                  Point
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'label' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('label')}
                  title="Label: click then type (e.g. A(-3;4), x, f)"
                >
                  <Type className="w-4 h-4 mr-1" />
                  Label
                </Button>
                <Button
                  size="sm"
                  variant={drawTool === 'eraser' ? 'default' : 'outline'}
                  onClick={() => setDrawTool('eraser')}
                >
                  Eraser
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDrawObjects((prev) => prev.slice(0, -1))} title="Remove last item" disabled={drawObjects.length === 0}>
                  <Undo2 className="w-4 h-4 mr-1" />
                  Undo
                </Button>
                <Button size="sm" variant="outline" onClick={clearDrawingCanvas}>
                  Clear
                </Button>
                <label className="flex items-center gap-1 text-sm ml-1">
                  <span>Color</span>
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-gray-500 mr-1">Math / graph:</span>
                <Button size="sm" variant="outline" onClick={drawAxes} title="Add x and y axes with arrows">
                  <Move className="w-4 h-4 mr-1" />
                  Add axes
                </Button>
                <Button size="sm" variant="outline" onClick={drawGridOnCanvas} title="Add grid lines">
                  <Grid3X3 className="w-4 h-4 mr-1" />
                  Add grid
                </Button>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="w-full border rounded-lg bg-white block"
              style={{ maxWidth: '100%', height: 'auto' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseEnter={(e) => {
                updateCanvasCursor(e);
              }}
              onMouseLeave={() => {
                if (drawStartRef.current && (drawTool === 'line' || drawTool === 'vector' || drawTool === 'curve' || drawTool === 'sine')) {
                  redrawCanvasWithPreview(() => {});
                }
                if (transformMode) {
                  setTransformMode(null);
                  transformStartRef.current = null;
                }
                isDrawingRef.current = false;
                drawStartRef.current = null;
                lastCurveControlRef.current = null;
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDrawingForPlaceholder(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  canvasRef.current?.toBlob((blob) => {
                    if (blob) handleInsertDrawnChart(blob);
                  }, 'image/png');
                }}
              >
                Insert into paper
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {viewingPaper && viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{viewingPaper.title}</h3>
              <Button variant="ghost" onClick={closeViewer}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={viewerUrl}
                className="w-full h-full border-0"
                title={viewingPaper.title}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
            <div className="p-4 border-t bg-gray-50">
              <p className="text-sm text-gray-600 text-center">
                This document is view-only. Downloading is disabled for security.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
