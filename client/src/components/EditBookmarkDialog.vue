<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { bookmarkApi } from '@/api';
import { getAvatarChar, getAvatarColor } from '@/utils/avatar';
import { toast } from '@/components/ui/sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2, Check } from 'lucide-vue-next';

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

const categoryStringValue = computed({
  get: () => (form.categoryId != null ? String(form.categoryId) : 'none'),
  set: (val: string) => {
    form.categoryId = val === 'none' ? null : Number(val);
  },
});

// 带有 └ 标记的二级分类层级选项
const categoryOptions = computed(() => {
  const options: { id: number; name: string }[] = [];
  const tops = props.categories.filter((c) => !c.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  for (const top of tops) {
    options.push({ id: top.id, name: top.name });
    const subs = props.categories.filter((c) => c.parent_id === top.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const sub of subs) {
      options.push({ id: sub.id, name: `  └ ${sub.name}` });
    }
  }
  for (const c of props.categories) {
    if (!options.some((o) => o.id === c.id)) {
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

watch(
  () => [form.favicon, form.url],
  () => {
    previewError.value = false;
  }
);

watch(
  () => props.bookmark,
  (bm) => {
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
  },
  { immediate: true }
);

// AI 智能重新解析
async function fetchMeta() {
  if (!form.url) {
    toast.warning('请先填写网址链接');
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
      toast.success('AI 已智能解析并提炼标题与简介');
    } else if (scraped && (hasTitle || hasDesc)) {
      toast.success('已自动抓取网站元数据并清洗');
    } else {
      toast.info('受目标站点限制未能抓取到详情，已推测生成标题');
    }
  } catch {
    toast.warning('未能获取到该网址信息，请手动填写');
  } finally {
    fetching.value = false;
  }
}

async function handleSave() {
  if (!form.title.trim() || !form.url.trim()) {
    toast.warning('请填写标题和网址链接');
    return;
  }

  let u = form.url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'https://' + u;
    form.url = u;
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
    toast.success('修改成功');
    emit('saved');
  } catch (err: any) {
    toast.error(err.response?.data?.error || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>编辑导航链接</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <!-- 网址 + AI 智能解析 -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground/80">网址链接 <span class="text-destructive">*</span></label>
          <div class="flex gap-2">
            <Input v-model="form.url" placeholder="https://example.com" class="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="fetching"
              class="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              @click="fetchMeta"
              title="通过 AI 重新解析并提炼简洁标题与中文简介"
            >
              <Loader2 v-if="fetching" class="h-4 w-4 animate-spin" />
              <Sparkles v-else class="h-4 w-4 text-primary" />
              <span>AI 解析</span>
            </Button>
          </div>
        </div>

        <!-- 标题 -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground/80">链接标题 <span class="text-destructive">*</span></label>
          <Input v-model="form.title" placeholder="如：哔哩哔哩 / GitHub" />
        </div>

        <!-- 描述 -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground/80">网站简介</label>
          <Textarea
            v-model="form.description"
            placeholder="网站简介（可选）"
            :rows="2"
            class="resize-none"
          />
        </div>

        <!-- 图标与分类 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- 图标 -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground/80">网站图标</label>
            <div class="flex items-center gap-2">
              <Input
                v-model="form.favicon"
                placeholder="留空自动抓取"
                class="flex-1 text-xs"
              />
              <div class="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-muted/40 overflow-hidden shrink-0">
                <img
                  v-if="!previewError && faviconPreviewSrc"
                  :src="faviconPreviewSrc"
                  class="w-5 h-5 object-contain"
                  alt=""
                  @error="previewError = true"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                  :style="{ backgroundColor: getAvatarColor(form.title || form.url) }"
                >
                  {{ getAvatarChar(form.title, form.url) }}
                </div>
              </div>
            </div>
          </div>

          <!-- 分类 -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground/80">所属分类</label>
            <Select v-model="categoryStringValue">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分类</SelectItem>
                <SelectItem
                  v-for="opt in categoryOptions"
                  :key="opt.id"
                  :value="String(opt.id)"
                >
                  {{ opt.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- 备用链接 -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground/80">备用链接</label>
          <Input v-model="form.backupUrl" placeholder="备用镜像链接（可选）" />
        </div>

        <!-- 私有开关 -->
        <div class="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3">
          <div class="space-y-0.5">
            <div class="text-sm font-medium">仅管理员可见</div>
            <div class="text-xs text-muted-foreground">作为私有导航书签，未登录访客将不可见</div>
          </div>
          <Switch :checked="form.isPrivate" @update:checked="form.isPrivate = $event" />
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="emit('update:visible', false)">取消</Button>
        <Button :disabled="saving" class="gap-1.5" @click="handleSave">
          <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
          <Check v-else class="h-4 w-4" />
          <span>保存修改</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
