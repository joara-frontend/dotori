# 도토리 (Dotori)

매일 1회 RSS 피드를 수집해 Gemini로 3줄 요약을 생성하고, 카테고리별로 보여주는
뉴스 요약 서비스입니다. (사회·시사 / 경제·금융 / 테크·AI / 컬처·트렌드, 카테고리당
하루 3개 이슈)

## 기술적으로 흥미로운 점

### Jaccard 유사도 기반 이슈 클러스터링

여러 언론사가 같은 사건을 다른 제목으로 보도해도 하나의 이슈로 묶고,
`sourceCount`(보도 매체 수)로 "여러 매체가 다루는 진짜 이슈"를 가려낸다.
클러스터가 커질수록 판단 기준이 느슨해지는 걸 막기 위해, 클러스터 전체가
아니라 **클러스터를 시작한 첫 기사(앵커)의 토큰 집합**하고만 유사도를
비교한다.

→ [`src/shared/lib/clusterIssues.ts`](./my-app/src/shared/lib/clusterIssues.ts)

### 서버리스 타임아웃을 넘는 백그라운드 작업

cron-job.org 무료 플랜의 요청 타임아웃(30초)보다 RSS 수집 + Gemini 요약
작업이 훨씬 오래 걸린다. `GET /api/cron`은 인증 후 바로 `202 Accepted`를
응답하고, Next.js `after()`로 실제 수집/요약/저장은 응답 이후에도 계속
실행되도록 넘긴다(`maxDuration = 300`).

```ts
after(() => runCollection(supabaseAdmin));
return NextResponse.json({ status: "accepted" }, { status: 202 });
```

→ [`src/app/api/cron/route.ts`](./my-app/src/app/api/cron/route.ts)

### 무료 AI API 하루 쿼터에 맞춘 카테고리 단위 배치 호출

Gemini 2.5 Flash 무료 티어는 하루 요청 수
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) 제한이 있고, 이 한도는
API 키가 아니라 프로젝트 단위로 걸리며 태평양시간 자정에 리셋된다. 기사
한 건당 1회씩 호출하면 카테고리 4개 × 카테고리당 3개 기사로 하루 최대
12회, 재시도까지 겹치면 더 늘어나 쿼터를 쉽게 소진한다. 그래서 카테고리당
기사 전체(최대 3개)를 한 번의 프롬프트로 묶어 JSON 배열로 응답받는 방식으로
호출 수를 하루 최대 4회(재시도 포함 최대 12회)로 줄였다.

배치 호출이 `ApiError`(500/502/503)로 실패하면 일시적 오류로 보고 3초 대기
후 최대 2회까지 재시도하고, 카테고리 호출 사이에는 분당 요청 제한 대비
13초씩 대기한다.

`429`는 재시도하지 않는다. 무료 티어의 429는 분당 제한이 아니라 하루 쿼터
초과라서, 한 번 발생하면 남은 카테고리도 전부 실패할 게 확실하기 때문이다.
재시도로 쿼터를 더 깎는 대신 즉시 전체 수집을 조기 종료한다.

> **알려진 제한사항**: 재시도는 500/502/503 같은 일시적 오류에만 적용된다.
> Gemini 응답의 JSON 파싱 실패나 배열 길이 불일치 등 다른 원인이거나
> 재시도를 모두 소진한 경우에는 해당 카테고리 전체가 스킵되므로(최대 3개
> 손실), 다른 카테고리에는 영향이 없다. 하루 쿼터를 넘기면 그 날은 이후
> 카테고리가 전부 스킵된다.

→ [`src/shared/lib/gemini.ts`](./my-app/src/shared/lib/gemini.ts),
[`src/app/api/cron/route.ts`](./my-app/src/app/api/cron/route.ts)

### 날짜 기준 멱등적 upsert

`(source_url, published_at)` 유니크 제약으로 같은 기사·같은 날짜의 중복
저장을 막으면서, 같은 기사가 다른 날짜에 다시 이슈가 되면 새 행으로
취급한다. cron이 매일 같은 시각에 다시 실행돼도 안전하게 재실행 가능한
구조.

→ [`supabase/schema.sql`](./supabase/schema.sql)

### 데이터가 바뀐 시점에만 캐시 무효화

타이머 기반 재검증(ISR) 대신, cron이 실제로 이슈를 upsert한 직후에만
`revalidatePath`로 홈(`/`)과 새로 갱신된 이슈 상세 페이지(`/[id]`)를
무효화한다.

