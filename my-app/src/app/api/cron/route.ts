import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { fetchCategoryFeed } from "@/shared/lib/rss";
import type { NextRequest } from "next/server";
import {
  CATEGORIES,
  ISSUES_PER_CATEGORY_PER_DAY,
  RSS_POOL_SIZE_PER_CATEGORY,
} from "@/shared/config";
import { summarizeIssue } from "@/shared/lib/gemini";
import { ApiError } from "@google/genai";
import { createSupabaseAdminClient } from "@/shared/config/supabase";
import { todayDateStr } from "@/shared/lib/formatDate";
import type { IssueInsert } from "@/entities/issue/types";
import { clusterIssues } from "@/shared/lib/clusterIssues";

export const maxDuration = 300;

async function upsertCategoryRows(
  supabaseAdmin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  rows: IssueInsert[]
) {
  if (rows.length === 0) return 0;

  const { data, error } = await supabaseAdmin
    .from("issues")
    .upsert(rows, { onConflict: "source_url,published_at" })
    .select("id");

  if (error) {
    console.error("Upsert failed:", error);
    return 0;
  }

  for (const row of data) {
    revalidatePath(`/${row.id}`);
  }
  return rows.length;
}

async function runCollection(
  supabaseAdmin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>
) {
  let quotaExhausted = false;
  let totalInserted = 0;

  for (const category of CATEGORIES) {
    if (quotaExhausted) break;

    // items = 이 카테고리의 뉴스 기사 30개 (title, link, sourceName, publishedAt)
    const items = await fetchCategoryFeed(
      category.rssQuery,
      RSS_POOL_SIZE_PER_CATEGORY
    );
    const topIssues = clusterIssues(items, ISSUES_PER_CATEGORY_PER_DAY);

    console.log(
      `[${category.key}] RSS ${items.length}건 수집, 클러스터링 후 ${topIssues.length}건`
    );

    const categoryRows: IssueInsert[] = [];

    for (const item of topIssues) {
      if (quotaExhausted) break;
      // 기사 한 개씩 Gemini 요약. 500/502/503는 Gemini API의 일시적인
      // 문제일 수 있으므로 3초 후 최대 2회까지 재시도한다.
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const summary = await summarizeIssue(item.title, category.label);
          categoryRows.push({
            title: item.title,
            summary_1: summary.summary_1,
            summary_2: summary.summary_2,
            summary_3: summary.summary_3,
            category: category.key,
            source_url: item.link,
            source_name: item.sourceName,
            published_at: todayDateStr(),
          });
          break;
        } catch (error) {
          const isRetryable =
            error instanceof ApiError && [500, 502, 503].includes(error.status);

          if (error instanceof ApiError && error.status === 429) {
            console.error(`Quota exhausted, stopping collection early:`, error);
            quotaExhausted = true;
            break;
          }

          if (!isRetryable || attempt === maxAttempts) {
            console.error(`Failed to summarize "${item.title}":`, error);
            break;
          }

          console.error(
            `Retrying "${item.title}" after transient error (attempt ${attempt}):`,
            error
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      if (!quotaExhausted) {
        // Gemini 2.5 Flash 무료 티어의 분당 요청 제한이 5회, 다음 호출까지 13초 대기
        await new Promise((resolve) => setTimeout(resolve, 13000));
      }
    }

    totalInserted += await upsertCategoryRows(supabaseAdmin, categoryRows);
  }

  revalidatePath("/");
  console.log(`Cron collection inserted ${totalInserted} issues`);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  // cron-job.org의 요청 타임아웃(무료 플랜 기준 30초)보다 수집 작업이
  // 오래 걸리므로, 즉시 202를 응답하고 실제 수집/요약/저장은
  // 응답 이후에도 계속 실행되도록 한다.
  after(() =>
    runCollection(supabaseAdmin).catch((error) => {
      console.error("Cron collection crashed unexpectedly:", error);
    })
  );

  return NextResponse.json({ status: "accepted" }, { status: 202 });
}
