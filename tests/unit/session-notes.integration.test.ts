import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, vi } from "vitest";
import { localDb, localSettings } from "../helpers/local-supabase";
vi.mock("server-only", () => ({}));
import { loadNoteForEditor, persistNote } from "@/modules/session-notes/server";

// Opt-in real local DB test: no network/DB substitutions. Framework marker only is stubbed.
test.skipIf(process.env.RUN_PRIVATE_NOTES_INTEGRATION !== "1")(
  "lost-response replay survives key rotation and cannot replace a later revision",
  async () => {
    const settings = localSettings();
    const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const users: string[] = [];
    const counselor = randomUUID(),
      booking = randomUUID();
    const original = {
      mode: process.env.COUNSELOR_WORKSPACE_MODE,
      id: process.env.PRIVATE_CONTENT_ACTIVE_KEY_ID,
      keys: process.env.PRIVATE_CONTENT_KEYS,
    };
    try {
      for (let i = 0; i < 3; i++) {
        const result = await service.auth.admin.createUser({
          phone: `+9197${randomInt(10000000, 99999999)}`,
          phone_confirm: true,
          user_metadata: { synthetic_note_rotation_test: true },
        });
        if (result.error || !result.data.user) throw new Error("Synthetic account creation failed");
        users.push(result.data.user.id);
      }
      const [admin, actor, customer] = users;
      localDb(`begin;
        update public.profiles set role='admin',email='rotation-admin@example.test' where id='${admin}';
        update public.profiles set role='counselor',email='rotation-counselor@example.test' where id='${actor}';
        update public.profiles set email='rotation-customer@example.test' where id='${customer}';
        select set_config('request.jwt.claim.sub','${admin}',true);
        insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,category,specialties,languages,photo_url,published)
        values('${counselor}','${actor}','Rotation Fixture','Test','Test','Test','consultant_psychologist','Stress','English','https://example.test/a.png',true);
        insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at)
        values('${booking}','${customer}','${counselor}',now()-interval '2 days',now()-interval '2 days'+interval '45 minutes',now()-interval '2 days'+interval '1 hour','confirmed',now()-interval '3 days');commit;`);
      const v1 = randomBytes(32).toString("hex"),
        v2 = randomBytes(32).toString("hex");
      process.env.COUNSELOR_WORKSPACE_MODE = "local";
      process.env.PRIVATE_CONTENT_ACTIVE_KEY_ID = "v1";
      process.env.PRIVATE_CONTENT_KEYS = JSON.stringify({ v1 });
      const first = {
        bookingId: booking,
        expectedVersion: 0,
        requestId: randomUUID(),
        body: "Fictional retry before rotation.",
        acknowledged: true,
      };
      // The first response is deliberately ignored, simulating a lost response.
      await persistNote(actor, first);
      process.env.PRIVATE_CONTENT_ACTIVE_KEY_ID = "v2";
      process.env.PRIVATE_CONTENT_KEYS = JSON.stringify({ v1, v2 });
      expect(await persistNote(actor, first)).toMatchObject({ status: "saved", version: 1 });
      expect(await loadNoteForEditor(actor, booking)).toEqual({ body: first.body, version: 1 });
      expect(
        await persistNote(actor, {
          ...first,
          expectedVersion: 1,
          requestId: randomUUID(),
          body: "Fictional rotated revision.",
        }),
      ).toMatchObject({ status: "saved", version: 2 });
      expect(await persistNote(actor, first)).toMatchObject({ status: "conflict" });
      expect(await loadNoteForEditor(actor, booking)).toEqual({
        body: "Fictional rotated revision.",
        version: 2,
      });
      const stored = await service
        .from("session_notes")
        .select("version,envelope")
        .eq("booking_id", booking)
        .single();
      expect(stored.error).toBeNull();
      expect(stored.data!.envelope.key_id).toBe("v2");
      expect(JSON.stringify(stored.data)).not.toContain("Fictional");
      const audits = await service
        .from("session_note_audit_events")
        .select("id", { count: "exact" })
        .eq("booking_id", booking)
        .eq("action", "saved");
      expect(audits.error).toBeNull();
      expect(audits.count).toBe(2);
    } finally {
      for (const [name, value] of Object.entries({
        COUNSELOR_WORKSPACE_MODE: original.mode,
        PRIVATE_CONTENT_ACTIVE_KEY_ID: original.id,
        PRIVATE_CONTENT_KEYS: original.keys,
      })) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      if (users.length) {
        localDb(`begin;select set_config('request.jwt.claim.sub','${users[0]}',true);
        delete from public.bookings where id='${booking}';
        delete from public.counselors where id='${counselor}';
        delete from public.counselor_catalog_audit_events where actor_user_id='${users[0]}';commit;`);
        for (const id of users) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
      }
    }
  },
  30000,
);
