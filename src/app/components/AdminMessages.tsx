import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { 
  MessageSquare, 
  Send, 
  User,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  Search
} from 'lucide-react';
import { motion } from 'motion/react';

type UserMessage = {
  id: string;
  user_id: string;
  admin_id: string | null;
  subject: string;
  message: string;
  is_from_user: boolean;
  is_read: boolean;
  parent_message_id: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
};

type MessageThread = {
  user_id: string;
  user_name: string;
  user_email: string;
  subject: string;
  messages: UserMessage[];
  latestMessage: UserMessage;
  unreadCount: number;
};

export function AdminMessages() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    if (!supabase) return;

    try {
      // Get all messages
      const { data: messages, error } = await supabase
        .from('user_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user profiles for user names
      const userIds = [...new Set((messages || []).map((m) => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      // Get user emails - we'll use a function or get from auth metadata
      // For now, we'll just use the profile name and show user_id if needed
      const emailsMap = new Map<string, string>();

      // Group messages by user and subject
      const threadsMap = new Map<string, UserMessage[]>();
      (messages || []).forEach((msg) => {
        const key = `${msg.user_id}_${msg.parent_message_id || msg.id}`;
        if (!threadsMap.has(key)) {
          threadsMap.set(key, []);
        }
        threadsMap.get(key)!.push({
          ...msg,
          user_name: profilesMap.get(msg.user_id) || 'Unknown User',
          user_email: '', // Email not available without admin API
        });
      });

      const threadsArray: MessageThread[] = Array.from(threadsMap.entries()).map(([key, messages]) => {
        const rootMessage = messages.find((m) => m.id === (m.parent_message_id || m.id)) || messages[0];
        const sortedMessages = messages.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const unreadCount = sortedMessages.filter((m) => !m.is_read && m.is_from_user).length;

        return {
          user_id: rootMessage.user_id,
          user_name: rootMessage.user_name || 'Unknown User',
          user_email: rootMessage.user_email || `User ${rootMessage.user_id.substring(0, 8)}`,
          subject: rootMessage.subject,
          messages: sortedMessages,
          latestMessage: sortedMessages[sortedMessages.length - 1],
          unreadCount,
        };
      });

      threadsArray.sort(
        (a, b) =>
          new Date(b.latestMessage.created_at).getTime() -
          new Date(a.latestMessage.created_at).getTime()
      );

      setThreads(threadsArray);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendReply = async () => {
    if (!supabase || !selectedThread || !replyText.trim()) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const parentMessage = selectedThread.messages[0];

      const { error } = await supabase.from('user_messages').insert({
        user_id: selectedThread.user_id,
        admin_id: user.id,
        subject: selectedThread.subject,
        message: replyText,
        is_from_user: false,
        parent_message_id: parentMessage.id,
      });

      if (error) throw error;

      setReplyText('');
      await loadMessages();
      // Reload selected thread
      const updatedThread = threads.find(
        (t) => t.user_id === selectedThread.user_id && t.subject === selectedThread.subject
      );
      if (updatedThread) setSelectedThread(updatedThread);
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('user_messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;
      await loadMessages();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.subject.toLowerCase().includes(query) ||
      thread.user_name.toLowerCase().includes(query) ||
      thread.user_email.toLowerCase().includes(query) ||
      thread.latestMessage.message.toLowerCase().includes(query)
    );
  });

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center text-gray-500">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">User Messages</h3>
            <p className="text-sm text-gray-500 mt-1">
              View and reply to messages from users
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <Badge className="bg-blue-600 text-white">{totalUnread} unread</Badge>
            )}
            <Button onClick={loadMessages} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by user, subject, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Threads List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No messages found</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <motion.div
                  key={`${thread.user_id}_${thread.subject}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedThread?.user_id === thread.user_id &&
                    selectedThread?.subject === thread.subject
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedThread(thread);
                    // Mark user messages as read when viewing
                    thread.messages
                      .filter((m) => m.is_from_user && !m.is_read)
                      .forEach((m) => markAsRead(m.id));
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{thread.user_name}</h4>
                      <p className="text-xs text-gray-500">{thread.user_email}</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{thread.subject}</p>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                        {thread.latestMessage.message}
                      </p>
                    </div>
                    {thread.unreadCount > 0 && (
                      <Badge className="bg-blue-600 text-white">{thread.unreadCount}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(thread.latestMessage.created_at).toLocaleString()}
                  </p>
                </motion.div>
              ))
            )}
          </div>

          {/* Message Thread View */}
          <div className="bg-gray-50 rounded-xl p-6">
            {selectedThread ? (
              <div className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-1">{selectedThread.subject}</h3>
                  <div className="text-sm text-gray-600">
                    <p>
                      <strong>From:</strong> {selectedThread.user_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">User ID: {selectedThread.user_id.substring(0, 8)}...</p>
                  </div>
                  {selectedThread.unreadCount > 0 && (
                    <Badge className="mt-2 bg-blue-600 text-white">
                      {selectedThread.unreadCount} unread
                    </Badge>
                  )}
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {selectedThread.messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: msg.is_from_user ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.is_from_user ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.is_from_user
                            ? 'bg-white border border-gray-200'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.is_from_user ? (
                            <User className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                          <span className="text-xs font-medium">
                            {msg.is_from_user ? selectedThread.user_name : 'You (Admin)'}
                          </span>
                          {msg.is_read && msg.is_from_user && (
                            <CheckCircle2 className="w-3 h-3 ml-auto" />
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.is_from_user ? 'text-gray-500' : 'text-blue-100'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Reply Form */}
                <div className="border-t pt-4">
                  <Label htmlFor="admin-reply">Reply</Label>
                  <Textarea
                    id="admin-reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="mt-1 min-h-24"
                  />
                  <Button
                    onClick={sendReply}
                    disabled={isSending || !replyText.trim()}
                    className="mt-2 w-full"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSending ? 'Sending...' : 'Send Reply'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Select a conversation to view messages</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
