// jest-axe ships no type declarations. This file describes only the part
// the tests use.
declare module "jest-axe" {
  export type AxeViolation = {
    id: string;
    impact: string | null;
    description: string;
    help: string;
  };

  export type AxeResults = {
    violations: AxeViolation[];
  };

  export function axe(html: Element | string): Promise<AxeResults>;
}
