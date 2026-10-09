import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { fetchCategoryFeed } from "@/shared/lib/rss";
import type { NextRequest } from "next/server";
import {
  CATEGORIES,
  ISSUES_PER_CATEGORY_PER_DAY,
  RSS_POOL_SIZE_PER_CATEGORY,
} from "@/shared/config";
import { summarizeIssues } from "@/shared/lib/gemini";
import { ApiError } from "@google/genai";
import { createSupabaseAdminClient } from "@/shared/config/supabase";
import { todayDateStr } from "@/shared/lib/formatDate";
import type { IssueInsert } from "@/entities/issue/types";
import { clusterIssues } from "@/shared/lib/clusterIssues";

export const maxDuration = 300;

/** Vercel 로그에서 실패 원인을 바로 구분할 수 있도록 에러 종류를 요약한다. */
function describeError(error: unknown) {
  if (error instanceof ApiError) return `ApiError ${error.status}`;
  if (error instanceof SyntaxError) return "JSON parse error";
  if (error instanceof Error) return error.message;
  return "unknown error";
}

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

    if (topIssues.length === 0) continue;

    let categoryRows: IssueInsert[] = [];
    // 카테고리의 기사 전체를 한 번의 Gemini 호출로 배치 요약한다(무료
    // 티어 하루 요청 한도를 아끼기 위해 기사별 호출 대신 사용). 하루 쿼터
    // 초과(429 PerDay)를 제외한 실패는 일시적일 수 있으므로 10초, 30초
    // 간격으로 최대 2회까지 재시도한다.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const summaries = await summarizeIssues(topIssues, category.label);
        categoryRows = topIssues.map((item, index) => ({
          title: item.title,
          summary_1: summaries[index].summary_1,
          summary_2: summaries[index].summary_2,
          summary_3: summaries[index].summary_3,
          category: category.key,
          source_url: item.link,
          source_name: item.sourceName,
          published_at: todayDateStr(),
        }));
        break;
      } catch (error) {
        const errorKind = describeError(error);

        // 하루 쿼터 초과면 남은 카테고리도 전부 실패하므로 즉시 중단한다.
        // 분당 제한(PerMinute) 429는 기다리면 풀리므로 재시도 대상이다.
        if (
          error instanceof ApiError &&
          error.status === 429 &&
          error.message.includes("PerDay")
        ) {
          console.error(
            `Daily quota exhausted, stopping collection early:`,
            error
          );
          quotaExhausted = true;
          break;
        }

        if (attempt === maxAttempts) {
          console.error(
            `Failed to summarize category "${category.key}" [${errorKind}]:`,
            error
          );
          break;
        }

        const delayMs = 10000 * 3 ** (attempt - 1);
        console.error(
          `Retrying category "${category.key}" in ${delayMs / 1000}s [${errorKind}] (attempt ${attempt}):`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    totalInserted += await upsertCategoryRows(supabaseAdmin, categoryRows);

    if (!quotaExhausted) {
      // Gemini 2.5 Flash 무료 티어의 분당 요청 제한 대비, 카테고리 호출
      // 사이에 13초 대기
      await new Promise((resolve) => setTimeout(resolve, 13000));
    }
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
