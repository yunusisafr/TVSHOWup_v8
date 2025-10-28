import React, { createContext, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface WizardState {
  filters?: any
  results?: any[]
  step?: number
}
interface AuthPromptContextType {
  isPromptOpen: boolean
  openAuthPrompt: (action?: string, redirectPath?: string) => void
  closeAuthPrompt: () => void
  promptAction: string | null
  redirectPath: string | null
  wizardState: WizardState | null
  setWizardState: (state: WizardState | null) => void
}

const AuthPromptContext = createContext<AuthPromptContextType | undefined>(undefined)

export const useAuthPrompt = () => {
  const context = useContext(AuthPromptContext)
  if (context === undefined) {
    throw new Error('useAuthPrompt must be used within an AuthPromptProvider')
  }
  return context
}

export const AuthPromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [promptAction, setPromptAction] = useState<string | null>(null)
  const [redirectPath, setRedirectPath] = useState<string | null>(null)
  const [wizardState, setWizardState] = useState<WizardState | null>(null)
  const navigate = useNavigate()

  const openAuthPrompt = (action: string = 'watchlist', path: string = window.location.pathname + window.location.search) => {
    setPromptAction(action)
    setRedirectPath(path)
    setIsPromptOpen(true)
  }

  const closeAuthPrompt = () => {
    setIsPromptOpen(false)
  }

  return (
    <AuthPromptContext.Provider
      value={{
        isPromptOpen,
        openAuthPrompt,
        closeAuthPrompt,
        promptAction,
        redirectPath,
        wizardState,
        setWizardState
      }}
    >
      {children}
    </AuthPromptContext.Provider>
  )
}