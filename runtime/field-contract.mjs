/** Frozen demo checklist. Change only with a versioned contract and label review. */
export const FIELD_CONTRACT_VERSION = "interview-fields-v1";
export const fields = Object.freeze([
  {
    "id": "full_name",
    "label": "Full name",
    "description": "The person's explicitly stated name. Never use a job title, employer, project, or program name."
  },
  {
    "id": "location",
    "label": "Location",
    "description": "The person's explicitly stated current city or geographic location."
  },
  {
    "id": "phone",
    "label": "Phone",
    "description": "The person's preferred telephone number."
  },
  {
    "id": "email",
    "label": "Email",
    "description": "The person's preferred email address, accounting for explicit corrections or retractions."
  },
  {
    "id": "bachelors_degree",
    "label": "Bachelor's degree",
    "description": "Degree and field"
  },
  {
    "id": "bachelors_year",
    "label": "Bachelor's year",
    "description": "Graduation year"
  },
  {
    "id": "masters_degree",
    "label": "Master's degree",
    "description": "Degree and field"
  },
  {
    "id": "masters_year",
    "label": "Master's year",
    "description": "Graduation year"
  },
  {
    "id": "military_service",
    "label": "Military service",
    "description": "Only explicitly stated military branch, role, and dates. Do not infer unstated details."
  },
  {
    "id": "security_clearance",
    "label": "Security clearance",
    "description": "A currently held security clearance only when explicitly stated."
  },
  {
    "id": "current_employer",
    "label": "Current employer",
    "description": "The organization where the person currently works. Never return a former employer."
  },
  {
    "id": "current_title",
    "label": "Current job title",
    "description": "The person's current job title or role, such as lead systems engineer. Never use the person's name, employer, or program name."
  },
  {
    "id": "tenure",
    "label": "Tenure",
    "description": "Explicitly stated time with the current employer or in the current job."
  },
  {
    "id": "team_size",
    "label": "Team size",
    "description": "Explicit number of direct reports, core team members, or extended contributors, preserving which kind was stated."
  },
  {
    "id": "current_program",
    "label": "Current program",
    "description": "A named project, product, contract, effort, or program the person currently supports. A person's job title is not a program."
  },
  {
    "id": "key_technologies",
    "label": "Key technologies",
    "description": "Only technologies, tools, platforms, methods, or frameworks explicitly named. Exclude project, program, product, employer, and job-title names."
  },
  {
    "id": "area_of_interest",
    "label": "Area of interest",
    "description": "Work the subject wants to pursue"
  },
  {
    "id": "reason_for_leaving",
    "label": "Reason for leaving",
    "description": "Stated motivation for a move"
  },
  {
    "id": "current_salary",
    "label": "Current salary",
    "description": "Compensation explicitly described as already received in the present role. Present-state cues include current, currently, earn, make, receive, and existing compensation. Exclude target, targeting, seek, expect, desired, conditional, future, and move-related compensation. Preserve every stated base, bonus, equity, and total-comp component."
  },
  {
    "id": "target_salary",
    "label": "Target salary",
    "description": "Compensation explicitly desired or expected from a prospective new role. Goal-state cues include target, targeting, seek, expect, desired, looking for, and for a move. Exclude current, currently received, earned, and existing compensation. Preserve every stated base, bonus, equity, flexibility, and total-comp component."
  },
  {
    "id": "availability",
    "label": "Availability",
    "description": "Notice period or start date"
  },
  {
    "id": "relocation",
    "label": "Relocation",
    "description": "Relocation preference or constraint"
  }
].map((field) => Object.freeze(field)));
