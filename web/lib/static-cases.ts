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
    id: "static-clear-systems", title: "Static · Clear systems engineer", role: "Systems engineer",
    turns: [
      turn("Please introduce yourself and tell me where you are based.", "I'm Elena Ramirez, based in Tucson, Arizona."),
      turn("What is your current role?", "I'm a senior systems engineer at Copper Ridge Defense, and I have been there for four years."),
      turn("Describe your current work.", "I support the Horizon radar modernization program using MATLAB, Python, and Monte Carlo simulation."),
      turn("What did you personally accomplish?", "I redesigned the tracking filter and reduced false tracks from 6.2 percent to 1.4 percent over eight months."),
      turn("What are your logistics for a move?", "I'm targeting a $190K base, can start after three weeks, and prefer to remain in Tucson."),
    ],
    expectations: [e("full_name", 1, "Elena Ramirez"), e("location", 1, "Tucson, Arizona"), e("current_title", 2, "senior systems engineer"), e("current_employer", 2, "Copper Ridge Defense"), e("tenure", 2, "four years"), e("current_program", 3, "Horizon radar modernization program"), e("key_technologies", 3, "MATLAB, Python, and Monte Carlo simulation"), e("target_salary", 5, "$190K base"), e("availability", 5, "three weeks"), e("relocation", 5, "prefer to remain in Tucson")],
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
      turn("Walk me through your recent employers.", "I previously worked at Harbor Bank. I now work at Mesa Cloud as a principal security architect."),
      turn("What environment do you support?", "I support the Atlas zero-trust program and hold an active TS/SCI clearance."),
      turn("What technologies do you use?", "My core tools are OPA, Terraform, Kubernetes, and AWS Organizations."),
      turn("What was the outcome?", "I reduced critical policy violations by 73 percent across 180 cloud accounts in two quarters."),
      turn("How large is the organization you lead?", "I directly lead eight engineers and coordinate with twenty-four application teams."),
    ],
    expectations: [e("current_employer", 1, "Mesa Cloud"), e("current_title", 1, "principal security architect"), e("current_program", 2, "Atlas zero-trust program"), e("security_clearance", 2, "active TS/SCI clearance"), e("key_technologies", 3, "OPA, Terraform, Kubernetes, and AWS Organizations"), e("team_size", 5, "eight engineers")],
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
    questionExpectation: q(1, 2, 3, ["clarify_vague_claim", "quantify_impact", "surface_gap"]),
  },
];

function toScenario(item: StaticCase): Scenario {
  const segments: TranscriptSegment[] = [{ id: `${item.id}-transcript`, startSeconds: 0, endSeconds: 15, turns: item.turns.flat() }];
  return { id: item.id, title: item.title, role: item.role, segments, expectations: item.expectations.map((event) => ({ ...event, fromSegment: 1 })), questionExpectations: [item.questionExpectation] };
}

export const staticCases = cases.map(toScenario);
