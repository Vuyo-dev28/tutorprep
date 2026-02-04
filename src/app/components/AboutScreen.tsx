import { Link } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { motion } from 'motion/react';
import { Header } from '@/app/components/Header';

export function AboutScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <Header isAuthenticated={false} />
      <div className="flex items-center justify-center p-6 pt-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-3xl bg-white rounded-[32px] p-10 shadow-2xl ring-1 ring-slate-200"
        >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-[28px] flex items-center justify-center text-4xl mx-auto mb-4">
            🌟
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">About Tutor Prep</h1>
          <p className="text-gray-500 mt-2">
            A friendly tutoring experience built to help learners stay confident and
            consistent.
          </p>
        </div>

        <div className="space-y-4 text-gray-600 leading-relaxed">
          <p>
            Tutor Prep was created by a passionate team of South African educators, curriculum specialists, and developers who share a deep commitment to knowledge and education. We believe that every student deserves access to high-quality learning resources that are specifically designed for our unique education system.
          </p>
          <p>
            Our team combines years of teaching experience with cutting-edge technology to create a platform that truly understands the challenges students face in CAPS and IEB curricula. We've worked closely with qualified South African teachers, curriculum experts, and parents to ensure Tutor Prep meets the real needs of our education community.
          </p>
          <p>
            Tutor Prep blends structured lessons, practice quizzes, and progress tracking so students always know what to focus on next. Whether you&apos;re preparing for exams or building daily learning habits, the platform is designed to keep you motivated with clear goals and feedback.
          </p>
          <p>
            What drives us is seeing students gain confidence, improve their marks, and develop a genuine love for learning. We're not just building software—we're creating a supportive learning ecosystem where students can thrive, parents can stay informed, and educators can make a real difference.
          </p>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Created by a team passionate about knowledge and education</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Content developed by qualified South African teachers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Aligned with Department of Basic Education standards</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>POPI Act compliant and secure</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Continuously improved based on user feedback</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <Button asChild className="h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30">
            <Link to="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full border-2">
            <Link to="/signup">Create an account</Link>
          </Button>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
