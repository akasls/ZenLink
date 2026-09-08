<script setup lang="ts">
interface Category {
  id: number;
  name: string;
  icon?: string;
  is_private?: number;
  parent_id?: number | null;
}

const props = defineProps<{
  subCategories: Category[];
  modelValue?: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [id: number | null];
  select: [id: number];
}>();

function onSelect(id: number) {
  emit('update:modelValue', id);
  emit('select', id);
}
</script>

<template>
  <div
    v-if="subCategories.length"
    class="w-full overflow-x-auto no-scrollbar scrollbar-none py-1 -mt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    style="scrollbar-width: none; -ms-overflow-style: none;"
  >
    <!-- 大背景胶囊容器 (包裹所有二级分类，min-w-max 确保在任何屏幕宽度下都完整覆盖所有分类) -->
    <div class="inline-flex items-center p-1 rounded-full bg-muted/70 border border-border/50 gap-1 min-w-max shrink-0">
      <button
        v-for="sub in subCategories"
        :key="sub.id"
        type="button"
        class="h-7 px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer select-none flex items-center justify-center shrink-0"
        :class="
          modelValue === sub.id
            ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        "
        @click="onSelect(sub.id)"
      >
        <span>{{ sub.name }}</span>
      </button>
    </div>
  </div>
</template>
