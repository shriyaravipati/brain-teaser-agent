import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const TYPE_COLORS = {
  spatial: 'var(--spatial)',
  logical: 'var(--logical)',
  'lateral thinking': 'var(--lateral)',
  numerical: 'var(--numerical)',
  verbal: 'var(--verbal)',
}

function normalizeAnswer(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')
    .replace(/^(a|an|the)\s+/i, '')
    .trim()
}

function answersMatch(userAnswer, correctAnswer) {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)
}

function App() {
  const [view, setView] = useState('today')
  const [todayEntry, setTodayEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userAnswer, setUserAnswer] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)

  useEffect(() => { fetchTodayPuzzle() }, [])
  useEffect(() => { if (view === 'reports') fetchReports() }, [view])

  async function fetchTodayPuzzle() {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('entries').select('*').eq('date', today).single()
    setTodayEntry(error ? null : data)
    setLoading(false)
  }

  async function fetchReports() {
    setReportsLoading(true)
    const { data, error } = await supabase
      .from('weekly_reports').select('*').order('week_end', { ascending: false })
    if (!error) setReports(data)
    setReportsLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const isCorrect = answersMatch(userAnswer, todayEntry.correct_answer)
    const { data, error } = await supabase
      .from('entries')
      .update({
        user_answer: userAnswer,
        is_correct: isCorrect,
        difficulty_rating: difficulty,
        answered_at: new Date().toISOString(),
      })
      .eq('id', todayEntry.id)
      .select()
      .single()
    if (!error) setTodayEntry(data)
    setSubmitting(false)
  }

  const tabColor = todayEntry
    ? (TYPE_COLORS[todayEntry.puzzle_type] || 'var(--graphite)')
    : 'var(--graphite)'

  return (
    <div className="App">
      <h1>Brain Teaser</h1>

      <nav>
        <button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>
          Today
        </button>
        <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>
          Reports
        </button>
      </nav>

      {view === 'today' && (
        <>
          {loading && <p className="empty-state">Loading...</p>}

          {!loading && !todayEntry && (
            <p className="empty-state">No puzzle yet for today — check back soon.</p>
          )}

          {!loading && todayEntry && !todayEntry.answered_at && (
            <div className="card">
              <div className="card-tab" style={{ background: tabColor }} />
              <div className="card-body">
                <p className="card-type">{todayEntry.puzzle_type}</p>
                <p className="card-puzzle">{todayEntry.puzzle_text}</p>

                <form onSubmit={handleSubmit}>
                  <label>
                    Your answer
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    How hard did it feel? (1–5)
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                    />
                    <span> {difficulty}</span>
                  </label>

                  <button type="submit" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Answer'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {!loading && todayEntry && todayEntry.answered_at && (
            <div className="card">
              <div className="card-tab" style={{ background: tabColor }} />
              <div className="card-body">
                <p className="card-type">{todayEntry.puzzle_type}</p>
                <p className="card-puzzle">{todayEntry.puzzle_text}</p>
                <p className="result-line">
                  You answered: <strong>{todayEntry.user_answer}</strong> —{' '}
                  <span className={todayEntry.is_correct ? 'result-correct' : 'result-incorrect'}>
                    {todayEntry.is_correct ? 'Correct' : 'Not quite'}
                  </span>
                </p>
                {!todayEntry.is_correct && (
                  <p className="result-line">Correct answer: {todayEntry.correct_answer}</p>
                )}
                <p className="difficulty-tag">Rated {todayEntry.difficulty_rating}/5</p>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'reports' && (
        <div>
          {reportsLoading && <p className="empty-state">Loading reports...</p>}
          {!reportsLoading && reports.length === 0 && (
            <p className="empty-state">No reports yet.</p>
          )}
          {reports.map((r) => (
            <div className="report-group" key={r.id}>
              <h3 className="report-week">{r.week_start} — {r.week_end}</h3>

              {r.report_json?.by_type && (
                <div className="box">
                  <p className="box-label">Accuracy by type</p>
                  <div className="type-breakdown">
                    {r.report_json.by_type.map((t) => (
                      <div className="type-row" key={t.type}>
                        <span
                          className="type-dot"
                          style={{ background: TYPE_COLORS[t.type] || 'var(--graphite)' }}
                        />
                        <span className="type-name">{t.type}</span>
                        <span className="type-stat">{t.accuracy}% accurate</span>
                        <span className="type-stat">avg felt {t.avg_difficulty}/5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.report_json?.calibration && (
                <div className="box">
                  <p className="box-label">Calibration</p>
                  <p className="box-text">{r.report_json.calibration}</p>
                </div>
              )}

              {r.report_json?.pattern && (
                <div className="box">
                  <p className="box-label">Pattern</p>
                  <p className="box-text">{r.report_json.pattern}</p>
                </div>
              )}

              {r.report_json?.insight_points?.map((point, i) => (
                <div className="box box-insight" key={i}>
                  {i === 0 && <p className="box-label box-label-insight">Insight</p>}
                  <p className="insight-line">{point}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App