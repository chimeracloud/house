/**
 * Property documents bundled into the app.
 *
 * Source of truth: `docs/breda_street_property_package.md` in the repo.
 * Whenever that file changes, update this module so the app shows the
 * latest version of the rules / lease.
 *
 * Each document has:
 *   - id          — stable string used as the docs collection partition
 *   - title       — display title
 *   - kind        — 'rules' | 'policy' | 'lease' | 'notice'
 *   - audience    — array of roles that need to acknowledge it
 *   - mustAcceptBeforeApproval — if true, profile.is_active stays false until ack'd
 *   - body        — markdown / plain text
 *
 * Acknowledgement records are written to `documents/{userId_docId}` with:
 *   { user_id, doc_id, doc_version, signed_at, signed_name, accepted: true }
 */

export const HOUSE_RULES = {
  id: 'house-rules-v1',
  version: 1,
  title: 'House Rules — 21 Breda Street',
  kind: 'rules',
  audience: ['tenant', 'resident'],
  mustAcceptBeforeApproval: true,
  summary:
    'Core rules covering quiet hours, cleanliness (CLAYGO), security, guests, smoking, and damage.',
  body: `# House Rules — 21 Breda Street

These House Rules are not negotiable and will be enforced. They are designed
to create a peaceful, clean, and safe home for all residents while protecting
the property.

## 1. General Conduct & Peaceful Enjoyment
- All residents must respect the quiet enjoyment of other residents.
- **Quiet Hours**: 22:00 – 07:00 daily. Music, voices, parties and equipment
  must be minimised.
- No loud music, parties, or gatherings without prior written permission
  from management.
- Excessive noise violations may result in formal warnings and potential
  eviction.

## 2. Cleanliness & Maintenance
- Personal rooms must be kept clean and tidy. Doors must be locked when
  unoccupied.
- **CLAYGO** (Clean As You Go) applies to all common areas. Dishes washed
  immediately after use. No dishes / food / clutter on benches or tables
  except during active use.
- Cleaning roster will be posted in common areas. Each resident is
  responsible for one designated cleaning session per week.
- Kitchen: oven, cooktop and exhaust fan cleaned after every use. Empty
  bins regularly. Spills cleaned immediately.
- Bathrooms: clean up after use, clear hair from drains, no sanitary items
  down the toilets, max 25 minutes during weekdays.
- Laundry room: machines left clean, do not overload, respect the schedule
  posted in the room.

## 3. Security & Safety
- All residents must lock their room doors when away and when sleeping.
- Do not share keys with unauthorised persons.
- Lost keys: report immediately. Replacement cost applies.
- Doors and windows must remain locked when the property is unoccupied.
- Do not allow unauthorised persons to enter the property.
- Do not prop open security gates.

## 4. Guests & Visitors
- Reasonable hours, prior notice to management.
- Overnight guests must vacate by 10:00 the following morning.
- Only direct family members in resident rooms; other visitors must remain
  in common areas.
- Management reserves the right to refuse entry to any guest deemed
  disruptive.

## 5. Utilities & Conservation
- Switch off lights when leaving a room. Unplug chargers and electronics.
- Turn off taps completely. Report drips or leaks immediately.

## 6. Smoking, Alcohol & Substances
- Smoking strictly prohibited in all indoor areas.
- Smoking only in the designated outdoor area; ashtrays must be used.
- No open flames or candles indoors.
- Compliance with all applicable laws regarding alcohol and controlled
  substances.

## 7. Alterations & Damage
- No alterations without written permission.
- Picture hooks or removable adhesive only — no nails or permanent fixtures.
- Resident is responsible for damage caused beyond normal wear and tear.
- Damage to common areas caused by a resident is the resident's responsibility.

## 8. Payment of Rent & Fees
- Rent is due on the same date each month as move-in date.
- Late fee per day if not received on time.
- Three consecutive late payments constitute grounds for eviction.

## 9. Room Inspections
- Management may inspect rooms with reasonable notice for health, safety
  or maintenance reasons.
- Emergency access without notice is permitted in case of fire, flood or
  similar safety hazards.

## 10. Pests & Animals
- No pets without written permission.
- Report pest sightings immediately to management.

## 11. Prohibited Items & Activities
- Weapons, explosives or flammable liquids are strictly prohibited.
- No illegal activities on or off the premises.
- No business activities run from a room without written permission.

## 12. Termination & Vacating
- At least 1 month written notice before vacating.
- Room must be vacated by 10:00 on final date.
- All keys must be returned.
- Joint inspection within 3 days prior to expiry of lease.

By accepting these rules I confirm I have read, understood, and agree to
abide by them while resident at the property.`,
};

