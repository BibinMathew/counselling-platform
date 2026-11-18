"use client";

import { useActionState, useState } from "react";
import {
  deleteAvailability,
  saveException,
  saveRule,
  saveSettings,
  type AvailabilityState,
} from "@/modules/availability/actions";
import type {
  AvailabilityException,
  AvailabilityRule,
  AvailabilitySettings,
} from "@/types/database.types";

const initialState: AvailabilityState = { status: "idle", message: "" };
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Result({ state }: { state: AvailabilityState }) {
  return state.message ? (
    <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
  ) : null;
}

function DeleteEntry({
  counselorId,
  id,
  kind,
}: {
  counselorId: string;
  id: string;
  kind: "rule" | "exception";
}) {
  const [state, action, pending] = useActionState(deleteAvailability, initialState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this availability entry?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="counselorId" value={counselorId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <button disabled={pending}>{pending ? "Deleting..." : "Delete"}</button>
      <Result state={state} />
    </form>
  );
}

function RuleForm({ counselorId, rule }: { counselorId: string; rule?: AvailabilityRule }) {
  const [state, action, pending] = useActionState(saveRule, initialState);
  return (
    <div className="availability-editor">
      <form action={action} className="availability-form">
        <input type="hidden" name="counselorId" value={counselorId} />
        <input type="hidden" name="id" value={rule?.id ?? ""} />
        <label>
          Day
          <select name="weekday" defaultValue={rule?.weekday ?? 1}>
            {weekdays.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start time
          <input name="start" type="time" defaultValue={rule?.start_time.slice(0, 5)} required />
        </label>
        <label>
          End time
          <input name="end" type="time" defaultValue={rule?.end_time.slice(0, 5)} required />
        </label>
        <button disabled={pending}>{pending ? "Saving..." : "Save weekly hours"}</button>
        <Result state={state} />
      </form>
      {rule && <DeleteEntry counselorId={counselorId} id={rule.id} kind="rule" />}
    </div>
  );
}

function ExceptionForm({
  counselorId,
  exception,
  selectedDate,
}: {
  counselorId: string;
  exception?: AvailabilityException;
  selectedDate?: string;
}) {
  const [state, action, pending] = useActionState(saveException, initialState);
  const [kind, setKind] = useState(exception?.kind ?? "opening");
  const [allDay, setAllDay] = useState(exception?.all_day ?? false);
  return (
    <div className="availability-editor">
      <form action={action} className="availability-form">
        <input type="hidden" name="counselorId" value={counselorId} />
        <input type="hidden" name="id" value={exception?.id ?? ""} />
        <label>
          Date
          <input
            name="date"
            type="date"
            defaultValue={exception?.local_date ?? selectedDate}
            required
          />
        </label>
        <label>
          Type
          <select
            name="kind"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              if (event.target.value === "opening") setAllDay(false);
            }}
          >
            <option value="opening">Extra opening</option>
            <option value="blocked">Blocked time</option>
          </select>
        </label>
        {kind === "blocked" && (
          <label className="availability-checkbox">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />{" "}
            All day
          </label>
        )}
        {!allDay && (
          <>
            <label>
              Start time
              <input
                name="start"
                type="time"
                defaultValue={exception?.start_time?.slice(0, 5)}
                required
              />
            </label>
            <label>
              End time
              <input
                name="end"
                type="time"
                defaultValue={exception?.end_time?.slice(0, 5)}
                required
              />
            </label>
          </>
        )}
        <button disabled={pending}>{pending ? "Saving..." : "Save date"}</button>
        <Result state={state} />
      </form>
      {exception && <DeleteEntry counselorId={counselorId} id={exception.id} kind="exception" />}
    </div>
  );
}

