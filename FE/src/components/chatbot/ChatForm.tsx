import { useRef, FormEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatFormProps {
  chatHistory: Array<{ role: 'user' | 'model'; text: string; hideInChat?: boolean }>;
  setChatHistory: React.Dispatch<React.SetStateAction<Array<{ role: 'user' | 'model'; text: string; hideInChat?: boolean; isError?: boolean }>>>;
  generateBotResponse: (history: Array<{ role: 'user' | 'model'; text: string; hideInChat?: boolean }>) => Promise<void>;
}

const ChatForm: React.FC<ChatFormProps> = ({ chatHistory, setChatHistory, generateBotResponse }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const userMessage = inputRef.current?.value.trim();
    if (!userMessage) return;
    
    if (inputRef.current) {
      inputRef.current.value = '';
    }

    // Thêm tin nhắn của user
    setChatHistory((history) => [...history, { role: 'user', text: userMessage }]);

    // Hiển thị "Thinking..." và gọi API
    setTimeout(() => {
      setChatHistory((history) => [...history, { role: 'model', text: 'Thinking...' }]);
      generateBotResponse([...chatHistory, { role: 'user', text: userMessage }]);
    }, 100);
  };

  return (
    <form onSubmit={handleFormSubmit} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-purple-500 focus-within:border-transparent transition-all shadow-sm">
      <input
        ref={inputRef}
        type="text"
        placeholder="Nhập tin nhắn..."
        className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
        required
      />
      <button
        type="submit"
        className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-center hover:from-blue-700 hover:to-purple-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  );
};

export default ChatForm;

