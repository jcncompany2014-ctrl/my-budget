import type { CSSProperties } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Car,
  Coffee,
  CreditCard,
  Cross,
  Dog,
  DoorOpen,
  FileText,
  Film,
  Gift,
  Heart,
  Home,
  Landmark,
  Laptop,
  type LucideIcon,
  Megaphone,
  Package,
  Paperclip,
  PiggyBank,
  Plane,
  Repeat,
  Shield,
  ShoppingBag,
  Sparkles,
  Train,
  Users,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';

/**
 * Lucide-icon mapping for every category id.
 *
 * Outline icons render at strokeWidth 2.2 inside a tinted circle that
 * uses the category's brand color at 18% opacity for the background and
 * 100% for the stroke. Gives a consistent, modern look across the app.
 *
 * For unknown categories (custom ones added by the user), falls back to
 * the existing emoji from CATEGORIES — keeps backwards compatibility.
 */

const ICONS: Record<string, LucideIcon> = {
  // Personal expense
  food: UtensilsCrossed,
  cafe: Coffee,
  transit: Train,
  shopping: ShoppingBag,
  living: Home,
  health: Cross,
  beauty: Sparkles,
  culture: Film,
  pet: Dog,
  travel: Plane,
  education: BookOpen,
  subs: Repeat,
  transfer: ArrowLeftRight,
  saving: PiggyBank,

  // Personal income
  salary: Briefcase,
  bonus: Gift,
  side: Laptop,
  interest: Landmark,
  refund: ArrowDownLeft,
  gift: Heart,
  income: Banknote,

  // Business expense
  biz_purchase: Package,
  biz_rent: Building2,
  biz_payroll: Users,
  biz_utility: Zap,
  biz_marketing: Megaphone,
  biz_supplies: Paperclip,
  biz_meal: Utensils,
  biz_travel: Car,
  biz_insurance: Shield,
  biz_tax: FileText,
  biz_fee: CreditCard,
  biz_etc: Wallet,
  biz_transfer: ArrowLeftRight,
  biz_owner_draw: DoorOpen,

  // Business income
  biz_sales_card: CreditCard,
  biz_sales_cash: Banknote,
  biz_sales_xfer: Landmark,
  biz_sales_app: Bike,
  biz_other: ArrowUpRight,
  biz_capital: Briefcase,
  owner_pay: Banknote,
};

export default function CategoryIcon({
  catId,
  size = 36,
  fontSize,
  style,
  /** When true, renders just the icon (no circle background) — for nav-style use. */
  bare = false,
}: {
  catId: string;
  size?: number;
  fontSize?: number;
  style?: CSSProperties;
  bare?: boolean;
}) {
  const cat = CATEGORIES[catId];
  const color = cat?.color ?? '#8B95A1';
  const Lucide = ICONS[catId];

  if (bare && Lucide) {
    return <Lucide size={size} strokeWidth={2.2} color={color} />;
  }

  if (Lucide) {
    return (
      <div
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: `${color}1f`, // 12% alpha tint
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...style,
        }}
      >
        <Lucide size={size * 0.52} strokeWidth={2.2} />
      </div>
    );
  }

  // Fallback to legacy emoji for custom categories
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: `${color}1f`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fontSize ?? size * 0.5,
        flexShrink: 0,
        ...style,
      }}
    >
      {cat?.emoji ?? '💰'}
    </div>
  );
}
