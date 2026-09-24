import { createFileRoute } from "@tanstack/react-router";

import {
  exchangeCodeForAccessToken,
  fetchOwnProfile,
  verifyState,
} from "@/lib/google-classroom.server";

function back(origin: string, classId: string | null, status: string) {
  const target = classId
    ? `${origin}/instructor/classes/${classId}?gclassroom=${status}`
    : `${origin}/instructor/classes?gclassroom=${status}`;
  return new Response(null, { status: 302, headers: { location: target } });
}

export const Route = createFileRoute("/api/public/google-classroom/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;

        const state = await verifyState(url.searchParams.get("state"));
        if (!state) {
          return back(origin, null, "invalid_state");
        }
        if (url.searchParams.get("error")) {
          return back(origin, state.c, "denied");
        }
        const code = url.searchParams.get("code");
        if (!code) {
          return back(origin, state.c, "denied");
        }

        try {
          const { accessToken, expiresAt } = await exchangeCodeForAccessToken(code, state.o || origin);
          const profile = await fetchOwnProfile(accessToken);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("google_classroom_connections")
            .upsert(
              {
                instructor_id: state.u,
                google_email: profile.email,
                google_user_id: profile.googleUserId,
                access_token: accessToken,
                token_expires_at: expiresAt,
              },
              { onConflict: "instructor_id" },
            );
          if (error) throw new Error(error.message);
        } catch (e) {
          console.error("[google-classroom] callback failed", e);
          return back(origin, state.c, "error");
        }

        return back(origin, state.c, "connected");
      },
    },
  },
});
