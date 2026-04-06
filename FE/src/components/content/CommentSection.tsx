import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { 
  MessageSquare, 
  User, 
  Reply, 
  ThumbsUp, 
  ThumbsDown,
  Send
} from 'lucide-react';
import { fetchCurrentRole } from '../../lib/api';

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
  RoleName?: string;
  Level?: number;
  LikeCount?: number;
  DislikeCount?: number;
  UserReaction?: 'Like' | 'Dislike';
}

interface CommentSectionProps {
  contentType: 'movie' | 'series';
  contentId: number;
  contentTitle: string;
}

const CommentSection: React.FC<CommentSectionProps> = ({ 
  contentType, 
  contentId, 
  contentTitle 
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    try {
      const endpoint = contentType === 'movie' 
        ? `/api/movies/${contentId}/comments`
        : `/api/stories/${contentId}/comments`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [contentId, contentType]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (user?.email) {
          const { role } = await fetchCurrentRole(user.email);
          if (!cancelled) setIsAdmin(role === 'Admin');
        } else if (!cancelled) setIsAdmin(false);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user?.email]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user?.email) return;
    
    setSubmitting(true);
    try {
      const endpoint = contentType === 'movie' 
        ? `/api/movies/${contentId}/comments`
        : `/api/stories/${contentId}/comments`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          content: newComment.trim()
        }),
      });

      if (response.ok) {
        setNewComment('');
        await loadComments();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentCommentId: number) => {
    if (!replyContent.trim() || !user?.email) return;
    
    setSubmitting(true);
    try {
      const endpoint = contentType === 'movie' 
        ? `/api/movies/${contentId}/comments`
        : `/api/stories/${contentId}/comments`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentCommentId: parentCommentId
        }),
      });

      if (response.ok) {
        setReplyContent('');
        setReplyingTo(null);
        await loadComments();
      }
    } catch (error) {
      console.error('Error replying to comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (commentId: number, reactionType: 'Like' | 'Dislike') => {
    if (!user?.email) return;
    
    try {
      const endpoint = contentType === 'movie' 
        ? `/api/movies/${contentId}/comments/${commentId}/reaction`
        : `/api/stories/${contentId}/comments/${commentId}/reaction`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          reactionType
        }),
      });

      if (response.ok) {
        await loadComments();
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const getReplies = (commentId: number) => {
    return comments.filter(c => c.ParentCommentID === commentId);
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.CommentID);
    setEditValue(comment.Content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (commentId: number) => {
    if (!user?.email || !editValue.trim()) return;
    try {
      const endpoint = contentType === 'movie'
        ? `/api/movies/${contentId}/comments/${commentId}`
        : `/api/stories/${contentId}/comments/${commentId}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
        body: JSON.stringify({ content: editValue.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditValue('');
        await loadComments();
      }
    } catch (e) {
      console.error('Update comment error', e);
    }
  };

  const removeComment = async (commentId: number) => {
    if (!user?.email) return;
    if (!confirm('Xóa bình luận này?')) return;
    try {
      const endpoint = contentType === 'movie'
        ? `/api/movies/${contentId}/comments/${commentId}`
        : `/api/stories/${contentId}/comments/${commentId}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers: { 'x-user-email': user.email } });
      if (res.ok) await loadComments();
    } catch (e) {
      console.error('Delete comment error', e);
    }
  };

  // Hàm lấy màu sắc cho role badge
  const getRoleBadgeColor = (roleName?: string) => {
    switch (roleName) {
      case 'Admin':
        return 'bg-red-500 text-white border-red-600';
      case 'Uploader':
        return 'bg-blue-500 text-white border-blue-600';
      case 'Author':
        return 'bg-green-500 text-white border-green-600';
      case 'Translator':
        return 'bg-purple-500 text-white border-purple-600';
      case 'Reup':
        return 'bg-orange-500 text-white border-orange-600';
      case 'Viewer':
      default:
        return 'bg-gray-500 text-white border-gray-600';
    }
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = getReplies(comment.CommentID);
    const isOwner = !!(user?.email && user.email === comment.Email);
    const canModify = isOwner || isAdmin;
    
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
                  <div className="flex items-center space-x-2 mb-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {comment.Username}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-gradient-to-r from-gray-400 to-gray-600 text-white border border-gray-500">
                      Lv.{comment.Level ?? 1}
                    </span>
                    {comment.RoleName && (
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${getRoleBadgeColor(comment.RoleName)}`}>
                        {comment.RoleName}
                      </span>
                    )}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(comment.CreatedAt).toLocaleString()}
                    </span>
                  </div>
                  
                  {editingId === comment.CommentID ? (
                    <div className="mb-3 flex gap-2">
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1" />
                      <Button size="sm" onClick={() => saveEdit(comment.CommentID)} disabled={!editValue.trim()}>Lưu</Button>
                      <Button size="sm" variant="secondary" onClick={cancelEdit}>Hủy</Button>
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{comment.Content}</p>
                  )}
                  
                  {/* Reaction Buttons */}
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleReaction(comment.CommentID, 'Like')}
                      className={`flex items-center space-x-1 px-2 py-1 rounded-md text-sm transition-colors ${
                        comment.UserReaction === 'Like'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{comment.LikeCount || 0}</span>
                    </button>
                    
                    <button
                      onClick={() => handleReaction(comment.CommentID, 'Dislike')}
                      className={`flex items-center space-x-1 px-2 py-1 rounded-md text-sm transition-colors ${
                        comment.UserReaction === 'Dislike'
                          ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <ThumbsDown className="w-3 h-3" />
                      <span>{comment.DislikeCount || 0}</span>
                    </button>
                    
                    {!comment.IsDeleted && (
                      <button
                        onClick={() => setReplyingTo(replyingTo === comment.CommentID ? null : comment.CommentID)}
                        className="flex items-center space-x-1 px-2 py-1 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      >
                        <Reply className="w-3 h-3" />
                        <span>Trả lời</span>
                      </button>
                    )}
                    {/* Edit: only owner; Delete: owner or admin */}
                    {!comment.IsDeleted && editingId !== comment.CommentID && (
                      <>
                        {isOwner && (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(comment)}>Sửa</Button>
                        )}
                        {canModify && (
                          <Button size="sm" variant="ghost" onClick={() => removeComment(comment.CommentID)}>Xóa</Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Reply Form */}
            {replyingTo === comment.CommentID && (
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
                    disabled={submitting || !replyContent.trim()}
                    size="sm"
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent('');
                    }}
                    size="sm"
                  >
                    Hủy
                  </Button>
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

  return (
    <div id="comments" className="mt-8" data-comment-section>
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bình luận về {contentTitle}
        </h2>
      </div>

      {/* New Comment Form */}
      {user ? (
        <Card className="mb-6">
          <div className="p-4">
            <div className="flex space-x-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Viết bình luận của bạn..."
                className="flex-1"
              />
              <Button
                onClick={handleSubmitComment}
                disabled={submitting || !newComment.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <div className="p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Vui lòng đăng nhập để bình luận
            </p>
          </div>
        </Card>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Đang tải bình luận...</p>
        </div>
      ) : comments.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Chưa có bình luận
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Hãy là người đầu tiên bình luận về {contentTitle}!
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {comments
            .filter(comment => !comment.ParentCommentID) // Only show top-level comments
            .map(comment => renderComment(comment))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
