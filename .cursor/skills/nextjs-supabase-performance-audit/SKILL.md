---
name: nextjs-supabase-performance-audit
description: >-
  Audits Next.js (App Router) and Supabase frontends for render churn
  (useEffect deps, memoization), data fetching (N+1, duplicate calls, caching),
  bundle size (imports, dynamic import), image/font optimization (next/image,
  CLS), and API payload shape (avoid select *, narrow columns). Produces a
  Korean markdown table with Critical / High / Medium only. Use when the user
  asks for 성능 감사, performance review, Core Web Vitals, 리렌더, N+1, 번들,
  next/image, or fetch optimization without implementing fixes unless requested.
---

# Next.js · Supabase 성능 감사

## 역할

Next.js App Router와 Supabase를 쓰는 프로젝트에서 **성능** 관점만 집중 검토한다. 사용자가 **코드 수정을 요청하지 않으면 리포트만** 작성한다.

## 검토 항목

### 1. 불필요한 리렌더링

- `useEffect` 의존성 배열: 누락(오래된 클로저) vs 과다(과도한 재실행).
- `useCallback` / `useMemo` / `React.memo`: 이벤트 핸들러·파생 데이터·리스트 행에 대한 안정적 참조 여부.
- 컨텍스트·상위 state 변경이 하위 전체를 갱신하는지.

### 2. 데이터 페칭

- 클라이언트 `fetch` 폭포(waterfall) vs 병렬(`Promise.all`).
- 동일 데이터에 대한 **중복 요청**(낙관적 UI + Realtime + 수동 refetch 겹침).
- **N+1**: 루프/목록마다 API·쿼리 호출, 또는 한 요청 처리 중 반복 쿼리.
- Next.js `fetch` 캐시·`revalidate`, SWR/React Query 등 **캐싱·중복 제거** 유무.

### 3. 번들 사이즈

- 무거운 컴포넌트·라이브러리 **정적 import** vs `next/dynamic` + `ssr: false` 등(필요 시).
- 라우트별 코드 스플리팅 여부(큰 클라이언트 트리가 첫 화면에 항상 포함되는지).

### 4. 이미지·폰트·CLS

- `next/image` (sizes, priority, placeholder) vs 원시 `<img>`.
- `next/font` 사용 여부, 폰트 패밀리 수·서브셋.
- 로딩/스켈레톤 전환으로 인한 **레이아웃 이동(CLS)** 가능성.

### 5. API·Supabase 응답

- `select('*')`로 넓은 컬럼 반환 vs **필요 컬럼만** `select(...)`.
- `{ count: 'exact', head: true }` 등은 행 전송이 없으면 **과도한 페이로드 이슈로 보지 않음** (단, 카운트 전용이면 `id` 등 최소 컬럼 명시 권장 가능).
- 한 핸들러 안의 **순차 다중 쿼리**를 RPC/뷰로 묶을 여지.

## 심각도

| 등급 | 기준 요약 |
|------|-----------|
| **Critical** | 핵심 경로에서 눈에 띄는 다운타임·메모리 폭증·무한 루프 수준 |
| **High** | 사용자 체감 지연·트래픽 증가 시 급격한 비용·확장 시 병목 |
| **Medium** | 규모·데이터 증가 시 문제화, 또는 측정 기반 최적화 여지 |

## 출력 형식 (필수)

```markdown
| 일련번호 | 심각도 | 파일 | 위치 | 문제 | 권고사항 |
|---|---|---|---|---|---|
```

## 절차

1. `package.json` 의존성과 `app/`·`components/`·`lib/` 구조 파악.
2. `useEffect`·`useCallback`·`fetch`·`createBrowserClient`·`channel(` 검색.
3. `app/api/**` 및 Server Actions에서 Supabase `.select(` 패턴 확인.
4. `next.config`, `layout.tsx`의 폰트·이미지 설정 확인.
5. 이미지가 없으면 표 대신 한 줄로 **해당 없음** 명시 가능.

## 추가 자료 (선택)

같은 폴더에 `checklist.md`로 라우트별 페칭 그래프를 둘 수 있다. 기본은 이 파일만으로 동작하도록 유지한다.
