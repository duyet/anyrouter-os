import { useMemo, type ReactNode } from 'react'
import {
  AppWindow,
  BookOpen,
  ChartBar,
  ChartLineUp,
  ClipboardText,
  CookingPot,
  FileText,
  Lightning,
  ListChecks,
  MagnifyingGlass,
  MapTrifold,
  Newspaper,
  NotePencil,
  PencilSimple,
  Presentation,
  PuzzlePiece,
  Robot,
  RocketLaunch,
  Scales,
  type Icon,
} from '@phosphor-icons/react'

// A few example work tasks shown under the Home composer, so a new user immediately sees the kind
// of thing they can ask for. Picking one drops a starter prompt into the composer (it does not
// auto-send) so the user can tweak it before running.
export type SuggestionDomain =
  | 'writing'
  | 'data'
  | 'agents'
  | 'tools'
  | 'research'
  | 'ops'

export type TaskSuggestion = {
  id: string
  label: string
  description: string
  prompt: string
  icon: Icon
  domain: SuggestionDomain
}

// Formats are advertised by example rather than by a row of "Start with Docs" buttons, so the
// first move isn't "pick a file type". The formats themselves are in the composer's `+` menu.
export const SUGGESTIONS: TaskSuggestion[] = [
  {
    id: 'one-on-one',
    domain: 'writing',
    label: 'Write a 1:1 pre-read',
    description: 'Snapshot, coaching frame, and one clear ask',
    icon: FileText,
    prompt:
      'Create a document to prepare for my next 1:1 with a direct report: a current snapshot, a coaching frame, things to inspect, carryover items from last time, and one clear ask. Ask me who it is and what has been going on.',
  },
  {
    id: 'team-meeting',
    domain: 'ops',
    label: 'Build a team meeting deck',
    description: 'Progress, risks, and the decisions I need',
    icon: Presentation,
    prompt:
      'Create a slide deck for my next team meeting: where things stand, what shipped, risks and blockers, and the decisions I need from the room. Ask me what the team is working on first.',
  },
  {
    id: 'insights',
    domain: 'data',
    label: 'Find the story in a spreadsheet',
    description: 'Trends, anomalies, and what to do next',
    icon: ChartLineUp,
    prompt:
      'Turn a dataset I will share (a spreadsheet, CSV, or pasted table) into a narrative analysis: key trends, anomalies, the "so what", and concrete recommendations. Ask me what decision this is meant to inform.',
  },
  {
    id: 'workflow',
    domain: 'agents',
    label: 'Watch an inbox and act',
    description: 'An agent that reads mail and drafts or does',
    icon: Lightning,
    prompt:
      'Create an agent workflow that runs when a new email arrives: read the message, decide what to do, and take action or draft a reply. Ask me which inbox to watch and what it should handle vs. ignore.',
  },
  {
    id: 'app',
    domain: 'tools',
    label: 'Build a tiny interactive tool',
    description: 'Calculator, explorer, or single-purpose app',
    icon: AppWindow,
    prompt:
      'Build a small interactive tool I can use right here — a calculator, converter, dashboard, or explorer. Ask me what it should do and who it is for, then create it.',
  },
  {
    id: 'decision-memo',
    domain: 'writing',
    label: 'Write a one-page decision',
    description: 'Options, tradeoffs, and a recommended call',
    icon: NotePencil,
    prompt:
      'Write a one-page decision memo: the decision, context, options with tradeoffs, recommendation, and what we would need to reverse it. Ask me what we are deciding and the constraints that matter.',
  },
  {
    id: 'research-brief',
    domain: 'research',
    label: 'Turn sources into a brief',
    description: 'Claims, caveats, and what is still unknown',
    icon: MagnifyingGlass,
    prompt:
      'Research a question from sources I will paste or describe. Produce a brief: what we know, competing claims, caveats, and the open questions. Ask me the question and the audience.',
  },
  {
    id: 'rewrite',
    domain: 'writing',
    label: 'Tighten a messy draft',
    description: 'Keep my voice, cut the fog, keep the facts',
    icon: PencilSimple,
    prompt:
      'Rewrite a messy draft I will paste: keep my voice and the facts, cut repetition, and make the ask obvious. Ask me the audience and whether this should sound more direct or more diplomatic.',
  },
  {
    id: 'dashboard',
    domain: 'data',
    label: 'Make a personal metrics board',
    description: 'A live-feeling dashboard from numbers I have',
    icon: ChartBar,
    prompt:
      'Build a small dashboard for personal or team metrics I will describe or paste. Show the headline numbers, a trend, and one "watch this" callout. Ask me which metrics matter and how often they update.',
  },
  {
    id: 'compare',
    domain: 'data',
    label: 'Score options side by side',
    description: 'A sheet that ranks choices on my criteria',
    icon: Scales,
    prompt:
      'Create a comparison sheet that scores options against criteria I care about, with a weighted total and a short recommendation. Ask me the options and the criteria (and any deal-breakers).',
  },
  {
    id: 'digest',
    domain: 'agents',
    label: 'Draft a daily brief',
    description: 'An agent that gathers, then writes the recap',
    icon: Newspaper,
    prompt:
      'Create an agent that prepares a daily brief: gather what changed, group it, and write a short recap with links and one suggested next step. Ask me which sources to watch and what "important" means.',
  },
  {
    id: 'recurring-agent',
    domain: 'agents',
    label: 'Set a recurring check-in',
    description: 'A scheduled agent that pings me with a recap',
    icon: Robot,
    prompt:
      'Set up a scheduled agent that checks in on a cadence I choose, summarizes what changed, and asks me one question. Ask me the cadence, what it should inspect, and how it should reach me.',
  },
  {
    id: 'flashcards',
    domain: 'tools',
    label: 'Turn notes into a study deck',
    description: 'A quiz I can flip through right here',
    icon: PuzzlePiece,
    prompt:
      'Build a small study tool from notes I will paste: flashcards or a short quiz, with the answer hidden until I reveal it. Ask me the subject and how hard to make it.',
  },
  {
    id: 'landing',
    domain: 'tools',
    label: 'Sketch a landing page',
    description: 'Headline, proof, and a single call to action',
    icon: RocketLaunch,
    prompt:
      'Sketch a landing page I can click around in: a sharp headline, three proof points, and one call to action. Ask me what I am shipping and who it is for.',
  },
  {
    id: 'recipe',
    domain: 'tools',
    label: 'Invent a recipe from what I have',
    description: 'A dish, a shopping gap, and the method',
    icon: CookingPot,
    prompt:
      'Invent a recipe from ingredients I have on hand. Give me the dish, any small shopping gap, timing, and a method I can actually follow. Ask me the ingredients, dietary constraints, and how much time I have.',
  },
  {
    id: 'explain',
    domain: 'research',
    label: 'Explain a hard idea simply',
    description: 'A short briefing aimed at a real audience',
    icon: BookOpen,
    prompt:
      'Explain a hard idea as a short briefing for a specific audience: the intuition, one concrete example, and the usual misconceptions. Ask me the topic and who I am explaining it to.',
  },
  {
    id: 'itinerary',
    domain: 'research',
    label: 'Plan a trip as a document',
    description: 'Days, logistics, and a realistic pace',
    icon: MapTrifold,
    prompt:
      'Plan a trip as a document: day-by-day, transit, reservations to make, and a pace that will not collapse. Ask me where, when, budget, and what I actually want out of the days.',
  },
  {
    id: 'runbook',
    domain: 'ops',
    label: 'Draft an incident runbook',
    description: 'Symptoms, checks, and who to page',
    icon: ClipboardText,
    prompt:
      'Draft an incident runbook: what it looks like, first checks, rollback or mitigate steps, and who to page. Ask me the system, the failure mode, and who owns it.',
  },
  {
    id: 'onboarding',
    domain: 'ops',
    label: 'Map a first-week onboarding',
    description: 'People to meet, access, and a first win',
    icon: ListChecks,
    prompt:
      'Create a first-week onboarding plan: people to meet, access to get, docs to read, and one small first win. Ask me the role, the team, and what "ready" looks like by Friday.',
  },
]

