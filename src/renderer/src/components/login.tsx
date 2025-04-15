import { Button } from '@renderer/components/ui/button'
import { useNavigate } from '@tanstack/react-router'

import { useState, type JSX, type MouseEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import logo from '@renderer/assets/logo-dark.png'

export const Login = (): JSX.Element => {
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gray-950">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center gap-1 self-center align-middle">
                <img src={logo} alt="Future Mail" className="h-10 w-10" />
                <CardTitle className="text-xl">future mail</CardTitle>
              </div>
              <CardDescription>Login with your Google account</CardDescription>
            </CardHeader>
            <CardContent>
              <form>
                <div className="grid gap-6">
                  <div className="flex flex-col gap-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isLoading}
                      onClick={(e) => handleLogin(e)}
                    >
                      <GoogleIcon />
                      {isLoading ? 'Awaiting consent...' : 'Login with Google'}
                    </Button>
                  </div>
                </div>
              </form>
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
}

const GoogleIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      fill="currentColor"
    />
  </svg>
)
