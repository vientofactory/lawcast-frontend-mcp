# LawCast Frontend MCP

LawCast의 실제 프론트엔드 소스에서 추출한 디자인 체계와 AI 에이전트용 가드레일 MCP 서버입니다. Node.js 22 이상에서 stdio로 실행합니다. 별도 HTTP 포트, 인증정보, DB, 네트워크 호출이 없습니다.

## 설치 및 연결

루트 저장소에서:

```sh
git submodule update --init frontend-mcp
cd frontend-mcp
npx --yes npm@11.13.0 ci
npm test
```

Codex 설정(`~/.codex/config.toml`) 예시입니다. 경로는 실제 체크아웃의 절대 경로를 사용합니다.

```toml
[mcp_servers.lawcast_frontend]
command = "node"
args = ["/Users/doyeonkim/Documents/programming/lawcast/frontend-mcp/src/server.js"]
```

Claude Code 등 JSON MCP 클라이언트:

```json
{
  "mcpServers": {
    "lawcast-frontend": {
      "command": "node",
      "args": ["/Users/doyeonkim/Documents/programming/lawcast/frontend-mcp/src/server.js"]
    }
  }
}
```

서버 실행 경로는 현재 작업 디렉터리에 의존하지 않습니다. stdout은 MCP 메시지 전용입니다. 이 저장소는 기존 클라이언트의 전역 설정을 자동 변경하지 않습니다.

## 제공 인터페이스

- `get_design_system`: `all`, `tokens`, `classes`, `components`, `patterns`, `rules`. 토큰은 테마/선언 위치를 모두 보존합니다. 클래스는 CSS에 정의된 항목과 소스에서 관찰된 훅을 구분합니다.
- `get_style_rules`: `.lc-page-title` 같은 선택자 조각으로 실제 선언과 파일·줄·미디어 문맥·important를 조회합니다(최대 30개). 계산된 스타일은 아닙니다.
- `get_component`: `ModalShell.svelte`, `PaginationNav.svelte` 등 카탈로그 이름으로 실제 공통 컴포넌트 원문과 SHA-256을 반환합니다. 외부 경로나 임의 파일을 읽지 않습니다.
- `review_svelte`: 완성된 Svelte 소스를 검사하고 `fail`, `review`, `pass`, 줄 번호, 수정 방향을 반환합니다. 소스는 실행하지 않습니다. 최대 120,000자입니다.
- 리소스: `lawcast://design/tokens`, `/classes`, `/components`, `/patterns`, `/rules`.
- 프롬프트: `lawcast_ui_change(task)`.

서버의 `isError`는 MCP 호출 자체의 오류입니다. 디자인 위반은 정상적인 검사 결과이므로 `structuredContent.verdict`를 확인해야 합니다.

## 분석에서 도출한 기준

분석 기준은 frontend 3.2.0의 현재 체크아웃입니다. 초기 탐색 문서의 레거시 Svelte 패턴보다 실제 소스와 최근 UI 개편 기록을 우선했습니다. 상세 근거는 [디자인 분석](design/analysis.md)에 있습니다.

- 밝은/어두운 테마 모두 중립색 표면과 의미 기반 `--lc-*` 토큰을 사용합니다.
- `lc-main`이 가로 여백을 소유하며, 페이지 제목/섹션/목록 제목의 계층을 공유합니다.
- 목록은 평면 행과 구분선을 사용합니다. 회색 카드 중첩, 장식용 그림자/그라데이션/블러를 추가하지 않습니다.
- 모달 포커스·닫힘 수명, 알림 스코프, 네이티브 disclosure, 페이지네이션은 기존 공통 구현을 재사용합니다.
- 오류/빈 결과/로딩/429를 구분하고, 키보드 포커스·동작 줄이기·좁은 화면·긴 한국어 문장을 유지합니다.

## 검사와 강제 수준

```sh
node src/cli.js ../frontend/src/routes/example/+page.svelte
node src/cli.js ../frontend/src/lib/components/example
```

종료 코드: `0`은 정적 규칙 통과, `1`은 위반, `2`는 수동 검토 필요 또는 잘못된 입력입니다. 동적 class/style, spread, 사용자 정의 CSS, 접근성 경고 억제 등은 자동 승인하지 않습니다. 에이전트에 MCP를 연결하는 것만으로 파일 쓰기를 차단하지는 않습니다. 강제하려면 프론트엔드 PR CI의 필수 단계로 CLI를 실행해야 합니다. 기존 전체 소스에는 의도적인 예외·과거 구현이 있으므로 먼저 변경 파일 단위로 도입합니다. 현재 프론트엔드 CI나 소스는 이 작업에서 변경하지 않았습니다.

정적 검사는 모든 Tailwind 문법, 컴포넌트 간 접근성, 계산된 스타일, 런타임 JS, 실제 대비·배치·오버플로를 완전히 판정하지 않습니다. `pass`는 시각적 동일성 인증이 아닙니다. `review`는 독립적인 브라우저/통합 검토가 필요하며 CLI는 이를 비영(2)으로 처리합니다. 새 디자인 예외는 policy·회귀 테스트·근거를 함께 검토해서 반영합니다. 임의 suppression 옵션은 없습니다.

## 에이전트에 적용할 지침

```text
LawCast UI 변경 전 get_design_system으로 patterns/tokens/classes/components를 읽는다.
가장 가까운 공통 컴포넌트를 get_component로 확인하고 재사용한다.
Svelte 5 runes, #lib 별칭, 한국어 UI, 영어 주석/테스트 제목을 유지한다.
변경한 각 Svelte 파일 전체를 review_svelte에 제출한다.
fail을 수정하고 review는 실제 브라우저/통합 검토로 해소한다.
CLI 검사와 frontend lint/check, 관련 light/dark·키보드·320px·200% 글자·reduced-motion
테스트를 실행한다. 정적 pass를 전체 UX 검증으로 보고하지 않는다.
```

## 스냅샷 갱신 및 검증

```sh
npm run snapshot -- ../frontend
npm run format
npm run lint
npm test
```

스냅샷은 Git HEAD와 각 소스의 SHA-256을 함께 보존합니다. HEAD가 같아도 미커밋 소스가 다르면 fingerprint가 달라집니다. 동작은 번들 스냅샷을 기준으로 고정되며 프론트엔드 변경을 자동 반영하지 않습니다. 갱신 후 `design/snapshot.json`의 diff와 수동 정책 근거를 함께 검토하세요. 추출기는 CSS 선언 순서·선택자·미디어 문맥·important를 기록하지만 브라우저 cascade 계산기는 아닙니다. 컴포넌트 로컬 스타일은 원문에서 확인합니다.

`npm test`는 AST 규칙과 실제 SDK 클라이언트↔서버 stdio 왕복을 검증합니다. CI는 Node 22/24에서 lint/test/audit를 실행합니다. 수정·복원 실증은 `verification/VERIFICATION.txt`와 실행 가능한 `verification/ROLLBACK.sh`에 있습니다. 롤백은 지정한 데모 복사본만 원본 해시로 복원하며 프론트엔드나 Git 설정을 변경하지 않습니다.
