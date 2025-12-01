import { RouterProvider, createRouter } from '@tanstack/react-router'

// Import the generated route tree
// NOTE: If you see a red line here, it will disappear once you run 'npm run dev'
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for global type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <RouterProvider router={router} />
  )
}

export default App