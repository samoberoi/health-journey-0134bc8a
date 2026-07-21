import * as Iconoir from "iconoir-react";
import { forwardRef } from "react";
import Avocado from "@/components/icons/Avocado";

/**
 * Central icon component — uniform stroke, one import site.
 * Add new icons here and reference them by name across the app.
 */
const map = {
  home: Iconoir.Home,
  utensils: Iconoir.OrganicFood,
  restaurant: Iconoir.OrganicFood,
  activity: Iconoir.Activity,
  dumbbell: Iconoir.Gym,
  running: Iconoir.Running,
  yoga: Iconoir.Yoga,
  walk: Iconoir.Walking,
  message: Iconoir.ChatLines,
  chat: Iconoir.ChatBubble,
  video: Iconoir.PlaySolid,
  play: Iconoir.PlaySolid,
  users: Iconoir.Community,
  community: Iconoir.Community,
  user: Iconoir.User,
  profile: Iconoir.User,
  bell: Iconoir.Bell,
  search: Iconoir.Search,
  plus: Iconoir.Plus,
  minus: Iconoir.Minus,
  arrowUpRight: Iconoir.ArrowUpRight,
  arrowRight: Iconoir.ArrowRight,
  arrowLeft: Iconoir.ArrowLeft,
  chevronLeft: Iconoir.NavArrowLeft,
  chevronRight: Iconoir.NavArrowRight,
  chevronDown: Iconoir.NavArrowDown,
  chevronUp: Iconoir.NavArrowUp,
  close: Iconoir.Xmark,
  check: Iconoir.Check,
  calendar: Iconoir.Calendar,
  clock: Iconoir.Clock,
  target: Iconoir.IrisScan,
  flame: Iconoir.FireFlame,
  heart: Iconoir.Heart,
  moon: Iconoir.HalfMoon,
  drop: Iconoir.Droplet,
  water: Iconoir.Droplet,
  scale: Iconoir.Weight,
  weight: Iconoir.WeightAlt,
  pill: Iconoir.PharmacyCrossCircle,
  stethoscope: Iconoir.HealthShield,
  chart: Iconoir.StatsUpSquare,
  chartUp: Iconoir.StatsUpSquare,
  chartDown: Iconoir.StatsDownSquare,
  bookmark: Iconoir.Bookmark,
  filter: Iconoir.FilterAlt,
  settings: Iconoir.Settings,
  logout: Iconoir.LogOut,
  refresh: Iconoir.Refresh,
  camera: Iconoir.Camera,
  more: Iconoir.MoreHoriz,
  menu: Iconoir.Menu,
  edit: Iconoir.Edit,
  trash: Iconoir.Trash,
  info: Iconoir.InfoCircle,
  warning: Iconoir.WarningTriangle,
  star: Iconoir.Star,
  award: Iconoir.MedalSolid,
  medal: Iconoir.MedalSolid,
  gift: Iconoir.Gift,
  lock: Iconoir.Lock,
  eye: Iconoir.Eye,
  eyeOff: Iconoir.EyeClosed,
  phone: Iconoir.Phone,
  mail: Iconoir.Mail,
  send: Iconoir.Send,
  mic: Iconoir.MicrophoneSolid,
  globe: Iconoir.Globe,
  map: Iconoir.Map,
  location: Iconoir.MapPin,
  bag: Iconoir.ShoppingBag,
  sun: Iconoir.SunLight,
  sleep: Iconoir.HalfMoon,
  brain: Iconoir.Brain,
  leaf: Iconoir.Leaf,
  apple: Iconoir.Apple,
  sparkle: Iconoir.Sparks,
  bolt: Iconoir.Flash,
  shield: Iconoir.Shield,
  book: Iconoir.Book,
  bookOpen: Iconoir.BookmarkBook,
  headphones: Iconoir.Headset,
  helpCircle: Iconoir.HelpCircle,
  qrCode: Iconoir.QrCode,
} as const;

export type AppIconName = keyof typeof map;

interface AppIconProps extends React.SVGProps<SVGSVGElement> {
  name: AppIconName;
  size?: number | string;
}

export const AppIcon = forwardRef<SVGSVGElement, AppIconProps>(
  ({ name, size = 20, className, strokeWidth = 1.6, ...props }, ref) => {
    if (name === "utensils" || name === "restaurant" || name === "apple") {
      return <Avocado ref={ref as any} size={size} className={className} strokeWidth={strokeWidth} {...(props as any)} /> as any;
    }
    const Cmp = (map[name] ?? Iconoir.QuestionMark) as any;
    return (
      <Cmp
        ref={ref}
        width={size}
        height={size}
        strokeWidth={strokeWidth}
        className={className}
        {...props}
      />
    );
  },
);
AppIcon.displayName = "AppIcon";
