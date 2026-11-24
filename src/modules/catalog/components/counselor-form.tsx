"use client";

import { useActionState } from "react";
import { deleteCounselor, saveCounselor, type CatalogActionState } from "@/modules/catalog/actions";
import { COUNSELOR_CATEGORIES } from "@/modules/catalog/categories";
import type { Database } from "@/types/database.types";

type Counselor = Database["public"]["Tables"]["counselors"]["Row"];
const initialState: CatalogActionState = { status: "idle", message: "" };

export function CounselorForm({ counselor }: { counselor?: Counselor }) {
  const [state, action, pending] = useActionState(saveCounselor, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCounselor, initialState);
  return (
    <div className="catalog-editor">
      <form action={action} className="catalog-form">
        <input type="hidden" name="id" value={counselor?.id ?? ""} />
        <label>
          Counselor account ID
          <input
            name="profile_id"
            defaultValue={counselor?.profile_id}
            readOnly={!!counselor}
            required
          />
        </label>
        <label>
          Display name
          <input
            name="display_name"
            defaultValue={counselor?.display_name}
            maxLength={120}
            required
          />
        </label>
        <label>
          Biography
          <textarea name="bio" defaultValue={counselor?.bio} maxLength={3000} required />
        </label>
        <label>
          Qualifications
          <textarea
            name="qualifications"
            defaultValue={counselor?.qualifications}
            maxLength={1000}
            required
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={counselor?.category ?? ""} required>
            <option value="" disabled>
              Select a category
            </option>
            {COUNSELOR_CATEGORIES.map((category) => (
              <option value={category.value} key={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Experience
          <input name="experience" defaultValue={counselor?.experience} maxLength={500} required />
        </label>
        <label>
          Specializations
          <input
            name="specialties"
            defaultValue={counselor?.specialties}
            maxLength={1000}
            required
          />
        </label>
        <label>
          Languages
          <input name="languages" defaultValue={counselor?.languages} maxLength={500} required />
        </label>
        <label>
          Approved image URL
          <input
            name="photo_url"
            type="url"
            defaultValue={counselor?.photo_url}
            maxLength={2048}
            required
          />
        </label>
        <label className="catalog-checkbox">
          <input type="checkbox" name="published" defaultChecked={counselor?.published} /> Published
        </label>
        <p className="muted">
          Publish only after the counselor’s qualifications have been verified.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save profile"}
        </button>
        {state.message && (
          <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
        )}
      </form>
      {counselor && (
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm("Delete this counselor profile?")) event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={counselor.id} />
          <button type="submit" disabled={deletePending}>
            {deletePending ? "Deleting..." : "Delete profile"}
          </button>
          {deleteState.message && (
            <p role={deleteState.status === "error" ? "alert" : "status"}>{deleteState.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
