export interface SourceEntry {
  sha256: string;
  source: string;
}
export interface TokenDeclaration {
  selector: string;
  value: string;
  path: string;
  line: number;
}
export interface CssDeclaration {
  property: string;
  value: string;
  important: boolean;
  line: number;
}
export interface CssRule {
  selector: string;
  context: string | null;
  declarations: CssDeclaration[];
  path: string;
  line: number;
}
export interface Snapshot {
  schemaVersion: number;
  frontendVersion: string;
  commit: string;
  fingerprint: string;
  tokens: Record<string, TokenDeclaration[]>;
  classes: string[];
  observedClasses: string[];
  cssRules: CssRule[];
  components: string[];
  sources: Record<string, SourceEntry>;
}
export type RuleId =
  | 'unknown-token'
  | 'unknown-class'
  | 'raw-color'
  | 'decoration'
  | 'list-interaction'
  | 'icon-backplate'
  | 'custom-modal'
  | 'missing-testid'
  | 'focus-hidden'
  | 'legacy-svelte'
  | 'dynamic-style'
  | 'custom-style'
  | 'svelte';
export interface Policy {
  version: number;
  principles: { id: string; guidance: string; evidence: string[] }[];
  manualChecks: string[];
  rules: { id: RuleId; severity: 'error' | 'review'; fix: string }[];
}
export type DesignTopic = 'all' | 'tokens' | 'classes' | 'components' | 'patterns' | 'rules';
export interface Finding {
  rule: RuleId;
  severity: 'error' | 'review';
  line: number;
  message: string;
  fix: string;
}
export interface ReviewResult {
  filename: string;
  verdict: 'pass' | 'fail' | 'review';
  errors: number;
  reviews: number;
  findings: Finding[];
  fingerprint: string;
  manualChecks: string[];
  scope: string;
}
