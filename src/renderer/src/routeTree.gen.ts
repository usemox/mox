/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SearchImport } from './routes/search'
import { Route as LoginImport } from './routes/login'
import { Route as FolderImport } from './routes/$folder'
import { Route as IndexImport } from './routes/index'
import { Route as ThreadsThreadIdImport } from './routes/threads.$threadId'

// Create/Update Routes

const SearchRoute = SearchImport.update({
  id: '/search',
  path: '/search',
  getParentRoute: () => rootRoute,
} as any)

const LoginRoute = LoginImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRoute,
} as any)

const FolderRoute = FolderImport.update({
  id: '/$folder',
  path: '/$folder',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const ThreadsThreadIdRoute = ThreadsThreadIdImport.update({
  id: '/threads/$threadId',
  path: '/threads/$threadId',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/$folder': {
      id: '/$folder'
      path: '/$folder'
      fullPath: '/$folder'
      preLoaderRoute: typeof FolderImport
      parentRoute: typeof rootRoute
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginImport
      parentRoute: typeof rootRoute
    }
    '/search': {
      id: '/search'
      path: '/search'
      fullPath: '/search'
      preLoaderRoute: typeof SearchImport
      parentRoute: typeof rootRoute
    }
    '/threads/$threadId': {
      id: '/threads/$threadId'
      path: '/threads/$threadId'
      fullPath: '/threads/$threadId'
      preLoaderRoute: typeof ThreadsThreadIdImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/$folder': typeof FolderRoute
  '/login': typeof LoginRoute
  '/search': typeof SearchRoute
  '/threads/$threadId': typeof ThreadsThreadIdRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/$folder': typeof FolderRoute
  '/login': typeof LoginRoute
  '/search': typeof SearchRoute
  '/threads/$threadId': typeof ThreadsThreadIdRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/$folder': typeof FolderRoute
  '/login': typeof LoginRoute
  '/search': typeof SearchRoute
  '/threads/$threadId': typeof ThreadsThreadIdRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/$folder' | '/login' | '/search' | '/threads/$threadId'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/$folder' | '/login' | '/search' | '/threads/$threadId'
  id:
    | '__root__'
    | '/'
    | '/$folder'
    | '/login'
    | '/search'
    | '/threads/$threadId'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  FolderRoute: typeof FolderRoute
  LoginRoute: typeof LoginRoute
  SearchRoute: typeof SearchRoute
  ThreadsThreadIdRoute: typeof ThreadsThreadIdRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  FolderRoute: FolderRoute,
  LoginRoute: LoginRoute,
  SearchRoute: SearchRoute,
  ThreadsThreadIdRoute: ThreadsThreadIdRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/$folder",
        "/login",
        "/search",
        "/threads/$threadId"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/$folder": {
      "filePath": "$folder.tsx"
    },
    "/login": {
      "filePath": "login.tsx"
    },
    "/search": {
      "filePath": "search.tsx"
    },
    "/threads/$threadId": {
      "filePath": "threads.$threadId.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
