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

function handleClick(subId: number) {
  emit('update:modelValue', subId);
  emit('select', subId);
}
</script>

<template>
  <div v-if="subCategories.length" class="w-full overflow-x-auto scrollbar-none pb-1 -mt-1">
    <div class="inline-flex items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
      <button
        v-for="sub in subCategories"
        :key="sub.id"
        type="button"
        class="px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap"
        :class="[
          modelValue === sub.id
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/50'
        ]"
        @click="handleClick(sub.id)"
      >
        {{ sub.name }}
      </button>
    </div>
  </div>
</template>

