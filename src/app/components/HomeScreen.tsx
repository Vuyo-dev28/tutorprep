import { Link } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { motion } from 'motion/react';
import { Header } from '@/app/components/Header';
import { useState } from 'react';
import { 
  Globe, 
  Star, 
  Lock, 
  Shield, 
  Mail, 
  Clock, 
  MapPin, 
  Zap,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export function HomeScreen() {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);

    if (!supabase) {
      setIsSubmitting(false);
      setSubmitMessage({
        type: 'error',
        text: 'Unable to submit form. Please try again later.',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .insert({
          name: contactForm.name,
          email: contactForm.email,
          subject: contactForm.subject,
          message: contactForm.message,
        });

      if (error) throw error;

      setIsSubmitting(false);
      setSubmitMessage({
        type: 'success',
        text: 'Thank you for contacting us! We\'ll get back to you within 24 hours.',
      });
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error('Error submitting contact form:', error);
      setIsSubmitting(false);
      setSubmitMessage({
        type: 'error',
        text: 'Failed to send message. Please try again later.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 overflow-x-hidden w-full">
      <Header isAuthenticated={false} />
      <div className="mx-auto max-w-6xl px-6 py-10 pt-28">

        <main id="home" className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-sm font-semibold text-blue-600 mb-4 flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              <span>Made in South Africa • Aligned with CAPS & IEB</span>
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl md:text-5xl font-semibold text-slate-900 leading-tight"
            >
              The trusted learning platform for South African students
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-slate-600 mt-5 text-lg max-w-xl"
            >
              Built specifically for South African curricula. Tutor Prep helps students excel in CAPS and IEB with personalized lessons, progress tracking, and parent-friendly reports. POPI Act compliant and secure.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Button asChild className="h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6">
                <Link to="/signup">Get started</Link>
              </Button>
              <Link to="/about" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                Learn more
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-600"
            >
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>
                <span>POPI Act Compliant</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>
                <span>CAPS & IEB Aligned</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>
                <span>Parent Reports</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>
                <span>Secure & Safe</span>
              </span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.6, 0.8, 0.6],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -top-10 -left-10 h-48 w-48 rounded-full bg-blue-200/60 blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.6, 0.8, 0.6],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 2,
              }}
              className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-purple-200/60 blur-3xl"
            />
            <motion.div
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ duration: 0.3 }}
              className="relative rounded-3xl bg-white shadow-2xl p-6 ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                <span>Tutor Prep Dashboard</span>
                <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Live</span>
              </div>
              <div className="grid gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="h-16 rounded-2xl bg-slate-100 flex items-center justify-between px-4"
                >
                  <div>
                    <p className="text-xs text-slate-500">Weekly lessons</p>
                    <p className="text-lg font-semibold text-slate-800">8 lessons</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-500/20" />
                </motion.div>
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                    className="h-24 rounded-2xl bg-slate-100 p-4"
                  >
                    <p className="text-xs text-slate-500">Active students</p>
                    <p className="text-xl font-semibold text-slate-800 mt-2">24</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="h-24 rounded-2xl bg-slate-100 p-4"
                  >
                    <p className="text-xs text-slate-500">Completion</p>
                    <p className="text-xl font-semibold text-slate-800 mt-2">82%</p>
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                  className="h-32 rounded-2xl bg-gradient-to-r from-blue-100 to-purple-100 p-4"
                >
                  <p className="text-xs text-slate-500">Recent activity</p>
                  <div className="mt-4 h-12 rounded-xl bg-white/70" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </main>

        {/* Trust Section - Statistics */}
        <section className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 p-10 text-white shadow-2xl"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-semibold mb-2">Trusted by South African families</h2>
              <p className="text-blue-100">Join thousands of students achieving better results</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { number: '2,000+', label: 'Active Students' },
                { number: '50,000+', label: 'Lessons Completed' },
                { number: '95%', label: 'Parent Satisfaction' },
                { number: '24/7', label: 'Support Available' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="text-center"
                >
                  <p className="text-4xl font-bold mb-1">{stat.number}</p>
                  <p className="text-blue-100 text-sm">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Parent Portal Section */}
        <section className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 p-10 text-white shadow-2xl"
          >
            <div className="grid gap-8 md:grid-cols-2 items-center">
              <div>
                <h2 className="text-3xl font-semibold mb-4">Parent Portal</h2>
                <p className="text-purple-100 mb-6 text-lg">
                  Stay connected with your child's learning journey. Access real-time progress reports, 
                  see where they're excelling, and identify areas that need extra support.
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>View all your children's progress in one place</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Detailed reports on topics and quiz performance</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Identify struggling areas with explanations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Access via email or secure access code</span>
                  </li>
                </ul>
                <Link to="/parent-portal/login">
                  <Button className="bg-white text-purple-600 hover:bg-purple-50">
                    Access Parent Portal
                  </Button>
                </Link>
              </div>
              <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="space-y-4">
                  <div className="bg-white/20 rounded-xl p-4">
                    <p className="text-sm text-purple-100 mb-2">Topics Completed</p>
                    <p className="text-2xl font-bold">Track progress across all subjects</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-4">
                    <p className="text-sm text-purple-100 mb-2">Quiz Scores</p>
                    <p className="text-2xl font-bold">See average performance</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-4">
                    <p className="text-sm text-purple-100 mb-2">Struggling Areas</p>
                    <p className="text-2xl font-bold">Get detailed insights</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="mt-20">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { title: 'CAPS & IEB Aligned', detail: 'Content specifically designed for South African curricula from Grade 4-12.' },
              { title: 'Parent-Friendly Reports', detail: 'Weekly progress summaries sent directly to parents via email.' },
              { title: 'Secure & Private', detail: 'POPI Act compliant. Your child\'s data is encrypted and protected.' },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
              >
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="text-slate-600 mt-2">{item.detail}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="products" className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200"
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <p className="text-sm font-semibold text-blue-600">Products</p>
                <h2 className="text-3xl font-semibold text-slate-900 mt-3">
                  Everything students need to excel
                </h2>
                <p className="text-slate-600 mt-4 max-w-xl">
                  Interactive lessons, practice quizzes, progress tracking, and automated reports to help students succeed in their studies.
                </p>
              </motion.div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  'Lesson builder',
                  'Assessment quizzes',
                  'Session scheduling',
                  'Progress reports',
                ].map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70"
                  >
                    <p className="font-medium text-slate-800">{feature}</p>
                    <p className="text-sm text-slate-500 mt-1">Included in every plan.</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* Parent Testimonials */}
        <section className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">What Parents Say</p>
            <h2 className="text-3xl font-semibold text-slate-900 mt-2">Trusted by South African families</h2>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: 'Sarah M., Johannesburg',
                role: 'Parent of Grade 10 student',
                content: 'My daughter\'s marks improved by 15% in just one term. The CAPS-aligned content and daily reports help me stay involved in her learning journey.',
                rating: 5,
              },
              {
                name: 'David K., Cape Town',
                role: 'Parent of Grade 8 student',
                content: 'As a parent, I love the weekly progress emails. It\'s reassuring to know my son is on track, and the IEB content matches exactly what he learns at school.',
                rating: 5,
              },
              {
                name: 'Nomsa T., Durban',
                role: 'Parent of Grade 12 student',
                content: 'The assessment quizzes helped my daughter prepare for her final exams. She felt so much more confident, and we could track her improvement week by week.',
                rating: 5,
              },
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-600 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Security & Privacy Section */}
        <section className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-gradient-to-br from-slate-50 to-blue-50 p-10 shadow-xl ring-1 ring-slate-200"
          >
            <div className="grid gap-8 md:grid-cols-2 items-center">
              <div>
                <p className="text-sm font-semibold text-blue-600 mb-2">Security & Privacy</p>
                <h2 className="text-3xl font-semibold text-slate-900 mb-4">
                  Your child's safety is our priority
                </h2>
                <div className="space-y-4 text-slate-600">
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl mt-1">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">POPI Act Compliant</p>
                      <p className="text-sm">We comply with South Africa's Protection of Personal Information Act. Your data is legally protected.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl mt-1">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">End-to-End Encryption</p>
                      <p className="text-sm">All student data is encrypted in transit and at rest using industry-standard security protocols.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl mt-1">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">No Third-Party Sharing</p>
                      <p className="text-sm">We never sell or share your child's information with third parties. Your privacy is guaranteed.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl mt-1">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Parental Controls</p>
                      <p className="text-sm">Parents have full visibility and control over their child's account and learning data.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Lock, label: 'Secure Login', color: 'text-blue-600' },
                  { icon: Shield, label: 'Data Protected', color: 'text-green-600' },
                  { icon: Mail, label: 'Email Verified', color: 'text-purple-600' },
                  { icon: CheckCircle2, label: 'POPI Compliant', color: 'text-emerald-600' },
                ].map((item, index) => {
                  const IconComponent = item.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="bg-white rounded-2xl p-6 text-center shadow-md"
                    >
                      <IconComponent className={`w-10 h-10 mx-auto mb-2 ${item.color}`} />
                      <p className="text-sm font-medium text-slate-700">{item.label}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </section>

        <section id="about" className="mt-20">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200"
            >
              <p className="text-sm font-semibold text-blue-600">About Tutor Prep</p>
              <h2 className="text-3xl font-semibold text-slate-900 mt-3">
                Built by South Africans, for South Africans
              </h2>
              <p className="text-slate-600 mt-4 leading-relaxed">
                Tutor Prep was created by a passionate team of South African educators, curriculum specialists, and developers who share a deep commitment to knowledge and education. We believe that every student deserves access to high-quality learning resources that are specifically designed for our unique education system.
              </p>
              <p className="text-slate-600 mt-4 leading-relaxed">
                Our team combines years of teaching experience with cutting-edge technology to create a platform that truly understands the challenges students face in CAPS and IEB curricula. We've worked closely with qualified South African teachers, curriculum experts, and parents to ensure Tutor Prep meets the real needs of our education community.
              </p>
              <p className="text-slate-600 mt-4 leading-relaxed">
                What drives us is seeing students gain confidence, improve their marks, and develop a genuine love for learning. We're not just building software—we're creating a supportive learning ecosystem where students can thrive, parents can stay informed, and educators can make a real difference.
              </p>
              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Created by a team passionate about knowledge and education</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Local support team based in South Africa</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Content created by qualified SA teachers and curriculum specialists</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Aligned with Department of Basic Education standards</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Continuously updated based on student and parent feedback</span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-4">
                <Button asChild className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Link to="/about">Read our story</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-2">
                  <Link to="/signup">Join the community</Link>
                </Button>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200"
            >
              <h3 className="text-xl font-semibold text-slate-900 mb-4">How it works</h3>
              <ol className="space-y-4 text-slate-600">
                {[
                  'Choose your curriculum (CAPS or IEB) and grade level.',
                  'Access personalized lessons aligned with your school syllabus.',
                  'Complete quizzes and track progress with detailed analytics.',
                  'Parents receive weekly progress reports via email.',
                ].map((item, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  >
                    {index + 1}. {item}
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          </div>
        </section>

        <section id="pricing" className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center text-white mb-10"
          >
            <p className="text-sm font-semibold uppercase tracking-wide">Pricing</p>
            <h2 className="text-3xl font-semibold mt-2">Plans for every student</h2>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: 'Trial',
                price: 'Free Trial',
                note: 'Try it out',
                cta: 'Start trial',
                features: [
                  'Lesson planning',
                  'Basic progress tracking',
                  'Community support',
                ],
              },
              {
                name: 'Pro',
                price: 'R199/mo',
                note: 'For serious learners',
                cta: 'Upgrade',
                features: [
                  'Everything in Trial',
                  'Advanced analytics',
                  'Priority support',
                  'Custom lesson templates',
                  'Progress reports',
                  'Student achievements',
                  'Leaderboards',
                  'Daily learning reports',
                ],
                highlight: true,
              },
              {
                name: 'Academy',
                price: 'Custom',
                note: 'For schools',
                cta: 'Contact sales',
                features: [
                  'Everything in Pro',
                  'Multi-teacher support',
                  'Custom branding',
                  'Dedicated account manager',
                  'API access',
                  'Bulk student management',
                ],
              },
            ].map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -10 }}
                className={`rounded-3xl p-8 shadow-2xl ring-1 ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-blue-50 to-purple-50 ring-blue-300'
                    : 'bg-white ring-slate-200'
                }`}
              >
                {plan.highlight && (
                  <div className="mb-3 inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
                <p className="text-3xl font-semibold text-slate-900 mt-4">{plan.price}</p>
                <p className="text-slate-500 mt-2">{plan.note}</p>
                <ul className="mt-6 space-y-2 text-sm text-slate-600">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>✓ {feature}</li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`mt-6 w-full rounded-full ${
                    plan.highlight
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Link to="/signup">{plan.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="support" className="mt-20">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200"
            >
              <p className="text-sm font-semibold text-blue-600">Support</p>
              <h2 className="text-3xl font-semibold text-slate-900 mt-3">
                Local support you can trust
              </h2>
              <p className="text-slate-600 mt-4">
                Our South African support team is here to help. We respond within 24 hours (often faster) and our help center is packed with guides, curriculum resources, and best practices for students and parents.
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Email support: support@tutorprep.co.za</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Available Monday-Friday, 8am-5pm SAST</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Help center with video tutorials</span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-4">
                <Button asChild className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Link to="/login">Talk to support</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-2">
                  <Link to="/about">Visit help center</Link>
                </Button>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200"
            >
              <h3 className="text-xl font-semibold text-slate-900 mb-4">FAQ</h3>
              <div className="space-y-4 text-slate-600 text-sm">
                {[
                  { q: 'Is my child\'s data safe?', a: 'Yes! We\'re POPI Act compliant and use end-to-end encryption. We never share data with third parties.' },
                  { q: 'Does it work with both CAPS and IEB?', a: 'Absolutely! Tutor Prep supports both curricula. Simply select your curriculum during signup.' },
                  { q: 'Can parents see progress?', a: 'Yes! Parents receive weekly email reports showing their child\'s progress, completed lessons, and quiz scores.' },
                  { q: 'Is there a trial?', a: 'Yes, start with a free trial to explore all features. No credit card required.' },
                  { q: 'What grades are supported?', a: 'Tutor Prep supports Grade 4 through Grade 12, covering all subjects in the South African curriculum.' },
                ].map((faq, index) => (
                  <motion.p
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  >
                    <span className="font-semibold text-slate-800">{faq.q}</span> {faq.a}
                  </motion.p>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200 flex flex-col items-center text-center"
          >
            <h2 className="text-3xl font-semibold text-slate-900">Ready to start learning?</h2>
            <p className="text-slate-600 mt-3 max-w-2xl">
              Join thousands of South African students using Tutor Prep to excel in their studies. 
              Get personalized lessons, track your progress, and achieve better results.
            </p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 flex flex-wrap gap-4"
            >
              <Button asChild className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
                <Link to="/signup">Start for free</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-2">
                <Link to="/about">See how it works</Link>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* For Tutors Section */}
        <section className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-10 shadow-xl ring-1 ring-amber-200"
          >
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-semibold text-slate-900 mb-4">Interested in Joining as a Tutor?</h2>
              <p className="text-slate-600 text-lg mb-6">
                Tutor Prep is currently focused on serving students directly. If you're a qualified tutor or educator 
                interested in joining our platform, please contact us to discuss opportunities.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button asChild className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8">
                  <a href="#contact">Contact Us</a>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-2">
                  <a href="mailto:support@tutorprep.co.za">Email: support@tutorprep.co.za</a>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Contact Form Section */}
        <section id="contact" className="mt-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 p-10 text-white shadow-2xl"
            >
              <h2 className="text-3xl font-semibold mb-4">Get in touch</h2>
              <p className="text-blue-100 mb-8 text-lg">
                Have questions? We're here to help. Our South African support team is ready to assist you.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    <span>Email</span>
                  </h3>
                  <a href="mailto:support@tutorprep.co.za" className="text-blue-100 hover:text-white transition-colors">
                    support@tutorprep.co.za
                  </a>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span>Business Hours</span>
                  </h3>
                  <p className="text-blue-100">
                    Monday - Friday: 8:00 AM - 5:00 PM SAST<br />
                    Saturday: 9:00 AM - 1:00 PM SAST
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    <span>Location</span>
                  </h3>
                  <p className="text-blue-100">
                    Based in South Africa<br />
                    Serving students nationwide
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    <span>Response Time</span>
                  </h3>
                  <p className="text-blue-100">
                    We typically respond within 24 hours<br />
                    Often much faster during business hours
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200"
            >
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Send us a message</h2>
              <p className="text-slate-600 mb-6">Fill out the form below and we'll get back to you as soon as possible.</p>
              
              <form onSubmit={handleContactSubmit} className="space-y-5">
                {submitMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      submitMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {submitMessage.text}
                  </motion.div>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-name" className="text-gray-700 mb-2 block">
                      Your Name *
                    </Label>
                    <Input
                      id="contact-name"
                      type="text"
                      placeholder="John Doe"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-email" className="text-gray-700 mb-2 block">
                      Email Address *
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="john@example.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="contact-subject" className="text-gray-700 mb-2 block">
                    Subject *
                  </Label>
                  <Input
                    id="contact-subject"
                    type="text"
                    placeholder="How can we help?"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contact-message" className="text-gray-700 mb-2 block">
                    Message *
                  </Label>
                  <Textarea
                    id="contact-message"
                    placeholder="Tell us more about your question or how we can help..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="min-h-32 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all resize-none"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>

                <p className="text-xs text-slate-500 text-center">
                  By submitting this form, you agree to our privacy policy. We'll never share your information.
                </p>
              </form>
            </motion.div>
          </div>
        </section>

        <footer className="mt-16 pb-10 text-white/90">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm">© 2026 Tutor Prep. All rights reserved.</span>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link to="/about" className="hover:text-white">About</Link>
              <Link to="/login" className="hover:text-white">Log in</Link>
              <Link to="/signup" className="hover:text-white">Get started</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
