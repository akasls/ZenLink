import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// 请求拦截器：自动附加 JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zenlink_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401 未授权
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      localStorage.removeItem('zenlink_token');
      localStorage.removeItem('zenlink_user');
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== Auth API ====================

export const authApi = {
  login(data: { username: string; password: string; totpCode?: string }) {
    return api.post('/auth/login', data);
  },
  getMe() {
    return api.get('/auth/me');
  },
  changePassword(data: { currentPassword: string; newPassword: string }) {
    return api.post('/auth/change-password', data);
  },
  changeUsername(data: { newUsername: string }) {
    return api.post('/auth/change-username', data);
  },
  setupTotp() {
    return api.post('/auth/totp/setup');
  },
  verifyTotp(code: string) {
    return api.post('/auth/totp/verify', { code });
  },
  getWebAuthnRegisterOptions() {
    return api.post('/auth/webauthn/register-options');
  },
  verifyWebAuthnRegister(data: any) {
    return api.post('/auth/webauthn/register-verify', data);
  },
  getWebAuthnLoginOptions() {
    return api.post('/auth/webauthn/login-options');
  },
  verifyWebAuthnLogin(data: any) {
    return api.post('/auth/webauthn/login-verify', data);
  },
};

// ==================== Bookmarks API ====================

export const bookmarkApi = {
  getAll(params?: { categoryId?: number; search?: string }) {
    return api.get('/bookmarks', { params });
  },
  create(data: any) {
    return api.post('/bookmarks', data);
  },
  update(id: number, data: any) {
    return api.put(`/bookmarks/${id}`, data);
  },
  delete(id: number) {
    return api.delete(`/bookmarks/${id}`);
  },
  fetchMeta(url: string) {
    return api.post('/bookmarks/fetch-meta', { url });
  },
  checkOne(id: number) {
    return api.post(`/bookmarks/${id}/check`);
  },
  checkAll() {
    return api.post('/bookmarks/check-all');
  },
  reorder(ids: number[]) {
    return api.put('/bookmarks/reorder', { ids });
  },
};

// ==================== Categories API ====================

export const categoryApi = {
  getAll() {
    return api.get('/categories');
  },
  create(data: any) {
    return api.post('/categories', data);
  },
  update(id: number, data: any) {
    return api.put(`/categories/${id}`, data);
  },
  delete(id: number) {
    return api.delete(`/categories/${id}`);
  },
};

// ==================== Shares API (公开分享与提取) ====================

export const shareApi = {
  getShare(code: string) {
    return api.get(`/shares/${code}`);
  },
  verifyShare(code: string, password?: string) {
    return api.post(`/shares/${code}/verify`, { password });
  },
};

// ==================== Notes API ====================

export const noteApi = {
  uploadAttachment(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/notes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAll(params?: { categoryId?: number; tag?: string; search?: string }) {
    return api.get('/notes', { params });
  },
  getTags() {
    return api.get('/notes/tags');
  },
  getOne(id: number) {
    return api.get(`/notes/${id}`);
  },
  create(data: { title?: string; content?: string; categoryId?: number; tags?: string[] }) {
    return api.post('/notes', data);
  },
  update(id: number, data: { title?: string; content?: string; categoryId?: number | null; isPinned?: number; tags?: string[] }) {
    return api.put(`/notes/${id}`, data);
  },
  delete(id: number) {
    return api.delete(`/notes/${id}`);
  },
  reorder(ids: number[]) {
    return api.put('/notes/reorder', { ids });
  },
  createShare(id: number, data: { password?: string; expire_hours?: number; burn_after_reading?: boolean }) {
    return api.post(`/notes/${id}/share`, data);
  },
  getShares(id: number) {
    return api.get(`/notes/${id}/shares`);
  },
  deleteShare(code: string) {
    return api.delete(`/notes/shares/${code}`);
  },
};

export const noteCategoryApi = {
  getAll() {
    return api.get('/note-categories');
  },
  create(data: { name: string; icon?: string }) {
    return api.post('/note-categories', data);
  },
  update(id: number, data: { name?: string; icon?: string; sortOrder?: number }) {
    return api.put(`/note-categories/${id}`, data);
  },
  delete(id: number) {
    return api.delete(`/note-categories/${id}`);
  },
  reorder(ids: number[]) {
    return api.put('/note-categories/reorder', { ids });
  },
};

// ==================== AI API ====================

export const aiApi = {
  getSettings() {
    return api.get('/ai/settings');
  },
  saveSettings(data: {
    api_key?: string;
    base_url?: string;
    model?: string;
    writing_model?: string;
    bookmark_model?: string;
    system_prompt?: string;
    available_models?: string[];
    all_models?: string[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    reasoning_mode?: boolean;
  }) {
    return api.post('/ai/settings', data);
  },
  fetchModels(data?: { base_url?: string; api_key?: string }) {
    return api.post('/ai/fetch-models', data || {});
  },
  getProjects() {
    return api.get('/ai/projects');
  },
  createProject(data: { name: string; icon?: string; description?: string }) {
    return api.post('/ai/projects', data);
  },
  updateProject(id: string, data: { name?: string; icon?: string; description?: string }) {
    return api.put(`/ai/projects/${id}`, data);
  },
  deleteProject(id: string) {
    return api.delete(`/ai/projects/${id}`);
  },
  getConversations(options?: { projectId?: string; isArchived?: number } | string) {
    const params: any = {};
    if (typeof options === 'string') {
      params.project_id = options;
    } else if (options) {
      if (options.projectId) params.project_id = options.projectId;
      if (options.isArchived !== undefined) params.is_archived = options.isArchived;
    }
    return api.get('/ai/conversations', { params: Object.keys(params).length ? params : undefined });
  },
  createConversation(data?: { title?: string; model?: string; role_id?: string; icon?: string; project_id?: string | null; is_pinned?: number; is_archived?: number }) {
    return api.post('/ai/conversations', data || {});
  },
  updateConversation(id: string, data: { title?: string; role_id?: string; model?: string; icon?: string; project_id?: string | null; is_pinned?: number; is_archived?: number }) {
    return api.put(`/ai/conversations/${id}`, data);
  },
  deleteConversation(id: string) {
    return api.delete(`/ai/conversations/${id}`);
  },
  clearConversations() {
    return api.post('/ai/conversations/clear');
  },
  getMessages(conversationId: string) {
    return api.get(`/ai/conversations/${conversationId}/messages`);
  },
  updateMessage(id: number | string, data: { content: string }) {
    return api.put(`/ai/messages/${id}`, data);
  },
  deleteMessage(id: number | string) {
    return api.delete(`/ai/messages/${id}`);
  },
};

// ==================== Site Settings API ====================

export const settingsApi = {
  get() {
    return api.get('/settings');
  },
  save(data: Record<string, any>) {
    return api.post('/settings', data);
  },
};

// ==================== Storage (Cloudflare R2) API ====================

export const storageApi = {
  getSettings() {
    return api.get('/storage/settings');
  },
  saveSettings(data: {
    storage_type?: string;
    r2_account_id?: string;
    r2_access_key_id?: string;
    r2_secret_access_key?: string;
    r2_bucket_name?: string;
    r2_public_domain?: string;
  }) {
    return api.post('/storage/settings', data);
  },
  testConnection(data: {
    r2_account_id?: string;
    r2_access_key_id?: string;
    r2_secret_access_key?: string;
    r2_bucket_name?: string;
  }) {
    return api.post('/storage/test', data);
  },
};
