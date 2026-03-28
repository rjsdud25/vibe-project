---
name: nextjs-ts-architecture-audit
description: >-
  Audits Next.js and TypeScript codebases for duplication, oversized
  functions/components (SRP), typing discipline (any, loose casts, missing
  interfaces), naming consistency, and dependency hygiene (unused imports, props
  drilling). Outputs a Korean markdown table with High / Medium / Low priority.
  Use when the user asks for 아키텍처 점검, 코드 품질, 리팩터 후보, SRP, 네이밍,
  or a senior architect-style review without implementing changes unless
  requested.
---

# Next.js · TypeScript 아키텍처 점검

## 역할

시니어 소프트웨어 아키텍트 관점에서 **구조·일관성·유지보수성**만 검토한다. 사용자가 **코드 수정을 요청하지 않으면 리포트만** 작성한다.

## 점검 항목

### 1. 코드 중복

- 동일·유사 유틸(정규화, 파싱, 검증)이 여러 파일에 반복되는지.
- API Route에서 JSON 본문 파싱·에러 응답 패턴이 복붙인지.

### 2. 함수·컴포넌트 크기 / SRP

- **50줄 이상** 또는 한 파일·한 함수가 **여러 책임**(페칭·도메인 규칙·UI·부수 효과)을 동시에 갖는지.
- App Router에서 **거대한 클라이언트 컴포넌트** 단일 export 여부.

### 3. 타입 정의

- `any`, 과도한 `as` 캐스트, `Record<string, unknown>` 이후 무방비 접근.
- API 응답·DB Row에 대한 **공유 인터페이스** 또는 생성된 DB 타입 부재.

### 4. 네이밍 일관성

- 파일명(kebab-case 등)·컴포넌트(PascalCase)·훅·함수(camelCase) 규칙.
- **REST JSON snake_case** vs **클라이언트 camelCase** 혼재가 문서화·매핑 계층 없이 어지러운지.

### 5. 불필요한 의존성

- 사용되지 않는 모듈·import·유틸 파일.
- **props drilling**: 깊은 트리로 동일 props가 반복 전달되는지(없으면 양호로 서술).

## 우선순위

| 등급 | 기준 요약 |
|------|-----------|
| **High** | 분리·타입·중복 제거 없이는 변경 비용·버그 위험이 큼 |
| **Medium** | 규모 확대 시 문제, 또는 정리 시 이득이 큼 |
| **Low** | 스타일·미세 일관성, 문서화로 해결 가능 |

## 출력 형식 (필수)

```markdown
| 일련번호 | 우선순위 | 파일 | 위치 | 문제 | 권고사항 |
|---|---|---|---|---|---|
```

## 절차

1. `grep` 또는 검색: `\bany\b`, `as Record`, `function `, 큰 `.tsx` 파일.
2. `components/`·`app/api/**/route.ts` 라인 수·책임 개수 파악.
3. 동일 함수명(예: `normalizeMenu`)·유사 Tailwind 상수 문자열 중복 확인.
4. `package.json` 대비 실제 import 그래프(미사용 `lib/` 파일).
5. `types/`와 API 응답 형태 정렬 여부 확인.

## 추가 자료 (선택)

`examples.md`에 “양호한 분리 예시”를 둘 수 있다. 기본은 이 `SKILL.md`만으로 동작하도록 짧게 유지한다.
