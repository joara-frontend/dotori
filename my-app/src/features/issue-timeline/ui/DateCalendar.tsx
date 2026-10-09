"use client";

import { useState } from "react";
import { useIssueUIStore } from "@/entities/issue/store";
import {
  toDateStr,
  formatDateShort,
  todayDateStr,
} from "@/shared/lib/formatDate";
import { cn } from "@/shared/lib/cn";
import { useNavigateToList } from "@/shared/lib/useNavigateToList";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function DateCalendar() {
  const selectedDate = useIssueUIStore((s) => s.selectedDate);
  const calendarOpen = useIssueUIStore((s) => s.calendarOpen);
  const toggleCalendar = useIssueUIStore((s) => s.toggleCalendar);
  const setSelectedDate = useIssueUIStore((s) => s.setSelectedDate);
  const navigateToList = useNavigateToList();

  const [year, month] = selectedDate.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonthIdx, setViewMonthIdx] = useState(month - 1);

  const prevMonth = () => {
    if (viewMonthIdx === 0) {
      setViewMonthIdx(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonthIdx((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonthIdx === 11) {
      setViewMonthIdx(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonthIdx((m) => m + 1);
    }
  };

  const firstDow = new Date(viewYear, viewMonthIdx, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonthIdx + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  return (
    <div className="relative">
      <button
        onClick={toggleCalendar}
        className="text-text-primary duration-base hover:bg-border-soft flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm font-semibold transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="stroke-icon"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" strokeWidth="1.6" />
          <line x1="3" y1="9.5" x2="21" y2="9.5" strokeWidth="1.6" />
          <line
            x1="7.5"
            y1="2.5"
            x2="7.5"
            y2="6.5"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="16.5"
            y1="2.5"
            x2="16.5"
            y2="6.5"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <span>{formatDateShort(selectedDate)}</span>
      </button>

      {calendarOpen && (
        <div className="border-border bg-bg absolute top-[52px] left-0 z-60 w-[280px] rounded-md border p-4.5 shadow-lg md:w-[296px]">
          <div className="mb-3.5 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="text-text-muted hover:bg-border-soft cursor-pointer rounded-sm px-2 py-1 text-base"
            >
              ‹
            </button>
            <div className="text-text-primary text-sm font-bold">
              {viewYear}년 {viewMonthIdx + 1}월
            </div>
            <button
              onClick={nextMonth}
              className="text-text-muted hover:bg-border-soft cursor-pointer rounded-sm px-2 py-1 text-base"
            >
              ›
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-2xs text-text-placeholder py-1 text-center font-semibold"
              >
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) {
                return <div key={i} className="h-8" />;
              }
              const dateStr = toDateStr(viewYear, viewMonthIdx, d);
              const isSelected = dateStr === selectedDate;
              const isFuture = dateStr > todayDateStr();
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (isFuture) return;
                    setSelectedDate(dateStr);
                    navigateToList();
                  }}
                  disabled={isFuture}
                  className={cn(
                    "text-text-primary duration-fast h-8 cursor-pointer rounded-sm text-xs font-normal transition-colors",
                    isSelected
                      ? "bg-brand font-bold text-white"
                      : "hover:bg-border-soft bg-transparent",
                    isFuture &&
                      "text-text-placeholder cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
