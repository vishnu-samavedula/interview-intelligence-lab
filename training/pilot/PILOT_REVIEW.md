# Pilot semantic review — ten cases

These are draft examples, not a trained-model evaluation. Each case shows the exact question-visible window, recent suggestion history and both independent labels. Extraction comparisons use the full interview and include the supporting speech. Recommendations below are from the assistant; none is human-approved gold.

**Review the proposed disposition:** correct it where it differs from your intent. Do not spend time resolving Army versus Army captain-style detail differences when both are supported. The substantive issues are unsupported facts, temporal meaning, useful information needs and repetition.

## 1. pilot-001: Team size versus people affected

**Proposed disposition:** Reject the primary team_size value “two technicians”: these are people freed for other work, not the total team. Keep Army and Army, test lead as acceptable concise/richer variants. Both first-turn role-exploration questions are plausible; prefer one clear information need.

**Question-visible window**

- Interviewer: Tell me about your background in testing.
- Candidate: I spent several years as a test lead in the Army, running acceptance and validation work on complex systems. That's where I really learned how to structure a test program and manage the details that make or break acceptance criteria.

**Recent suggestions:** None.

**Question labels**

- generator (anthropic/claude-haiku-4.5): **ask** — What specific contributions did you make to structuring that test program, and what acceptance criteria challenges did you help resolve?
- independent (google/gemini-3.5-flash-lite): **ask** — What types of complex systems did you work with during your time as a test lead?

**Full-interview extraction: `team_size`**

- Primary: "two technicians"
- Independent: null

> Candidate: It freed up two of our technicians to work on other acceptance tasks instead of babysitting the test sequences. We didn't lower any acceptance standards—the tests are still the same and they're still thorough. We just accepted a small increase in compute load during those overlapping windows, which the team was comfortable with. The throughput gain meant we could compress the overall acceptance timeline and move results to the program faster.

Human disposition: **pending**

## 3. pilot-003: Future interest versus established experience

**Proposed disposition:** Relocation should remain unknown: willingness to work remotely does not establish willingness to move. Both questions imply that the candidate has already designed/explored defensive systems in the current job; the candidate only states an aspiration. Prefer: “Which aspects of defensive systems design would you most like to focus on?”

**Question-visible window**

- Interviewer: What are you doing now?
- Candidate: I'm a Senior Network Engineer at Sentinel Dynamics Corporation. I've been focused on designing and maintaining robust network systems.
- Interviewer: What technologies have you worked with most closely?
- Candidate: Primarily Cisco IOS for routing and switching, Python for automation and scripting, and Splunk for security monitoring and log analysis.
- Interviewer: Where do you see your career heading from here?
- Candidate: I'm genuinely interested in cybersecurity architecture. I want to move into roles where I'm designing defensive systems and thinking strategically about threat mitigation across enterprise networks.

**Recent suggestions:** What specific network infrastructure challenges have you addressed using Cisco IOS and Splunk?

**Question labels**

- generator (anthropic/claude-haiku-4.5): **ask** — What specific defensive systems or threat-mitigation initiatives have you designed or led in your current role at Sentinel Dynamics?
- independent (google/gemini-3.5-flash-lite): **ask** — What kind of defensive systems or threat mitigation strategies have you started exploring in your current role?

**Full-interview extraction: `relocation`**

- Primary: "open to remote work"
- Independent: null

> Candidate: I'm in Arlington, Virginia. I'm actually open to remote work—that flexibility appeals to me at this stage.

Human disposition: **pending**

## 6. pilot-006: Corrected title and semantic question repetition

**Proposed disposition:** Both extractions correctly replace Senior Software Engineer with Lead Software Architect. A role exploration is permitted, but the earlier suggested distributed-architecture question already explores the work. Review whether a second broad architecture question meaningfully adds anything; do not approve solely because the wording differs. The history itself contains an unsupported project premise and needs source-cutoff grounding.

