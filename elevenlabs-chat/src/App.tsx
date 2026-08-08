import { useCallback, useState } from 'react'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { SetupNotice } from './components/SetupNotice'
import { VoiceView } from './components/VoiceView'
import { AGENT_ID } from './config'
import { useAgent } from './hooks/useAgent'

type Mode = 'chat' | 'voice'

function Assistant({ agentId }: { agentId: string }) {
  const [mode, setMode] = useState<Mode>('chat')
  const [draft, setDraft] = useState('')
  const agent = useAgent(agentId)

  const submit = useCallback(() => {
    const text = draft
    setDraft('')
    void agent.send(text)
  }, [agent, draft])

  const startVoice = useCallback(async () => {
    const started = await agent.startVoice()
    if (started) setMode('voice')
  }, [agent])

  const endVoice = useCallback(() => {
    agent.stop()
    setMode('chat')
  }, [agent])

  return (
    <div className="flex h-full flex-col">
      <Header />

      {mode === 'voice' ? (
        <VoiceView getLevel={agent.getLevel} state={agent.state} />
      ) : (
        <ChatView messages={agent.messages} />
      )}

      <Composer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={submit}
        mode={mode}
        onStartVoice={startVoice}
        onEndVoice={endVoice}
        isMuted={agent.isMuted}
        onToggleMute={() => agent.setMuted(!agent.isMuted)}
        error={agent.error}
      />
    </div>
  )
}

export default function App() {
  if (!AGENT_ID) return <SetupNotice />
  return <Assistant agentId={AGENT_ID} />
}
