import ChatbotIcon from './ChatbotIcon';
import { AlertCircle } from 'lucide-react';

interface ChatMessageProps {
  chat: {
    role: 'user' | 'model';
    text: string;
    isError?: boolean;
    hideInChat?: boolean;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ chat }) => {
  if (chat.hideInChat) return null;

  const isError = chat.isError;
  const isUser = chat.role === 'user';

  return (
    <div className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse justify-end' : 'flex-row'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 text-white shadow-sm">
          <ChatbotIcon />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-tr-none'
            : isError
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-tl-none'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-none'
        }`}
      >
        {isError && (
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">
              Lỗi
            </span>
          </div>
        )}
        <p
          className={`text-sm whitespace-pre-line break-words ${
            isError
              ? 'text-red-700 dark:text-red-300'
              : isUser
              ? 'text-white'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {chat.text}
        </p>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 text-white flex items-center justify-center text-xs font-semibold shadow-sm">
          U
        </div>
      )}
    </div>
  );
};

export default ChatMessage;