// One row, shared by every suggestion so the list reads as one kind of offer — not a format picker.
function SuggestionRow({
  icon,
  label,
  description,
  onClick,
}: {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="press group flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-kumo-tint focus-visible:bg-kumo-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kumo-ring"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-kumo-line bg-kumo-elevated text-kumo-subtle transition-colors group-hover:border-kumo-fill group-hover:text-kumo-default">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-[18px] font-medium tracking-[-0.25px] text-kumo-default">
            {label}
          </span>
          <span className="mt-0.5 block text-[12px] leading-4 tracking-[-0.2px] text-kumo-subtle">
            {description}
          </span>
        </span>
      </button>
    </li>
  )
}

// How many of the suggestions above to show at once. The list is longer than the page should be:
// four rows is inspiration, seven is a menu to read. Which three appear is chosen per visit, so the
// ones below the fold still get seen -- and so Home doesn't look like it only does one thing.
export const VISIBLE_SUGGESTIONS = 3

export function pickSuggestions(random: () => number = Math.random): TaskSuggestion[] {
  const shuffled = [...SUGGESTIONS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, VISIBLE_SUGGESTIONS)
}

export default function HomeTaskSuggestions({
  onPick,
}: {
  onPick: (prompt: string) => void
}) {
  // Chosen once per mount: re-rolling on every render would shuffle the list under the pointer.
  const visible = useMemo(() => pickSuggestions(), [])

  return (
    <section aria-label="Example tasks" className="flex flex-col gap-1">
      <h3 className="px-3 pb-1 text-[12px] font-medium uppercase tracking-[0.06em] text-kumo-inactive">
        Get started
      </h3>
      <ul className="flex flex-col gap-0.5">
        {visible.map((suggestion) => (
          <SuggestionRow
            key={suggestion.id}
            icon={<suggestion.icon size={18} />}
            label={suggestion.label}
            description={suggestion.description}
            onClick={() => onPick(suggestion.prompt)}
          />
        ))}
      </ul>
    </section>
  )
}