export const FIRE_SAFETY = {
  id: 'fire-safety-v1',
  version: 1,
  title: 'Fire Safety Policy',
  kind: 'policy',
  audience: ['tenant', 'resident', 'property_manager'],
  mustAcceptBeforeApproval: true,
  summary:
    'Fire prevention measures, evacuation procedure, drill participation, and reporting hazards.',
  body: `# Fire Safety Policy — 21 Breda Street

Compliance: SANS 10400 Part T, SABS 1475, SANS 10139, OHS Act No. 85 of 1993.

## Resident Responsibilities
- Know the location of all emergency exits.
- Understand the evacuation procedure.
- Keep emergency exit routes clear at all times.
- Do not block or tamper with fire safety equipment.
- Immediately report any fire hazards or equipment failures.
- Participate in mandatory fire drills.
- Know the assembly point location.

## Prohibited Items in Rooms
- Candles and open flames
- Overloaded electrical outlets
- Faulty electrical equipment
- Flammable materials stored improperly
- Space heaters or hot plates

## Electrical Safety
- Do not overload power outlets.
- Unplug chargers before sleeping.
- Report frayed wires or damaged plugs immediately.
- Air conditioners and large appliances require management approval.

## Kitchen Fire Prevention
- Keep cooktops clean and free of grease.
- Never leave cooking unattended.
- Keep flammable materials away from heat sources.
- Ensure exhaust fan is working when cooking.
- Report any gas smell immediately.

## Emergency Evacuation Procedure
1. Evacuate immediately on alarm — do **not** stop to gather belongings.
2. Close your room door behind you (do not lock).
3. Use stairs only.
4. Exit via the nearest emergency exit.
5. Proceed to the designated assembly point.
6. Do **not** re-enter the building until authorised.

## Residents with Mobility Issues
Inform management upon move-in if you require evacuation assistance. A
designated buddy system will be established.

## Fire Drills & Training
- Annual fire drills are mandatory; all residents must participate.
- Records are kept of drill dates and evacuation times.
- Training is provided upon move-in and annually.

## In Case of Fire
- Activate the alarm.
- Call emergency services: **10177** (SAPS) or **112** (emergency).
- Evacuate immediately.
- Account for all residents at the assembly point.

By accepting this policy I confirm I have read and understood the fire
safety procedures and will comply with them at all times.`,
};

export const CCTV_NOTICE = {
  id: 'cctv-notice-v1',
  version: 1,
  title: 'CCTV & Privacy Notice',
  kind: 'notice',
  audience: ['tenant', 'resident', 'contractor', 'property_manager'],
  mustAcceptBeforeApproval: true,
  summary:
    'The property is monitored by CCTV in common areas. Footage is retained per POPIA. Bedrooms and bathrooms are NOT recorded.',
  body: `# CCTV & Privacy Notice — 21 Breda Street

This property is monitored by CCTV cameras 24 hours per day, 7 days per
week, for the safety and security of residents, staff, contractors and
property.

## Recording Locations
- Common areas (lounge, kitchen, dining room, hallways, entrance)
- External perimeter and parking
- **Not recorded**: bedrooms, bathrooms, or any private space.

## Footage Retention
- Footage is retained for 30 days unless required for an investigation.
- Footage is stored securely and accessed only by the property owner,
  manager, or law enforcement under lawful request.

## Lawful Basis (POPIA)
- Property protection (legitimate interest)
- Resident safety
- Investigation of complaints, theft, damage, or rule violations.

## Your Rights under POPIA
- Right to know what footage of you exists.
- Right to request deletion (subject to legal retention obligations).
- Right to lodge a complaint with the Information Regulator.

## Resident Acknowledgement
By accepting this notice you acknowledge that you have been informed of
the surveillance and consent to your image being recorded in monitored
common areas while resident at or visiting the property.`,
};

