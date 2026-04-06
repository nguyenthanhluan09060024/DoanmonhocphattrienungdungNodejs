import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Crown, ArrowUp, CheckCircle, XCircle, Clock } from 'lucide-react';


interface UpgradeRequest {
  RequestID: number;
  RequestedRoleID: number;
  RequestedRoleName: string;
  Reason: string;
  Status: string;
  ReviewNote: string;
  RequestedAt: string;
  ReviewedAt: string;
}

const RoleUpgradePage: React.FC = () => {
  const { user } = useAuth();
  const [currentRole, setCurrentRole] = useState<string>('');
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Role descriptions mapping
  const roleDescriptions: Record<string, string> = {
    'Viewer': 'Người xem - Chỉ có quyền xem nội dung',
    'Uploader': 'Người upload - Có thể tải lên nội dung',
    'Author': 'Tác giả - Có thể tạo và tải lên nội dung gốc',
    'Translator': 'Nhóm dịch - Có thể dịch và tải lên nội dung',
    'Reup': 'Người reup - Có thể tải lại nội dung từ nguồn khác',
    'Admin': 'Quản trị viên - Có toàn quyền quản lý hệ thống'
  };

  const loadData = async () => {
    try {
      // Load current user role
      const roleResponse = await fetch('/api/auth/role', {
        headers: {
          'x-user-email': user?.email || '',
        },
      });
      if (roleResponse.ok) {
        const roleData = await roleResponse.json();
        setCurrentRole(roleData.role);
      }

      // Load user's upgrade requests
      const requestsResponse = await fetch('/api/user/role-upgrade-requests', {
        headers: {
          'x-user-email': user?.email || '',
        },
      });
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setUpgradeRequests(requestsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      loadData();
    }
  }, [user?.email]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !reason.trim()) {
      alert('Vui lòng chọn vai trò và nhập lý do');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/user/role-upgrade-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
        },
        body: JSON.stringify({
          requestedRole: selectedRole,
          reason: reason.trim(),
        }),
      });

      if (response.ok) {
        alert('Gửi yêu cầu nâng cấp thành công! Admin sẽ xem xét và phản hồi sớm nhất.');
        setReason('');
        setSelectedRole('');
        await loadData();
      } else {
        const error = await response.json();
        alert(error.error || 'Có lỗi xảy ra khi gửi yêu cầu');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Có lỗi xảy ra khi gửi yêu cầu');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'Rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'Đã duyệt';
      case 'Rejected':
        return 'Đã từ chối';
      default:
        return 'Chờ duyệt';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  // Filter roles that are higher than current role
  const availableRoles = Object.entries(roleDescriptions).filter(([roleName]) => {
    const roleHierarchy = ['Viewer', 'Uploader', 'Author', 'Translator', 'Reup', 'Admin'];
    const currentIndex = roleHierarchy.indexOf(currentRole);
    const roleIndex = roleHierarchy.indexOf(roleName);
    return roleIndex > currentIndex;
  });

  // Check if user has pending request
  const hasPendingRequest = upgradeRequests.some(req => req.Status === 'Pending');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Crown className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Role Upgrade
          </h1>
        </div>

        <div className="grid gap-6">
          {/* Current Role Info */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Vai trò hiện tại
              </h2>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg font-medium">
                  {currentRole}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {roleDescriptions[currentRole] || 'Không có mô tả'}
                </div>
              </div>
            </div>
          </Card>

          {/* Upgrade Request Form */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ArrowUp className="w-5 h-5" />
                Yêu cầu nâng cấp quyền
              </h2>
              
              {hasPendingRequest ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Bạn đã có yêu cầu nâng cấp đang chờ duyệt</span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                    Vui lòng chờ admin xem xét yêu cầu trước khi gửi yêu cầu mới.
                  </p>
                </div>
              ) : availableRoles.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Crown className="w-5 h-5" />
                    <span>Bạn đã có quyền cao nhất có thể</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Vai trò muốn nâng cấp
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="">Chọn vai trò...</option>
                      {availableRoles.map(([roleName, description]) => (
                        <option key={roleName} value={roleName}>
                          {roleName} - {description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lý do nâng cấp
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Mô tả lý do bạn muốn nâng cấp quyền, kinh nghiệm, mục đích sử dụng..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      rows={4}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? 'Đang gửi...' : 'Gửi yêu cầu nâng cấp'}
                  </Button>
                </form>
              )}
            </div>
          </Card>

          {/* Request History */}
          {upgradeRequests.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Lịch sử yêu cầu nâng cấp
                </h2>
                
                <div className="space-y-4">
                  {upgradeRequests.map((request) => (
                    <div key={request.RequestID} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(request.Status)}
                            <span className="font-medium text-gray-900 dark:text-white">
                              Yêu cầu nâng cấp lên {request.RequestedRoleName}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.Status)}`}>
                              {getStatusText(request.Status)}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <strong>Lý do:</strong> {request.Reason}
                          </div>
                          
                          {request.ReviewNote && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <strong>Phản hồi từ admin:</strong> {request.ReviewNote}
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            Yêu cầu lúc: {new Date(request.RequestedAt).toLocaleString('vi-VN')}
                            {request.ReviewedAt && (
                              <span className="ml-4">
                                Duyệt lúc: {new Date(request.ReviewedAt).toLocaleString('vi-VN')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleUpgradePage;
