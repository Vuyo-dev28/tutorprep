import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { 
  Mail, 
  CheckCircle2, 
  Archive, 
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';

type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  created_at: string;
  updated_at: string;
};

export function ContactSubmissions() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'read' | 'replied' | 'archived'>('all');

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  const loadSubmissions = async () => {
    if (!supabase) return;

    try {
      let query = supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading contact submissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, status: ContactSubmission['status']) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await loadSubmissions();
      if (selectedSubmission?.id === id) {
        setSelectedSubmission({ ...selectedSubmission, status });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!supabase) return;
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadSubmissions();
      if (selectedSubmission?.id === id) {
        setSelectedSubmission(null);
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  };

  const getStatusBadge = (status: ContactSubmission['status']) => {
    const variants = {
      new: { className: 'bg-blue-100 text-blue-700', label: 'New' },
      read: { className: 'bg-gray-100 text-gray-700', label: 'Read' },
      replied: { className: 'bg-green-100 text-green-700', label: 'Replied' },
      archived: { className: 'bg-slate-100 text-slate-700', label: 'Archived' },
    };
    const variant = variants[status];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const newCount = submissions.filter((s) => s.status === 'new').length;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center text-gray-500">Loading submissions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Contact Submissions</h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage inquiries from the landing page contact form
            </p>
          </div>
          <Button onClick={loadSubmissions} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['all', 'new', 'read', 'replied', 'archived'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'new' && newCount > 0 && (
                <Badge className="ml-2 bg-blue-600 text-white">{newCount}</Badge>
              )}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Submissions List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Mail className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No submissions found</p>
              </div>
            ) : (
              filteredSubmissions.map((submission) => (
                <motion.div
                  key={submission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedSubmission?.id === submission.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedSubmission(submission);
                    if (submission.status === 'new') {
                      updateStatus(submission.id, 'read');
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{submission.name}</h4>
                      <p className="text-xs text-gray-500">{submission.email}</p>
                    </div>
                    {getStatusBadge(submission.status)}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                    {submission.subject}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(submission.created_at).toLocaleDateString()}
                  </p>
                </motion.div>
              ))
            )}
          </div>

          {/* Submission Detail */}
          <div className="bg-gray-50 rounded-xl p-6">
            {selectedSubmission ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{selectedSubmission.subject}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{selectedSubmission.name}</span>
                      <span>•</span>
                      <a
                        href={`mailto:${selectedSubmission.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {selectedSubmission.email}
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(selectedSubmission.created_at).toLocaleString()}
                    </p>
                  </div>
                  {getStatusBadge(selectedSubmission.status)}
                </div>

                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedSubmission.message}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {selectedSubmission.status !== 'read' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(selectedSubmission.id, 'read')}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Mark as Read
                    </Button>
                  )}
                  {selectedSubmission.status !== 'replied' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(selectedSubmission.id, 'replied')}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark as Replied
                    </Button>
                  )}
                  {selectedSubmission.status !== 'archived' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(selectedSubmission.id, 'archived')}
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      Archive
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteSubmission(selectedSubmission.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      window.location.href = `mailto:${selectedSubmission.email}?subject=Re: ${selectedSubmission.subject}`;
                    }}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Reply via Email
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <Mail className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Select a submission to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
