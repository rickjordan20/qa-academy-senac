import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext, useAuth, type AuthValue } from "@/lib/auth";

/**
 * Modo "Ver como aluno".
 * - Autorização: sempre no banco (start_student_view / get_student_view revalidam
 *   instrutor da turma + matrícula ativa a cada leitura).
 * - Somente leitura (garantia real): gatilho zz_student_view_guard em todas as tabelas
 *   públicas + políticas restritivas no armazenamento de arquivos rejeitam qualquer
 *   gravação do instrutor enquanto a sessão existe.
 * - Camadas de interface (conveniência): guarda no cliente e telas em modo leitura.
 */
export type StudentView = {
  student_id: string;
  class_id: string;
  student_name: string;
  student_email: string;
  class_name: string | null;
  expires_at: string;
};

const SESSION_KEY = ["student-view", "session"] as const;

export function useStudentViewSession(enabled: boolean) {
  return useQuery({
    queryKey: SESSION_KEY,
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<StudentView | null> => {
      const { data, error } = await supabase.rpc("get_student_view" as never);
      if (error) throw error;
      return (data as unknown as StudentView | null) ?? null;
    },
  });
}

/** Remove apenas o cache do aluno simulado (e da própria simulação). */
export function clearStudentViewCache(qc: QueryClient, studentId: string | null | undefined) {
  qc.removeQueries({ queryKey: ["student-view"] });
  if (!studentId) return;
  qc.removeQueries({
    predicate: (q) => JSON.stringify(q.queryKey).includes(studentId),
  });
}

export function useStartStudentView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, classId }: { studentId: string; classId: string }) => {
      const prev = qc.getQueryData<StudentView | null>(SESSION_KEY);
      const { error } = await supabase.rpc("start_student_view" as never, {
        _student_id: studentId,
        _class_id: classId,
      } as never);
      if (error) throw error;
      clearStudentViewCache(qc, prev?.student_id);
      clearStudentViewCache(qc, studentId);
    },
  });
}

export async function endStudentView(qc: QueryClient) {
  const prev = qc.getQueryData<StudentView | null>(SESSION_KEY);
  await supabase.rpc("end_student_view" as never);
  clearStudentViewCache(qc, prev?.student_id);
}

/* --------------------- contexto da simulação ativa --------------------- */

const StudentViewContext = createContext<StudentView | null>(null);

/** Retorna a simulação ativa (null no uso normal do aluno). */
export function useStudentView() {
  return useContext(StudentViewContext);
}

/* ---------------- guarda de escrita no cliente (camada UI) -------------- */

const ALLOWED_RPCS = new Set([
  "get_student_view",
  "get_student_view_missions",
  "end_student_view",
  "start_student_view",
  "gam_ranking_individual",
  "gam_ranking_teams",
]);
const BLOCK_MSG = 'Modo "Ver como aluno": alterações estão bloqueadas.';

let guardDepth = 0;
let restore: (() => void) | null = null;

function blocked() {
  return Promise.reject(new Error(BLOCK_MSG));
}

function installGuard() {
  guardDepth += 1;
  if (guardDepth > 1) return;
  const client = supabase as unknown as Record<string, unknown> & {
    from: (t: string) => Record<string, unknown>;
    rpc: (fn: string, ...rest: unknown[]) => unknown;
    storage: { from: (b: string) => Record<string, unknown> };
  };
  const origFrom = client.from;
  const origRpc = client.rpc;
  const origStorageFrom = client.storage.from;
  client.from = function (table: string) {
    const qb = origFrom.call(supabase, table);
    for (const m of ["insert", "update", "upsert", "delete"]) qb[m] = () => ({ then: (r: unknown, j: (e: Error) => void) => blocked().then(r as never, j), throwOnError: () => blocked() });
    return qb;
  };
  client.rpc = function (fn: string, ...rest: unknown[]) {
    if (!ALLOWED_RPCS.has(fn)) return { then: (r: unknown, j: (e: Error) => void) => blocked().then(r as never, j) };
    return origRpc.call(supabase, fn, ...rest);
  };
  client.storage.from = function (bucket: string) {
    const api = origStorageFrom.call(client.storage, bucket);
    for (const m of ["upload", "update", "remove", "move", "copy", "uploadToSignedUrl", "createSignedUploadUrl"]) api[m] = () => blocked();
    return api;
  };
  restore = () => {
    client.from = origFrom;
    client.rpc = origRpc;
    client.storage.from = origStorageFrom;
  };
}

function uninstallGuard() {
  guardDepth = Math.max(0, guardDepth - 1);
  if (guardDepth === 0 && restore) {
    restore();
    restore = null;
  }
}

/** Substitui a identidade exibida pela do aluno, sem tocar na sessão real. */
export function StudentViewProvider({ view, children }: { view: StudentView; children: ReactNode }) {
  const auth = useAuth();
  useLayoutEffect(() => {
    installGuard();
    return uninstallGuard;
  }, []);

  const value: AuthValue = {
    ...auth,
    user: { ...(auth.user as User), id: view.student_id, email: view.student_email } as User,
    profile: { id: view.student_id, full_name: view.student_name, email: view.student_email, avatar_url: null },
    role: "student",
    refresh: () => undefined,
  };
  return (
    <StudentViewContext.Provider value={view}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </StudentViewContext.Provider>
  );
}