**Question-visible window**

- Interviewer: Thank you for your service. How did that transition into your current civilian career path?
- Candidate: After my military service, I transitioned directly into the defense sector, and I am currently employed at Apex Defense Systems working as a Senior Software Engineer.
- Interviewer: That is an impressive transition. Are you still holding that exact title, or has your scope expanded since joining them?
- Candidate: Actually, let me correct that title I just mentioned—I recently stepped into a broader role following a promotion, and my official title is now Lead Software Architect.
- Interviewer: Congratulations on the promotion to Lead Software Architect. That sounds like a significant step up in responsibility. Let us make sure we note that correctly in your file as we discuss next steps.
- Candidate: Thank you, I appreciate that. I am definitely looking forward to discussing how those architectural experiences align with what your team is building.

**Recent suggestions:** Could you walk me through the distributed architecture design you implemented on your most recent defense software project at Apex Defense Systems?

**Question labels**

- generator (google/gemini-3.5-flash-lite): **abstain** — No question.
- independent (anthropic/claude-haiku-4.5): **ask** — In your Lead Software Architect role, what specific architectural decisions or designs have you personally contributed to, and what impact have they had on your team's ability to deliver or maintain the systems you support?

**Full-interview extraction: `current_title`**

- Primary: "Lead Software Architect"
- Independent: "Lead Software Architect"

> Candidate: Actually, let me correct that title I just mentioned—I recently stepped into a broader role following a promotion, and my official title is now Lead Software Architect.

Human disposition: **pending**

## 12. pilot-012: Interviewer salary premise and historical bonus

**Proposed disposition:** Reject a definitive $130,000 target unless candidate confirmation is adjudicated as sufficiently explicit; the amount is spoken by the interviewer. Preserve the distinction between $52/hour current pay and an $8,000 bonus received last year; do not silently label it a recurring annual bonus. Neither amount should be blindly converted or scaled. Abstaining from compensation follow-ups is appropriate.

**Question-visible window**

- Interviewer: Walk me through the technical skills you're bringing to the table.
- Candidate: I work regularly with Honeywell avionics suites, MIL-STD-1553B data bus architecture, and ARINC 429 protocols. I've also picked up Python scripting for test automation, which has streamlined a lot of our validation cycles. What really interests me going forward is systems integration and embedded diagnostics—getting into the next generation of platform design.
- Interviewer: What's driving the move now, and what are you currently earning?
- Candidate: Honestly, I want more stability and structured growth. Contract work keeps you sharp, but the compensation model is unpredictable. Right now I'm at $52 an hour, and I'm looking for something that gives me clearer long-term footing.
- Interviewer: I want to make sure we're aligned on expectations. You mentioned $130,000 annually as your target. At $52 an hour, that's roughly $108,000 over a full year. Help me understand where the gap sits for you.
- Candidate: That's fair to call out. I factored in the bonus I received last year—$8,000—which brought my effective take-home closer to that range. But I recognize a salaried role might structure that differently. I'm available to start within 30 days with two weeks' notice, and I'm flexible on the exact number if the base is solid and the benefits are competitive.

**Recent suggestions:** Can you walk us through a specific avionics troubleshooting scenario you led on the NIFS contract, including the tools and methodologies you applied?

**Question labels**

- generator (anthropic/claude-haiku-4.5): **abstain** — No question.
- independent (google/gemini-3.5-flash-lite): **abstain** — No question.

**Full-interview extraction: `target_salary`**

- Primary: null
- Independent: "$130,000 annually"

> Candidate: That's fair to call out. I factored in the bonus I received last year—$8,000—which brought my effective take-home closer to that range. But I recognize a salaried role might structure that differently. I'm available to start within 30 days with two weeks' notice, and I'm flexible on the exact number if the base is solid and the benefits are competitive.

Human disposition: **pending**

## 20. pilot-020: Earlier role remains visible after logistics

