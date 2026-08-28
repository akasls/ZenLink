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
  <div v-if="subCategories.length" class="category-capsule-wrapper">
    <div class="category-capsule">
      <button
        v-for="sub in subCategories"
        :key="sub.id"
        type="button"
        class="category-capsule-item"
        :class="{ active: modelValue === sub.id }"
        @click="handleClick(sub.id)"
      >
        {{ sub.name }}
      </button>
    </div>
  </div>
</template>
