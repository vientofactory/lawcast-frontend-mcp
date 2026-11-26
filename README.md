# LawCast Frontend MCP

LawCast의 디자인 자료를 조회하고 Svelte 코드를 검사하는 stdio MCP 서버입니다. Node.js 22 이상이 필요합니다.

## 설치와 연결

```sh
git submodule update --init frontend-mcp
cd frontend-mcp
npx --yes npm@11.13.0 ci
```

설치 과정에서 TypeScript를 `dist/`로 빌드합니다. Codex의 `~/.codex/config.toml`에 체크아웃 경로를 등록합니다.

```toml
[mcp_servers.lawcast_frontend]
command = "node"
args = ["/path/to/frontend-mcp/src/server.js"]
```

다른 MCP 클라이언트에서도 같은 명령과 인수를 사용합니다.

## 제공 도구

- `get_design_system(topic)`: 토큰·클래스·컴포넌트·UX 패턴·검사 규칙 조회
- `get_style_rules(query)`: CSS 선언과 소스 위치 조회
- `get_component(name)`: 공통 Svelte 컴포넌트 원문 조회
- `review_svelte(source, filename?)`: 검사 결과와 수정 방향 조회

리소스는 `lawcast://design/{tokens,classes,components,patterns,rules}`, 프롬프트는 `lawcast_ui_change(task)`입니다.

## CLI 검사

```sh
npm run check -- ../frontend/src/routes/+page.svelte
```

종료 코드는 `0` 통과, `1` 위반, `2` 수동 검토 필요 또는 입력 오류입니다. MCP 응답은 `structuredContent.verdict`의 `pass`·`fail`·`review`로 구분합니다. 정적 검사만으로 실제 화면의 배치나 접근성을 검증할 수는 없습니다.

## 개발

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run snapshot -- ../frontend
```

소스를 변경하면 다시 빌드합니다. 스냅샷은 자동으로 갱신되지 않으며 갱신한 서버를 사용하려면 기존 MCP 연결을 재시작해야 합니다.

상세 내용은 [정책 원본](design/policy.json)과 [디자인 분석](design/analysis.md)을 참고하세요.
