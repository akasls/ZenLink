<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { bookmarkApi } from '@/api';
import { getAvatarChar, getAvatarColor } from '@/utils/avatar';

interface Category {
  id: number;
  name: string;
  parent_id?: number | null;
  sort_order?: number;
}

const props = defineProps<{
  visible: boolean;
  bookmark: any;
  categories: Category[];
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  saved: [];
}>();

const saving = ref(false);
const fetching = ref(false);
const previewError = ref(false);

const form = reactive({
  title: '',
  description: '',
  url: '',
  backupUrl: '',
  favicon: '',
  categoryId: null as number | null,
  isPrivate: false,
});

// 带有 └ 标记的二级分类层级选项
const categoryOptions = computed(() => {
  const options: { id: number; name: string }[] = [];
  const tops = props.categories.filter(c => !c.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  for (const top of tops) {
    options.push({ id: top.id, name: top.name });
    const subs = props.categories.filter(c => c.parent_id === top.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const sub of subs) {
      options.push({ id: sub.id, name: `  └ ${sub.name}` });
    }
  }
  for (const c of props.categories) {
    if (!options.some(o => o.id === c.id)) {
      options.push({ id: c.id, name: c.name });
    }
  }
  return options;
});

const faviconPreviewSrc = computed(() => {
  if (form.favicon) return form.favicon;
  if (form.url) {
    const u = form.url.startsWith('http') ? form.url : `https://${form.url}`;
    return `/api/favicon?url=${encodeURIComponent(u)}`;
  }
  return '';
});

watch(() => [form.favicon, form.url], () => {
  previewError.value = false;
});

watch(() => props.bookmark, (bm) => {
  if (bm) {
    form.title = bm.title || '';
    form.description = bm.description || '';
    form.url = bm.url || '';
    form.backupUrl = bm.backup_url || '';
    form.favicon = bm.favicon || '';
    form.categoryId = bm.category_id || null;
    form.isPrivate = !!bm.is_private;
    previewError.value = false;
  }
}, { immediate: true });

// AI 智能重新解析
async function fetchMeta() {
  if (!form.url) {
    ElMessage.warning('请先填写网址链接');
    return;
  }

  let url = form.url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
    form.url = url;
  }

  fetching.value = true;
  previewError.value = false;
  try {
    const { data } = await bookmarkApi.fetchMeta(url);
    const meta = data.meta;
    const aiUsed = data.aiUsed;
    const scraped = data.scraped;
    let hasTitle = false;
    let hasDesc = false;

    if (meta.title) {
      form.title = meta.title;
      hasTitle = true;
    }
    if (meta.description) {
      form.description = meta.description;
      hasDesc = true;
    }
    if (meta.favicon) form.favicon = meta.favicon;

    if (aiUsed && (hasTitle || hasDesc)) {
      ElMessage.success('AI 已智能解析并提炼标题与简介');
    } else if (scraped && (hasTitle || hasDesc)) {
      ElMessage.success('已自动抓取网站元数据并清洗');
    } else {
      ElMessage.info('受目标站点网络或防爬限制未能抓取到详情，已根据网址生成推测标题');
    }
  } catch {
    ElMessage.warning('未能获取到该网址信息，请手动填写');
  } finally {
    fetching.value = false;
  }
}

async function handleSave() {
  if (!form.title.trim() || !form.url.trim()) {
    ElMessage.warning('请填写标题和网址链接');
    return;
  }

  let finalFavicon = form.favicon.trim();
  if (!finalFavicon && form.url) {
    finalFavicon = props.bookmark?.favicon || `/api/favicon?url=${encodeURIComponent(form.url)}`;
  }

  saving.value = true;
  try {
    await bookmarkApi.update(props.bookmark.id, {
      title: form.title.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      backupUrl: form.backupUrl?.trim() || null,
      favicon: finalFavicon,
      categoryId: form.categoryId,
      isPrivate: form.isPrivate,
    });
    emit('saved');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="编辑导航链接"
    width="480px"
    align-center
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-position="top" class="space-y-3">
      <!-- 网址 + AI 智能解析 -->
      <el-form-item label="网址链接 *">
        <div class="flex gap-2 w-full">
          <el-input v-model="form.url" placeholder="https://example.com" class="flex-1" />
          <el-button
            type="primary"
            plain
            :loading="fetching"
            @click="fetchMeta"
            title="通过 AI 重新解析并提炼简洁标题与中文简介"
          >
            <span>AI 解析</span>
          </el-button>
        </div>
      </el-form-item>

      <!-- 标题 -->
      <el-form-item label="链接标题 *">
        <el-input v-model="form.title" placeholder="如：哔哩哔哩 / GitHub" />
      </el-form-item>

      <!-- 描述 -->
      <el-form-item label="网站简介">
        <el-input
          v-model="form.description"
          type="textarea"
          placeholder="网站简介（可选）"
          :rows="2"
          resize="none"
        />
      </el-form-item>

      <!-- 图标与分类 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <!-- 图标 -->
        <el-form-item label="网站图标">
          <div class="flex items-center gap-2 w-full">
            <el-input v-model="form.favicon" placeholder="图标地址 (留空将自动从网址抓取)" class="flex-1" />
            <div class="w-6 h-6 flex items-center justify-center rounded-full overflow-hidden flex-shrink-0">
              <img
                v-if="!previewError && faviconPreviewSrc"
                :src="faviconPreviewSrc"
                class="w-full h-full object-contain rounded-full"
                alt=""
                @error="previewError = true"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-white text-xs font-bold rounded-full"
                :style="{ backgroundColor: getAvatarColor(form.title || form.url) }"
              >
                {{ getAvatarChar(form.title, form.url) }}
              </div>
            </div>
          </div>
        </el-form-item>

        <!-- 分类 (二级分类带 └ 前缀) -->
        <el-form-item label="所属分类">
          <el-select v-model="form.categoryId" placeholder="选择分类" clearable class="w-full">
            <el-option
              v-for="opt in categoryOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
      </div>

      <!-- 备用链接 -->
      <el-form-item label="备用链接">
        <el-input v-model="form.backupUrl" placeholder="备用镜像链接（可选）" />
      </el-form-item>

      <!-- 私有 -->
      <el-form-item>
        <el-checkbox v-model="form.isPrivate">仅管理员登录后可见（私有书签）</el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button @click="emit('update:visible', false)">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          <el-icon class="mr-1"><component is="Check" /></el-icon>保存修改
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>
