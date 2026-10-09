import Link from "next/link";
import { formatDateShort } from "@/shared/lib/formatDate";
import type { Issue } from "@/entities/issue/types";

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps) {
  return (
    <Link
      href={`/${issue.id}`}
      className="border-border-soft duration-base hover:border-border-strong mb-4 flex gap-4 rounded-md border p-5 shadow-sm transition-colors md:gap-5"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div className="text-text-primary text-lg leading-snug font-bold">
          {issue.title}
        </div>
        <div className="text-text-secondary line-clamp-2 text-sm">
          {issue.summary_1}
        </div>
        <div className="text-text-faint text-xs">
          {formatDateShort(issue.published_at)} · {issue.source_name}
        </div>
      </div>
    </Link>
  );
}
