import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------- tipos DTO

export type ClassroomConnectionInfo = {
  connected: boolean;
  email: string | null;
  expired: boolean;
};

export type ClassroomLinkInfo = {
  courseId: string;
  courseName: string;
  section: string | null;
  lastSyncedAt: string | null;
} | null;

export type ClassroomRosterRow = {
  classroomUserId: string;
  classroomName: string;
  classroomEmail: string;
  status: "auto_email" | "manual" | "pending" | "ignored";
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
};

export type ClassroomAcademyRow = {
  studentId: string;
  fullName: string;
  email: string;
  linked: boolean;
};

export type ClassroomSyncResult = {
  connection: ClassroomConnectionInfo;
  link: ClassroomLinkInfo;
  classroomStudents: number;
  autoMatches: number;
  manualMatches: number;
  pending: number;
  ignored: number;
  missingInClassroom: number;
  rows: ClassroomRosterRow[];
  academy: ClassroomAcademyRow[];
};

// ------------------------------------------------------------- autorização

async function assertInstructorOfClass(
  supabase: { from: (t: "classes") => any },
  classId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, instructor_id, name")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.instructor_id !== userId) {
    throw new Error("Você não é responsável por esta turma.");
  }
  return data as { id: string; instructor_id: string; name: string };
}

function requestOrigin(): string {
  const request = getRequest();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) return `${forwardedProto ?? "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

// ------------------------------------------------------------- conexão OAuth

export const startGoogleClassroomAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string; returnPath?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { buildAuthorizationUrl, signState } = await import("@/lib/google-classroom.server");
    const origin = requestOrigin();
    const r =
      data.returnPath && /^\/instructor\/[A-Za-z0-9/_-]*$/.test(data.returnPath) ? data.returnPath : undefined;
    const state = await signState({
      u: context.userId,
      c: data.classId,
      o: origin,
      exp: Date.now() + 10 * 60 * 1000,
      ...(r ? { r } : {}),
    });
    return { url: buildAuthorizationUrl(origin, state) };
  });

export const disconnectGoogleClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_classroom_connections")
      .delete()
      .eq("instructor_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------------------------------------------------------------- utilidades

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function loadAccessToken(admin: AdminClient, instructorId: string) {
  const { data, error } = await admin
    .from("google_classroom_connections")
    .select("google_email, access_token, token_expires_at")
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { connection: { connected: false, email: null, expired: false }, token: null };
  const expired = new Date(data.token_expires_at).getTime() <= Date.now();
  return {
    connection: { connected: true, email: data.google_email, expired },
    token: expired ? null : data.access_token,
  };
}

// ------------------------------------------------------------ turmas Google

export const listClassroomCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { connection, token } = await loadAccessToken(supabaseAdmin, context.userId);
    if (!token) return { connection, courses: [] };
    const { fetchTeachingCourses } = await import("@/lib/google-classroom.server");
    const courses = await fetchTeachingCourses(token);
    return { connection, courses };
  });

export const linkClassroomCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string; courseId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { token } = await loadAccessToken(supabaseAdmin, context.userId);
    if (!token) throw new Error("Conecte a conta Google novamente para vincular a turma.");

    const { fetchTeachingCourses } = await import("@/lib/google-classroom.server");
    const courses = await fetchTeachingCourses(token);
    const course = courses.find((c) => c.id === data.courseId);
    if (!course) throw new Error("Turma do Classroom não encontrada entre as suas turmas.");

    const { error } = await supabaseAdmin.from("google_classroom_class_links").upsert(
      {
        class_id: data.classId,
        classroom_course_id: course.id,
        classroom_course_name: course.name,
        classroom_section: course.section,
        linked_by: context.userId,
      },
      { onConflict: "class_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unlinkClassroomCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove apenas os registros da integração — nada do histórico acadêmico é tocado.
    const links = await supabaseAdmin
      .from("google_classroom_student_links")
      .delete()
      .eq("class_id", data.classId);
    if (links.error) throw new Error(links.error.message);
    const { error } = await supabaseAdmin
      .from("google_classroom_class_links")
      .delete()
      .eq("class_id", data.classId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------ sincronização

export const syncClassroomRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string; refresh?: boolean }) => input)
  .handler(async ({ data, context }): Promise<ClassroomSyncResult> => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeEmail } = await import("@/lib/google-classroom.server");

    const { connection, token } = await loadAccessToken(supabaseAdmin, context.userId);

    const linkRes = await supabaseAdmin
      .from("google_classroom_class_links")
      .select("classroom_course_id, classroom_course_name, classroom_section, last_synced_at")
      .eq("class_id", data.classId)
      .maybeSingle();
    if (linkRes.error) throw new Error(linkRes.error.message);

    const link: ClassroomLinkInfo = linkRes.data
      ? {
          courseId: linkRes.data.classroom_course_id,
          courseName: linkRes.data.classroom_course_name,
          section: linkRes.data.classroom_section,
          lastSyncedAt: linkRes.data.last_synced_at,
        }
      : null;

    // Alunos ATIVAMENTE matriculados na turma do QA Academy.
    const enrollRes = await supabaseAdmin
      .from("enrollments")
      .select("student_id")
      .eq("class_id", data.classId)
      .eq("status", "active");
    if (enrollRes.error) throw new Error(enrollRes.error.message);
    const studentIds = (enrollRes.data ?? []).map((e) => e.student_id);

    const profileRes = studentIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", studentIds)
      : { data: [], error: null };
    if (profileRes.error) throw new Error(profileRes.error.message);
    const profiles = profileRes.data ?? [];

    const existingRes = await supabaseAdmin
      .from("google_classroom_student_links")
      .select("student_id, classroom_user_id, classroom_email, classroom_name, match_type")
      .eq("class_id", data.classId);
    if (existingRes.error) throw new Error(existingRes.error.message);
    let existing = existingRes.data ?? [];

    const ignoredRes = await supabaseAdmin
      .from("google_classroom_ignored_students")
      .select("classroom_user_id")
      .eq("class_id", data.classId);
    if (ignoredRes.error) throw new Error(ignoredRes.error.message);
    const ignoredIds = new Set((ignoredRes.data ?? []).map((r) => r.classroom_user_id));

    const emptyResult: ClassroomSyncResult = {
      connection,
      link,
      classroomStudents: 0,
      autoMatches: 0,
      manualMatches: 0,
      pending: 0,
      ignored: 0,
      missingInClassroom: 0,
      rows: [],
      academy: profiles.map((p) => ({
        studentId: p.id,
        fullName: p.full_name,
        email: p.email,
        linked: existing.some((l) => l.student_id === p.id),
      })),
    };

    if (!token || !link) return emptyResult;

    const { fetchCourseStudents } = await import("@/lib/google-classroom.server");
    const classroomStudents = await fetchCourseStudents(token, link.courseId);

    // 1) reaproveita vínculos já salvos (prioridade ao classroom_user_id)
    const linkByClassroomUser = new Map(existing.map((l) => [l.classroom_user_id, l]));
    const linkedStudentIds = new Set(existing.map((l) => l.student_id));

    // 2) correspondência automática estrita por e-mail
    const profileByEmail = new Map<string, Array<(typeof profiles)[number]>>();
    for (const p of profiles) {
      const key = normalizeEmail(p.email);
      if (!key) continue;
      const bucket = profileByEmail.get(key);
      if (bucket) bucket.push(p);
      else profileByEmail.set(key, [p]);
    }

    const toInsert: Array<{
      class_id: string;
      student_id: string;
      classroom_user_id: string;
      classroom_email: string;
      classroom_name: string;
      match_type: "auto_email";
      linked_by: string;
    }> = [];

    for (const student of classroomStudents) {
      if (ignoredIds.has(student.userId)) continue;
      if (linkByClassroomUser.has(student.userId)) continue;
      const candidates = (profileByEmail.get(normalizeEmail(student.email)) ?? []).filter(
        (p) => !linkedStudentIds.has(p.id),
      );
      if (candidates.length !== 1) continue;
      const match = candidates[0]!;
      linkedStudentIds.add(match.id);
      toInsert.push({
        class_id: data.classId,
        student_id: match.id,
        classroom_user_id: student.userId,
        classroom_email: student.email,
        classroom_name: student.name,
        match_type: "auto_email",
        linked_by: context.userId,
      });
    }

    if (toInsert.length) {
      const ins = await supabaseAdmin.from("google_classroom_student_links").insert(toInsert);
      if (ins.error) throw new Error(ins.error.message);
      const reload = await supabaseAdmin
        .from("google_classroom_student_links")
        .select("student_id, classroom_user_id, classroom_email, classroom_name, match_type")
        .eq("class_id", data.classId);
      if (reload.error) throw new Error(reload.error.message);
      existing = reload.data ?? [];
    }

    const finalByClassroomUser = new Map(existing.map((l) => [l.classroom_user_id, l]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const rows: ClassroomRosterRow[] = classroomStudents.map((student) => {
      const saved = finalByClassroomUser.get(student.userId);
      const profile = saved ? profileById.get(saved.student_id) : undefined;
      const status: ClassroomRosterRow["status"] = saved
        ? (saved.match_type as "auto_email" | "manual")
        : ignoredIds.has(student.userId)
          ? "ignored"
          : "pending";
      return {
        classroomUserId: student.userId,
        classroomName: student.name,
        classroomEmail: student.email,
        status,
        studentId: saved?.student_id ?? null,
        studentName: profile?.full_name ?? null,
        studentEmail: profile?.email ?? null,
      };
    });

    const linkedIds = new Set(existing.map((l) => l.student_id));
    const academy: ClassroomAcademyRow[] = profiles.map((p) => ({
      studentId: p.id,
      fullName: p.full_name,
      email: p.email,
      linked: linkedIds.has(p.id),
    }));

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("google_classroom_class_links")
      .update({ last_synced_at: now })
      .eq("class_id", data.classId);

    return {
      connection,
      link: { ...link, lastSyncedAt: now },
      classroomStudents: classroomStudents.length,
      autoMatches: rows.filter((r) => r.status === "auto_email").length,
      manualMatches: rows.filter((r) => r.status === "manual").length,
      pending: rows.filter((r) => r.status === "pending").length,
      ignored: rows.filter((r) => r.status === "ignored").length,
      missingInClassroom: academy.filter((a) => !a.linked).length,
      rows,
      academy,
    };
  });

// --------------------------------------------------------- vínculo manual

export const linkClassroomStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      classId: string;
      studentId: string;
      classroomUserId: string;
      classroomEmail: string;
      classroomName: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // O aluno precisa estar ativamente matriculado nesta turma do QA Academy.
    const enroll = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("class_id", data.classId)
      .eq("student_id", data.studentId)
      .eq("status", "active")
      .maybeSingle();
    if (enroll.error) throw new Error(enroll.error.message);
    if (!enroll.data) throw new Error("Este aluno não está matriculado nesta turma.");

    const { error } = await supabaseAdmin.from("google_classroom_student_links").insert({
      class_id: data.classId,
      student_id: data.studentId,
      classroom_user_id: data.classroomUserId,
      classroom_email: data.classroomEmail,
      classroom_name: data.classroomName,
      match_type: "manual",
      linked_by: context.userId,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Este vínculo já existe para esta turma.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const unlinkClassroomStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string; classroomUserId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_classroom_student_links")
      .delete()
      .eq("class_id", data.classId)
      .eq("classroom_user_id", data.classroomUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------- ignorar / reavaliar aluno

export const ignoreClassroomStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      classId: string;
      classroomUserId: string;
      classroomEmail: string;
      classroomName: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só faz sentido ignorar quem ainda não possui vínculo nesta turma.
    const linked = await supabaseAdmin
      .from("google_classroom_student_links")
      .select("id")
      .eq("class_id", data.classId)
      .eq("classroom_user_id", data.classroomUserId)
      .maybeSingle();
    if (linked.error) throw new Error(linked.error.message);
    if (linked.data) throw new Error("Este aluno já possui vínculo nesta turma.");

    const { error } = await supabaseAdmin.from("google_classroom_ignored_students").insert({
      class_id: data.classId,
      classroom_user_id: data.classroomUserId,
      classroom_email: data.classroomEmail,
      classroom_name: data.classroomName,
      ignored_by: context.userId,
    });
    if (error) {
      if (error.code === "23505") return { ok: true };
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const unignoreClassroomStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classId: string; classroomUserId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertInstructorOfClass(context.supabase as never, data.classId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_classroom_ignored_students")
      .delete()
      .eq("class_id", data.classId)
      .eq("classroom_user_id", data.classroomUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------ Fase 2: publicar missão

export type MissionClassroomTarget = {
  classId: string;
  className: string;
  courseName: string;
  publication: { courseWorkId: string; alternateLink: string | null; lastPublishedAt: string } | null;
};

async function loadMissionForPublish(supabase: any, missionId: string) {
  const { data, error } = await supabase
    .from("builder_missions")
    .select("id, title, subtitle, objective, description, due_at, status")
    .eq("id", missionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Missão não encontrada.");
  return data as {
    id: string; title: string; subtitle: string; objective: string; description: string;
    due_at: string | null; status: string;
  };
}

/** Turmas do instrutor aplicáveis à missão que possuem vínculo com o Classroom. */
async function applicableClassIds(supabase: any, missionId: string, userId: string) {
  const classesRes = await supabase.from("classes").select("id, name").eq("instructor_id", userId);
  if (classesRes.error) throw new Error(classesRes.error.message);
  const own = (classesRes.data ?? []) as { id: string; name: string }[];
  const assignRes = await supabase
    .from("builder_mission_assignments")
    .select("class_id")
    .eq("mission_id", missionId);
  if (assignRes.error) throw new Error(assignRes.error.message);
  const assigned = new Set(((assignRes.data ?? []) as { class_id: string }[]).map((a) => a.class_id));
  // Sem turmas selecionadas = missão disponível a todas as turmas.
  return assigned.size ? own.filter((c) => assigned.has(c.id)) : own;
}

export const listMissionClassroomTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { missionId: string }) => input)
  .handler(async ({ data, context }) => {
    const classes = await applicableClassIds(context.supabase, data.missionId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { connection } = await loadAccessToken(supabaseAdmin, context.userId);
    const ids = classes.map((c) => c.id);
    if (!ids.length) return { connection, targets: [] as MissionClassroomTarget[] };
    const links = await supabaseAdmin
      .from("google_classroom_class_links")
      .select("class_id, classroom_course_name")
      .in("class_id", ids);
    if (links.error) throw new Error(links.error.message);
    const pubs = await supabaseAdmin
      .from("google_classroom_coursework")
      .select("class_id, coursework_id, alternate_link, last_published_at")
      .eq("mission_id", data.missionId)
      .in("class_id", ids);
    if (pubs.error) throw new Error(pubs.error.message);
    const targets: MissionClassroomTarget[] = [];
    for (const c of classes) {
      const link = (links.data ?? []).find((l) => l.class_id === c.id);
      if (!link) continue;
      const pub = (pubs.data ?? []).find((p) => p.class_id === c.id);
      targets.push({
        classId: c.id,
        className: c.name,
        courseName: link.classroom_course_name,
        publication: pub
          ? { courseWorkId: pub.coursework_id, alternateLink: pub.alternate_link, lastPublishedAt: pub.last_published_at }
          : null,
      });
    }
    return { connection, targets };
  });

async function prepareMissionPublish(
  context: { supabase: any; userId: string },
  missionId: string,
  classId: string,
) {
  await assertInstructorOfClass(context.supabase, classId, context.userId);
  const allowed = await applicableClassIds(context.supabase, missionId, context.userId);
  if (!allowed.some((c) => c.id === classId)) throw new Error("Esta turma não tem acesso a esta missão.");
  const mission = await loadMissionForPublish(context.supabase, missionId);
  if (mission.status !== "published") throw new Error("Publique a missão no QA Academy antes de enviá-la ao Classroom.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { token } = await loadAccessToken(supabaseAdmin, context.userId);
  if (!token) throw new Error("Reconecte sua conta Google para publicar no Classroom.");
  const link = await supabaseAdmin
    .from("google_classroom_class_links")
    .select("classroom_course_id")
    .eq("class_id", classId)
    .maybeSingle();
  if (link.error) throw new Error(link.error.message);
  if (!link.data) throw new Error("Esta turma não está vinculada a uma turma do Google Classroom.");
  const summary = (mission.objective || mission.subtitle || mission.description || "").trim();
  const input = {
    title: mission.title,
    description: summary.length > 1500 ? `${summary.slice(0, 1497)}...` : summary,
    link: `${requestOrigin()}/student/activities/${mission.id}`,
    dueAt: mission.due_at,
  };
  return { supabaseAdmin, token, courseId: link.data.classroom_course_id, input };
}

export const publishMissionToClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { missionId: string; classId: string }) => input)
  .handler(async ({ data, context }) => {
    const prep = await prepareMissionPublish(context, data.missionId, data.classId);
    const existing = await prep.supabaseAdmin
      .from("google_classroom_coursework")
      .select("id")
      .eq("mission_id", data.missionId)
      .eq("class_id", data.classId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) throw new Error("Esta missão já foi publicada nesta turma. Use \"Atualizar no Google Classroom\".");
    const { createCourseWork } = await import("@/lib/google-classroom.server");
    const created = await createCourseWork(prep.token, prep.courseId, prep.input);
    const { error } = await prep.supabaseAdmin.from("google_classroom_coursework").insert({
      mission_id: data.missionId,
      class_id: data.classId,
      classroom_course_id: prep.courseId,
      coursework_id: created.id,
      alternate_link: created.alternateLink,
      published_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMissionInClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { missionId: string; classId: string }) => input)
  .handler(async ({ data, context }) => {
    const prep = await prepareMissionPublish(context, data.missionId, data.classId);
    const existing = await prep.supabaseAdmin
      .from("google_classroom_coursework")
      .select("id, classroom_course_id, coursework_id")
      .eq("mission_id", data.missionId)
      .eq("class_id", data.classId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Esta missão ainda não foi publicada nesta turma.");
    const { patchCourseWork } = await import("@/lib/google-classroom.server");
    const updated = await patchCourseWork(
      prep.token,
      existing.data.classroom_course_id,
      existing.data.coursework_id,
      prep.input,
    );
    const { error } = await prep.supabaseAdmin
      .from("google_classroom_coursework")
      .update({ alternate_link: updated.alternateLink, last_published_at: new Date().toISOString() })
      .eq("id", existing.data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
