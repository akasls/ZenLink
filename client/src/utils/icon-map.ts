import type { Component } from 'vue';
import {
  Folder, FolderOpen, Bookmark, BookOpen,
  Code, Monitor, Smartphone, Tablet,
  Globe, Link, ExternalLink, Home,
  Wrench, Settings, Zap, Shield,
  Lock, Unlock, Key, User,
  Users, Heart, Star,
  Sun, Moon, Cloud, CloudUpload,
  CloudDownload, Database, Server, Wifi,
  BarChart2, LineChart, PieChart, Table,
  List, LayoutGrid, Palette, Image,
  Camera, Video, Play,
  Mic, Volume2, Headphones, Music,
  FileText, FileEdit,
  Inbox, Send, Mail, MessageSquare,
  MessagesSquare, Phone, Map, MapPin,
  Car, ShoppingCart, ShoppingBag, Wallet,
  Banknote, CreditCard, Gift, Tag,
  Tags, Flag, Megaphone,
  Bell, Calendar, Clock, Timer,
  GraduationCap, Building2, Briefcase, Hammer,
  Cpu, Package, Truck, Receipt,
  Sparkles, CheckCircle2, Trophy, ThumbsUp,
  Eye, Search, Filter, ArrowUpDown,
  Download, Upload, Share2, RefreshCw,
  RotateCcw, History, Trash2,
  Pencil, Plus, Minus, Check,
  X, Info, HelpCircle, AlertTriangle,
} from 'lucide-vue-next';

/**
 * PrimeIcons 类名 → Lucide Icons Vue 组件映射表
 * 数据库中存储的图标格式为 "pi pi-xxx"，映射为 Lucide 组件
 */
const iconComponentMap: Record<string, Component> = {
  // 文件/文件夹
  'pi pi-folder': Folder,
  'pi pi-folder-open': FolderOpen,
  'pi pi-file': FileText,
  'pi pi-file-edit': FileEdit,
  'pi pi-file-pdf': FileText,
  'pi pi-file-excel': FileText,

  // 导航/通用
  'pi pi-home': Home,
  'pi pi-bookmark': Bookmark,
  'pi pi-book': BookOpen,
  'pi pi-globe': Globe,
  'pi pi-link': Link,
  'pi pi-external-link': ExternalLink,

  // 开发
  'pi pi-code': Code,
  'pi pi-desktop': Monitor,
  'pi pi-mobile': Smartphone,
  'pi pi-tablet': Tablet,
  'pi pi-server': Server,
  'pi pi-database': Database,
  'pi pi-microchip': Cpu,

  // 工具
  'pi pi-wrench': Wrench,
  'pi pi-cog': Settings,
  'pi pi-bolt': Zap,
  'pi pi-shield': Shield,
  'pi pi-lock': Lock,
  'pi pi-unlock': Unlock,
  'pi pi-key': Key,
  'pi pi-hammer': Hammer,

  // 用户
  'pi pi-user': User,
  'pi pi-users': Users,

  // 媒体
  'pi pi-image': Image,
  'pi pi-images': Image,
  'pi pi-camera': Camera,
  'pi pi-video': Video,
  'pi pi-play': Play,
  'pi pi-microphone': Mic,
  'pi pi-volume-up': Volume2,
  'pi pi-headphones': Headphones,
  'pi pi-music': Music,

  // 通信
  'pi pi-inbox': Inbox,
  'pi pi-send': Send,
  'pi pi-envelope': Mail,
  'pi pi-comment': MessageSquare,
  'pi pi-comments': MessagesSquare,
  'pi pi-phone': Phone,
  'pi pi-bell': Bell,
  'pi pi-megaphone': Megaphone,

  // 图表
  'pi pi-chart-bar': BarChart2,
  'pi pi-chart-line': LineChart,
  'pi pi-chart-pie': PieChart,
  'pi pi-table': Table,

  // 布局
  'pi pi-list': List,
  'pi pi-th-large': LayoutGrid,

  // 设计
  'pi pi-palette': Palette,

  // 天气/自然
  'pi pi-sun': Sun,
  'pi pi-moon': Moon,
  'pi pi-cloud': Cloud,
  'pi pi-cloud-upload': CloudUpload,
  'pi pi-cloud-download': CloudDownload,

  // 情感
  'pi pi-heart': Heart,
  'pi pi-star': Star,
  'pi pi-star-fill': Star,

  // 地图/位置
  'pi pi-map': Map,
  'pi pi-map-marker': MapPin,

  // 购物/金融
  'pi pi-shopping-cart': ShoppingCart,
  'pi pi-shopping-bag': ShoppingBag,
  'pi pi-wallet': Wallet,
  'pi pi-money-bill': Banknote,
  'pi pi-credit-card': CreditCard,
  'pi pi-car': Car,
  'pi pi-truck': Truck,

  // 标签/标记
  'pi pi-gift': Gift,
  'pi pi-tag': Tag,
  'pi pi-tags': Tags,
  'pi pi-flag': Flag,
  'pi pi-flag-fill': Flag,

  // 时间
  'pi pi-calendar': Calendar,
  'pi pi-clock': Clock,
  'pi pi-stopwatch': Timer,
  'pi pi-history': History,

  // 教育/工作
  'pi pi-graduation-cap': GraduationCap,
  'pi pi-building': Building2,
  'pi pi-briefcase': Briefcase,

  // 操作
  'pi pi-search': Search,
  'pi pi-filter': Filter,
  'pi pi-sort': ArrowUpDown,
  'pi pi-download': Download,
  'pi pi-upload': Upload,
  'pi pi-share-alt': Share2,
  'pi pi-sync': RefreshCw,
  'pi pi-refresh': RefreshCw,
  'pi pi-undo': RotateCcw,
  'pi pi-trash': Trash2,
  'pi pi-pencil': Pencil,
  'pi pi-plus': Plus,
  'pi pi-minus': Minus,
  'pi pi-check': Check,
  'pi pi-times': X,
  'pi pi-eye': Eye,

  // 信息
  'pi pi-info-circle': Info,
  'pi pi-question-circle': HelpCircle,
  'pi pi-exclamation-triangle': AlertTriangle,

  // 其他
  'pi pi-box': Package,
  'pi pi-receipt': Receipt,
  'pi pi-sparkles': Sparkles,
  'pi pi-verified': CheckCircle2,
  'pi pi-trophy': Trophy,
  'pi pi-thumbs-up': ThumbsUp,
  'pi pi-wifi': Wifi,
};

