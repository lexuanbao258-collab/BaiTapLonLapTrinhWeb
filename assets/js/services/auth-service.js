/**
 * Hệ thống xác thực giả lập phục vụ bài tập frontend.
 *
 * Tài khoản, mật khẩu và phiên đăng nhập được lưu bằng LocalStorage.
 * Đây không phải cơ chế bảo mật phù hợp cho ứng dụng thực tế.
 *
 * Hệ thống thực tế cần backend, database, HTTPS,
 * session hoặc token và cơ chế khôi phục mật khẩu an toàn.
 */

'use strict';

const AuthService = (() => {
  const STORAGE_ERROR =
    'Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.';

  const normalizeEmail = email => {
    return String(email || '').trim().toLowerCase();
  };

  const EXPERIENCE_ACCOUNT = Object.freeze({
    id: 'user_demo',
    email: 'trai-nghiem@taskflow.local',
    legacyEmail: 'demo@taskflow.local'
  });

  const isExperienceEmail = email => {
    const normalizedEmail = normalizeEmail(email);

    return normalizedEmail === EXPERIENCE_ACCOUNT.email ||
      normalizedEmail === EXPERIENCE_ACCOUNT.legacyEmail;
  };

  const isExperienceAccount = user => {
    return user?.id === EXPERIENCE_ACCOUNT.id || isExperienceEmail(user?.email);
  };

  const publicEmail = user => {
    return isExperienceAccount(user) ? EXPERIENCE_ACCOUNT.email : normalizeEmail(user?.email);
  };

  const publicName = user => {
    return isExperienceAccount(user) ?
      'Không gian trải nghiệm' : String(user?.fullName || '').trim();
  };

  const publicBio = user => {
    return isExperienceAccount(user) ?
      'Không gian gợi ý để bạn bắt đầu lên kế hoạch.' : String(user?.bio || '').trim();
  };

  const findUserByEmail = (list, email) => {
    const directMatch = list.find(user => user.email === email);

    return directMatch || (isExperienceEmail(email) ?
      list.find(isExperienceAccount) : null);
  };

  const now = () => {
    return new Date().toISOString();
  };

  // Băm đơn giản để tránh lưu mật khẩu dạng văn bản trong bài tập frontend.
  // Cách làm này không thay thế cơ chế bảo mật của backend thực tế.
  const hashPassword = value => {
    const text = `taskflow::${String(value || '')}::2026`;
    let firstHash = 0x811c9dc5;
    let secondHash = 0x9e3779b9;

    for (let index = 0; index < text.length; index += 1) {
      firstHash ^= text.charCodeAt(index);
      firstHash = Math.imul(firstHash, 0x01000193);
      secondHash ^= text.charCodeAt(index) + index;
      secondHash = Math.imul(secondHash, 0x85ebca6b);
    }

    const firstPart = (firstHash >>> 0)
      .toString(16)
      .padStart(8, '0');
    const secondPart = (secondHash >>> 0)
      .toString(16)
      .padStart(8, '0');

    return `${firstPart}${secondPart}`;
  };

  const inspectUsers = () => {
    const result = Storage.rawInspect(CONFIG.STORAGE.USERS);

    if (!result.ok || !result.found) {
      return result;
    }

    if (!Array.isArray(result.value)) {
      const error = new Error('Dữ liệu tài khoản không hợp lệ.');

      console.error(error.message);

      return {
        ok: false,
        found: true,
        value: null,
        error
      };
    }

    return result;
  };

  const users = () => {
    const result = inspectUsers();

    return result.ok && result.found ? result.value : [];
  };

  const saveUsers = list => {
    return Storage.rawWrite(CONFIG.STORAGE.USERS, list);
  };

  const storageError = () => {
    return {
      ok: false,
      errors: {
        general: STORAGE_ERROR
      },
      message: STORAGE_ERROR
    };
  };

  const validateName = name => {
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return 'Vui lòng nhập họ và tên.';
    }

    if (cleanName.length < 2) {
      return 'Họ và tên phải có ít nhất 2 ký tự.';
    }

    if (cleanName.length > 60) {
      return 'Họ và tên không được vượt quá 60 ký tự.';
    }

    return '';
  };

  const validateEmail = email => {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      return 'Vui lòng nhập email.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(cleanEmail)) {
      return 'Email chưa đúng định dạng.';
    }

    return '';
  };

  const validatePassword = password => {
    const cleanPassword = String(password || '');

    if (!cleanPassword) {
      return 'Vui lòng nhập mật khẩu.';
    }

    if (cleanPassword.length < 6) {
      return 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    if (cleanPassword.length > 64) {
      return 'Mật khẩu không được vượt quá 64 ký tự.';
    }

    return '';
  };

  const ensureDemoAccount = () => {
    const storedUsers = inspectUsers();

    if (!storedUsers.ok) {
      return false;
    }

    const list = storedUsers.found ? storedUsers.value : [];
    const email = EXPERIENCE_ACCOUNT.email;

    if (list.some(isExperienceAccount)) {
      return true;
    }

    list.push({
      id: EXPERIENCE_ACCOUNT.id,
      fullName: 'Không gian trải nghiệm',
      email,
      passwordHash: hashPassword('123456'),
      bio: 'Không gian gợi ý để bạn bắt đầu lên kế hoạch.',
      avatarColor: CONFIG.DEFAULT_ACCENT,
      createdAt: now(),
      updatedAt: now()
    });

    return saveUsers(list).ok;
  };

  const sanitize = user => {
    if (!user) {
      return null;
    }

    const {
      passwordHash,
      ...safeUser
    } = user;

    return safeUser;
  };

  const register = input => {
    if (!ensureDemoAccount()) {
      return storageError();
    }

    const fullName = String(input.fullName || '').trim();
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const confirmPassword = String(input.confirmPassword || '');
    const errors = {};
    const nameError = validateName(fullName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (nameError) {
      errors.fullName = nameError;
    }

    if (emailError) {
      errors.email = emailError;
    }

    if (passwordError) {
      errors.password = passwordError;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng nhập lại mật khẩu.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    }

    if (!input.acceptTerms) {
      errors.acceptTerms = 'Bạn cần đồng ý với điều khoản sử dụng.';
    }

    const list = users();

    if (!emailError && list.some(user => user.email === email)) {
      errors.email = 'Email này đã được đăng ký.';
    }

    if (Object.keys(errors).length) {
      return {
        ok: false,
        errors
      };
    }

    const user = {
      id: `user_${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      fullName,
      email,
      passwordHash: hashPassword(password),
      bio: '',
      avatarColor: CONFIG.DEFAULT_ACCENT,
      createdAt: now(),
      updatedAt: now()
    };

    const previousUsers = [...list];

    list.push(user);

    const saveResult = saveUsers(list);

    if (!saveResult.ok) {
      return storageError();
    }

    // Registration has no active session yet, so initialize with the new id
    // explicitly. This can never fall back to the account that was logged in
    // before the visitor opened the register page.
    const workspaceResult = Storage.initializeUserData(user.id, {
      requireEmpty: true
    });

    if (!workspaceResult.ok) {
      const rollbackResult = saveUsers(previousUsers);

      if (!rollbackResult.ok) {
        console.error('Không thể hoàn tác tài khoản sau lỗi khởi tạo workspace.');
      }

      return storageError();
    }

    return {
      ok: true,
      data: sanitize(user)
    };
  };

  const clearSessions = () => {
    const persistentResult = Storage.rawRemove(CONFIG.STORAGE.SESSION);
    const temporaryResult = Storage.sessionRemove(CONFIG.STORAGE.SESSION);

    if (!persistentResult.ok || !temporaryResult.ok) {
      return !persistentResult.ok ? persistentResult : temporaryResult;
    }

    return {
      ok: true
    };
  };

  const createSession = (userId, remember = false) => {
    const clearResult = clearSessions();

    if (!clearResult.ok) {
      return clearResult;
    }

    const session = {
      userId,
      createdAt: now(),
      remember: Boolean(remember)
    };
    const saveResult = remember ?
      Storage.rawWrite(CONFIG.STORAGE.SESSION, session) :
      Storage.sessionWrite(CONFIG.STORAGE.SESSION, session);

    if (!saveResult.ok) {
      clearSessions();
      return saveResult;
    }

    const storedSession = Storage.getActiveSession();
    const otherStorageResult = remember ?
      Storage.sessionInspect(CONFIG.STORAGE.SESSION) :
      Storage.rawInspect(CONFIG.STORAGE.SESSION);

    if (
      !storedSession ||
      storedSession.userId !== userId ||
      storedSession.remember !== Boolean(remember) ||
      !otherStorageResult.ok ||
      otherStorageResult.found
    ) {
      clearSessions();

      return {
        ok: false,
        error: new Error('Không thể xác minh phiên đăng nhập mới.')
      };
    }

    return {
      ok: true,
      data: session
    };
  };

  const login = input => {
    if (!ensureDemoAccount()) {
      return storageError();
    }

    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const errors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError) {
      errors.email = emailError;
    }

    if (passwordError) {
      errors.password = passwordError;
    }

    if (Object.keys(errors).length) {
      return {
        ok: false,
        errors
      };
    }

    const user = findUserByEmail(users(), email);

    if (!user || user.passwordHash !== hashPassword(password)) {
      return {
        ok: false,
        errors: {
          general: 'Email hoặc mật khẩu không chính xác.'
        }
      };
    }

    const sessionResult = createSession(
      user.id,
      Boolean(input.remember)
    );

    if (!sessionResult.ok) {
      return storageError();
    }

    const emailSaveResult = Storage.rawWrite(
      CONFIG.STORAGE.LAST_EMAIL,
      publicEmail(user)
    );

    if (!emailSaveResult.ok) {
      console.warn('Không thể lưu email đăng nhập gần nhất.');
    }

    return {
      ok: true,
      data: sanitize(user)
    };
  };

  const getSession = () => Storage.getActiveSession();

  const logout = () => {
    return clearSessions().ok;
  };

  const getCurrentUser = () => {
    const session = getSession();

    if (!session?.userId) {
      return null;
    }

    const user = users().find(item => item.id === session.userId);

    if (!user) {
      logout();
      return null;
    }

    return sanitize(user);
  };

  const isAuthenticated = () => {
    return Boolean(getCurrentUser());
  };

  const updateProfile = patch => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      return {
        ok: false,
        errors: {
          general: 'Phiên đăng nhập đã hết hạn.'
        }
      };
    }

    const list = users();
    const index = list.findIndex(user => user.id === currentUser.id);

    if (index < 0) {
      return {
        ok: false,
        errors: {
          general: 'Không tìm thấy tài khoản.'
        }
      };
    }

    const fullName = String(
      patch.fullName ?? list[index].fullName
    ).trim();
    const email = normalizeEmail(
      patch.email ?? list[index].email
    );
    const errors = {};
    const nameError = validateName(fullName);
    const emailError = validateEmail(email);

    if (nameError) {
      errors.fullName = nameError;
    }

    if (emailError) {
      errors.email = emailError;
    }

    const emailBelongsToAnotherUser = list.some(user => {
      return user.email === email && user.id !== currentUser.id;
    });

    if (!emailError && emailBelongsToAnotherUser) {
      errors.email = 'Email này đang thuộc tài khoản khác.';
    }

    if (Object.keys(errors).length) {
      return {
        ok: false,
        errors
      };
    }

    const updatedUser = {
      ...list[index],
      fullName,
      email,
      role: String(patch.role ?? list[index].role ?? '').trim(),
      school: String(patch.school ?? list[index].school ?? '').trim(),
      bio: String(patch.bio ?? list[index].bio ?? '')
        .trim()
        .slice(0, 240),
      avatarColor: /^#[0-9a-fA-F]{6}$/.test(String(
          patch.avatarColor ?? list[index].avatarColor ?? ''
        )) ?
        String(patch.avatarColor ?? list[index].avatarColor) : CONFIG.DEFAULT_ACCENT,
      updatedAt: now()
    };

    list[index] = updatedUser;

    const saveResult = saveUsers(list);

    if (!saveResult.ok) {
      return storageError();
    }

    return {
      ok: true,
      data: sanitize(updatedUser)
    };
  };

  const changePassword = input => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      return {
        ok: false,
        errors: {
          general: 'Phiên đăng nhập đã hết hạn.'
        }
      };
    }

    const oldPassword = String(input.oldPassword || '');
    const newPassword = String(input.newPassword || '');
    const confirmPassword = String(input.confirmPassword || '');
    const errors = {};
    const list = users();
    const index = list.findIndex(user => user.id === currentUser.id);

    if (index < 0) {
      return {
        ok: false,
        errors: {
          general: 'Không tìm thấy tài khoản.'
        }
      };
    }

    if (list[index].passwordHash !== hashPassword(oldPassword)) {
      errors.oldPassword = 'Mật khẩu hiện tại không đúng.';
    }

    const newPasswordError = validatePassword(newPassword);

    if (newPasswordError) {
      errors.newPassword = newPasswordError;
    }

    if (newPassword === oldPassword && newPassword) {
      errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới.';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    }

    if (Object.keys(errors).length) {
      return {
        ok: false,
        errors
      };
    }

    list[index].passwordHash = hashPassword(newPassword);
    list[index].updatedAt = now();

    const saveResult = saveUsers(list);

    if (!saveResult.ok) {
      return storageError();
    }

    return {
      ok: true
    };
  };

  const resetPassword = input => {
    if (!ensureDemoAccount()) {
      return storageError();
    }

    const email = normalizeEmail(input.email);
    const newPassword = String(input.newPassword || '');
    const confirmPassword = String(input.confirmPassword || '');
    const errors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(newPassword);

    if (emailError) {
      errors.email = emailError;
    }

    if (passwordError) {
      errors.newPassword = passwordError;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới.';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    }

    const list = users();
    const account = findUserByEmail(list, email);
    const index = account ? list.findIndex(user => user.id === account.id) : -1;

    if (!emailError && index < 0) {
      errors.email = 'Không tìm thấy tài khoản với email này.';
    }

    if (Object.keys(errors).length) {
      return {
        ok: false,
        errors
      };
    }

    list[index].passwordHash = hashPassword(newPassword);
    list[index].updatedAt = now();

    const saveResult = saveUsers(list);

    if (!saveResult.ok) {
      return storageError();
    }

    return {
      ok: true
    };
  };

  const deleteAccount = password => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      return {
        ok: false,
        message: 'Phiên đăng nhập đã hết hạn.'
      };
    }

    const list = users();
    const account = list.find(user => user.id === currentUser.id);

    if (!account || account.passwordHash !== hashPassword(password)) {
      return {
        ok: false,
        message: 'Mật khẩu xác nhận không đúng.'
      };
    }

    const nextUsers = list.filter(user => user.id !== currentUser.id);
    const userSaveResult = saveUsers(nextUsers);

    if (!userSaveResult.ok) {
      return storageError();
    }

    const clearResult = Storage.clearUserData(currentUser.id);

    if (!clearResult.ok) {
      const rollbackResult = saveUsers(list);

      if (!rollbackResult.ok) {
        console.error('Không thể hoàn tác tài khoản sau lỗi xóa dữ liệu.');
      }

      return storageError();
    }

    const logoutOk = logout();

    if (!logoutOk) {
      console.warn('Tài khoản đã xóa nhưng không thể dọn khóa phiên cũ.');
    }

    return {
      ok: true
    };
  };

  const firstName = user => {
    const parts = String(publicName(user) || 'Bạn')
      .trim()
      .split(/\s+/);

    return parts.pop() || 'Bạn';
  };

  const initials = user => {
    const parts = String(publicName(user) || 'TF')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) {
      return 'TF';
    }

    const firstInitial = parts[0][0] || '';
    const lastInitial = parts.length > 1 ?
      parts[parts.length - 1][0] :
      '';

    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  const lastEmail = () => {
    const email = Storage.rawRead(CONFIG.STORAGE.LAST_EMAIL, '');

    return isExperienceEmail(email) ? EXPERIENCE_ACCOUNT.email : email;
  };

  ensureDemoAccount();

  return {
    register,
    login,
    logout,
    isAuthenticated,
    getCurrentUser,
    updateProfile,
    changePassword,
    resetPassword,
    deleteAccount,
    firstName,
    initials,
    publicEmail,
    publicName,
    publicBio,
    getExperienceEmail: () => EXPERIENCE_ACCOUNT.email,
    lastEmail,
    ensureDemoAccount
  };
})();
