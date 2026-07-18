import { useState } from "react";
import { Tab } from "@/pages/Dashboard";
import { motion } from "framer-motion";
import { Plus, MoreHorizontal } from "lucide-react";
import { AppIcon, AppIconName } from "@/components/ui/AppIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import AttentionBadge from "@/components/attention/AttentionBadge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const ICON_FOR: Record<Tab, AppIconName> = {
  home: "home",
  diet: "utensils",
  habits: "walk",
  exercise: "dumbbell",
  fasting: "clock",
  supplements: "pill",
  labs: "chart",
  videos: "video",
  community: "users",
  consult: "stethoscope",
  messages: "chat",
  
} as const;

// Per-tab accent colors (PUNCH pillars get distinct colors so each section is instantly identifiable)
const TAB_COLOR: Partial<Record<Tab, string>> = {
  home: "var(--bbdo-ink)",
  diet: "var(--pillar-diet)",
  habits: "var(--pillar-move)",
  exercise: "var(--pillar-exercise)",
  fasting: "var(--pillar-fasting)",
  supplements: "var(--pillar-supplements)",
  consult: "var(--bbdo-blue, #3B82F6)",
  labs: "var(--bbdo-blue, #3B82F6)",
  videos: "var(--pillar-fasting)",
  community: "var(--bbdo-red, #EA6A5E)",
  messages: "var(--bbdo-blue, #3B82F6)",
};


const LABEL_FOR: Partial<Record<Tab, string>> = {
  home: "Home",
  diet: "Food",
  habits: "Move",
  exercise: "Train",
  fasting: "Fast",
  supplements: "Supp",
  consult: "Talk",
  labs: "Labs",
  videos: "Yoga",
  community: "Feed",
  messages: "Chat",
};

// Priority order — most-used first. Home is always the anchor.
const PRIORITY: Tab[] = [
  "home", "diet", "habits", "exercise", "fasting",
  "supplements", "consult", "labs", "videos", "community", "messages",
];

// Layout: [tab] [tab] [ + ] [tab] [ ... ]  — plus sign lives in the middle.
const PRIMARY_SLOTS = 3;
const LEFT_SLOTS = 2; // tabs shown to the LEFT of the center FAB



export default function BottomNav({
  activeTab,
  setActiveTab,
  onFABPress,
  visibleTabs,
  attentionCounts,
}: {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onFABPress?: () => void;
  visibleTabs?: Tab[];
  attentionCounts?: Partial<Record<Tab, number>>;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const allowed = PRIORITY.filter((id) => !visibleTabs || visibleTabs.includes(id));

  // Priority-based split. Home is pinned, then highest-priority tabs fill the dock.
  // If the active tab isn't in the dock, swap it into the last primary slot so users
  // can always see where they are.
  let primary = allowed.slice(0, PRIMARY_SLOTS);
  let overflow = allowed.slice(PRIMARY_SLOTS);
  if (!primary.includes(activeTab) && overflow.includes(activeTab)) {
    const swapOut = primary[primary.length - 1];
    primary = [...primary.slice(0, -1), activeTab];
    overflow = overflow.map((id) => (id === activeTab ? swapOut : id));
  }

  const hasOverflow = overflow.length > 0;
  const overflowUnread = overflow.reduce((sum, id) => sum + (attentionCounts?.[id] ?? 0), 0);

  const renderTab = (id: Tab, opts: { inSheet?: boolean } = {}) => {
    const isActive = activeTab === id;
    const label = LABEL_FOR[id] || t(id);
    const { inSheet } = opts;

    if (inSheet) {
      return (
        <motion.button
          key={id}
          onClick={() => {
            setActiveTab(id);
            setExpanded(false);
          }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="no-pill relative flex flex-col items-center justify-center gap-2 rounded-2xl py-4 px-2 border"
          style={
            isActive
              ? {
                  background: "var(--bbdo-ink)",
                  color: "#fff",
                  borderColor: "var(--bbdo-ink)",
                }
              : {
                  background: "#ffffff",
                  color: "var(--bbdo-ink)",
                  borderColor: "var(--bbdo-line)",
                }
          }
        >
          <AppIcon name={ICON_FOR[id]} size={22} strokeWidth={1.7} />
          <span className="text-[11px] font-semibold leading-none text-center">{label}</span>
          <AttentionBadge count={attentionCounts?.[id] ?? 0} className="absolute right-1.5 top-1.5" />
        </motion.button>
      );
    }

    const accent = TAB_COLOR[id] || "var(--bbdo-ink)";
    return (
      <motion.button
        key={id}
        onClick={() => setActiveTab(id)}
        aria-label={label}
        whileTap={{ scale: 0.9 }}
        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex-none flex items-center justify-center w-10 h-10 rounded-full transition-colors"
        style={
          isActive
            ? { background: accent, color: "#fff" }
            : { background: "transparent", color: "var(--bbdo-ink-soft)" }
        }
      >
        <AppIcon name={ICON_FOR[id]} size={20} strokeWidth={isActive ? 2 : 1.7} />
        <AttentionBadge count={attentionCounts?.[id] ?? 0} className="absolute -right-0.5 -top-0.5" />
      </motion.button>
    );
  };



  return (
    <>
      {/* Expanded overflow drawer — slides up full-width from bottom, matches quick-log style */}
      <Drawer open={expanded} onOpenChange={setExpanded}>
        <DrawerContent className="md:hidden max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-left text-base font-black text-[var(--bbdo-ink)]">
              All sections
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-3 gap-2">
              {allowed.map((id) => renderTab(id, { inSheet: true }))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Compact dock — icon-only, centered, slim */}
      <div className="fixed bottom-4 left-0 right-0 z-50 md:hidden flex justify-center px-4">
        <div
          className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
          style={{
            background: "#ffffff",
            border: "1px solid var(--bbdo-line)",
            boxShadow: "0 12px 28px -12px rgba(15,26,61,0.22)",
          }}
        >
          {/* Left tabs */}
          {primary.slice(0, LEFT_SLOTS).map((id) => renderTab(id))}

          {/* Center FAB */}
          <motion.button
            onClick={onFABPress}
            aria-label="Quick log"
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 w-12 h-12 mx-1 -my-1 rounded-full flex items-center justify-center"
            style={{
              background: "var(--bbdo-red, #EA6A5E)",
              color: "#fff",
              boxShadow: "0 8px 18px -6px rgba(234,106,94,0.55)",
            }}
          >
            <Plus className="w-5 h-5" strokeWidth={2.4} />
          </motion.button>

          {/* Right tabs */}
          {primary.slice(LEFT_SLOTS).map((id) => renderTab(id))}

          {hasOverflow && (
            <motion.button
              key="more"
              onClick={() => setExpanded(true)}
              aria-label="More sections"
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex-none w-10 h-10 flex items-center justify-center rounded-full"
              style={{ color: "var(--bbdo-ink-soft)" }}
            >
              <MoreHorizontal className="w-5 h-5" strokeWidth={1.9} />
              <AttentionBadge count={overflowUnread} className="absolute -right-0.5 -top-0.5" />
            </motion.button>
          )}
        </div>
      </div>


    </>
  );
}

