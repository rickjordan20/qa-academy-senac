import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buttons: [] as Array<{ children?: React.ReactNode; onClick?: () => void }>,
  retestMutate: vi.fn(),
  retestHookSpy: vi.fn(),
  unifiedBugs: [] as any[],
  qaBugs: [] as any[],
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => {
    mocks.buttons.push({ children, onClick });
    return <button>{children}</button>;
  },
}));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/qa/ModuleFeatureSelect", () => ({ ModuleFeatureSelect: () => null, featureTrace: () => "—" }));
vi.mock("@/components/qa/TestCasesPanel", () => ({
  Block: () => null,
  Field: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NativeSelect: () => null,
}));

vi.mock("@/lib/inventory", () => ({
  projectLabel: () => "Café Central",
  useFeatures: () => ({ data: [] }),
  useModules: () => ({ data: [] }),
}));

vi.mock("@/lib/qa-unified", () => ({
  useUnifiedBugs: () => ({ data: mocks.unifiedBugs, isPending: false }),
}));

vi.mock("@/lib/qa", () => ({
  BUG_STATUSES: [],
  PRIORITIES: [],
  SEVERITIES: [],
  bugStatusLabel: () => "",
  labelOf: () => "",
  shortId: () => "",
  useBugs: () => ({ data: mocks.qaBugs }),
  useCreateBug: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBug: () => ({ mutate: vi.fn() }),
  useProfileNames: () => ({ data: {} }),
  useQaMissions: () => ({ data: [] }),
  useRetests: () => ({ data: [] }),
  useTestCases: () => ({ data: [] }),
  useUpdateBug: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/qa-retest-atomic", () => ({
  useRegisterRetestAtomic: mocks.retestHookSpy,
}));

import { BugsPanel } from "./BugsPanel";

describe("BugsPanel", () => {
  beforeEach(() => {
    mocks.buttons.length = 0;
    mocks.retestMutate.mockReset();
    mocks.retestHookSpy.mockReset();
    mocks.retestHookSpy.mockImplementation(() => ({ mutate: mocks.retestMutate, isPending: false }));
    mocks.unifiedBugs = [];
    mocks.qaBugs = [];
  });

  it("usa o hook atômico de reteste na montagem", () => {
    const scope = { context: "cafe" as const, groupId: "group-1" };
    renderToString(<BugsPanel scope={scope} userId="tester-1" />);
    expect(mocks.retestHookSpy).toHaveBeenCalledWith(scope, "tester-1");
  });

  it("aciona mutate do hook atômico ao clicar em Resolvido", () => {
    mocks.unifiedBugs = [
      {
        id: "bug-1",
        title: "Falha X",
        status: "pronto_reteste",
        origin: "qa",
        linkKind: "none",
        createdAt: new Date().toISOString(),
      },
    ];
    mocks.qaBugs = [{ id: "bug-1" }];

    renderToString(<BugsPanel scope={{ context: "cafe", groupId: "group-1" }} userId="tester-1" />);

    const resolveButton = mocks.buttons.find((button) => button.children === "Resolvido");
    expect(resolveButton?.onClick).toBeTypeOf("function");
    resolveButton?.onClick?.();

    expect(mocks.retestMutate).toHaveBeenCalledWith(
      { bug_id: "bug-1", result: "resolvido", notes: "" },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });
});
