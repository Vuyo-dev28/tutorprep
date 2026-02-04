import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import { 
  MessageSquare, 
  Send, 
  User,
  UserCheck,
  Search,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  File,
  Download,
  Eye
} from 'lucide-react';
import { motion } from 'motion/react';

type ChatMessage = {
  id: string;
  user_id: string;
  admin_id: string | null;
  message: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  is_from_user: boolean;
  is_read: boolean;
  parent_message_id: string | null;
  created_at: string;
  user_name?: string;
};

type ChatThread = {
  user_id: string;
  user_name: string;
  messages: ChatMessage[];
  latestMessage: ChatMessage;
  unreadCount: number;
};

export function AdminTutorChat() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserTyping, setIsUserTyping] = useState<{ [userId: string]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelsRef = useRef<{ [userId: string]: any }>({});

  useEffect(() => {
    loadMessages();
    const channel = subscribeToMessages();
    setupTypingChannels();

    return () => {
      if (supabase) {
        if (channel) supabase.removeChannel(channel);
        Object.values(typingChannelsRef.current).forEach((ch) => {
          if (ch) supabase.removeChannel(ch);
        });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedThread?.messages]);

  const loadMessages = async () => {
    if (!supabase) return;

    try {
      const { data: messages, error } = await supabase
        .from('tutor_chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set((messages || []).map((m) => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      // Group messages by user
      const threadsMap = new Map<string, ChatMessage[]>();
      (messages || []).forEach((msg) => {
        const key = msg.user_id;
        if (!threadsMap.has(key)) {
          threadsMap.set(key, []);
        }
        threadsMap.get(key)!.push({
          ...msg,
          user_name: profilesMap.get(msg.user_id) || 'Unknown User',
        });
      });

      const threadsArray: ChatThread[] = Array.from(threadsMap.entries()).map(([userId, messages]) => {
        const sortedMessages = messages.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const unreadCount = sortedMessages.filter((m) => !m.is_read && m.is_from_user).length;

        return {
          user_id: userId,
          user_name: messages[0].user_name || 'Unknown User',
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
      // Set up typing channels for new threads
      setupTypingChannels();
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!supabase) return null;

    // Remove any existing channel first
    supabase.removeChannel(supabase.channel('admin-tutor-chat'));

    const channel = supabase
      .channel('admin-tutor-chat', {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tutor_chat_messages',
        },
        (payload) => {
          console.log('Admin real-time update received:', payload);
          loadMessages(); // Reload all messages to get latest state
        }
      )
      .subscribe((status) => {
        console.log('Admin subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Admin successfully subscribed to real-time updates');
        }
      });

    return channel;
  };

  const setupTypingChannels = async () => {
    if (!supabase) return;

    // Set up typing channels for all users
    threads.forEach((thread) => {
      if (!typingChannelsRef.current[thread.user_id]) {
        const typingChannel = supabase
          .channel(`tutor-chat-typing-${thread.user_id}`, {
            config: {
              broadcast: { self: false },
            },
          })
          .on('broadcast', { event: 'typing' }, (payload) => {
            setIsUserTyping((prev) => ({
              ...prev,
              [payload.payload.userId]: payload.payload.isTyping,
            }));
            // Auto-hide typing indicator after 3 seconds
            setTimeout(() => {
              setIsUserTyping((prev) => ({
                ...prev,
                [payload.payload.userId]: false,
              }));
            }, 3000);
          })
          .subscribe();

        typingChannelsRef.current[thread.user_id] = typingChannel;
      }
    });
  };

  const handleAdminTyping = async () => {
    if (!supabase || !selectedThread) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator to the selected user's channel
    const userTypingChannel = typingChannelsRef.current[selectedThread.user_id];
    if (userTypingChannel) {
      userTypingChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: user.id,
          isTyping: true,
        },
      });
    }

    // Stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (userTypingChannel) {
        userTypingChannel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId: user.id,
            isTyping: false,
          },
        });
      }
    }, 2000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendReply = async () => {
    if (!supabase || !selectedThread || !replyText.trim()) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (selectedThread && typingChannelsRef.current[selectedThread.user_id]) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        typingChannelsRef.current[selectedThread.user_id].send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId: user.id,
            isTyping: false,
          },
        });
      }
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const parentMessage = selectedThread.messages[0];

      const { error } = await supabase.from('tutor_chat_messages').insert({
        user_id: selectedThread.user_id,
        admin_id: user.id,
        message: replyText,
        is_from_user: false,
        parent_message_id: parentMessage.id,
      });

      if (error) throw error;

      setReplyText('');
      await loadMessages();
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
        .from('tutor_chat_messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;
      await loadMessages();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="w-4 h-4" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (fileType.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.user_name.toLowerCase().includes(query) ||
      thread.latestMessage.message?.toLowerCase().includes(query) ||
      thread.latestMessage.file_name?.toLowerCase().includes(query)
    );
  });

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center text-gray-500">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Ask A Tutor - Admin View</h3>
            <p className="text-sm text-gray-500 mt-1">
              View and respond to student questions
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
              placeholder="Search by student name or message..."
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
                <p>No chats found</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <motion.div
                  key={thread.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedThread?.user_id === thread.user_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedThread(thread);
                    // Mark messages as read when viewing
                    thread.messages
                      .filter((m) => m.is_from_user && !m.is_read)
                      .forEach((m) => markAsRead(m.id));
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{thread.user_name}</h4>
                      {thread.latestMessage.file_name ? (
                        <p className="text-xs text-gray-500 mt-1">
                          📎 {thread.latestMessage.file_name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                          {thread.latestMessage.message}
                        </p>
                      )}
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

          {/* Chat View */}
          <div className="bg-gray-50 rounded-xl p-6">
            {selectedThread ? (
              <div className="space-y-4 h-full flex flex-col">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-1">{selectedThread.user_name}</h3>
                  {selectedThread.unreadCount > 0 && (
                    <Badge className="mt-2 bg-blue-600 text-white">
                      {selectedThread.unreadCount} unread
                    </Badge>
                  )}
                </div>

                <div className="flex-1 space-y-4 max-h-[400px] overflow-y-auto">
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
                        </div>
                        {msg.file_url ? (
                          <div className="space-y-2">
                            <a
                              href={msg.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 hover:underline"
                            >
                              {getFileIcon(msg.file_type)}
                              <span className="text-sm">{msg.file_name}</span>
                              <Download className="w-3 h-3" />
                            </a>
                            {msg.file_type?.startsWith('image/') && (
                              <div className="mt-2">
                                <img
                                  src={msg.file_url}
                                  alt={msg.file_name || 'Uploaded image'}
                                  className="max-w-full rounded-lg cursor-pointer"
                                  onClick={() => window.open(msg.file_url!, '_blank')}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        )}
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
                  {isUserTyping[selectedThread.user_id] && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg p-3 max-w-[80%]">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-xs text-gray-500 ml-2">{selectedThread.user_name} is typing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Form */}
                <div className="border-t pt-4">
                  <Textarea
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value);
                      if (e.target.value.trim()) {
                        handleAdminTyping();
                      }
                    }}
                    placeholder="Type your reply..."
                    className="min-h-24"
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
