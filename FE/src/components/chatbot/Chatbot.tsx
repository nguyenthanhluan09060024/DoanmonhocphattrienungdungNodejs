import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, ChevronDown } from 'lucide-react';
import ChatbotIcon from './ChatbotIcon';
import ChatForm from './ChatForm';
import ChatMessage from './ChatMessage';
import { motion, AnimatePresence } from 'framer-motion';

const Chatbot: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'model';
    text: string;
    hideInChat?: boolean;
    isError?: boolean;
  }>>([]);
  const [showChatbot, setShowChatbot] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const generateBotResponse = async (history: Array<{ role: 'user' | 'model'; text: string; hideInChat?: boolean }>) => {
    const updateHistory = (text: string, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== 'Thinking...'),
        { role: 'model', text, isError }
      ]);
    };

    // Format chat history for API requests
    const formattedHistory = history.map(({ role, text }) => ({
      role,
      parts: [{ text }]
    }));

    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: formattedHistory })
    };

    try {
      // Gọi API endpoint từ server
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/chatbot`, requestOptions);

      // Kiểm tra response status trước khi parse JSON
      if (!response.ok) {
        let errorMessage = 'Đã xảy ra lỗi khi kết nối với chatbot.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          // Nếu không parse được JSON, sử dụng status text
          errorMessage = `Lỗi ${response.status}: ${response.statusText || 'Không thể kết nối đến server'}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Kiểm tra format response từ Gemini API (hỗ trợ nhiều format)
      let apiResponseText = null;
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        apiResponseText = data.candidates[0].content.parts[0].text;
      } else if (data.text) {
        apiResponseText = data.text;
      } else if (data.response && data.response.text) {
        apiResponseText = data.response.text;
      } else if (data.message) {
        apiResponseText = data.message;
      }

      if (!apiResponseText) {
        console.error('Invalid response format:', data);
        throw new Error('Phản hồi từ AI không đúng định dạng.');
      }

      // Clean up markdown formatting
      apiResponseText = apiResponseText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .trim();

      if (!apiResponseText) {
        throw new Error('AI không thể tạo phản hồi. Vui lòng thử lại.');
      }

      updateHistory(apiResponseText);
    } catch (error: any) {
      console.error('Chatbot error:', error);
      const errorMessage = error.message || 'Đã xảy ra lỗi khi kết nối với chatbot. Vui lòng thử lại sau.';
      updateHistory(errorMessage, true);
    }
  };

  useEffect(() => {
    // Auto scroll whenever chat history updates
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory]);

  return (
    <>
      {/* Chatbot Toggle Button */}
      <button
        onClick={() => setShowChatbot((prev) => !prev)}
        className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center border-2 border-white/20"
        aria-label="Toggle chatbot"
      >
        <AnimatePresence mode="wait">
          {showChatbot ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Chatbot Popup */}
      <AnimatePresence>
        {showChatbot && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-4 sm:bottom-24 sm:right-8 z-40 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[calc(100vw-2rem)] h-[calc(100vh-6rem)] sm:h-[600px] max-h-[calc(100vh-6rem)] sm:max-h-[calc(100vh-8rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden backdrop-blur-sm"
          >
            {/* Chatbot Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-purple-700 text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm p-2 flex items-center justify-center border border-white/30">
                  <ChatbotIcon />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Chatbot Fimory</h2>
                  <p className="text-xs text-white/80">AI Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setShowChatbot(false)}
                className="w-9 h-9 rounded-full hover:bg-white/20 transition-all duration-200 flex items-center justify-center active:scale-95"
                aria-label="Close chatbot"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Chatbot Body */}
            <div
              ref={chatBodyRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 chatbot-scrollbar"
            >
              {/* Welcome Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-3 items-start"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 text-white shadow-sm">
                  <ChatbotIcon />
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-none shadow-sm">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    Chào bạn! 👋<br />
                    Tôi là trợ lý AI của Fimory. Tôi có thể giúp bạn tìm hiểu về website, cách sử dụng các tính năng, hoặc trả lời các câu hỏi của bạn. Bạn cần hỗ trợ gì không?
                  </p>
                </div>
              </motion.div>

              {/* Chat Messages */}
              {chatHistory.map((chat, index) => (
                <ChatMessage key={index} chat={chat} />
              ))}
            </div>

            {/* Chatbot Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
              <ChatForm
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
                generateBotResponse={generateBotResponse}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Chatbot;

