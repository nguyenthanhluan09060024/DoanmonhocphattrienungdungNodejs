import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { 
  MessageSquare, 
  User, 
  Calendar, 
  Edit,
  Trash2, 
  Reply, 
  ThumbsUp, 
  ThumbsDown,
  CheckCircle
} from 'lucide-react';

interface Comment {
  CommentID: number;
  Content: string;
  CreatedAt: string;
  UpdatedAt: string;
  ParentCommentID?: number;
  IsDeleted: boolean;
  Username: string;
  Email: string;
  Avatar?: string;
  MovieTitle?: string;
  SeriesTitle?: string;
  MovieID?: number;
  SeriesID?: number;
  LikeCount?: number;
  DislikeCount?: number;
  UserReaction?: 'Like' | 'Dislike';
}

const AdminCommentsPage: React.FC = () => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'movies' | 'series' | 'deleted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const loadComments = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      // Load movie comments
      const movieCommentsResponse = await fetch('/api/admin/comments/movies', {
        headers: { 'x-user-email': user.email }
      });
      
      // Load series comments  
      const seriesCommentsResponse = await fetch('/api/admin/comments/series', {
        headers: { 'x-user-email': user.email }
      });

      const movieComments = movieCommentsResponse.ok ? await movieCommentsResponse.json() : [];
      const seriesComments = seriesCommentsResponse.ok ? await seriesCommentsResponse.json() : [];
      
      setComments([...movieComments, ...seriesComments]);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [user?.email]);

  const handleReply = async (parentCommentId: number) => {
    if (!replyContent.trim() || !user?.email) return;
    
    setReplying(true);
    try {
      // Find the parent comment to determine if it's a movie or series comment
      const parentComment = comments.find(c => c.CommentID === parentCommentId);
      if (!parentComment) return;

      const endpoint = parentComment.MovieID 
        ? `/api/movies/${parentComment.MovieID}/comments`
        : `/api/stories/${parentComment.SeriesID}/comments`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          content: replyContent,
          parentCommentId: parentCommentId
        }),
      });

      if (response.ok) {
        setReplyContent('');
        setReplyTo(null);
        await loadComments();
      }
    } catch (error) {
      console.error('Error replying to comment:', error);
    } finally {
      setReplying(false);
    }
  };

  const handleEditComment = async (commentId: number) => {
    if (!editContent.trim() || !user?.email) return;
    
    try {
      const comment = comments.find(c => c.CommentID === commentId);
      if (!comment) return;

      const endpoint = comment.MovieID 
        ? `/api/admin/comments/movies/${commentId}`
        : `/api/admin/comments/series/${commentId}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (response.ok) {
        setEditingComment(null);
        setEditContent('');
        await loadComments();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.error}`);
      }
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Có lỗi xảy ra khi sửa bình luận');
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingComment(comment.CommentID);
    setEditContent(comment.Content);
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!user?.email || !confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    
    try {
      const comment = comments.find(c => c.CommentID === commentId);
      if (!comment) return;

      const endpoint = comment.MovieID 
        ? `/api/admin/comments/movies/${commentId}`
        : `/api/admin/comments/series/${commentId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'x-user-email': user.email },
      });

      if (response.ok) {
        await loadComments();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleRestoreComment = async (commentId: number) => {
    if (!user?.email || !confirm('Bạn có chắc muốn khôi phục bình luận này?')) return;
    
    try {
      const comment = comments.find(c => c.CommentID === commentId);
      if (!comment) return;

      const endpoint = comment.MovieID 
        ? `/api/admin/comments/movies/${commentId}/restore`
        : `/api/admin/comments/series/${commentId}/restore`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'x-user-email': user.email },
      });

      if (response.ok) {
        await loadComments();
      }
    } catch (error) {
      console.error('Error restoring comment:', error);
    }
  };

  const filteredComments = comments.filter(comment => {
    // Filter by type
    if (filter === 'movies' && !comment.MovieID) return false;
    if (filter === 'series' && !comment.SeriesID) return false;
    if (filter === 'deleted' && !comment.IsDeleted) return false;
    if (filter === 'all' && comment.IsDeleted) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        comment.Content.toLowerCase().includes(query) ||
        comment.Username.toLowerCase().includes(query) ||
        (comment.MovieTitle && comment.MovieTitle.toLowerCase().includes(query)) ||
        (comment.SeriesTitle && comment.SeriesTitle.toLowerCase().includes(query))
      );
    }

    return true;
  });

  const getReplies = (commentId: number) => {
    return filteredComments.filter(c => c.ParentCommentID === commentId);
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = getReplies(comment.CommentID);
    
    return (
      <div key={comment.CommentID} className={`${isReply ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
        <Card className={`mb-4 ${comment.IsDeleted ? 'opacity-60 bg-red-50 dark:bg-red-900/20' : ''}`}>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {comment.Username}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {comment.Email}
                    </span>
                    {comment.IsDeleted && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs font-medium">
                        Đã xóa
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    {comment.Content}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(comment.CreatedAt).toLocaleString()}</span>
                    </div>
                    
                    {comment.MovieTitle && (
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Phim:</span>
                        <span>{comment.MovieTitle}</span>
                      </div>
                    )}
                    
                    {comment.SeriesTitle && (
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Truyện:</span>
                        <span>{comment.SeriesTitle}</span>
                      </div>
                    )}
                    
                    {comment.LikeCount !== undefined && (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <ThumbsUp className="w-3 h-3" />
                          <span>{comment.LikeCount}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <ThumbsDown className="w-3 h-3" />
                          <span>{comment.DislikeCount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {!comment.IsDeleted && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setReplyTo(replyTo === comment.CommentID ? null : comment.CommentID)}
                    >
                      <Reply className="w-3 h-3" />
                      Trả lời
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleStartEdit(comment)}
                    >
                      <Edit className="w-3 h-3" />
                      Sửa
                    </Button>
                  </>
                )}
                
                {comment.IsDeleted ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRestoreComment(comment.CommentID)}
                  >
                    <CheckCircle className="w-3 h-3" />
                    Khôi phục
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeleteComment(comment.CommentID)}
                  >
                    <Trash2 className="w-3 h-3" />
                    Xóa
                  </Button>
                )}
              </div>
            </div>
            
            {/* Reply Form */}
            {replyTo === comment.CommentID && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <Input
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Viết trả lời..."
                    className="flex-1"
                  />
                  <Button
                    onClick={() => handleReply(comment.CommentID)}
                    disabled={replying || !replyContent.trim()}
                    size="sm"
                  >
                    {replying ? 'Đang gửi...' : 'Gửi'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setReplyTo(null);
                      setReplyContent('');
                    }}
                    size="sm"
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}
            
            {/* Edit Form */}
            {editingComment === comment.CommentID && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="space-y-3">
                  <Input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Sửa nội dung bình luận..."
                    className="w-full"
                  />
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleEditComment(comment.CommentID)}
                      disabled={!editContent.trim()}
                      size="sm"
                    >
                      Lưu
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleCancelEdit}
                      size="sm"
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
        
        {/* Render Replies */}
        {replies.map(reply => renderComment(reply, true))}
      </div>
    );
  };

  if (!user?.email) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Authentication Required
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please log in to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Quản lý Bình luận
          </h1>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <div className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Filter Tabs */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilter('movies')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filter === 'movies'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Phim
                </button>
                <button
                  onClick={() => setFilter('series')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filter === 'series'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Truyện
                </button>
                <button
                  onClick={() => setFilter('deleted')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filter === 'deleted'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Đã xóa
                </button>
              </div>

              {/* Search */}
              <div className="flex-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm bình luận..."
                  icon={<MessageSquare className="w-4 h-4 text-gray-400" />}
                />
              </div>

              {/* Refresh Button */}
              <Button onClick={loadComments} variant="secondary">
                Tải lại
              </Button>
            </div>
          </div>
        </Card>

        {/* Comments List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Đang tải bình luận...</p>
          </div>
        ) : filteredComments.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Không có bình luận
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'Không tìm thấy bình luận phù hợp với từ khóa tìm kiếm.' : 'Chưa có bình luận nào.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredComments
              .filter(comment => !comment.ParentCommentID) // Only show top-level comments
              .map(comment => renderComment(comment))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCommentsPage;
