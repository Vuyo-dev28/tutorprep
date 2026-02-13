import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Textarea } from '@/app/components/ui/textarea';
import { 
  FileText, 
  BookOpen, 
  Calendar,
  TrendingUp,
  Award,
  Search,
  Filter,
  ArrowLeft,
  Check
} from 'lucide-react';
import { UserProfile } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { subscribe, handleSubscriptionCallback } from '@/lib/paystackSubscriptionService';

interface PastPapersDashboardProps {
  profile: UserProfile;
}

type PastPaper = {
  id: string;
  title?: string;
  year: number;
  exam_type: string;
  subject: string;
  grade: number;
  curriculum: string;
  term: number; // 1, 2, 3, or 4
  file_url?: string;
  file_name?: string;
  memo_file_url?: string | null;
  memo_file_name?: string | null;
  is_visible?: boolean;
  created_at: string;
};

export function PastPapersDashboard({ profile }: PastPapersDashboardProps) {
  const navigate = useNavigate();
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubjectTerm, setSelectedSubjectTerm] = useState<{ subject: string; term: number } | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingPaper, setViewingPaper] = useState<PastPaper | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const [viewerStyles, setViewerStyles] = useState<string>('');
  const [isMathReady, setIsMathReady] = useState(false);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [termAccess, setTermAccess] = useState<Record<number, boolean>>({});
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'cancelled' | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paywallLoadingPlan, setPaywallLoadingPlan] = useState<'monthly' | 'yearly' | 'term' | null>(null);
  const [paywallError, setPaywallError] = useState<string>('');
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [subjectVisibility, setSubjectVisibility] = useState<Record<string, boolean>>({});
  const [pastPaperSubjectList, setPastPaperSubjectList] = useState<{ name: string; sort_order: number }[]>([]);
  const [reportForm, setReportForm] = useState({
    paperId: '',
    issueType: 'Question unclear',
    message: '',
  });
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [pricingDismissed, setPricingDismissed] = useState(false);

  const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  const termAmount1 = import.meta.env.VITE_PAYSTACK_TERM_AMOUNT_1 as string | undefined;
  const termAmount2 = import.meta.env.VITE_PAYSTACK_TERM_AMOUNT_2 as string | undefined;
  const termAmount3 = import.meta.env.VITE_PAYSTACK_TERM_AMOUNT_3 as string | undefined;
  const termAmount4 = import.meta.env.VITE_PAYSTACK_TERM_AMOUNT_4 as string | undefined;
  const termAmountFallback = import.meta.env.VITE_PAYSTACK_TERM_AMOUNT as string | undefined;
  const monthlyAmount = import.meta.env.VITE_PAYSTACK_MONTHLY_AMOUNT as string | undefined;
  const yearlyAmount = import.meta.env.VITE_PAYSTACK_YEARLY_AMOUNT as string | undefined;

  // Group papers by subject and term
  const papersBySubjectAndTerm = pastPapers.reduce((acc, paper) => {
    if (!acc[paper.subject]) {
      acc[paper.subject] = {};
    }
    if (!acc[paper.subject][paper.term]) {
      acc[paper.subject][paper.term] = [];
    }
    acc[paper.subject][paper.term].push(paper);
    return acc;
  }, {} as Record<string, Record<number, PastPaper[]>>);

  useEffect(() => {
    const loadPastPapers = async () => {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      try {
        let visibilityMap: Record<string, boolean> = {};
        const { data: visibilityData, error: visibilityError } = await supabase
          .from('past_paper_subject_visibility')
          .select('subject,is_visible')
          .eq('curriculum', profile.curriculum);

        if (visibilityError) {
          console.error('Error loading subject visibility:', visibilityError);
        } else {
          (visibilityData || []).forEach((row: { subject: string; is_visible: boolean }) => {
            visibilityMap[row.subject] = row.is_visible;
          });
          setSubjectVisibility(visibilityMap);
        }

        const { data: subjectsData } = await supabase
          .from('past_paper_subjects')
          .select('name, sort_order')
          .order('sort_order');
        setPastPaperSubjectList((subjectsData as { name: string; sort_order: number }[]) || []);

        // Load actual past papers from database
        // Join with past_paper_terms to get term number
        // Use left join to ensure we get papers even if term relationship is missing
        const { data, error } = await supabase
          .from('past_papers')
          .select(`
            *,
            past_paper_terms!left(term_number)
          `)
          .eq('curriculum', profile.curriculum)
          .eq('is_visible', true)
          .order('year', { ascending: false });

        if (error) {
          console.error('Error loading past papers:', error);
          // Fallback to empty array if table doesn't exist yet
          setPastPapers([]);
          setIsLoading(false);
          return;
        }

        console.log('Loaded papers from database:', data?.length || 0);
        console.log('Sample paper data:', data?.[0]);

        // Transform database data to match PastPaper type
        const papers: PastPaper[] = (data || []).map((paper: any) => {
          // Get term number from relationship or direct term column
          // Handle both single object and array responses from Supabase
          let termNumber = 1;
          if (paper.past_paper_terms) {
            if (Array.isArray(paper.past_paper_terms) && paper.past_paper_terms.length > 0) {
              termNumber = paper.past_paper_terms[0]?.term_number || 1;
            } else if (paper.past_paper_terms.term_number) {
              termNumber = paper.past_paper_terms.term_number;
            }
          }
          // Fallback to direct term column if it exists
          if (!termNumber && paper.term) {
            termNumber = paper.term;
          }
          
          // Get subject from subject or subject_name
          const paperSubject = paper.subject || paper.subject_name || '';
          
          // Get grade from grade or grade_from
          const paperGrade = paper.grade || paper.grade_from || profile.grade;
          
          const transformedPaper = {
            id: paper.id,
            title: paper.title,
            year: paper.year || new Date().getFullYear(),
            exam_type: paper.exam_type || 'Exam',
            subject: paperSubject,
            grade: paperGrade,
            curriculum: paper.curriculum,
            term: termNumber,
            file_url: paper.file_url,
            file_name: paper.file_name,
            memo_file_url: paper.memo_file_url ?? null,
            memo_file_name: paper.memo_file_name ?? null,
            is_visible: paper.is_visible ?? true,
            created_at: paper.created_at,
          };
          
          console.log('Transformed paper:', transformedPaper, 'Original term data:', paper.past_paper_terms);
          return transformedPaper;
        })
        .filter((paper: PastPaper) => visibilityMap[paper.subject] !== false)
        // Filter by grade (match exact grade or if grade is within grade_from/grade_to range)
        .filter((paper: PastPaper) => {
          // If paper has grade_from and grade_to, check if user's grade is in range
          const paperData = data?.find((p: any) => p.id === paper.id);
          if (paperData?.grade_from !== undefined && paperData?.grade_to !== undefined) {
            const gradeMatch = profile.grade >= paperData.grade_from && profile.grade <= paperData.grade_to;
            console.log('Grade range filter:', paperData.grade_from, '-', paperData.grade_to, 'User grade:', profile.grade, 'Match:', gradeMatch);
            return gradeMatch;
          }
          // Otherwise, match exact grade
          const gradeMatch = paper.grade === profile.grade;
          console.log('Grade exact filter:', paper.grade, 'User grade:', profile.grade, 'Match:', gradeMatch);
          return gradeMatch;
        });

        console.log('Final filtered papers:', papers.length, papers);
        console.log('Papers by subject and term:', papers.reduce((acc, p) => {
          if (!acc[p.subject]) acc[p.subject] = {};
          if (!acc[p.subject][p.term]) acc[p.subject][p.term] = [];
          acc[p.subject][p.term].push(p);
          return acc;
        }, {} as Record<string, Record<number, PastPaper[]>>));
        
        setPastPapers(papers);
      } catch (error) {
        console.error('Error loading past papers:', error);
        // Fallback to empty array on error
        setPastPapers([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPastPapers();
  }, [profile.grade, profile.curriculum]);

  // Handle subscription callback from Paystack
  useEffect(() => {
    const handleSubscriptionReturn = async () => {
      console.log('[Subscription Callback] ========================================');
      console.log('[Subscription Callback] Checking for callback');
      console.log('[Subscription Callback] Full URL:', window.location.href);
      console.log('[Subscription Callback] Search params:', window.location.search);
      console.log('[Subscription Callback] Pathname:', window.location.pathname);
      
      const urlParams = new URLSearchParams(window.location.search);
      const reference = urlParams.get('reference') || urlParams.get('trxref');
      const allParams: Record<string, string> = {};
      urlParams.forEach((value, key) => {
        allParams[key] = value;
      });
      console.log('[Subscription Callback] All URL params:', allParams);
      
      // Check if this is a subscription callback (has reference parameter)
      if (reference) {
        console.log('[Subscription Callback] ✅ Reference found:', reference);
        console.log('[Subscription Callback] Starting verification and save...');
        
        // CRITICAL: Verify user is authenticated before proceeding
        const { data: { user: checkUser }, error: checkError } = await supabase.auth.getUser();
        if (checkError || !checkUser) {
          console.error('[Subscription Callback] ❌ User not authenticated on callback page');
          console.error('[Subscription Callback] Error:', checkError);
          setPaywallError('Session expired. Please refresh the page and try again.');
          alert('Your session expired. Please refresh the page. Your payment was successful - contact support with reference: ' + reference);
          return;
        }
        console.log('[Subscription Callback] ✅ User authenticated:', checkUser.id);
        
        try {
          setPaywallLoadingPlan('monthly');
          const result = await handleSubscriptionCallback(window.location.search);
          console.log('[Subscription Callback] ✅ Callback handled successfully:', result);
          
          // Reload subscription data
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const subRes = await supabase
              .from('past_paper_subscriptions')
              .select('current_period_end, status')
              .eq('user_id', user.id)
              .gt('current_period_end', new Date().toISOString())
              .eq('status', 'active')
              .single();
            
            if (subRes.data) {
              setSubscriptionEnd(subRes.data.current_period_end);
              setSubscriptionPlan('monthly');
              setSubscriptionStatus(subRes.data.status);
            }
          }
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
          console.log('[Subscription] URL cleaned, subscription should be active');
        } catch (error: any) {
          console.error('[Subscription] Callback failed:', error);
          console.error('[Subscription] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });
          setPaywallError(error.message || 'Failed to verify subscription');
          // Show error to user
          alert(`Subscription verification failed: ${error.message}`);
        } finally {
          setPaywallLoadingPlan(null);
        }
      } else {
        console.log('[Subscription] No reference parameter found in URL:', window.location.search);
        // Check if subscription=success is in URL (might be from Paystack redirect)
        if (urlParams.get('subscription') === 'success') {
          console.log('[Subscription] Subscription success param found, but no reference. User may need to refresh or check Paystack dashboard.');
        }
      }
    };

    handleSubscriptionReturn();
  }, []);

  useEffect(() => {
    const loadAccess = async () => {
      if (!supabase) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [termRes, subRes, planRes] = await Promise.all([
          supabase
            .from('past_paper_term_access')
            .select('term_number')
            .eq('user_id', user.id)
            .eq('curriculum', profile.curriculum),
          supabase
            .from('past_paper_subscriptions')
            .select('current_period_end, status')
            .eq('user_id', user.id)
            .gt('current_period_end', new Date().toISOString())
            .maybeSingle(),
          supabase
            .from('past_paper_subscription_payments')
            .select('plan')
            .eq('user_id', user.id)
            .eq('curriculum', profile.curriculum)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (termRes.error) throw termRes.error;
        const accessMap: Record<number, boolean> = {};
        (termRes.data || []).forEach((row: any) => {
          if (row.term_number) accessMap[row.term_number] = true;
        });
        setTermAccess(accessMap);
        if (subRes.data?.current_period_end) {
          setSubscriptionEnd(subRes.data.current_period_end);
          const plan = planRes.data?.plan;
          setSubscriptionPlan(plan === 'monthly' || plan === 'yearly' ? plan : null);
          setSubscriptionStatus(subRes.data.status === 'cancelled' ? 'cancelled' : 'active');
        } else {
          setSubscriptionEnd(null);
          setSubscriptionPlan(null);
          setSubscriptionStatus(null);
        }
      } catch (error) {
        console.error('Error loading term access:', error);
      } finally {
        setAccessLoaded(true);
      }
    };

    loadAccess();
  }, [profile.curriculum]);

  useEffect(() => {
    if (!viewerHtml) return;

    const ensureKaTeX = async () => {
      if ((window as any).renderMathInElement) {
        setIsMathReady(true);
        return;
      }

      const existingCss = document.querySelector('link[data-katex="true"]');
      if (!existingCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        link.setAttribute('data-katex', 'true');
        document.head.appendChild(link);
      }

      const loadScript = (src: string) =>
        new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.body.appendChild(script);
        });

      try {
        await loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js');
        setIsMathReady(true);
      } catch (error) {
        console.error('Error loading KaTeX:', error);
      }
    };

    ensureKaTeX();
  }, [viewerHtml]);

  useEffect(() => {
    if (!viewerHtml || !isMathReady) return;
    const container = document.getElementById('paper-html-viewer');
    if (!container || !(window as any).renderMathInElement) return;
    (window as any).renderMathInElement(container, {
      delimiters: [
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
    });
  }, [viewerHtml, isMathReady]);

  useEffect(() => {
    if (!pdfData) return;

    const ensurePdfJs = async () => {
      if ((window as any).pdfjsLib) {
        return;
      }

      const loadScript = (src: string) =>
        new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.body.appendChild(script);
        });

      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };

    const renderPdf = async () => {
      try {
        await ensurePdfJs();
        const pdfjsLib = (window as any).pdfjsLib;
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        const container = pdfContainerRef.current;
        if (!container) return;
        container.innerHTML = '';
        const scale = 1.2;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.width = '100%';
          canvas.style.marginBottom = '16px';
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
          }
          container.appendChild(canvas);
        }
      } catch (error) {
        console.error('Error rendering PDF:', error);
        setPdfRenderError('Failed to render PDF. Please try again.');
      } finally {
        setIsPdfLoading(false);
      }
    };

    setIsPdfLoading(true);
    setPdfRenderError(null);
    const waitForContainer = () => {
      if (pdfContainerRef.current) {
        renderPdf();
      } else {
        requestAnimationFrame(waitForContainer);
      }
    };
    waitForContainer();
  }, [pdfData]);

  // Get papers for selected subject and term
  const selectedPapers = selectedSubjectTerm
    ? (papersBySubjectAndTerm[selectedSubjectTerm.subject]?.[selectedSubjectTerm.term] || [])
    : [];

  // Filter papers based on year and search
  const filteredPapers = selectedPapers.filter(paper => {
    const matchesYear = selectedYear === 'all' || paper.year.toString() === selectedYear;
    const matchesSearch = searchQuery === '' || 
      paper.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.exam_type.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesYear && matchesSearch;
  }).sort((a, b) => b.year - a.year); // Sort by year (newest first)

  const hasActiveSubscription = subscriptionEnd != null && new Date(subscriptionEnd) > new Date();
  const showPricingOverlay = accessLoaded && !hasActiveSubscription && !pricingDismissed;
  const hasAccessToTerm = (termNumber: number) =>
    termAccess[termNumber] === true || hasActiveSubscription;

  const getTermAmount = (termNumber: number) => {
    const amount =
      termNumber === 1 ? termAmount1 :
      termNumber === 2 ? termAmount2 :
      termNumber === 3 ? termAmount3 :
      termNumber === 4 ? termAmount4 :
      termAmountFallback;
    return amount ? parseInt(amount, 10) : NaN;
  };

  const getMonthlyAmount = () =>
    monthlyAmount ? parseInt(monthlyAmount, 10) : NaN;
  const getYearlyAmount = () =>
    yearlyAmount ? parseInt(yearlyAmount, 10) : NaN;

  const formatAmount = (amountKobo: number) => {
    if (!Number.isFinite(amountKobo)) return '';
    return `ZAR ${(amountKobo / 100).toFixed(2)}`;
  };

  const ensurePaystack = async () => {
    if ((window as any).PaystackPop) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paystack.'));
      document.body.appendChild(script);
    });
  };

  const startPaystackCheckout = async (termNumber: number) => {
    if (!supabase) return;
    setPaywallLoadingPlan('term');
    setPaywallError('');
    try {
      if (!paystackKey) {
        throw new Error('Paystack public key not configured.');
      }
      const amount = getTermAmount(termNumber);
      if (!Number.isFinite(amount)) {
        throw new Error('Paystack amount not configured for this term.');
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('Please sign in to pay.');
      }

      await ensurePaystack();
      const handler = (window as any).PaystackPop.setup({
        key: paystackKey,
        email: user.email,
        amount,
        currency: 'ZAR',
        metadata: {
          user_id: user.id,
          term_number: termNumber,
          curriculum: profile.curriculum,
        },
        callback: (response: any) => {
          (async () => {
            try {
              await supabase.from('past_paper_payments').insert({
                user_id: user.id,
                term_number: termNumber,
                curriculum: profile.curriculum,
                reference: response.reference,
                amount,
                currency: 'ZAR',
                status: 'success',
              });
              await supabase.from('past_paper_term_access').upsert({
                user_id: user.id,
                term_number: termNumber,
                curriculum: profile.curriculum,
              }, { onConflict: 'user_id,term_number,curriculum' });
              setTermAccess(prev => ({ ...prev, [termNumber]: true }));
            } catch (err: any) {
              console.error('Payment save failed:', err);
              setPaywallError(err.message || 'Payment save failed.');
            } finally {
              setPaywallLoadingPlan(null);
            }
          })();
        },
        onClose: () => {
          setPaywallLoadingPlan(null);
        },
      });
      handler.openIframe();
    } catch (err: any) {
      setPaywallError(err.message || 'Payment failed.');
      setPaywallLoadingPlan(null);
    }
  };

  const startPaystackCheckoutMonthly = async () => {
    console.log('[Subscribe Button] ========================================');
    console.log('[Subscribe Button] MONTHLY SUBSCRIBE BUTTON CLICKED');
    console.log('[Subscribe Button] ========================================');
    
    if (!supabase) {
      console.error('[Subscribe Button] ERROR: Supabase not initialized');
      return;
    }
    
    setPaywallLoadingPlan('monthly');
    setPaywallError('');
    
    try {
      console.log('[Subscribe Button] Getting user from Supabase...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('[Subscribe Button] Error getting user:', userError);
        throw new Error('Failed to get user: ' + userError.message);
      }
      
      if (!user?.email) {
        console.error('[Subscribe Button] ERROR: User email not found');
        throw new Error('Please sign in to pay.');
      }
      
      console.log('[Subscribe Button] User found:', {
        id: user.id,
        email: user.email,
      });

      setPricingDismissed(true);
      
      // Use the new subscription service with plan ID
      const monthlyAmountValue = getMonthlyAmount();
      console.log('[Subscribe Button] Monthly amount:', monthlyAmountValue);
      
      const callbackUrl = `${window.location.origin}${window.location.pathname}?subscription=success`;
      console.log('[Subscribe Button] Callback URL:', callbackUrl);
      console.log('[Subscribe Button] Current location:', window.location.href);
      
      const subscribeParams = {
        email: user.email,
        plan: 'PLN_6g747ghfq61svnc', // Explicit plan ID for monthly subscription
        amount: Number.isFinite(monthlyAmountValue) ? monthlyAmountValue : undefined,
        plan_type: 'monthly' as const,
        curriculum: (profile.curriculum || 'CAPS') as 'CAPS' | 'IEB', // Ensure curriculum is set
        callback_url: callbackUrl,
      };
      
      console.log('[Subscribe Button] Calling subscribe() with params:', subscribeParams);
      
      await subscribe(subscribeParams);
      
      console.log('[Subscribe Button] subscribe() completed, redirect should happen');
      
      // User will be redirected to Paystack, then to callback_url
      // The callback handler should verify and save the subscription
    } catch (err: any) {
      console.error('[Subscribe Button] ERROR in startPaystackCheckoutMonthly:', err);
      console.error('[Subscribe Button] Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      setPaywallError(err.message || 'Failed to start payment.');
      setPaywallLoadingPlan(null);
    }
  };

  const startPaystackCheckoutYearly = async () => {
    if (!supabase) return;
    setPaywallLoadingPlan('yearly');
    setPaywallError('');
    try {
      if (!paystackKey) {
        throw new Error('Paystack public key not configured.');
      }
      const amount = getYearlyAmount();
      if (!Number.isFinite(amount)) {
        throw new Error('Yearly plan amount not configured.');
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('Please sign in to pay.');
      }

      setPricingDismissed(true);
      await ensurePaystack();
      const handler = (window as any).PaystackPop.setup({
        key: paystackKey,
        email: user.email,
        amount,
        currency: 'ZAR',
        metadata: {
          user_id: user.id,
          plan: 'yearly',
          curriculum: profile.curriculum,
        },
        callback: (response: any) => {
          (async () => {
            try {
              const periodEnd = new Date();
              periodEnd.setFullYear(periodEnd.getFullYear() + 1);
              await supabase.from('past_paper_subscription_payments').insert({
                user_id: user.id,
                plan: 'yearly',
                curriculum: profile.curriculum,
                reference: response.reference,
                amount,
                currency: 'ZAR',
                status: 'success',
              });
              await supabase.from('past_paper_subscriptions').upsert({
                user_id: user.id,
                curriculum: profile.curriculum,
                status: 'active',
                current_period_end: periodEnd.toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });
              setSubscriptionEnd(periodEnd.toISOString());
              setSubscriptionPlan('yearly');
            } catch (err: any) {
              console.error('Subscription save failed:', err);
              setPaywallError(err.message || 'Subscription save failed.');
            } finally {
              setPaywallLoadingPlan(null);
            }
          })();
        },
        onClose: () => {
          setPaywallLoadingPlan(null);
        },
      });
      requestAnimationFrame(() => {
        handler.openIframe();
      });
    } catch (err: any) {
      console.error('Payment init failed:', err);
      setPaywallError(err.message || 'Failed to start payment.');
      setPaywallLoadingPlan(null);
    }
  };

  const cancelSubscription = async () => {
    if (!supabase) return;
    setIsCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('past_paper_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) throw error;
      setSubscriptionStatus('cancelled');
      setShowCancelConfirm(false);
    } catch (err: any) {
      console.error('Cancel subscription failed:', err);
      setPaywallError(err.message || 'Failed to cancel subscription.');
    } finally {
      setIsCancelling(false);
    }
  };

  const openFileViewer = async (paper: PastPaper, fileUrl?: string, fileName?: string) => {
    if (!supabase) return;

    try {
      if (!hasAccessToTerm(paper.term)) {
        setPaywallError('Please pay to access this term.');
        setIsPreviewOpen(true);
        return;
      }
      if (!fileUrl) {
        throw new Error('File not available for this paper.');
      }

      setViewingPaper(paper);
      setIsViewerLoading(true);
      setViewerHtml(null);
      setPdfData(null);
      setPdfRenderError(null);

      // Check if file is HTML or PDF (regenerated papers are .html and load faster)
      const isHtml = fileUrl.toLowerCase().endsWith('.html') || fileName?.toLowerCase().endsWith('.html');

      const { data, error } = await supabase.storage
        .from('past-papers')
        .createSignedUrl(fileUrl, 3600);

      if (error) throw error;

      if (isHtml) {
        const response = await fetch(data.signedUrl);
        if (!response.ok) {
          throw new Error('Failed to load content.');
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const styles = Array.from(doc.querySelectorAll('style'))
          .map(style => style.textContent || '')
          .join('\n');
        const bodyContent = doc.body?.innerHTML || html;
        setViewerStyles(styles);
        setViewerHtml(bodyContent);
        setViewerUrl(null);
      } else {
        setIsPdfLoading(true);
        const response = await fetch(data.signedUrl);
        if (!response.ok) {
          throw new Error('Failed to load PDF.');
        }
        const arrayBuffer = await response.arrayBuffer();
        setPdfData(arrayBuffer);
        setViewerHtml(null);
        setViewerStyles('');
        setViewerUrl(null);
      }
      setIsViewerLoading(false);
    } catch (error) {
      console.error('Error opening past paper:', error);
      setViewingPaper(null);
      setIsPdfLoading(false);
      setIsViewerLoading(false);
      alert('Failed to open past paper. Please try again.');
    }
  };

  const handlePaperClick = async (paper: PastPaper) => {
    await openFileViewer(paper, paper.file_url, paper.file_name);
  };

  const handleMemoClick = async (paper: PastPaper) => {
    await openFileViewer(paper, paper.memo_file_url || undefined, paper.memo_file_name || undefined);
  };

  const closeViewer = () => {
    setViewingPaper(null);
    setViewerUrl(null);
    setViewerHtml(null);
    setViewerStyles('');
    setIsMathReady(false);
    setPdfData(null);
    setIsPdfLoading(false);
    setIsViewerLoading(false);
    setPdfRenderError(null);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
  };

  const handleSelectTerm = (subject: string, term: number) => {
    setSelectedSubjectTerm({ subject, term });
    if (!hasAccessToTerm(term)) {
      setIsPreviewOpen(true);
    }
  };

  const handleReportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setReportStatus(null);

    if (!reportForm.message.trim()) {
      setReportStatus({ type: 'error', text: 'Please describe the issue.' });
      return;
    }

    if (!supabase) {
      setReportStatus({ type: 'error', text: 'Unable to submit report right now.' });
      return;
    }

    setIsReportSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email ?? 'unknown';
      const selectedPaper = selectedPapers.find((paper) => paper.id === reportForm.paperId);

      const paperLabel = selectedPaper
        ? `${selectedPaper.title || selectedPaper.subject} | ${selectedPaper.exam_type} | Year ${selectedPaper.year} | Term ${selectedPaper.term} | ID ${selectedPaper.id}`
        : 'Not selected';

      const message = [
        reportForm.message.trim(),
        '',
        `Paper: ${paperLabel}`,
        `Student: ${profile.name} | Grade ${profile.grade} | ${profile.curriculum}`,
        selectedSubjectTerm
          ? `Context: ${selectedSubjectTerm.subject} Term ${selectedSubjectTerm.term}`
          : 'Context: N/A',
      ].join('\n');

      const { error } = await supabase.from('contact_submissions').insert({
        name: profile.name || 'Student',
        email,
        subject: `Past Paper Issue - ${reportForm.issueType}`,
        message,
      });

      if (error) throw error;

      setReportStatus({ type: 'success', text: 'Thanks! Your report has been sent.' });
      setReportForm((prev) => ({ ...prev, message: '' }));
    } catch (error) {
      console.error('Error submitting report:', error);
      setReportStatus({ type: 'error', text: 'Failed to send report. Please try again.' });
    } finally {
      setIsReportSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading past papers...</div>
      </div>
    );
  }

  // Price display with placeholder when not configured
  const priceDisplay = (amount: number, suffix: string) =>
    formatAmount(amount) ? `${formatAmount(amount)}${suffix}` : 'ZAR —';

  // Pricing overlay (floats over dashboard when user has no subscription)
  const pricingOverlay = showPricingOverlay ? (
    <Dialog open onOpenChange={(open) => { if (!open) setPricingDismissed(true); }}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-2xl mx-auto rounded-xl overflow-hidden bg-white shadow-xl border border-slate-200/80 p-0 flex flex-col max-h-[90dvh] sm:max-h-none">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 px-3 py-2 sm:px-5 sm:py-4 text-white shrink-0">
          <DialogHeader className="space-y-0 sm:space-y-1">
            <DialogTitle className="text-sm sm:text-lg font-semibold tracking-tight text-white antialiased">
              Past Papers – Pricing
            </DialogTitle>
            <DialogDescription className="text-white/90 text-[11px] sm:text-sm antialiased">
              Grade {profile.grade}, {profile.curriculum}. Choose one option below.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-4 overflow-y-auto overflow-x-hidden sm:overflow-visible items-stretch min-h-0 flex-1 sm:min-h-0 sm:flex-initial">
          {/* One Term Papers */}
          <Card className="flex flex-col rounded-lg border border-slate-200 bg-white p-2 sm:p-4 transition-shadow hover:shadow-md min-w-0">
            <div className="min-h-0 sm:min-h-[3.5rem] flex flex-col justify-start">
              <CardHeader className="p-0">
                <CardTitle className="text-[11px] sm:text-base font-semibold text-slate-900 leading-tight line-clamp-2 sm:line-clamp-none">
                  One Term Papers
                </CardTitle>
                <CardDescription className="text-[9px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1 leading-tight line-clamp-2 sm:line-clamp-none">
                  Single term. Pick subject and term in the dashboard, then pay to unlock.
                </CardDescription>
              </CardHeader>
            </div>
            <p className="text-[11px] sm:text-base font-bold text-slate-900 mt-1 sm:mt-3 mb-1 sm:mb-3 min-h-[1.25rem] sm:min-h-[1.5rem] flex items-center">
              {priceDisplay(getTermAmount(1), ' /term')}
            </p>
            <ul className="space-y-0.5 sm:space-y-2 text-[9px] sm:text-xs text-slate-700 flex-1 min-h-0">
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">One term of your choice</span>
              </li>
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">One-time payment</span>
              </li>
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">Any subject</span>
              </li>
            </ul>
            <Button
              variant="outline"
              className="w-full mt-auto pt-1.5 sm:pt-4 min-h-8 sm:min-h-10 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0 text-[10px] sm:text-sm touch-manipulation"
              onClick={() => setPricingDismissed(true)}
            >
              Choose Term
            </Button>
          </Card>
          {/* Monthly – All papers (Best value) */}
          <Card className="flex flex-col rounded-lg border-2 border-purple-500/80 bg-white p-2 sm:p-4 shadow-sm transition-shadow hover:shadow-md min-w-0">
            <div className="min-h-0 sm:min-h-[3.5rem] flex flex-col justify-start">
              <CardHeader className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0 sm:gap-2 min-w-0">
                  <CardTitle className="text-[11px] sm:text-base font-semibold text-slate-900 leading-tight line-clamp-2 sm:line-clamp-none">
                    Monthly – All papers
                  </CardTitle>
                  <span className="text-[9px] sm:text-[10px] font-medium text-purple-700 bg-purple-100 px-1 sm:px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap w-fit mt-0.5 sm:mt-0">
                    Best value
                  </span>
                </div>
                <CardDescription className="text-[9px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1 leading-tight line-clamp-2 sm:line-clamp-none">
                  Every subject and term. Cancel anytime.
                </CardDescription>
              </CardHeader>
            </div>
            <p className="text-[11px] sm:text-base font-bold text-slate-900 mt-1 sm:mt-3 mb-1 sm:mb-3 min-h-[1.25rem] sm:min-h-[1.5rem] flex items-center">
              {priceDisplay(getMonthlyAmount(), ' /mo')}
            </p>
            <ul className="space-y-0.5 sm:space-y-2 text-[9px] sm:text-xs text-slate-700 flex-1 min-h-0">
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-purple-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">All subjects and terms</span>
              </li>
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-purple-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">Cancel anytime</span>
              </li>
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-purple-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">Billed monthly</span>
              </li>
            </ul>
            <Button
              className="w-full mt-auto pt-1.5 sm:pt-4 min-h-8 sm:min-h-10 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shrink-0 text-[10px] sm:text-sm touch-manipulation"
              disabled={paywallLoadingPlan !== null}
              onClick={() => startPaystackCheckoutMonthly()}
            >
              {paywallLoadingPlan === 'monthly' ? '…' : 'Subscribe'}
            </Button>
          </Card>
          {/* Yearly – All papers */}
          <Card className="flex flex-col rounded-lg border border-slate-200 bg-white p-2 sm:p-4 transition-shadow hover:shadow-md hover:border-slate-300 min-w-0">
            <div className="min-h-0 sm:min-h-[3.5rem] flex flex-col justify-start">
              <CardHeader className="p-0">
                <CardTitle className="text-[11px] sm:text-base font-semibold text-slate-900 leading-tight line-clamp-2 sm:line-clamp-none">
                  Yearly – All papers
                </CardTitle>
                <CardDescription className="text-[9px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1 leading-tight line-clamp-2 sm:line-clamp-none">
                  Full access for 12 months. All subjects and terms.
                </CardDescription>
              </CardHeader>
            </div>
            <p className="text-[11px] sm:text-base font-bold text-slate-900 mt-1 sm:mt-3 mb-1 sm:mb-3 min-h-[1.25rem] sm:min-h-[1.5rem] flex items-center">
              {priceDisplay(getYearlyAmount(), ' /yr')}
            </p>
            <ul className="space-y-0.5 sm:space-y-2 text-[9px] sm:text-xs text-slate-700 flex-1 min-h-0">
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">All subjects and terms</span>
              </li>
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">12 months access</span>
              </li>
              <li className="flex items-center gap-1.5 sm:gap-2">
                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" strokeWidth={2.5} />
                <span className="line-clamp-1 sm:line-clamp-none">Lowest cost per month</span>
              </li>
            </ul>
            <Button
              className="w-full mt-auto pt-1.5 sm:pt-4 min-h-8 sm:min-h-10 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-[10px] sm:text-sm touch-manipulation"
              disabled={paywallLoadingPlan !== null}
              onClick={() => startPaystackCheckoutYearly()}
            >
              {paywallLoadingPlan === 'yearly' ? '…' : 'Subscribe'}
            </Button>
          </Card>
        </div>
        <DialogFooter className="flex justify-center border-t border-slate-100 bg-slate-50/50 px-2 sm:px-4 py-2 sm:py-3 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 hover:bg-transparent"
            onClick={() => setPricingDismissed(true)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  // If no subject/term is selected, show subject sections with terms
  if (!selectedSubjectTerm) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] p-4 sm:p-6 lg:p-8">
        {pricingOverlay}
        <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <DialogContent className="max-w-sm rounded-xl">
            <DialogHeader>
              <DialogTitle>Cancel subscription?</DialogTitle>
              <DialogDescription>
                You will keep access to all past papers until {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'the end of your period'}. After that, you can subscribe again anytime.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowCancelConfirm(false)} disabled={isCancelling}>
                Keep subscription
              </Button>
              <Button variant="destructive" onClick={cancelSubscription} disabled={isCancelling}>
                {isCancelling ? 'Cancelling…' : 'Cancel subscription'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
              Past Papers Dashboard
            </h1>
            <p className="text-slate-600">
              Select a subject and term to view past exam papers for Grade {profile.grade} - {profile.curriculum} curriculum
            </p>
          </motion.div>

          {/* Access: full (subscription) or pricing (One term / Monthly / Yearly) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    {hasActiveSubscription && subscriptionEnd ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">Full access to all past papers</h3>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${subscriptionStatus === 'cancelled' ? 'bg-amber-500/30 text-amber-100 ring-amber-400/40' : 'bg-white/25 text-white ring-white/30'}`}>
                            {subscriptionStatus === 'cancelled' ? 'Cancelled' : 'Active'}
                          </span>
                        </div>
                        <p className="text-white/90 text-sm mt-0.5">
                          {subscriptionPlan === 'monthly'
                            ? 'Monthly subscription'
                            : subscriptionPlan === 'yearly'
                              ? 'Yearly subscription'
                              : 'Subscription'}{' '}
                          · {subscriptionStatus === 'cancelled' ? 'Access until ' : 'Active until '}
                          {new Date(subscriptionEnd).toLocaleDateString(undefined, { dateStyle: 'long' })}.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-white">One term, Monthly, or Yearly</h3>
                        <p className="text-white/90 text-sm mt-0.5">
                          One term papers, or full access with monthly/yearly – all papers.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {hasActiveSubscription && subscriptionStatus === 'active' && (
                  <Button
                    variant="outline"
                    className="rounded-full border-white/50 bg-white/10 text-white hover:bg-white/20 shrink-0"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    Cancel subscription
                  </Button>
                )}
                {!hasActiveSubscription && (
                  <Button
                    className="rounded-full bg-white text-indigo-600 hover:bg-white/90 shrink-0"
                    onClick={() => setPricingDismissed(false)}
                  >
                    View pricing
                  </Button>
                )}
              </CardContent>
              {paywallError && (
                <p className="text-xs text-rose-200 px-4 pb-3 text-center">{paywallError}</p>
              )}
            </Card>
          </motion.div>

          {/* Subject sections (from past_paper_subjects, or from papers if table empty) */}
          <div className="space-y-12">
            {(pastPaperSubjectList.length > 0
              ? pastPaperSubjectList.map((s) => s.name)
              : Object.keys(papersBySubjectAndTerm).sort())
              .filter((subject) => subjectVisibility[subject] !== false)
              .filter((subject) => {
                const subjectTerms = papersBySubjectAndTerm[subject] || {};
                const totalPapers = Object.values(subjectTerms).reduce(
                  (sum, papers) => sum + papers.length,
                  0
                );
                return totalPapers > 0;
              })
              .map((subject, subjectIndex) => {
              const subjectTerms = papersBySubjectAndTerm[subject] || {};
              
              return (
                <motion.div
                  key={subject}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: subjectIndex * 0.2 }}
                >
                  {/* Subject Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{subject}</h2>
                    <p className="text-slate-600">Select a term to view past papers</p>
                  </div>

                  {/* Term Selection Grid for this Subject */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4]
                      .map((term) => {
                        const termPapers = subjectTerms[term] || [];
                        return { term, termPapers, termPaperCount: termPapers.length };
                      })
                      .filter(({ termPaperCount }) => termPaperCount > 0)
                      .map(({ term, termPapers, termPaperCount }) => {
                      
                      return (
                        <motion.div
                          key={term}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: subjectIndex * 0.2 + term * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Card 
                            className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer h-full bg-gradient-to-br from-blue-50 to-purple-50"
                            onClick={() => handleSelectTerm(subject, term)}
                          >
                            <CardHeader className="text-center pb-4">
                              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-3xl font-bold text-white">{term}</span>
                              </div>
                              <CardTitle className="text-xl font-bold text-slate-900">
                                Term {term}
                              </CardTitle>
                              <CardDescription className="text-base mt-2">
                                {termPaperCount} {termPaperCount === 1 ? 'paper' : 'papers'} available
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center">
                              <Button 
                                className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectTerm(subject, term);
                                }}
                              >
                                View Papers
                              </Button>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const isLocked = !hasAccessToTerm(selectedSubjectTerm.term);
  const termPrice = formatAmount(getTermAmount(selectedSubjectTerm.term));

  // If subject and term are selected, show papers
  return (
    <div className="min-h-screen bg-[#f5f5f7] p-4 sm:p-6 lg:p-8">
      {pricingOverlay}
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSubjectTerm(null)}
              className="rounded-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
            {selectedSubjectTerm.subject} - Term {selectedSubjectTerm.term}
          </h1>
          <p className="text-slate-600">
            Past exam papers for Grade {profile.grade} - {profile.curriculum} curriculum
            {hasActiveSubscription && (
              <span className="ml-2 text-indigo-600 font-medium">— You have full access</span>
            )}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <Card className="border border-amber-200 bg-amber-50">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-amber-900">Report an error or unclear question</h3>
                <p className="text-sm text-amber-800">
                  We’ll fix it quickly. One quick message helps us improve all papers.
                </p>
              </div>
              <Button
                className="rounded-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => document.getElementById('report-error')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Report now
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search past papers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Year Filter */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="pl-10 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 appearance-none bg-white"
                  >
                    <option value="all">All Years</option>
                    {Array.from(new Set(selectedPapers.map(p => p.year))).sort((a, b) => b - a).map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Past Papers Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {filteredPapers.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No past papers found</h3>
                <p className="text-slate-600">
                  {searchQuery || selectedYear !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Past papers will appear here once they are added'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPapers.map((paper, index) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card 
                    className="border-0 shadow-sm hover:shadow-lg transition-shadow cursor-pointer h-full"
                    onClick={() => handlePaperClick(paper)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center`}>
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          {paper.year}
                        </span>
                      </div>
                      <CardTitle className="text-xl">{paper.title || paper.subject}</CardTitle>
                      <CardDescription>
                        {paper.exam_type} • Term {paper.term}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Year: {paper.year}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          <span>Grade {paper.grade} - {paper.curriculum}</span>
                        </div>
                      </div>
                      {isLocked ? (
                        <div className="mt-4 space-y-2">
                          <Button
                            className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={paywallLoadingPlan !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              startPaystackCheckout(selectedSubjectTerm.term);
                            }}
                          >
                            {paywallLoadingPlan === 'term' ? 'Starting payment...' : `Get access (${termPrice || 'pay'})`}
                          </Button>
                          {paywallError && (
                            <p className="text-xs text-rose-600 text-center">{paywallError}</p>
                          )}
                          <p className="text-[11px] text-slate-500 text-center">
                            One payment unlocks all papers for this term.
                          </p>
                        </div>
                      ) : (
                        <>
                          <Button 
                            className="w-full mt-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePaperClick(paper);
                            }}
                          >
                            View Paper
                          </Button>
                          {paper.memo_file_url && (
                            <Button
                              variant="outline"
                              className="w-full mt-2 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMemoClick(paper);
                              }}
                            >
                              View Memo
                            </Button>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info Section */}
        <motion.div
          id="report-error"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-8"
        >
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Report an error</h3>
              <p className="text-sm text-slate-600 mb-4">
                Spot a problem or don’t understand a question? Send us a quick report.
              </p>
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Paper (optional)</label>
                    <select
                      value={reportForm.paperId}
                      onChange={(e) => setReportForm((prev) => ({ ...prev, paperId: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Select a paper</option>
                      {selectedPapers.map((paper) => (
                        <option key={paper.id} value={paper.id}>
                          {paper.title || paper.subject} • {paper.exam_type} • {paper.year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Issue type</label>
                    <select
                      value={reportForm.issueType}
                      onChange={(e) => setReportForm((prev) => ({ ...prev, issueType: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="Question unclear">Question unclear</option>
                      <option value="Possible error">Possible error</option>
                      <option value="Missing memo">Missing memo</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">What’s wrong?</label>
                  <Textarea
                    value={reportForm.message}
                    onChange={(e) => setReportForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Describe the issue so we can fix it quickly."
                    className="min-h-[120px]"
                  />
                </div>
                {reportStatus && (
                  <p
                    className={`text-sm ${
                      reportStatus.type === 'success' ? 'text-green-600' : 'text-rose-600'
                    }`}
                  >
                    {reportStatus.text}
                  </p>
                )}
                <Button
                  type="submit"
                  className="rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isReportSubmitting}
                >
                  {isReportSubmitting ? 'Sending...' : 'Send report'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-purple-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">How to use Past Papers</h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    <li>• Practice with real exam questions from previous years</li>
                    <li>• Review detailed solutions and mark schemes</li>
                    <li>• Track your performance and identify areas for improvement</li>
                    <li>• Filter by year to find what you need</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* View-Only Viewer Modal */}
      {viewingPaper && (isViewerLoading || viewerHtml || pdfData || isPdfLoading) && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {viewingPaper.subject} - {viewingPaper.exam_type} {viewingPaper.year}
              </h3>
              <Button variant="ghost" onClick={closeViewer}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
              {viewerHtml ? (
                <div className="w-full h-full overflow-y-auto bg-white">
                  {viewerStyles && <style>{viewerStyles}</style>}
                  <div
                    id="paper-html-viewer"
                    className="px-6 py-4"
                    dangerouslySetInnerHTML={{ __html: viewerHtml }}
                  />
                </div>
              ) : (
                <div className="w-full h-full overflow-y-auto bg-white">
                  {isViewerLoading || isPdfLoading ? (
                    <div className="p-6 text-sm text-gray-500 flex items-center gap-2">
                      <span className="animate-pulse">Loading document...</span>
                    </div>
                  ) : pdfRenderError ? (
                    <div className="p-6 text-sm text-red-600">{pdfRenderError}</div>
                  ) : (
                    <div ref={pdfContainerRef} id="paper-pdf-viewer" className="px-6 py-4" />
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <p className="text-sm text-gray-600 text-center">
                This document is view-only. Downloading is disabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Paywall Modal */}
      {isPreviewOpen && isLocked && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div>
                <h3 className="text-lg font-semibold">
                  {selectedSubjectTerm.subject} • Term {selectedSubjectTerm.term} Preview
                </h3>
                <p className="text-sm text-blue-100">Unlock to view and download papers</p>
              </div>
              <Button variant="ghost" className="text-white hover:bg-white/20" onClick={closePreview}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPapers.map((paper) => (
                  <Card key={paper.id} className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base">{paper.title || paper.subject}</CardTitle>
                      <CardDescription>
                        {paper.exam_type} • Year {paper.year}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
            <div className="p-6 border-t bg-white">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600">
                    Pay {termPrice || 'the term fee'} once to unlock <strong>all papers</strong> for this term.
                  </p>
                  {paywallError && (
                    <p className="text-xs text-rose-600 mt-1">{paywallError}</p>
                  )}
                </div>
                <Button
                  className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6"
                  disabled={paywallLoadingPlan !== null}
                  onClick={() => startPaystackCheckout(selectedSubjectTerm.term)}
                >
                  {paywallLoadingPlan === 'term' ? 'Starting payment...' : `Get access (${termPrice || 'pay'})`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