→ [`src/app/api/cron/route.ts`](./my-app/src/app/api/cron/route.ts)

### 백엔드 없이도 죽지 않는 설계

Supabase 환경변수가 없으면 클라이언트를 에러 없이 `null`로 두고, 모든
fetch 함수가 `if (!supabase) return ...` 가드로 시작한다. 덕분에 로컬에서
Supabase를 세팅하지 않아도 UI 확인이 가능하다.

→ [`src/shared/config/supabase.ts`](./my-app/src/shared/config/supabase.ts),
[`src/entities/issue/api.ts`](./my-app/src/entities/issue/api.ts)

### 저작권을 고려한 데이터 정책

RSS에서 제목·링크·발행일·출처만 수집하고 기사 원문은 저장하지 않는다.
Gemini 요약도 원문 없이 제목만으로 생성한다.

→ [`src/shared/lib/rss.ts`](./my-app/src/shared/lib/rss.ts)

### DB 레벨 읽기/쓰기 권한 분리 (RLS)

anon 키에는 공개 읽기 정책만 허용하고, 쓰기는 서비스 롤 키로 `/api/cron`
안에서만 수행한다.

→ [`supabase/schema.sql`](./supabase/schema.sql)

### 경량 FSD + 레이어별 CLAUDE.md 문서화

`app → widgets → features → entities → shared` 단방향 의존성 규칙을
레이어별 `CLAUDE.md`로 관리한다. 사람뿐 아니라 AI 협업 시에도 참고할 수
있는 살아있는 아키텍처 문서다.

→ [`my-app/CLAUDE.md`](./my-app/CLAUDE.md)

## 기술 스택

Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Tailwind CSS v4 ·
TanStack Query v5 · Zustand · rss-parser · Gemini 2.5 Flash · Supabase
(Postgres) · cron-job.org · Vercel

## 데이터 파이프라인

```
RSS 수집 → Jaccard 클러스터링 → Gemini 3줄 요약 → Supabase upsert → 변경분만 revalidate
```

카테고리별 검색어는
[`src/shared/config/index.ts`](./my-app/src/shared/config/index.ts)의
`rssQuery`에서 바꿀 수 있다.

## 폴더 구조 (FSD 경량화)

```
src/
├── app/                 # 라우팅 전용 (App Router)
├── features/            # issue-card, issue-filter, issue-timeline
├── entities/issue/      # 타입, TanStack Query 훅, Zustand 스토어
├── shared/              # ui, lib, config (Supabase/Gemini/RSS 클라이언트 포함)
└── widgets/              # Header, Footer, IssueList
```

## 로컬 실행 / 배포

<details>
<summary>펼치기</summary>

### 로컬 개발 설정

1. 의존성 설치

   ```bash
   npm install
   ```

2. `.env.local.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

   ```bash
   cp .env.local.example .env.local
   ```

   | 변수                            | 설명                                                                 |
   | ------------------------------- | -------------------------------------------------------------------- |
   | `GEMINI_API_KEY`                | [Google AI Studio](https://aistudio.google.com/apikey)에서 발급      |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL                                                |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(public) key — 목록/상세 페이지의 읽기 전용 접근에 사용 |
   | `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key — `/api/cron`에서만 서버 사이드로 사용     |
   | `CRON_SECRET`                   | `/api/cron` 호출을 인증하기 위한 임의의 시크릿 문자열                |

3. Supabase 프로젝트의 SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql)을
   실행해 `issues` 테이블과 RLS 정책(공개 읽기)을 생성합니다.

4. 개발 서버 실행

   ```bash
   npm run dev
   ```

   http://localhost:3000 에서 확인합니다.

cron-job.org에서 매일 아침 아래처럼 호출하도록 등록하세요.

- URL: `https://<your-domain>/api/cron`
- Header: `Authorization: Bearer <CRON_SECRET>`

배포 전에 로컬에서 직접 확인하려면:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron
```

### Vercel 배포

1. GitHub 저장소를 Vercel에 연결합니다.
2. Vercel 프로젝트 설정 > Environment Variables에 위 5개 환경변수를 등록합니다.
3. 배포 후 cron-job.org에 프로덕션 도메인의 `/api/cron`을 등록합니다.
4. 홈/상세 페이지는 정적으로 캐시되며, 별도의 시간 기반 재검증(ISR) 없이
   [On-Demand Revalidation](https://nextjs.org/docs/app/guides/incremental-static-regeneration#on-demand-revalidation)만
   사용합니다.

</details>
