"use client";

import { CATEGORIES } from "@/shared/config";
import { useIssueUIStore } from "@/entities/issue/store";
import { DateCalendar } from "@/features/issue-timeline";
import { cn } from "@/shared/lib/cn";
import { useNavigateToList } from "@/shared/lib/useNavigateToList";

interface MobileNavPanelProps {
  onClose: () => void;
}

export function MobileNavPanel({ onClose }: MobileNavPanelProps) {
  const selectedCategory = useIssueUIStore((s) => s.selectedCategory);
  const setSelectedCategory = useIssueUIStore((s) => s.setSelectedCategory);
  const navigateToList = useNavigateToList();

  return (
    <div className="border-border bg-bg border-b px-4 pt-2 pb-5 md:hidden">
      <div className="mb-4">
        <DateCalendar />
      </div>
      <nav className="flex flex-col gap-1">
        {CATEGORIES.map((cat) => {
          const isActive = cat.key === selectedCategory;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setSelectedCategory(cat.key);
                navigateToList();
                onClose();
              }}
              className={cn(
                "text-md duration-base cursor-pointer rounded-sm px-3 py-3 text-left font-semibold transition-colors",
                isActive
                  ? cn(cat.tintBgClass, cat.textClass)
                  : "text-text-secondary"
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
