import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import {
  fetchNotifications,
  markNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  NotificationItemDto,
} from '../lib/api';
import { Check, Trash2 } from 'lucide-react';

const typeLabel: Record<string, string> = {
  NewContent: 'Tác phẩm mới',
  ContentUpdated: 'Phim đã được sửa đổi',
  ContentDeleted: 'Phim đã bị xóa',
  UploadApproved: 'Upload được duyệt',
  UploadRejected: 'Upload bị từ chối',
  RoleUpgrade: 'Tài khoản nâng cấp quyền',
  RoleDowngrade: 'Tài khoản bị giảm cấp',
  RoleUpgradeRequest: 'Yêu cầu nâng cấp tài khoản',
  CommentDeleted: 'Bình luận bị xóa',
  CommentReplied: 'Có phản hồi bình luận',
};

const toAppLink = (raw?: string) => {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return value;
  return `/${value}`;
};

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const email = useMemo(() => (user?.email as string | undefined) || '', [user]);
  const [items, setItems] = useState<NotificationItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!email) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const list = await fetchNotifications(email);
        if (!cancelled) setItems(Array.isArray(list) ? list : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const markAll = async () => {
    if (!email) return;
    await markNotificationsRead(email);
    setItems((prev) => prev.map((n) => ({ ...n, IsRead: true })));
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const markAsRead = async (notificationId?: number) => {
    if (!email || !notificationId) return;
    try {
      await markNotificationsRead(email, notificationId);
      setItems((prev) =>
        prev.map((n) => (n.NotificationID === notificationId ? { ...n, IsRead: true } : n))
      );
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotif = async (notificationId: number) => {
    if (!email) return;
    try {
      await deleteNotification(notificationId, email);
      setItems((prev) => prev.filter((n) => n.NotificationID !== notificationId));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (error) {
      console.error('Failed to delete notification:', error);
      alert('Không thể xóa thông báo. Vui lòng thử lại.');
    }
  };

  const deleteAll = async () => {
    if (!email) return;
    if (!confirm('Bạn có chắc muốn xóa tất cả thông báo? Hành động này không thể hoàn tác.')) {
      return;
    }
    try {
      await deleteAllNotifications(email);
      setItems([]);
      window.dispatchEvent(new Event('notifications-updated'));
      alert('Đã xóa tất cả thông báo');
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      alert('Không thể xóa thông báo. Vui lòng thử lại.');
    }
  };

  if (!email) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-gray-600 dark:text-gray-300">
        Vui lòng đăng nhập để xem thông báo.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thông báo</h1>
        <div className="flex gap-2">
          <Button onClick={markAll} variant="secondary" size="sm">
            Đánh dấu đã đọc tất cả
          </Button>
          <Button onClick={deleteAll} variant="danger" size="sm">
            <Trash2 className="w-4 h-4 mr-1" />
            Xóa tất cả
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600 dark:text-gray-300">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="text-gray-600 dark:text-gray-300">Chưa có thông báo.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((n, idx) => {
            const isDowngrade = n.Type === 'RoleDowngrade';
            const borderColor = isDowngrade
              ? n.IsRead
                ? 'border-red-200 dark:border-red-800'
                : 'border-red-400 dark:border-red-700'
              : n.IsRead
              ? 'border-gray-200 dark:border-gray-700'
              : 'border-blue-300 dark:border-blue-700';
            const bgColor = isDowngrade
              ? n.IsRead
                ? 'bg-white dark:bg-gray-800'
                : 'bg-red-50 dark:bg-red-950/30'
              : n.IsRead
              ? 'bg-white dark:bg-gray-800'
              : 'bg-blue-50 dark:bg-blue-950/30';

            const link = toAppLink(n.RelatedURL);

            return (
              <li
                key={`${n.NotificationID ?? idx}-${n.CreatedAt}`}
                className={`p-4 rounded-lg border ${borderColor} ${bgColor}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(n.CreatedAt).toLocaleString()}
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mt-1">
                      {typeLabel[n.Type] || n.Type} - {n.Title}
                    </div>
                    {n.Content && <div className="text-gray-700 dark:text-gray-300 mt-1">{n.Content}</div>}
                    {link && (
                      <Link
                        className="text-blue-600 dark:text-blue-400 text-sm mt-2 inline-block hover:underline"
                        to={link}
                        onClick={() => markAsRead(n.NotificationID)}
                      >
                        Xem chi tiết
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!n.IsRead && n.NotificationID && (
                      <button
                        onClick={() => markAsRead(n.NotificationID)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Đánh dấu đã đọc"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {n.NotificationID && (
                      <button
                        onClick={() => deleteNotif(n.NotificationID!)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Xóa thông báo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default NotificationsPage;
