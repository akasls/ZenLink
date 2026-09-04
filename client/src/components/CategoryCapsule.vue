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
    <div class="inline-flex items-center gap-1 p-0.5 rounded-lg bg-muted/80 border border-border/60">
      <button
        v-for="sub in subCategories"
        :key="sub.id"
        type="button"
        class="px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap"
        :class="[
          modelValue === sub.id
            ? 'bg-background text-primary font-semibold shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
        ]"
        @click="handleClick(sub.id)"
      >
        {{ sub.name }}
      </button>
    </div>
  </div>
</template>