**Proposed disposition:** Prefer an ask about Quality Assurance Officer responsibilities: that role remains in the two-turn window and no suggestion history exists. The latest relocation response does not erase the preceding role. Abstain remains valid if no useful work/interest question remains, not merely because the final response is logistical.

**Question-visible window**

- Interviewer: Thanks for taking the time today. Let's start with the basics—what's your name, and tell me about your military background.
- Candidate: I'm Marcus Ingram. I served in the United States Coast Guard from 2015 to 2019 as a Quality Assurance Officer.
- Interviewer: Great. Where are you based right now, and would you be open to relocating if the right opportunity came along?
- Candidate: I'm in Portland, Oregon. I'm open to relocation within the Pacific Northwest, or I could do periodic travel. Honestly, I'd prefer a remote-hybrid setup if that's an option.

**Recent suggestions:** None.

**Question labels**

- generator (anthropic/claude-haiku-4.5): **abstain** — No question.
- independent (google/gemini-3.5-flash-lite): **ask** — What specific responsibilities did you handle as a Quality Assurance Officer?

**Full-interview extraction: `relocation`**

- Primary: "open to relocation within the Pacific Northwest, or periodic travel; prefers remote-hybrid setup"
- Independent: "open to relocation within the Pacific Northwest, or I could do periodic travel. Honestly, I'd prefer a remote-hybrid setup if that's an option."

> Candidate: I'm in Portland, Oregon. I'm open to relocation within the Pacific Northwest, or I could do periodic travel. Honestly, I'd prefer a remote-hybrid setup if that's an option.

Human disposition: **pending**

## 21. pilot-021: User-facing turn IDs and weak history grounding

**Proposed disposition:** Reject the wording “In turn 7.” Role-interest exploration can be useful, but this question should be reviewed for practical added value and overlap with earlier questions. The supplied history mentions a tracking-gate redesign absent from this interview; it cannot be treated as a reliable source of work facts. Rebuild history from a real earlier prefix.

**Question-visible window**

- Interviewer: How did you validate that the trade-off was worth it? What metrics did you track?
- Candidate: We tracked query latency percentiles—p50, p95, p99—separately for each tier. We also monitored the actual cost per query and the cost per gigabyte stored. Before the change, we were paying about $8 per gigabyte per month across all compute and storage. After, it dropped to $4.80. We also measured operator workload—how much time on-call engineers spent investigating false alerts or slow queries. That dropped significantly because the system was more responsive.
- Interviewer: What drew you to this role, and what are you looking for in your next position?
- Candidate: I'm looking for a role where infrastructure modernization is central to the mission, not a side project. I want to work on systems that scale, where architectural decisions have real business impact. I'm interested in cloud-native architecture and distributed systems, and I want to be in an environment where I can own those decisions end-to-end and maybe mentor others doing similar work.
- Interviewer: What's your timeline, and are there other conversations happening right now?
- Candidate: I can give 30 days notice. I am talking to a couple of other organizations, but I'm genuinely interested in finding the right fit rather than just moving fast. I want to understand the team, the infrastructure state, and the actual constraints I'd be working within.

**Recent suggestions:** You mentioned the tracking gate redesign reduced operator workload. What was the compute-cost trade-off you evaluated?

**Question labels**

- generator (anthropic/claude-haiku-4.5): **ask** — In turn 7, you mentioned wanting to own infrastructure modernization decisions end-to-end—can you describe a specific past project where you had that kind of ownership, and what constraints or trade-offs you navigated?
- independent (google/gemini-3.5-flash-lite): **abstain** — No question.

**Full-interview extraction: `key_technologies`**

- Primary: "Python, Kubernetes, PostgreSQL"
- Independent: "Python, Kubernetes, PostgreSQL"

> Candidate: Primarily Python for automation and tooling, Kubernetes for orchestration, and PostgreSQL for data persistence. A lot of my work centers on designing systems that balance performance, cost, and operational complexity.

