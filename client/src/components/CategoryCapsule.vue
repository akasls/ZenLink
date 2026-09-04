<script setup lang="ts">
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

function onTabChange(val: string | number) {
  const id = Number(val);
  emit('update:modelValue', id);
  emit('select', id);
}
</script>

<template>
  <div v-if="subCategories.length" class="w-full overflow-x-auto scrollbar-none pb-1 -mt-1">
    <Tabs :model-value="modelValue ? String(modelValue) : undefined" @update:model-value="onTabChange">
      <TabsList class="h-8 p-0.5 bg-muted/80 border border-border/60">
        <TabsTrigger
          v-for="sub in subCategories"
          :key="sub.id"
          :value="String(sub.id)"
          class="h-7 px-2.5 text-xs whitespace-nowrap"
        >
          {{ sub.name }}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
</template>
