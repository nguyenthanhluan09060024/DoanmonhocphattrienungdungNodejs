import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Search, Users, UserCheck, UserX, Clock } from 'lucide-react';

interface User {
  UserID: number;
  Username: string;
  Email: string;
  FullName: string;
  RoleName: string;
  Level?: number;
  IsActive: boolean;
  IsEmailVerified: boolean;
  CreatedAt: string;
  LastLoginAt: string;
}

interface RoleUpgradeRequest {
  RequestID: number;
  Username: string;
  Email: string;
  CurrentRole: string;
  RequestedRole: string;
  Reason: string;
  Status: string;
  RequestedAt: string;
}

const AdminUsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [upgradeRequests, setUpgradeRequests] = useState<RoleUpgradeRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users');
  const [userRole, setUserRole] = useState<string>('');

  const roles = [
    { value: '', label: 'Tất cả vai trò' },
    { value: 'Viewer', label: 'Người xem' },
    { value: 'Uploader', label: 'Người upload' },
    { value: 'Author', label: 'Tác giả' },
    { value: 'Translator', label: 'Nhóm dịch' },
    { value: 'Reup', label: 'Người reup' },
    { value: 'Admin', label: 'Quản trị viên' }
  ];

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'x-user-email': user?.email || '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadUpgradeRequests = async () => {
    try {
      const response = await fetch('/api/admin/role-upgrade-requests', {
        headers: {
          'x-user-email': user?.email || '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUpgradeRequests(data);
      }
    } catch (error) {
      console.error('Error loading upgrade requests:', error);
    }
  };

  useEffect(() => {
    if (user?.email) {
      // Load user role first
      fetch('/api/auth/role', {
        headers: { 'x-user-email': user.email }
      })
        .then(res => res.json())
        .then(data => {
          setUserRole(data.role);
          // Only load data if user is Admin
          if (data.role === 'Admin') {
            loadUsers();
            loadUpgradeRequests();
          }
          setLoading(false);
        })
        .catch(() => {
          setUserRole('');
          setLoading(false);
        });
    }
  }, [user?.email]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (userRole === 'Admin') {
      const interval = setInterval(() => {
        loadUpgradeRequests();
      }, 30000); // 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        await loadUsers();
        alert('Cập nhật vai trò thành công!');
      } else {
        alert('Có lỗi xảy ra khi cập nhật vai trò');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Có lỗi xảy ra khi cập nhật vai trò');
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        await loadUsers();
        alert(`${isActive ? 'Vô hiệu hóa' : 'Kích hoạt'} tài khoản thành công!`);
      } else {
        alert('Có lỗi xảy ra khi cập nhật trạng thái tài khoản');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Có lỗi xảy ra khi cập nhật trạng thái tài khoản');
    }
  };

  const handleUpgradeRequest = async (requestId: number, action: 'approve' | 'reject', note?: string) => {
    try {
      const response = await fetch(`/api/admin/role-upgrade-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
        },
        body: JSON.stringify({ action, note }),
      });

      if (response.ok) {
        // Tự động reload cả users và upgrade requests để cập nhật trạng thái
        await Promise.all([loadUsers(), loadUpgradeRequests()]);
        // Không cần alert, chỉ reload để UI tự động cập nhật
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error response:', errorData);
        alert(`Có lỗi xảy ra: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error handling upgrade request:', error);
      alert('Có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại.');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.Username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.Email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.FullName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !selectedRole || user.RoleName === selectedRole;
    return matchesSearch && matchesRole;
  });

  const pendingRequests = upgradeRequests.filter(req => req.Status === 'Pending');

  // Check if user is Admin
  if (!user?.email) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
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

  if (userRole !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Only administrators can access user management.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Current role: <span className="font-medium">{userRole || 'Unknown'}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-8 h-8" />
            User Management
          </h1>
          <Button 
            onClick={() => {
              loadUsers();
              loadUpgradeRequests();
            }}
            variant="secondary"
          >
            🔄 Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Danh sách người dùng
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
              activeTab === 'requests'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Yêu cầu nâng cấp
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'users' && (
          <>
            {/* Search and Filter */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Tìm kiếm theo tên, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search className="w-4 h-4 text-gray-400" />}
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>

            {/* Users Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Người dùng</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Level</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Vai trò</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Trạng thái</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Ngày tạo</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.UserID} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{user.Username}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{user.Email}</div>
                            {user.FullName && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">{user.FullName}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {user.RoleName !== 'Admin' && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-md bg-gradient-to-r from-gray-400 to-gray-600 text-white border border-gray-500">
                              Lv.{user.Level ?? 1}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={user.RoleName}
                            onChange={(e) => handleRoleChange(user.UserID, e.target.value)}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                          >
                            {roles.slice(1).map(role => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.IsActive 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {user.IsActive ? 'Hoạt động' : 'Bị khóa'}
                            </span>
                            {user.IsEmailVerified && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Đã xác thực
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(user.CreatedAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant={user.IsActive ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => handleToggleActive(user.UserID, user.IsActive)}
                          >
                            {user.IsActive ? 'Khóa' : 'Mở khóa'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {activeTab === 'requests' && (
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Yêu cầu nâng cấp quyền ({pendingRequests.length} đang chờ)
              </h2>
              
              {upgradeRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Không có yêu cầu nâng cấp nào
                </div>
              ) : (
                <div className="space-y-4">
                  {upgradeRequests.map((request) => (
                    <div key={request.RequestID} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{request.Username}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">({request.Email})</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              request.Status === 'Pending' 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : request.Status === 'Approved'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {request.Status === 'Pending' ? 'Chờ duyệt' : 
                               request.Status === 'Approved' ? 'Đã duyệt' : 'Đã từ chối'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <strong>Hiện tại:</strong> {request.CurrentRole} → <strong>Yêu cầu:</strong> {request.RequestedRole}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <strong>Lý do:</strong> {request.Reason}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            Yêu cầu lúc: {new Date(request.RequestedAt).toLocaleString('vi-VN')}
                          </div>
                        </div>
                        
                        {request.Status === 'Pending' && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleUpgradeRequest(request.RequestID, 'approve')}
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              Duyệt
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/admin/role-upgrade-requests/${request.RequestID}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-user-email': user?.email || '',
                                    },
                                    body: JSON.stringify({ action: 'approve', force: true }),
                                  });
                                  if (response.ok) {
                                    await Promise.all([loadUsers(), loadUpgradeRequests()]);
                                    alert('Force update role thành công!');
                                  } else {
                                    const errorData = await response.json();
                                    alert(`Lỗi: ${errorData.error}`);
                                  }
                                } catch (error) {
                                  console.error('Error force updating role:', error);
                                  alert('Có lỗi xảy ra');
                                }
                              }}
                            >
                              🔧 Force Update
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const note = prompt('Lý do từ chối (tùy chọn):');
                                handleUpgradeRequest(request.RequestID, 'reject', note || undefined);
                              }}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              Từ chối
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
