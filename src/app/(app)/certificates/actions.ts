"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function saveSchoolSettings(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const schoolName = String(formData.get("school_name") ?? "").trim();
  const schoolAddress = String(formData.get("school_address") ?? "").trim();
  const schoolPhone = String(formData.get("school_phone") ?? "").trim();
  const principalName = String(formData.get("principal_name") ?? "").trim();

  const { error } = await supabase.from("school_settings").upsert({
    id: 1,
    school_name: schoolName,
    school_address: schoolAddress,
    school_phone: schoolPhone,
    principal_name: principalName,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/certificates");
}
