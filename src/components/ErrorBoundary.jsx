import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Error captured by ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-boreal-dark text-white p-6">
          <div className="max-w-2xl text-center">
            <h2 className="text-2xl font-bold mb-4">Algo salió mal</h2>
            <p className="mb-4">Ha ocurrido un error en la aplicación. Puedes recargar la página o volver más tarde.</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded bg-boreal-aqua text-boreal-dark font-bold">Recargar</button>
            </div>
            <details className="mt-4 text-left text-sm text-gray-300">
              <summary>Detalles del error</summary>
              <pre className="whitespace-pre-wrap">{String(this.state.error)}</pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
