import { ref } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export const confirmState = ref<ConfirmState | null>(null);

export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions =
    typeof options === 'string'
      ? { message: options, title: '提示' }
      : { title: '提示', ...options };

  return new Promise<boolean>((resolve) => {
    confirmState.value = {
      open: true,
      options: opts,
      resolve: (val: boolean) => {
        if (confirmState.value) {
          confirmState.value.open = false;
        }
        resolve(val);
      },
    };
  });
}

/**
 * Compatible with ElMessageBox.confirm signature:
 * Throws when cancelled so that `try { await confirmBox(...) } catch {}` works identically.
 */
export async function confirmBox(
  message: string,
  title = '提示',
  _unusedConfig?: any
): Promise<void> {
  const ok = await confirm({
    title,
    message,
    confirmText: '确定',
    cancelText: '取消',
    destructive: true,
  });
  if (!ok) {
    throw new Error('cancel');
  }
}