export const LEASE_TEMPLATE = {
  id: 'lease-agreement-v1',
  version: 1,
  title: 'Residential Lease Agreement',
  kind: 'lease',
  audience: ['tenant'],
  // Lease isn't required up-front — it's signed once a room is allocated
  // and the rental amount + period set in the Rooms admin tab.
  mustAcceptBeforeApproval: false,
  summary:
    'Boarding-room lease covering rental, deposit, term, deposit deductions, tenant and lessor obligations, and termination.',
  body: `# Residential Lease Agreement — 21 Breda Street

This is the standard lease agreement covering boarding-room rentals at the
property. Specific values (room number, rental amount, lease period,
deposit) are filled in by the manager when the room is allocated.

## 1. Property Details
The lessor lets and the lessee accepts the lease of a single/shared room
at 21 Breda Street with shared access to: kitchen, dining room, lounge,
entertainment area, laundry facilities.

## 2. Lease Period
Initial term as specified by the manager. Renewal on a month-to-month
basis with 1-month written notice from either party.

## 3. Rental Payment
- Monthly rental as specified by the manager (in ZAR).
- Due date: same date each month as commencement.
- Payment method: as agreed at signing.
- Late payment: a daily late fee applies if not received on time.
- Three consecutive late payments constitute grounds for eviction.

## 4. Deposit & Fees
- A refundable damage deposit (typically 1 month's rent) is payable
  before occupation.
- Held in trust; not credited against rent.
- Refundable within 30 days of vacating, less deductions for damage,
  unpaid rent, cleaning, missing items or unreturned keys.

## 5. Tenant Obligations
- Use the room solely for residential purposes.
- Comply with the House Rules (Annexure A) at all times.
- Keep the room and used common areas clean and in good order.
- No alterations without written consent.
- No subletting or accommodating additional persons.

## 6. Lessor's Obligations
- Deliver the property in clean, habitable condition.
- Maintain structural elements, plumbing, electrical, appliances and
  common areas.
- Effect necessary repairs within a reasonable time.

## 7. Insurance
- The lessor maintains building insurance.
- Tenant is responsible for insuring personal belongings — the lessor's
  insurance does NOT cover tenant property.

## 8. Damage & Breach
- Tenant is responsible for damage caused by themselves, guests or pets.
- Normal wear and tear is not chargeable.
- Material breach of lease may result in eviction following the legal
  PIE Act process.

## 9. Termination
- Tenant: at least 1 month written notice before vacating.
- Lessor: may terminate for breach, non-payment, illegal activity or
  serious House Rules violation, following the Rental Housing Act
  procedures.

## 10. Joint Inspection
- Move-in: within 3 days of move-in, lessor and lessee jointly inspect
  the room and complete an inventory of chattels.
- Move-out: joint inspection within 3 days before lease expiry.

## 11. House Rules
The House Rules are an integral part of this lease. Breach of House
Rules may result in formal warnings and, after three warnings, eviction.

## 12. Governing Law
This lease is governed by South African law, including the Rental
Housing Act No. 50 of 1999, the PIE Act, and the Consumer Protection
Act No. 68 of 2008.

By accepting this lease I confirm:
- I have read and understood all terms above.
- I agree to comply with the House Rules and Fire Safety Policy.
- The room number, rental amount, lease term and deposit recorded in
  my admin profile form an integral part of this agreement.`,
};

export const ALL_DOCUMENTS = [HOUSE_RULES, FIRE_SAFETY, CCTV_NOTICE, LEASE_TEMPLATE];

/** Documents a given role must acknowledge. */
export function documentsForRole(role) {
  return ALL_DOCUMENTS.filter((d) => d.audience.includes(role));
}

/** Documents that must be accepted before a role can be approved. */
export function blockingDocumentsForRole(role) {
  return documentsForRole(role).filter((d) => d.mustAcceptBeforeApproval);
}