const lucideByName: Record<string, Component> = {
  Folder, FolderOpen, Bookmark, BookOpen,
  Code, Monitor, Smartphone, Tablet,
  Globe, Link, ExternalLink, Home,
  Wrench, Settings, Zap, Shield,
  Lock, Unlock, Key, User,
  Users, Heart, Star,
  Sun, Moon, Cloud, CloudUpload,
  CloudDownload, Database, Server, Wifi,
  BarChart2, LineChart, PieChart, Table,
  List, LayoutGrid, Palette, Image,
  Camera, Video, Play,
  Mic, Volume2, Headphones, Music,
  FileText, FileEdit,
  Inbox, Send, Mail, MessageSquare,
  MessagesSquare, Phone, Map, MapPin,
  Car, ShoppingCart, ShoppingBag, Wallet,
  Banknote, CreditCard, Gift, Tag,
  Tags, Flag, Megaphone,
  Bell, Calendar, Clock, Timer,
  GraduationCap, Building2, Briefcase, Hammer,
  Cpu, Package, Truck, Receipt,
  Sparkles, CheckCircle2, Trophy, ThumbsUp,
  Eye, Search, Filter, ArrowUpDown,
  Download, Upload, Share2, RefreshCw,
  RotateCcw, History, Trash2,
  Pencil, Plus, Minus, Check,
  X, Info, HelpCircle, AlertTriangle,
};

/**
 * 将 PrimeIcons 类名或 Lucide 图标名转换为 Lucide Vue 图标组件
 * @param iconName - 图标类名或名称，如 "pi pi-folder" 或 "BookOpen"
 * @returns Lucide Vue 图标组件
 */
export function mapIcon(iconName: string): Component {
  if (!iconName) return Folder;
  if (iconComponentMap[iconName]) return iconComponentMap[iconName];
  if (lucideByName[iconName]) return lucideByName[iconName];
  return Folder;
}

export default iconComponentMap;

