"use server";

import { revalidatePath } from "next/cache";
import { setValue } from "./store";

export async function saveControlled(formData: FormData) {
  const value = String(formData.get("value") ?? "");
  setValue(value);
  revalidatePath("/test-cache-repro");
}

export async function saveUncontrolled(formData: FormData) {
  const value = String(formData.get("value") ?? "");
  setValue(value);
  revalidatePath("/test-cache-repro");
}
