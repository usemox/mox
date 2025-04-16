interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

interface GCloudConfig {
  PROJECT_ID: string
  TOPIC_NAME: string
  SUBSCRIPTION_NAME: string
  SERVICE_ACCOUNT: string
  SUBSCRIPTION_ENDPOINT: string
}

export const GCLOUD_CONFIG: GCloudConfig = {
  PROJECT_ID: process.env.GOOGLE_PROJECT_ID!,
  TOPIC_NAME: process.env.GOOGLE_TOPIC_NAME!,
  SUBSCRIPTION_NAME: process.env.GOOGLE_SUBSCRIPTION_NAME!,
  SERVICE_ACCOUNT: process.env.GOOGLE_SERVICE_ACCOUNT!,
  SUBSCRIPTION_ENDPOINT: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/${process.env.GOOGLE_TOPIC_NAME}`
}

export const OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:8000/oauth2callback',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/pubsub',
    'https://www.googleapis.com/auth/contacts.readonly'
  ]
}

// Constants for IPC communication
export const IPC_CHANNELS = {
  AUTH: {
    START_AUTH: 'auth:start',
    AUTH_SUCCESS: 'auth:success',
    AUTH_FAILED: 'auth:failed',
    CHECK_AUTH: 'auth:check',
    LOGOUT: 'auth:logout'
  },
  NOTIFICATIONS: {
    NEW_EMAILS: 'notifications:new-emails',
    EVENTS_MESSAGE: 'events:message'
  },
  EMAILS: {
    FETCH: 'emails:fetch',
    FETCH_SUCCESS: 'emails:fetch:success',
    FETCH_ERROR: 'emails:fetch:error',
    FETCH_THREAD: 'emails:fetch:thread',
    MARK_AS_ARCHIVED: 'emails:mark:archive',
    MARK_AS_READ: 'emails:mark:read',
    FETCH_PROFILE: 'email:fetch:profile',

    SEND: 'emails:send',

    SEARCH: 'emails:search',
    SEARCH_REFERENCE: 'emails:search:reference',
    SEARCH_CHUNK: 'emails:search:chunk',
    SEARCH_DONE: 'emails:search:done',

    // Stream Summary
    GENERATE_SUMMARY: 'emails:generate:summary',
    SUMMARY_CHUNK: 'emails:summary:chunk',
    SUMMARY_DONE: 'emails:summary:done',

    // Categories
    CATEGORIES: 'emails:fetch:categories',

    GET_EMAIL_ACTION_ITEMS: 'emails:get:action-items',

    // AI
    AI_GENERATE: 'ai:generate',
    AI_GENERATE_CHUNK: 'ai:generate:chunk',
    AI_GENERATE_DONE: 'ai:generate:done',

    // Labels
    ADD_LABELS: 'emails:labels:add',
    REMOVE_LABELS: 'emails:labels:remove'
  },
  PEOPLE: {
    SEARCH: 'people:search'
  },
  ACTION_ITEMS: {
    FETCH_BY_EMAIL_ID: 'action-items:fetch:by-email-id',
    MARK_AS_COMPLETED: 'action-items:mark:completed'
  },
  SETTINGS: {
    GET_CREDENTIALS: 'settings:credentials:get',
    SET_CREDENTIAL: 'settings:credentials:set',
    DELETE_CREDENTIAL: 'settings:credentials:delete'
  }
}
