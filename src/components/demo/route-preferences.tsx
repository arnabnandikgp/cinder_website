"use client";
import { useState } from "react";
import { Modal } from "./controls";
import { venues, type Venue } from "./data";
import { VenueIcon } from "./venue-select";
export function RoutePreferences({
  allowed,
  onSave,
  onClose,
}: {
  allowed: Venue[];
  onSave: (values: Venue[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(allowed),
    [error, setError] = useState("");
  return (
    <Modal title="Route preferences" eyebrow="ROUTING" onClose={onClose}>
      <p>
        Compare visible books and modeled venue fees. Pacifica and BULK assume
        their lowest volume tiers. Cinder pricing is excluded.
      </p>
      <fieldset className="d-checks">
        <legend>Venues to compare</legend>
        {Object.entries(venues)
          .filter(([v]) => v !== "velocity")
          .map(([v, name]) => (
            <label key={v}>
              <input
                type="checkbox"
                checked={selected.includes(v as Venue)}
                onChange={(e) => {
                  setSelected(
                    e.target.checked
                      ? [...selected, v as Venue]
                      : selected.filter((venue) => venue !== v),
                  );
                  setError("");
                }}
              />
              <VenueIcon venue={v as Venue} size={18} />
              {name}
            </label>
          ))}
      </fieldset>
      {error && (
        <p className="d-error" role="alert">
          {error}
        </p>
      )}
      <p className="d-field-help">
        Applies to new orders, not existing positions. Curve visibility does not
        exclude a venue.
      </p>
      <button
        className="d-button d-primary d-wide"
        onClick={() => {
          if (!selected.length) {
            setError("Choose at least one venue.");
            return;
          }
          onSave(selected);
        }}
      >
        Save preferences
      </button>
    </Modal>
  );
}
