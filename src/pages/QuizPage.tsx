import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentMembers, Member } from '@/lib/dataService'
import MiniCompass from '@/components/MiniCompass'

interface Question {
  id: string
  text: string
  xWeight: number
  yWeight: number
}

const QUESTIONS: Question[] = [
  { id: 'q1', text: 'Free markets produce better outcomes than government-managed economies', xWeight: 0.6, yWeight: 0 },
  { id: 'q2', text: 'Government should provide universal healthcare as a public service', xWeight: -0.6, yWeight: 0 },
  { id: 'q3', text: 'Wealthy individuals should pay significantly higher taxes', xWeight: -0.5, yWeight: 0.1 },
  { id: 'q4', text: 'LGBTQ+ individuals should have equal legal protections', xWeight: 0, yWeight: -0.6 },
  { id: 'q5', text: 'Abortion should be a personal choice without government restriction', xWeight: 0, yWeight: -0.5 },
  { id: 'q6', text: 'Immigration should be significantly restricted', xWeight: 0, yWeight: 0.5 },
  { id: 'q7', text: 'Police budgets should be increased to combat crime', xWeight: 0.2, yWeight: 0.4 },
  { id: 'q8', text: 'Large corporations have too much political influence', xWeight: -0.4, yWeight: -0.2 },
]

export default function QuizPage() {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [showResult, setShowResult] = useState(false)

  const { data: members } = useQuery({
    queryKey: ['compass-members-quiz'],
    queryFn: () => getCurrentMembers(),
    enabled: showResult,
  })

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers({ ...answers, [questionId]: value })
  }

  const calculateScore = () => {
    let x = 0
    let y = 0
    for (const q of QUESTIONS) {
      const answer = answers[q.id] || 0
      x += answer * q.xWeight
      y += answer * q.yWeight
    }
    // Normalize to -1 to 1
    x = Math.max(-1, Math.min(1, x / (QUESTIONS.length * 0.6)))
    y = Math.max(-1, Math.min(1, y / (QUESTIONS.length * 0.6)))
    return { x, y }
  }

  const score = calculateScore()

  const closestMembers = (members || [])
    .filter(m => m.compassX !== undefined && m.compassY !== undefined)
    .map(m => ({
      ...m,
      distance: Math.sqrt(
        Math.pow((m.compassX || 0) - score.x, 2) +
        Math.pow((m.compassY || 0) - score.y, 2)
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Political Ideology Quiz</h1>

      {!showResult ? (
        <div className="space-y-6">
          {QUESTIONS.map(q => (
            <div key={q.id} className="bg-card border border-border p-4 rounded-lg">
              <p className="mb-4 font-medium">{q.text}</p>
              <div className="flex gap-2">
                {[-2, -1, 0, 1, 2].map(val => (
                  <button
                    key={val}
                    onClick={() => handleAnswer(q.id, val)}
                    className={`px-3 py-2 rounded-lg flex-1 ${
                      answers[q.id] === val
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    {val === -2 ? 'Strongly Disagree' : val === -1 ? 'Disagree' : val === 0 ? 'Neutral' : val === 1 ? 'Agree' : 'Strongly Agree'}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowResult(true)}
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold"
          >
            See Your Result
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-border p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">Your Political Position</h2>
            <MiniCompass compassX={score.x} compassY={score.y} name="You" party="Other" />
          </div>

          <div className="bg-card border border-border p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Closest Members of Congress</h3>
            <div className="space-y-3">
              {closestMembers.length > 0 ? (
                closestMembers.map(m => (
                  <div key={m.bioguideId} className="p-3 bg-background rounded-lg">
                    <div className="font-semibold">{m.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {m.chamber === 'Senate' ? 'Senator' : 'Representative'} from {m.state} ({m.party})
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Loading members...</p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setShowResult(false)
              setAnswers({})
            }}
            className="w-full px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90"
          >
            Retake Quiz
          </button>
        </div>
      )}
    </div>
  )
}
