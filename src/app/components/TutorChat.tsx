import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { 
  MessageSquare, 
  X, 
  Send, 
  Paperclip,
  Image as ImageIcon,
  FileText,
  File,
  User,
  UserCheck,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
};

export function TutorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    let channel: any = null;
    let typingChannel: any = null;

    const setupSubscription = async () => {
      await loadMessages();
      channel = await subscribeToMessages();
      typingChannel = await setupTypingChannel();
    };

    setupSubscription();

    return () => {
      if (supabase) {
        if (channel) supabase.removeChannel(channel);
        if (typingChannel) supabase.removeChannel(typingChannel);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  const loadMessages = async () => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tutor_chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark unread admin messages as read
      if (data) {
        const unreadMessages = data.filter((msg) => !msg.is_from_user && !msg.is_read);
        unreadMessages.forEach((msg) => markAsRead(msg.id));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadUnreadCount = async () => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from('tutor_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_from_user', false)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const subscribeToMessages = async () => {
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Remove any existing channel first
    supabase.removeChannel(supabase.channel('tutor-chat'));

    const channel = supabase
      .channel(`tutor-chat-${user.id}`, {
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
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as ChatMessage;
            setMessages((prev) => {
              // Check if message already exists to avoid duplicates
              if (prev.some((msg) => msg.id === newMessage.id)) {
                return prev;
              }
              return [...prev, newMessage];
            });
            if (!newMessage.is_from_user) {
              setUnreadCount((prev) => prev + 1);
              loadUnreadCount(); // Refresh count
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? (payload.new as ChatMessage) : msg))
            );
            loadUnreadCount(); // Refresh count
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates');
        }
      });

    return channel;
  };

  const setupTypingChannel = async () => {
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const typingChannel = supabase
      .channel(`tutor-chat-typing-${user.id}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setIsAdminTyping(payload.payload.isTyping);
          // Auto-hide typing indicator after 3 seconds
          setTimeout(() => setIsAdminTyping(false), 3000);
        }
      })
      .subscribe();

    typingChannelRef.current = typingChannel;
    return typingChannel;
  };

  const handleTyping = async () => {
    if (!supabase || !typingChannelRef.current) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        isTyping: true,
      },
    });

    // Stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      if (typingChannelRef.current) {
        typingChannelRef.current.send({
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

  const handleFileUpload = async (file: File) => {
    if (!supabase) return;

    setUploadingFile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const fileType = file.type || 'application/octet-stream';

      const { error: uploadError } = await supabase.storage
        .from('tutor-chat-files')
        .upload(fileName, file, {
          contentType: fileType,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tutor-chat-files')
        .getPublicUrl(fileName);

      // Send message with file
      const { error: messageError } = await supabase
        .from('tutor_chat_messages')
        .insert({
          user_id: user.id,
          message: `📎 ${file.name}`,
          file_url: publicUrl,
          file_name: file.name,
          file_type: fileType,
          is_from_user: true,
        });

      if (messageError) throw messageError;

      await loadMessages();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  const sendMessage = async () => {
    if (!supabase || !newMessage.trim() || isSending) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    if (typingChannelRef.current) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        typingChannelRef.current.send({
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

      const { error } = await supabase.from('tutor_chat_messages').insert({
        user_id: user.id,
        message: newMessage,
        is_from_user: true,
      });

      if (error) throw error;

      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
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
      await loadUnreadCount();
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center z-50 transition-all"
          >
            <MessageSquare className="w-6 h-6" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center p-0">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200"
          >
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <h3 className="font-semibold">Ask A Tutor</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-blue-700 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Start a conversation with a tutor</p>
                </div>
              ) : (
                messages.map((msg) => (
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
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.is_from_user ? (
                          <User className="w-3 h-3" />
                        ) : (
                          <UserCheck className="w-3 h-3" />
                        )}
                        <span className="text-xs font-medium">
                          {msg.is_from_user ? 'You' : 'Tutor'}
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
                          </a>
                          {msg.file_type?.startsWith('image/') && (
                            <img
                              src={msg.file_url}
                              alt={msg.file_name || 'Uploaded image'}
                              className="max-w-full rounded-lg mt-2"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          msg.is_from_user ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
              {isAdminTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-xs text-gray-500 ml-2">Tutor is typing...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-4 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex-shrink-0"
                >
                  {uploadingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (e.target.value.trim()) {
                      handleTyping();
                    }
                  }}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      // Stop typing indicator
                      if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                      }
                      setIsTyping(false);
                      if (typingChannelRef.current) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          typingChannelRef.current.send({
                            type: 'broadcast',
                            event: 'typing',
                            payload: {
                              userId: user.id,
                              isTyping: false,
                            },
                          });
                        }
                      }
                      sendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  className="flex-1"
                  disabled={isSending}
                />
                <Button
                  onClick={sendMessage}
                  disabled={isSending || !newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Upload images, PDFs, Word, Excel, or any document
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
