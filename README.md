# LawCast Frontend MCP

LawCast 디자인 체계를 조회하고 Svelte 코드의 이탈을 검사하는 TypeScript 기반 stdio MCP 서버입니다. Node.js 22 이상이 필요합니다.

## 설치·연결

```sh
git submodule update --init frontend-mcp
cd frontend-mcp
npx --yes npm@11.13.0 ci
```

설치 시 TypeScript가 `dist/`로 빌드됩니다. Codex의 `~/.codex/config.toml`에 실제 체크아웃 경로를 등록합니다.

```toml
[mcp_servers.lawcast_frontend]
command = "node"
args = ["/path/to/frontend-mcp/src/server.js"]
```

다른 MCP 클라이언트도 같은 명령과 인수를 사용합니다. 기존 `src/server.js` 실행 경로는 빌드된 서버를 호출하는 호환 진입점으로 유지합니다.

## 도구

- `get_design_system(topic)`: 토큰·클래스·컴포넌트·UX 패턴·검사 규칙 조회.
- `get_style_rules(query)`: 선택자에 해당하는 CSS 선언과 소스 위치 조회.
- `get_component(name)`: 공통 Svelte 컴포넌트 원문 조회.
- `review_svelte(source, filename?)`: 코드 검사, 줄 번호와 수정 방향 반환.

리소스는 `lawcast://design/{tokens,classes,components,patterns,rules}`, 작업 지침 프롬프트는 `lawcast_ui_change(task)`입니다. 변경 전 디자인과 공통 컴포넌트를 확인한 뒤 변경 파일 전체를 검사하세요.

## CLI 검사

```sh
npm run check -- ../frontend/src/routes/+page.svelte
```

종료 코드: `0` 통과, `1` 위반, `2` 수동 검토 필요 또는 입력 오류. MCP 호출에서는 `structuredContent.verdict`의 `pass`·`fail`·`review`를 확인합니다.

MCP 연결만으로 파일 쓰기가 차단되지는 않습니다. 강제하려면 CLI를 필수 CI 단계로 연결하세요. 동적 스타일·사용자 정의 CSS는 별도 검토가 필요하며, 정적 통과도 실제 화면의 대비·배치·접근성 검증을 대체하지 않습니다.

## 개발

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run snapshot -- ../frontend
```

실행 코드·스크립트·테스트는 TypeScript로 작성하며 `dist/`는 커밋하지 않습니다. 테스트는 빌드 후 실제 MCP stdio 통신과 검사 규칙을 검증합니다. 소스 변경 후 다시 빌드하세요.

스냅샷은 자동 갱신되지 않습니다. 갱신 후 소스 해시와 정책 변경을 함께 검토하세요. 상세 기준은 [디자인 분석](design/analysis.md), 기존 데모 검증은 [검증 기록](verification/VERIFICATION.txt)을 참고하세요.
