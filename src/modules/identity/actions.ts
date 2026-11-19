"use server";

import { phoneOtpOptions, isStagingUserAllowed, readDeployment } from "@/lib/deployment";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeIndianPhone } from "@/modules/identity/phone";
import { safeBookingReturn } from "@/modules/booking/return-path";
import type { ProfileRole } from "@/modules/identity/roles";
import {
  requireAuthenticatedProfile,
  requireProfile,
  requireProfileRole,
} from "@/modules/identity/server/access";

export type IdentityActionState = {
  status: "idle" | "error" | "otp_sent" | "success";
  message: string;
  phone?: string;
  preferredName?: string;
};

const emptyActionState: IdentityActionState = {
  status: "idle",
  message: "",
};

const preferredNameSchema = z.string().trim().max(80).optional();
const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);
const profileSchema = z.object({
  preferredName: z.string().trim().min(1).max(80),
});
const contactEmailSchema = z.string().trim().email().max(254);

export async function requestPhoneOtp(
  _previousState: IdentityActionState = emptyActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  void _previousState;

  if (formData.get("adultConfirmed") !== "on") {
    return { status: "error", message: "Confirm that you are 18 or older to continue." };
  }

  const phone = normalizeIndianPhone(String(formData.get("phone") ?? ""));
  const nameResult = preferredNameSchema.safeParse(
    String(formData.get("preferredName") ?? "").trim() || undefined,
  );

  if (!phone || !nameResult.success) {
    return { status: "error", message: "Enter a valid Indian mobile number and preferred name." };
  }

  const options = phoneOtpOptions(process.env, phone);
  if (!options) return { status: "error", message: "This staging account is not available." };
  const metadata = nameResult.data ? { preferred_name: nameResult.data } : undefined;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { ...options, data: metadata },
  });

  if (error) {
    return { status: "error", message: "We could not send a code. Wait a moment and try again." };
  }

  return {
    status: "otp_sent",
    message: "Enter the one-time code to continue.",
    phone,
    preferredName: nameResult.data,
  };
}

export async function verifyPhoneOtp(
  _previousState: IdentityActionState = emptyActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  void _previousState;

  const phone = normalizeIndianPhone(String(formData.get("phone") ?? ""));
  const otp = otpSchema.safeParse(String(formData.get("otp") ?? ""));
  const nameResult = preferredNameSchema.safeParse(
    String(formData.get("preferredName") ?? "").trim() || undefined,
  );

  if (!phone || !otp.success || !nameResult.success) {
    return { status: "error", message: "The code could not be verified. Check it and try again." };
  }

  if (!phoneOtpOptions(process.env, phone))
    return { status: "error", message: "This staging account is not available." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token: otp.data, type: "sms" });

  if (error) {
    return { status: "error", message: "The code could not be verified. Check it and try again." };
  }

  if (readDeployment(process.env).kind === "staging") {
    const { data: verifiedClaims } = await supabase.auth.getClaims();
    const verifiedId = verifiedClaims?.claims?.sub;
    if (typeof verifiedId !== "string" || !isStagingUserAllowed(process.env, verifiedId)) {
      await supabase.auth.signOut();
      return { status: "error", message: "This account does not have staging access." };
    }
  }
  if (nameResult.data) {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return { status: "error", message: "The account could not be loaded. Sign in again." };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ preferred_name: nameResult.data })
      .eq("id", userData.user.id);

    if (profileError) {
      return { status: "error", message: "The preferred name could not be saved. Try again." };
    }
  }

  redirect(safeBookingReturn(formData.get("next")) ?? "/profile");
}

export async function updateOwnProfile(
  _previousState: IdentityActionState = emptyActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  void _previousState;

  const profile = await requireProfile();
  const parsed = profileSchema.safeParse({
    preferredName: formData.get("preferredName"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Check the preferred name and email fields." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      preferred_name: parsed.data.preferredName,
    })
    .eq("id", profile.id);

  if (error) {
    return { status: "error", message: "Profile changes could not be saved." };
  }

  revalidatePath("/profile");
  return { status: "success", message: "Profile updated." };
}

export async function completeContactEmail(
  _previousState: IdentityActionState = emptyActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  void _previousState;

  const profile = await requireAuthenticatedProfile();

  if (profile.email) {
    redirect(safeBookingReturn(formData.get("next")) ?? "/profile");
  }

  const parsedEmail = contactEmailSchema.safeParse(formData.get("email"));

  if (!parsedEmail.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createSupabaseServerClient();
  const normalizedEmail = parsedEmail.data.trim().toLowerCase();
  const { error } = await supabase.rpc("set_own_contact_email", {
    p_email: normalizedEmail,
  });

  if (error) {
    return { status: "error", message: "The contact email could not be saved. Try again." };
  }

  const { data: savedProfile, error: readError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profile.id)
    .maybeSingle();

  if (readError || savedProfile?.email !== normalizedEmail) {
    return { status: "error", message: "The contact email could not be confirmed. Try again." };
  }

  revalidatePath("/profile");
  return { status: "success", message: "Contact email saved." };
}

export async function assignProfileRole(
  _previousState: IdentityActionState = emptyActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  void _previousState;

  await requireProfileRole("admin");

  const role = String(formData.get("role") ?? "");
  const targetUserId = z.string().uuid().safeParse(formData.get("targetUserId"));
  const reason = z.string().trim().min(10).max(500).safeParse(formData.get("reason"));
  const verificationReference = String(formData.get("verificationReference") ?? "").trim();

  if (
    !targetUserId.success ||
    !reason.success ||
    !["customer", "counselor", "admin"].includes(role) ||
    (role === "counselor" && !verificationReference)
  ) {
    return {
      status: "error",
      message: "Check the target account, role, reason, and counselor verification reference.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("grant_profile_role", {
    p_target_user_id: targetUserId.data,
    p_new_role: role as ProfileRole,
    p_reason: reason.data,
    p_counselor_verification_reference: role === "counselor" ? verificationReference : null,
  });

  if (error) {
    return {
      status: "error",
      message: "The role could not be assigned. Verify the account and authorization.",
    };
  }

  revalidatePath("/admin");
  return { status: "success", message: "Role assignment recorded." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