export function AvailabilityEditor({
  counselorId,
  rules,
  exceptions,
  today,
}: {
  counselorId: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  today: string;
}) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  function moveMonth(offset: number) {
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7));
  }
  return (
    <div className="availability-management">
      <p>Timezone: Asia/Kolkata</p>
      <section aria-label="Availability calendar" className="availability-calendar">
        <div className="calendar-header">
          <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
            Previous
          </button>
          <h2>{monthLabel}</h2>
          <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
            Next
          </button>
        </div>
        <div className="calendar-grid">
          {weekdays.map((day) => (
            <span className="calendar-weekday" key={day} aria-label={day}>
              {day.slice(0, 3)}
            </span>
          ))}
          {Array.from({ length: firstDay }, (_, index) => (
            <span key={`empty-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const date = `${month}-${String(index + 1).padStart(2, "0")}`;
            const weekday = new Date(Date.UTC(year, monthNumber - 1, index + 1)).getUTCDay();
            const hasHours = rules.some((rule) => rule.weekday === weekday);
            const dateExceptions = exceptions.filter((entry) => entry.local_date === date);
            return (
              <button
                key={date}
                type="button"
                className="calendar-day"
                aria-pressed={selectedDate === date}
                aria-label={`${date}${hasHours ? ", weekly hours" : ""}${dateExceptions.some((entry) => entry.kind === "opening") ? ", extra opening" : ""}${dateExceptions.some((entry) => entry.kind === "blocked") ? ", blocked time" : ""}`}
                onClick={() => setSelectedDate(date)}
              >
                <span>{index + 1}</span>
                <span className="calendar-indicators" aria-hidden="true">
                  {hasHours && <i className="calendar-dot hours" />}
                  {dateExceptions.some((entry) => entry.kind === "opening") && (
                    <i className="calendar-dot opening" />
                  )}
                  {dateExceptions.some((entry) => entry.kind === "blocked") && (
                    <i className="calendar-dot blocked" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="calendar-legend">
          <span>
            <i className="calendar-dot hours" /> Weekly hours
          </span>
          <span>
            <i className="calendar-dot opening" /> Extra opening
          </span>
          <span>
            <i className="calendar-dot blocked" /> Blocked time
          </span>
        </p>
        <p>
          Selected date: <time dateTime={selectedDate}>{selectedDate}</time>
        </p>
      </section>
      <section>
        <h2>Weekly hours</h2>
        <details>
          <summary>Add weekly hours</summary>
          <RuleForm counselorId={counselorId} />
        </details>
        {rules.length === 0 && <p>No weekly hours set.</p>}
        {rules.map((rule) => (
          <details key={rule.id}>
            <summary>
              {weekdays[rule.weekday]} · {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}
            </summary>
            <RuleForm counselorId={counselorId} rule={rule} />
          </details>
        ))}
      </section>
      <section>
        <h2>Dates and exceptions</h2>
        <details>
          <summary>Add date</summary>
          <ExceptionForm key={selectedDate} counselorId={counselorId} selectedDate={selectedDate} />
        </details>
        {exceptions.length === 0 && <p>No date-specific changes.</p>}
        {exceptions.map((exception) => (
          <details key={exception.id}>
            <summary>
              {exception.local_date} · {exception.kind === "opening" ? "Extra opening" : "Blocked"}{" "}
              ·{" "}
              {exception.all_day
                ? "All day"
                : `${exception.start_time?.slice(0, 5)}–${exception.end_time?.slice(0, 5)}`}
            </summary>
            <ExceptionForm counselorId={counselorId} exception={exception} />
          </details>
        ))}
      </section>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: AvailabilitySettings }) {
  const [state, action, pending] = useActionState(saveSettings, initialState);
  return (
    <form action={action} className="availability-form">
      <label>
        Session duration (minutes)
        <input
          name="session"
          type="number"
          min="15"
          max="180"
          defaultValue={settings.session_minutes}
          required
        />
      </label>
      <label>
        Buffer (minutes)
        <input
          name="buffer"
          type="number"
          min="0"
          max="120"
          defaultValue={settings.buffer_minutes}
          required
        />
      </label>
      <label>
        Minimum notice (minutes)
        <input
          name="notice"
          type="number"
          min="0"
          max="14400"
          defaultValue={settings.min_notice_minutes}
          required
        />
      </label>
      <label>
        Booking window (days)
        <input
          name="days"
          type="number"
          min="1"
          max="90"
          defaultValue={settings.max_advance_days}
          required
        />
      </label>
      <button disabled={pending}>{pending ? "Saving..." : "Save settings"}</button>
      <Result state={state} />
    </form>
  );
}
