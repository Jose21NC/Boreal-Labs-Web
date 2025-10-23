import React from 'react'

const Select = ({ children, onValueChange, value, disabled }) => {
  // Este componente actúa como wrapper para los subcomponentes; para simplicidad
  // esperamos que el usuario use SelectTrigger con un <select> nativo debajo
  return <div>{children}</div>
}

const SelectTrigger = ({ children, id, className }) => {
  return (
    <div className={className} id={id}>
      {children}
    </div>
  )
}

const SelectValue = ({ placeholder }) => {
  return <span>{placeholder}</span>
}

const SelectContent = ({ children, className }) => {
  return <div className={className}>{children}</div>
}

const SelectItem = ({ children, value, className }) => {
  return <div data-value={value} className={className}>{children}</div>
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
