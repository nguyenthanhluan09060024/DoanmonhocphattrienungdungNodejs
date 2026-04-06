import React, { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ExperienceBar } from '../components/ui/ExperienceBar';
import { fetchProfile, updateProfile, getUserExperience, fetchCurrentRole } from '../lib/api';
import { Mail, User, Lock, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const email = useMemo(() => (user?.email as string | undefined) || '', [user]);
  const [username, setUsername] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [avatar, setAvatar] = React.useState('');
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [gender, setGender] = React.useState<'Nam' | 'Nữ' | 'Không xác định'>('Không xác định');
  const [password, setPassword] = React.useState('');
  const [joinDate, setJoinDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [experience, setExperience] = React.useState<{
    totalExp: number;
    level: number;
    currentLevelExp: number;
    maxExp: number;
    expToNextLevel: number;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!email) return;
      try {
        const dto = await fetchProfile(email);
        if (!cancelled) {
          setUsername(dto.Username || '');
          setFullName(dto.FullName || '');
          setAvatar(dto.Avatar || '');
          setGender((dto.Gender as 'Nam' | 'Nữ' | 'Không xác định') || 'Không xác định');
          if (dto.CreatedAt) {
            const date = new Date(dto.CreatedAt);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            setJoinDate(`${day}/${month}/${year}`);
          }
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, [email]);

  // Load user role
  React.useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      if (!email) return;
      try {
        const { role } = await fetchCurrentRole(email);
        if (!cancelled) {
          setIsAdmin(role === 'Admin');
        }
      } catch (error) {
        console.error('Failed to load role:', error);
        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    };
    loadRole();
    return () => { cancelled = true; };
  }, [email]);

  // Load user experience (chỉ load nếu không phải Admin)
  React.useEffect(() => {
    let cancelled = false;
    const loadExp = async () => {
      if (!email || isAdmin) {
        // Admin không cần EXP
        if (!cancelled) setExperience(null);
        return;
      }
      try {
        const exp = await getUserExperience(email);
        if (!cancelled) {
          setExperience(exp);
        }
      } catch (error) {
        console.error('Failed to load experience:', error);
        // Set default values if failed
        if (!cancelled) {
          setExperience({
            totalExp: 0,
            level: 1,
            currentLevelExp: 0,
            maxExp: 100,
            expToNextLevel: 100,
          });
        }
      }
    };
    loadExp();
    return () => { cancelled = true; };
  }, [email, isAdmin]);

  const handleSave = async () => {
    if (!email) return;
    setSaving(true);
    try {
      // Handle avatar file upload if selected
      let avatarUrl = avatar;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        formData.append('email', email);
        
        const uploadRes = await fetch('/api/me/avatar', {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          avatarUrl = data.avatarUrl || avatar;
        }
      }

      await updateProfile({ 
        email, 
        username, 
        fullName, 
        avatar: avatarUrl,
        gender,
        password: password || undefined, // Only send if not empty
      });
      
      // Show success toast
      toast.success('Cập nhật thành công!', {
        duration: 2000,
      });
      
      // Reload page after a short delay to show the toast
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Ảnh phải nhỏ hơn 5MB');
        return;
      }
      setAvatarFile(file);
    }
  };

  // Get avatar URL for display - prefer file preview, then stored avatar URL
  const avatarDisplayUrl = React.useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }
    return avatar || '';
  }, [avatarFile, avatar]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Avatar & Info */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="mb-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {avatarDisplayUrl ? (
                    <img 
                      src={avatarDisplayUrl} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {username || email.split('@')[0]}
              </h2>
              <div className="text-sm mb-4">
                <span className="text-yellow-500 dark:text-yellow-400 font-medium">THAM GIA:</span>
                <span className="text-gray-600 dark:text-gray-300 ml-2">{joinDate || 'N/A'}</span>
              </div>
              
              {/* Experience Bar - Chỉ hiển thị nếu không phải Admin */}
              {!isAdmin && experience && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <ExperienceBar
                    level={experience.level}
                    currentLevelExp={experience.currentLevelExp}
                    maxExp={experience.maxExp}
                    totalExp={experience.totalExp}
                    expToNextLevel={experience.expToNextLevel}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                THÔNG TIN TÀI KHOẢN
              </h1>

              <div className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
                    Email
                  </label>
                  <Input
                    value={email}
                    disabled
                    icon={<Mail className="w-5 h-5 text-gray-400" />}
                    placeholder="Email đăng nhập"
                  />
                </div>

                {/* Tài khoản */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
                    Tài khoản
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled
                    icon={<User className="w-5 h-5 text-gray-400" />}
                    placeholder="Tài khoản / Username"
                  />
                </div>

                {/* Họ tên */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
                    Họ tên
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    icon={<User className="w-5 h-5 text-gray-400" />}
                    placeholder="Họ và tên"
                  />
                </div>

                {/* Giới tính */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
                    Giới tính
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="Nam"
                        checked={gender === 'Nam'}
                        onChange={(e) => setGender(e.target.value as 'Nam')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Nam</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="Nữ"
                        checked={gender === 'Nữ'}
                        onChange={(e) => setGender(e.target.value as 'Nữ')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Nữ</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="Không xác định"
                        checked={gender === 'Không xác định'}
                        onChange={(e) => setGender(e.target.value as 'Không xác định')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Không xác định</span>
                    </label>
                  </div>
                </div>

                {/* Mật khẩu */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
                    Mật khẩu
                  </label>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Để trống nếu không muốn đổi
                    </span>
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Lock className="w-5 h-5 text-gray-400" />}
                    placeholder="Nhập mật khẩu mới"
                  />
                </div>

                {/* Avatar Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
                    Avatar
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <label htmlFor="avatar-upload" className="cursor-pointer">
                      <div className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-2">
                        <Upload className="w-4 h-4" />
                        Chọn tệp
                      </div>
                    </label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {avatarFile ? avatarFile.name : 'Không có tệp nào được chọn'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    (Ảnh nhỏ hơn 5MB, nếu ảnh lớn hơn 5MB sẽ được chọn mặc định)
                  </p>
                </div>

                {/* Update Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !email}
                    variant="primary"
                    size="lg"
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                  >
                    {saving ? 'Đang cập nhật...' : 'CẬP NHẬT'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;


