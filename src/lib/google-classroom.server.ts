// Google Classroom — Fase 1 (somente leitura / conciliação de identidades).
// Este módulo é server-only: nunca deve ser importado por componentes ou rotas do cliente.

export const GOOGLE_CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
] as const;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLASSROOM_API = "https://classroom.googleapis.com/v1";

export const OAUTH_CALLBACK_PATH = "/api/public/google-classroom/callback";

export type GoogleCredentials = { clientId: string; clientSecret: string };

export function readGoogleCredentials(): GoogleCredentials {
  const clientId = process.env["GOOGLE_CLASSROOM_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLASSROOM_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "A integração com o Google Classroom ainda não foi configurada. Cadastre as credenciais do Google e tente novamente.",
    );
  }
  return { clientId, clientSecret };
}

function stateSecret(): string {
  const secret = process.env["GOOGLE_CLASSROOM_STATE_SECRET"];
  if (!secret) throw new Error("Configuração de segurança da integração ausente.");
  return secret;
}

// ---------------------------------------------------------------- state HMAC

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(stateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

export type OAuthState = { u: string; c: string; o: string; exp: number };

export async function signState(state: OAuthState): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(state)));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyState(raw: string | null): Promise<OAuthState | null> {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = await hmac(payload);
  // comparação em tempo constante
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as OAuthState;
    if (!parsed.u || !parsed.c || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------- OAuth

export function buildAuthorizationUrl(origin: string, state: string): string {
  const { clientId } = readGoogleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}${OAUTH_CALLBACK_PATH}`,
    response_type: "code",
    scope: GOOGLE_CLASSROOM_SCOPES.join(" "),
    include_granted_scopes: "false",
    prompt: "consent select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type ExchangedToken = { accessToken: string; expiresAt: string };

export async function exchangeCodeForAccessToken(
  code: string,
  origin: string,
): Promise<ExchangedToken> {
  const { clientId, clientSecret } = readGoogleCredentials();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}${OAUTH_CALLBACK_PATH}`,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(`[google-classroom] token exchange failed [${response.status}]: ${body}`);
    throw new Error("Não foi possível concluir a conexão com o Google.");
  }
  const parsed = JSON.parse(body) as { access_token?: string; expires_in?: number };
  if (!parsed.access_token) throw new Error("O Google não devolveu uma autorização válida.");
  const expiresIn = typeof parsed.expires_in === "number" ? parsed.expires_in : 3600;
  return {
    accessToken: parsed.access_token,
    expiresAt: new Date(Date.now() + (expiresIn - 60) * 1000).toISOString(),
  };
}

// --------------------------------------------------------------- Classroom

async function classroomGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${CLASSROOM_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(`[google-classroom] GET ${path} failed [${response.status}]: ${body}`);
    if (response.status === 401 || response.status === 403) {
      throw new Error("A autorização do Google expirou ou é insuficiente. Conecte a conta novamente.");
    }
    throw new Error("O Google Classroom não respondeu como esperado. Tente novamente.");
  }
  return JSON.parse(body) as T;
}

export async function fetchOwnProfile(accessToken: string) {
  const profile = await classroomGet<{ id?: string; emailAddress?: string; name?: { fullName?: string } }>(
    accessToken,
    "/userProfiles/me",
  );
  return {
    googleUserId: profile.id ?? null,
    email: profile.emailAddress ?? "",
    fullName: profile.name?.fullName ?? "",
  };
}

export type ClassroomCourse = {
  id: string;
  name: string;
  section: string | null;
  state: string | null;
};

export async function fetchTeachingCourses(accessToken: string): Promise<ClassroomCourse[]> {
  const courses: ClassroomCourse[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ teacherId: "me", pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await classroomGet<{
      courses?: Array<{ id?: string; name?: string; section?: string; courseState?: string }>;
      nextPageToken?: string;
    }>(accessToken, `/courses?${query.toString()}`);
    for (const c of page.courses ?? []) {
      if (!c.id) continue;
      courses.push({
        id: c.id,
        name: c.name ?? "Turma sem nome",
        section: c.section ?? null,
        state: c.courseState ?? null,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return courses;
}

export type ClassroomStudent = { userId: string; name: string; email: string };

export async function fetchCourseStudents(
  accessToken: string,
  courseId: string,
): Promise<ClassroomStudent[]> {
  const students: ClassroomStudent[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await classroomGet<{
      students?: Array<{
        userId?: string;
        profile?: { id?: string; name?: { fullName?: string }; emailAddress?: string };
      }>;
      nextPageToken?: string;
    }>(accessToken, `/courses/${encodeURIComponent(courseId)}/students?${query.toString()}`);
    for (const s of page.students ?? []) {
      const userId = s.userId ?? s.profile?.id;
      if (!userId) continue;
      students.push({
        userId,
        name: s.profile?.name?.fullName ?? "",
        email: s.profile?.emailAddress ?? "",
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return students;
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