Human disposition: **pending**

## 24. pilot-024: Checklist completion is not career exploration

**Proposed disposition:** Prefer the question about specific contributions to Project Vanguard: the candidate explicitly states team leadership and the project in the visible window. Compensation in the final response does not resolve contribution. The existing history mentions an instructional experiment not stated in this transcript; its grounding must be repaired before release.

**Question-visible window**

- Interviewer: Thank you for sharing those details. Could you tell me about your educational credentials and any active clearances you maintain?
- Candidate: I earned my B.S. in Education and Training Management in 2015. Additionally, I hold an active Secret security clearance.
- Interviewer: Excellent. Can you walk me through your current team structure and the projects or tools you work with day-to-day?
- Candidate: Certainly. I currently lead a team of 6 direct reports on Project Vanguard. In terms of tooling and methodologies, we rely heavily on LMS platforms, simulation software, and the ADDIE framework.
- Interviewer: That sounds like a comprehensive portfolio. What are you looking for next in your career, and what are your expectations regarding compensation and timeline?
- Candidate: I am seeking broader scope in commercial training architectures focused on enterprise technical training development. My current base salary is $110,000, and my target is a $130,000 base salary. If we move forward, I am available to start upon giving two weeks notice.

**Recent suggestions:** Could you walk me through how you restructured the instructional modules during your recent training experiment?

**Question labels**

- generator (google/gemini-3.5-flash-lite): **abstain** — No question.
- independent (anthropic/claude-haiku-4.5): **ask** — What contributions have you made to Project Vanguard, and what outcomes or improvements have resulted from your leadership of the team?

**Full-interview extraction: `team_size`**

- Primary: "6 direct reports"
- Independent: "6 direct reports"

> Candidate: Certainly. I currently lead a team of 6 direct reports on Project Vanguard. In terms of tooling and methodologies, we rely heavily on LMS platforms, simulation software, and the ADDIE framework.

Human disposition: **pending**

## 27. pilot-027: Numbers do not establish personal ownership

**Proposed disposition:** The 40% cycle-time result is stated as “we”; it does not identify the candidate’s engineering action. A personal-contribution clarification is useful despite compensation at the end. However, the previous suggestion already asks for a test-cycle optimization example and broader value: review semantic repetition before approving a second question. Do not force an ask just to balance the corpus. Preserve salary ranges and conditions.

**Question-visible window**

- Interviewer: What's the next chapter you're looking for?
- Candidate: I want to lead a cross-functional avionics modernization effort—something where my engineering recommendations actually shape the platform architecture decisions, not just execute against them.
- Interviewer: That's helpful. Why are you leaving Stratosphere?
- Candidate: The role has plateaued. We launched a test acceleration initiative that genuinely worked—cut cycle time by 40 percent—but the organization couldn't move downstream with it. Budget got reallocated, stakeholders didn't align on the next phase, and the momentum just died. I pushed hard on escalation, but at a certain point you realize you're hitting a ceiling. I'm at 142 base plus 12 percent annual bonus, and I need an environment where that kind of win translates into real product impact.
- Interviewer: Understood. What's your target comp, and when could you start?
- Candidate: I'm looking for 165 to 180 base, depending on scope and equity structure. I'd give 60 days' notice, so earliest start would be mid-April.

**Recent suggestions:** Can you walk us through a specific example where you optimized a test cycle, and explain what prevented that optimization from delivering value to the broader program?

**Question labels**

- generator (anthropic/claude-haiku-4.5): **ask** — In that test acceleration initiative, what specifically did you recommend or implement to achieve the 40 percent cycle-time reduction?
- independent (google/gemini-3.5-flash-lite): **abstain** — No question.

**Full-interview extraction: `target_salary`**

- Primary: "165 to 180 base, depending on scope and equity structure"
- Independent: "165 to 180 base"

