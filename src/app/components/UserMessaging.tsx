import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { 
  Send, 
  MessageSquare, 
  CheckCircle2,
  Clock,
  User,
  UserCheck
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
};

type MessageThread = {
  subject: string;
  messages: UserMessage[];
  latestMessage: UserMessage;
  unreadCount: number;
};

export function UserMessaging() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState({ subject: '', message: '' });
  const [showNewMessageForm, setShowNewMessageForm] = useState(false);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group messages by subject/thread
      const threadsMap = new Map<string, UserMessage[]>();
      (data || []).forEach((msg) => {
        const key = msg.parent_message_id || msg.id;
        if (!threadsMap.has(key)) {
          threadsMap.set(key, []);
        }
        threadsMap.get(key)!.push(msg);
      });

      const threadsArray: MessageThread[] = Array.from(threadsMap.entries()).map(([key, messages]) => {
        const rootMessage = messages.find((m) => m.id === key) || messages[0];
        const sortedMessages = messages.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const unreadCount = sortedMessages.filter((m) => !m.is_read && !m.is_from_user).length;

        return {
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

  const sendNewMessage = async () => {
    if (!supabase || !newMessage.subject.trim() || !newMessage.message.trim()) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('user_messages').insert({
        user_id: user.id,
        subject: newMessage.subject,
        message: newMessage.message,
        is_from_user: true,
      });

      if (error) throw error;

      setNewMessage({ subject: '', message: '' });
      setShowNewMessageForm(false);
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
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
        user_id: user.id,
        subject: selectedThread.subject,
        message: replyText,
        is_from_user: true,
        parent_message_id: parentMessage.id,
      });

      if (error) throw error;

      setReplyText('');
      await loadMessages();
      // Reload selected thread
      const updatedThread = threads.find((t) => t.subject === selectedThread.subject);
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
            <h3 className="text-xl font-semibold">Messages & Support</h3>
            <p className="text-sm text-gray-500 mt-1">
              Contact admin for help, questions, or support
            </p>
          </div>
          <Button onClick={() => setShowNewMessageForm(!showNewMessageForm)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            New Message
          </Button>
        </div>

        {/* New Message Form */}
        {showNewMessageForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-gray-50 rounded-xl border-2 border-blue-200"
          >
            <h4 className="font-semibold mb-4">Send a new message</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-subject">Subject *</Label>
                <Input
                  id="new-subject"
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  placeholder="What is your message about?"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-message">Message *</Label>
                <Textarea
                  id="new-message"
                  value={newMessage.message}
                  onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                  placeholder="Describe your question or issue..."
                  className="mt-1 min-h-32"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={sendNewMessage} disabled={isSending}>
                  <Send className="w-4 h-4 mr-2" />
                  {isSending ? 'Sending...' : 'Send Message'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewMessageForm(false);
                    setNewMessage({ subject: '', message: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Threads List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {threads.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No messages yet</p>
                <p className="text-sm mt-1">Start a conversation with admin</p>
              </div>
            ) : (
              threads.map((thread) => (
                <motion.div
                  key={thread.subject}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedThread?.subject === thread.subject
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedThread(thread);
                    // Mark admin messages as read when viewing
                    thread.messages
                      .filter((m) => !m.is_from_user && !m.is_read)
                      .forEach((m) => markAsRead(m.id));
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{thread.subject}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{selectedThread.subject}</h3>
                  {selectedThread.unreadCount > 0 && (
                    <Badge className="bg-blue-600 text-white">
                      {selectedThread.unreadCount} unread
                    </Badge>
                  )}
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {selectedThread.messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: msg.is_from_user ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.is_from_user ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.is_from_user
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.is_from_user ? (
                            <User className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                          <span className="text-xs font-medium">
                            {msg.is_from_user ? 'You' : 'Admin'}
                          </span>
                          {msg.is_read && !msg.is_from_user && (
                            <CheckCircle2 className="w-3 h-3 ml-auto" />
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.is_from_user ? 'text-blue-100' : 'text-gray-500'
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
                  <Label htmlFor="reply">Reply</Label>
                  <Textarea
                    id="reply"
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
