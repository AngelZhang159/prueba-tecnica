import { useState } from 'react'  
import Buscador from './components/Buscador'
import ListaProductos from './components/ListaProductos'

function App() {
  const [query, setQuery] = useState('');

  return (
    <>
      <header>
        <h1 className='font-black text-5xl p-6'>PRUEBA TÉCNICA - ANGEL ZHANG</h1>
      </header>
      <main>
        <Buscador query={query} onChange={setQuery} />
        <ListaProductos query={query} />
      </main>
    </>
  )
}

export default App
