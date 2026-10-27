import type { FollowUp, GroundTruthEvent, QuestionExpectation, Scenario, TranscriptSegment, TranscriptTurn } from "./harness-types";

type StaticCase = {
  id: string;
  title: string;
  role: string;
  turns: TranscriptTurn[][];
  expectations: GroundTruthEvent[];
  questionExpectation: QuestionExpectation;
};

const q = (segment: number, minQuestions: number, maxQuestions: number, categories?: FollowUp["category"][]): QuestionExpectation => ({ segment, minQuestions, maxQuestions, categories });
const e = (fieldId: string, fromSegment: number, value: string): GroundTruthEvent => ({ fieldId, fromSegment, value });
const turn = (question: string, answer: string): TranscriptTurn[] => [{ speaker: "Interviewer", text: question }, { speaker: "Candidate", text: answer }];

const cases: StaticCase[] = [
  {
    id: "static-location-direct", title: "Location · Explicit Huntsville", role: "Systems engineer · Navy veteran",
    turns: [
      turn("Tell me about yourself and where you live.", "I'm Leila Morgan. I served in the Navy, and I currently live in Huntsville."),
      turn("What are you doing now?", "I'm a systems engineer at Alder Defense, where I've worked for three years."),
      turn("What have you contributed to the team?", "I automated our bench checks in Python. Setup time dropped from forty minutes to fifteen, which let the technicians finish an extra test run each shift."),
    ],
    expectations: [e("full_name", 1, "Leila Morgan"), e("military_service", 1, "Navy"), e("location", 1, "Huntsville"), e("current_employer", 2, "Alder Defense"), e("current_title", 2, "systems engineer"), e("tenure", 2, "three years"), e("key_technologies", 3, "Python")],
    questionExpectation: q(1, 0, 3),
  },
  {
    id: "static-location-indirect", title: "Location · Here in Huntsville", role: "Systems engineer · Navy veteran",
    turns: [
      turn("Tell me about your background.", "I'm Leila Morgan. I served in the Navy before moving into civilian engineering."),
      turn("What are you doing now?", "I'm a systems engineer at Alder Defense here in Huntsville, where I've worked for three years."),
      turn("What have you contributed to the team?", "I automated our bench checks in Python. Setup time dropped from forty minutes to fifteen, which let the technicians finish an extra test run each shift."),
    ],
    expectations: [e("full_name", 1, "Leila Morgan"), e("military_service", 1, "Navy"), e("location", 2, "Huntsville"), e("current_employer", 2, "Alder Defense"), e("current_title", 2, "systems engineer"), e("tenure", 2, "three years"), e("key_technologies", 3, "Python")],
    questionExpectation: q(1, 0, 3),
  },
  {
    id: "static-location-current-former", title: "Location · Norfolk before, Raleigh now", role: "Maintenance planner · Coast Guard veteran",
    turns: [
      turn("Where has your career taken you?", "I'm Owen Blake. I served in the Coast Guard and used to live in Norfolk. I moved to Raleigh two years ago and still live there."),
      turn("What is your current job?", "I work as a maintenance planner at Cedar Fleet Services. My earlier depot job was in Norfolk, but this job is in Raleigh."),
      turn("Tell me about a planning improvement you owned.", "I changed how we sequence parts orders before scheduled maintenance. The mechanics spent less time waiting for missing parts, although we haven't put a reliable number on that improvement yet."),
    ],
    expectations: [e("full_name", 1, "Owen Blake"), e("military_service", 1, "Coast Guard"), e("location", 1, "Raleigh"), e("current_employer", 2, "Cedar Fleet Services"), e("current_title", 2, "maintenance planner")],
    questionExpectation: q(1, 0, 3),
  },
  {
    id: "static-location-correction", title: "Location · Austin corrected to Reno", role: "Technical trainer · Army veteran",
    turns: [
      turn("Please introduce yourself and confirm your location.", "I'm Nina Alvarez, an Army veteran. I'm based in Austin."),
      turn("What is your current role?", "I'm a technical trainer at Mesa Learning Systems, and I've been there for eighteen months."),
      turn("Is Austin still the right city for our records?", "Actually, that's my old address. I moved to Reno, Nevada last month and live there now. Please use Reno, Nevada as my current location."),
      turn("What kind of work would you like next?", "I want to design hands-on training for maintenance teams, with more responsibility for checking whether people can apply the material on the job."),
    ],
    expectations: [e("full_name", 1, "Nina Alvarez"), e("military_service", 1, "Army"), e("location", 1, "Austin"), e("current_employer", 2, "Mesa Learning Systems"), e("current_title", 2, "technical trainer"), e("tenure", 2, "eighteen months"), e("location", 3, "Reno, Nevada"), e("area_of_interest", 4, "design hands-on training for maintenance teams")],
    questionExpectation: q(1, 0, 3),
  },
  {
    id: "static-location-remote", title: "Location · Madison home, Denver HQ", role: "Cybersecurity analyst · Air Force veteran",
    turns: [
      turn("Tell me about yourself and your work arrangement.", "I'm Farah Bennett, an Air Force veteran. I live in Madison, Wisconsin and work remotely for Birch Security. The company's headquarters is in Denver."),
      turn("What do you do there?", "I'm a cybersecurity analyst. I review access changes and investigate accounts that still have permissions after a project ends."),
      turn("Does the work involve travel?", "I visit a client site in Austin once a quarter, but Madison, Wisconsin is my home and the place I work from the rest of the time."),
    ],
    expectations: [e("full_name", 1, "Farah Bennett"), e("military_service", 1, "Air Force"), e("location", 1, "Madison, Wisconsin"), e("current_employer", 1, "Birch Security"), e("current_title", 2, "cybersecurity analyst")],
    questionExpectation: q(1, 0, 3),
  },
  {
    id: "static-location-destination-only", title: "Location · Denver is a future move", role: "Program analyst · Marine Corps veteran",
    turns: [
      turn("Tell me about your background and current work.", "I'm Gabriel Ortiz. I served in the Marine Corps and now work as a program analyst at Summit Program Services."),
      turn("Would you consider moving for the right role?", "Yes, I would consider relocating to Denver for the right opportunity."),
      turn("Where do you currently live?", "I'd prefer not to provide my current city in this interview. Denver is somewhere I'm considering moving to, not where I live now."),
    ],
    expectations: [e("full_name", 1, "Gabriel Ortiz"), e("military_service", 1, "Marine Corps"), e("current_employer", 1, "Summit Program Services"), e("current_title", 1, "program analyst"), e("relocation", 2, "would consider relocating to Denver")],
    questionExpectation: q(1, 0, 3),
  },
  {
    id: "static-vague-launch-15s", title: "Vague product launch -15s", role: "Product manager",
    turns: [
      turn("What impact did your latest launch have?", "I led the launch of our new onboarding flow. It was a big cross-functional effort, and the launch went really well. Customers responded positively, and it made a meaningful difference to the business."),
    ],
    expectations: [],
    questionExpectation: q(1, 1, 1, ["quantify_impact"]),
  },
  {
    id: "static-quantified-reliability-15s", title: "Quantified reliability result -15s", role: "Site reliability engineer",
    turns: [
      turn("Tell me about a reliability improvement you owned.", "I built and rolled out a new alert-routing service in Go and Kafka across 120 production services. Over one quarter, it reduced our median incident response time from 47 minutes to 18 minutes."),
    ],
    expectations: [e("key_technologies", 1, "Go and Kafka")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-unclear-ownership-15s", title: "Unclear migration ownership -15s", role: "Engineering lead",
    turns: [
      turn("What was your role in the cloud migration?", "We moved the customer platform to AWS last year. The team completed it ahead of schedule with no major outages, and leadership considered the migration a major success."),
    ],
    expectations: [e("key_technologies", 1, "AWS")],
    questionExpectation: q(1, 1, 1, ["clarify_vague_claim"]),
  },
  {
    id: "static-logistics-only-15s", title: "Contact and compensation -15s", role: "Finance manager",
    turns: [
      turn("What are the best contact details and compensation range for you?", "My preferred email is jordan.lee@example.com, and my cell is 415-555-0186. I'm currently at 165 thousand base and targeting around 185 thousand for my next role."),
    ],
    expectations: [e("email", 1, "jordan.lee@example.com"), e("phone", 1, "415-555-0186"), e("current_salary", 1, "$165K base"), e("target_salary", 1, "$185K")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-title-correction-15s", title: "Current-title correction -15s", role: "Data engineering manager",
    turns: [
      turn("Tell me about your current position.", "I'm Maya Patel in Austin. I've been at Northstar Data for three years as an engineering manager—actually, I was promoted in June, so my current title is senior data engineering manager."),
    ],
    expectations: [e("full_name", 1, "Maya Patel"), e("location", 1, "Austin"), e("current_employer", 1, "Northstar Data"), e("tenure", 1, "three years"), e("current_title", 1, "senior data engineering manager")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-clear-systems", title: "Static · Clear systems engineer", role: "Systems engineer",
    turns: [
      turn("Please introduce yourself and tell me where you are based.", "I'm Elena Ramirez, based in Tucson, Arizona. I served in the Army before moving into civilian systems engineering."),
      turn("What is your current role?", "I'm a senior systems engineer at Copper Ridge Defense, and I have been there for four years."),
      turn("Describe your current work.", "I support the Horizon radar modernization program using MATLAB, Python, and Monte Carlo simulation."),
      turn("What did you personally accomplish?", "I redesigned the tracking filter and reduced false tracks from 6.2 percent to 1.4 percent over eight months."),
      turn("What are your logistics for a move?", "I'm targeting a $190K base, can start after three weeks, and prefer to remain in Tucson."),
    ],
    expectations: [e("military_service", 1, "Army"), e("full_name", 1, "Elena Ramirez"), e("location", 1, "Tucson, Arizona"), e("current_title", 2, "senior systems engineer"), e("current_employer", 2, "Copper Ridge Defense"), e("tenure", 2, "four years"), e("current_program", 3, "Horizon radar modernization program"), e("key_technologies", 3, "MATLAB, Python, and Monte Carlo simulation"), e("target_salary", 5, "$190K base"), e("availability", 5, "three weeks"), e("relocation", 5, "prefer to remain in Tucson")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-vague-product", title: "Static · Vague product leader", role: "Product leader",
    turns: [
      turn("Tell me about your background.", "I'm Marcus Chen in Chicago, and I'm the director of product at Brightwell Health."),
      turn("Tell me about a recent launch.", "I led our onboarding redesign. It went really well and made a huge difference for customers."),
      turn("What specifically changed?", "I owned the experiment design and rollout; activation increased from 42 to 61 percent within three months."),
      turn("Why are you considering leaving?", "I want to work on products where I can own strategy and stay close to customer research."),
      turn("What compensation are you targeting?", "I'm targeting $225K base plus equity and could start in six weeks."),
    ],
    expectations: [e("full_name", 1, "Marcus Chen"), e("location", 1, "Chicago"), e("current_title", 1, "director of product"), e("current_employer", 1, "Brightwell Health"), e("reason_for_leaving", 4, "work on products where I can own strategy and stay close to customer research"), e("area_of_interest", 4, "own strategy and stay close to customer research"), e("target_salary", 5, "$225K base plus equity"), e("availability", 5, "six weeks")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-security", title: "Static · Security architect", role: "Security architect",
    turns: [
      turn("Walk me through your recent employers.", "I served in the Air Force, then previously worked at Harbor Bank. I now work at Mesa Cloud as a principal security architect."),
      turn("What environment do you support?", "I support the Atlas zero-trust program and hold an active TS/SCI clearance."),
      turn("What technologies do you use?", "My core tools are OPA, Terraform, Kubernetes, and AWS Organizations."),
      turn("What was the outcome?", "I reduced critical policy violations by 73 percent across 180 cloud accounts in two quarters."),
      turn("How large is the organization you lead?", "I directly lead eight engineers and coordinate with twenty-four application teams."),
    ],
    expectations: [e("military_service", 1, "Air Force"), e("current_employer", 1, "Mesa Cloud"), e("current_title", 1, "principal security architect"), e("current_program", 2, "Atlas zero-trust program"), e("security_clearance", 2, "active TS/SCI clearance"), e("key_technologies", 3, "OPA, Terraform, Kubernetes, and AWS Organizations"), e("team_size", 5, "eight engineers")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-corrections", title: "Static · Mid-conversation corrections", role: "Engineering manager",
    turns: [
      turn("Please introduce yourself.", "I'm Priya Nair in Raleigh. You can use priya@oldmail.example."),
      turn("What is your current position?", "I joined Lattice Robotics as an engineering manager two years ago."),
      turn("Is that still your title?", "Let me correct that: I was promoted last month, so my current title is senior engineering manager."),
      turn("Any correction to your contact details?", "Yes, don't use the earlier address. My preferred email is priya.nair@example.com."),
      turn("When could you start?", "I initially thought two weeks, but I need four weeks after accepting an offer."),
    ],
    expectations: [e("full_name", 1, "Priya Nair"), e("location", 1, "Raleigh"), e("email", 1, "priya@oldmail.example"), e("current_employer", 2, "Lattice Robotics"), e("current_title", 2, "engineering manager"), e("tenure", 2, "two years"), e("current_title", 3, "senior engineering manager"), e("email", 4, "priya.nair@example.com"), e("availability", 5, "four weeks")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-ownership", title: "Static · Unclear team ownership", role: "Program manager",
    turns: [
      turn("Tell me about your current work.", "I'm Devon Brooks, a technical program manager at Northline Mobility."),
      turn("Describe a successful program.", "We delivered the platform migration successfully, and leadership was extremely happy with the result."),
      turn("What was your own contribution?", "I created the dependency plan, negotiated the cutover sequence, and personally ran the final readiness review."),
      turn("Can you quantify the result?", "The migration moved 64 services with zero priority-one incidents and finished three weeks early."),
      turn("Why are you looking now?", "I want a role with broader technical ownership and responsibility for portfolio strategy."),
    ],
    expectations: [e("full_name", 1, "Devon Brooks"), e("current_title", 1, "technical program manager"), e("current_employer", 1, "Northline Mobility"), e("reason_for_leaving", 5, "broader technical ownership and responsibility for portfolio strategy"), e("area_of_interest", 5, "portfolio strategy")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-early-career", title: "Static · Early-career data scientist", role: "Data scientist",
    turns: [
      turn("Tell me about your education.", "I'm Amina Yusuf. I earned a bachelor's in statistics in 2022 and a master's in data science in 2024."),
      turn("Where are you working now?", "I'm a data scientist at Cedar Analytics in Boston, where I have worked for eleven months."),
      turn("What tools do you use?", "I use Python, PyTorch, SQL, and MLflow for demand forecasting."),
      turn("Tell me about the forecasting result.", "The model was much more accurate and the operations team really liked it."),
      turn("What kind of work interests you next?", "I want to build production forecasting systems and learn more about causal inference."),
    ],
    expectations: [e("full_name", 1, "Amina Yusuf"), e("bachelors_degree", 1, "bachelor's in statistics"), e("bachelors_year", 1, "2022"), e("masters_degree", 1, "master's in data science"), e("masters_year", 1, "2024"), e("current_title", 2, "data scientist"), e("current_employer", 2, "Cedar Analytics"), e("location", 2, "Boston"), e("tenure", 2, "eleven months"), e("key_technologies", 3, "Python, PyTorch, SQL, and MLflow"), e("area_of_interest", 5, "production forecasting systems and causal inference")],
    questionExpectation: q(1, 1, 3, ["quantify_impact"]),
  },
  {
    id: "static-logistics", title: "Static · Changing logistics", role: "Operations director",
    turns: [
      turn("Tell me about your current role.", "I'm Noah Williams, operations director at Solace Energy in Houston."),
      turn("What is your current compensation?", "My current base is $178K, and I would target $205K base for a move."),
      turn("What are your availability and relocation preferences?", "I can start in three weeks and would relocate to Denver."),
      turn("Has anything changed about that timing?", "I need to correct the timing: because of a project handoff, I would need six weeks."),
      turn("And are you still open to Denver?", "After discussing it with my family, I cannot relocate, but I can travel up to thirty percent."),
    ],
    expectations: [e("full_name", 1, "Noah Williams"), e("current_title", 1, "operations director"), e("current_employer", 1, "Solace Energy"), e("location", 1, "Houston"), e("current_salary", 2, "$178K"), e("target_salary", 2, "$205K base"), e("availability", 3, "three weeks"), e("relocation", 3, "relocate to Denver"), e("availability", 4, "six weeks"), e("relocation", 5, "cannot relocate, but I can travel up to thirty percent")],
    questionExpectation: q(1, 0, 0),
  },
  {
    id: "static-original-document", title: "Static · Original document example", role: "Lead systems engineer",
    turns: [
      turn("What's the best phone number and email to reach you after this?", "Cell is (256) 555-0173, and email is first.last@example.mil – actually, let me correct that, use my personal one, firstlast.eng@example.com. I still have my .mil address from the Army."),
      turn("So after the Army, what did you move into?", "I transitioned to the defense contracting side. My first role out was at Raytheon – well, it's RTX now after the merger – as a systems engineer supporting Patriot modernization. I did about four years there. Then I moved to a smaller shop, a company called Torch Technologies here in Huntsville, where I've been for the last three years as a lead systems engineer."),
      turn("What's the hardest engineering problem you've personally owned on that effort?", "Track correlation and the composite tracking. When you're fusing data from multiple sensors with different update rates, different error ellipses, different latencies, you can get track duplication. I owned the analysis effort to characterize that under stress conditions. We built a Monte Carlo simulation environment to run thousands of engagement scenarios and quantify the correlation error rate."),
      turn("Let's talk logistics. What's your target compensation?", "My current total comp is around 178 base with a bonus that runs 10 to 15 percent. For a move I'd be looking at a base in the 205 to 215 range, but I'm flexible if there's a strong bonus or equity story."),
      turn("On start date and location – is this role's location a factor?", "I'm not looking to relocate – I've got two kids in school here and my spouse has a job at the arsenal. On timing, I'd give three weeks notice, so call it mid to late August."),
    ],
    expectations: [
      e("location", 1, "Huntsville"),
      e("phone", 1, "(256) 555-0173"),
      e("email", 1, "firstlast.eng@example.com"),
      e("military_service", 1, "Army"),
      e("current_employer", 1, "Torch Technologies"),
      e("current_title", 1, "Systems Engineer"),
      e("tenure", 1, "3 years"),
      e("key_technologies", 1, "Monte Carlo simulation"),
      e("current_salary", 1, "About $178K base plus a 10–15% bonus"),
      e("target_salary", 1, "$205K–$215K base, flexible on structure"),
      e("availability", 1, "3 weeks' notice – mid-to-late August"),
      e("relocation", 1, "Not willing to relocate; Huntsville only"),
    ],
    questionExpectation: q(1, 1, 1, ["quantify_impact"]),
  },
];

function toScenario(item: StaticCase): Scenario {
  const turns = item.turns.flatMap((exchange, index) => exchange.map((utterance) => ({ ...utterance, turnId: index + 1, ...(utterance.speaker === "Candidate" ? { responseComplete: true } : {}) })));
  const endSeconds = Math.ceil(turns.reduce((sum, utterance) => sum + utterance.text.split(/\s+/).length, 0) / 35) * 15;
  const receivedAt = new Date(Date.UTC(2026, 9, 21, 10, 0, endSeconds));
  const segments: TranscriptSegment[] = [{ id: `${item.id}-chunk-01`, date: receivedAt.toISOString().slice(0, 10), timestamp: receivedAt.toISOString().slice(11), startSeconds: 0, endSeconds, turns }];
  return { id: item.id, title: item.title, role: item.role, segments, expectations: item.expectations.map((event) => ({ ...event, fromSegment: 1 })), questionExpectations: [item.questionExpectation] };
}

export const staticCases = cases.map(toScenario);

/** Fixed 15-second windows at 140 words/minute, including partial exchanges. */
function toMultiChunkScenario(item: StaticCase): Scenario {
  const segments: TranscriptSegment[] = [];
  const exchangeEnd = new Map<number, number>();
  let wordsInChunk = 0;
  for (const [exchangeIndex, exchange] of item.turns.entries()) {
    for (const utterance of exchange) {
      const words = utterance.text.split(/\s+/);
      for (let offset = 0; offset < words.length;) {
        if (!segments.length || wordsInChunk === 35) {
          const startSeconds = segments.length * 15;
          const receivedAt = new Date(Date.UTC(2026, 9, 21, 10, 0, startSeconds + 15));
          segments.push({ id: `${item.id}-chunk-${String(segments.length + 1).padStart(2, "0")}`, date: receivedAt.toISOString().slice(0, 10), timestamp: receivedAt.toISOString().slice(11), startSeconds, endSeconds: startSeconds + 15, turns: [] });
          wordsInChunk = 0;
        }
        const count = Math.min(35 - wordsInChunk, words.length - offset);
        segments.at(-1)!.turns.push({ ...utterance, turnId: exchangeIndex + 1, text: words.slice(offset, offset + count).join(" "), ...(utterance.speaker === "Candidate" ? { responseComplete: offset + count === words.length } : {}) });
        wordsInChunk += count;
        offset += count;
      }
    }
    exchangeEnd.set(exchangeIndex + 1, segments.length);
  }
  return {
    id: item.id, title: item.title, role: item.role, segments,
    expectations: item.expectations.map((event) => ({ ...event, fromSegment: exchangeEnd.get(event.fromSegment) ?? segments.length })),
    // Whole-preset question counts are not valid expectations for partial chunks.
    questionExpectations: [],
  };
}

export const multiChunkCases = cases.filter((item) => item.turns.length > 1).map(toMultiChunkScenario);

/** User-facing demo stays within veteran job interviews; other fixtures remain regression-only. */
const demoOrder = [
  "static-original-document", "static-clear-systems", "static-security",
  "static-location-direct", "static-location-indirect", "static-location-current-former",
  "static-location-correction", "static-location-remote", "static-location-destination-only",
];
export const demoCases = demoOrder.map((id) => staticCases.find((item) => item.id === id)!);
export const demoMultiChunkCases = demoOrder.map((id) => multiChunkCases.find((item) => item.id === id)!);
