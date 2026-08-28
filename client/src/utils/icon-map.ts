/**
 * PrimeIcons → Element Plus Icons 映射表
 * 数据库中存储的图标格式为 "pi pi-xxx"，需要映射为 Element Plus 图标组件名
 */
const iconMap: Record<string, string> = {
  // 文件/文件夹
  'pi pi-folder': 'Folder',
  'pi pi-folder-open': 'FolderOpened',
  'pi pi-file': 'Document',
  'pi pi-file-edit': 'EditPen',
  'pi pi-file-pdf': 'Document',
  'pi pi-file-excel': 'Document',

  // 导航/通用
  'pi pi-home': 'HomeFilled',
  'pi pi-bookmark': 'CollectionTag',
  'pi pi-book': 'Reading',
  'pi pi-globe': 'ChromeFilled',
  'pi pi-link': 'Link',
  'pi pi-external-link': 'Link',

  // 开发
  'pi pi-code': 'Monitor',
  'pi pi-desktop': 'Monitor',
  'pi pi-mobile': 'Cellphone',
  'pi pi-tablet': 'Cellphone',
  'pi pi-server': 'Cpu',
  'pi pi-database': 'Coin',
  'pi pi-microchip': 'Cpu',

  // 工具
  'pi pi-wrench': 'SetUp',
  'pi pi-cog': 'Setting',
  'pi pi-bolt': 'Lightning',
  'pi pi-shield': 'Lock',
  'pi pi-lock': 'Lock',
  'pi pi-unlock': 'Unlock',
  'pi pi-key': 'Key',
  'pi pi-hammer': 'SetUp',

  // 用户
  'pi pi-user': 'User',
  'pi pi-users': 'UserFilled',

  // 媒体
  'pi pi-image': 'Picture',
  'pi pi-images': 'PictureFilled',
  'pi pi-camera': 'Camera',
  'pi pi-video': 'VideoCamera',
  'pi pi-play': 'VideoPlay',
  'pi pi-microphone': 'Microphone',
  'pi pi-volume-up': 'Headset',
  'pi pi-headphones': 'Headset',
  'pi pi-music': 'Headset',

  // 通信
  'pi pi-inbox': 'Message',
  'pi pi-send': 'Promotion',
  'pi pi-envelope': 'Message',
  'pi pi-comment': 'ChatDotRound',
  'pi pi-comments': 'ChatLineSquare',
  'pi pi-phone': 'Phone',
  'pi pi-bell': 'Bell',
  'pi pi-megaphone': 'Bell',

  // 图表
  'pi pi-chart-bar': 'DataAnalysis',
  'pi pi-chart-line': 'TrendCharts',
  'pi pi-chart-pie': 'PieChart',
  'pi pi-table': 'Grid',

  // 布局
  'pi pi-list': 'List',
  'pi pi-th-large': 'Grid',

  // 设计
  'pi pi-palette': 'Brush',

  // 天气/自然
  'pi pi-sun': 'Sunny',
  'pi pi-moon': 'Moon',
  'pi pi-cloud': 'Cloudy',
  'pi pi-cloud-upload': 'Upload',
  'pi pi-cloud-download': 'Download',

  // 情感
  'pi pi-heart': 'Star',
  'pi pi-star': 'Star',
  'pi pi-star-fill': 'StarFilled',

  // 地图/位置
  'pi pi-map': 'MapLocation',
  'pi pi-map-marker': 'Location',

  // 购物/金融
  'pi pi-shopping-cart': 'ShoppingCart',
  'pi pi-shopping-bag': 'GoodsFilled',
  'pi pi-wallet': 'Wallet',
  'pi pi-money-bill': 'Money',
  'pi pi-credit-card': 'Postcard',
  'pi pi-car': 'Van',
  'pi pi-truck': 'Van',

  // 标签/标记
  'pi pi-gift': 'Present',
  'pi pi-tag': 'PriceTag',
  'pi pi-tags': 'PriceTag',
  'pi pi-flag': 'Flag',
  'pi pi-flag-fill': 'Flag',

  // 时间
  'pi pi-calendar': 'Calendar',
  'pi pi-clock': 'Clock',
  'pi pi-stopwatch': 'Timer',
  'pi pi-history': 'RefreshLeft',

  // 教育/工作
  'pi pi-graduation-cap': 'School',
  'pi pi-building': 'OfficeBuilding',
  'pi pi-briefcase': 'Suitcase',

  // 操作
  'pi pi-search': 'Search',
  'pi pi-filter': 'Filter',
  'pi pi-sort': 'Sort',
  'pi pi-download': 'Download',
  'pi pi-upload': 'Upload',
  'pi pi-share-alt': 'Share',
  'pi pi-sync': 'Refresh',
  'pi pi-refresh': 'Refresh',
  'pi pi-undo': 'RefreshLeft',
  'pi pi-trash': 'Delete',
  'pi pi-pencil': 'Edit',
  'pi pi-plus': 'Plus',
  'pi pi-minus': 'Minus',
  'pi pi-check': 'Check',
  'pi pi-times': 'Close',
  'pi pi-eye': 'View',

  // 信息
  'pi pi-info-circle': 'InfoFilled',
  'pi pi-question-circle': 'QuestionFilled',
  'pi pi-exclamation-triangle': 'WarningFilled',

  // 其他
  'pi pi-box': 'Box',
  'pi pi-receipt': 'Tickets',
  'pi pi-sparkles': 'MagicStick',
  'pi pi-verified': 'CircleCheckFilled',
  'pi pi-trophy': 'Trophy',
  'pi pi-thumbs-up': 'Pointer',
  'pi pi-wifi': 'Connection',
};

/**
 * 将 PrimeIcons 类名转换为 Element Plus 图标组件名
 * @param piClass - PrimeIcons 类名，如 "pi pi-folder"
 * @returns Element Plus 图标组件名，如 "Folder"
 */
export function mapIcon(piClass: string): string {
  if (!piClass) return 'Folder';
  return iconMap[piClass] || 'Folder';
}

export default iconMap;
