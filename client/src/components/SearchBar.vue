<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useSiteStore } from '@/stores/site';

const modelValue = defineModel<string>({ default: '' });
const siteStore = useSiteStore();

interface SearchEngine {
  id: string;
  name: string;
  placeholder: string;
  url: string;
}

const searchEngines: SearchEngine[] = [
  { id: 'google', name: '谷歌', placeholder: 'Google搜索...', url: 'https://www.google.com/search?q=' },
  { id: 'bing', name: '必应', placeholder: 'Bing搜索...', url: 'https://cn.bing.com/search?q=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', placeholder: 'DuckDuckGo搜索...', url: 'https://duckduckgo.com/?t=h_&q=' },
];

const selectedEngine = ref<SearchEngine>(
  searchEngines.find(e => e.id === siteStore.defaultEngine) || searchEngines[0]
);
const fxCanvasRef = ref<HTMLCanvasElement | null>(null);
let animFrameId: number | null = null;

const isCustomBg = computed(() => {
  return siteStore.searchBgMode === 'custom_image' && !!siteStore.searchBgImage;
});

const customBgStyle = computed(() => {
  if (isCustomBg.value) {
    return {
      backgroundImage: `url(${siteStore.searchBgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  return {};
});

function selectEngine(engine: SearchEngine) {
  selectedEngine.value = engine;
}

function handleSearch() {
  const q = modelValue.value.trim();
  if (!q) return;
  if (q.startsWith('http://') || q.startsWith('https://') || (q.includes('.') && !q.includes(' '))) {
    window.open(q.startsWith('http') ? q : `https://${q}`, '_blank', 'noopener');
    return;
  }
  window.open(selectedEngine.value.url + encodeURIComponent(q), '_blank', 'noopener');
}

// ===== FX 15: 3D Ocean Wave Canvas 效果 =====
function initOceanFx(canvasEl: HTMLCanvasElement) {
  if (isCustomBg.value) return;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  const postctx = canvasEl.getContext('2d');
  if (!postctx) return;
  const offscreenCanvas = document.createElement('canvas');
  const c = offscreenCanvas.getContext('2d');
  if (!c) return;

  const targetCtx: CanvasRenderingContext2D = postctx;
  const drawCtx: CanvasRenderingContext2D = c;

  const vertexCount = 1800;
  const vertexSize = 3.2;
  const oceanWidth = 100;
  const oceanHeight = -45;
  const gridSize = 32;
  const waveSize = 18;
  const perspective = 85;

  const depth = (vertexCount / oceanWidth) * gridSize;
  let frame = 0;
  const { sin, cos, PI } = Math;

  const vertices: [number, number, number][] = [];
  for (let i = 0; i < vertexCount; i++) {
    const x = i % oceanWidth;
    const y = 0;
    const z = Math.floor(i / oceanWidth);
    const offset = oceanWidth / 2;
    vertices.push([(-offset + x) * gridSize, y * gridSize, z * gridSize]);
  }

  function render() {
    if (isCustomBg.value) return;

    const w = canvasEl.offsetWidth || 800;
    const h = canvasEl.offsetHeight || 240;
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = offscreenCanvas.width = w;
      canvasEl.height = offscreenCanvas.height = h;
    }

    const rad = (sin(frame / 100) * PI) / 20;
    const rad2 = (sin(frame / 50) * PI) / 10;
    frame++;

    drawCtx.fillStyle = 'hsl(204deg, 100%, 3%)';
    drawCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    drawCtx.save();
    drawCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height / 2);

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      let x = vertex[0] - (frame % (gridSize * 2));
      let z = vertex[2] - ((frame * 2) % gridSize) + (i % 2 === 0 ? gridSize / 2 : 0);
      const wave = cos(frame / 45 + x / 50) - sin(frame / 20 + z / 50) + sin(frame / 30 + (z * x) / 10000);
      let y = vertex[1] + wave * waveSize;
      const a = Math.max(0.08, 1 - Math.sqrt(x ** 2 + z ** 2) / depth);

      y -= oceanHeight;

      // Rotation Y
      let tx = x * cos(rad) + z * sin(rad);
      let tz = -x * sin(rad) + z * cos(rad);
      let ty = y;
      x = tx; y = ty; z = tz;

      // Rotation Z
      tx = x * cos(rad) - y * sin(rad);
      ty = x * sin(rad) + y * cos(rad);
      x = tx; y = ty; z = tz;

      // Rotation X
      ty = y * cos(rad2) - z * sin(rad2);
      tz = y * sin(rad2) + z * cos(rad2);
      x = tx; y = ty; z = tz;

      if (z <= 0) continue;

      x /= z / perspective;
      y /= z / perspective;

      if (a < 0.01) continue;

      drawCtx.globalAlpha = a;
      drawCtx.fillStyle = `hsl(${170 + wave * 25}deg, 100%, 60%)`;
      drawCtx.fillRect(x - (a * vertexSize) / 2, y - (a * vertexSize) / 2, a * vertexSize, a * vertexSize);
    }
    drawCtx.restore();

    targetCtx.clearRect(0, 0, w, h);
    targetCtx.drawImage(offscreenCanvas, 0, 0);

    animFrameId = requestAnimationFrame(render);
  }

  render();
}