> Candidate: I'm looking for 165 to 180 base, depending on scope and equity structure. I'd give 60 days' notice, so earliest start would be mid-April.

Human disposition: **pending**

## 30. pilot-030: Aspirations do not prove current focus

**Proposed disposition:** The proposed question assumes geopolitical-region/threat work in the current job, although strategic forecasting is explicitly a future interest. Prefer abstention when the recent transfer-of-experience question covers this topic, or a genuinely distinct neutral interest question. Do not invent current projects from the desired career direction.

**Question-visible window**

- Interviewer: Wonderful. To give us a better idea of your background, could you share some details regarding your military service and any active clearances you hold?
- Candidate: I served in the U.S. Army as an Intelligence Analyst from 2016 to 2022, and I currently maintain a Top Secret/SCI security clearance.
- Interviewer: That is a solid foundation. Where are you applying those skills right now in your civilian career?
- Candidate: I am currently working as a Senior Intelligence Analyst at Apex Defense Solutions.
- Interviewer: As you look ahead to your next career move, what specific analytical focus areas are you most interested in pursuing?
- Candidate: My primary area of interest moving forward is strategic geopolitical threat forecasting.

**Recent suggestions:** Could you elaborate on how your tactical analytical experience at Apex Defense Solutions translates to strategic forecasting?

**Question labels**

- generator (google/gemini-3.5-flash-lite): **abstain** — No question.
- independent (anthropic/claude-haiku-4.5): **ask** — What types of geopolitical threats or regions have you focused on most in your current role at Apex Defense Solutions?

**Full-interview extraction: `area_of_interest`**

- Primary: "strategic geopolitical threat forecasting"
- Independent: "strategic geopolitical threat forecasting"

> Candidate: My primary area of interest moving forward is strategic geopolitical threat forecasting.

Human disposition: **pending**

## 33. pilot-033: Semantic repetition across different wording

**Proposed disposition:** The prior suggestion already asks about personal contribution and team value from the Aegis upgrade. The new question repeats part of that information need and adds trade-offs. Prefer abstention unless a distinct unresolved consequential trade-off is actually established. Preserve current/former role boundaries; Navy Aegis work is not automatically the current civilian program.

**Question-visible window**

- Interviewer: To kick things off, could you give me an overview of what you are currently working on at Pacific Maritime Technologies?
- Candidate: Certainly. I currently serve as a Senior Systems Engineer there, where my work has involved helping improve fleet integration metrics across our various technical deployments.
- Interviewer: That sounds like a complex environment. How did your background in the military shape your approach to this kind of systems engineering?
- Candidate: My perspective was deeply shaped by my U.S. Navy service, where I spent a decade from 2012 to 2022 as a Lieutenant Commander, Surface Warfare Officer and Systems Integration Lead. While our earlier mention of fleet metrics was quite broad, my actual core contribution involved leading the hands-on Aegis combat systems upgrade, ensuring our team delivered mission-critical reliability under strict operational constraints.
- Interviewer: Managing an upgrade like that is no small feat. For our compliance and contracting requirements, could you confirm your current security clearance status?
- Candidate: Yes, I currently hold an active Secret clearance.

**Recent suggestions:** Could you elaborate on the specific personal contribution and team value you delivered during your time managing the Aegis combat systems upgrade?

**Question labels**

- generator (google/gemini-3.5-flash-lite): **abstain** — No question.
- independent (anthropic/claude-haiku-4.5): **ask** — What specific improvements or operational outcomes did the Aegis combat systems upgrade deliver for the fleet, and what trade-offs or constraints did you navigate to achieve mission-critical reliability under those operational requirements?

**Full-interview extraction: `current_program`**

- Primary: null
- Independent: "fleet integration metrics"

> Candidate: Certainly. I currently serve as a Senior Systems Engineer there, where my work has involved helping improve fleet integration metrics across our various technical deployments.

Human disposition: **pending**

