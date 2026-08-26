"use client";

import { CategoryTabs } from "@/features/issue-filter";
import { IssueCard } from "@/features/issue-card";
import { useIssueUIStore } from "@/entities/issue/store";
import { useIssuesByDate, groupByCategory } from "@/entities/issue/api";
import { CATEGORY_MAP } from "@/shared/config";
import { formatDateFull } from "@/shared/lib/formatDate";
import type { Issue } from "@/entities/issue/types";

interface IssueListProps {
  initialDate: string;
  initialIssues: Issue[];
}

export function IssueList({ initialDate, initialIssues }: IssueListProps) {
  const selectedDate = useIssueUIStore((s) => s.selectedDate);
  const selectedCategory = useIssueUIStore((s) => s.selectedCategory);

  const { data: issues = [] } = useIssuesByDate(
    selectedDate,
    selectedDate === initialDate ? initialIssues : undefined
  );

  const cat = CATEGORY_MAP[selectedCategory];
  const currentItems = groupByCategory(issues)[selectedCategory] ?? [];

  return (
    <div>
      <CategoryTabs />
      <div className="mx-auto max-w-2xl px-4 pt-8 pb-24 md:px-6 md:pt-11">
        <div
          className={`rounded-pill mb-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-bold ${cat.tintBgClass} ${cat.textClass}`}
        >
          {cat.label}
        </div>
        <h1 className="text-text-primary mb-1.5 text-2xl font-extrabold tracking-tight md:text-3xl">
          오늘의 {cat.label} 이슈
        </h1>
        <div className="text-text-muted mb-7 text-sm">
          {formatDateFull(selectedDate)}
        </div>

        {currentItems.length > 0 ? (
          <div>
            {currentItems.map((item) => (
              <IssueCard key={item.id} issue={item} />
            ))}
          </div>
        ) : (
          <div className="text-text-placeholder py-18 text-center">
            <div className="mb-3 text-sm">
              이 날은 아직 정리된 {cat.label} 이슈가 없어요
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
