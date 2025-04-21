import { Button } from '@renderer/components/ui/button'
import { useNavigate } from '@tanstack/react-router'

import { useState, type JSX, type MouseEvent } from 'react'
import { Card, CardContent, CardHeader } from './ui/card'
import logo from '@renderer/assets/logo.png'
import { Input } from './ui/input'
import settingsStore from '@renderer/stores/settings'
import { OAUTH_CONFIG_KEYS, GCLOUD_CONFIG_KEYS } from '@/types/config'
import { observer } from 'mobx-react-lite'

const AuthLogin = observer((): JSX.Element => {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.preventDefault()
    try {
      setIsLoading(true)
      const response = await window.api.auth.startAuth()
      if (!response.success) {
        throw new Error(response.error)
      }
      navigate({ to: '/', search: { category: undefined } })
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      className="w-full"
      disabled={isLoading || !settingsStore.isAuthReady}
      onClick={(e) => handleLogin(e)}
    >
      <GoogleIcon />
      {isLoading ? 'Awaiting consent...' : 'Login with Google'}
    </Button>
  )
})

const GoogleConfig = (): JSX.Element => (
  <form className="flex flex-col gap-2">
    <div className="flex flex-col mb-2">
      <h3 className="text-sm font-semibold">OAuth Credentials</h3>
      <p className="text-xs text-muted-foreground">
        Configure OAuth credentials to use Gmail APIs. You can generate them from{' '}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          className="text-primary"
          rel="noopener noreferrer"
        >
          GCloud Credentials
        </a>
        .
      </p>
    </div>
    <Input
      type="text"
      placeholder="OAuth Client ID"
      onChange={(e) => settingsStore.upsertSecret(OAUTH_CONFIG_KEYS.CLIENT_ID, e.target.value)}
    />
    <Input
      type="text"
      placeholder="OAuth Client Secret"
      onChange={(e) => settingsStore.upsertSecret(OAUTH_CONFIG_KEYS.CLIENT_SECRET, e.target.value)}
    />
  </form>
)

const GCloudConfig = (): JSX.Element => (
  <form className="flex flex-col gap-2">
    <div className="flex flex-col mb-2">
      <h3 className="text-sm font-semibold">Google Cloud Config</h3>
      <p className="text-xs text-muted-foreground">
        Configure your Google Cloud project to continue. You can create one in{' '}
        <a
          href="https://console.cloud.google.com/projectcreate"
          target="_blank"
          className="text-primary"
        >
          GCloud Console
        </a>
        .
      </p>
    </div>
    <Input
      type="text"
      placeholder="Project ID"
      onChange={(e) => settingsStore.upsertSecret(GCLOUD_CONFIG_KEYS.PROJECT_ID, e.target.value)}
    />
    <Input
      type="text"
      placeholder="Topic Name"
      onChange={(e) => settingsStore.upsertSecret(GCLOUD_CONFIG_KEYS.TOPIC_NAME, e.target.value)}
    />
    <Input
      type="text"
      placeholder="Subscription Name"
      onChange={(e) =>
        settingsStore.upsertSecret(GCLOUD_CONFIG_KEYS.SUBSCRIPTION_NAME, e.target.value)
      }
    />
  </form>
)

export const Login = (): JSX.Element => (
  <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gray-950">
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 items-center pb-6">
            <img src={logo} alt="mox" className="w-10 h-10 m-0" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <GCloudConfig />
            <GoogleConfig />
            <AuthLogin />
          </CardContent>
        </Card>
        <div className="text-balance text-center text-xs text-muted-background [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
          By clicking continue, you agree to our <a href="#">Terms of Service</a> and{' '}
          <a href="#">Privacy Policy</a>.
        </div>
      </div>
    </div>
  </div>
)

const GoogleIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      fill="currentColor"
    />
  </svg>
)
