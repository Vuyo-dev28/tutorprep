import { motion } from 'motion/react';
import { 
  BookOpen, 
  Search, 
  Target, 
  Award, 
  MessageCircle, 
  BarChart3,
  HelpCircle,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/ui/accordion';
import { useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

export function HelpScreen() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          setIsAuthenticated(!!user);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const quickLinks = [
    { icon: BookOpen, title: 'Getting Started', description: 'Learn the basics', href: '#getting-started' },
    { icon: Search, title: 'Search & Navigation', description: 'Find content quickly', href: '#search' },
    { icon: Target, title: 'Progress Tracking', description: 'Monitor your learning', href: '#progress' },
    { icon: Award, title: 'Achievements', description: 'Unlock rewards', href: '#achievements' },
    { icon: MessageCircle, title: 'Ask A Tutor', description: 'Get help anytime', href: '#tutor' },
    { icon: BarChart3, title: 'Reports', description: 'View your analytics', href: '#reports' },
  ];

  const faqs = [
    {
      question: 'How do I start learning?',
      answer: 'Navigate to the "Learn" section from the header, select a subject, then choose a topic. Start with the first lesson and work through them sequentially. Each lesson has a minimum viewing time of 10 seconds before you can proceed.',
    },
    {
      question: 'How do I search for content?',
      answer: 'Use the search bar in the Subjects screen to search for subjects and topics by name or description. The search works in real-time as you type.',
    },
    {
      question: 'How are quiz scores calculated?',
      answer: 'Quiz scores are calculated as a percentage of correct answers. You need to score 90% or higher to mark a topic as complete. Assessment quizzes have 50 questions, while regular quizzes have 10 questions.',
    },
    {
      question: 'What are achievements?',
      answer: 'Achievements are rewards you unlock by completing various milestones like finishing lessons, completing topics, maintaining study streaks, and scoring well on quizzes. Check your achievements in the Awards section.',
    },
    {
      question: 'How do I contact a tutor?',
      answer: 'Click the floating "Ask A Tutor" chat button on any page. You can send messages, upload files (PDFs, images, documents), and get real-time help from tutors.',
    },
    {
      question: 'Can I export my progress?',
      answer: 'Yes! Go to the Progress page and click "Export CSV" to download a detailed report of your learning progress, quiz scores, and subject completion.',
    },
    {
      question: 'How do I reset my password?',
      answer: 'On the login screen, click "Forgot password?" and enter your email. You\'ll receive a reset link. Click it to set a new password.',
    },
    {
      question: 'What is the difference between CAPS and IEB?',
      answer: 'CAPS (Curriculum and Assessment Policy Statement) and IEB (Independent Examinations Board) are two different South African curricula. You\'ll only see content for the curriculum you selected during signup.',
    },
    {
      question: 'How do study streaks work?',
      answer: 'Your study streak counts consecutive days with study activity. Each day you complete a lesson or quiz, your streak increases. The streak is displayed on your dashboard and progress page.',
    },
    {
      question: 'Can parents see my progress?',
      answer: 'Yes, if your parent email was provided during signup, they can access the Parent Portal using an access code to view your progress, quiz scores, and areas where you might be struggling.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {!isAuthenticated && <Header isAuthenticated={false} />}
      <div className={`max-w-6xl mx-auto px-6 ${!isAuthenticated ? 'pt-32' : 'pt-6'} pb-24`}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-3xl px-6 py-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <HelpCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold mb-2">Help & Documentation</h1>
                <p className="text-gray-600">Everything you need to know about Tutor Prep</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <motion.div
                  key={link.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  onClick={() => {
                    const element = document.querySelector(link.href);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="bg-white rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-1">{link.title}</h3>
                      <p className="text-sm text-gray-500">{link.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Getting Started */}
        <motion.div
          id="getting-started"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              Getting Started
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Create Your Account</h3>
                  <p className="text-gray-600 text-sm">Sign up with your email, select your grade, curriculum (CAPS or IEB), and provide your parent's email if applicable.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Explore Subjects</h3>
                  <p className="text-gray-600 text-sm">Navigate to "Learn" from the header to see all available subjects. Each subject contains multiple topics with lessons and quizzes.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Start Learning</h3>
                  <p className="text-gray-600 text-sm">Click on a topic to view its lessons. Complete each lesson (minimum 10 seconds) and then take the quiz to test your understanding.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">4</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Track Progress</h3>
                  <p className="text-gray-600 text-sm">Monitor your progress on the Dashboard and Progress pages. View your study streak, completed topics, quiz scores, and achievements.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-b border-gray-100">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <span className="font-semibold">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 pt-2">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>

        {/* Contact Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl p-8 text-white">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Still Need Help?</h2>
              <p className="text-blue-100 mb-6">Our support team is here to assist you</p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => navigate('/messages')}
                  className="bg-white text-blue-600 hover:bg-gray-100 rounded-full"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Open tutor chat if available
                    const chatButton = document.querySelector('[data-tutor-chat]');
                    if (chatButton) {
                      (chatButton as HTMLElement).click();
                    }
                  }}
                  className="border-white text-white hover:bg-white/10 rounded-full"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Ask A Tutor
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