watch(
  () => [siteStore.searchBgMode, siteStore.searchBgImage],
  () => {
    if (!isCustomBg.value && fxCanvasRef.value) {
      initOceanFx(fxCanvasRef.value);
    } else if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }
);

onMounted(() => {
  if (fxCanvasRef.value && !isCustomBg.value) {
    initOceanFx(fxCanvasRef.value);
  }
});

onUnmounted(() => {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
  }
});
</script>

<template>
  <div
    class="w-full py-7 md:py-10 px-4 flex flex-col items-center justify-center border-b border-slate-200/80 dark:border-slate-800 relative transition-colors"
    :class="[
      isCustomBg
        ? 'bg-slate-900/90 text-white'
        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
    ]"
    :style="customBgStyle"
  >
    <!-- 背景遮罩 (仅在自定义背景图时启用) -->
    <div v-if="isCustomBg" class="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"></div>

    <div class="relative z-10 w-full max-w-xl flex flex-col items-center gap-3">
      <!-- 搜索引擎切换 Tabs (精简小型圆角) -->
      <div
        class="flex items-center gap-1 p-0.5 rounded-md border"
        :class="[
          isCustomBg
            ? 'bg-slate-900/70 border-white/15'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200/60 dark:border-slate-700/60'
        ]"
      >
        <button
          v-for="eng in searchEngines"
          :key="eng.id"
          type="button"
          class="px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer"
          :class="[
            selectedEngine.id === eng.id
              ? (isCustomBg
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs')
              : (isCustomBg
                  ? 'text-slate-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100')
          ]"
          @click="selectEngine(eng)"
        >
          {{ eng.name }}
        </button>
      </div>

      <!-- 搜索框 (克制 8px 圆角 + 4px 网格) -->
      <div
        class="w-full flex items-center rounded-lg border shadow-subtle transition-all duration-150 p-1"
        :class="[
          isCustomBg
            ? 'bg-white/15 border-white/25 focus-within:border-white/50 focus-within:bg-white/20'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800 focus-within:border-indigo-500/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-500/10'
        ]"
      >
        <div class="pl-2.5 pr-1 text-slate-400 dark:text-slate-500 flex items-center">
          <el-icon class="text-sm"><component is="Search" /></el-icon>
        </div>
        <input
          v-model="modelValue"
          type="text"
          class="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none min-w-0"
          :class="[
            isCustomBg
              ? 'text-white placeholder-slate-300'
              : 'text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500'
          ]"
          :placeholder="selectedEngine.placeholder || `在 ${selectedEngine.name} 中搜索...`"
          @keyup.enter="handleSearch"
          autocomplete="off"
        />
        <button
          type="button"
          class="h-7 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer flex-shrink-0"
          :class="[
            isCustomBg
              ? 'bg-white text-slate-900 hover:bg-slate-100 font-semibold'
              : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
          ]"
          @click="handleSearch"
          title="搜索 (Enter)"
        >
          <span>搜索</span>
        </button>
      </div>
    </div>
  </div>
</template>
