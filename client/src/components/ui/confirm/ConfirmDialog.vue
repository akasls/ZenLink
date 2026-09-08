<script setup lang="ts">
import { confirmState } from '@/utils/confirm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function onConfirm() {
  if (confirmState.value) {
    confirmState.value.resolve(true);
  }
}

function onCancel() {
  if (confirmState.value) {
    confirmState.value.resolve(false);
  }
}

function onOpenChange(val: boolean) {
  if (!val && confirmState.value) {
    confirmState.value.resolve(false);
  }
}
</script>

<template>
  <Dialog
    v-if="confirmState"
    :open="confirmState.open"
    @update:open="onOpenChange"
  >
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>{{ confirmState.options.title || '提示' }}</DialogTitle>
        <DialogDescription class="pt-2 text-xs leading-relaxed text-foreground/80">
          {{ confirmState.options.message }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 pt-2">
        <Button variant="outline" size="sm" @click="onCancel">
          {{ confirmState.options.cancelText || '取消' }}
        </Button>
        <Button
          :variant="confirmState.options.destructive !== false ? 'destructive' : 'default'"
          size="sm"
          @click="onConfirm"
        >
          {{ confirmState.options.confirmText || '确定' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
